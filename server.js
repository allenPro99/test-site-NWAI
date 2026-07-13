import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 3000;

const CERT_DIR = path.join(__dirname, 'certs');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');

// genera certificato self-signed se non esiste
if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
  console.log('Generating self-signed certificate...');
  fs.mkdirSync(CERT_DIR, { recursive: true });
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout "${KEY_PATH}" -out "${CERT_PATH}" -days 365 -nodes -subj "/CN=localhost"`,
    { stdio: 'inherit' }
  );
  console.log('Certificate generated.');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

// mappa dei file da servire:
// /              → test/index.html
// /widget.js     → widget/dist/latest/widget.js
// /webchat.css   → widget/dist/latest/webchat.css
function resolveFilePath(urlPath) {
  if (urlPath === '/' || urlPath === '/index.html') {
    return path.join(__dirname, 'index.html');
  }

  if (urlPath === '/client.html') {
    return path.join(__dirname, 'client.html');
  }

  if (urlPath === '/widget.js') {
    return path.join(__dirname, '..', 'widget', 'dist', 'latest', 'widget.js');
  }

  if (urlPath === '/webchat.css') {
    return path.join(__dirname, '..', 'widget', 'dist', 'latest', 'webchat.css');
  }

  // file in latest/ (per il CDN_BASE_URL detection del widget)
  if (urlPath.startsWith('/latest/')) {
    return path.join(__dirname, '..', 'widget', 'dist', urlPath);
  }

  return null;
}


const server = https.createServer(
  {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH),
  },
  (req, res) => {
    console.log(`${req.method} ${req.url}`);

    const filePath = resolveFilePath(req.url);

    if (!filePath || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  }
);

server.listen(PORT, () => {
  console.log(`\n  HTTPS test server running on:`);
  console.log(`  https://localhost:${PORT}\n`);
  console.log(`  (Accept the self-signed certificate warning in the browser)\n`);
  console.log(`  Serving:`);
  console.log(`    /              → test/index.html`);
  console.log(`    /widget.js     → widget/dist/latest/widget.js`);
  console.log(`    /webchat.css   → widget/dist/latest/webchat.css`);
  console.log(`    /latest/*      → widget/dist/latest/*\n`);
});

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
};

const NO_INDEX = 'User-agent: *\nDisallow: /\n';

export function defaultRoot() {
  return process.env.DEV_ROOT || path.join(os.homedir(), 'xmage-dev-dist');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

export function ribbonHtml(info) {
  if (!info || !info.ref) return '';
  const sha = info.shortSha || String(info.sha || '').slice(0, 7);
  let when = '';
  if (info.builtAt) {
    const date = new Date(info.builtAt);
    if (!Number.isNaN(date.getTime())) when = ` · ${date.toISOString().replace('T', ' ').slice(0, 16)}Z`;
  }
  const run = info.runUrl
    ? ` · <a href="${escapeHtml(info.runUrl)}" target="_blank" rel="noreferrer" style="color:#8ecbff;text-decoration:none">run</a>`
    : '';
  return `<div data-dev-ribbon="1" title="${escapeHtml(info.sha || '')}" style="position:fixed;left:8px;bottom:8px;z-index:2147483647;max-width:min(90vw,720px);padding:4px 8px;border-radius:6px;background:rgba(20,20,24,.92);color:#e8e8ef;font:12px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.4);white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><b>dev</b> · ${escapeHtml(info.ref)} @ ${escapeHtml(sha)}${escapeHtml(when)}${run}</div>`;
}

export function injectRibbon(html, info) {
  const ribbon = ribbonHtml(info);
  if (!ribbon) return html;
  const at = html.toLowerCase().lastIndexOf('</body>');
  if (at === -1) return `${html}${ribbon}`;
  return `${html.slice(0, at)}${ribbon}${html.slice(at)}`;
}

export function readInfo(infoPath) {
  try {
    return JSON.parse(fs.readFileSync(infoPath, 'utf8'));
  } catch {
    return null;
  }
}

function headersFor(ext, { noStore, immutable }) {
  const cache = noStore ? 'no-store' : (immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300');
  return {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': cache,
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
  };
}

function sendText(res, req, status, body, extra = {}) {
  const buf = Buffer.from(body);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    ...extra,
  });
  res.end(req.method === 'HEAD' ? undefined : buf);
}

export function createDevServer({ root = defaultRoot(), infoPath, log = () => {} } = {}) {
  const rootDir = path.resolve(root);
  const info = infoPath || path.join(rootDir, 'dev-info.json');

  return http.createServer((req, res) => {
    try {
      handle(req, res);
    } catch (err) {
      log('error', req.method, req.url, err && err.message);
      sendText(res, req, 500, 'internal error');
    }
  });

  function handle(req, res) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      sendText(res, req, 405, 'method not allowed', { Allow: 'GET, HEAD' });
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://dev.invalid').pathname);
    } catch {
      sendText(res, req, 400, 'bad request');
      return;
    }
    if (pathname.includes('\0')) {
      sendText(res, req, 400, 'bad request');
      return;
    }

    if (!fs.existsSync(rootDir)) {
      sendText(res, req, 503, 'no build published yet');
      return;
    }

    if (pathname === '/robots.txt' && !fs.existsSync(path.join(rootDir, 'robots.txt'))) {
      sendText(res, req, 200, NO_INDEX);
      return;
    }

    const filePath = path.resolve(rootDir, `.${pathname}`);
    if (filePath !== rootDir && !filePath.startsWith(`${rootDir}${path.sep}`)) {
      log('403', req.method, pathname);
      sendText(res, req, 403, 'forbidden');
      return;
    }

    let target = filePath;
    if (pathname.endsWith('/')) target = path.join(filePath, 'index.html');

    if (fs.existsSync(target) && fs.statSync(target).isFile()) {
      sendFile(res, req, target, pathname);
      return;
    }

    const ext = path.extname(pathname);
    if (ext === '' || ext === '.html') {
      const index = path.join(rootDir, 'index.html');
      if (fs.existsSync(index)) {
        sendFile(res, req, index, pathname, { index: true });
        return;
      }
    }

    log('404', req.method, pathname);
    sendText(res, req, 404, 'not found');
  }

  function sendFile(res, req, filePath, pathname, { index = false } = {}) {
    const ext = path.extname(filePath).toLowerCase();
    const isHtml = ext === '.html';
    const immutable = pathname.startsWith('/assets/');
    const noStore = isHtml || pathname === '/dev-info.json';
    const headers = headersFor(ext, { noStore, immutable });

    if (isHtml) {
      const body = Buffer.from(injectRibbon(fs.readFileSync(filePath, 'utf8'), readInfo(info)));
      res.writeHead(200, { ...headers, 'Content-Length': body.length });
      res.end(req.method === 'HEAD' ? undefined : body);
      log('200', req.method, pathname, index ? '(spa)' : '');
      return;
    }

    const { size } = fs.statSync(filePath);
    res.writeHead(200, { ...headers, 'Content-Length': size });
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
    log('200', req.method, pathname);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const port = Number(process.env.DEV_PORT || 8799);
  const bind = process.env.DEV_BIND || '127.0.0.1';
  const root = defaultRoot();
  const server = createDevServer({ root, log: (...a) => console.log(new Date().toISOString(), ...a) });
  server.listen(port, bind, () => {
    console.log(`${new Date().toISOString()} dev web server http://${bind}:${port} -> ${root}`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => server.close(() => process.exit(0)));
  }
}

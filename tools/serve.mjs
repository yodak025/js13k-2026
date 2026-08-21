// Minimal static file server, no dependencies.
//
// Usage: node tools/serve.mjs <directory> [port]
// The port defaults to $PORT or 8013. Responses are never cached so a
// rebuild is picked up with a plain reload.

import http from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] ?? '.');
const port = Number(process.env.PORT ?? process.argv[3] ?? 8013);

const MIME = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript'], ['.mjs', 'text/javascript'],
  ['.css', 'text/css'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'], ['.gif', 'image/gif'], ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.json', 'application/json'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.wasm', 'application/wasm'],
]);

if (!existsSync(root) || !statSync(root).isDirectory()) {
  console.error(`serve: ${root} is not a directory`);
  process.exit(1);
}

http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.normalize(path.join(root, pathname));
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403).end('forbidden');
    return;
  }
  if (existsSync(file) && statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!existsSync(file) || !statSync(file).isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': MIME.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
    'cache-control': 'no-store',
  });
  createReadStream(file).pipe(res);
}).listen(port, () => {
  console.log(`Serving ${path.relative(process.cwd(), root) || '.'} at http://localhost:${port}`);
});

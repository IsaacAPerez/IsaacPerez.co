/* Local-only preview. Replays Vercel headers; never exposes repository-only inputs. */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.svg':'image/svg+xml', '.avif':'image/avif', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.png':'image/png', '.webp':'image/webp', '.woff2':'font/woff2', '.glb':'model/gltf-binary', '.mp4':'video/mp4', '.gif':'image/gif', '.ico':'image/x-icon' };
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json')));
const exclusions = fs.readFileSync(path.join(root, '.vercelignore'), 'utf8').split('\n').map(s=>s.trim()).filter(s=>s && !s.startsWith('#'));
function globalHeaders(res) {
  for (const rule of config.headers || []) {
    if (rule.source !== '/(.*)') continue;
    for (const header of rule.headers) res.setHeader(header.key, header.value);
  }
}
function createServer(options = {}) {
  return http.createServer(async (req, res) => {
    globalHeaders(res);
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
    if (pathname === '/api/voice' && options.voiceHandler) return options.voiceHandler(req, res);
    if (pathname === '/api/voice') {
      const endpoint = path.join(root, 'api/voice.js');
      if (fs.existsSync(endpoint)) {
        try {
          if (req.method === 'POST') {
            const chunks=[]; let bytes=0;
            for await (const chunk of req) { bytes += chunk.length; if (bytes > 1500000) { res.writeHead(413); return res.end(); } chunks.push(chunk); }
            req.body = JSON.parse(Buffer.concat(chunks).toString());
          }
          req.query = Object.fromEntries(new URL(req.url, 'http://localhost').searchParams);
          return require(endpoint)(req,res);
        } catch (_) { res.writeHead(503, {'Content-Type':'application/json'}); return res.end(JSON.stringify({available:false,error:'voice_unavailable'})); }
      }
      res.writeHead(200, {'Content-Type':'application/json', 'Cache-Control':'no-store'});
      return res.end(JSON.stringify({available:false}));
    }
    const relative = pathname.replace(/^\/+/, '');
    const blocked = relative.split('/').some(part=>part.startsWith('.')) || relative.startsWith('api/') || exclusions.some(entry=>relative === entry.replace(/\/$/,'') || (entry.endsWith('/') && relative.startsWith(entry)));
    if (blocked) { res.writeHead(404); return res.end('Not found'); }
    let file = path.resolve(root, relative);
    if (!file.startsWith(root + '/') && file !== root) { res.writeHead(404); return res.end('Not found'); }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file) && root.endsWith('/firstunit.co') && !path.extname(relative)) file = path.join(root, 'index.html');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.setHeader('Content-Type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
}
module.exports = {createServer, root};
if (require.main === module) {
  const port = Number(process.env.PORT || process.argv[2] || 0);
  const server = createServer();
  server.listen(port, '127.0.0.1', ()=>console.log(JSON.stringify({url:'http://127.0.0.1:'+server.address().port, root, headers:'vercel.json', fixture:false})));
}

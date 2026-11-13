#!/usr/bin/env node
'use strict';
// Attended local preview only. Credentials stay in the parent process environment;
// static serving follows deployment exclusions and never serves dotfiles or API source.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {createVoiceHandler}=require('../api/_lib/voice-core');
const {fileStore}=require('../api/_lib/voice-store');
const root=path.resolve(__dirname,'..');
const site=fs.existsSync(path.join(root,'about/index.html'))?'personal':'firstunit';
const port=Number(process.env.VOICE_PREVIEW_PORT|| (site==='personal'?8431:8432));
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local port');
const ledger=process.env.VOICE_PREVIEW_LEDGER;
if(!ledger||!path.isAbsolute(ledger)||path.resolve(ledger).startsWith(root+path.sep))throw new Error('Use an absolute ledger path outside the public repository');
const expires=Date.parse(process.env.VOICE_PREVIEW_EXPIRES_AT||'2026-12-10T22:05:52Z');
const store=fileStore(ledger,{capMicroUsd:8000000,expiresAt:expires});
const env={...process.env,VOICE_LOCAL_PREVIEW:'true',VOICE_LOCAL_ORIGIN:'http://127.0.0.1:'+port};
let diagnostic;
if(process.env.VOICE_PREVIEW_DIAGNOSTICS_DIR) {
  const target=process.env.VOICE_PREVIEW_DIAGNOSTICS_DIR;
  if(!path.isAbsolute(target)||path.resolve(target).startsWith(root+path.sep))throw new Error('Diagnostics must be outside the public repository');
  fs.mkdirSync(target,{recursive:true,mode:0o700});
  if(fs.lstatSync(target).isSymbolicLink()||fs.realpathSync(target).startsWith(root+path.sep))throw new Error('Unsafe diagnostics path');
  diagnostic=record=>fs.writeFileSync(path.join(target,site+'-'+record.requestId+'.json'),JSON.stringify(record),{flag:'wx',mode:0o600});
}
const voice=createVoiceHandler({site,root,env,store,diagnostic});
const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.avif':'image/avif','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.woff2':'font/woff2','.glb':'model/gltf-binary','.mp4':'video/mp4','.wav':'audio/wav'};
const config=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'),'utf8'));
function deny(pathname) {
  return pathname.split('/').some(p=>p.startsWith('.')||['api','tools','scripts','docs','brand','marketing','node_modules'].includes(p))||
    (pathname.startsWith('/catalog/')&&pathname!=='/catalog/public-assets.json')||/\.(md|sql|toml|sh|py|cjs|lock)$/i.test(pathname)||['/Resume.pdf','/vercel.json'].includes(pathname);
}
function headers(res) {
  for(const row of config.headers||[])if(row.source==='/(.*)'||row.source==='/:path*')for(const h of row.headers||[])res.setHeader(h.key,h.value);
  res.setHeader('Cache-Control','no-store');
}
const server=http.createServer(async(req,res)=>{
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname);}catch(_){res.writeHead(400).end();return;}
  if(pathname==='/api/voice'){await voice(req,res);return;}
  if(!['GET','HEAD'].includes(req.method)||deny(pathname)){res.writeHead(404).end();return;}
  let filename=path.resolve(root,'.'+pathname);
  if(!filename.startsWith(root+path.sep)&&filename!==root){res.writeHead(404).end();return;}
  try {
    if(fs.existsSync(filename)&&fs.statSync(filename).isDirectory())filename=path.join(filename,'index.html');
    if(!fs.existsSync(filename)&&site==='firstunit'&&!path.extname(pathname))filename=path.join(root,'index.html');
    const real=fs.realpathSync(filename);if(!real.startsWith(root+path.sep))throw new Error();
    headers(res);res.setHeader('Content-Type',type[path.extname(filename).toLowerCase()]||'application/octet-stream');
    const bytes=fs.readFileSync(filename);res.setHeader('Content-Length',bytes.length);res.statusCode=200;res.end(req.method==='HEAD'?undefined:bytes);
  }catch(_){res.writeHead(404).end();}
});
server.requestTimeout=45000;server.headersTimeout=10000;
server.listen(port,'127.0.0.1',()=>console.log(JSON.stringify({site,url:'http://127.0.0.1:'+port,voiceConfigured:env.VOICE_ENABLED==='true'&&Boolean(env.OPENAI_API_KEY),ledger})));

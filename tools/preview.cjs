// Read-only preview restricted to this website directory and loopback interface.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2','.glb':'model/gltf-binary'};
http.createServer((req,res)=>{
  let file;
  try { file = path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname)); }
  catch { res.writeHead(400).end(); return; }
  const relative = path.relative(root,file);
  if(relative.startsWith('..') || path.isAbsolute(relative) || relative.split(path.sep).some(p=>p.startsWith('.')||p==='node_modules')) {res.writeHead(403).end();return;}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory()) file=path.join(file,'index.html');
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end('Not found');return;}res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
}).listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173/dog-kit/'));

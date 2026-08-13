const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = Number(process.env.PORT || 4173);
const clients = new Set();
const ignored = new Set(['node_modules', '.git']);
const mime = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.ico': 'image/x-icon', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf'
};
const reloadClient = `<script>(()=>{const source=new EventSource('/__live');source.onmessage=event=>{if(event.data==='reload')location.reload()};source.onerror=()=>console.info('Visualização ao vivo: reconectando...')})()</script>`;

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const requested = decoded === '/' ? '/index.html' : decoded;
  const file = path.resolve(root, `.${requested}`);
  return file.startsWith(root) ? file : null;
}

const server = http.createServer((req, res) => {
  if (req.url === '/__live') {
    res.writeHead(200, {'Content-Type':'text/event-stream','Cache-Control':'no-cache','Connection':'keep-alive'});
    res.write(': conectado\n\n'); clients.add(res); req.on('close',()=>clients.delete(res)); return;
  }
  const file = safePath(req.url || '/');
  if (!file) { res.writeHead(403); res.end('Acesso negado'); return; }
  fs.stat(file, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); res.end('Arquivo não encontrado'); return; }
    fs.readFile(file, (readError, data) => {
      if (readError) { res.writeHead(500); res.end('Erro ao ler arquivo'); return; }
      const ext = path.extname(file).toLowerCase();
      if (ext === '.html') data = Buffer.from(data.toString('utf8').replace('</body>', `${reloadClient}</body>`));
      res.writeHead(200, {'Content-Type':mime[ext]||'application/octet-stream','Cache-Control':'no-store'}); res.end(data);
    });
  });
});

let timer;
fs.watch(root, {recursive:true}, (_event, filename='') => {
  if ([...ignored].some(folder => filename.split(/[\\/]/).includes(folder))) return;
  clearTimeout(timer); timer=setTimeout(()=>clients.forEach(client=>client.write('data: reload\n\n')),120);
});

server.listen(port, () => console.log(`Visualização ao vivo: http://localhost:${port}`));

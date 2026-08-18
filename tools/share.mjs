// Serve the whole project over the local network, for reviewing on a phone,
// tablet or another machine.
//
//   node tools/share.mjs [port]
//
// Serves the project root with directory browsing. Exported SVGs are
// self-contained (fonts and logos embedded), so they render on any device
// with no extra requests.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8787;

const TYPES = {
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.moho': 'application/zip',
  '.zip': 'application/zip',
};

const PREVIEWABLE = /\.(svg|png|jpe?g|gif|webp)$/i;

/** Non-internal IPv4 addresses, i.e. how other devices can reach this host. */
function lanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === 'IPv4' && !n.internal)
    .map((n) => n.address);
}

const CSS = `
:root { color-scheme: dark; }
body { margin:0; padding:16px 16px 48px; background:#12141a; color:#e8e6e1;
       font:15px/1.55 -apple-system,system-ui,"SF Arabic",sans-serif; }
h1 { font-size:15px; font-weight:600; margin:0 0 4px; opacity:.9;
     word-break:break-all; direction:ltr; text-align:left; }
.crumb { font-size:13px; opacity:.5; margin-bottom:16px; direction:ltr; text-align:left; }
.crumb a { color:#8ab4ff; }
.grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr));
        gap:10px; margin-bottom:22px; }
.card { background:#1b1e26; border:1px solid #2a2f3a; border-radius:10px;
        padding:8px; text-align:center; }
.card img { width:100%; height:110px; object-fit:contain; background:#0d0f14;
            border-radius:6px; display:block; }
.card .n { font-size:11px; opacity:.7; margin-top:6px; word-break:break-all; direction:ltr; }
ul { list-style:none; padding:0; margin:0; }
li { display:flex; justify-content:space-between; gap:12px; align-items:center;
     padding:10px 13px; border:1px solid #2a2f3a; border-radius:9px;
     margin-bottom:6px; background:#1b1e26; direction:ltr; text-align:left; }
a { color:#8ab4ff; text-decoration:none; word-break:break-all; }
a:hover { text-decoration:underline; }
.sz { opacity:.45; font-size:12px; font-variant-numeric:tabular-nums; white-space:nowrap; }
.dir a { color:#ffd479; font-weight:500; }
`;

function listing(dirRel) {
  const dirAbs = path.join(ROOT, dirRel);
  const entries = fs
    .readdirSync(dirAbs, { withFileTypes: true })
    .filter((e) => !e.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const href = (name) =>
    path.posix.join('/', dirRel.split(path.sep).map(encodeURIComponent).join('/'), encodeURIComponent(name));

  const previews = entries.filter((e) => !e.isDirectory() && PREVIEWABLE.test(e.name));
  const grid = previews.length
    ? `<div class="grid">${previews
        .map((e) => `<a class="card" href="${href(e.name)}"><img src="${href(e.name)}" loading="lazy" alt=""><div class="n">${e.name}</div></a>`)
        .join('')}</div>`
    : '';

  const rows = entries
    .map((e) => {
      if (e.isDirectory()) {
        return `<li class="dir"><a href="${href(e.name)}/">${e.name}/</a><span class="sz">dir</span></li>`;
      }
      let size = '';
      try {
        const s = fs.statSync(path.join(dirAbs, e.name));
        size = s.size > 1048576 ? `${(s.size / 1048576).toFixed(1)} MB` : `${(s.size / 1024).toFixed(0)} KB`;
      } catch {}
      return `<li><a href="${href(e.name)}">${e.name}</a><span class="sz">${size}</span></li>`;
    })
    .join('');

  // Breadcrumb back up the tree.
  const parts = dirRel ? dirRel.split(path.sep) : [];
  const crumbs = ['<a href="/">/</a>']
    .concat(
      parts.map((p, i) => {
        const to = '/' + parts.slice(0, i + 1).map(encodeURIComponent).join('/') + '/';
        return `<a href="${to}">${p}</a>`;
      })
    )
    .join(' <span style="opacity:.3">›</span> ');

  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${dirRel || 'sheeps'}</title><style>${CSS}</style></head><body>
<h1>${dirRel || 'sheeps'}</h1>
<div class="crumb">${crumbs}</div>
${grid}
<ul>${rows}</ul>
</body></html>`;
}

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end('bad url');
    return;
  }

  const target = path.join(ROOT, rel);
  if (!target.startsWith(ROOT)) {
    res.writeHead(403).end('forbidden');
    return;
  }

  let st;
  try {
    st = fs.statSync(target);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found: ' + rel);
    return;
  }

  if (st.isDirectory()) {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(listing(path.relative(ROOT, target)));
    return;
  }

  res.writeHead(200, {
    'content-type': TYPES[path.extname(target).toLowerCase()] || 'application/octet-stream',
    'content-length': st.size,
    'cache-control': 'no-store',
  });
  fs.createReadStream(target).pipe(res);
});

// 0.0.0.0 so other devices on the network can connect, not just this machine.
server.listen(PORT, '0.0.0.0', () => {
  const addrs = lanAddresses();
  console.log(`serving the whole project (${ROOT}) on port ${PORT}\n`);
  console.log(`  local     http://localhost:${PORT}/`);
  for (const a of addrs) console.log(`  network   http://${a}:${PORT}/`);
  const host = addrs[0] || 'localhost';
  console.log(`\n  outputs   http://${host}:${PORT}/out/`);
  console.log(`  poster    http://${host}:${PORT}/out/poster-page.svg`);
  console.log(`  wide      http://${host}:${PORT}/out/poster-wide.svg`);
  console.log(`  assets    http://${host}:${PORT}/assets/incoming/`);
  console.log('\nUnauthenticated: anyone on this network can read every project file.');
});

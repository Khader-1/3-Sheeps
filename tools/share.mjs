// Serve the whole project over the local network, for reviewing on a phone,
// tablet or another machine.
//
//   node tools/share.mjs [port]
//
// Serves the project root with directory browsing. Exported SVGs are
// self-contained (fonts and logos embedded), so they render on any device
// with no extra requests.
//
// It also takes uploads, at /upload. Delivered artwork keeps arriving as
// hundreds of megabytes of video, which is past what a chat attachment or a
// USB round trip is worth; a drag-and-drop page on the same LAN server hands
// them straight to the machine that has to encode them.
//
// Uploads may only land in assets/incoming/ — the one directory that holds
// delivered source material — and the name is stripped to its last component,
// so nothing a client sends can write anywhere else in the tree.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.argv[2]) || 8787;
const UPLOAD_DIR = path.join(ROOT, 'assets/incoming');

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

const UPLOAD_PAGE = `<!doctype html><html lang="ar" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>رفع ملفات</title><style>${CSS}
body { padding:22px 18px 60px; }
h1 { direction:rtl; text-align:right; font-size:19px; }
.hint { opacity:.55; font-size:13px; margin:0 0 20px; }
#drop { border:2px dashed #3a4150; border-radius:14px; padding:44px 18px;
        text-align:center; background:#171a21; cursor:pointer; transition:.15s; }
#drop.hot { border-color:#8ab4ff; background:#1d2330; }
#drop b { display:block; font-size:17px; margin-bottom:6px; }
#drop span { opacity:.5; font-size:13px; }
#list { margin-top:20px; }
.row { border:1px solid #2a2f3a; border-radius:10px; background:#1b1e26;
       padding:11px 13px; margin-bottom:8px; }
.row .top { display:flex; justify-content:space-between; gap:12px; font-size:13px; }
.row .nm { word-break:break-all; }
.row .st { opacity:.5; white-space:nowrap; font-variant-numeric:tabular-nums; }
.bar { height:5px; border-radius:3px; background:#2a2f3a; margin-top:9px; overflow:hidden; }
.bar i { display:block; height:100%; width:0; background:#8ab4ff; transition:width .2s; }
.done .bar i { background:#5cc98a; }
.fail .bar i { background:#e2686a; width:100% !important; }
</style></head><body>
<h1>رفع ملفات إلى المشروع</h1>
<p class="hint">بتنحفظ في <code style="direction:ltr;display:inline-block">assets/incoming/</code> — ما في حدّ للحجم.</p>
<div id="drop"><b>اسحب الملفات لهون</b><span>أو اضغط للاختيار</span></div>
<input id="pick" type="file" multiple hidden>
<div id="list"></div>
<script>
const drop = document.getElementById('drop');
const pick = document.getElementById('pick');
const list = document.getElementById('list');
const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

drop.onclick = () => pick.click();
pick.onchange = () => { send([...pick.files]); pick.value = ''; };
for (const ev of ['dragenter', 'dragover']) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('hot'); });
}
for (const ev of ['dragleave', 'drop']) {
  drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('hot'); });
}
drop.addEventListener('drop', (e) => send([...e.dataTransfer.files]));

// One at a time. Several large files racing each other on a phone's wifi just
// makes every one of them slower and the progress bars meaningless.
let queue = Promise.resolve();
function send(files) {
  for (const f of files) queue = queue.then(() => put(f));
}

function put(file) {
  const row = document.createElement('div');
  row.className = 'row';
  row.innerHTML = '<div class="top"><span class="nm"></span><span class="st">في الانتظار…</span></div>' +
                  '<div class="bar"><i></i></div>';
  row.querySelector('.nm').textContent = file.name;
  list.prepend(row);
  const st = row.querySelector('.st');
  const bar = row.querySelector('.bar i');

  return new Promise((done) => {
    const x = new XMLHttpRequest();
    x.open('PUT', '/upload/' + encodeURIComponent(file.name));
    x.upload.onprogress = (e) => {
      if (!e.lengthComputable) return;
      bar.style.width = (e.loaded / e.total * 100) + '%';
      st.textContent = mb(e.loaded) + ' / ' + mb(e.total);
    };
    x.onload = () => {
      const ok = x.status >= 200 && x.status < 300;
      row.classList.add(ok ? 'done' : 'fail');
      st.textContent = ok ? 'تمّ · ' + mb(file.size) : 'فشل · ' + x.responseText;
      if (ok) bar.style.width = '100%';
      done();
    };
    x.onerror = () => { row.classList.add('fail'); st.textContent = 'انقطع الاتصال'; done(); };
    x.send(file);
  });
}
</script></body></html>`;

/**
 * Where an upload is allowed to land.
 *
 * path.basename first, so a name like ../../sw.js or one with a directory in
 * it collapses to its last component before it is ever joined to anything.
 * The startsWith check after the join is the belt to that braces: it catches
 * whatever basename does not, on whichever platform.
 */
function uploadTarget(name) {
  const base = path.basename(name).replace(/^\.+/, '').trim();
  if (!base) return null;
  const file = path.join(UPLOAD_DIR, base);
  if (path.dirname(file) !== UPLOAD_DIR) return null;
  return file;
}

function receive(req, res, name) {
  const file = uploadTarget(name);
  if (!file) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('bad name');
    return;
  }

  // Into a .part first. A connection dropped halfway through would otherwise
  // leave a truncated file sitting under its real name, looking finished.
  const part = file + '.part';
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const out = fs.createWriteStream(part);

  const fail = (code, why) => {
    out.destroy();
    fs.rm(part, { force: true }, () => {});
    if (!res.headersSent) res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8' }).end(why);
  };

  req.on('aborted', () => fail(400, 'aborted'));
  out.on('error', (e) => fail(500, e.message));
  req.pipe(out);

  out.on('finish', () => {
    if (req.aborted) return;
    fs.renameSync(part, file);
    const size = fs.statSync(file).size;
    console.log(`  ← ${path.relative(ROOT, file)}  ${(size / 1048576).toFixed(1)} MB`);
    res.writeHead(201, { 'content-type': 'text/plain; charset=utf-8' }).end('ok');
  });
}

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch {
    res.writeHead(400).end('bad url');
    return;
  }

  if (req.method === 'PUT' && rel.startsWith('/upload/')) {
    receive(req, res, rel.slice('/upload/'.length));
    return;
  }
  if (rel === '/upload' || rel === '/upload/') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(UPLOAD_PAGE);
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' }).end('read-only');
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
  console.log(`\n  UPLOAD    http://${host}:${PORT}/upload`);
  console.log('\nUnauthenticated: anyone on this network can read every project file,');
  console.log('and write new ones into assets/incoming/ — nowhere else.');
});

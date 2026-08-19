// Package the whole project as a folder anyone can run with no internet.
//
//   node tools/portable.mjs            -> out/الخراف-الثلاثة-محمول.zip
//   node tools/portable.mjs --release  -> and publish it as a GitHub release
//
// The presentation room may have no usable network, and the people presenting
// alongside are not going to clone a repository and run a build. So: one zip,
// unpack it, double-click, everything works — the deck, both trailers, the
// eleven-minute film, the seven games, the book, the fonts and every sound.
//
// It cannot simply be opened off the disk. Chrome refuses ES module imports
// and fetch() over file://, and the deck, the games and the scene loader all
// depend on both — the book is the only piece that survives a double-click,
// because tools/book.mjs inlines everything into it. So the bundle carries a
// launcher that starts a static server on localhost and opens a browser at it.
//
// The launcher tries Python and then Node, because between them one is on
// almost every machine and neither needs installing on macOS with the
// developer tools present. If neither is there the script says so in Arabic
// rather than flashing a black window and vanishing, which is what a
// double-clicked script that fails normally does.
//
// The film is the reason this is 140 MB and not 10: it is 109 HLS segments.
// They are left exactly as the site serves them, so the offline copy plays it
// the same streaming way, and nothing has to be encoded twice.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const NAME = 'الخراف-الثلاثة-محمول';
const STAGE = path.join(ROOT, 'out', NAME);
// The zip itself is named in ASCII. GitHub strips non-Latin characters out of
// a release asset's filename, and an Arabic one arrives as "-.-.zip"; the
// folder inside keeps its real name, which is what anyone sees after
// unpacking it.
const ZIP = path.join(ROOT, 'out', 'sheeps-offline.zip');
const PORT = 8123;

// A launcher has to survive being double-clicked from Finder, where the working
// directory is the user's home and not the folder the script is sitting in.
const MAC = `#!/bin/bash
# افتح العرض — الخراف الثلاثة والذئب الماكر
cd "$(dirname "$0")" || exit 1
PORT=${PORT}
echo "…يجهّز العرض"
open "http://localhost:$PORT/present.html" 2>/dev/null &
if command -v python3 >/dev/null 2>&1; then exec python3 -m http.server $PORT
elif command -v python  >/dev/null 2>&1; then exec python  -m http.server $PORT
elif command -v node    >/dev/null 2>&1; then exec node server.mjs $PORT
fi
echo ""
echo "لم يُعثر على Python أو Node على هذا الجهاز."
echo "ثبّت أحدهما ثم أعد المحاولة، أو افتح out/book.html مباشرة — الكتاب يعمل وحده."
read -n 1 -s -r -p "اضغط أي مفتاح للإغلاق"
`;

const WIN = `@echo off
chcp 65001 >nul
cd /d "%~dp0"
set PORT=${PORT}
echo .يجهّز العرض
start "" "http://localhost:%PORT%/present.html"
where python3 >nul 2>&1 && (python3 -m http.server %PORT% & goto :eof)
where python  >nul 2>&1 && (python  -m http.server %PORT% & goto :eof)
where node    >nul 2>&1 && (node server.mjs %PORT% & goto :eof)
echo.
echo لم يُعثر على Python أو Node على هذا الجهاز.
echo ثبّت أحدهما ثم أعد المحاولة، أو افتح out\\book.html مباشرة.
pause
`;

// The Node fallback. Deliberately tiny and dependency-free — it is a last
// resort, not the project's server.
const SERVER = `// Static server for the offline bundle. node server.mjs [port]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.argv[2]) || ${PORT};
const T = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8', '.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml; charset=utf-8', '.png':'image/png', '.webp':'image/webp',
  '.jpg':'image/jpeg', '.woff2':'font/woff2', '.mp3':'audio/mpeg', '.wav':'audio/wav',
  '.mp4':'video/mp4', '.m4s':'video/iso.segment', '.m3u8':'application/vnd.apple.mpegurl' };
http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) return res.writeHead(403).end();
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return res.writeHead(404).end('not found');
    const type = T[path.extname(file).toLowerCase()] || 'application/octet-stream';
    // Range support, so seeking in the film works.
    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\\d*)-(\\d*)/.exec(range);
      const start = m[1] ? +m[1] : 0;
      const end = m[2] ? +m[2] : st.size - 1;
      res.writeHead(206, { 'content-type': type, 'content-length': end - start + 1,
        'content-range': \`bytes \${start}-\${end}/\${st.size}\`, 'accept-ranges': 'bytes' });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': st.size, 'accept-ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log(\`http://localhost:\${PORT}/present.html\`));
`;

const README = `الخراف الثلاثة والذئب الماكر
كلية فلسطين التقنية — دير البلح · الوسائط المتعددة والرسوم المتحركة

نسخة كاملة تعمل بدون إنترنت.

  ماك      اضغط مرّتين على   افتح-العرض.command
  ويندوز   اضغط مرّتين على   افتح-العرض.bat

بيفتح المتصفح على العرض لحاله. لو ما فتح، افتح المتصفح على:
  http://localhost:${PORT}/present.html

في الملف:
  present.html        العرض كامل — إعلان ١ و٢، الفيلم، الملصق، الألعاب، الكتاب
  index.html          الألعاب السبع لحالها
  out/book.html       الكتاب — هذا الوحيد اللي بيفتح بالضغط المزدوج بدون تشغيل

التنقّل في العرض:
  ↑ ↓            بين الأقسام
  ← →            صفحات الكتاب، وبطاقات الألعاب
  Esc            القائمة
  ب  أو  F       ملء الشاشة
  ٩ … ١          قفز مباشر لقسم

ملاحظة: أول مرة بتشغّل، بيطلب ماك إذن للاتصال بالشبكة المحلية — وافق.
السيرفر بيشتغل على جهازك فقط ولا بيرسل شي لبرّا.
`;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const e of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, e.name);
    const d = path.join(to, e.name);
    e.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

if (!fs.existsSync(DIST)) {
  console.error('dist/ is not built — run: node tools/site.mjs');
  process.exit(1);
}

fs.rmSync(STAGE, { recursive: true, force: true });
copyDir(DIST, STAGE);
fs.writeFileSync(path.join(STAGE, 'افتح-العرض.command'), MAC);
fs.chmodSync(path.join(STAGE, 'افتح-العرض.command'), 0o755);
fs.writeFileSync(path.join(STAGE, 'افتح-العرض.bat'), WIN);
fs.writeFileSync(path.join(STAGE, 'server.mjs'), SERVER);
fs.writeFileSync(path.join(STAGE, 'اقرأني.txt'), README);

fs.rmSync(ZIP, { force: true });
// -y keeps the launcher executable; macOS metadata is left out so the zip does
// not carry a __MACOSX directory into Windows.
execFileSync('zip', ['-r', '-q', '-y', '-X', ZIP, NAME], { cwd: path.join(ROOT, 'out') });

const mb = (p) => (fs.statSync(p).size / 1048576).toFixed(0);
let files = 0;
(function count(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? count(path.join(d, e.name)) : files++;
})(STAGE);
console.log(`portable  out/${path.basename(ZIP)}  (${files} files, ${mb(ZIP)} MB)`);

if (process.argv.includes('--release')) {
  const tag = 'portable';
  const title = 'النسخة المحمولة — تعمل بدون إنترنت';
  try { execFileSync('gh', ['release', 'delete', tag, '--yes', '--cleanup-tag'], { stdio: 'ignore' }); } catch {}
  execFileSync('gh', ['release', 'create', tag, ZIP, '--title', title, '--notes', README],
    { cwd: ROOT, stdio: 'inherit' });
  const url = execFileSync('gh', ['release', 'view', tag, '--json', 'url', '-q', '.url'], { cwd: ROOT })
    .toString().trim();
  console.log(`release   ${url}`);
}

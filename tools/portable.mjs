// Package the whole project as a folder anyone can run with no internet.
//
//   node tools/portable.mjs            -> out/sheeps-offline.zip
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
// developer tools present. If neither is there it says so and waits, rather
// than flashing a black window and vanishing, which is what a double-clicked
// script that fails normally does.
//
// The two launchers are not symmetrical and cannot be: bash reads UTF-8 and
// bare LF happily, cmd.exe reliably does neither. See the note above WIN.
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
// Looking past PATH is the point of find_py / find_node, not belt-and-braces.
//
// This script waits for someone to install a runtime while it is running, and
// a shell that has already started never sees the PATH an installer just
// edited — python.org writes it into ~/.zprofile, which this process will not
// read until it is restarted, which is exactly what the waiting is meant to
// avoid. So the known install locations are checked directly. Node's macOS
// package lands in /usr/local/bin, already on PATH; Python's does not.
//
// The -c '' probe is there for /usr/bin/python3, which exists on every Mac
// even when Python does not: without the Command Line Tools it is a stub that
// pops a dialog and exits. Running the probe pops that dialog once, which is
// better than the deck failing to start behind it.
const MAC = `#!/bin/bash
# افتح العرض — الخراف الثلاثة والذئب الماكر
cd "$(dirname "$0")" || exit 1
PORT=${PORT}

find_py() {
  hash -r 2>/dev/null
  for c in python3 python /usr/local/bin/python3 /opt/homebrew/bin/python3 \\
           /Library/Frameworks/Python.framework/Versions/*/bin/python3; do
    command -v "$c" >/dev/null 2>&1 || continue
    "$c" -c '' >/dev/null 2>&1 && { echo "$c"; return 0; }
  done
  return 1
}

find_node() {
  hash -r 2>/dev/null
  for c in node /usr/local/bin/node /opt/homebrew/bin/node; do
    command -v "$c" >/dev/null 2>&1 && { echo "$c"; return 0; }
  done
  return 1
}

# Replaces this process when it finds something, so returning at all means
# there is still nothing to run.
serve() {
  if PY=$(find_py); then
    open "http://localhost:$PORT/present.html" 2>/dev/null &
    exec "$PY" server.py $PORT
  fi
  if ND=$(find_node); then
    open "http://localhost:$PORT/present.html" 2>/dev/null &
    exec "$ND" server.mjs $PORT
  fi
  return 1
}

echo "…يجهّز العرض"
serve

echo ""
echo "لازم Python أو Node، وما لقيت ولا واحد فيهم على الجهاز."
echo "رح أفتحلك صفحات التحميل — نزّل أي واحد منهم، وهاي الشاشة بتكمّل لحالها."
echo ""
echo "   Python   https://www.python.org/downloads/macos/"
echo "   Node     https://nodejs.org/en/download"
echo ""
echo "أو سكّر هاي الشاشة وافتح  out/book.html  بالضغط المزدوج — الكتاب يعمل وحده."
echo ""
open "https://www.python.org/downloads/macos/" 2>/dev/null
open "https://nodejs.org/en/download" 2>/dev/null
printf "…بستنّى التثبيت. خلّي هاي الشاشة مفتوحة  (Ctrl-C للإلغاء)"
while true; do
  sleep 3
  printf "."
  serve
done
`;

// Written CRLF and in plain ASCII, and both of those are load-bearing.
//
// cmd.exe reads a batch file line by line by byte offset, and a file with bare
// LF endings leaves it seeking to the wrong place: the first run of this said
// "'PORT' is not recognized" and "cannot find the batch label specified", the
// two classic symptoms. Every line here ends CRLF — see toCrlf below.
//
// And no Arabic. cmd parses the file with whatever codepage is active when it
// opens it, which chcp on line two is already too late to change, so Arabic in
// an echo is unreliable in exactly the way that wastes ten minutes before a
// defence. The Arabic lives in اقرأني.txt, which is read in an editor.
//
// No parenthesised blocks either. `& goto :eof)` glues the closing paren onto
// the label name; plain labels and `exit /b` cannot misparse.
//
// py -3 is listed first because the Windows Python launcher is what an
// installation from python.org actually puts on PATH — python3 usually is not
// a command there at all, and bare `python` may be the Store stub that opens
// the Store instead of running anything.
const WIN = `@echo off
setlocal
cd /d "%~dp0"
set "PORT=${PORT}"
echo Starting the presentation...

call :find
if not errorlevel 1 goto :run

echo.
echo Python or Node is required, and neither was found.
echo Opening both download pages now. Install either one and this window
echo picks it up on its own - no need to run anything again.
echo.
echo    Python   https://www.python.org/downloads/windows/
echo    Node     https://nodejs.org/en/download
echo.
echo On the Python installer, tick "Add python.exe to PATH" on the first screen.
echo.
echo Or close this and open  out\\book.html  directly - the book works alone.
echo.
start "" "https://www.python.org/downloads/windows/"
start "" "https://nodejs.org/en/download"
echo Waiting for the install. Leave this window open.  Ctrl-C cancels.

:wait
timeout /t 3 /nobreak >nul 2>&1 || ping -n 4 127.0.0.1 >nul 2>&1
call :find
if errorlevel 1 goto :wait

:run
start "" "http://localhost:%PORT%/present.html"
%RUNCMD%
goto :done

rem Sets RUNCMD and returns 0, or returns 1 with nothing found.
rem
rem PATH is checked first, then the two default install directories. An
rem installer edits the environment of shells started after it, never this
rem one, so a fresh install can be sitting on disk while where.exe still says
rem no - and this script's whole job at that point is to notice it.
rem
rem py.exe is looked for first because the Windows Python launcher goes into
rem the Windows directory itself, which is always on PATH. It is the one part
rem of a Python install that shows up without a restart.
:find
set "RUNCMD="
where py >nul 2>&1 && set "RUNCMD=py -3 server.py %PORT%"
if defined RUNCMD exit /b 0
where python >nul 2>&1 && set "RUNCMD=python server.py %PORT%"
if defined RUNCMD exit /b 0
where python3 >nul 2>&1 && set "RUNCMD=python3 server.py %PORT%"
if defined RUNCMD exit /b 0
where node >nul 2>&1 && set "RUNCMD=node server.mjs %PORT%"
if defined RUNCMD exit /b 0
if exist "%ProgramFiles%\\nodejs\\node.exe" set RUNCMD="%ProgramFiles%\\nodejs\\node.exe" server.mjs %PORT%
if defined RUNCMD exit /b 0
for /d %%D in ("%LocalAppData%\\Programs\\Python\\Python3*") do if exist "%%~D\\python.exe" set RUNCMD="%%~D\\python.exe" server.py %PORT%
if defined RUNCMD exit /b 0
exit /b 1

:done
endlocal
`;

/** cmd.exe needs CRLF; bash does not care either way. */
const toCrlf = (s) => s.replace(/\r?\n/g, '\r\n');

// The Python server, and the reason it exists rather than `-m http.server`.
//
// That module does not carry a MIME table; it asks the machine, through
// mimetypes, which on Windows means the registry — and in the registry .js is
// very commonly text/plain. A browser will not execute a module served as
// text/plain, so every import in the deck is refused and the page comes up
// blank behind a console full of "blocked because of a disallowed MIME type".
// It is not a rare misconfiguration; it is the default on a lot of machines,
// and it is invisible until the moment it is not. The table below is the whole
// fix — the same one server.mjs already carried, which is why the Node path
// never showed the bug.
//
// Range is the other thing the stock module lacks. Without it the film cannot
// be seeked: the browser asks for a slice and is handed the file from the top.
//
// Python 3.7+ for ThreadingHTTPServer. Anything older serves one request at a
// time, and a page that pulls three hundred files would crawl.
const PYSERVER = `# Static server for the offline bundle.  python server.py [port]
import os, re, sys, http.server

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else ${PORT}
ROOT = os.path.dirname(os.path.abspath(__file__))

TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.webmanifest': 'application/manifest+json',
    '.svg': 'image/svg+xml; charset=utf-8', '.png': 'image/png',
    '.webp': 'image/webp', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8',
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.mp4': 'video/mp4', '.m4s': 'video/iso.segment',
    '.m3u8': 'application/vnd.apple.mpegurl',
}


class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def guess_type(self, path):
        return TYPES.get(os.path.splitext(path)[1].lower(), 'application/octet-stream')

    def send_head(self):
        self._left = None
        path = self.translate_path(self.path)
        if os.path.isdir(path):
            path = os.path.join(path, 'index.html')
        try:
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'File not found')
            return None

        size = os.fstat(f.fileno()).st_size
        ctype = self.guess_type(path)
        m = re.match(r'bytes=(\\d*)-(\\d*)$', self.headers.get('Range') or '')

        if m and (m.group(1) or m.group(2)):
            if m.group(1):
                start = int(m.group(1))
                end = int(m.group(2)) if m.group(2) else size - 1
            else:
                # A suffix range: the last N bytes.
                start, end = max(0, size - int(m.group(2))), size - 1
            end = min(end, size - 1)
            if start > end:
                f.close()
                self.send_response(416)
                self.send_header('Content-Range', 'bytes */%d' % size)
                self.end_headers()
                return None
            f.seek(start)
            self._left = end - start + 1
            self.send_response(206)
            self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
            self.send_header('Content-Length', str(self._left))
        else:
            self.send_response(200)
            self.send_header('Content-Length', str(size))

        self.send_header('Content-Type', ctype)
        self.send_header('Accept-Ranges', 'bytes')
        self.end_headers()
        return f

    def copyfile(self, source, out):
        # A browser abandons media requests constantly — every seek cancels one
        # in flight. That is normal traffic, not a fault, and it should not
        # print a traceback into the window the presenter is looking at.
        try:
            left = self._left
            if left is None:
                return super().copyfile(source, out)
            while left > 0:
                chunk = source.read(min(65536, left))
                if not chunk:
                    break
                out.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


print('http://localhost:%d/present.html' % PORT)
http.server.ThreadingHTTPServer(('127.0.0.1', PORT), H).serve_forever()
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

  ماك      اضغط مرّتين على   START-HERE.command
  ويندوز   اضغط مرّتين على   START-HERE.bat

بيفتح المتصفح على العرض لحاله. لو ما فتح، افتح المتصفح على:
  http://localhost:${PORT}/present.html

العرض بحاجة Python أو Node — أي واحد فيهم، بدون أي إضافات.
الماك عادةً معه Python جاهز. الويندوز غالباً لأ.

لو ما كان ولا واحد منهم على الجهاز، الملف بيفتحلك صفحتين التحميل لحاله
وبيضل مستنّي — نزّل أي واحد فيهم وهو بيكمّل من عنده، بدون ما تشغّله مرة تانية:

  Python   https://www.python.org/downloads/
  Node     https://nodejs.org/en/download

على ويندوز، بمثبّت Python حطّ علامة على "Add python.exe to PATH" بأول شاشة.

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

على ويندوز، الشاشة السودا بتطلع رسائلها بالإنجليزي — هيك مقصود، لأن cmd
بيخربط العربي حسب إعدادات الجهاز. خليها مفتوحة طول العرض؛ لما تسكّرها
بيوقف السيرفر.
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
// The two files a person has to find and double-click are named in ASCII.
// They were Arabic, and on Windows they came out as ╪º┘ü╪¬╪¡-╪º┘ä╪╣╪▒╪╢.bat —
// see the note on the zip below. That is fixed, but these two are the ones
// that must survive an old unzipper on a borrowed laptop ten minutes before a
// defence, so they do not depend on the fix being honoured.
fs.writeFileSync(path.join(STAGE, 'START-HERE.command'), MAC);
fs.chmodSync(path.join(STAGE, 'START-HERE.command'), 0o755);
fs.writeFileSync(path.join(STAGE, 'START-HERE.bat'), toCrlf(WIN));
fs.writeFileSync(path.join(STAGE, 'server.mjs'), SERVER);
fs.writeFileSync(path.join(STAGE, 'server.py'), PYSERVER);
fs.writeFileSync(path.join(STAGE, 'اقرأني.txt'), README);

fs.rmSync(ZIP, { force: true });
// Zipped through Python rather than the `zip` command.
//
// A zip entry can carry its name either as raw bytes or as UTF-8, and which
// one it is lives in bit 11 of the entry's flags. Info-ZIP — which is what
// /usr/bin/zip on macOS is — writes UTF-8 bytes and leaves the bit clear, so
// Windows falls back to the machine's own codepage and every Arabic name in
// the archive turns to mojibake. The build that fixes it takes -UN=UTF8; the
// one shipped with macOS is older than that option.
//
// Python's zipfile sets the bit whenever a name is not pure ASCII, which is
// all that was needed. It also lets the executable bit be written explicitly,
// which is what -y was doing before, and it never invents a __MACOSX folder.
const zipper = `
import os, sys, zipfile
root, out, name = sys.argv[1], sys.argv[2], sys.argv[3]
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for base, dirs, files in os.walk(os.path.join(root, name)):
        dirs.sort(); files.sort()
        for f in files:
            full = os.path.join(base, f)
            arc = os.path.relpath(full, root)
            info = zipfile.ZipInfo.from_file(full, arc)
            info.compress_type = zipfile.ZIP_DEFLATED
            # rwxr-xr-x for the launcher, rw-r--r-- for everything else
            info.external_attr = (0o100755 if f.endswith(('.command', '.sh')) else 0o100644) << 16
            with open(full, 'rb') as fh, z.open(info, 'w') as w:
                while chunk := fh.read(1 << 20):
                    w.write(chunk)
`;
execFileSync('python3', ['-c', zipper, path.join(ROOT, 'out'), ZIP, NAME]);

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

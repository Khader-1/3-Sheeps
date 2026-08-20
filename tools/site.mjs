// Assemble the deployable site into dist/.
//
//   node tools/site.mjs
//
// Cloudflare Pages uploads a directory, so the directory has to be the site
// and nothing else. Two things would otherwise ride along:
//
//   out/            untracked renders — 117 MB of video, music and TTS takes
//   the source art  the .moho projects and script.docx, ~37 MB that no browser
//                   ever requests; they belong in the repo, not on a CDN
//
// The file list comes from `git ls-files` rather than a walk of the working
// tree, so anything untracked is excluded by construction — the same rule the
// repository already enforces, reused instead of restated.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');

/** Tracked, but source material rather than site content. */
const EXCLUDE = [
  // Moho project files, both the scene and character sets. Matched on the
  // extension, not the folder: the folders are «خلفيات موهو» and «شخصيات موهو»,
  // so a rule looking for a path segment of exactly موهو matched neither, and
  // 20 MB of editable project files were going out with every deploy.
  /\.moho$/,
  // The generated sound effects, kept as WAV in the repo because that is what
  // tools/gen-sfx.mjs writes and what it re-reads to normalise. The site takes
  // the MP3s beside them instead — 5 MB of PCM against 300 KB, and PCM is the
  // one thing on the site brotli cannot help with.
  /^assets\/audio\/sfx\/.*\.wav$/,
  /^assets\/script\.docx$/,
  /^assets\/svg\//,      // empty staging directory
  // The poster exports. Only tools/poster-art.mjs reads them, and at ~1.9 MB
  // they would be the largest thing on the site that nothing ever requests.
  /^assets\/incoming\/خلفيات\/ملصق-/,
  // The delivered book pages, 23 MB of them. tools/book-art.mjs compresses
  // them and tools/book.mjs inlines the result into out/book.html, which is
  // the only form the site serves.
  /^assets\/incoming\/كتاب\//,
  // The delivered trailers as exported, 64 MB between them. tools/promos.mjs
  // re-encodes them to out/promo-N.mp4, and those are what the deck plays —
  // these two are each on their own past the 25 MiB Cloudflare Pages allows.
  /^assets\/incoming\/إعلانات\//,
  /^tools\//,            // the pipeline itself is not served
  /^README\.md$/,
  /^\.nojekyll$/,        // a GitHub Pages concern; Cloudflare has no Jekyll
  /^package(-lock)?\.json$/,
];

const tracked = execFileSync('git', ['ls-files', '-z'], { cwd: ROOT })
  .toString('utf8').split('\0').filter(Boolean);

// Finished renders. They live in out/ and are deliberately untracked — tens of
// megabytes, all regenerable — but present.html shows them, so the deck would
// be a row of broken frames without them. Listed by name rather than by
// copying out/ wholesale, which would also ship 32 MB of music experiments and
// every TTS take.
const DELIVERABLES = [
  // The poster section stacks the panorama's two halves with the curtains
  // between them, and the whole thing blurred stands in as the backdrop on
  // the title and closing slides. All from tools/poster-art.mjs.
  'out/poster-wide-bg.svg',
  'out/poster-wide-fg.svg',
  'out/poster-wide.png',
  // Both trailers, delivered finished and re-encoded by tools/promos.mjs to
  // fit under the 25 MiB Cloudflare Pages refuses to exceed. out/promo.mp4 —
  // the teaser this project draws and scores itself — is deliberately absent:
  // the deck shows these two instead, and 14 MB nothing requests is 14 MB.
  // `node tools/render.mjs promo` still makes it.
  'out/promo-1.mp4',
  'out/promo-2.mp4',
  'out/promo-narrated.mp4',
  // The film, as a playlist and its segments. Named as a directory rather
  // than a file — 109 pieces plus the playlist and the init header, and the
  // list would be unreadable spelled out.
  'out/film/',
  'out/book.html',
  // The cast cluster that stands over the deck's title. Both forms: the PNG is
  // what the markup carries and what a print gets, and the SVG is what
  // liveCrest() fetches to replace it with — the same picture, but with every
  // character reachable as nodes, which is what the title's flinch and the
  // cold open's eyes are both built on. Shipping only the PNG left the crest
  // looking right and quietly killed both of those.
  'out/heads/trio.png',
  'out/heads/trio.svg',
];

const files = tracked.filter((f) => !EXCLUDE.some((re) => re.test(f)));

const gone = DELIVERABLES.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (gone.length) {
  console.warn('  the deck references renders that are missing:\n    ' + gone.join('\n    '));
}
// A deliverable ending in / is a whole directory: everything under it ships.
const expand = (f) => {
  const abs = path.join(ROOT, f);
  if (!f.endsWith('/')) return fs.existsSync(abs) ? [f] : [];
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs).map((n) => f + n).filter((r) => fs.statSync(path.join(ROOT, r)).isFile());
};
files.push(...DELIVERABLES.flatMap(expand));

fs.rmSync(DIST, { recursive: true, force: true });
let bytes = 0;
for (const f of files) {
  const src = path.join(ROOT, f);
  const dst = path.join(DIST, f);
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
  bytes += fs.statSync(src).size;
}

// The service worker promises to cache a fixed list; if the build dropped one
// of those files the install fails on the first 404 and the app silently never
// goes offline. Cheaper to catch here than to debug on a phone.
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const listed = [...sw.matchAll(/^ "([^"]+)"/gm)].map((m) => decodeURIComponent(m[1]));
const absent = listed.filter((u) => !fs.existsSync(path.join(DIST, u)));
if (absent.length) {
  console.error('precached but not in dist:\n  ' + absent.join('\n  '));
  process.exit(1);
}

console.log(`site  ${files.length} files, ${(bytes / 1048576).toFixed(1)} MB -> dist/`);
console.log(`      ${listed.length} precached files all present`);

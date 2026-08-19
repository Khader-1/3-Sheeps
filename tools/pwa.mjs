// Turn the mini games into an installable Progressive Web App.
//
//   node tools/pwa.mjs
//
// Writes:
//   web/manifest.webmanifest   name, icons, landscape, standalone
//   (icons come from tools/icons.mjs — run that first)
//   sw.js                      service worker at the ROOT, so its scope covers
//                              /web, /src and /assets — a worker under /web
//                              could not cache the modules or the art
//
// The precache list is built from what the games actually load, not from the
// whole repo: six of the twenty-eight sets, four characters, the effects, the
// fonts and the voice clips the two listening games use. Precaching all the
// artwork would mean a 20 MB install for scenes the games never open.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENE_DIR = 'assets/incoming/خلفيات/خلفيات svg';
const CHAR_DIR = 'assets/incoming/خلفيات/شخصيات svg';
const VOICE_DIR = 'assets/audio/صوتيات';

/** Scenes the seven games and the menu open. */
const SCENES = ['مشهد8', 'مشهد17و18', 'طويله بيت', 'مشهد25جزء2', 'خلفيه 1'];
// طويله replaced مشهد12 behind the chase; the book still uses مشهد12, but the
// book is not part of the installed app.
const CHARS = ['ذيب', 'الخروف الاكبر', 'الخروف الاوسط', 'الخروف الاصغر', 'بيت-مجزأ'];

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

const urls = [
  'index.html',
  'manifest.webmanifest',
  // The old address, kept as a redirect stub for shortcuts made before the
  // games moved to the root.
  'web/game.html',
  ...walk('src').filter((f) => f.endsWith('.js')),
  ...walk('assets/fonts'),
  // The MP3s, not the WAVs beside them — src/game/ui.js loads those, and a
  // precache list that names a file the app never asks for is 3.7 MB of dead
  // weight in every installed copy.
  ...walk('assets/audio/sfx').filter((f) => f.endsWith('.mp3')),
  ...SCENES.map((s) => `${SCENE_DIR}/${s}.svg`),
  ...CHARS.map((c) => `${CHAR_DIR}/${c}.svg`),
];

// The voice clips the listening games name, pulled from the catalogue itself
// so the two lists cannot drift apart.
const voices = fs.readFileSync(path.join(ROOT, 'src/game/voices.js'), 'utf8');
for (const m of voices.matchAll(/file:\s*'([^']+)'/g)) urls.push(`${VOICE_DIR}/${m[1]}`);

// ---- icons ----------------------------------------------------------------
// Generated separately by tools/icons.mjs, which cuts them from the middle
// brother's head. They are artwork, not packaging: regenerating them needs the
// rigs and a browser, and they change far less often than the precache list.
const ICON_DIR = path.join(ROOT, 'web/icons');
const ICONS = ['icon-192.png', 'icon-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'icon.svg'];
const missingIcons = ICONS.filter((n) => !fs.existsSync(path.join(ICON_DIR, n)));
if (missingIcons.length) {
  console.error(`missing icons: ${missingIcons.join(', ')}\n  run: node tools/icons.mjs`);
  process.exit(1);
}
for (const n of ICONS) urls.push(`web/icons/${n}`);

// ---- manifest --------------------------------------------------------------
fs.writeFileSync(path.join(ROOT, 'manifest.webmanifest'), JSON.stringify({
  name: 'ألعاب الخراف الثلاثة والذئب الماكر',
  short_name: 'الخراف الثلاثة',
  description: 'سبع ألعاب قصيرة من فيلم الخراف الثلاثة والذئب الماكر',
  lang: 'ar',
  dir: 'rtl',
  // Relative, and resolved by the browser against the manifest's own URL, so
  // the app installs correctly whether the site is served at / (local, LAN)
  // or under /<repo>/ (GitHub Pages project site).
  start_url: './',
  scope: './',
  display: 'standalone',
  // The installed app is locked to landscape. The games do lay out correctly
  // in portrait — that work stands, and the browser tab still uses it — but
  // these are wide scenes and they are meant to be played turned sideways.
  orientation: 'landscape',
  background_color: '#1d2b12',
  theme_color: '#1d2b12',
  icons: [
    { src: 'web/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'web/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'web/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2));

// Everything must exist before the worker promises to cache it — addAll fails
// the whole install on a single 404, and the two files this script generates
// itself have to be written first, which is why the check lives down here.
const missing = urls.filter((u) => !fs.existsSync(path.join(ROOT, u)));
if (missing.length) {
  console.error('missing from precache list:\n  ' + missing.join('\n  '));
  process.exit(1);
}
const bytes = urls.reduce((a, u) => a + fs.statSync(path.join(ROOT, u)).size, 0);

// ---- service worker ---------------------------------------------------------
const version = `v${Date.now().toString(36)}`;
fs.writeFileSync(path.join(ROOT, 'sw.js'), `// Generated by tools/pwa.mjs — do not edit by hand.
//
// Cache-first for everything precached: the games are static and the whole
// point is that they keep working with no network. A new build changes CACHE,
// which drops the old one wholesale rather than trying to reconcile it.
//
// The list is stored relative to this file and resolved against it, not
// against the server root: on GitHub Pages the site is published under
// /<repo>/, and a leading slash would send every request to the wrong origin
// path. sw.js sits at the site root, so its own URL is the correct base.
const CACHE = '${version}';
const HERE = (p) => new URL(p, self.location).toString();
const ASSETS = ${JSON.stringify(urls.map((u) => u.split('/').map(encodeURIComponent).join('/')), null, 1)}.map(HERE);

self.addEventListener('install', (e) => {
  // Fetched one at a time rather than with addAll, for one reason: a host may
  // answer with a redirect. Cloudflare Pages rewrites /web/game.html to the
  // extensionless /web/game, so the cached entry comes back flagged
  // \`redirected\`, and Chrome refuses to satisfy a *navigation* from such a
  // response — the menu loads once over the network and every load after it,
  // with the worker in control, fails with ERR_FAILED. Rebuilding the response
  // drops the flag.
  //
  // A single failure still rejects the whole install, which is the behaviour
  // we want: a half-cached game that breaks offline is worse than one that
  // never claimed to be installed.
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(ASSETS.map(async (u) => {
      const res = await fetch(u, { cache: 'reload' });
      if (!res.ok) throw new Error(\`\${res.status} caching \${u}\`);
      await cache.put(u, res.redirected ? new Response(res.body, res) : res);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith((async () => {
    const hit = await caches.match(e.request);
    if (hit) return hit;
    try {
      return await fetch(e.request);
    } catch {
      // Offline and not cached: for a navigation, fall back to the menu.
      // respondWith() must be handed a Response — resolving it with the
      // undefined of a cache miss fails the navigation outright, so the miss
      // has to become an explicit error response.
      if (e.request.mode === 'navigate') {
        const menu = await caches.match(HERE('index.html'));
        if (menu) return menu;
      }
      return Response.error();
    }
  })());
});
`);

console.log(`pwa   ${urls.length} files precached, ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`      manifest  manifest.webmanifest`);
console.log(`      worker    sw.js  (${version})`);
console.log(`      icons     ${ICONS.length} from tools/icons.mjs`);

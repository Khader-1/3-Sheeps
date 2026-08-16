// Turn the mini games into an installable Progressive Web App.
//
//   node tools/pwa.mjs
//
// Writes:
//   web/manifest.webmanifest   name, icons, landscape, standalone
//   web/icons/*.png            generated from the film's own artwork
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
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCENE_DIR = 'assets/incoming/خلفيات/خلفيات svg';
const CHAR_DIR = 'assets/incoming/خلفيات/شخصيات svg';
const VOICE_DIR = 'assets/audio/صوتيات';

/** Scenes the seven games and the menu open. */
const SCENES = ['مشهد8', 'مشهد17و18', 'مشهد12', 'مشهد14', 'مشهد25جزء2', 'خلفيه 1'];
const CHARS = ['ذيب', 'الخروف الاكبر', 'الخروف الاوسط', 'الخروف الاصغر'];

const walk = (dir, out = []) => {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
};

const urls = [
  'web/game.html',
  'web/manifest.webmanifest',
  ...walk('src').filter((f) => f.endsWith('.js')),
  ...walk('assets/fonts'),
  ...walk('assets/audio/sfx').filter((f) => f.endsWith('.wav')),
  ...SCENES.map((s) => `${SCENE_DIR}/${s}.svg`),
  ...CHARS.map((c) => `${CHAR_DIR}/${c}.svg`),
];

// The voice clips the listening games name, pulled from the catalogue itself
// so the two lists cannot drift apart.
const voices = fs.readFileSync(path.join(ROOT, 'src/game/voices.js'), 'utf8');
for (const m of voices.matchAll(/file:\s*'([^']+)'/g)) urls.push(`${VOICE_DIR}/${m[1]}`);

// ---- icons ----------------------------------------------------------------
const ICON_DIR = path.join(ROOT, 'web/icons');
fs.mkdirSync(ICON_DIR, { recursive: true });

/** The app icon: the wolf's silhouette over the games' own green. */
const iconSvg = (size, pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="${pad ? 0 : 18}" fill="#1d2b12"/>
  <circle cx="50" cy="50" r="${pad ? 30 : 34}" fill="#3f7f2e"/>
  <g transform="translate(50 ${pad ? 52 : 53}) scale(${pad ? 0.5 : 0.58})">
    <path d="M-30-18 L-22-40 L-8-26 L8-26 L22-40 L30-18 C34 6 20 30 0 30 C-20 30 -34 6 -30-18 Z"
          fill="#6f6f76" stroke="#15151a" stroke-width="4" stroke-linejoin="round"/>
    <ellipse cx="-13" cy="-6" rx="6.5" ry="8" fill="#fff" stroke="#15151a" stroke-width="3"/>
    <ellipse cx="13" cy="-6" rx="6.5" ry="8" fill="#fff" stroke="#15151a" stroke-width="3"/>
    <circle cx="-12" cy="-4" r="3.4" fill="#15151a"/>
    <circle cx="14" cy="-4" r="3.4" fill="#15151a"/>
    <path d="M-9 10 L9 10 L0 20 Z" fill="#15151a"/>
    <path d="M-16 22 L-10 14 L-4 22 L2 14 L8 22 L14 14 L18 22" fill="none"
          stroke="#fffdf5" stroke-width="4" stroke-linejoin="round"/>
  </g>
</svg>`;

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
for (const [name, size, pad] of [['icon-192', 192, false], ['icon-512', 512, false], ['maskable-512', 512, true]]) {
  const svgFile = path.join(ICON_DIR, `${name}.svg`);
  fs.writeFileSync(svgFile, iconSvg(size, pad));
  const r = spawnSync(CHROME, ['--headless', '--disable-gpu', `--screenshot=${path.join(ICON_DIR, name + '.png')}`,
    `--window-size=${size},${size}`, '--default-background-color=00000000', 'file://' + svgFile], { stdio: 'ignore' });
  if (r.status !== 0) console.warn(`  icon ${name}: render failed`);
}
for (const n of ['icon-192', 'icon-512', 'maskable-512']) urls.push(`web/icons/${n}.png`);

// ---- manifest --------------------------------------------------------------
fs.writeFileSync(path.join(ROOT, 'web/manifest.webmanifest'), JSON.stringify({
  name: 'ألعاب الخراف الثلاثة والذئب الماكر',
  short_name: 'الخراف الثلاثة',
  description: 'سبع ألعاب قصيرة من فيلم الخراف الثلاثة والذئب الماكر',
  lang: 'ar',
  dir: 'rtl',
  // Relative, and resolved by the browser against the manifest's own URL, so
  // the app installs correctly whether the site is served at / (local, LAN)
  // or under /<repo>/ (GitHub Pages project site).
  start_url: 'game.html',
  scope: '../',
  display: 'standalone',
  orientation: 'landscape',
  background_color: '#1d2b12',
  theme_color: '#1d2b12',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
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
        const menu = await caches.match(HERE('web/game.html'));
        if (menu) return menu;
      }
      return Response.error();
    }
  })());
});
`);

console.log(`pwa   ${urls.length} files precached, ${(bytes / 1048576).toFixed(1)} MB`);
console.log(`      manifest  web/manifest.webmanifest`);
console.log(`      worker    sw.js  (${version})`);
console.log(`      icons     web/icons/{icon-192,icon-512,maskable-512}.png`);

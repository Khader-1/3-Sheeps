// A logo and a title lockup, built from the cast's own heads.
//
//   node tools/heads-art.mjs                -> out/heads/*.svg + .png + sheets
//   node tools/heads-art.mjs --only=roundel -> just one
//
// Two families:
//   marks    square, no words — for a favicon, a corner, an app tile
//   lockups  the characters standing over the title, for a cover or a card
//
// The heads are cut from the rigs exactly as the app icons are: mount the
// character, isolate its head group, drop anything not touching the skull.
// Nothing is redrawn, so the mark stays in the film's own hand.
//
// A mark has one test a decorative piece does not — it has to survive being
// small. Every mark is rendered at 512 and again at 96, 48 and 32, and the
// small strip is the one to judge by: a mark that turns to mush at 32px is not
// a logo however well it reads at full size.
//
// Three sheep read as three only because of wool and horns. The face artwork
// is identical across all of them; the eldest alone has horns and the youngest
// alone is white, so every arrangement leans on those two facts.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { serve } from './serve.mjs';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'out/heads');

const INK = '#2a1608';
const CREAM = '#FFF3C4';
const DEEP = '#16220f';
const GREEN = '#3f7f2e';
const GOLD = '#ffd23f';

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1] || null;

const { server, port } = await serve(0);
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--font-render-hinting=none'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 900, height: 700 });
  await page.goto(`http://127.0.0.1:${port}/web/blank.html`, { waitUntil: 'domcontentloaded' });

  const heads = await page.evaluate(async () => {
    const { loadCharacter, applyExpression } = await import('/src/expressions.js');
    const { bboxIn } = await import('/src/rig.js');
    const host = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    host.setAttribute('viewBox', '0 0 1280 720');
    document.body.appendChild(host);

    const touches = (a, b) => !(a.x + a.width < b.x || b.x + b.width < a.x ||
                                a.y + a.height < b.y || b.y + b.height < a.y);
    const out = {};
    // Front and side for everyone. The side views are whole different drawings
    // — a profile, not a rotated face — so they compose differently: two
    // profiles can look at each other, which is the entire story in one shape.
    const { openJaw } = await import('/src/book/effects.js');
    const cast = [];
    for (const [key, mood] of [['big', 'happy'], ['mid', 'happy'],
                               ['small', 'happy'], ['wolf', 'menacing']]) {
      cast.push([key, 'front', mood, key, 0]);
      cast.push([key, 'side', mood, key + 'Side', 0]);
    }
    // A second wolf with his jaws open. openJaw builds the maw, tongue and
    // canines onto the rig, so the head has to be taken after it runs.
    cast.push(['wolf', 'front', 'menacing', 'wolfOpen', 30]);
    cast.push(['wolf', 'side', 'menacing', 'wolfSideOpen', 26]);
    for (const [key, view, mood, name, jaw] of cast) {
      let rig;
      try { rig = await loadCharacter(key, view); } catch { continue; }
      const holder = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      host.appendChild(holder);
      holder.appendChild(rig.node);
      rig.ready();                 // mount before posing, or pivots measure as zero
      // The side rigs carry a different face map; not every preset applies.
      try { applyExpression(rig, mood); } catch { /* leave it as drawn */ }
      if (jaw) { try { openJaw(rig, { angle: jaw }); } catch { /* no mouth here */ } }

      const headPath = rig.face.head || 'الراس';
      if (!rig.has(headPath)) continue;
      const group = rig.part(headPath);
      const skullPath = `${headPath}/الراس`;
      const skull = rig.has(skullPath) ? bboxIn(rig.part(skullPath), rig.node) : bboxIn(group, rig.node);
      for (const c of [...group.children]) {
        if (!touches(bboxIn(c, rig.node), skull)) c.remove();
      }
      const b = bboxIn(group, rig.node);
      out[name] = {
        markup: new XMLSerializer().serializeToString(group),
        x: +b.x.toFixed(2), y: +b.y.toFixed(2), w: +b.width.toFixed(2), h: +b.height.toFixed(2),
      };
    }
    return out;
  });

  for (const [k, v] of Object.entries(heads)) {
    console.log(`head  ${k.padEnd(6)} ${v.w.toFixed(0)} x ${v.h.toFixed(0)}`);
  }

  /**
   * One head, sized by its longer axis and centred on cx,cy. Sizing by the
   * longer side keeps a horned head and a hornless one at the same visual
   * weight, instead of the horns quietly making one bigger than the others.
   */
  const put = (key, cx, cy, size, { rotate = 0, opacity = 1, flip = false } = {}) => {
    const h = heads[key];
    if (!h) return `<!-- no head "${key}" -->`;
    const s = size / Math.max(h.w, h.h);
    const tx = cx - (h.x + h.w / 2) * s;
    const ty = cy - (h.y + h.h / 2) * s;
    // Flip about the placed centre, so a profile turns to face the other way
    // without wandering off its mark.
    const mirror = flip ? `translate(${(cx * 2).toFixed(2)} 0) scale(-1 1) ` : '';
    return `<g opacity="${opacity}" transform="${mirror}rotate(${rotate} ${cx} ${cy}) translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})">${h.markup}</g>`;
  };

  /** Title set the way the poster sets it: cream inside a heavy dark outline. */
  const titled = (txt, x, y, size, fill = CREAM) => `
    <text x="${x}" y="${y}" text-anchor="middle" font-family="Poster Display, sans-serif"
          font-weight="800" font-size="${size}" direction="rtl"
          fill="${fill}" stroke="${INK}" stroke-width="${(size * 0.17).toFixed(1)}"
          stroke-linejoin="round" paint-order="stroke">${txt}</text>`;

  // ------------------------------------------------------------------ marks
  const marks = {};

  // Three heads in a row on a disc — the most conventional shape for a mark,
  // and the one that holds together smallest.
  marks.roundel = { w: 512, h: 512, body: `
    <circle cx="256" cy="256" r="248" fill="${DEEP}"/>
    <circle cx="256" cy="256" r="248" fill="none" stroke="${INK}" stroke-width="16"/>
    <circle cx="256" cy="256" r="212" fill="${GREEN}"/>
    ${put('mid', 150, 296, 178)}
    ${put('small', 362, 296, 178)}
    ${put('big', 256, 212, 236)}` };

  // No container: the cluster itself is the silhouette, so it drops onto any
  // background without bringing a disc with it.
  //
  // The wolf at the very top, showing his ears and eyes and nothing below
  // them; the eldest at the bottom and in front, with his brothers tucked
  // behind his shoulders. Order is deliberate — the wolf is drawn first so
  // everyone covers him, and the eldest last so he covers everyone. The wolf
  // sits high enough that his eyes clear the eldest's wool: any lower and he
  // reads as a hat rather than a threat.
  marks.trio = { w: 512, h: 512, transparent: true, body: `
    ${put('wolf', 256, 108, 212)}
    ${put('mid', 150, 250, 200)}
    ${put('small', 362, 250, 200)}
    ${put('big', 256, 352, 284)}` };

  // The brothers on their own, kept for anywhere the wolf would be too much.
  marks.trioPlain = { w: 512, h: 512, transparent: true, body: `
    ${put('mid', 148, 332, 216)}
    ${put('small', 364, 332, 216)}
    ${put('big', 256, 194, 292)}` };

  // The eldest alone. By far the simplest silhouette here, which is usually
  // what wins at thirty-two pixels.
  marks.single = { w: 512, h: 512, body: `
    <circle cx="256" cy="256" r="248" fill="${GREEN}"/>
    <circle cx="256" cy="256" r="248" fill="none" stroke="${INK}" stroke-width="16"/>
    ${put('big', 256, 264, 360)}` };

  // The three of them and the thing they are hiding from — the whole story
  // rather than half of it.
  marks.withWolf = { w: 512, h: 512, body: `
    <circle cx="256" cy="256" r="248" fill="${DEEP}"/>
    <circle cx="256" cy="256" r="248" fill="none" stroke="${INK}" stroke-width="16"/>
    ${put('wolf', 256, 186, 316, { opacity: 0.5 })}
    ${put('mid', 136, 348, 162)}
    ${put('small', 376, 348, 162)}
    ${put('big', 256, 332, 202)}` };

  // The confrontation, in profile: the eldest and the wolf nose to nose. Only
  // the side drawings can do this — a front-on face cannot look at anything.
  marks.faceOff = { w: 512, h: 512, body: `
    <circle cx="256" cy="256" r="248" fill="${DEEP}"/>
    <circle cx="256" cy="256" r="248" fill="none" stroke="${INK}" stroke-width="16"/>
    <path d="M 256 24 A 232 232 0 0 1 256 488 Z" fill="${GREEN}" opacity=".55"/>
    ${put('bigSide', 178, 262, 230)}
    ${put('wolfSide', 338, 258, 250, { flip: true })}` };

  // The three of them in profile, walking the same way — a herd rather than a
  // portrait.
  marks.herd = { w: 512, h: 512, body: `
    <circle cx="256" cy="256" r="248" fill="${GREEN}"/>
    <circle cx="256" cy="256" r="248" fill="none" stroke="${INK}" stroke-width="16"/>
    ${put('smallSide', 176, 300, 190, { opacity: .95 })}
    ${put('midSide', 250, 272, 205)}
    ${put('bigSide', 330, 244, 220)}` };

  // ---------------------------------------------------------------- lockups
  // The cast standing over the title, which is what a cover wants.
  const lockups = {};

  lockups.lockup = { w: 1000, h: 900, transparent: true, body: `
    ${put('mid', 356, 300, 240)}
    ${put('small', 644, 300, 240)}
    ${put('big', 500, 168, 320)}
    ${titled('الخراف الثلاثة', 500, 610, 108)}
    ${titled('والذئب الماكر', 500, 740, 108)}` };

  // The wolf above the brothers rather than among them, at full strength — a
  // half-transparent wolf read as a ghost instead of as the one in the title.
  const wolfLockup = (wolfKey) => `
    ${put(wolfKey, 500, 155, 292)}
    ${put('mid', 300, 352, 228)}
    ${put('small', 700, 352, 228)}
    ${put('big', 500, 372, 262)}
    ${titled('الخراف الثلاثة', 500, 640, 104)}
    ${titled('والذئب الماكر', 500, 764, 104)}`;

  lockups.lockupWolf = { w: 1000, h: 900, transparent: true, body: wolfLockup('wolf') };
  lockups.lockupWolfOpen = { w: 1000, h: 900, transparent: true, body: wolfLockup('wolfOpen') };

  // The profile confrontation over the title.
  lockups.lockupProfile = { w: 1000, h: 900, transparent: true, body: `
    ${put('bigSide', 350, 250, 300)}
    ${put('wolfSide', 660, 244, 330, { flip: true })}
    ${titled('الخراف الثلاثة', 500, 640, 104)}
    ${titled('والذئب الماكر', 500, 764, 104)}` };

  // A badge version: heads over the title, contained, for a card or a slide.
  lockups.badge = { w: 1000, h: 900, body: `
    <rect width="1000" height="900" rx="56" fill="${DEEP}"/>
    <rect x="22" y="22" width="956" height="856" rx="40" fill="none" stroke="${GOLD}" stroke-width="6" opacity=".7"/>
    <circle cx="500" cy="300" r="252" fill="${GREEN}"/>
    ${put('mid', 360, 336, 208)}
    ${put('small', 640, 336, 208)}
    ${put('big', 500, 232, 276)}
    ${titled('الخراف الثلاثة', 500, 668, 100)}
    ${titled('والذئب الماكر', 500, 790, 100)}` };

  // ------------------------------------------------------------------ write
  const all = { ...marks, ...lockups };
  fs.mkdirSync(OUT, { recursive: true });
  const fontCss = fs.readFileSync(path.join(ROOT, 'assets/fonts/embed.css'), 'utf8');
  const doc = (p) => `<svg xmlns="http://www.w3.org/2000/svg" width="${p.w}" height="${p.h}"
       viewBox="0 0 ${p.w} ${p.h}"><style>${fontCss}</style>${p.body}</svg>`;

  const names = only ? [only] : Object.keys(all);
  for (const name of names) {
    const p = all[name];
    if (!p) { console.error(`no piece called "${name}"`); process.exit(1); }
    const file = path.join(OUT, `${name}.svg`);
    fs.writeFileSync(file, doc(p));
    const shot = await browser.newPage();
    await shot.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 2 });
    await shot.goto('file://' + file, { waitUntil: 'networkidle0' });
    await shot.screenshot({ path: path.join(OUT, `${name}.png`), omitBackground: !!p.transparent });
    await shot.close();
    console.log(`piece ${name.padEnd(11)} ${p.w}x${p.h}${p.transparent ? '  transparent' : ''}`);
  }

  if (!only) {
    const cell = (n, extra = '') => `<figure><div class="sw">
        <img src="${n}.png"></div><figcaption>${n}${extra}</figcaption></figure>`;
    // Marks get a legibility strip; that is the whole point of the exercise.
    const small = (n) => `<figure><div class="sw sm">
        ${[96, 48, 32].map((s) => `<img src="${n}.png" style="width:${s}px;height:${s}px">`).join('')}
      </div><figcaption>${n} — 96 · 48 · 32</figcaption></figure>`;

    const sheet = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#e9e7df;font:600 20px system-ui;padding:26px}
      h3{margin:8px 0 14px;font-size:22px;color:#333}
      .row{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:30px}
      .row.two{grid-template-columns:repeat(3,1fr)}
      figure{margin:0}
      .sw{background:
        linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%) 0 0/22px 22px,
        linear-gradient(45deg,#ccc 25%,#fff 25%,#fff 75%,#ccc 75%) 11px 11px/22px 22px;
        border-radius:12px;padding:10px;display:grid;place-items:center;min-height:120px}
      .sw.sm{display:flex;gap:18px;align-items:center;justify-content:center}
      img{max-width:100%;display:block;border-radius:8px}
      figcaption{padding-top:8px;text-align:center;font-size:16px;color:#444}
      </style>
      <h3>MARKS — full size</h3><div class="row">${Object.keys(marks).map((n) => cell(n)).join('')}</div>
      <h3>MARKS — legibility (the test that matters)</h3>
      <div class="row">${Object.keys(marks).map(small).join('')}</div>
      <h3>LOCKUPS — characters above the title</h3>
      <div class="row two">${Object.keys(lockups).map((n) => cell(n)).join('')}</div>`;
    fs.writeFileSync(path.join(OUT, 'sheet.html'), sheet);
    const s = await browser.newPage();
    await s.setViewport({ width: 1560, height: 1400 });
    await s.goto('file://' + path.join(OUT, 'sheet.html'), { waitUntil: 'networkidle0' });
    await s.screenshot({ path: path.join(ROOT, 'out/heads-sheet.png'), fullPage: true });
    console.log('sheet out/heads-sheet.png');
  }
} finally {
  await browser.close();
  server.close();
}

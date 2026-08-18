// Retypeset the Illustrator poster exports.
//
//   node tools/poster-art.mjs
//
// The two new posters — ملصق-ضيق (1317.9 wide) and ملصق-عريض (1935 wide) — are
// Illustrator re-exports of out/poster.svg with the scene repainted and, in the
// wide case, extended. The round trip destroyed the Arabic: every line came
// back written backwards in isolated letterforms with the lam-alef ligatures
// dropped («الخراف الثلاثة» → «ةثلثلا فارخلا»), and the fonts fell back to
// Arial. The rest of the export is fine, so the fix is local — throw away the
// eight <text> nodes and set the four lines again in the real faces.
//
// Everything the new type needs is already in the file:
//
//   the centre      the midpoint of the <line> rule between title and subtitle
//   the baselines   the translate() y of each ruined text node
//   the sizes       the font-size Illustrator preserved from the original
//
// so the layout is read back out of the artwork rather than restated here.
// That matters because the two posters are not the same layout: the wide type
// block is the narrow one at 0.82 scale shifted down, which reading the numbers
// per file gets for free.
//
// Stroke widths are the exception — Illustrator wrote 17.99 on both, because
// scaling artwork in Illustrator does not scale stroke. They are recomputed
// from the size, at the ratios the original poster used.
//
// Three files come out:
//
//   poster-narrow   the A3 poster as exported, page clip and margins intact
//   poster-page     that page alone, cropped to the clip — the print deliverable
//   poster-wide     the panorama, reframed and re-placed (see below)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const COPY = {
  titleLine1: 'الخراف الثلاثة',
  titleLine2: 'والذئب الماكر',
  subtitle: 'فيلم رسوم متحركة ثنائي الأبعاد',
  tagline: 'حين يطرق الذئب الباب، لا ينجو إلا البيت المتين',
};

// Two repairs the wide export needs beyond the type, both of them consequences
// of the canvas having been widened around artwork that was not.
//
//   the frame   the field is one rectangle, M1921.17,567.78 H31 V1033.51 H…Z,
//               and the house style strokes everything in black. On the A3 page
//               its edges fell outside the crop; on the wide canvas all four
//               show, with sky visible below the grass. Cropping the frame to
//               the field takes the three stray edges out and leaves the top
//               one where it belongs, on the horizon. Nothing is repainted.
//
// The logo band and the cast are misplaced too, but not by the canvas — see
// the placement step, which maps them from the A3 export rather than guessing.
//
// All of it is reversible: drop the flag and the export comes through
// untouched.

const JOBS = [
  {
    src: 'assets/incoming/خلفيات/ملصق-ضيق.svg',
    out: 'out/poster-narrow.svg',
    // The export keeps the A3 page as a clipPath. Cropping the frame to it
    // gives the poster on its own, which is what goes to print and into the
    // deck's final beat.
    page: 'out/poster-page.svg',
  },
  {
    src: 'assets/incoming/خلفيات/ملصق-عريض.svg',
    out: 'out/poster-wide.svg',
    reframe: true,
    // Both of these came out of Illustrator misplaced; see the placement step.
    place: [
      { id: 'الشعارات', fit: 'stretch' },
      { id: 'الشخصيات', fit: 'characters',
        by: ['الذئب', 'الخروف-الأكبر', 'الخروف-الأوسط', 'الخروف-الأصغر'] },
    ],
    // Scenery. شمس-وغيوم is a sibling of السماء rather than a child of it, so
    // naming only the one leaves the sun and the clouds in the foreground —
    // where they come through sharp and lit while the sky behind them goes.
    // What is left over is the cast with its shadows, the type and the logos.
    split: ['السماء', 'شمس-وغيوم'],
  },
];

// Only the faces these four lines use, not all six in embed.css — the
// stylesheet is base64 payload, and three unused faces on two posters is
// 140 KB of nothing.
const USED = [
  ["'Poster Display'", '800'],
  ["'Poster Text'", '600'],
  ["'Poster Text'", '400'],
];

const allCss = fs.readFileSync(path.join(ROOT, 'assets/fonts/embed.css'), 'utf8');
const fontCss = [...allCss.matchAll(/@font-face\{[^}]*\}/g)]
  .map((m) => m[0])
  .filter((f) => USED.some(([fam, w]) =>
    f.includes(`font-family:${fam}`) && f.includes(`font-weight:${w}`)))
  .join('\n');
if (fontCss.split('@font-face').length - 1 !== USED.length) {
  console.error('embed.css no longer holds the three faces the poster sets');
  process.exit(1);
}

// The original A3 poster, as the reference the ratios are taken from: an 842pt
// page, a 392pt rule, a 104px title outlined at 18.
const REF = { rule: 391.85, title: 104, sub: 31, tag: 25, titleStroke: 18, bodyStroke: 6 };

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--allow-file-access-from-files', '--font-render-hinting=none'],
});

/** Render an SVG file to a PNG beside it, wide enough to read the type.
 *
 * Through an <img> in a wrapper page rather than by opening the SVG directly:
 * a file that declares width="297mm" renders at that size and the screenshot
 * comes back cropped to the window instead of scaled to it. */
async function preview(file, viewBox, width = 1400) {
  const [, , vw, vh] = viewBox.split(/[\s,]+/).map(Number);
  const height = Math.round((vh / vw) * width);
  const wrap = file.replace(/\.svg$/, '.preview.html');
  fs.writeFileSync(wrap,
    `<body style="margin:0"><img src="${path.basename(file)}" style="width:100%;height:100%;display:block">`);
  const shot = await browser.newPage();
  await shot.setViewport({ width, height });
  await shot.goto('file://' + wrap, { waitUntil: 'networkidle0' });
  await shot.screenshot({ path: file.replace(/\.svg$/, '.png') });
  await shot.close();
  fs.rmSync(wrap);
}

/** Measure out/poster.svg — the canonical A3 poster, whose viewBox is the page
 *  itself, so every box read from it is already in page units. It is the
 *  reference for how big the cast stands against the page, and for where the
 *  logo band sits. */
async function measureA3() {
  const file = path.join(ROOT, 'out/poster.svg');
  if (!fs.existsSync(file)) {
    console.warn('  out/poster.svg is missing — the cast and logos stay as exported');
    return null;
  }
  const p = await browser.newPage();
  await p.goto('file://' + file, { waitUntil: 'load' });
  const r = await p.evaluate((ids) => {
    const svg = document.documentElement;
    const boxIn = (el) => {
      const b = el.getBBox();
      const m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
      const xs = [], ys = [];
      for (const [x, y] of [[b.x, b.y], [b.x + b.width, b.y],
                            [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
        const pt = svg.createSVGPoint(); pt.x = x; pt.y = y;
        const q = pt.matrixTransform(m); xs.push(q.x); ys.push(q.y);
      }
      return { x: Math.min(...xs), y: Math.min(...ys),
               w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
    };
    const [, , w, h] = svg.getAttribute('viewBox').split(/[\s,]+/).map(Number);
    const boxes = {};
    for (const g of svg.querySelectorAll('g')) {
      if (ids.includes(g.id) && !boxes[g.id]) boxes[g.id] = boxIn(g);
    }
    return { page: { w, h }, boxes };
  }, ['الشخصيات', 'الشعارات', 'الذئب', 'الخروف-الأكبر', 'الخروف-الأوسط', 'الخروف-الأصغر']);
  await p.close();
  return r;
}

try {
  const a3 = await measureA3();
  if (a3) {
    console.log(`reference  out/poster.svg  page ${a3.page.w}×${a3.page.h}, ` +
                `${Object.keys(a3.boxes).length} groups measured\n`);
  }
  // The narrow export is measured next: it is what pins the page onto the
  // wide canvas.
  let ref = null;

  for (const job of JOBS) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1400, height: 1000 });
    // Loaded as a document rather than through setContent: these files are a
    // megabyte with an XML declaration, and setContent mangles both.
    await page.goto('file://' + path.join(ROOT, job.src), { waitUntil: 'load' });

    const report = await page.evaluate(
      async (fontCss, COPY, REF, job, ref, a3) => {
        const NS = 'http://www.w3.org/2000/svg';
        const svg = document.documentElement;

        /** A node's box in root user units — getBBox() alone is local. */
        const boxIn = (el) => {
          const b = el.getBBox();
          const m = svg.getScreenCTM().inverse().multiply(el.getScreenCTM());
          const xs = [], ys = [];
          for (const [x, y] of [[b.x, b.y], [b.x + b.width, b.y],
                                [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) {
            const p = svg.createSVGPoint(); p.x = x; p.y = y;
            const q = p.matrixTransform(m); xs.push(q.x); ys.push(q.y);
          }
          return { x: Math.min(...xs), y: Math.min(...ys),
                   w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
        };
        const byId = (id) => [...svg.querySelectorAll('g')].find((g) => g.id === id);

        const style = document.createElementNS(NS, 'style');
        style.textContent = `${fontCss}
.t-title{font-family:'Poster Display',sans-serif;font-weight:800;}
.t-sub{font-family:'Poster Text',sans-serif;font-weight:600;}
.t-tag{font-family:'Poster Text',sans-serif;font-weight:400;}
#النصوص text{direction:rtl;unicode-bidi:isolate;text-anchor:middle;}`;
        svg.insertBefore(style, svg.firstChild);

        const type = byId('النصوص');
        if (!type) throw new Error('no النصوص group — the export changed shape');

        const rule = type.querySelector('line');
        if (!rule) throw new Error('no rule line — cannot locate the centre');
        const x1 = +rule.getAttribute('x1'), x2 = +rule.getAttribute('x2');
        const cx = (x1 + x2) / 2;
        const ruleW = Math.abs(x2 - x1);

        // Illustrator emits the pair (outline copy, fill copy) per line, in the
        // order the original drew them: title1, title2, subtitle, tagline.
        const old = [...type.querySelectorAll('text')];
        if (old.length !== 8) throw new Error(`expected 8 text nodes, found ${old.length}`);
        const lines = [0, 2, 4, 6].map((i) => {
          const el = old[i];
          const m = /translate\(\s*([-\d.]+)[ ,]+([-\d.]+)/.exec(el.getAttribute('transform') || '');
          if (!m) throw new Error('a text node has no translate()');
          return { y: +m[2], size: parseFloat(getComputedStyle(el).fontSize) };
        });
        for (const el of old) el.remove();

        const spec = [
          { txt: COPY.titleLine1, cls: 't-title', fill: '#FFF3C4', ...lines[0] },
          { txt: COPY.titleLine2, cls: 't-title', fill: '#FFF3C4', ...lines[1] },
          { txt: COPY.subtitle, cls: 't-sub', fill: '#FFFFFF', ...lines[2] },
          { txt: COPY.tagline, cls: 't-tag', fill: '#FFFFFF', ...lines[3] },
        ];

        // The page these lines sit inside is not in the wide file at all, so
        // the width budget comes from the rule, drawn to the same proportion
        // in both.
        const k = ruleW / REF.rule;
        const titleMax = (842 - 96) * k;
        const bodyMax = (842 - 120) * k;

        await document.fonts.ready;
        for (const [fam, w] of [['Poster Display', 800], ['Poster Text', 600], ['Poster Text', 400]]) {
          await document.fonts.load(`${w} 100px "${fam}"`);
        }

        const mk = (s, size, attrs) => {
          const t = document.createElementNS(NS, 'text');
          t.setAttribute('x', cx);
          t.setAttribute('y', s.y);
          t.setAttribute('class', s.cls);
          t.style.fontSize = `${size}px`;
          for (const [k2, v] of Object.entries(attrs)) t.setAttribute(k2, v);
          t.textContent = s.txt;
          return t;
        };

        const set = [];
        for (const s of spec) {
          const title = s.cls === 't-title';
          const strokeRatio = title
            ? REF.titleStroke / REF.title
            : REF.bodyStroke / (s.cls === 't-sub' ? REF.sub : REF.tag);

          // Drawn twice: a heavy outline behind, the fill over it. Both copies
          // must land at the same size, so it is measured once on the outline
          // and handed to the fill.
          let size = s.size;
          const under = mk(s, size, {
            fill: 'none', stroke: '#22160b', 'stroke-width': (size * strokeRatio).toFixed(2),
            'stroke-linejoin': 'round', 'paint-order': 'stroke',
          });
          type.appendChild(under);

          const max = title ? titleMax : bodyMax;
          const w = under.getComputedTextLength();
          if (w > max) {
            size = Math.floor(size * (max / w) * 10) / 10;
            under.style.fontSize = `${size}px`;
            under.setAttribute('stroke-width', (size * strokeRatio).toFixed(2));
          }

          type.appendChild(mk(s, size, { fill: s.fill }));
          set.push({ txt: s.txt, y: s.y, from: s.size, size,
                     w: +under.getComputedTextLength().toFixed(1), max: +max.toFixed(1) });
        }

        // The rule has to stay between the title and the subtitle, but
        // appending put the new text after it.
        type.insertBefore(rule, type.children[4]);

        // Recorded on every job, because the A3 export is the reference the
        // wide one is placed against. cx and the first baseline pin the affine
        // between the two files; the boxes are what gets mapped through it.
        const out = { cx, ruleW, k, lines: set,
                      titleSize: lines[0].size, titleY: lines[0].y, boxes: {} };
        for (const id of ['الشخصيات', 'الشعارات']) {
          const g = byId(id);
          if (g) out.boxes[id] = boxIn(g);
        }

        // The A3 page, which the narrow export still carries as a clipPath:
        //   <clipPath transform="translate(238.81 0)"><rect x="0.1" …>
        const clip = svg.querySelector('clipPath rect');
        if (clip) {
          const t = /translate\(\s*([-\d.]+)/.exec(clip.parentNode.getAttribute('transform') || '');
          out.page = {
            x: (t ? +t[1] : 0) + (+clip.getAttribute('x') || 0),
            y: +clip.getAttribute('y') || 0,
            w: +clip.getAttribute('width'),
            h: +clip.getAttribute('height'),
          };
        }

        if (job.reframe) {
          // The field, found as the one big black-stroked path rather than by
          // class name, so a re-export that renumbers the classes still works.
          let field = null;
          for (const el of svg.querySelectorAll('path,rect,polygon')) {
            const cs = getComputedStyle(el);
            if (cs.stroke === 'none') continue;
            const b = boxIn(el);
            if (b.w > 900 && b.h > 250 && (!field || b.w * b.h > field.b.w * field.b.h)) {
              field = { el, b, sw: parseFloat(cs.strokeWidth) || 0 };
            }
          }
          if (!field) throw new Error('no field rectangle to reframe against');

          // getBBox() is the centreline, so half the stroke lies outside it.
          const half = field.sw / 2 + 0.5;
          const vb = { x: field.b.x + half, y: 0,
                       w: field.b.w - half * 2, h: field.b.y + field.b.h - half };
          svg.setAttribute('viewBox', `${vb.x.toFixed(2)} ${vb.y} ${vb.w.toFixed(2)} ${vb.h.toFixed(2)}`);
          out.reframe = vb;

          // The type is not centred on this canvas — it sits 74 units left,
          // which is what keeps the last letter of «الثلاثة» clear of the sun.
          // Centring it, as the A3 page does, walks the title into the sun, so
          // the offset stays.
        }

        // Put the cast and the logos where out/poster.svg has them.
        //
        // Two mappings compose. The A3 page lands on this canvas by the affine
        // between the two Illustrator exports, which is readable at both ends:
        // the scale is the ratio of their title sizes, which Illustrator kept,
        // and the offset falls out of the rule's centre and the first
        // baseline. Every baseline in the two files agrees with the result to
        // a hundredth. Then out/poster.svg is that page — its viewBox is the
        // page — so anything measured in it maps straight through.
        //
        // Two groups arrived wrong. The logo band is squeezed across: its
        // height carries the same 0.82 the rest of the export does, its width
        // carries 0.82 twice, so the round university seal turns up at 0.79 —
        // and it sits on the artwork's centre rather than the page's. And the
        // cast is drawn smaller and higher than it belongs.
        if (ref && a3 && job.place) {
          const s = lines[0].size / ref.titleSize;
          const tx = cx - ref.cx * s;
          const ty = lines[0].y - ref.titleY * s;
          const page = { x: ref.page.x * s + tx, y: ref.page.y * s + ty,
                         w: ref.page.w * s, h: ref.page.h * s };
          // out/poster.svg's units into this canvas's.
          const q = page.w / a3.page.w;
          const mapped = (bb) => ({ x: page.x + bb.x * q, y: page.y + bb.y * q,
                                    w: bb.w * q, h: bb.h * q });
          out.pageHere = page;
          out.placed = [];

          for (const { id, fit, by } of job.place) {
            const g = byId(id), rb = a3.boxes[id];
            if (!g || !rb) continue;
            const t = mapped(rb);
            const b = boxIn(g);

            let sx, sy, nx, ny, note = '';
            if (fit === 'stretch') {
              // The band: both axes, because the squeeze is a defect and
              // undoing it is what makes the seal round again.
              sx = t.w / b.w; sy = t.h / b.h;
              nx = t.x; ny = t.y;
            } else {
              // The cast: one scale, and not from the group's own box. The two
              // drawings space the cast differently — tighter here — so the
              // group is narrower than the reference by much more than the
              // characters in it are smaller. Comparing the characters
              // themselves settles it: each one's height against the page,
              // there over here, and the median of those. They agree closely
              // (1.24, 1.18, 1.17, 1.17), which is what says the difference
              // really is one uniform scale and not a different arrangement.
              const each = by.map((cid) => {
                const cg = byId(cid), cb = a3.boxes[cid];
                return cg && cb ? (cb.h * q) / boxIn(cg).h : null;
              }).filter(Boolean).sort((m, n) => m - n);
              if (!each.length) continue;
              const mid = each.length >> 1;
              sx = sy = each.length % 2 ? each[mid] : (each[mid - 1] + each[mid]) / 2;
              note = each.map((v) => v.toFixed(3)).join(' ');
              // Then stood on the reference's own feet, centred where the
              // reference centres it.
              nx = (t.x + t.w / 2) - (b.w * sx) / 2;
              ny = (t.y + t.h) - b.h * sy;
            }

            const wrap = document.createElementNS(NS, 'g');
            wrap.setAttribute('transform',
              `translate(${(nx - b.x * sx).toFixed(2)} ${(ny - b.y * sy).toFixed(2)}) ` +
              `scale(${sx.toFixed(5)} ${sy.toFixed(5)})`);
            g.parentNode.insertBefore(wrap, g);
            wrap.appendChild(g);
            out.placed.push({ id, fit, note, sx: +sx.toFixed(3), sy: +sy.toFixed(3),
                              was: `${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.w.toFixed(0)}×${b.h.toFixed(0)}`,
                              now: `${nx.toFixed(0)},${ny.toFixed(0)} ${(b.w * sx).toFixed(0)}×${(b.h * sy).toFixed(0)}` });
          }
        }

        out.viewBox = svg.getAttribute('viewBox');
        const ser = new XMLSerializer();
        out.svg = ser.serializeToString(svg);

        if (job.split) {
          // Two halves of one drawing, so they overlay in exact register: the
          // scenery, and everything standing in front of it. Splitting them
          // lets the deck dissolve the scenery toward the edges while the cast,
          // the title and the logos stay untouched.
          const find = (root) => [...root.querySelectorAll('g')].filter((g) => job.split.includes(g.id));
          const KEEP = new Set(['defs', 'style', 'metadata', 'title']);

          const back = svg.cloneNode(true);
          const keepers = find(back);
          if (!keepers.length) throw new Error(`no ${job.split} group to split on`);
          // Ancestors are kept, pruned of their other children: a layer may
          // carry a transform or a clip that the subtree still depends on.
          const onPath = new Set();
          for (const n of keepers) {
            for (let p = n.parentNode; p && p !== back; p = p.parentNode) onPath.add(p);
          }
          const prune = (el) => {
            for (const c of [...el.children]) {
              if (keepers.includes(c)) continue;
              if (onPath.has(c)) prune(c);
              else if (!KEEP.has(c.tagName)) c.remove();
            }
          };
          prune(back);
          out.bgSvg = ser.serializeToString(back);

          const front = svg.cloneNode(true);
          for (const g of find(front)) g.remove();
          out.fgSvg = ser.serializeToString(front);
        }

        if (job.page) {
          // The A3 page the export still carries as a clipPath.
          const box = out.page;
          if (!box) throw new Error('no page clip to crop to');
          svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.w} ${box.h}`);
          svg.setAttribute('width', '297mm');
          svg.setAttribute('height', '420mm');
          out.page = box;
          out.pageSvg = new XMLSerializer().serializeToString(svg);
        }

        return out;
      },
      fontCss, COPY, REF, job, ref, a3
    );

    if (!ref) ref = { cx: report.cx, titleSize: report.titleSize,
                      titleY: report.titleY, boxes: report.boxes, page: report.page };

    const write = (rel, text) => {
      const dst = path.join(ROOT, rel);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, '<?xml version="1.0" encoding="UTF-8"?>\n' + text);
      return dst;
    };

    const dst = write(job.out, report.svg);
    console.log(`${job.out}   viewBox ${report.viewBox}`);
    console.log(`  centre ${report.cx.toFixed(2)}   rule ${report.ruleW.toFixed(2)}   scale ${report.k.toFixed(4)}`);
    for (const l of report.lines) {
      const fit = l.size === l.from ? '' : `  shrunk from ${l.from}`;
      console.log(`  y ${String(l.y).padStart(7)}  ${String(l.size).padStart(6)}px  ${String(l.w).padStart(6)} / ${l.max}${fit}   ${l.txt}`);
    }
    if (report.reframe) console.log(`  reframed to the field, dropping its three stray edges`);
    if (report.pageHere) {
      const g = report.pageHere;
      console.log(`  the A3 page lands at ${g.x.toFixed(2)} ${g.y.toFixed(2)} ${g.w.toFixed(2)} × ${g.h.toFixed(2)}`);
    }
    for (const p of report.placed || []) {
      const by = p.sy === p.sx ? `${p.sx}x` : `${p.sx}x across by ${p.sy}x down`;
      console.log(`  ${p.id} placed from out/poster.svg  (${p.fit}, ${by})`);
      console.log(`      ${p.was}  ->  ${p.now}${p.note ? `   from ${p.note}` : ''}`);
    }
    console.log(`  ${(fs.statSync(dst).size / 1024).toFixed(0)} KB`);
    await preview(dst, report.viewBox);

    if (report.bgSvg) {
      for (const [suffix, text] of [['-bg', report.bgSvg], ['-fg', report.fgSvg]]) {
        const rel = job.out.replace(/\.svg$/, `${suffix}.svg`);
        const p = write(rel, text);
        console.log(`  ${suffix.slice(1)}  ${rel}  ${(fs.statSync(p).size / 1024).toFixed(0)} KB`);
      }
    }

    if (report.pageSvg) {
      const pd = write(job.page, report.pageSvg);
      const b = report.page;
      const vb = `${b.x} ${b.y} ${b.w} ${b.h}`;
      console.log(`${job.page}   A3 page ${b.w} × ${b.h} at x ${b.x.toFixed(2)}   ${(fs.statSync(pd).size / 1024).toFixed(0)} KB`);
      await preview(pd, vb, 900);
    }

    await page.close();
    console.log();
  }
} finally {
  await browser.close();
}

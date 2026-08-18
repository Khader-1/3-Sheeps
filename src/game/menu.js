// «ألعاب الخراف الثلاثة» — the mini-game menu.
//
// One stage, one context per game. Starting a game destroys the previous
// context first, which cancels its rAF loops, timers and audio and wipes every
// layer. Without that, a loop from a finished game keeps repainting over the
// next one — the classic way a menu-driven set of games falls apart.
//
// The order is Khader's, not the film's.

import { svgEl } from '../rig.js';
import { loadCharacter, applyExpression, restArms } from '../expressions.js';
import { houseNode } from './house-art.js';
import { makeStage, GameContext, W, H, CREAM, INK, panel, label, scrim, view, band, fitGround, groundTop, isTall, onViewChange } from './ui.js';

import * as build from './build.js';
import * as door from './door.js';
import * as run from './run.js';
import * as chimney from './chimney.js';
import * as whosaid from './whosaid.js';
import * as rebuild from './rebuild.js';
import * as faces from './faces.js';

const GAMES = [rebuild, chimney, whosaid, run, build, door, faces];

export async function startMenu(host) {
  const stage = makeStage(host);
  let ctx = null;

  const teardown = () => { ctx?.destroy(); ctx = null; };

  async function open(mod) {
    teardown();
    ctx = new GameContext(stage, () => { showMenu().catch(report); });
    try {
      await mod.start(ctx);
    } catch (e) {
      report(e);
    }
  }

  function report(e) {
    console.error(e);
    const el = document.getElementById('err');
    if (el) { el.style.display = 'block'; el.textContent = (e && e.stack) || String(e); }
  }

  async function showMenu() {
    teardown();
    ctx = new GameContext(stage, () => {});
    ctx._isMenu = true;
    const { layers } = ctx;

    await ctx.scene('خلفيه 1');

    // The set has a house painted into it — 390 loose paths with no group of
    // their own, sitting between the sky and the trees in draw order. Nothing
    // names them, but they are one unbroken run, so the two groups either side
    // bracket it exactly. Pull that run out and stand the real house where it
    // was, with the palms still drawing in front of it.
    {
      const root = layers.bg.querySelector('[data-scene]')?.querySelector('g');
      const kids = root ? [...root.children] : [];
      const from = kids.findIndex((n) => n.getAttribute('id') === 'الغيم_والشمس');
      const to = kids.findIndex((n) => n.getAttribute('id') === 'اشجار');
      if (from >= 0 && to > from) {
        for (let i = from + 1; i < to; i++) kids[i].remove();
        // Matched to the one it replaces: 625 tall with its base on the path,
        // running off the right edge. The height is the point — the tile grid
        // covers everything below about y=170, so a shorter house would sit
        // entirely behind the menu and never be seen.
        const house = await houseNode({ height: 625, bottom: 652, left: 580 });
        root.insertBefore(house, kids[to]);
      }
    }
    // One transform for the set AND the cast standing in it. Scaling only the
    // background left the characters at their original size against a resized
    // scene — the sheep grew and shrank relative to the house they stand
    // beside. Cropping or shifting is fine; changing their relative size is
    // not.
    // On a tall screen the set sits low and the menu takes the room above it,
    // instead of the tiles being crammed on top of a small strip while most of
    // the screen sits empty.
    const SCENE_ALIGN = isTall() ? 0.78 : 0.5;
    fitGround(layers, { align: SCENE_ALIGN });
    onViewChange(() => fitGround(layers, { align: isTall() ? 0.78 : 0.5 }));
    // Dims the set only — it lives inside the fitted group, so it can never
    // spill over the frame into the surround.
    layers.bg.appendChild(svgEl('rect', {
      x: 0, y: 0, width: W, height: H, fill: '#0d1405', opacity: 0.5,
    }));

    // The cast lined up along the bottom, under the tiles.
    for (const [key, x, h, flip] of [['mid', 92, 150, false], ['big', 208, 168, false],
                                      ['small', 318, 136, false], ['wolf', 1180, 210, true]]) {
      const rig = await loadCharacter(key, key === 'wolf' ? 'side' : 'front');
      layers.world.appendChild(rig.node);
      applyExpression(rig, key === 'wolf' ? 'menacing' : 'neutral');
      if (key === 'small') restArms(rig);
      rig.place({ x, y: H - 16, height: h, flip });
      rig.node.setAttribute('opacity', 0.9);
    }

    // The grid reflows: four across on a wide screen, three on a laptop, two
    // on a phone held upright. Column count comes from the space actually
    // available, so nothing ever runs off the edge or clumps in the middle.
    const gapX = 20, gapY = 20;
    const avail = band.w - 96;
    const cols = avail > 1240 ? 4 : avail > 940 ? 3 : 2;
    const rows = Math.ceil(GAMES.length / cols);
    const cw = Math.min(300, (avail - (cols - 1) * gapX) / cols);

    // On a tall screen the menu owns everything above the set; otherwise it
    // stays inside the usual band.
    const sceneTop = groundTop(SCENE_ALIGN);
    const areaTop = isTall() ? view.top + 40 : band.top;
    const areaBottom = isTall() ? sceneTop - 24 : band.bottom;
    const areaH = areaBottom - areaTop;

    const ch = Math.min(176, Math.max(118, (areaH - 190) / rows - gapY));
    const titleY = areaTop + Math.min(96, areaH * 0.16);
    // Set the way the poster sets it — cream inside a heavy dark outline — so
    // the app opens on the film's own identity rather than on a menu.
    ctx.ui(label('ألعاب الخراف الثلاثة', W / 2, titleY,
      { size: 62, fill: '#FFF3C4', weight: 800, outline: true }));
    ctx.ui(label('اختر لعبة', W / 2, titleY + 46,
      { size: 28, fill: '#ffe9a8', weight: 600, outline: true }));

    const gridH = rows * ch + (rows - 1) * gapY;
    const x0 = W / 2 - (cols * cw + (cols - 1) * gapX) / 2;
    const y0 = Math.max(titleY + 74, (areaTop + areaBottom) / 2 - gridH / 2 + 22);

    GAMES.forEach((mod, i) => {
      const m = mod.meta;
      const x = x0 + (i % cols) * (cw + gapX);
      const y = y0 + Math.floor(i / cols) * (ch + gapY);

      const g = svgEl('g', { cursor: 'pointer', class: 'btn' });
      g.appendChild(panel(x, y, cw, ch, { fill: CREAM, opacity: 0.97 }));

      const emoji = svgEl('text', {
        x: x + cw / 2, y: y + ch * 0.37, 'text-anchor': 'middle',
        'font-size': Math.round(ch * 0.3),
      });
      emoji.textContent = m.emoji;
      g.appendChild(emoji);

      g.appendChild(label(m.title, x + cw / 2, y + ch * 0.62, { size: Math.round(ch * 0.19) }));
      g.appendChild(wrap(m.blurb, x + cw / 2, y + ch * 0.79, cw - 28));

      g.addEventListener('click', () => { ctx.play('knock', 0.3); open(mod).catch(report); });
      ctx.ui(g);
    });

    ctx.ui(label('كلية فلسطين التقنية – دير البلح · الوسائط المتعددة والرسوم المتحركة',
      W / 2, (isTall() ? view.bottom - 26 : band.bottom - 16),
      { size: 20, fill: '#ffffff', weight: 600, outline: true }));
  }

  /** Two-line blurb; SVG text does not wrap, so it is split by width estimate. */
  function wrap(text, cx, y, maxW) {
    const g = svgEl('g');
    const perLine = Math.max(8, Math.floor(maxW / 11));
    const words = text.split(' ');
    const lines = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > perLine) { lines.push(cur.trim()); cur = w; }
      else cur += ' ' + w;
    }
    if (cur.trim()) lines.push(cur.trim());
    lines.slice(0, 2).forEach((ln, i) => {
      g.appendChild(label(ln, cx, y + i * 24, { size: 20, fill: '#5a4326', weight: 600 }));
    });
    return g;
  }

  // A rotation or resize re-lays-out the menu; a running game re-lays-out via
  // its own onViewChange handlers.
  onViewChange(() => { if (ctx && ctx._isMenu) showMenu().catch(report); });

  await showMenu();
}

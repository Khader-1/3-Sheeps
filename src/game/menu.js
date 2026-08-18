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
import { PREVIEWS, PREVIEW_CSS, PW, PH } from './previews.js';

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

    // ---- the carousel -------------------------------------------------
    // Seven tiles side by side told you the games existed. A card at a time,
    // with the thing it asks you to do moving inside it, tells you what each
    // one is — which is the only question the menu has to answer.
    //
    // Laid out right to left: index 0 is the rightmost card, so ← walks
    // forward through the set the way ← walks forward through the deck.
    const sceneTop = groundTop(SCENE_ALIGN);
    const areaTop = isTall() ? view.top + 40 : band.top;
    const areaBottom = isTall() ? sceneTop - 24 : band.bottom;
    const areaH = areaBottom - areaTop;

    const titleY = areaTop + Math.min(92, areaH * 0.15);
    // Set the way the poster sets it — cream inside a heavy dark outline — so
    // the app opens on the film's own identity rather than on a menu.
    ctx.ui(label('ألعاب الخراف الثلاثة', W / 2, titleY,
      { size: 62, fill: '#FFF3C4', weight: 800, outline: true }));
    ctx.ui(label('اختر لعبة', W / 2, titleY + 46,
      { size: 28, fill: '#ffe9a8', weight: 600, outline: true }));

    // One <style> for every preview's keyframes, and for the slide the cards
    // make when the focus moves.
    const css = svgEl('style');
    css.textContent = PREVIEW_CSS + `
      .card { transition: transform .42s cubic-bezier(.2,.8,.25,1), opacity .42s ease; }
      .card.far { pointer-events: none; }`;
    ctx.ui(css);

    const CARD_W = PW + 20, CARD_H = 330, STEP = CARD_W * 0.78;

    // One gradient, shared by all seven feet.
    const footId = 'pv-foot';
    const foot = svgEl('linearGradient', { id: footId, x1: 0, y1: 0, x2: 0, y2: 1 });
    foot.appendChild(svgEl('stop', { offset: 0, 'stop-color': '#0d0803', 'stop-opacity': 0 }));
    foot.appendChild(svgEl('stop', { offset: 1, 'stop-color': '#0d0803', 'stop-opacity': 0.55 }));
    const defs = svgEl('defs');
    defs.appendChild(foot);
    ctx.ui(defs);
    // The rail is scaled as one, so a narrow window shrinks the whole
    // arrangement rather than dropping the cards either side of the focus.
    const k = Math.min(1, (band.w - 40) / (CARD_W + STEP * 2 * 0.78 + 120),
                          (areaBottom - titleY - 118) / CARD_H);
    const railY = Math.max(titleY + 58, (titleY + 52 + areaBottom - 44) / 2 - (CARD_H * k) / 2);

    const rail = svgEl('g', { transform: `translate(${W / 2} ${railY + CARD_H * k / 2}) scale(${k})` });
    ctx.ui(rail);

    let focus = 0;
    const cards = GAMES.map((mod, i) => {
      const m = mod.meta;
      const g = svgEl('g', { class: 'card' });
      const x = -CARD_W / 2, y = -CARD_H / 2;

      g.appendChild(panel(x, y, CARD_W, CARD_H, { fill: CREAM, opacity: 0.97 }));

      // The preview, clipped to its own rounded corner so nothing animating
      // inside it can escape the card. The rect is at the origin, not at the
      // card's inset: a clip-path resolves in the user space the element's own
      // transform establishes, so it moves with the group it clips.
      const clipId = `pvclip-${m.id}`;
      const clip = svgEl('clipPath', { id: clipId });
      clip.appendChild(svgEl('rect', { x: 0, y: 0, width: PW, height: PH, rx: 14 }));
      g.appendChild(clip);
      const shot = svgEl('g', { 'clip-path': `url(#${clipId})`, transform: `translate(${x + 10} ${y + 10})` });
      shot.appendChild(PREVIEWS[m.id]());
      // A wash along the foot of the picture, so the button below has
      // something to sit on whatever the preview happens to be drawing there.
      shot.appendChild(svgEl('rect', { x: 0, y: PH - 88, width: PW, height: 88,
                                       fill: `url(#${footId})` }));
      g.appendChild(shot);
      g.appendChild(svgEl('rect', { x: x + 10, y: y + 10, width: PW, height: PH, rx: 14,
                                    fill: 'none', stroke: INK, 'stroke-width': 4 }));

      g.appendChild(label(m.title, 0, y + PH + 58, { size: 36, weight: 800 }));
      g.appendChild(wrap(m.blurb, 0, y + PH + 92, CARD_W - 56));

      // The button sits on the preview, not under it — but in its corner. In
      // the middle it covers the one thing the preview exists to show, which
      // on most of these is dead centre.
      const play = svgEl('g', { class: 'btn play', cursor: 'pointer' });
      const px = x + 24, py = y + PH - 46;
      play.appendChild(svgEl('rect', { x: px, y: py, width: 124, height: 44, rx: 22,
                                       fill: '#ffd23f', stroke: INK, 'stroke-width': 5 }));
      play.appendChild(label('العب', px + 62, py + 31, { size: 26, weight: 800 }));
      play.addEventListener('click', (e) => {
        e.stopPropagation();
        ctx.play('knock', 0.3);
        open(mod).catch(report);
      });
      g.appendChild(play);

      // Anywhere else on a card that is not the focused one brings it forward.
      g.addEventListener('click', () => { if (i !== focus) settle(i); });
      rail.appendChild(g);
      return { g, play };
    });

    // Dots, right to left like the cards.
    const dotsY = railY + CARD_H * k + 26;
    const dots = GAMES.map((mod, i) => {
      const d = svgEl('circle', {
        cx: W / 2 + (GAMES.length / 2 - 0.5 - i) * 26, cy: dotsY, r: 7,
        fill: CREAM, stroke: INK, 'stroke-width': 3, cursor: 'pointer', class: 'btn',
      });
      d.addEventListener('click', () => settle(i));
      ctx.ui(d);
      return d;
    });

    /** Move the focus, and put every card where that leaves it. */
    function settle(i) {
      focus = Math.max(0, Math.min(GAMES.length - 1, i));
      cards.forEach(({ g, play }, j) => {
        const d = j - focus;
        const near = Math.abs(d) <= 1;
        const s = d === 0 ? 1 : 0.76;
        g.setAttribute('transform', `translate(${-d * STEP} 0) scale(${s})`);
        g.setAttribute('opacity', d === 0 ? 1 : near ? 0.55 : 0);
        g.classList.toggle('far', !near);
        play.setAttribute('opacity', d === 0 ? 1 : 0);
        play.style.pointerEvents = d === 0 ? '' : 'none';
      });
      dots.forEach((dd, j) => dd.setAttribute('fill', j === focus ? '#ffd23f' : CREAM));
      // The focused card last, so it draws over its neighbours.
      rail.appendChild(cards[focus].g);
    }
    settle(0);

    // ‹ › for a mouse, ← → for the keyboard. On an RTL rail, ← is forward.
    const arrow = (dir, cx) => {
      const g = svgEl('g', { class: 'btn', cursor: 'pointer' });
      g.appendChild(svgEl('circle', { cx, cy: railY + CARD_H * k / 2, r: 30,
                                      fill: CREAM, opacity: 0.92, stroke: INK, 'stroke-width': 5 }));
      g.appendChild(label(dir < 0 ? '‹' : '›', cx, railY + CARD_H * k / 2 + 13, { size: 44, weight: 800 }));
      g.addEventListener('click', () => settle(focus + dir));
      ctx.ui(g);
    };
    arrow(1, Math.max(band.left + 44, W / 2 - CARD_W * k / 2 - 52));
    arrow(-1, Math.min(band.right - 44, W / 2 + CARD_W * k / 2 + 52));

    ctx.onKey((e) => {
      if (e.key === 'ArrowLeft') settle(focus + 1);
      else if (e.key === 'ArrowRight') settle(focus - 1);
      else if (e.key === 'Enter' || e.key === ' ') {
        ctx.play('knock', 0.3);
        open(GAMES[focus]).catch(report);
      } else return;
      e.preventDefault();
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

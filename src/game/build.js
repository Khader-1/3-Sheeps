// «ابنِ بيتك» — build the house, then the wolf tests it.
//
// The moral is the mechanic: each part is a choice of material AND a test of
// care. Straw fails however carefully it is built, wood survives only if you
// took your time, stone survives either way. A child who picks good materials
// but rushes still loses the house.

import { svgEl } from '../rig.js';
import { loadCharacter, applyExpression, restArms } from '../expressions.js';
import { buildLimbChains } from '../anim/gait.js';
import { blow as blowEffect } from '../book/effects.js';
import { MATERIALS, PARTS, GEO, buildPart, ghostPart, loadHouse } from './house.js';
import { W, H, INK, CREAM, GREEN, clamp01, rnd, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, fitGround, band } from './ui.js';

const BLOW_FORCE = 2.6;
const CARE_BONUS = 1.2;

/**
 * What a hit on the timing bar is worth.
 *
 * Green is a clean job. Yellow is "good enough" — it still passes, but land on
 * yellow for every part and the house comes down anyway, because a house built
 * entirely of good-enough is not a good house. A miss still builds something,
 * cracked and weak, rather than blocking progress: a child who cannot hit the
 * bar should still get to see the wolf arrive.
 */
const CARE = { green: 1, yellow: 0.55, miss: 0.12 };
const MAX_YELLOW = 2;

export const meta = {
  id: 'build',
  title: 'ابنِ بيتك',
  blurb: 'اختر المواد وأتقِن العمل قبل أن يصل الذئب',
  emoji: '🏠',
};

export async function start(ctx) {
  const { layers } = ctx;
  // The house is real artwork now, and GEO is measured from it — nothing
  // that touches a part may run before this resolves.
  await loadHouse();
  await ctx.scene('مشهد8');
  fitGround(layers);
  onViewChange(() => fitGround(layers));

  const sheep = {};
  for (const [key, x, h] of [['big', 210, 190], ['mid', 96, 172], ['small', 320, 156]]) {
    const rig = await loadCharacter(key, 'front');
    layers.world.appendChild(rig.node);
    applyExpression(rig, 'neutral');
    if (key === 'small') restArms(rig);
    rig.place({ x, y: 646, height: h });
    sheep[key] = rig;
  }

  const wolf = await loadCharacter('wolf', 'side');
  const wolfHolder = svgEl('g');
  layers.world.appendChild(wolfHolder);
  wolfHolder.appendChild(wolf.node);
  applyExpression(wolf, 'menacing');
  buildLimbChains(wolf);
  const WOLF_H = 330;
  wolf.place({ x: 1500, y: 672, height: WOLF_H, flip: true });

  // Where he stops, derived from the house rather than picked by eye. He was
  // ending up standing inside the roof: his own half-width was never accounted
  // for, so "close to the house" put his body through it.
  const wolfHalf = (wolf.bbox().width / wolf.bbox().height) * WOLF_H * 0.5;
  const WOLF_STOP = GEO.roof.x + GEO.roof.w + 34 + wolfHalf;
  const WOLF_TRAVEL = WOLF_STOP - 1500;
  const wolfAt = (x) => wolfHolder.setAttribute('transform', `translate(${rnd(x)} 0)`);
  wolfAt(0);

  const state = { step: 0, chosen: {}, parts: {}, yellow: 0 };
  const addGhosts = () => { for (const p of PARTS) layers.world.appendChild(ghostPart(p.id)); };
  addGhosts();

  // ------------------------------------------------------------ phases
  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.62));
    ctx.ui(label('ابنِ بيتك', W / 2, 240, { size: 92, fill: CREAM, weight: 800 }));
    ctx.ui(label('اختر المواد… وأتقِن العمل', W / 2, 312, { size: 36, fill: '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 386, 260, 86, next, { size: 40 }));
    ctx.ui(label('لكل جزء: اختر مادته، ثم أوقف الشريط في المنطقة الخضراء',
      W / 2, 530, { size: 27, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(backChip(ctx));
  }

  function next() {
    if (state.step >= PARTS.length) return wolfArrives();
    choose(PARTS[state.step]);
  }

  function choose(part) {
    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner(`من أيّ شيء نبني ${part.label}؟`));

    ['straw', 'wood', 'stone'].forEach((id, i) => {
      const mat = MATERIALS[id];
      const w = 250;
      const x = W / 2 - (w * 3 + 40) / 2 + i * (w + 20);
      const y = band.bottom - 190;
      const g = svgEl('g', { cursor: 'pointer' });
      g.appendChild(panel(x, y, w, 130, { fill: mat.fill, opacity: 0.98 }));
      g.appendChild(label(mat.label, x + w / 2, y + 78, { size: 38, fill: '#1c1006', weight: 800 }));
      g.addEventListener('click', () => { ctx.play('whoosh', 0.3); careBar(part, mat); });
      ctx.ui(g);
    });
  }

  /**
   * The care test: stop a sweeping marker on the band.
   *
   * The bands and the sweep speed come from the material, so the choice is a
   * real trade rather than a free win. Straw is a wide, slow target and a
   * house that falls anyway; stone is a narrow, fast one and a house that
   * holds. Picking the strong material is a commitment to doing the work.
   */
  function careBar(part, mat) {
    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner(`أتقِن بناء ${part.label} — أوقفه في الأخضر`, { size: 34, w: 640 }));

    const bw = 720, bh = 56, bx = W / 2 - bw / 2, by = band.bottom - 170;
    const centre = 0.5;
    const gz = mat.green;
    const yz = mat.yellow;

    ctx.ui(svgEl('rect', { x: bx, y: by, width: bw, height: bh, rx: 16, fill: '#efe2c2', stroke: INK, 'stroke-width': 5 }));
    ctx.ui(svgEl('rect', {
      x: bx + bw * (centre - yz / 2), y: by, width: bw * yz, height: bh, fill: '#f2c62e', opacity: 0.95,
    }));
    ctx.ui(svgEl('rect', {
      x: bx + bw * (centre - gz / 2), y: by, width: bw * gz, height: bh, fill: GREEN, opacity: 0.95,
    }));
    const marker = ctx.ui(svgEl('rect', {
      x: bx, y: by - 10, width: 12, height: bh + 20, rx: 6, fill: '#c0392b', stroke: INK, 'stroke-width': 4,
    }));
    ctx.ui(label(`صعوبة ${mat.label}`, W / 2, by - 24, { size: 24, fill: CREAM, weight: 600 }));

    let p = 0;
    let u = 0;
    const speed = mat.speed * (1 + state.step * 0.12);
    const stopLoop = ctx.loop((dt) => {
      u += dt * speed;
      p = Math.abs(((u % 2) + 2) % 2 - 1);       // triangle wave
      marker.setAttribute('x', bx + p * (bw - 12));
    });

    let done = false;
    ctx.ui(button(ctx, 'اضغط!', W / 2 - 110, band.bottom - 90, 220, 68, () => {
      if (done) return;
      done = true;
      stopLoop();

      const off = Math.abs(p - centre);
      const band = off <= gz / 2 ? 'green' : off <= yz / 2 ? 'yellow' : 'miss';
      const care = CARE[band];
      if (band === 'yellow') state.yellow++;
      state.chosen[part.id] = { mat, care, band };

      layers.world.querySelector(`[data-ghost="${part.id}"]`)?.remove();
      const built = buildPart(part.id, mat, care);
      layers.world.appendChild(built);
      state.parts[part.id] = built;
      pop(built);
      ctx.play(band === 'green' ? 'impact' : band === 'yellow' ? 'step-grass' : 'whoosh', 0.45);

      ctx.clearUi();
      const said = band === 'green' ? 'عملٌ متقن!'
        : band === 'yellow' ? 'مقبول… لكن ليس متقناً'
        : 'بُنيَ على عجل — انظر إلى الشقوق!';
      ctx.ui(banner(said, { size: 36, w: 620 }));
      state.step++;
      ctx.after(1000, next);
    }));
  }

  function pop(node) {
    const b = GEO[node.getAttribute('data-part')];
    const cx = b.x + b.w / 2, cy = b.y + b.h;
    let t = 0;
    ctx.loop((dt) => {
      t += dt / 0.26;
      const s = 1 + Math.sin(clamp01(t) * Math.PI) * 0.09;
      node.setAttribute('transform', `translate(${rnd(cx)} ${rnd(cy)}) scale(${rnd(s)}) translate(${rnd(-cx)} ${rnd(-cy)})`);
      if (t >= 1) { node.removeAttribute('transform'); return false; }
    });
  }

  // ------------------------------------------------------------- wolf
  function wolfArrives() {
    ctx.clearUi();
    ctx.ui(banner('جاء الذئب…', { size: 40, w: 520 }));
    ctx.play('growl', 0.55);
    let t = 0;
    ctx.loop((dt) => {
      t += dt / 1.6;
      wolfAt(WOLF_TRAVEL * (1 - (1 - clamp01(t)) ** 3));
      if (t >= 1) { ctx.after(500, () => round(0)); return false; }
    });
  }

  function round(i) {
    if (i >= PARTS.length) return result();
    const part = PARTS[i];
    const pick = state.chosen[part.id];
    const survives = pick.mat.strength + pick.care * CARE_BONUS >= BLOW_FORCE;

    ctx.clearUi();
    ctx.ui(banner(`ينفخ على ${part.label}!`, { size: 38, w: 520 }));
    ctx.play('whoosh', 0.6);

    const cone = blowEffect(wolf, ctx.svg, { power: 1.15, facingLeft: true });
    layers.fx.appendChild(cone);
    shake(layers.world, 0.62, survives ? 6 : 16);

    ctx.after(700, () => {
      cone.remove();
      if (survives) ctx.play('impact', 0.4);
      else { ctx.play('whoosh', 0.7); blowAway(state.parts[part.id]); }
      ctx.after(900, () => round(i + 1));
    });
  }

  function shake(node, dur, amp) {
    let t = 0;
    ctx.loop((dt) => {
      t += dt / dur;
      const p = clamp01(t), d = (1 - p) ** 2;
      node.setAttribute('transform',
        `translate(${rnd(Math.sin(p * 90) * amp * d)} ${rnd(Math.cos(p * 130) * amp * d * 0.5)})`);
      if (t >= 1) { node.removeAttribute('transform'); return false; }
    });
  }

  function blowAway(node) {
    if (!node) return;
    let t = 0;
    ctx.loop((dt) => {
      t += dt / 0.9;
      const p = clamp01(t);
      node.setAttribute('transform',
        `translate(${rnd(-900 * p * p)} ${rnd(-160 * Math.sin(p * Math.PI) + 300 * p * p)}) rotate(${rnd(-320 * p)} 640 480)`);
      node.setAttribute('opacity', rnd(1 - p * 0.7));
      if (t >= 1) { node.remove(); return false; }
    });
  }

  function result() {
    const lost = PARTS.filter((p) => {
      const c = state.chosen[p.id];
      return c.mat.strength + c.care * CARE_BONUS < BLOW_FORCE;
    });
    // Every part merely "good enough" is its own kind of failure.
    const allRushed = state.yellow > MAX_YELLOW;
    const won = !lost.length && !allRushed;

    for (const k of ['big', 'mid', 'small']) {
      applyExpression(sheep[k], won ? 'determined' : 'afraid');
      if (k === 'small') restArms(sheep[k]);
    }

    ctx.clearUi();
    ctx.ui(scrim(0.7));
    ctx.ui(label(won ? 'صمدَ البيت!' : 'سقطَ البيت!', W / 2, 236, { size: 84, fill: CREAM, weight: 800 }));
    ctx.ui(label(
      won ? 'لأنك اخترتَ جيداً وأتقنتَ عملك.'
        : allRushed ? 'كلُّ جزءٍ «مقبول» — ولا جزءَ متقن.'
          : `لم يصمد: ${lost.map((p) => p.label).join('، ')}`,
      W / 2, 306, { size: 34, fill: '#fff', weight: 600 }));
    ctx.ui(label('أتقِنْ عملك… فالبيتُ المتينُ يحميكَ يوماً ما.', W / 2, 378, { size: 31, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 452, 280, 82, reset, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 452, 280, 82, () => ctx.quit(), { size: 36 }));
    ctx.play(won ? 'impact' : 'growl', 0.5);
    // The house held, so he blew himself out; the house fell, so he is
    // pleased with himself.
    ctx.after(360, () => ctx.play(won ? 'wolf-cry' : 'wolf-laugh', 0.75));
  }

  function reset() {
    for (const p of PARTS) {
      state.parts[p.id]?.remove();
      layers.world.querySelector(`[data-ghost="${p.id}"]`)?.remove();
    }
    state.parts = {}; state.chosen = {}; state.step = 0; state.yellow = 0;
    addGhosts();
    for (const k of ['big', 'mid', 'small']) {
      applyExpression(sheep[k], 'neutral');
      if (k === 'small') restArms(sheep[k]);
    }
    wolfAt(0);
    intro();
  }

  intro();
}

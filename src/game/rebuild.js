// «أعِد بناء البيت» — Rebuild the house.
//
// The wolf has blown the house apart. Drag each piece back into its outline.
// A quiet, untimed game for the youngest players — and it reuses the house
// parts from «ابنِ بيتك», which are already separate, snappable objects.

import { svgEl } from '../rig.js';
import { MATERIALS, PARTS, GEO, buildPart, ghostPart } from './house.js';
import { W, H, CREAM, clamp01, rnd, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, band, fitGround } from './ui.js';

export const meta = {
  id: 'rebuild',
  title: 'أعِد البناء',
  blurb: 'اسحب قطع البيت إلى مكانها الصحيح',
  emoji: '🧩',
};

const SNAP = 90;   // how close a piece has to land, in scene units

/**
 * What has to exist before a piece will stay up.
 *
 * A roof needs walls under it and a door needs walls around it — drop either
 * one into place first and it falls, because there is nothing holding it.
 * Same lesson as the build game, in the form this one can express: order is
 * part of doing a job properly, not a detail.
 */
const DEPENDS = { roof: ['walls'], door: ['walls'] };
const PART_LABEL = Object.fromEntries(PARTS.map((p) => [p.id, p.label]));

export async function start(ctx) {
  const { layers, svg } = ctx;
  await ctx.scene('مشهد8');
  fitGround(layers);
  onViewChange(() => fitGround(layers));

  let placedCount = 0;
  const pieces = [];

  // Where the scattered pieces start — deliberately nowhere near their slots.
  const SCATTER = { walls: [210, 250], roof: [1030, 190], door: [980, 560] };

  function build() {
    layers.world.replaceChildren();
    layers.fx.replaceChildren();
    pieces.length = 0;
    placedCount = 0;

    for (const p of PARTS) layers.world.appendChild(ghostPart(p.id));

    for (const p of PARTS) {
      const mat = MATERIALS.stone;
      const node = buildPart(p.id, mat);
      const home = GEO[p.id];
      const [sx, sy] = SCATTER[p.id];
      // Offset from its built position to where it is scattered.
      const dx = sx - (home.x + home.w / 2);
      const dy = sy - (home.y + home.h / 2);
      node.setAttribute('transform', `translate(${rnd(dx)} ${rnd(dy)})`);
      node.setAttribute('cursor', 'grab');
      layers.fx.appendChild(node);
      pieces.push({ id: p.id, node, dx, dy, homeDx: dx, homeDy: dy, done: false });
    }
  }

  // ------------------------------------------------------------ dragging
  let drag = null;

  const toScene = (evt) => {
    const r = svg.getBoundingClientRect();
    return {
      x: ((evt.clientX - r.left) / r.width) * W,
      y: ((evt.clientY - r.top) / r.height) * H,
    };
  };

  const onDown = (evt) => {
    const hit = pieces.find((p) => !p.done && evt.target.closest(`[data-part="${p.id}"]`) === p.node);
    if (!hit) return;
    const s = toScene(evt);
    drag = { piece: hit, ox: s.x - hit.dx, oy: s.y - hit.dy };
    hit.node.setAttribute('cursor', 'grabbing');
    // Dragged piece on top.
    layers.fx.appendChild(hit.node);
    evt.preventDefault();
  };

  const onMove = (evt) => {
    if (!drag) return;
    const s = toScene(evt);
    drag.piece.dx = s.x - drag.ox;
    drag.piece.dy = s.y - drag.oy;
    drag.piece.node.setAttribute('transform', `translate(${rnd(drag.piece.dx)} ${rnd(drag.piece.dy)})`);
  };

  const onUp = () => {
    if (!drag) return;
    const p = drag.piece;
    p.node.setAttribute('cursor', 'grab');
    drag = null;

    if (Math.hypot(p.dx, p.dy) < SNAP) {
      const missing = (DEPENDS[p.id] || []).filter(
        (need) => !pieces.find((q) => q.id === need)?.done);

      if (missing.length) {
        // Nothing to hold it up: it drops instead of sticking.
        fall(p, missing);
        return;
      }

      p.done = true;
      p.dx = 0; p.dy = 0;
      p.node.setAttribute('transform', 'translate(0 0)');
      p.node.removeAttribute('cursor');
      layers.world.querySelector(`[data-ghost="${p.id}"]`)?.remove();
      layers.world.appendChild(p.node);
      ctx.play('impact', 0.4);
      placedCount++;
      if (placedCount === PARTS.length) ctx.after(420, win);
    } else {
      ctx.play('step-grass', 0.3);
    }
  };

  svg.addEventListener('pointerdown', onDown);
  svg.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  const origDestroy = ctx.destroy.bind(ctx);
  ctx.destroy = () => {
    svg.removeEventListener('pointerdown', onDown);
    svg.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    origDestroy();
  };

  /** A piece with nothing under it tumbles to the ground and goes back. */
  function fall(piece, missing) {
    const home = GEO[piece.id];
    const startX = piece.dx;
    const startY = piece.dy;
    // How far it has to drop before it is lying on the ground.
    const floor = (band.bottom - 60) - (home.y + home.h);
    ctx.play('whoosh', 0.4);
    toast(`لا يمكن بناء ${PART_LABEL[piece.id]} قبل ${missing.map((m) => PART_LABEL[m]).join(' و ')}`);

    let t = 0;
    ctx.loop((dt) => {
      t += dt / 0.75;
      const q = clamp01(t);
      const drop = startY + (floor - startY) * q * q;         // gravity
      const tilt = q * (piece.id === 'roof' ? -26 : 20);
      piece.node.setAttribute('transform',
        `translate(${rnd(startX)} ${rnd(drop)}) rotate(${rnd(tilt)} ${home.x + home.w / 2} ${home.y + home.h})`);
      if (t >= 1) {
        ctx.after(420, () => {
          // Back to where it was scattered, ready to try again.
          piece.dx = piece.homeDx;
          piece.dy = piece.homeDy;
          piece.node.setAttribute('transform', `translate(${rnd(piece.dx)} ${rnd(piece.dy)})`);
        });
        return false;
      }
    });
  }

  function toast(text) {
    layers.ui.querySelectorAll('[data-toast]').forEach((n) => n.remove());
    const g = svgEl('g', { 'data-toast': '1' });
    g.appendChild(panel(W / 2 - 380, 132, 760, 88, { fill: '#c0392b', opacity: 0.95 }));
    g.appendChild(label(text, W / 2, 188, { size: 32, fill: '#fff' }));
    layers.ui.appendChild(g);
    ctx.after(1900, () => g.remove());
  }

  function win() {
    ctx.clearUi();
    ctx.ui(scrim(0.66));
    ctx.ui(label('أحسنت! عادَ البيت', W / 2, 262, { size: 78, fill: CREAM, weight: 800 }));
    ctx.ui(label('كل قطعةٍ في مكانها الصحيح.', W / 2, 332, { size: 34, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 400, 280, 82, () => { build(); play(); }, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 400, 280, 82, () => ctx.quit(), { size: 36 }));
    ctx.play('impact', 0.55);
  }

  function play() {
    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner('اسحب كل قطعة إلى مكانها', { size: 34, w: 520 }));
  }

  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.62));
    ctx.ui(label('أعِد البناء', W / 2, 236, { size: 88, fill: CREAM, weight: 800 }));
    ctx.ui(label('نفخ الذئبُ فتناثرَ البيت — أعِده كما كان', W / 2, 308, { size: 34, fill: '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 372, 260, 86, () => { build(); play(); }, { size: 40 }));
    ctx.ui(backChip(ctx));
  }

  build();
  intro();
}

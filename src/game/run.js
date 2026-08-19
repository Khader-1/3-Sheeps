// «اهرب إلى بيت أخي» — Run to my brother's house.
//
// The straw house is gone and the smallest brother runs. Tap or press space to
// jump; the wolf closes the gap on every hit. Reach the door and you are safe.
//
// The running is the film's own walk cycle, driven by distance rather than by
// the timeline: limbs are posed from a phase that advances with the ground, so
// the legs stay in step with the speed instead of sliding.

import { svgEl } from '../rig.js';
import { loadScene } from '../anim/stage.js';
import { houseNode } from './house-art.js';
import { loadCharacter, applyExpression, restArms, REST_ARMS } from '../expressions.js';
import { buildLimbChains, limbPivots, stride } from '../anim/gait.js';
import { W, H, CREAM, GREEN, RED, clamp01, rnd, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, band, fitGround } from './ui.js';

export const meta = {
  id: 'run',
  title: 'اهرب!',
  blurb: 'اقفز فوق العوائق وابلغ بيت أخيك قبل الذئب',
  emoji: '🏃',
};

const GROUND = 620;
const SPEED = 340;          // scene units per second
const RUNNER_X = 430;       // where the sheep stays; the world moves instead
const WOLF_X = 60;          // his starting mark
const START_GAP = RUNNER_X - WOLF_X;
/** How long a trip lasts, and how far it drops his speed at the worst moment. */
const STUMBLE_DUR = 0.85;
const STUMBLE_SLOW = 0.32;
/** Three trips and he is down for good. */
const MAX_STUMBLES = 3;
// The painted run: one strip, measured, with the brother's house already in
// it near the right end. Clipped to where the grass actually is — the sky runs
// 48 units further right, and without the clip the last stretch shows a band
// of bare sky under the horizon.
const PANO = { x: 163.6, y: 301.2, w: 1115, h: 148.2 };
const PANO_SCALE = H / PANO.h;
const PANO_W = Math.round(PANO.w * PANO_SCALE);
/** Where بيت_طوب_جاهز, painted in at x=1214, ends up once scaled. */
const HOUSE_X = Math.round((1214 - PANO.x) * PANO_SCALE);
/**
 * Where the run ends.
 *
 * Short enough that the small house painted into the strip at HOUSE_X never
 * scrolls into frame — it is scenery scale, 185 tall against a 210-tall sheep,
 * which reads as a hut on the horizon rather than a door anyone could walk
 * through. The finish is the real house instead, placed below. Also short
 * enough that the right edge of the screen (GOAL + W = 5080) stays inside the
 * painting (5417), so the last frame has ground under it.
 */
const GOAL = 3800;

/** The brother's house at the finish — the artwork, at a size he could enter. */
const HOUSE_H = 430;
const GRAVITY = 2100;
const JUMP_V = 780;
/** The smallest sheep is drawn in a T-pose; his arms need a rest angle. */
const REST_ARMS_SMALL = [REST_ARMS['اليد_ش'], REST_ARMS['اليد_ي']];

export async function start(ctx) {
  const { layers } = ctx;

  // Two copies of the set side by side, recycled as they leave — one scene is
  // 1280 wide, and the run is nearly three screens long.
  const scroll = svgEl('g');
  layers.bg.appendChild(scroll);
  // Pin the running ground to the bottom of the screen, whatever its shape.
  fitGround(layers);
  onViewChange(() => fitGround(layers));
  // One strip, scaled to fill the frame's height and simply slid left. It was
  // four mirrored tiles when the art was a screen-sized plate that had to be
  // repeated; this painting is the whole run, house included, so there is
  // nothing to stitch and no seam to hide.
  const port = svgEl('svg', {
    x: 0, y: view.y, width: PANO_W, height: view.h,
    viewBox: `${PANO.x} ${PANO.y} ${PANO.w} ${PANO.h}`,
    preserveAspectRatio: 'none',
  });
  port.appendChild(await loadScene('طويله بيت'));
  scroll.appendChild(port);

  /** Keep the strip filling the frame when the window shape changes. */
  const fitPort = () => { port.setAttribute('y', view.y); port.setAttribute('height', view.h); };
  fitPort();
  onViewChange(fitPort);

  // The finish, standing on the same ground the runner does. It scrolls with
  // the strip rather than being slid in separately, so it behaves like part of
  // the world instead of a card that arrives.
  // Aligned by its door, so he finishes at the threshold rather than beside
  // the wall.
  scroll.appendChild(await houseNode({
    height: HOUSE_H, bottom: GROUND + 10, doorAt: GOAL + RUNNER_X,
  }));

  const runner = await loadCharacter('small', 'front');
  const runHolder = svgEl('g');
  layers.world.appendChild(runHolder);
  runHolder.appendChild(runner.node);
  applyExpression(runner, 'afraid');
  restArms(runner);
  const limbs = buildLimbChains(runner);
  runner.place({ x: RUNNER_X, y: GROUND, height: 210 });

  const wolf = await loadCharacter('wolf', 'side');
  const wolfHolder = svgEl('g');
  layers.world.appendChild(wolfHolder);
  wolfHolder.appendChild(wolf.node);
  applyExpression(wolf, 'menacing');
  wolf.place({ x: WOLF_X, y: GROUND + 26, height: 300, flip: false });

  // Rocks live in the world layer with the runner, not in the scenery: they
  // are things he hits, not things he runs past.
  const obstacles = svgEl('g');
  layers.world.appendChild(obstacles);

  // ---------------------------------------------------------------- state
  let dist = 0, vy = 0, y = 0, hits = 0, over = false, started = false;
  // `gap` is how much ground the wolf has taken back. He runs at a constant
  // speed; the sheep loses speed when he trips, and the difference is exactly
  // what the wolf gains. So the slowdown is not a penalty bolted on beside the
  // chase — it IS the chase.
  let gap = 0;
  let stumble = 0;
  // Down and staying down. The third trip is not another slowdown — he does
  // not get up, the world stops moving, and the wolf simply walks the last
  // stretch. Letting a player who has fallen three times still outrun the
  // wolf makes the stumbles feel free.
  let downed = false;
  let downT = 0;
  let rocks = [];

  function makeCourse() {
    rocks = [];
    // Deterministic layout: the same course every time, so a child can learn
    // it. Random obstacles at this speed read as unfair.
    // A clear run-up, then roughly one jump every second and a half. The first
    // pass put a rock every 380 units at 340 units/second — three obstacles
    // inside the first five seconds, which ends the game before a child has
    // worked out that tapping jumps.
    let at = 1150;
    let i = 0;
    while (at < GOAL - 520) {
      const h = 44 + (i % 3) * 14;
      rocks.push({ at, w: 60 + (i % 2) * 20, h, hit: false });
      at += 520 + ((i * 137) % 220);
      i++;
    }
    obstacles.replaceChildren();
    for (const r of rocks) {
      const g = svgEl('g', { 'data-at': r.at });
      g.appendChild(svgEl('ellipse', {
        cx: 0, cy: -r.h / 2, rx: r.w / 2, ry: r.h / 2,
        fill: '#8d8d92', stroke: '#3b3b40', 'stroke-width': 5,
      }));
      g.appendChild(svgEl('ellipse', {
        cx: -r.w * 0.12, cy: -r.h * 0.66, rx: r.w * 0.22, ry: r.h * 0.2, fill: '#a9a9ae',
      }));
      obstacles.appendChild(g);
      r.node = g;
    }
  }

  // ---------------------------------------------------------------- input
  const jump = () => {
    if (!started || over) return;
    if (y === 0) { vy = JUMP_V; ctx.play('step-grass', 0.4); }
  };
  const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); } };
  window.addEventListener('keydown', onKey);
  ctx.svg.addEventListener('pointerdown', jump);
  // Removed on teardown by the menu, which destroys the whole context.
  const origDestroy = ctx.destroy.bind(ctx);
  ctx.destroy = () => {
    window.removeEventListener('keydown', onKey);
    ctx.svg.removeEventListener('pointerdown', jump);
    origDestroy();
  };

  // ---------------------------------------------------------------- loop
  const hud = svgEl('g');
  const barW = 420;
  const bar = svgEl('rect', { x: W / 2 - barW / 2, y: 34, width: 0, height: 20, rx: 10, fill: GREEN });
  const pip = svgEl('circle', { cx: W / 2 - barW / 2, cy: 44, r: 13, fill: RED, stroke: '#000', 'stroke-width': 3 });

  function buildHud() {
    // clearUi() detaches the HUD along with everything else, so it has to be
    // re-attached here — populating the detached node left the intro on screen
    // with no HUD at all.
    ctx.clearUi();
    layers.ui.appendChild(hud);
    hud.replaceChildren();
    hud.appendChild(panel(W / 2 - barW / 2 - 10, 24, barW + 20, 40, { rx: 20, opacity: 0.9 }));
    hud.appendChild(bar);
    hud.appendChild(pip);
    hud.appendChild(backChip(ctx));
  }

  function frame(dt) {
    if (over) return;

    if (downed) {
      downT += dt;
      const k = clamp01(downT / 0.4);

      // Fallen on his side, legs out, not getting up.
      runner.pose(limbs.legs[0], { rotate: 62 * k, pivot: limbPivots(runner).legs[0] || [0.5, 0.04] });
      runner.pose(limbs.legs[1], { rotate: -48 * k, pivot: limbPivots(runner).legs[1] || [0.5, 0.04] });
      limbs.arms.forEach((arm, i) => runner.pose(arm, {
        rotate: (REST_ARMS_SMALL[i] || 0) - (i === 0 ? 62 : -62) * k,
        pivot: i === 0 ? [1, 0.4] : [0, 0.4],
      }));
      runHolder.setAttribute('transform',
        `translate(0 ${rnd(k * 26)}) rotate(${rnd(80 * k)} ${RUNNER_X} ${GROUND})`);

      // The world has stopped; only the wolf still moves.
      gap += SPEED * 0.72 * dt;
      const wolfBobDown = stride(wolf, (gap + dist) / 210, { swing: 22, bob: 6 });
      wolfHolder.setAttribute('transform', `translate(${rnd(gap)} ${rnd(wolfBobDown)})`);
      if (gap >= START_GAP - 52) return caught();
      return;
    }

    if (stumble > 0) stumble = Math.max(0, stumble - dt);
    // Speed recovers over the length of the stumble rather than snapping back.
    const slow = stumble > 0
      ? STUMBLE_SLOW + (1 - STUMBLE_SLOW) * (1 - stumble / STUMBLE_DUR)
      : 1;

    dist += SPEED * slow * dt;
    gap += SPEED * (1 - slow) * dt;

    // Ground scroll on the mirrored pattern's true period.
    scroll.setAttribute('transform', `translate(${rnd(-dist)} 0)`);

    // Jump arc.
    if (vy !== 0 || y > 0) {
      vy -= GRAVITY * dt;
      y += vy * dt;
      if (y <= 0) { y = 0; vy = 0; }
    }

    if (stumble > 0) {
      // Trip: pitch forward hard, dip, then come back up. The legs stop
      // cycling and splay, which is what selling a stumble needs — a running
      // cycle with a tilt on top still reads as running.
      const u = 1 - stumble / STUMBLE_DUR;          // 0 at the trip, 1 recovered
      const k = Math.sin(u * Math.PI);              // peak in the middle
      const pitch = k * 30;
      runner.pose(limbs.legs[0], { rotate: 42 * k, pivot: limbPivots(runner).legs[0] || [0.5, 0.04] });
      runner.pose(limbs.legs[1], { rotate: -34 * k, pivot: limbPivots(runner).legs[1] || [0.5, 0.04] });
      limbs.arms.forEach((arm, i) => runner.pose(arm, {
        rotate: (REST_ARMS_SMALL[i] || 0) - (i === 0 ? 46 : -46) * k,
        pivot: i === 0 ? [1, 0.4] : [0, 0.4],
      }));
      runHolder.setAttribute('transform',
        `translate(0 ${rnd(-y + k * 16)}) rotate(${rnd(pitch)} ${RUNNER_X} ${GROUND})`);
    } else {
      const bobY = stride(runner, dist / 170, { swing: 30, bob: 5, armBase: REST_ARMS_SMALL });
      runHolder.setAttribute('transform', `translate(0 ${rnd(-y + (y > 0 ? 0 : bobY))})`);
    }

    // The wolf keeps his pace and closes the gap the sheep gave away.
    const wolfBob = stride(wolf, dist / 210, { swing: 22, bob: 6 });  // his arms already hang
    wolfHolder.setAttribute('transform',
      `translate(${rnd(Math.sin(dist / 260) * 6 + gap)} ${rnd(wolfBob)})`);

    // Obstacles: world x = 300 + (r.at - dist)
    for (const r of rocks) {
      const x = RUNNER_X + (r.at - dist);
      r.node.setAttribute('transform', `translate(${rnd(x)} ${GROUND})`);
      r.node.setAttribute('opacity', x < -120 || x > W + 160 ? 0 : 1);
      if (!r.hit && Math.abs(x - RUNNER_X) < r.w / 2 + 34 && y < r.h * 0.72 && stumble <= 0) {
        r.hit = true;
        hits++;
        ctx.play('step-grass', 0.7);
        flashRed();
        if (hits >= MAX_STUMBLES) {
          downed = true;
          downT = 0;
          applyExpression(runner, 'terrified');
          restArms(runner);
          ctx.play('growl', 0.6);
          ctx.clearUi();
          ctx.ui(banner('سقطتَ! الذئبُ قادم…', { size: 38, w: 520 }));
        } else {
          stumble = STUMBLE_DUR;
          ctx.after(90, () => ctx.play('whoosh', 0.35));
        }
      }
    }

    // Goal house slides in at the end.

    const p = clamp01(dist / GOAL);
    bar.setAttribute('width', rnd(barW * p));
    pip.setAttribute('cx', rnd(W / 2 - barW / 2 + barW * p));

    // Caught when he actually reaches you, not on an arbitrary hit count.
    if (gap >= START_GAP - 34) return lose();
    if (dist >= GOAL) return win();
  }

  function flashRed() {
    const r = svgEl('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: '#c0392b', opacity: 0.32 });
    layers.fx.appendChild(r);
    let t = 0;
    ctx.loop((dt) => { t += dt / 0.3; r.setAttribute('opacity', 0.32 * (1 - clamp01(t))); if (t >= 1) { r.remove(); return false; } });
  }

  let stopLoop = null;

  function lose() {
    over = true; stopLoop?.();
    ctx.play('growl', 0.6);
    ctx.after(260, () => ctx.play('wolf-laugh', 0.75));
    end('أمسكَ بك الذئب!', 'كل عثرة تُبطئك… والذئب لا يتعثر.', false);
  }

  /** Reached him while he was down. */
  function caught() {
    over = true; stopLoop?.();
    ctx.play('growl', 0.7);
    ctx.after(260, () => ctx.play('wolf-laugh', 0.8));
    end('أمسكَ بك الذئب!', 'ثلاثُ عثرات… ولم تستطع النهوض.', false);
  }

  function win() {
    over = true; stopLoop?.();
    ctx.play('impact', 0.55);
    // He was one stride away and lost him.
    ctx.after(340, () => ctx.play('wolf-cry', 0.7));
    applyExpression(runner, 'determined');
    restArms(runner);
    end('وصلت!', 'بيتُ أخيك أنقذك… هذه المرة.', true);
  }

  function end(title, sub, won) {
    ctx.clearUi();
    ctx.ui(scrim(0.7));
    ctx.ui(label(title, W / 2, 250, { size: 86, fill: CREAM, weight: 800 }));
    ctx.ui(label(sub, W / 2, 322, { size: 34, fill: won ? '#ffe9a8' : '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 392, 280, 82, restart, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 392, 280, 82, () => ctx.quit(), { size: 36 }));
  }

  function restart() {
    dist = 0; vy = 0; y = 0; hits = 0; gap = 0; stumble = 0; over = false; started = true;
    downed = false; downT = 0;
    applyExpression(runner, 'afraid'); restArms(runner);
    scroll.setAttribute('transform', 'translate(0 0)');
    makeCourse();
    buildHud();
    stopLoop = ctx.loop(frame);
  }

  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.62));
    ctx.ui(label('اهرب!', W / 2, 226, { size: 92, fill: CREAM, weight: 800 }));
    ctx.ui(label('اضغط في أي مكان — أو مفتاح المسافة — للقفز', W / 2, 300, { size: 34, fill: '#fff', weight: 600 }));
    ctx.ui(label('كل عثرة تُبطئك — وثلاثُ عثرات تُسقطك', W / 2, 358, { size: 29, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 410, 260, 86, restart, { size: 40 }));
    ctx.ui(backChip(ctx));
  }

  makeCourse();
  intro();
}

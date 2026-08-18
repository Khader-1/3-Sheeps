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
import { bboxIn } from '../rig.js';
import { loadCharacter, applyExpression, restArms, REST_ARMS } from '../expressions.js';
import { buildLimbChains, limbPivots } from '../anim/gait.js';
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
const GOAL = 3400;          // distance to the door
const GRAVITY = 2100;
const JUMP_V = 780;
const TAU = Math.PI * 2;
/** The smallest sheep is drawn in a T-pose; his arms need a rest angle. */
const REST_ARMS_SMALL = [REST_ARMS['اليد_ش'], REST_ARMS['اليد_ي']];

// Unique per build: replaying adds fresh defs, and a repeated id would have
// every <use> resolve to the stale copy from the previous round.
let panoUid = 0;

export async function start(ctx) {
  const { layers } = ctx;

  // Two copies of the set side by side, recycled as they leave — one scene is
  // 1280 wide, and the run is nearly three screens long.
  const scroll = svgEl('g');
  layers.bg.appendChild(scroll);
  // Pin the running ground to the bottom of the screen, whatever its shape.
  fitGround(layers);
  onViewChange(() => fitGround(layers));
  // The set is a painted panorama — طويله, one long strip of sky, mountains
  // and field — rather than a screen-sized plate. Measured, its artwork sits
  // at x 275..1231, y 237..489: the sky runs ten units further right than the
  // grass does, so the box stops at the grass and the nested <svg> clips the
  // overhang. Otherwise every join shows a sliver of bare sky under the
  // horizon.
  const PANO = { x: 275, y: 236.8, w: 956, h: 252.6 };
  // Scaled to fill the frame's height, one copy is 2725 wide — over two
  // screens. The run is 3400 long, so the ground never wraps: the tiles are
  // there to cover the distance, not to recycle. The modulo is kept anyway so
  // that raising GOAL cannot silently run off the end of the world.
  const TILE_W = Math.round((PANO.w * H) / PANO.h);

  // Mirroring the odd copies makes each join exact: a mirrored tile's left
  // edge IS its neighbour's right edge, whatever the painting does. Direct
  // butting does not work here — the strip's own two ends differ, the left
  // carrying the sun, house and road that the right does not.
  //
  // Mirroring means the pattern repeats every 2 tiles, not one, which is why
  // the scroll is taken modulo 2*TILE_W.
  //
  // Four tiles, indexed from -1: at the start of the run the offset is zero,
  // and on a wide screen the visible area begins left of the origin. Three
  // tiles starting at zero leave that strip bare for the first frames.
  const TILES = [-1, 0, 1, 2];
  const ports = [];
  const tiles = [];

  // One copy of the artwork, referenced four times. The panorama is 2553
  // paths; four real copies would be ten thousand nodes in the tree before a
  // single sheep is drawn.
  const panoId = `pano-${++panoUid}`;
  const defs = svgEl('defs');
  const panoNode = await loadScene('طويله');
  panoNode.setAttribute('id', panoId);
  defs.appendChild(panoNode);
  scroll.appendChild(defs);

  for (const i of TILES) {
    const g = svgEl('g');
    // preserveAspectRatio="none" so the strip always fills the frame: on a
    // tall screen it stretches rather than letterboxing to bare background.
    const port = svgEl('svg', {
      x: 0, y: view.y, width: TILE_W, height: view.h,
      viewBox: `${PANO.x} ${PANO.y} ${PANO.w} ${PANO.h}`,
      preserveAspectRatio: 'none',
    });
    const inner = svgEl('use', { href: `#${panoId}` });
    inner.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${panoId}`);
    if (Math.abs(i % 2) === 1) {
      inner.setAttribute('transform',
        `translate(${PANO.x * 2 + PANO.w} 0) scale(-1 1)`);
    }
    port.appendChild(inner);
    g.appendChild(port);
    scroll.appendChild(g);
    tiles.push(g);
    ports.push(port);
  }

  /** Keep the strip filling the frame when the window shape changes. */
  const fitPorts = () => {
    for (const p of ports) { p.setAttribute('y', view.y); p.setAttribute('height', view.h); }
  };
  fitPorts();
  onViewChange(fitPorts);

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
  const wolfLimbs = buildLimbChains(wolf);
  wolf.place({ x: WOLF_X, y: GROUND + 26, height: 300, flip: false });

  /**
   * A foreground tree, drawn in the film's flat style, tall enough to cover a
   * tile join from top to bottom.
   *
   * These painted sets were never made to tile: mirroring lines up the pixels
   * at the edge but the mountain silhouettes and the ground band still do not
   * meet, so the join reads as a cut. Rather than repaint the set, every join
   * gets a foreground element standing over it — the oldest trick in
   * side-scrolling, and it adds depth as a bonus.
   */
  function seamTree(x) {
    const g = svgEl('g', { 'data-part': 'seam-tree' });
    const trunkW = 54;
    g.appendChild(svgEl('path', {
      d: `M ${x - trunkW / 2} ${H} L ${x - trunkW / 2 + 6} 250` +
         ` Q ${x} 232 ${x + trunkW / 2 - 6} 250 L ${x + trunkW / 2} ${H} Z`,
      fill: '#8a5a2b', stroke: '#3a230d', 'stroke-width': 6, 'stroke-linejoin': 'round',
    }));
    const blobs = [[0, 190, 132], [-92, 250, 104], [92, 244, 100], [-46, 140, 92], [52, 146, 88]];
    for (const [dx, cy, r] of blobs) {
      g.appendChild(svgEl('circle', {
        cx: x + dx, cy, r, fill: '#3f7f2e', stroke: '#22491a', 'stroke-width': 6,
      }));
    }
    for (const [dx, cy, r] of blobs.slice(0, 3)) {
      g.appendChild(svgEl('circle', {
        cx: x + dx - r * 0.22, cy: cy - r * 0.24, r: r * 0.52, fill: '#4f9a39', opacity: 0.85,
      }));
    }
    return g;
  }

  // One tree per tile boundary, parked in world space and scrolled with it.
  const seams = svgEl('g');
  layers.bg.appendChild(seams);
  const seamNodes = [];
  for (let i = 0; i < TILES.length + 1; i++) {
    const t = seamTree(0);
    seams.appendChild(t);
    seamNodes.push(t);
  }

  const obstacles = svgEl('g');
  layers.world.appendChild(obstacles);

  // The finish line is the brother's wood house. Loading the whole set brings
  // its own sky, ground and palette along with it, which slid over the field
  // as a second background. So the house is measured inside its set and a
  // nested <svg> crops to exactly that box — and it goes in the background
  // layer, behind the runner, where scenery belongs.
  const goalHouse = svgEl('g', { opacity: 0 });
  layers.bg.appendChild(goalHouse);
  {
    const probe = await loadScene('مشهد14');
    layers.bg.appendChild(probe);
    const houseEl = [...probe.querySelectorAll('g[id]')]
      .find((g) => (g.getAttribute('id') || '').includes('بيت_خشب_جاهز'));
    const b = houseEl ? bboxIn(houseEl, ctx.svg) : { x: 700, y: 150, width: 520, height: 470 };
    probe.remove();

    const pad = 30;
    const vb = { x: b.x - pad, y: b.y - pad, w: b.width + pad * 2, h: b.height + pad * 2 };
    const crop = svgEl('svg', {
      x: 0, y: vb.y, width: vb.w, height: vb.h,
      viewBox: `${rnd(vb.x)} ${rnd(vb.y)} ${rnd(vb.w)} ${rnd(vb.h)}`,
    });
    crop.appendChild(await loadScene('مشهد14'));
    goalHouse.appendChild(crop);
    goalHouse.dataset.w = vb.w;
  }

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

  // ---------------------------------------------------------------- pose
  /**
   * Pose a rig's limbs from a stride phase. Same maths as addWalk, per frame.
   *
   * `armBase` is the rest angle of the arms and belongs to the character, not
   * to the animation: the smallest sheep is drawn in a T-pose and needs his
   * arms swung down, the wolf's already hang correctly. Applying the sheep's
   * −54°/+56° to the wolf stuck his arm straight out in front of him.
   *
   * Pivots come from limbPivots(), which measures each joint from where the
   * parts actually overlap. Bounding-box fractions were close enough for the
   * sheep's straight limbs and badly wrong for the wolf's bent ones, which is
   * what detached his legs from his body.
   */
  function stride(rig, lb, phase, swing, bob, armBase = [0, 0]) {
    const cyc = phase * TAU;
    const a = Math.sin(cyc), b = Math.sin(cyc + Math.PI);
    const piv = limbPivots(rig);

    lb.legs.forEach((leg, i) => rig.pose(leg, {
      rotate: (i === 0 ? a : b) * swing, pivot: piv.legs[i] || [0.5, 0.04],
    }));
    lb.mids.forEach((mid, i) => {
      if (!rig.has(mid)) return;
      const s = Math.sin(cyc + (i === 0 ? -1 : 1) * Math.PI / 2);
      rig.pose(mid, {
        rotate: Math.max(0, s) * swing * 0.7, pivot: piv.mids[i] || [0.5, 0.06],
      });
    });
    lb.arms.forEach((arm, i) => {
      const base = armBase[i] || 0;
      rig.pose(arm, {
        rotate: base + (i === 0 ? b : a) * swing * 0.5,
        pivot: base ? (i === 0 ? [1, 0.4] : [0, 0.4]) : (piv.arms[i] || [0.5, 0.05]),
      });
    });
    if (rig.has('الجسم')) rig.pose('الجسم', { rotate: a * 2.4 + 4, pivot: [0.5, 0.9] });
    return -Math.abs(Math.sin(cyc)) * bob + bob * 0.5;
  }

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
      const wolfBobDown = stride(wolf, wolfLimbs, (gap + dist) / 210, 22, 6);
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
    const off = -(dist % (2 * TILE_W));
    for (let i = 0; i < TILES.length; i++) {
      // Spacing must be exactly TILE_W. Overlapping the joins by a unit to
      // hide a hairline would make the tiles span 2*TILE_W-2 while the wrap
      // still happens at 2*TILE_W, so every wrap would shift the world by two
      // units — trading a hairline for a jump. The hairline is dealt with by
      // the nested <svg>'s own clip.
      tiles[i].setAttribute('transform', `translate(${rnd(off + TILES[i] * TILE_W)} 0)`);
    }
    // A tree stands on every join, so the cut is never visible.
    for (let i = 0; i < seamNodes.length; i++) {
      seamNodes[i].setAttribute('transform', `translate(${rnd(off + (i - 1) * TILE_W)} 0)`);
    }

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
      const bobY = stride(runner, limbs, dist / 170, 30, 5, REST_ARMS_SMALL);
      runHolder.setAttribute('transform', `translate(0 ${rnd(-y + (y > 0 ? 0 : bobY))})`);
    }

    // The wolf keeps his pace and closes the gap the sheep gave away.
    const wolfBob = stride(wolf, wolfLimbs, dist / 210, 22, 6);   // his arms already hang
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
    const gx = RUNNER_X + (GOAL - dist);
    if (gx < W + 200) {
      goalHouse.setAttribute('opacity', 1);
      goalHouse.setAttribute('transform', `translate(${rnd(gx - (+goalHouse.dataset.w || 520) / 2)} 0)`);
    }

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
    goalHouse.setAttribute('opacity', 0);
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

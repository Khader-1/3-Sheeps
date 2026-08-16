// «المدخنة» — The chimney, played from inside the flue.
//
// The story's climax as a single decision. The wolf climbs down the chimney;
// the fire is laid at the bottom. Light it while he is low enough and the
// flames reach him. Light it too early and he sees them coming and climbs
// back out; too late and he is already in the room.
//
// The set is مشهد25جزء2 — the interior of the flue, sooty brick with firelight
// from below. Playing inside it means the depth cue is the light: the glow
// grows as he descends, so the decision can be made by watching rather than by
// reading a gauge. The gauge stays as a backstop for younger players.
//
// The fire belongs to the hearth, not to the wolf: it rises from the bottom of
// the shaft, and only what it can reach gets burned.
//
// He is shown from the FRONT, braced with a hand on each wall and both feet
// planted — which is how anyone actually climbs down a shaft, and which the
// artwork happens to be perfect for: the front view is drawn with both arms
// straight out to the sides. His tail is swung down so it hangs below his
// feet, so the flames reach the tail first. That is what the story burns.

import { svgEl, bboxIn } from '../rig.js';
import { loadCharacter, applyExpression } from '../expressions.js';
import { buildLimbChains, limbPivots } from '../anim/gait.js';
import { flames as burnPart, openJaw } from '../book/effects.js';
import { W, H, CREAM, GREEN, RED, INK, clamp01, rnd, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, fitGround, band } from './ui.js';

export const meta = {
  id: 'chimney',
  title: 'المدخنة',
  blurb: 'أشعل النار في اللحظة المناسبة تماماً',
  emoji: '🔥',
};

const TRIES = 3;

// The flue walls, found by scanning the set: dark verticals at x=449 and 884.
// He is fitted to them by measurement rather than by a guessed height — the
// point of the pose is that his hands and feet are ON the walls.
const WALL_L = 449;
const WALL_R = 884;
const SHAFT_CX = (WALL_L + WALL_R) / 2;
const SPAN = (WALL_R - WALL_L) + 16;   // a little past, so he presses into them

// Depth is measured at his FEET, because that is what the flames reach first.
// place() puts his feet at y=0, so translating by depthY(pos) puts them there.
// At depth 0 his legs are just entering the top of the frame and his body is
// still up the flue; at depth 1 they are at the fire.
const TOP_Y = 120;
const BOTTOM_Y = 620;
const FIRE_Y = 706;              // the hearth floor, just off the bottom edge
const FLAME_PEAK = 330;          // how high the flames climb once lit

/**
 * The depths the flames can actually reach.
 *
 * Derived, not guessed: the flames top out at FIRE_Y - FLAME_PEAK = 376, and
 * the swung-down tail hangs about 70 units below his feet — so they touch him
 * once his feet pass roughly depth 0.44, earlier than his feet alone would
 * suggest. The upper bound stops just short of the floor, since a wolf
 * standing in the hearth is already in the room.
 */
const ZONE = [0.44, 0.86];

export async function start(ctx) {
  const { layers } = ctx;
  await ctx.scene('مشهد25جزء2');
  fitGround(layers);
  onViewChange(() => fitGround(layers));

  // ------------------------------------------------------------- the wolf
  const wolf = await loadCharacter('wolf', 'front');
  // wolfHolder carries his depth down the flue; lungeG is a separate wrapper
  // so the final lunge can scale him toward camera without fighting it.
  const lungeG = svgEl('g');
  layers.world.appendChild(lungeG);
  const wolfHolder = svgEl('g', { opacity: 0 });
  lungeG.appendChild(wolfHolder);
  wolfHolder.appendChild(wolf.node);
  applyExpression(wolf, 'menacing');
  const limbs = buildLimbChains(wolf);

  // The tail is the first child in the file, so it draws behind everything —
  // and swinging it down alone still left its tip above his feet, hidden by
  // his legs. Re-parenting it to the end puts it in front, and the extra drop
  // takes it clear of them, so it becomes the lowest part of him. That matters
  // here: the fire has to find the tail, not the feet.
  const tail = wolf.part('الذيل', { optional: true });
  if (tail) wolf.node.appendChild(tail);
  // Rotation alone hangs it down; the drop is only there to clear his feet,
  // and 62 units tore it off his back. Now that the legs brace wide the tail
  // falls between them, so it needs almost none.
  const TAIL_POSE = { rotate: 82, y: 12, pivot: [0.06, 0.1] };
  wolf.pose('الذيل', TAIL_POSE);

  // Splay first: the braced pose is wider than the rest pose, and the fit has
  // to be measured against the pose he will actually hold.
  climbPose(0);

  // Fit to the shaft, in one pass and entirely in the rig's own units.
  //
  // place() scales by height, but what has to match the walls is his arm span.
  // Since page span = local span x (height / local height), the height that
  // gives the wanted span follows directly. Measuring the placed span instead
  // dragged getScreenCTM — and therefore the browser's own scaling — into the
  // arithmetic, and the correction came out backwards.
  wolf.ready();
  const localSpan = (() => {
    const l = wolf.part('اليد').getBBox();
    const r = wolf.part('اليد_2').getBBox();
    return (r.x + r.width) - l.x;
  })();
  const localH = wolf.bbox().height;
  const height = localSpan > 10 ? (SPAN * localH) / localSpan : 400;
  wolf.place({ x: SHAFT_CX, y: 0, height });

  // ------------------------------------------------------------- the fire
  // Laid at the bottom of the shaft and drawn upward, so its height is the
  // reach. Nothing about it is attached to the wolf.
  const fireLayer = svgEl('g');
  layers.fx.appendChild(fireLayer);
  const glow = svgEl('ellipse', {
    cx: 640, cy: FIRE_Y, rx: 430, ry: 96, fill: '#ff7a18', opacity: 0.14,
  });
  layers.world.appendChild(glow);

  /** Flames of a given height, rising from the hearth. */
  function drawFire(height) {
    fireLayer.replaceChildren();
    if (height < 4) return;
    const tongues = [
      { dx: -150, w: 130, s: 0.72, fill: '#c9350f' },
      { dx: 140, w: 140, s: 0.78, fill: '#e2500f' },
      { dx: -40, w: 190, s: 1.0, fill: '#ff7a18' },
      { dx: 55, w: 120, s: 0.62, fill: '#ffb42e' },
      { dx: 0, w: 78, s: 0.4, fill: '#ffe066' },
    ];
    for (const t of tongues) {
      const h = height * t.s;
      const cx = 640 + t.dx;
      fireLayer.appendChild(svgEl('path', {
        d: `M ${cx - t.w / 2} ${FIRE_Y}` +
           ` C ${cx - t.w * 0.62} ${FIRE_Y - h * 0.45}` +
           ` ${cx - t.w * 0.18} ${FIRE_Y - h * 0.6} ${cx} ${FIRE_Y - h}` +
           ` C ${cx + t.w * 0.2} ${FIRE_Y - h * 0.58}` +
           ` ${cx + t.w * 0.66} ${FIRE_Y - h * 0.42} ${cx + t.w / 2} ${FIRE_Y} Z`,
        fill: t.fill,
      }));
    }
    for (let i = 0; i < 7; i++) {
      const f = ((Math.sin(i * 31.7) * 4310.1) % 1 + 1) % 1;
      fireLayer.appendChild(svgEl('circle', {
        cx: 640 + (f - 0.5) * 420, cy: FIRE_Y - height * (0.85 + f * 0.5),
        r: 3 + f * 5, fill: '#ffd23f', opacity: 0.8,
      }));
    }
  }

  // ------------------------------------------------------------- state
  let tries = TRIES;
  let running = false;
  let pos = 0;
  let speed = 0.17;
  let pause = 0;
  let lit = false;
  let fireH = 0;
  let marker = null;
  let stopLoop = null;

  const depthY = (p) => TOP_Y + (BOTTOM_Y - TOP_Y) * p;

  const gaugeX = 86, gaugeY = 130, gaugeH = 430, gaugeW = 32;

  function hud() {
    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner('انتظر… ثم أشعل النار', { size: 34, w: 480 }));

    ctx.ui(svgEl('rect', {
      x: gaugeX, y: gaugeY, width: gaugeW, height: gaugeH, rx: 15,
      fill: '#2a201b', stroke: CREAM, 'stroke-width': 4, opacity: 0.9,
    }));
    ctx.ui(svgEl('rect', {
      x: gaugeX, y: gaugeY + gaugeH * ZONE[0], width: gaugeW,
      height: gaugeH * (ZONE[1] - ZONE[0]), fill: GREEN, opacity: 0.92,
    }));
    marker = ctx.ui(svgEl('rect', {
      x: gaugeX - 9, y: gaugeY, width: gaugeW + 18, height: 11, rx: 5,
      fill: RED, stroke: '#000', 'stroke-width': 3,
    }));

    for (let i = 0; i < TRIES; i++) {
      ctx.ui(svgEl('circle', {
        cx: gaugeX + gaugeW / 2 + (i - 1) * 34, cy: gaugeY + gaugeH + 42, r: 12,
        fill: i < tries ? '#ffd23f' : 'none', stroke: CREAM, 'stroke-width': 4,
      }));
    }

    ctx.ui(button(ctx, '🔥 أشعل النار', W / 2 - 175, band.bottom - 118, 350, 88, ignite,
      { size: 36, fill: '#ffcf8a' }));
  }

  /**
   * One rung of a climb-down, driven by depth so pauses hold their brace.
   *
   * Front-on, the two sides alternate: as one hand takes weight the other
   * slides down, and the legs mirror them. The tail keeps hanging.
   */
  function climbPose(p) {
    const piv = limbPivots(wolf);
    const cyc = p * Math.PI * 2 * 5.5;
    const a = Math.sin(cyc);

    // Hands pressed against the walls, taking turns as he lets himself down.
    // Same sign rule: on a horizontal arm a positive angle lifts the LEFT
    // hand and drops the RIGHT one, so the two sides get opposite signs to
    // alternate rather than move together.
    limbs.arms.forEach((arm, i) => {
      const side = i === 0 ? 1 : -1;              // arms[0] = اليد, the left one
      wolf.pose(arm, {
        rotate: side * (6 + a * 9),
        pivot: piv.arms[i] || (i === 0 ? [1, 0.4] : [0, 0.4]),
      });
    });
    // Feet braced wide, opposite the hands.
    // Feet braced wide on the walls, not crossed under him.
    //
    // The sign matters and is easy to get backwards: rotating a hanging limb
    // by a POSITIVE angle swings its foot to the LEFT, since a point (0, +d)
    // below the pivot maps to (-d·sinθ, +d·cosθ). So the right leg — الرجل,
    // drawn right of the body — needs a negative rotation to reach the right
    // wall. Getting this the wrong way round folded his legs into an X.
    limbs.legs.forEach((leg, i) => {
      const outward = i === 0 ? -1 : 1;          // legs[0] = الرجل, the right one
      wolf.pose(leg, {
        rotate: outward * (46 + a * outward * 10),
        pivot: piv.legs[i] || [0.5, 0.04],
      });
    });
    wolf.pose('الذيل', { ...TAIL_POSE, rotate: TAIL_POSE.rotate + a * 6 });
    if (wolf.has('الجسم')) wolf.pose('الجسم', { rotate: a * 2.2, pivot: [0.5, 0.95] });
    if (wolf.has(wolf.face.head)) {
      wolf.pose(wolf.face.head, { y: Math.abs(a) * 4, pivot: [0.5, 1] });
    }
  }

  function frame(dt) {
    // Embers breathe at the bottom whether or not the fire is lit, and the
    // glow strengthens as he descends — that light is the real depth cue.
    if (!lit) {
      fireH = 26 + Math.sin(performance.now() / 320) * 6;
      drawFire(fireH);
    }
    glow.setAttribute('opacity', rnd(0.14 + pos * 0.3 + (lit ? 0.3 : 0)));
    glow.setAttribute('ry', rnd(92 + fireH * 0.5));

    if (!running) return;
    if (pause > 0) { pause -= dt; return; }

    pos += speed * dt;
    if (pos >= 1) { pos = 1; return arrived(); }

    // He hesitates now and then, listening for the sheep below.
    if (Math.random() < dt * 0.55) {
      pause = 0.25 + Math.random() * 0.5;
      speed = 0.13 + Math.random() * 0.17;
    }

    climbPose(pos);
    wolfHolder.setAttribute('opacity', 1);
    wolfHolder.setAttribute('transform', `translate(0 ${rnd(depthY(pos))})`);
    marker?.setAttribute('y', gaugeY + gaugeH * pos - 5);
  }

  function ignite() {
    if (!running || lit) return;
    lit = true;
    running = false;
    ctx.play('impact', 0.5);

    const inZone = pos >= ZONE[0] && pos <= ZONE[1];

    // The flames rise from the hearth. Whether they reach him is decided by
    // where he is, not by the fire — it always burns the same.
    let t = 0;
    ctx.loop((dt) => {
      t += dt / 0.45;
      fireH = 30 + (1 - (1 - clamp01(t)) ** 2) * FLAME_PEAK;
      drawFire(fireH);
      if (t >= 1) return false;
    });

    ctx.after(430, () => (inZone ? burned() : missed()));
  }

  /** Caught by the flames: his tail lights and he scrambles out. */
  function burned() {
    applyExpression(wolf, 'terrified');
    // Attached to the tail and pointing down, so it starts at the tail, hangs
    // toward the hearth, and sways exactly with it.
    burnPart(wolf, ctx.svg, 'الذيل', { scale: 1.5, attach: true, dir: 'down' });
    ctx.play('growl', 0.65);

    let t = 0;
    const from = pos;
    ctx.loop((dt) => {
      t += dt / 1.15;
      const p = clamp01(t);
      // Straight back up the way he came, kicking.
      climbPose(from + p * 2.6);
      wolfHolder.setAttribute('transform',
        `translate(${rnd(Math.sin(p * 22) * 7)} ${rnd(depthY(from * (1 - p) - p * 0.7))})`);
      if (t >= 1) { win(); return false; }
    });
  }

  /** The flames fell short, or he was already gone. */
  function missed() {
    const early = pos < ZONE[0];
    tries--;

    if (early) {
      // He sees the light coming and climbs back out of reach.
      let t = 0;
      const from = pos;
      ctx.loop((dt) => {
        t += dt / 0.9;
        const p = clamp01(t);
        climbPose(from - p * 1.4);
        wolfHolder.setAttribute('transform', `translate(0 ${rnd(depthY(from * (1 - p) - p * 0.35))})`);
        if (t >= 1) {
          if (tries <= 0) return lose('أفلتَ الذئب', 'أشعلتَها مبكراً في كل مرة — انتظر حتى يقترب.'), false;
          toast('مبكرٌ جداً — رآها وصعد!');
          ctx.after(900, arm);
          return false;
        }
      });
    } else {
      if (tries <= 0) return lose('أفلتَ الذئب', 'تأخرتَ — لا تنتظر حتى يصل.');
      toast('متأخر… كان قد نزل بعيداً!');
      ctx.after(1100, arm);
    }
  }

  /**
   * He reached the bottom without being burned — and comes for the player.
   *
   * The failure state was a caption over a static frame, which is a weak way
   * to lose. Now he lunges at camera: jaws open, face growing until it fills
   * the screen. It is the same information delivered as a moment.
   */
  function arrived() {
    running = false;
    ctx.play('growl', 0.85);
    applyExpression(wolf, 'menacing');
    openJaw(wolf, { angle: 32 });

    const head = wolf.part(wolf.face.head, { optional: true }) || wolf.node;
    const hb = bboxIn(head, ctx.svg);
    const hx = hb.x + hb.width / 2;
    const hy = hb.y + hb.height / 2;
    const CX = W / 2;
    const CY = H * 0.44;

    // Darkens as he closes, so the last frame is mostly wolf.
    const dim = svgEl('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: '#180703', opacity: 0 });
    layers.fx.appendChild(dim);

    let t = 0;
    ctx.loop((dt) => {
      t += dt / 0.72;
      const p = clamp01(t);
      const e = 1 - (1 - p) ** 3;                 // fast at first, settling
      const s = 1 + e * 3.1;
      // Keep his head on the path from where it is to the centre of frame
      // while everything scales up around it.
      const tx = (hx + (CX - hx) * e) - s * hx;
      const ty = (hy + (CY - hy) * e) - s * hy;
      lungeG.setAttribute('transform', `translate(${rnd(tx)} ${rnd(ty)}) scale(${rnd(s)})`);
      dim.setAttribute('opacity', rnd(e * 0.2));
      if (t >= 1) {
        // Hold on his face before the caption. The end screen adds its own
        // scrim, and stacking that on the lunge's dim buried the wolf the
        // player was just shown — so this one goes away first.
        dim.remove();
        ctx.after(280, () => end('أمسكَ بك الذئب!', 'وصلَ إلى البيت قبل أن تُشعل النار.', false));
        return false;
      }
    });
  }

  function toast(text) {
    const g = svgEl('g');
    g.appendChild(panel(W / 2 - 330, 150, 660, 96, { fill: RED, opacity: 0.94 }));
    g.appendChild(label(text, W / 2, 210, { size: 34, fill: '#fff' }));
    layers.ui.appendChild(g);
    ctx.after(1100, () => g.remove());
  }

  const win = () => end('احترقَ ذيلُه!', 'هربَ الذئب ولن يعود… ربما.', true);
  const lose = (t, sub) => end(t, sub, false);

  function end(title, sub, won) {
    running = false;
    // Cancel the driving loop and FORGET it, so arm() knows to start a new one.
    stopLoop?.();
    stopLoop = null;
    ctx.clearUi();
    ctx.ui(scrim(0.55));
    ctx.ui(label(title, W / 2, 248, { size: 84, fill: CREAM, weight: 800 }));
    ctx.ui(label(sub, W / 2, 320, { size: 34, fill: won ? '#ffe9a8' : '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 390, 280, 82, restart, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 390, 280, 82, () => ctx.quit(), { size: 36 }));
  }

  function arm() {
    lungeG.removeAttribute('transform');
    layers.fx.replaceChildren(fireLayer);
    lit = false;
    pos = 0;
    speed = 0.17;
    pause = 0.6;
    fireH = 26;
    fireLayer.replaceChildren();
    wolfHolder.querySelectorAll('[data-part="نار"]').forEach((n) => n.remove());
    applyExpression(wolf, 'menacing');
    wolfHolder.setAttribute('opacity', 1);
    wolfHolder.setAttribute('transform', `translate(0 ${rnd(depthY(0))})`);
    running = true;
    // end() cancelled the loop that moves him. Without this, "مرة أخرى" reset
    // every value correctly and then nothing ever ran again — the wolf simply
    // hung at the top of the flue, which looks exactly like a frozen tab.
    if (!stopLoop) stopLoop = ctx.loop(frame);
    hud();
  }

  function restart() {
    tries = TRIES;
    arm();
  }

  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.6));
    ctx.ui(label('المدخنة', W / 2, 226, { size: 88, fill: CREAM, weight: 800 }));
    ctx.ui(label('الذئب ينزل من المدخنة…', W / 2, 296, { size: 36, fill: '#fff', weight: 600 }));
    ctx.ui(label('أشعل النار حين يصل المنطقة الخضراء — فاللهبُ لا يصل إلا إليها',
      W / 2, 354, { size: 27, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 406, 260, 86, restart, { size: 40 }));
    ctx.ui(backChip(ctx));
  }

  stopLoop = ctx.loop(frame);
  intro();
}

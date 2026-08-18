// «لا تفتح الباب» — Don't open the door.
//
// A voice calls from behind the door. Open it, or refuse. The wolf's takes are
// the real recordings from the film, including the ones where he pretends to
// be harmless — «أنا الذئب الطيب، أشعر بالبرد» — so the child has to listen to
// what is being said, not just to who is loud.
//
// This carries the story's second lesson. The strong house saves you, and so
// does not being talked out of it.

import { svgEl } from '../rig.js';
import { loadCharacter, applyExpression, restArms } from '../expressions.js';
import { openJaw } from '../book/effects.js';
import { WOLF_LINES, SHEEP_LINES, shuffle } from './voices.js';
import { W, H, CREAM, GREEN, RED, clamp01, rnd, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, fitGround, band } from './ui.js';

export const meta = {
  id: 'door',
  title: 'لا تفتح الباب',
  blurb: 'استمع جيداً… من يطرق الباب؟',
  emoji: '🚪',
};

const ROUNDS = 6;

export async function start(ctx) {
  const { layers } = ctx;
  await ctx.scene('مشهد17و18');
  fitGround(layers);
  onViewChange(() => fitGround(layers));

  // The three brothers wait inside; the one who reacts depends on the answer.
  const sheep = {};
  for (const [key, x, h, flip] of [['mid', 300, 250, false], ['big', 520, 280, false], ['small', 1010, 226, true]]) {
    const rig = await loadCharacter(key, 'front');
    layers.world.appendChild(rig.node);
    applyExpression(rig, 'neutral');
    if (key === 'small') restArms(rig);
    rig.place({ x, y: 700, height: h, flip });
    sheep[key] = rig;
  }

  // The wolf waits off-frame and is only revealed when the door is opened.
  const wolf = await loadCharacter('wolf', 'side');
  const wolfHolder = svgEl('g', { opacity: 0 });
  layers.world.appendChild(wolfHolder);
  wolfHolder.appendChild(wolf.node);
  applyExpression(wolf, 'menacing');
  wolf.place({ x: 880, y: 706, height: 360, flip: true });

  let queue = [];
  let round = 0;
  let score = 0;
  let seed = 7;

  function makeQueue() {
    // Alternate-ish so it never becomes "always refuse", which is the failure
    // mode of a game where one answer is always right.
    const wolves = shuffle(WOLF_LINES, seed).slice(0, 3).map((l) => ({ ...l, wolf: true }));
    const sheeps = shuffle(SHEEP_LINES, seed + 11).slice(0, 3).map((l) => ({ ...l, wolf: false }));
    queue = shuffle([...wolves, ...sheeps], seed + 23).slice(0, ROUNDS);
    seed += 101;
  }

  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.66));
    ctx.ui(label('لا تفتح الباب', W / 2, 232, { size: 84, fill: CREAM, weight: 800 }));
    ctx.ui(label('صوتٌ من خلف الباب… هل تفتح؟', W / 2, 302, { size: 36, fill: '#fff', weight: 600 }));
    ctx.ui(label('إن كان أحد إخوتك فافتح، وإن كان الذئب فلا تفتح أبداً.',
      W / 2, 366, { size: 28, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 420, 260, 86, () => { makeQueue(); round = 0; score = 0; ask(); }, { size: 40 }));
    ctx.ui(backChip(ctx));
  }

  function ask() {
    if (round >= queue.length) return result();
    const item = queue[round];
    wolfHolder.setAttribute('opacity', 0);

    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner(`الطرقة ${round + 1} من ${queue.length}`, { size: 30, w: 340 }));

    ctx.play('knock', 0.55);
    ctx.after(320, () => ctx.play('knock', 0.5));
    ctx.after(640, () => ctx.play('knock', 0.45));

    // The knock lands first, then the voice — the order the story uses.
    let handle = null;
    ctx.after(1150, () => { handle = ctx.voice(item.file, { maxSec: item.sec }); });

    // Speech bubble with no attribution: the point is to listen.
    const bub = svgEl('g');
    bub.appendChild(panel(W / 2 - 330, 150, 660, 118, { fill: '#fff' }));
    bub.appendChild(label(item.text, W / 2, 218, { size: 31 }));
    ctx.ui(bub);

    ctx.ui(button(ctx, 'افتح الباب', W / 2 - 330, band.bottom - 150, 300, 88,
      () => answer(item, true, handle), { size: 36, fill: '#ffd8a8' }));
    ctx.ui(button(ctx, 'لا تفتح!', W / 2 + 30, band.bottom - 150, 300, 88,
      () => answer(item, false, handle), { size: 36, fill: '#a8dcff' }));

    ctx.ui(button(ctx, '🔊 أعد', W / 2 - 70, band.bottom - 240, 140, 62, () => {
      handle?.stop();
      handle = ctx.voice(item.file, { maxSec: item.sec });
    }, { size: 26, sound: null }));
  }

  function answer(item, opened, handle) {
    handle?.stop();
    const right = opened !== item.wolf;
    if (right) score++;

    ctx.clearUi();
    ctx.ui(backChip(ctx));

    if (item.wolf && opened) {
      // Worst case: he is in. Show him, jaws open.
      wolfHolder.setAttribute('opacity', 1);
      openJaw(wolf, { angle: 26 });
      ctx.play('growl', 0.6);
      for (const k of ['big', 'mid', 'small']) {
        applyExpression(sheep[k], 'terrified');
        if (k === 'small') restArms(sheep[k]);
      }
    } else {
      for (const k of ['big', 'mid', 'small']) {
        applyExpression(sheep[k], right ? 'determined' : 'worried');
        if (k === 'small') restArms(sheep[k]);
      }
      ctx.play(right ? 'impact' : 'whoosh', 0.4);
    }

    const msg = right
      ? (item.wolf ? 'أحسنت! كان الذئب.' : 'أحسنت! كان أخاك.')
      : (item.wolf ? 'كان الذئب! لا تصدّقه.' : 'كان أخاك… تركته في الخارج.');

    const g = svgEl('g');
    g.appendChild(panel(W / 2 - 340, 60, 680, 104, { fill: right ? GREEN : RED, opacity: 0.94 }));
    g.appendChild(label(msg, W / 2, 126, { size: 36, fill: '#fff' }));
    ctx.ui(g);

    round++;
    ctx.after(1700, () => {
      for (const k of ['big', 'mid', 'small']) {
        applyExpression(sheep[k], 'neutral');
        if (k === 'small') restArms(sheep[k]);
      }
      ask();
    });
  }

  function result() {
    wolfHolder.setAttribute('opacity', 0);
    ctx.clearUi();
    ctx.ui(scrim(0.7));
    const perfect = score === queue.length;
    ctx.ui(label(`${score} / ${queue.length}`, W / 2, 236, { size: 90, fill: CREAM, weight: 800 }));
    ctx.ui(label(perfect ? 'لم يخدعك الذئب أبداً!' : score >= queue.length - 1 ? 'كدتَ تنجو تماماً!' : 'استمع جيداً في المرة القادمة.',
      W / 2, 312, { size: 38, fill: '#fff', weight: 600 }));
    ctx.ui(label('الذئبُ الماكر يغيّر صوته… لكنه لا يغيّر نيّته.',
      W / 2, 380, { size: 30, fill: '#ffe9a8', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 450, 280, 82, () => { makeQueue(); round = 0; score = 0; ask(); }, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 450, 280, 82, () => ctx.quit(), { size: 36 }));
    ctx.play(perfect ? 'impact' : 'growl', 0.5);
    ctx.after(320, () => ctx.play(perfect ? 'wolf-cry' : 'wolf-laugh', 0.7));
  }

  intro();
}

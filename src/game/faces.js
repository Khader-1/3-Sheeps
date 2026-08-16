// «كيف يشعر؟» — How does he feel?
//
// A face appears; pick the feeling. The expression system renders any face on
// demand, so this game costs almost nothing and gives the youngest players an
// emotional-vocabulary exercise in Arabic using the film's own characters.

import { svgEl } from '../rig.js';
import { loadCharacter, applyExpression, restArms } from '../expressions.js';
import { shuffle } from './voices.js';
import { W, H, CREAM, GREEN, RED, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, band, fitGround } from './ui.js';

export const meta = {
  id: 'faces',
  title: 'كيف يشعر؟',
  blurb: 'انظر إلى الوجه واختر الشعور',
  emoji: '😀',
};

// `group` is what stops the game being a vocabulary quiz.
//
// قلِق / خائف / مرعوب / متفاجئ are all one feeling at different strengths to a
// child — surprise included, because on this artwork it is wide eyes and a
// small open mouth, exactly like fright. غاضب / شجاع
// read almost identically on this artwork — a lowered brow and a set jaw. Put
// two of those in front of a child and the question stops being "what is he
// feeling" and becomes "which Arabic word did the author have in mind".
//
// So no two options ever come from the same group. Distinct feelings were
// added alongside (سعيد, حزين, متفاجئ) to keep four choices possible even
// when the answer comes from the largest group.
const FEELINGS = [
  { id: 'neutral', label: 'هادئ', group: 'calm' },
  { id: 'happy', label: 'سعيد', group: 'joy' },
  { id: 'sad', label: 'حزين', group: 'low' },
  { id: 'worried', label: 'قلِق', group: 'fear' },
  { id: 'afraid', label: 'خائف', group: 'fear' },
  { id: 'terrified', label: 'مرعوب', group: 'fear' },
  { id: 'surprised', label: 'متفاجئ', group: 'fear' },
  { id: 'determined', label: 'شجاع', group: 'assert' },
  { id: 'menacing', label: 'غاضب', group: 'assert' },
];

const ROUNDS = 6;

export async function start(ctx) {
  const { layers } = ctx;
  await ctx.scene('مشهد17و18');
  fitGround(layers);
  onViewChange(() => fitGround(layers));
  layers.bg.appendChild(svgEl('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: '#1a0d04', opacity: 0.5 }));

  // One rig per character, reused: the expression is swapped, not the rig.
  const rigs = {};
  const stageG = svgEl('g');
  layers.world.appendChild(stageG);
  for (const key of ['big', 'mid', 'small', 'wolf']) {
    const rig = await loadCharacter(key, key === 'wolf' ? 'side' : 'front');
    const holder = svgEl('svg', { x: W / 2 - 260, y: 96, width: 520, height: 380, viewBox: '0 0 400 400', opacity: 0 });
    holder.appendChild(rig.node);
    stageG.appendChild(holder);
    // Attached before placing: getBBox() on a detached node returns zeros.
    if (key === 'small') restArms(rig);
    rig.place({ x: 200, y: 392, height: 372, flip: key === 'wolf' });
    rigs[key] = { rig, holder };
  }

  let queue = [], round = 0, score = 0, seed = 5;
  let current = null;

  function makeQueue() {
    const pool = [];
    for (const f of FEELINGS) {
      // The wolf owns "angry"; the sheep own the rest.
      const who = f.id === 'menacing' ? ['wolf'] : ['big', 'mid', 'small'];
      for (const k of who) pool.push({ feeling: f, who: k });
    }
    queue = shuffle(pool, seed).slice(0, ROUNDS);
    seed += 37;
  }

  /** Decoys: at most one feeling per group, and never the answer's group. */
  function decoysFor(answer, salt) {
    const byGroup = new Map();
    for (const f of shuffle(FEELINGS, salt)) {
      if (f.group === answer.group) continue;
      if (!byGroup.has(f.group)) byGroup.set(f.group, f);
    }
    return shuffle([...byGroup.values()], salt + 5).slice(0, 3);
  }

  function show(item) {
    for (const k of Object.keys(rigs)) rigs[k].holder.setAttribute('opacity', 0);
    const { rig, holder } = rigs[item.who];
    applyExpression(rig, item.feeling.id);
    if (item.who === 'small') restArms(rig);
    holder.setAttribute('opacity', 1);
  }

  function ask() {
    if (round >= queue.length) return result();
    current = queue[round];
    show(current);

    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner(`كيف يشعر؟  ${round + 1}/${queue.length}`, { size: 32, w: 400 }));

    const opts = shuffle([current.feeling, ...decoysFor(current.feeling, seed + round)],
                         seed + round * 7);

    opts.forEach((f, i) => {
      const bw = 268, bh = 82;
      const x = W / 2 - (bw * 2 + 24) / 2 + (i % 2) * (bw + 24);
      const y = band.bottom - 210 + Math.floor(i / 2) * (bh + 18);
      ctx.ui(button(ctx, f.label, x, y, bw, bh, () => answer(f), { size: 34 }));
    });
  }

  function answer(f) {
    const right = f.id === current.feeling.id;
    if (right) score++;
    ctx.play(right ? 'impact' : 'whoosh', 0.45);

    const g = svgEl('g');
    g.appendChild(panel(W / 2 - 300, 24, 600, 92, { fill: right ? GREEN : RED, opacity: 0.94 }));
    g.appendChild(label(right ? 'صحيح!' : `الصحيح: ${current.feeling.label}`, W / 2, 84, { size: 36, fill: '#fff' }));
    ctx.ui(g);

    round++;
    ctx.after(1200, ask);
  }

  function result() {
    for (const k of Object.keys(rigs)) rigs[k].holder.setAttribute('opacity', 0);
    ctx.clearUi();
    ctx.ui(scrim(0.72));
    ctx.ui(label(`${score} / ${queue.length}`, W / 2, 250, { size: 92, fill: CREAM, weight: 800 }));
    ctx.ui(label(score === queue.length ? 'تعرفُ مشاعرهم جيداً!' : 'أحسنت! جرّب مرة أخرى.',
      W / 2, 326, { size: 38, fill: '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 396, 280, 82, () => { makeQueue(); round = 0; score = 0; ask(); }, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 396, 280, 82, () => ctx.quit(), { size: 36 }));
  }

  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.6));
    ctx.ui(label('كيف يشعر؟', W / 2, 236, { size: 88, fill: CREAM, weight: 800 }));
    ctx.ui(label('انظر إلى الوجه، ثم اختر الشعور المناسب', W / 2, 308, { size: 34, fill: '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 366, 260, 86, () => { makeQueue(); round = 0; score = 0; ask(); }, { size: 40 }));
    ctx.ui(backChip(ctx));
  }

  intro();
}

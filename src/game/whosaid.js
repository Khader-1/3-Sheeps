// «من قال هذا؟» — Who said this?
//
// Play a line from the film and pick the speaker from the four characters.
// Pure listening: no reading required beyond the names, which suits the
// youngest players, and it puts the voice library to work.

import { svgEl } from '../rig.js';
import { loadCharacter, applyExpression, restArms } from '../expressions.js';
import { WOLF_LINES, SHEEP_LINES, shuffle } from './voices.js';
import { W, H, CREAM, GREEN, RED, panel, label, button, scrim, backChip, banner, view, coverView, onViewChange, fitGround } from './ui.js';

export const meta = {
  id: 'whosaid',
  title: 'من قال هذا؟',
  blurb: 'استمع إلى الجملة واختر من قالها',
  emoji: '🎧',
};

const CAST = [
  { key: 'big', view: 'front', name: 'الأكبر' },
  { key: 'mid', view: 'front', name: 'الأوسط' },
  { key: 'small', view: 'front', name: 'الأصغر' },
  { key: 'wolf', view: 'side', name: 'الذئب' },
];
const ROUNDS = 6;

export async function start(ctx) {
  const { layers } = ctx;
  await ctx.scene('خلفيه 1');
  fitGround(layers);
  onViewChange(() => fitGround(layers));
  layers.bg.appendChild(svgEl('rect', { x: view.x, y: view.y, width: view.w, height: view.h, fill: '#0d1a06', opacity: 0.55 }));

  // A portrait card per character: the rig itself, framed in a rounded panel.
  const cards = [];
  for (let i = 0; i < CAST.length; i++) {
    const c = CAST[i];
    const cw = 268, ch = 300;
    const x = W / 2 - (cw * 4 + 3 * 22) / 2 + i * (cw + 22);
    const y = H - ch - 96;

    const g = svgEl('g', { cursor: 'pointer' });
    g.appendChild(panel(x, y, cw, ch, { fill: '#fff6e2', opacity: 0.97 }));

    // Nested <svg> clips the rig to the card without needing a clipPath.
    const port = svgEl('svg', { x: x + 12, y: y + 10, width: cw - 24, height: ch - 74, viewBox: '0 0 300 300' });
    const rig = await loadCharacter(c.key, c.view);
    port.appendChild(rig.node);
    g.appendChild(port);
    g.appendChild(label(c.name, x + cw / 2, y + ch - 22, { size: 32 }));
    layers.ui.appendChild(g);

    // Attach first, THEN place. place() measures with getBBox(), and a
    // detached node measures as zero — which scales the rig to nothing and
    // leaves an empty card.
    applyExpression(rig, c.key === 'wolf' ? 'menacing' : 'neutral');
    if (c.key === 'small') restArms(rig);
    rig.place({ x: 150, y: 292, height: 276, flip: c.key === 'wolf' });
    cards.push({ ...c, node: g, rig, x, y, w: cw, h: ch });
  }
  // The cards live under the UI layer but must survive clearUi(), so they are
  // parked in `world` and only their click handlers are rebound per round.
  const deck = svgEl('g');
  for (const c of cards) deck.appendChild(c.node);
  layers.world.appendChild(deck);

  let queue = [], round = 0, score = 0, seed = 3;

  const makeQueue = () => {
    const all = [
      ...WOLF_LINES.map((l) => ({ ...l, who: 'wolf' })),
      ...SHEEP_LINES,
    ];
    queue = shuffle(all, seed).slice(0, ROUNDS);
    seed += 57;
  };

  function intro() {
    ctx.clearUi();
    ctx.ui(scrim(0.55));
    ctx.ui(label('من قال هذا؟', W / 2, 200, { size: 84, fill: CREAM, weight: 800 }));
    ctx.ui(label('استمع إلى الجملة، ثم اختر من قالها', W / 2, 268, { size: 34, fill: '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'ابدأ', W / 2 - 130, 320, 260, 86, () => { makeQueue(); round = 0; score = 0; ask(); }, { size: 40 }));
    ctx.ui(backChip(ctx));
  }

  let handle = null;
  let locked = true;

  function ask() {
    if (round >= queue.length) return result();
    const item = queue[round];
    ctx.clearUi();
    ctx.ui(backChip(ctx));
    ctx.ui(banner(`${round + 1} / ${queue.length}`, { size: 30, w: 260 }));

    handle?.stop();
    handle = ctx.voice(item.file, { maxSec: item.sec });
    locked = false;

    ctx.ui(button(ctx, '🔊 أعد الاستماع', W / 2 - 160, 156, 320, 70, () => {
      handle?.stop();
      handle = ctx.voice(item.file, { maxSec: item.sec });
    }, { size: 28, sound: null }));

    for (const c of cards) {
      c.node.onclick = () => {
        if (locked) return;
        locked = true;
        handle?.stop();
        answer(item, c);
      };
    }
  }

  function answer(item, picked) {
    const right = picked.key === item.who;
    if (right) score++;
    ctx.play(right ? 'impact' : 'whoosh', 0.45);

    const flash = svgEl('rect', {
      x: picked.x, y: picked.y, width: picked.w, height: picked.h, rx: 22,
      fill: 'none', stroke: right ? GREEN : RED, 'stroke-width': 10,
    });
    layers.fx.appendChild(flash);

    const g = svgEl('g');
    g.appendChild(panel(W / 2 - 360, 60, 720, 104, { fill: right ? GREEN : RED, opacity: 0.94 }));
    g.appendChild(label(right ? 'صحيح!' : `الصحيح: ${CAST.find((c) => c.key === item.who)?.name || '—'}`,
      W / 2, 126, { size: 38, fill: '#fff' }));
    ctx.ui(g);

    round++;
    ctx.after(1500, () => { flash.remove(); ask(); });
  }

  function result() {
    ctx.clearUi();
    ctx.ui(scrim(0.72));
    ctx.ui(label(`${score} / ${queue.length}`, W / 2, 250, { size: 92, fill: CREAM, weight: 800 }));
    ctx.ui(label(score === queue.length ? 'أذنٌ ذهبية!' : 'أحسنت! جرّب مرة أخرى.',
      W / 2, 326, { size: 38, fill: '#fff', weight: 600 }));
    ctx.ui(button(ctx, 'مرة أخرى', W / 2 - 300, 396, 280, 82, () => { makeQueue(); round = 0; score = 0; ask(); }, { size: 36 }));
    ctx.ui(button(ctx, 'القائمة', W / 2 + 20, 396, 280, 82, () => ctx.quit(), { size: 36 }));
  }

  intro();
}

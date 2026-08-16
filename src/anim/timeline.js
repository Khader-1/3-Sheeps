// Deterministic timeline.
//
// Everything is a pure function of time: seek(t) fully rebuilds the scene
// state at t, with no dependence on previous frames. That is what makes
// frame-exact offline rendering possible — the renderer can jump to any frame,
// re-render a range, or change the frame rate without the animation drifting.
//
// A track that has not started yet is still applied at p=0, so seeking
// backwards restores initial state correctly.

export const Ease = {
  linear: (p) => p,
  inQuad: (p) => p * p,
  outQuad: (p) => 1 - (1 - p) ** 2,
  inOutQuad: (p) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2),
  inCubic: (p) => p ** 3,
  outCubic: (p) => 1 - (1 - p) ** 3,
  inOutCubic: (p) => (p < 0.5 ? 4 * p ** 3 : 1 - (-2 * p + 2) ** 3 / 2),
  outQuart: (p) => 1 - (1 - p) ** 4,
  inOutQuart: (p) => (p < 0.5 ? 8 * p ** 4 : 1 - (-2 * p + 2) ** 4 / 2),
  outExpo: (p) => (p >= 1 ? 1 : 1 - 2 ** (-10 * p)),
  inOutSine: (p) => -(Math.cos(Math.PI * p) - 1) / 2,
  /** Gentle overshoot — good for pops and character accents. */
  outBack: (p, s = 1.70158) => 1 + (s + 1) * (p - 1) ** 3 + s * (p - 1) ** 2,
  outElastic: (p) =>
    p === 0 || p === 1 ? p : 2 ** (-10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1,
  /** Settles like a dropped object. */
  outBounce: (p) => {
    const n = 7.5625, d = 2.75;
    if (p < 1 / d) return n * p * p;
    if (p < 2 / d) return n * (p -= 1.5 / d) * p + 0.75;
    if (p < 2.5 / d) return n * (p -= 2.25 / d) * p + 0.9375;
    return n * (p -= 2.625 / d) * p + 0.984375;
  },
};

const resolveEase = (e) => (typeof e === 'function' ? e : Ease[e] || Ease.linear);
export const lerp = (a, b, p) => a + (b - a) * p;
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export class Timeline {
  constructor(label = '') {
    this.label = label;
    this.tracks = [];
    this._duration = 0;
  }

  get duration() {
    return this._duration;
  }

  /** Extend the timeline without adding a track (for holds and tail padding). */
  reserve(t) {
    this._duration = Math.max(this._duration, t);
    return this;
  }

  /**
   * @param {number} start seconds
   * @param {number} dur   seconds; 0 means an instantaneous step at `start`
   * @param {string|function} ease
   * @param {(p:number, t:number)=>void} apply eased progress 0..1
   */
  add(start, dur, ease, apply) {
    this.tracks.push({ start, dur, ease: resolveEase(ease), apply });
    this._duration = Math.max(this._duration, start + dur);
    return this;
  }

  /** Tween a numeric value, or an array of numbers, into a setter. */
  tween(start, dur, ease, from, to, set) {
    if (Array.isArray(from)) {
      return this.add(start, dur, ease, (p) =>
        set(from.map((f, i) => lerp(f, to[i], p)))
      );
    }
    return this.add(start, dur, ease, (p) => set(lerp(from, to, p)));
  }

  /** Run fn once, for all t >= time. Useful for visibility and swaps. */
  step(time, fn) {
    return this.add(time, 0, 'linear', (p, t) => fn(t >= time, t));
  }

  /**
   * Splice another timeline in at `offset`. Sub-timelines let each shot be
   * authored from t=0 and then positioned on the master.
   */
  nest(offset, sub) {
    for (const tr of sub.tracks) {
      this.tracks.push({ ...tr, start: tr.start + offset });
    }
    this._duration = Math.max(this._duration, offset + sub.duration);
    return this;
  }

  /**
   * Author a shot in local time and place it on the master timeline. The
   * shot's root is hidden outside its window so shots never bleed into
   * each other.
   */
  shot(start, dur, root, build) {
    const sub = new Timeline();
    if (build) build(sub, dur);
    this.nest(start, sub);
    this.add(start, dur, 'linear', (p, t) => {
      root.style.display = t >= start - 1e-6 && t < start + dur - 1e-6 ? '' : 'none';
    });
    // A shot's declared length wins even if its contents are shorter.
    this._duration = Math.max(this._duration, start + dur);
    return this;
  }

  /** Apply the full scene state at time t. */
  seek(t) {
    for (const tr of this.tracks) {
      const p = tr.dur > 0 ? clamp01((t - tr.start) / tr.dur) : t >= tr.start ? 1 : 0;
      tr.apply(tr.ease(p), t);
    }
  }
}

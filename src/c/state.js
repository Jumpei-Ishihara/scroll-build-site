/* スクロール位置 → 状態(SPEC-03)。副作用なし。DOM を読まない。
 * ctx = { M: 計測値(measure.js), T: 場面ごとの手順(timeline.js) }
 */
import { clamp, lerp, inv, smooth } from '../core/util.js';
import { ORDER, SUBS, B_OF, POSE_OF } from './timeline.js';

/* スクロール位置 y が、どの場面の固定中か、または移動中かを求める。
 *   pinned: 固定中か / scene: 固定中の場面、移動中は次に来る場面
 *   q[k]: 場面 k の進み具合(0〜1) / cam: ページの表示位置(上端からの距離)
 *   off: これまでに終えた固定の長さの合計。移動中、ページを下にずらす量
 */
export function locate(y, M) {
  const q = M.scenes.map(() => 0);
  let off = 0;
  for (let k = 0; k < M.scenes.length; k++) {
    const sc = M.scenes[k];
    if (y < sc.s0) return { pinned: false, scene: k, q, cam: y - off, off };
    if (y <= sc.s1) { q[k] = inv(sc.s0, sc.s1, y); return { pinned: true, scene: k, q, cam: sc.cam, off }; }
    q[k] = 1; off += sc.hold;
  }
  return { pinned: false, scene: M.scenes.length - 1, q, cam: Math.min(y - off, M.maxCam), off };
}

/* 手順の途中(t)で小人が作業している位置。完成サイト上の座標 */
function point(step, t, M) {
  const r = M.rects[step.target];
  switch (step.action) {
    case 'box':  return { x: r.x + r.w * t, y: r.y + r.h * t };
    case 'type': {
      const n = Math.round(t * M.nchars);
      const c = M.chars[Math.max(0, n - 1)];
      return { x: n ? c.r : c.l, y: c.b };
    }
    case 'text': return { x: r.x + r.w * (0.08 + 0.84 * t), y: r.y + Math.min(r.h, Math.max(r.h * 0.62, 44)) };
    case 'fill': return { x: r.x + r.w * (0.3 + 0.4 * t), y: r.y + r.h * (0.4 + 0.2 * t) };
    default:     return { x: r.x + r.w * (0.25 + 0.5 * t), y: r.y + r.h * 0.5 };
  }
}

/* 場面 k の小人 1 人の状態。位置は画面上の座標 */
function workerAt(list, q, cam, last, M) {
  const P = (s, t) => { const p = point(s, t, M); return { x: p.x, y: p.y - cam }; };
  const first = list[0], end = list[list.length - 1];
  const side = M.vw + 46;                                   // 画面の右の外
  const walk = (A, B, t) => ({ x: lerp(A.x, B.x, smooth(t)), y: lerp(A.y, B.y, smooth(t)), pose: 'walk', t, flip: B.x < A.x });
  let w;
  if (q <= first.a) {                                       // 入ってくる
    const to = P(first, 0);
    w = walk({ x: side, y: to.y }, to, inv(0, first.a, q));
  } else if (q >= end.b) {                                  // 出ていく。最後の場面では残って手を振る(K-06)
    const from = P(end, 1);
    const t = inv(end.b, 1, q);
    w = last ? { ...from, pose: 'wave', t, flip: false } : walk(from, { x: side, y: from.y }, t);
  } else {
    let i = 0;
    for (let j = 0; j < list.length; j++) if (q > list[j].a) i = j;
    const s = list[i];
    if (q <= s.b) { const t = inv(s.a, s.b, q); w = { ...P(s, t), pose: POSE_OF[s.action], t, flip: false, bare: s.action === 'polish' }; }
    else w = walk(P(s, 1), P(list[i + 1], 0), inv(s.b, list[i + 1].a, q));
  }
  return { x: Math.round(w.x * 10) / 10, y: Math.round(w.y * 10) / 10, visible: true, pose: w.pose, t: w.t, flip: !!w.flip, bare: !!w.bare };
}

export function stateAt(p, ctx) {
  const { M, T } = ctx;
  p = clamp(p);
  const y = p * M.maxScroll;
  const loc = locate(y, M);

  const elements = {};
  M.scenes.forEach((sc, k) => {
    const q = loc.q[k];
    for (const key of sc.keys) elements[key] = q >= 1 ? { b: 'final', t: 1 } : { b: 'hidden', t: 0 };
    if (q <= 0 || q >= 1) return;
    for (const s of T[k].steps) {
      if (q <= s.a) continue;
      const t = inv(s.a, s.b, q), e = elements[s.target];
      e.b = B_OF[s.action]; e.t = t;
      if (s.action === 'type') e.chars = Math.round(t * M.nchars);
    }
  });
  const title = elements['hero-title'];
  if (title.chars === undefined) title.chars = title.b === 'hidden' || title.b === 'box' ? 0 : M.nchars;

  const complete = loc.q.every(v => v >= 1);
  const workers = {};
  if (loc.pinned && !complete) {            // 全部組み上がったら小人は引き上げ、フッターの 1 人だけ残る(K-07)
    const k = loc.scene, last = k === M.scenes.length - 1;
    for (const [id, list] of Object.entries(T[k].byWorker)) workers[id] = workerAt(list, loc.q[k], loc.cam, last, M);
  }

  let sub = '';
  if (loc.pinned) {
    const q = loc.q[loc.scene];
    sub = (SUBS.filter(s => q >= s.from).pop() || SUBS[0]).name;
    if (q > SUBS[SUBS.length - 1].to) sub = '完成';
  }
  return {
    p, y, pinned: loc.pinned, scene: loc.scene, q: loc.q, cam: loc.cam, off: loc.off, sub,
    elements, workers, complete,
  };
}

/* 場面 k の進み具合 q に対応するスクロール位置 */
export const scrollOf = (k, q, M) => M.scenes[k].s0 + M.scenes[k].hold * clamp(q);

/* 完成サイト上の高さ Y が見える位置へ移動するときのスクロール位置。その場面が組み上がった状態にする(S-24) */
export function scrollForSiteY(Y, M) {
  for (const sc of M.scenes) if (sc.top + sc.h > Y + 1) return sc.s1;
  return M.maxScroll;
}

export { ORDER };

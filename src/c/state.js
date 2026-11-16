/* スクロール位置 → 状態(SPEC-03、SPEC-04)。副作用なし。DOM を読まない。
 * ctx = { M: 計測値(measure.js), T: 場面ごとの手順(timeline.js) }
 */
import { clamp, lerp, inv, smooth } from '../core/util.js';
import { ORDER, SUBS, B_OF, POSE_OF, CARRY } from './timeline.js';

/* スクロール位置 y が、どの場面の固定中か、または移動中かを求める。
 *   pinned: 固定中か / scene: 固定中の場面、移動中は次に来る場面
 *   q[k]: 場面 k の進み具合(0〜1) / cam: ページの表示位置(上端からの距離)
 *   off: これまでに終えた固定の長さの合計。移動中、ページを下にずらす量
 */
export function locate(y, M) {
  const q = M.scenes.map(() => 0);
  let off = 0, floor = 0;                    // floor: 直前の固定位置。終わりの手前 0.5px でページが上に戻らないようにする
  for (let k = 0; k < M.scenes.length; k++) {
    const sc = M.scenes[k];
    if (y < sc.s0) return { pinned: false, scene: k, q, cam: Math.max(floor, y - off), off };
    // 終わりの手前 0.5px は「組み上がった」とみなす。ページの最下部で、小数の誤差のために完成にならないのを防ぐ
    if (y <= sc.s1 - 0.5) { q[k] = inv(sc.s0, sc.s1, y); return { pinned: true, scene: k, q, cam: sc.cam, off }; }
    q[k] = 1; off += sc.hold; floor = sc.cam;
  }
  return { pinned: false, scene: M.scenes.length - 1, q, cam: Math.min(Math.max(floor, y - off), M.maxCam), off };
}

const r1 = v => Math.round(v * 10) / 10;

/* 運んでいる途中(t: 0〜1)のパーツのずれ。画面の外から置き場所へ(P-02、P-04) */
function carryOffset(part, t) {
  const e = 1 - (1 - t) * (1 - t);                          // 着く手前で減速する
  return { dx: r1(part.dx0 * (1 - e)), dy: r1(-8 * clamp((1 - t) * 6)) };   // 少し持ち上げて運び、最後に下ろす
}

/* 手順 s の途中(u: 0〜1)の小人。位置は完成サイト上の座標 */
function at(s, u, M) {
  if (s.action === 'carry') {
    // 運ぶ手順: パーツの真下で両手で持ち上げて運び(P-03)、置いたら手ぶらで外へ戻る(P-06)
    const p = M.parts[s.part];
    const foot = p.y + p.h + (M.mobile ? 25 : 36);          // 手がパーツの下の辺に届く、足元の高さ
    const cx = p.x + p.w / 2;
    if (u <= CARRY) {
      const t = u / CARRY, o = carryOffset(p, t);
      return { x: cx + o.dx, y: foot + o.dy, pose: 'carry', t, flip: p.dx0 > 0, bare: true };
    }
    const t = inv(CARRY, 1, u), out = p.dx0 < 0 ? -46 : M.vw + 46;
    return { x: lerp(cx, out, smooth(t)), y: foot, pose: 'walk', t, flip: out < cx };
  }
  const r = M.rects[s.target];
  const pos = s.action === 'box' ? { x: r.x + r.w * u, y: r.y + r.h * u }
    : s.action === 'fill' ? { x: r.x + r.w * (0.3 + 0.4 * u), y: r.y + r.h * (0.4 + 0.2 * u) }
    : { x: r.x + r.w * (0.25 + 0.5 * u), y: r.y + r.h * 0.5 };
  return { ...pos, pose: POSE_OF[s.action], t: u, flip: false, bare: s.action === 'polish' };
}

/* 場面 k の小人 1 人の状態。位置は画面上の座標 */
function workerAt(list, q, cam, last, M) {
  const first = list[0], end = list[list.length - 1];
  const side = M.vw + 46;                                   // 画面の右の外
  const walk = (A, B, t) => ({ x: lerp(A.x, B.x, smooth(t)), y: lerp(A.y, B.y, smooth(t)), pose: 'walk', t, flip: B.x < A.x });
  let w;
  if (q <= first.a) {                                       // 入ってくる
    const to = at(first, 0, M);
    w = walk({ x: side, y: to.y }, to, inv(0, first.a, q));
  } else if (q >= end.b) {                                  // 出ていく。最後の場面では残って手を振る(K-06)
    const from = at(end, 1, M);
    const t = inv(end.b, 1, q);
    w = last ? { ...from, pose: 'wave', t, flip: false, bare: false } : walk(from, { x: side, y: from.y }, t);
  } else {
    let i = 0;
    for (let j = 0; j < list.length; j++) if (q > list[j].a) i = j;
    const s = list[i], next = list[i + 1];
    if (q <= s.b) w = at(s, inv(s.a, s.b, q), M);
    else if (s.action === 'carry' && next.action === 'carry') return { x: 0, y: 0, visible: false, pose: 'walk', t: 0, flip: false, bare: false };   // 外で次のパーツを取っている
    else w = walk(at(s, 1, M), at(next, 0, M), inv(s.b, next.a, q));
  }
  return { x: r1(w.x), y: r1(w.y - cam), visible: true, pose: w.pose, t: w.t, flip: !!w.flip, bare: !!w.bare };
}

export function stateAt(p, ctx) {
  const { M, T } = ctx;
  p = clamp(p);
  const y = p * M.maxScroll;
  const loc = locate(y, M);

  // elements: 要素がどこまで組み上がったか。parts: パーツが運ばれたか(wait: まだ外 / carry: 運んでいる / placed: 置いた)
  const elements = {}, parts = {};
  M.scenes.forEach((sc, k) => {
    const q = loc.q[k];
    for (const key of sc.keys) {
      elements[key] = q >= 1 ? { b: 'final', t: 1 } : { b: 'hidden', t: 0 };
      for (const id of M.partsOf[key]) parts[id] = q >= 1 ? { s: 'placed', dx: 0, dy: 0 } : { s: 'wait', dx: M.parts[id].dx0, dy: 0 };
    }
    if (q <= 0 || q >= 1) return;
    for (const s of T[k].steps) {
      if (q <= s.a) continue;
      const t = inv(s.a, s.b, q), e = elements[s.target];
      e.b = B_OF[s.action]; e.t = t;
      if (s.action !== 'carry') continue;
      const c = clamp(t / CARRY);
      parts[s.part] = c >= 1 ? { s: 'placed', dx: 0, dy: 0 } : { s: 'carry', ...carryOffset(M.parts[s.part], c) };
    }
  });

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
    elements, parts, workers, complete,
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

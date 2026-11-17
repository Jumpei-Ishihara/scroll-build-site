/* スクロール位置 → 状態(SPEC-03、SPEC-04)。副作用なし。DOM を読まない。
 * ctx = { M: 計測値(measure.js), T: 場面ごとの手順(timeline.js) }
 */
import { clamp, lerp, inv, smooth } from '../core/util.js';
import { ORDER, SUBS, B_OF, POSE_OF, WALK } from './timeline.js';

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
    // 運ぶ手順: パーツの真下で両手で持ち上げて運ぶ(P-03)。置いたあとは、次の手順へ歩く(P-06)
    const p = M.parts[s.part];
    const foot = p.y + p.h + (M.mobile ? 25 : 36);          // 手がパーツの下の辺に届く、足元の高さ
    const o = carryOffset(p, u);
    return { x: p.x + p.w / 2 + o.dx, y: foot + o.dy, pose: 'carry', t: u, flip: p.dx0 > 0, bare: true };
  }
  const r = M.rects[s.target];
  // 色と仕上げは、要素の中央あたりで小さく動く(広い要素でも速くならないよう、動く幅に上限を置く)
  const span = (len, rate, max) => Math.min(len * rate, max) * (u - 0.5);
  const pos = s.action === 'box' ? { x: r.x + r.w * u, y: r.y + r.h * u }
    : s.action === 'fill' ? { x: r.x + r.w * 0.5 + span(r.w, 0.4, 90), y: r.y + r.h * 0.5 + span(r.h, 0.2, 24) }
    : { x: r.x + r.w * 0.5 - span(r.w, 0.5, 110), y: r.y + r.h * 0.5 };   // 色を塗り終えた側から戻りながら仕上げる
  return { ...pos, pose: POSE_OF[s.action], t: u, flip: false, bare: s.action === 'polish' };
}

/* 場面 k の小人 1 人の状態。位置は画面上の座標 */
function workerAt(list, q, cam, last, M) {
  const first = list[0], end = list[list.length - 1];
  const side = x => x < M.vw / 2 ? -46 : M.vw + 46;         // 近いほうの画面の外。出入りの距離を短くして、歩く速さを抑える
  const walk = (A, B, t) => ({ x: lerp(A.x, B.x, smooth(t)), y: lerp(A.y, B.y, smooth(t)), pose: 'walk', t, flip: B.x < A.x });
  let w;
  if (q <= first.a) {                                       // 入ってくる
    const to = at(first, 0, M);
    w = walk({ x: side(to.x), y: to.y }, to, inv(Math.max(0, first.a - WALK), first.a, q));
  } else if (q >= end.b) {                                  // 出ていく。最後の場面で仕上げをした小人は、残って手を振る(K-06)
    const from = at(end, 1, M);
    w = last && end.action === 'polish' ? { ...from, pose: 'wave', t: inv(end.b, 1, q), flip: false, bare: false }
      : walk(from, { x: side(from.x), y: from.y }, inv(end.b, Math.min(1, end.b + WALK), q));
  } else {
    let i = 0;
    for (let j = 0; j < list.length; j++) if (q > list[j].a) i = j;
    const s = list[i], next = list[i + 1];
    if (q <= s.b) w = at(s, inv(s.a, s.b, q), M);
    else if (next.action === 'carry') {                     // 次のパーツを取りに、近いほうの外へ出る
      const from = at(s, 1, M);
      w = walk(from, { x: side(from.x), y: from.y }, inv(s.b, Math.min(next.a, s.b + WALK), q));
    } else w = walk(at(s, 1, M), at(next, 0, M), inv(s.b, next.a, q));
  }
  return { x: r1(w.x), y: r1(w.y - cam), visible: true, pose: w.pose, t: w.t, flip: !!w.flip, bare: !!w.bare };
}

/* 数直線上の位置 p(0〜1)の状態。場面 k の進み具合 q は p = scrollOf(k, q) / maxScroll */
export function stateAt(p, ctx) {
  const y = clamp(p) * ctx.M.maxScroll;
  return compose({ ...locate(y, ctx.M), y }, ctx);
}

/* loc(どの場面がどこまで進んだか、ページの表示位置)→ 状態 */
export function compose(loc, ctx) {
  const { M, T } = ctx;
  const y = loc.y, p = M.maxScroll > 0 ? clamp(y / M.maxScroll) : 1;

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
      const c = clamp(t);
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
    p, y, pinned: loc.pinned, moving: !!loc.moving, scene: loc.scene, q: loc.q, cam: loc.cam, off: loc.off, sub,
    elements, parts, workers, complete,
  };
}

/* 場面 k の進み具合 q に対応するスクロール位置 */
export const scrollOf = (k, q, M) => M.scenes[k].s0 + M.scenes[k].hold * clamp(q);

/* 完成サイト上の高さ Y を含む場面の番号(A-14) */
export function sceneOfY(Y, M) {
  for (let k = 0; k < M.scenes.length; k++) if (M.scenes[k].top + M.scenes[k].h > Y + 1) return k;
  return M.scenes.length - 1;
}

export { ORDER };

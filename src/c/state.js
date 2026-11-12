/* 進行度 → 状態(SPEC-11 1.2、6.2)。副作用なし。DOM を読まない。
 * ctx = { M: 計測値(measure.js), F: 完成形の色と角丸, T: 手順(timeline.js) }
 */
import { STAGES, stageAt, abs } from '../core/stages.js';
import { clamp, lerp, inv, smooth, easeInOut } from '../core/util.js';
import { ORDER, B_OF, PRESS, COMMENT } from './timeline.js';

/* build.css の値と一致させること(C-03) */
const WF = '#DAD7CF', WF2 = '#E6E3DB', INK = '#16150F', WIRE_RADIUS = 3;
const ENTER = 0.035;          // カーソルが入室にかける進行度の幅
const PUB_FROM = STAGES[5].from;

/* 手順の途中(t)でカーソルが指す位置。完成サイト上の座標 */
function point(step, t, M) {
  const r = M.rects[step.target];
  switch (step.action) {
    case 'box':    return { x: r.x + r.w * t, y: r.y + r.h * t };
    case 'type': {
      const n = Math.round(t * M.nchars);
      const c = M.chars[Math.max(0, n - 1)];
      return { x: n ? c.r : c.l, y: c.b };
    }
    case 'text':   return { x: r.x + r.w * t, y: r.y + r.h * 0.6 };
    case 'fill':   return { x: r.x + r.w * (0.3 + 0.4 * t), y: r.y + r.h * (0.35 + 0.3 * t) };
    default:       return { x: r.x + r.w, y: r.y + r.h * 0.3 * t };
  }
}

/* カメラ: いま作業している高さ(完成サイト上の Y)。各手順の中間点を結んで求める */
function cameraY(p, ctx) {
  const ks = ctx.T.cam;
  if (p <= ks[0].p) return ks[0].y(ctx.M);
  for (let i = 1; i < ks.length; i++) {
    if (p <= ks[i].p) return lerp(ks[i - 1].y(ctx.M), ks[i].y(ctx.M), smooth(inv(ks[i - 1].p, ks[i].p, p)));
  }
  return ks[ks.length - 1].y(ctx.M);
}

function frameAt(p, e5, M, ctx) {
  const c = cameraY(Math.min(p, PUB_FROM), ctx);
  const maxY = M.topPad;
  const minY = Math.min(maxY, M.vh - 72 - M.siteH * M.ws);
  const y0 = clamp(M.bar + (M.vh - M.bar) * 0.44 - c * M.ws, minY, maxY);
  return { s: lerp(M.ws, 1, e5), x: lerp(M.x0, 0, e5), y: lerp(y0, 0, e5) };
}

function cursorAt(id, p, f, f0, ctx) {
  const { M, T } = ctx;
  const list = T.byCursor[id];
  const vp = q => ({ x: f.x + q.x * f.s, y: f.y + q.y * f.s });
  /* 手順 s の t 時点の位置(画面上の座標)。公開だけは画面上のボタンが目標 */
  const at = (s, t, i) => {
    if (s.action !== 'publish') return vp(point(s, t, M));
    const from = i > 0 ? { x: f0.x + point(list[i - 1], 1, M).x * f0.s, y: f0.y + point(list[i - 1], 1, M).y * f0.s } : M.pub;
    const k = smooth(t);
    return { x: lerp(from.x, M.pub.x, k), y: lerp(from.y, M.pub.y, k) };
  };
  let i = -1;
  for (let j = 0; j < list.length; j++) if (p > list[j].a) i = j;
  let pos, step = null, t = 0, visible = true;
  if (i < 0) {
    const first = list[0];
    const start = id === 'a' ? 0.01 : first.a - ENTER;
    visible = p >= start;
    const to = at(first, 0, 0);
    const k = smooth(inv(start, first.a, p));
    pos = { x: lerp(M.vw + 40, to.x, k), y: lerp(to.y - 90, to.y, k) };
  } else {
    const s = list[i];
    if (p <= s.b) { step = s; t = inv(s.a, s.b, p); pos = at(s, t, i); }
    else if (list[i + 1]) {
      const n = list[i + 1], k = smooth(inv(s.b, n.a, p));
      const A = at(s, 1, i), B = at(n, 0, i + 1);
      pos = { x: lerp(A.x, B.x, k), y: lerp(A.y, B.y, k) };
    } else pos = at(s, 1, i);
  }
  const pressed = id === 'a' && p > abs(5, PRESS);
  return {
    x: Math.round(pos.x * 10) / 10, y: Math.round(pos.y * 10) / 10, visible,
    target: step ? step.target : null,
    kobito: pressed ? 'wave' : (step && step.kobito) || 'hang',
    t: pressed ? inv(abs(5, PRESS), 1, p) : t,
  };
}

export function stateAt(p, ctx) {
  const { M, F, T } = ctx;
  p = clamp(p);
  const { stage, local } = stageAt(p);

  const elements = {};
  for (const k of ORDER) elements[k] = { b: 'hidden', t: 0 };
  let active = null, last = null;
  for (const s of T.steps) {
    if (s.action === 'publish' || p <= s.a) continue;
    const t = inv(s.a, s.b, p);
    const e = elements[s.target];
    e.b = B_OF[s.action]; e.t = t;
    if (s.action === 'type') e.chars = Math.round(t * M.nchars);
    last = s;
    if (p < s.b) active = s;
  }
  const layers = ORDER.filter(k => elements[k].b !== 'hidden');
  const selected = stage === 5 ? null : (active || last || {}).target || null;

  let props = null;
  if (selected) {
    const e = elements[selected], r = M.rects[selected], fin = F[selected];
    const k = e.b === 'box' ? e.t : 1;
    props = {
      key: selected, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w * k), h: Math.round(r.h * k),
      fill: e.b === 'box' ? WF : e.b === 'text' ? (fin.surface ? WF2 : INK) : fin.fill,
      radius: e.b === 'final' ? fin.radius : WIRE_RADIUS,
    };
  }

  const pressed = stage === 5 && local > PRESS;
  const e5 = stage === 5 ? easeInOut(inv(PRESS, 1, local)) : 0;
  const frame = p >= 1 ? { s: 1, x: 0, y: 0 } : frameAt(p, e5, M, ctx);
  const f0 = e5 ? frameAt(p, 0, M, ctx) : frame;      // 公開で広がり始める前の枠

  const cursors = {};
  for (const id of T.ids) cursors[id] = cursorAt(id, p, frame, f0, ctx);

  let comment = null;
  if (stage === COMMENT.stage && local >= COMMENT.from) comment = { key: COMMENT.key, resolved: local >= COMMENT.to };

  return { p, stage, local, elements, layers, selected, props, frame, cursors, comment, pressed, toolVisible: p >= 1 ? 0 : 1 - e5 };
}

/* カメラの通過点を作る。手順の中間の進行度と、その対象の中心の高さ */
export function buildCamera(T) {
  const ks = T.steps.filter(s => s.action !== 'publish').map(s => ({
    p: (s.a + s.b) / 2,
    y: M => M.rects[s.target].y + M.rects[s.target].h / 2,
  }));
  ks.sort((a, b) => a.p - b.p);
  return ks;
}

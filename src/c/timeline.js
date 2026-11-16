/* 場面と手順のデータ(SPEC-03 3 章、SPEC-04 3 章) */

/* 場面: 1 回の固定で組み立てる範囲。keys は index.html の data-key */
export const SCENES = [
  { id: 'hero',     name: 'ヒーロー',     keys: ['header', 'hero-title', 'hero-lead', 'hero-btns'] },
  { id: 'features', name: 'できること',   keys: ['card-1', 'card-2', 'card-3'] },
  { id: 'works-1',  name: '実績',         keys: ['works-title', 'work-1', 'work-2'] },
  { id: 'works-2',  name: '実績(つづき)', keys: ['work-3', 'work-4'] },
  { id: 'contact',  name: '問い合わせ',   keys: ['contact', 'footer'] },
];
export const ORDER = SCENES.flatMap(s => s.keys);

/* 工程: 場面の中の 4 つの作業。from / to は場面内の進み具合(0〜1) */
export const SUBS = [
  { id: 'box',    name: '骨組み',       action: 'box',    from: 0.08, to: 0.22 },
  { id: 'carry',  name: '文字とパーツ', action: 'carry',  from: 0.24, to: 0.76 },
  { id: 'fill',   name: '色',           action: 'fill',   from: 0.78, to: 0.89 },
  { id: 'polish', name: '仕上げ',       action: 'polish', from: 0.90, to: 0.96 },
];
/* 1 場面の組み立てにかける時間と、場面の間の移動にかける時間(ミリ秒)。SPEC-05 A-02 */
export const BUILD_MS = 3200;
export const MOVE_MS = 700;
/* 進み具合を 1 本の数直線(0〜1)で表すときの、場面 1 つ分の長さ(画面の高さの何倍か)。
 * 実際のスクロール量ではなく、状態の計算とテストで使う目盛り */
export const HOLD = 1;
/* 運ぶ手順のうち、パーツを運んでいる割合。残りは手ぶらで外へ戻る(P-06) */
export const CARRY = 0.78;

/* 手順の種類 → その手順が終わったあとの要素の状態 */
export const B_OF = { box: 'box', carry: 'text', fill: 'color', polish: 'final' };
/* 手順の種類 → 小人の動作 */
export const POSE_OF = { box: 'pull', carry: 'carry', fill: 'put', polish: 'put' };

export const WORKERS = { a: 'var(--cursor-a)', b: 'var(--cursor-b)', c: 'var(--cursor-c)' };

/* items({ target, part })を from〜to の間に等間隔で並べる。同じ小人の手順が重ならない長さにする */
function spread(action, items, ids, from, to) {
  const d = (to - from) / items.length;
  const dur = Math.min(d * Math.min(ids.length, items.length) * 0.9, to - from);
  return items.map((it, i) => ({ action, ...it, worker: ids[i % ids.length], a: from + d * i, b: Math.min(to, from + d * i + dur) }));
}

/* 場面ごとの手順を作る。ids: 使う小人(デスクトップは 3 人、スマホは 2 人)。partsOf: 要素ごとのパーツ(measure.js) */
export function buildTimeline(ids, partsOf) {
  return SCENES.map(scene => {
    let steps = [];
    for (const sub of SUBS) {
      // 運ぶ工程はパーツ 1 つが 1 手順。ほかの工程は要素 1 つが 1 手順
      const items = sub.id === 'carry'
        ? scene.keys.flatMap(key => partsOf[key].map(part => ({ target: key, part })))
        : scene.keys.map(key => ({ target: key }));
      steps.push(...spread(sub.action, items, ids, sub.from, sub.to));
    }
    steps = steps.map((s, i) => ({ ...s, id: i })).sort((x, y) => x.a - y.a || x.id - y.id);
    const byWorker = {};
    for (const id of ids) { const l = steps.filter(s => s.worker === id); if (l.length) byWorker[id] = l; }
    return { steps, byWorker };
  });
}

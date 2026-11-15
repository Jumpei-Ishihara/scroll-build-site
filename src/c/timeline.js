/* 場面と手順のデータ(SPEC-03 3 章) */

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
  { id: 'box',    name: '骨組み',   action: 'box',    from: 0.04, to: 0.26 },
  { id: 'text',   name: '文字',     action: 'text',   from: 0.28, to: 0.52 },
  { id: 'fill',   name: '色と画像', action: 'fill',   from: 0.54, to: 0.76 },
  { id: 'polish', name: '仕上げ',   action: 'polish', from: 0.78, to: 0.92 },
];
/* 固定の長さ(画面の高さの何倍か)。S-03 */
export const HOLD = 1.4;

/* 手順の種類 → その手順が終わったあとの要素の状態 */
export const B_OF = { box: 'box', type: 'text', text: 'text', fill: 'color', polish: 'final' };
/* 手順の種類 → 小人の動作 */
export const POSE_OF = { box: 'pull', type: 'carry', text: 'carry', fill: 'put', polish: 'put' };

export const WORKERS = { a: 'var(--cursor-a)', b: 'var(--cursor-b)', c: 'var(--cursor-c)' };

/* keys を from〜to の間に等間隔で並べる。同じ小人の手順が重ならない長さにする */
function spread(action, keys, ids, from, to) {
  const d = (to - from) / keys.length;
  const dur = Math.min(d * Math.min(ids.length, keys.length) * 0.9, to - from);
  return keys.map((key, i) => ({ action, target: key, worker: ids[i % ids.length], a: from + d * i, b: Math.min(to, from + d * i + dur) }));
}

/* 場面ごとの手順を作る。ids: 使う小人(デスクトップは 3 人、スマホは 2 人) */
export function buildTimeline(ids = ['a', 'b', 'c']) {
  return SCENES.map(scene => {
    let steps = [];
    for (const sub of SUBS) {
      if (sub.id === 'text' && scene.keys.includes('hero-title')) {
        // 見出しは 1 人が 1 文字ずつ運ぶ。ほかの要素は残りの小人が担当する
        const rest = scene.keys.filter(k => k !== 'hero-title');
        steps.push({ action: 'type', target: 'hero-title', worker: ids[0], a: sub.from, b: sub.to });
        steps.push(...spread('text', rest, ids.slice(1), sub.from, sub.to));
      } else steps.push(...spread(sub.action, scene.keys, ids, sub.from, sub.to));
    }
    steps = steps.map((s, i) => ({ ...s, id: i })).sort((x, y) => x.a - y.a || x.id - y.id);
    const byWorker = {};
    for (const id of ids) { const l = steps.filter(s => s.worker === id); if (l.length) byWorker[id] = l; }
    return { steps, byWorker };
  });
}

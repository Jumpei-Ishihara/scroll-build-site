import { abs } from '../core/stages.js';

/* 組み立てる要素(index.html の data-key)。上から順 */
export const ORDER = [
  'header', 'hero-title', 'hero-lead', 'hero-btns',
  'card-1', 'card-2', 'card-3',
  'works-title', 'work-1', 'work-2', 'work-3', 'work-4',
  'contact', 'footer',
];

/* レイヤーパネルの表示名。in: 字下げする */
export const LABELS = {
  'header': ['ヘッダー'], 'hero-title': ['見出し'], 'hero-lead': ['説明文', 1], 'hero-btns': ['ボタン', 1],
  'card-1': ['カード 1'], 'card-2': ['カード 2'], 'card-3': ['カード 3'],
  'works-title': ['実績の見出し'], 'work-1': ['実績 1', 1], 'work-2': ['実績 2', 1], 'work-3': ['実績 3', 1], 'work-4': ['実績 4', 1],
  'contact': ['問い合わせ'], 'footer': ['フッター'],
};

/* 手順の種類 → その手順が終わったあとの要素の状態 */
export const B_OF = { box: 'box', type: 'text', text: 'text', fill: 'color', polish: 'final' };

export const CURSORS = {
  a: { name: 'ハル',   color: 'var(--cursor-a)' },
  b: { name: 'ミナト', color: 'var(--cursor-b)' },
  c: { name: 'ソラ',   color: 'var(--cursor-c)' },
};

/* 公開の手順のうち、ボタンを押すまでの割合(段階 5 の中で) */
export const PRESS = 0.35;
/* コメントピン(段階 4 の中で、付く位置と解決される位置) */
export const COMMENT = { stage: 4, key: 'hero-btns', from: 0.18, to: 0.62 };

/* 小人が直接作業する見せ場(C-21): 段階 1・2・3・5 に 1 か所ずつ */
const SPOTS = { '1:hero-title': 'pull', '2:hero-title': 'carry', '3:work-4': 'put', '5:@publish': 'put' };

/* keys を段階の中に等間隔で並べる。同じカーソルの手順が重ならない長さにする */
function spread(stage, action, keys, cursors, from = 0, to = 0.88) {
  const d = (to - from) / keys.length;
  const dur = d * cursors.length * 0.86;
  return keys.map((key, i) => ({
    stage, action, target: key, cursor: cursors[i % cursors.length],
    from: from + d * i, to: Math.min(1, from + d * i + dur),
  }));
}

/* 手順の一覧を作る。ids: 使うカーソル(デスクトップは 3 人、スマホは 2 人) */
export function buildTimeline(ids = ['a', 'b', 'c']) {
  const rest = ORDER.filter(k => k !== 'hero-title');
  const others = ids.filter(c => c !== 'a');
  const steps = [
    ...spread(1, 'box', ORDER, ids),
    // 段階 2: ハルが見出しを 1 文字ずつ打つ。ほかの要素は残りのカーソルが文字に置き換える
    { stage: 2, action: 'type', target: 'hero-title', cursor: 'a', from: 0.06, to: 0.6 },
    ...spread(2, 'text', rest, others, 0.04, 0.96),
    ...spread(3, 'fill', ORDER, ids),
    ...spread(4, 'polish', ORDER, ids),
    { stage: 5, action: 'publish', target: '@publish', cursor: 'a', from: 0, to: PRESS },
  ].map((s, i) => ({
    ...s, id: i,
    a: abs(s.stage, s.from), b: abs(s.stage, s.to),
    kobito: SPOTS[s.stage + ':' + s.target] || null,
  })).sort((x, y) => x.a - y.a || x.id - y.id);

  const byCursor = {};
  for (const id of ids) byCursor[id] = steps.filter(s => s.cursor === id);
  return { steps, byCursor, ids };
}

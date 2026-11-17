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
  { id: 'box',    name: '骨組み',       action: 'box',    from: 0.08, to: 0.29 },
  { id: 'carry',  name: '文字とパーツ', action: 'carry',  from: 0.30, to: 0.76 },
  { id: 'fill',   name: '色',           action: 'fill',   from: 0.78, to: 0.86 },
  { id: 'polish', name: '仕上げ',       action: 'polish', from: 0.86, to: 0.90 },
];
/* 1 場面の組み立てにかける時間と、場面の間の移動にかける時間(ミリ秒)。SPEC-05 A-02 */
export const BUILD_MS = 3200;
export const MOVE_MS = 700;
/* 進み具合を 1 本の数直線(0〜1)で表すときの、場面 1 つ分の長さ(画面の高さの何倍か)。
 * 実際のスクロール量ではなく、状態の計算とテストで使う目盛り */
export const HOLD = 1;
/* 小人が場面に入るとき、出ていくときにかける長さの上限(場面内の進み具合) */
export const WALK = 0.2;

/* 手順の種類 → その手順が終わったあとの要素の状態 */
export const B_OF = { box: 'box', carry: 'text', fill: 'color', polish: 'final' };
/* 手順の種類 → 小人の動作 */
export const POSE_OF = { box: 'pull', carry: 'carry', fill: 'put', polish: 'put' };

/* 小人とヘルメットの色。先頭から CREW の人数だけ使う */
export const WORKERS = {
  a: 'var(--cursor-a)', b: 'var(--cursor-b)', c: 'var(--cursor-c)', d: 'var(--cursor-d)',
  e: 'var(--cursor-e)', f: 'var(--cursor-f)', g: 'var(--cursor-g)', h: 'var(--cursor-h)',
  i: 'var(--cursor-i)', j: 'var(--cursor-j)',
};
/* 小人の人数。1 場面の時間は変えずに、人数を増やすほど 1 人の動きがゆっくりになる(SPEC-06) */
export const CREW = { desktop: 8, mobile: 8 };
export const crewIds = n => Object.keys(WORKERS).slice(0, Math.max(1, Math.min(Object.keys(WORKERS).length, n)));

/* 手順をずらして始める間隔(1 手順の長さに対する割合)と、同じ小人が続けて作業するときに作業へ使う割合(残りは次へ歩く時間) */
const STAGGER = { box: 0.15, carry: 0.1, fill: 0.15, polish: 0.15 };
const USE = { box: 0.8, carry: 0.7, fill: 0.85, polish: 0.85 };

/* items({ target, part })を from〜to に並べる。小人 1 人が 1 列を受け持ち、列ごとに少しずつずらして始める。
 * 人数が手順の数以上なら全員が 1 回ずつで済み、1 手順に工程の時間のほとんどを使える(SPEC-06 C-02) */
function schedule(action, items, workers, from, to) {
  const lanes = Math.min(workers.length, items.length), rounds = Math.ceil(items.length / lanes);
  const slot = (to - from) / (rounds + (lanes - 1) * STAGGER[action]);
  const dur = slot * (rounds > 1 ? USE[action] : 1);
  return items.map((it, i) => {
    const lane = i % lanes, a = from + lane * STAGGER[action] * slot + Math.floor(i / lanes) * slot;
    return { action, ...it, worker: workers[lane], a, b: a + dur };
  });
}

/* 場面ごとの手順を作る。ids: 使う小人(crewIds)。partsOf: 要素ごとのパーツ(measure.js)
 * 受け持ち(C-03): 骨組みは先頭の小人から。運ぶのは骨組みを作らなかった小人から。色と仕上げは、その要素のパーツを最初に運んだ小人 */
export function buildTimeline(ids, partsOf) {
  return SCENES.map(scene => {
    const K = scene.keys.length;
    const carriers = ids.map((_, i) => ids[(i + K) % ids.length]);
    const sub = id => SUBS.find(x => x.id === id);
    const run = (id, items, workers) => schedule(sub(id).action, items, workers, sub(id).from, sub(id).to);
    const box = run('box', scene.keys.map(key => ({ target: key })), ids);
    const carry = run('carry', scene.keys.flatMap(key => partsOf[key].map(part => ({ target: key, part }))), carriers);
    // 色と仕上げ: その要素のパーツを最初に運んだ小人(置いた場所から、時間をかけて歩いて移れる)。重なるときは手の空いている小人
    const painters = [], n = Math.min(ids.length, K);
    for (const key of scene.keys.slice(0, n)) {
      const here = carry.filter(c => c.target === key).map(c => c.worker);
      painters.push([...here, ...carriers].find(w => !painters.includes(w)));
    }
    const fill = run('fill', scene.keys.map(key => ({ target: key })), painters);
    const polish = run('polish', scene.keys.map(key => ({ target: key })), painters);
    const steps = [...box, ...carry, ...fill, ...polish].map((x, i) => ({ ...x, id: i })).sort((x, y) => x.a - y.a || x.id - y.id);
    const byWorker = {};
    for (const id of ids) { const l = steps.filter(x => x.worker === id); if (l.length) byWorker[id] = l; }
    return { steps, byWorker };
  });
}

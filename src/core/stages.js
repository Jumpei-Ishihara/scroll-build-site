import { inv } from './util.js';

/* 段階の定義(SPEC-01 3 章)。境界の値はここだけに書く */
export const STAGES = [
  { id: 0, name: '空のキャンバス', from: 0.00, to: 0.08 },
  { id: 1, name: '骨組み',         from: 0.08, to: 0.28 },
  { id: 2, name: '文字',           from: 0.28, to: 0.48 },
  { id: 3, name: '色と画像',       from: 0.48, to: 0.68 },
  { id: 4, name: '仕上げ',         from: 0.68, to: 0.85 },
  { id: 5, name: '公開',           from: 0.85, to: 1.00 },
];

/* 進行度 → 段階番号と、段階内の進み具合(0〜1) */
export function stageAt(p) {
  let s = STAGES[STAGES.length - 1];
  for (const x of STAGES) { if (p < x.to) { s = x; break; } }
  return { stage: s.id, local: inv(s.from, s.to, p) };
}

/* 段階内の位置 → 全体の進行度 */
export const abs = (stage, local) => STAGES[stage].from + (STAGES[stage].to - STAGES[stage].from) * local;

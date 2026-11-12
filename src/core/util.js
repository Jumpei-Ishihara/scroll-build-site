export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
/* v が a→b のどこにあるか(0〜1)。範囲外は切り詰める */
export const inv = (a, b, v) => (b === a ? (v >= b ? 1 : 0) : clamp((v - a) / (b - a)));
export const smooth = t => t * t * (3 - 2 * t);
export const easeInOut = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

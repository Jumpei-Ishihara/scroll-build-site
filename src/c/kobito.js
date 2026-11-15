/* 小人(SPEC-03 K-01〜K-08)
 * 1 人 = 1 つのインライン SVG。動作ごとのコマを <g data-pose="動作-番号"> で持ち、1 つだけ表示する。
 * 動作: walk(歩く)/ pull(引っ張る)/ carry(運ぶ)/ put(置く)/ wave(手を振る)
 */
const HEAD = '<circle class="face" cx="20" cy="16" r="6"/><path class="helmet" d="M13 15a7 7 0 0 1 14 0z"/>' +
  '<circle class="eye" cx="18" cy="17.6" r=".9"/><circle class="eye" cx="22" cy="17.6" r=".9"/>';
const st = d => `<path class="st" d="${d}"/>`;

const POSES = {
  'walk-0':  st('M20 24l-4 7M20 24l5 5') + st('M20 22v10M20 32l-5 9M20 32l4 10') + HEAD,
  'walk-1':  st('M20 24l-2 8M20 24l3 7') + st('M20 22v10M20 32l-1 10M20 32l6 8') + HEAD,
  'pull-0':  st('M20 24L7 14M20 25L9 18') + st('M20 22l3 10M23 32l-6 10M23 32l5 9') + HEAD,
  'pull-1':  st('M20 24L5 15M20 25L7 19') + st('M20 22l4 10M24 32l-8 9M24 32l3 10') + st('M2 10l-1.5-2M1 14h-2') + HEAD,
  'carry-0': '<rect class="prop" x="12" y="1" width="16" height="7" rx="1.5"/>' + st('M20 24L14 8M20 24l6-16') + st('M20 22v10M20 32l-5 9M20 32l3 10') + HEAD,
  'carry-1': '<rect class="prop" x="12" y="0" width="16" height="7" rx="1.5"/>' + st('M20 24L14 7M20 24l6-17') + st('M20 22v10M20 32l-2 10M20 32l6 8') + HEAD,
  'put-0':   '<path class="prop fill" d="M27 23h9l-1.5 8h-6z"/>' + st('M20 24l8 1M20 26l8 3') + st('M20 22v10M20 32l-3 10M20 32l3 10') + HEAD,
  'put-1':   '<g transform="rotate(32 31 27)"><path class="prop fill" d="M27 23h9l-1.5 8h-6z"/></g><path class="drop" d="M37 33v3M39.5 30v2.5"/>' +
             st('M20 24l9 3M20 26l8 5') + st('M20 22l1 10M21 32l-4 10M21 32l3 10') + HEAD,
  'wave-0':  st('M20 24l8-12M20 24l-5 7') + st('M20 22v10M20 32l-3 10M20 32l3 10') + HEAD,
  'wave-1':  st('M20 24l11-8M20 24l-5 7') + st('M20 22v10M20 32l-3 10M20 32l3 10') + HEAD,
};
const CYCLES = { walk: 10, pull: 8, carry: 14, put: 6, wave: 8 };   // 1 つの手順の間にコマを何回切り替えるか

const svg = (cls, inner) => `<svg class="kobito ${cls}" viewBox="0 0 40 46" aria-hidden="true">${inner}</svg>`;

export function mountWorker(el) {
  el.innerHTML = svg('', Object.entries(POSES).map(([k, v]) => `<g data-pose="${k}">${v}</g>`).join(''));
  const k = el.firstElementChild;
  k._g = Object.fromEntries([...k.querySelectorAll('g[data-pose]')].map(g => [g.dataset.pose, g]));
  k._on = null;
}

/* 小人の状態に合わせて、表示するコマを切り替える */
export function renderWorker(el, id, w) {
  const k = el.firstElementChild;
  const key = w.pose + '-' + (Math.floor(w.t * CYCLES[w.pose]) % 2);
  if (k._on !== key) {
    if (k._on) k._g[k._on].classList.remove('on');
    k._g[key].classList.add('on');
    k._on = key;
  }
  if (k.dataset.pose !== w.pose) k.dataset.pose = w.pose;
  k.toggleAttribute('data-bare', w.bare);     // 仕上げはバケツを持たない
  k.toggleAttribute('data-flip', w.flip);     // 左へ歩くときは向きを変える
}

/* 全場面が組み上がったあと、フッターの隅で休憩している 1 人(K-07) */
export function mountRest(parent) {
  const sit = st('M20 26l-5 7M20 26l6 5') + st('M20 22v10M20 32l8 1v9M20 32l5 3v7') + HEAD;
  parent.insertAdjacentHTML('beforeend', svg('rest', sit));
}

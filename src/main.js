/* 起動。演出を行うかどうかを決め、モジュールをつなぐ */
import { $ } from './core/util.js';
import { createEngine } from './core/scroll.js';
import { buildTimeline, BUILD_MS, MOVE_MS } from './c/timeline.js';
import { measureFinal, measure } from './c/measure.js';
import { stateAt, compose, locate, scrollOf, sceneOfY } from './c/state.js';
import { createRenderer } from './c/render.js';
import { mountWorker, renderWorker, mountRest } from './c/kobito.js';

const root = document.documentElement;
const reduced = new URLSearchParams(location.search).get('motion') === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

function startStatic() {
  // COM-30: 演出を行わず、完成サイトを最初から表示する
  document.body.dataset.mode = 'static';
  window.SB = { version: '0.4.0', reduced: true, mode: 'static', progress: 1, state: null, m: null,
    stateAt: () => null, onProgress() {}, setProgress: async () => 1, setScene: async () => 1 };
}

function startBuild() {
  measureFinal();                       // 面を持つ要素に印を付ける。完成形の色を読むので static のうちに呼ぶ
  document.body.dataset.mode = 'build';

  const ctx = { M: null, T: null };
  const render = createRenderer({ mountWorker, renderWorker });
  mountRest($('.replay-wrap'));

  const sb = createEngine({
    buildMs: BUILD_MS, moveMs: MOVE_MS,
    M: () => ctx.M,
    compose: loc => compose(loc, ctx),
    locate: y => locate(y, ctx.M),
    render: (st, mode) => render(st, ctx.M, mode),
    scrollOf: (k, q) => scrollOf(k, q, ctx.M),
    remeasure() {
      ctx.M = measure();
      ctx.T = buildTimeline(ctx.M.mobile ? ['a', 'b'] : ['a', 'b', 'c'], ctx.M.partsOf);
    },
  });

  // A-16: 再読み込みや「戻る」のとき、組み上がっていた場面を完成形にして、見ていた場面に戻る
  const KEY = 'scroll-build-site:pos';
  const save = () => {
    try { sessionStorage.setItem(KEY, JSON.stringify(sb.mode === 'done' ? { built: ctx.M.scenes.length, scene: 0, y: window.scrollY } : { built: sb.built, scene: sb.scene })); } catch (e) { /* 保存できなくても動作に影響しない */ }
  };
  let saved = null;
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) {
    try { saved = JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch (e) { /* 復元できなければ先頭から */ }
  }
  if (saved && saved.built < ctx.M.scenes.length) history.scrollRestoration = 'manual';
  window.addEventListener('pagehide', save);
  let lastPhase = '';
  sb.onProgress(() => { if (sb.phase !== lastPhase) { lastPhase = sb.phase; save(); } });

  $('#skip').addEventListener('click', () => sb.skip());
  $('#replay').addEventListener('click', () => sb.replay());

  const sceneOfEl = el => sceneOfY(el.getBoundingClientRect().top - $('#site').getBoundingClientRect().top, ctx.M);
  // A-14: ページ内リンクは、リンク先の場面へ移動する
  $('#site').addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || sb.mode !== 'build') return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    sb.go(sceneOfEl(target));
  });
  // A-15: キーボードで画面の外のリンクにフォーカスが移ったら、その場面へ移動する
  $('#site').addEventListener('focusin', e => {
    if (sb.mode !== 'build' || !e.target.matches(':focus-visible')) return;
    const r = e.target.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) sb.go(sceneOfEl(e.target));
  });

  window.SB = Object.assign(sb, { version: '0.4.0', reduced: false, stateAt: p => stateAt(p, ctx) });
  Object.defineProperty(window.SB, 'm', { get: () => ctx.M });

  // 書体が読み込まれると文字の位置が変わるので、測り直してから始める(A-01)。読み込みが遅いときは待たない
  let started = false;
  const begin = () => { if (started) return; started = true; sb.refresh(); sb.start(saved); };
  document.fonts.ready.then(() => { if (started) sb.refresh(); else begin(); });
  setTimeout(begin, 800);
}

try {
  if (reduced) startStatic();
  else startBuild();
} catch (err) {
  console.error('[scroll-build-site] 起動に失敗。完成形を表示します', err);
  document.body.dataset.mode = 'static';
  root.classList.remove('locked');
} finally {
  root.classList.remove('boot');
}

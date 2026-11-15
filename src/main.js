/* 起動。演出を行うかどうかを決め、モジュールをつなぐ */
import { $ } from './core/util.js';
import { createEngine } from './core/scroll.js';
import { buildTimeline } from './c/timeline.js';
import { splitTitle, measureFinal, measure } from './c/measure.js';
import { stateAt, scrollOf, scrollForSiteY } from './c/state.js';
import { createRenderer } from './c/render.js';
import { mountWorker, renderWorker, mountRest } from './c/kobito.js';

const root = document.documentElement;
const reduced = new URLSearchParams(location.search).get('motion') === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

function startStatic() {
  // COM-30: 演出を行わず、完成サイトを最初から表示する
  document.body.dataset.mode = 'static';
  window.SB = { version: '0.2.0', reduced: true, mode: 'static', progress: 1, state: null, m: null,
    stateAt: () => null, onProgress() {}, setProgress: async () => 1, setScene: async () => 1 };
}

function startBuild() {
  measureFinal();                       // 面を持つ要素に印を付ける。完成形の色を読むので static のうちに呼ぶ
  const chars = splitTitle($('#site [data-key="hero-title"]'));
  document.body.dataset.mode = 'build';

  const ctx = { M: null, T: null, mobile: null };
  const render = createRenderer(chars, { mountWorker, renderWorker });
  mountRest($('.replay-wrap'));

  const sb = createEngine({
    M: () => ctx.M,
    stateAt: p => stateAt(p, ctx),
    render: (st, mode) => render(st, ctx.M, mode),
    scrollOf: (k, q) => scrollOf(k, q, ctx.M),
    remeasure() {
      ctx.M = measure(chars);
      if (ctx.mobile !== ctx.M.mobile) { ctx.mobile = ctx.M.mobile; ctx.T = buildTimeline(ctx.M.mobile ? ['a', 'b'] : ['a', 'b', 'c']); }
    },
  });

  // COM-06: 再読み込みや「戻る」のとき、同じ場面の同じ進み具合に戻す。
  // ページの高さをスクリプトで決めているため、ブラウザ任せでは復元されないことがある
  const KEY = 'scroll-build-site:pos';
  const save = () => {
    const st = sb.state;
    if (sb.mode !== 'build' || !st) return;
    try { sessionStorage.setItem(KEY, JSON.stringify({ pinned: st.pinned, scene: st.scene, q: st.q[st.scene], y: st.y, max: ctx.M.maxScroll })); } catch (e) { /* 保存できなくても動作に影響しない */ }
  };
  const nav = performance.getEntriesByType('navigation')[0];
  if (nav && (nav.type === 'reload' || nav.type === 'back_forward')) {
    try {
      const pos = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (pos) {
        history.scrollRestoration = 'manual';
        sb.scrollTo(pos.pinned ? scrollOf(pos.scene, pos.q, ctx.M) : pos.y / pos.max * ctx.M.maxScroll);
      }
    } catch (e) { /* 復元できなければ先頭から */ }
  }
  window.addEventListener('pagehide', save);

  // K-08: スクロールが 150 ミリ秒止まったら、待機の動きに切り替える
  let idleTimer = 0;
  sb.onProgress(() => {
    document.body.removeAttribute('data-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { document.body.setAttribute('data-idle', ''); save(); }, 150);
  });

  $('#skip').addEventListener('click', () => sb.skip());
  $('#replay').addEventListener('click', () => sb.replay());

  // S-24: ページ内リンクは、リンク先の場面が組み上がった位置へ移動する
  $('#site').addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || sb.mode !== 'build') return;
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    e.preventDefault();
    const Y = target.getBoundingClientRect().top - $('#site').getBoundingClientRect().top;
    sb.scrollTo(scrollForSiteY(Y, ctx.M));
  });

  // 書体が読み込まれると文字の位置が変わるので測り直す
  document.fonts.ready.then(() => sb.refresh());

  window.SB = Object.assign(sb, { version: '0.2.0', reduced: false });
  Object.defineProperty(window.SB, 'm', { get: () => ctx.M });
}

try {
  if (reduced) startStatic();
  else startBuild();
} catch (err) {
  console.error('[scroll-build-site] 起動に失敗。完成形を表示します', err);
  document.body.dataset.mode = 'static';
} finally {
  root.classList.remove('boot');
}

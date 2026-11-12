/* 起動。演出を行うかどうかを決め、案 C のモジュールをつなぐ */
import { $ } from './core/util.js';
import { createProgress } from './core/progress.js';
import { buildTimeline } from './c/timeline.js';
import { splitTitle, measureFinal, measure } from './c/measure.js';
import { stateAt, buildCamera } from './c/state.js';
import { createRenderer } from './c/render.js';
import { mountCursor, renderCursor, mountRest } from './c/kobito.js';

const root = document.documentElement;
const reduced = new URLSearchParams(location.search).get('motion') === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

function startStatic() {
  // COM-30: 演出を行わず、完成サイトを最初から表示する
  document.body.dataset.mode = 'static';
  window.SB = {
    version: '0.1.0', reduced: true, mode: 'static', progress: 1, state: null, m: null,
    stateAt: () => null, onProgress() {}, setProgress: async () => 1,
  };
}

function startBuild() {
  const ctx = { M: null, F: measureFinal(), T: null };   // 完成形の色は static のうちに読む
  const chars = splitTitle($('#site [data-key="hero-title"]'));
  document.body.dataset.mode = 'build';

  const timelineFor = mobile => { const T = buildTimeline(mobile ? ['a', 'b'] : ['a', 'b', 'c']); T.cam = buildCamera(T); return T; };
  const render = createRenderer(chars, { mountCursor, renderCursor });
  mountRest($('.replay-wrap'));

  const sb = createProgress({
    stateAt: p => stateAt(p, ctx),
    render: (st, mode, dir) => render(st, ctx.M, mode, dir),
    remeasure() {
      ctx.M = measure(chars);
      if (!ctx.T || ctx.T.mobile !== ctx.M.mobile) { ctx.T = timelineFor(ctx.M.mobile); ctx.T.mobile = ctx.M.mobile; }
    },
  });

  // C-22: スクロールが 150 ミリ秒止まったら、待機の動きに切り替える
  let idleTimer = 0;
  sb.onProgress(() => {
    document.body.removeAttribute('data-idle');
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.setAttribute('data-idle', ''), 150);
  });

  $('#skip').addEventListener('click', () => sb.skip());
  $('#replay').addEventListener('click', () => sb.replay());
  // 書体が読み込まれると文字の位置が変わるので測り直す
  document.fonts.ready.then(() => sb.refresh());

  window.SB = Object.assign(sb, { version: '0.1.0', reduced: false });
  Object.defineProperty(window.SB, 'm', { get: () => ctx.M });
  Object.defineProperty(window.SB, 'ctx', { get: () => ctx });
}

try {
  if (reduced || !window.gsap || !window.ScrollTrigger) startStatic();
  else startBuild();
} catch (err) {
  console.error('[scroll-build-site] 起動に失敗。完成形を表示します', err);
  document.body.dataset.mode = 'static';
} finally {
  root.classList.remove('boot');
}

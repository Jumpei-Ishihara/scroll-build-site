/* スクロール位置 → 状態 → 描画(SPEC-03)。ライブラリは使わない。
 * opts: { M(): 計測値, stateAt(p), render(state, mode), remeasure(), scrollOf(k, q) }
 * モード: build(組み立て中。場面ごとに固定する)/ done(スキップ後。通常のページ)
 */
import { clamp, lerp, inv } from './util.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

export function createEngine(opts) {
  const listeners = [];
  let state = null, mode = 'build';

  function update() {
    if (mode !== 'build') return;
    const M = opts.M();
    const p = M.maxScroll > 0 ? clamp(window.scrollY / M.maxScroll) : 1;
    state = opts.stateAt(p);
    opts.render(state, mode);
    for (const fn of listeners) fn(p, state);
  }

  function setMode(next) {
    mode = next;
    document.body.dataset.mode = next;
    if (next === 'done') { state = opts.stateAt(1); opts.render(state, mode); }
  }

  /* 計測し直す。同じ場面の同じ進み具合(移動中なら同じ割合の位置)に戻す(COM-42) */
  function refresh() {
    if (mode !== 'build') { opts.remeasure(); return; }
    const old = opts.M(), st = state;
    opts.remeasure();
    const M = opts.M();
    let y = 0;
    if (st && st.pinned) y = opts.scrollOf(st.scene, st.q[st.scene]);
    else if (st) {
      const k = st.scene, after = st.q[k] >= 1;            // 最後の場面のあとの移動か
      const a0 = after ? old.scenes[k].cam : k ? old.scenes[k - 1].cam : 0, b0 = after ? old.maxCam : old.scenes[k].cam;
      const a1 = after ? M.scenes[k].cam : k ? M.scenes[k - 1].cam : 0, b1 = after ? M.maxCam : M.scenes[k].cam;
      const off = (after ? k + 1 : k) * M.scenes[0].hold;
      y = lerp(a1, b1, inv(a0, b0, st.cam)) + off;
    }
    update();                       // 先に新しい高さを反映する
    window.scrollTo(0, y);
    update();
  }

  window.addEventListener('scroll', update, { passive: true });
  let rt = 0, lastW = window.innerWidth, lastH = window.innerHeight;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => {
      // スマホのアドレスバーの出入りによる高さの変化では測り直さない
      if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 120) return;
      lastW = window.innerWidth; lastH = window.innerHeight;
      refresh();
    }, 150);
  });

  /* 補間を終わらせる(テスト用)。画面が描画されていない環境では補間が進まないため、待つだけでは足りない */
  async function settle() {
    update();
    await wait(60);
    for (const a of document.getAnimations()) { if (a.constructor.name === 'CSSTransition') a.finish(); }
  }

  const api = {
    get progress() { const M = opts.M(); return mode === 'build' ? clamp(window.scrollY / M.maxScroll) : 1; },
    get state() { return state; },
    get mode() { return mode; },
    onProgress(fn) { listeners.push(fn); },
    stateAt: p => opts.stateAt(p),
    pOf: (k, q) => opts.scrollOf(k, q) / opts.M().maxScroll,
    update, settle, refresh,
    async setProgress(p) { window.scrollTo(0, p * opts.M().maxScroll); await settle(); return api.progress; },
    async setScene(k, q) { window.scrollTo(0, opts.scrollOf(k, q)); await settle(); return api.progress; },
    scrollTo(y) { window.scrollTo(0, y); update(); },
    /* S-22: 全場面を完成形にして通常のページに切り替える。見えていた位置は保つ */
    skip() {
      if (mode !== 'build') return;
      const cam = state ? state.cam : 0;
      setMode('done');
      window.scrollTo(0, cam);
    },
    /* S-23: 先頭に戻って最初から組み立てる */
    replay() {
      if (mode !== 'build') setMode('build');
      update();
      window.scrollTo(0, 0);
      update();
    },
  };
  opts.remeasure();
  update();
  return api;
}

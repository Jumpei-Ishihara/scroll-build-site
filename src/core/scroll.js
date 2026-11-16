/* 進行の管理(SPEC-05)。組み立ては時間で進み、スクロールは「次の場面へ」の合図にだけ使う。
 * opts: { M(): 計測値, compose(loc): 状態, locate(y), render(state, mode), remeasure(), scrollOf(k, q), buildMs, moveMs }
 * モード: build(組み立て中。ブラウザのスクロールを止め、ページの位置は演出側で動かす)/ done(通常のページ)
 * 段階: idle(待機)/ move(場面の間を移動中)/ build(場面を組み立て中)
 */
import { clamp, lerp, easeInOut } from './util.js';

const wait = ms => new Promise(r => setTimeout(r, ms));

export function createEngine(opts) {
  const root = document.documentElement, listeners = [];
  let state = null, mode = 'build';
  // built: 組み上がった場面の数(先頭から)。cur: 今いる場面。q: cur の進み具合。cam: ページの表示位置
  let built = 0, cur = 0, q = 0, cam = 0;
  let phase = 'idle', t0 = 0, camFrom = 0, camTo = 0, then = null;
  let held = null;                 // テスト用に状態を直接置いたときの「固定中か」。ふだんは null
  let raf = 0, timer = 0, strictUntil = 0;
  const count = () => opts.M().scenes.length;

  function loc() {
    const M = opts.M();
    const qs = M.scenes.map((_, k) => (k < built ? 1 : k === cur ? q : 0));
    const y = built >= M.scenes.length ? M.maxScroll : cur < built ? M.scenes[cur].s1 : opts.scrollOf(cur, q);
    return { pinned: held !== null ? held : phase !== 'move' && cur >= built, scene: cur, q: qs, cam, off: 0, y, moving: phase === 'move' };
  }
  function draw() {
    if (mode !== 'build') return;
    state = opts.compose(loc());
    opts.render(state, mode);
    for (const fn of listeners) fn(state.p, state);
  }

  /* 画面が描画されていないとき(裏のタブなど)は requestAnimationFrame が呼ばれないので、タイマーでも進める */
  function stop() { cancelAnimationFrame(raf); clearTimeout(timer); raf = timer = 0; }
  function loop() {
    stop();
    step(performance.now());
    if (phase !== 'idle' && mode === 'build') { raf = requestAnimationFrame(loop); timer = setTimeout(loop, 50); }
  }
  function step(now) {
    if (phase === 'move') {
      const t = clamp((now - t0) / opts.moveMs);
      cam = lerp(camFrom, camTo, easeInOut(t));
      if (t >= 1) { phase = 'idle'; const f = then; then = null; if (f) f(); }
    } else if (phase === 'build') {
      q = clamp((now - t0) / opts.buildMs);                 // A-02: 進み具合は時間だけで決まる
      if (q >= 1) {
        built = cur + 1; phase = 'idle';
        strictUntil = now + 400;
        if (built >= count()) { draw(); finish(); return; } // A-08
      }
    }
    draw();
  }

  function setMode(next) {
    mode = next;
    document.body.dataset.mode = next;
    root.classList.toggle('locked', next === 'build');      // A-09
    if (next === 'done') {
      const M = opts.M();
      state = opts.compose({ pinned: false, scene: M.scenes.length - 1, q: M.scenes.map(() => 1), cam, off: 0, y: M.maxScroll });
      opts.render(state, mode);
    }
  }
  /* 通常のページに切り替える。見えていた位置は保つ */
  function finish() {
    stop(); phase = 'idle'; then = null;
    const y = cam;
    setMode('done');
    window.scrollTo(0, y);
  }

  /* 今の場面を組み立てる */
  function play() {
    held = null;
    if (mode !== 'build' || cur < built) return;
    phase = 'build'; q = 0; t0 = performance.now();
    loop();
  }
  /* 場面 k へ移動する。途中の場面は完成形にし、k がまだなら着いてから組み立てる(A-03、A-06、A-07、A-14) */
  function go(k) {
    if (mode !== 'build' || phase !== 'idle' || k < 0 || k >= count()) return false;
    held = null;
    if (k === cur) { if (cur >= built) play(); return true; }
    const fresh = k >= built;
    if (k > built) built = k;
    cur = k; q = fresh ? 0 : 1;
    phase = 'move'; t0 = performance.now(); camFrom = cam; camTo = opts.M().scenes[k].cam;
    then = () => { if (fresh) play(); else strictUntil = performance.now() + 900; };
    loop();
    return true;
  }
  const next = () => go(cur + 1), prev = () => go(cur - 1);

  // ---- 入力(A-04、A-05、A-10)。組み立てが全部終わるまで、スクロールは合図としてだけ使う ----
  let lastWheelT = 0, lastDy = 0;
  /* ホイール 1 回分の入力。now を引数にしてあるのは、テストで時刻を指定するため */
  function onWheel(dy, now) {
    // 慣性による続きの入力を、新しい操作と区別する: 間が空いたか、急に強くなったら新しい操作
    const fresh = now - lastWheelT > 120 || (Math.abs(dy) > Math.abs(lastDy) * 1.6 && Math.abs(dy) > 12);
    lastWheelT = now; lastDy = dy;
    if (phase !== 'idle' || Math.abs(dy) < 2 || (now < strictUntil && !fresh)) return false;
    return dy > 0 ? next() : prev();
  }
  window.addEventListener('wheel', e => {
    if (mode !== 'build') return;
    e.preventDefault();
    onWheel(e.deltaY, performance.now());
  }, { passive: false });

  let touchY = null;
  window.addEventListener('touchstart', e => { touchY = mode === 'build' ? e.touches[0].clientY : null; }, { passive: true });
  window.addEventListener('touchmove', e => { if (mode === 'build' && e.cancelable) e.preventDefault(); }, { passive: false });
  window.addEventListener('touchend', e => {
    if (mode !== 'build' || touchY === null) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) >= 40) { if (dy > 0) next(); else prev(); }
  }, { passive: true });

  window.addEventListener('keydown', e => {
    if (mode !== 'build' || e.altKey || e.ctrlKey || e.metaKey) return;
    const onControl = e.target.closest && e.target.closest('a, button, input, textarea, select');
    const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !e.shiftKey && !onControl);
    const up = e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === ' ' && e.shiftKey && !onControl);
    if (!down && !up) return;
    e.preventDefault();
    if (down) next(); else prev();
  });

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

  /* 計測し直す。同じ場面にとどまる(COM-42) */
  function refresh() {
    opts.remeasure();
    if (mode !== 'build') return;
    const target = opts.M().scenes[cur].cam;
    if (phase === 'move') camTo = target; else cam = target;
    draw();
  }

  /* 補間を終わらせる(テスト用)。画面が描画されていない環境では CSS の補間が進まないため */
  async function settle() {
    draw();
    await wait(60);
    for (const a of document.getAnimations()) { if (a.constructor.name === 'CSSTransition') a.finish(); }
  }
  /* テスト用: 状態を直接置く。アニメーションは止める */
  function place(l) {
    if (mode !== 'build') setMode('build');
    stop(); phase = 'idle'; then = null;
    built = l.q.filter(v => v >= 1).length; cur = l.scene; q = l.q[cur]; cam = l.cam; held = l.pinned;
    draw();
  }

  const api = {
    get progress() { return mode === 'build' && state ? state.p : 1; },
    get state() { return state; },
    get mode() { return mode; },
    get phase() { return phase; },
    get busy() { return phase !== 'idle'; },
    get built() { return built; },
    get scene() { return cur; },
    get buildMs() { return opts.buildMs; },
    get moveMs() { return opts.moveMs; },
    /* テスト用: 組み立てと移動にかける時間を変える */
    timing(buildMs, moveMs) { opts.buildMs = buildMs; opts.moveMs = moveMs; },
    onProgress(fn) { listeners.push(fn); },
    pOf: (k, v) => opts.scrollOf(k, v) / opts.M().maxScroll,
    update: draw, settle, refresh, play, go, next, prev, wheel: onWheel,
    async setProgress(p) { place(opts.locate(clamp(p) * opts.M().maxScroll)); await settle(); return api.progress; },
    async setScene(k, v) { place(opts.locate(opts.scrollOf(k, v))); await settle(); return api.progress; },
    /* 開始。saved があれば、組み上がっていた場面を完成形にして、見ていた場面に戻る(A-16) */
    start(saved) {
      const n = count();
      if (saved && saved.built >= n) { built = n; cur = n - 1; cam = saved.y || 0; finish(); return; }
      if (saved) { built = clamp(saved.built | 0, 0, n); cur = clamp(saved.scene | 0, 0, built); q = cur < built ? 1 : 0; cam = opts.M().scenes[cur].cam; }
      draw();
      play();
    },
    /* A-12: 全場面を完成形にして通常のページに切り替える */
    skip() { if (mode === 'build') finish(); },
    /* A-13: 先頭に戻って最初から組み立てる */
    replay() {
      stop();
      window.scrollTo(0, 0);
      setMode('build');
      built = 0; cur = 0; q = 0; cam = 0; phase = 'idle'; then = null; held = null; strictUntil = 0;
      draw();
      play();
    },
  };
  root.classList.add('locked');
  opts.remeasure();
  draw();
  return api;
}

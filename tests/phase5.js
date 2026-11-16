/* Phase 5 場面ごとの組み立て: 表示位置、工程の順序、操作できる範囲
 * 対象: SPEC-03 S-01, S-02, S-06, S-07, S-10〜S-12, S-15, S-21
 * 進み方(時間、スクロール、スキップ、やり直し)は phase8。
 * 実行: fetch('tests/phase5.js').then(r=>r.text()).then(eval) → window.__P5RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P5RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase5] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const S = window.SB;
  t('P5-01 SB の API', S && ['stateAt', 'setProgress', 'setScene', 'onProgress'].every(k => typeof S[k] === 'function') && 'mode' in S && 'state' in S);
  if (!S || typeof S.setScene !== 'function') return done();
  if (S.mode === 'static') { t('P5-00 演出なしのため対象外', true, 'static'); return done(); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const site = $('#site');
  const top = () => site.getBoundingClientRect().top;
  const M = S.m, N = M.scenes.length;
  const keysOf = k => M.scenes[k].keys.map(key => $(`#site [data-key="${key}"]`));

  // ---- S-01 ツール UI なし、実寸 ----
  t('S-01a 編集ツール風の UI がない', !$('#tool') && !$('#tool-bg') && !$('#t-layers') && !$('.cur') && !$('.name'));
  await S.setScene(1, 0.5);
  const sr = site.getBoundingClientRect();
  t('S-01b 演出中も実寸', Math.abs(sr.width - document.body.getBoundingClientRect().width) <= 1 && sr.width > window.innerWidth - 24 && Math.abs(sr.left) <= 1 && getComputedStyle($('#frame')).transform.replace(/[^\d.,-]/g, '').split(',').slice(0, 4).join() === '1,0,0,1',
    `w=${sr.width} left=${sr.left}`);
  t('P5-02 場面は 5 つ', N === 5 && $$('#controls [data-seg]').length === 5, N);

  // ---- S-02 組み立て中はページが動かない ----
  let pinOk = true, pinD = [];
  for (let k = 0; k < N; k++) {
    const tops = [];
    for (const q of [0, 0.02, 0.5, 0.98, 1]) { await S.setScene(k, q); tops.push(top()); }
    const spread = Math.max(...tops) - Math.min(...tops), d = Math.abs(tops[2] + M.scenes[k].cam);
    pinD.push(`${k}:${spread.toFixed(1)}/${d.toFixed(1)}`);
    if (spread > 1 || d > 1 || !S.stateAt(S.pOf(k, 0.5)).pinned) pinOk = false;
  }
  t('S-02 組み立て中はページが動かない', pinOk, pinD.join(' '));

  // ---- S-06 上に戻らない ----
  let mono = true, last = -1;
  for (let i = 0; i <= 400; i++) { const c = S.stateAt(i / 400).cam; if (c < last - 0.01) mono = false; last = c; }
  t('S-06 場面を進めてもページが上に戻らない', mono && last > 100, '最終位置=' + last.toFixed(0));

  // ---- S-02 / S-07 固定位置 ----
  let center = true, cD = [];
  for (let k = 0; k < N; k++) {
    const sc = M.scenes[k];
    const mid = sc.top + sc.h / 2 - sc.cam, d = mid - M.vh / 2;
    const fits = sc.h <= M.vh - 40;
    const clamped = sc.cam <= 0.5 || sc.cam >= M.maxCam - 0.5;
    cD.push(`${k}:${d.toFixed(0)}${fits ? '' : '(高)'}${clamped ? '(端)' : ''}`);
    if (fits && !clamped && Math.abs(d) > 2) center = false;
    if (!fits && Math.abs(sc.top - sc.cam) > 40) center = false;
    if (sc.top - sc.cam < -1 && fits) center = false;      // 上がはみ出さない
  }
  t('S-02 / S-07 場面を画面の中央(高い場合は上端)に置く', center, cD.join(' '));

  // ---- S-10〜S-12 組み立て ----
  const ORDER = ['hidden', 'box', 'text', 'color', 'final'];
  let build = true, bD = [];
  for (let k = 0; k < N; k++) {
    const keys = M.scenes[k].keys;
    const rank = q => keys.map(key => ORDER.indexOf(S.stateAt(S.pOf(k, q)).elements[key].b));
    let prev = keys.map(() => 0), monoB = true;
    const seen = new Set();
    for (let q = 0; q <= 1.0001; q += 0.02) { const r = rank(Math.min(1, q)); r.forEach((v, i) => { if (v < prev[i]) monoB = false; seen.add(v); }); prev = r; }
    const end = rank(1).every(v => v === 4), start = rank(0).every(v => v === 0);
    const st = S.stateAt(S.pOf(k, 0.5));
    const later = M.scenes.slice(k + 1).flatMap(s => s.keys).every(key => st.elements[key].b === 'hidden');
    const earlier = M.scenes.slice(0, k).flatMap(s => s.keys).every(key => st.elements[key].b === 'final');
    bD.push(`${k}:${[...seen].sort().join('')}`);
    if (!monoB || !end || !start || !later || !earlier || seen.size < 5) build = false;
  }
  t('S-10〜S-12 工程が順に進み、前は完成・後ろは非表示', build, bD.join(' '));
  await S.setScene(2, 0.4);
  const domOk = $$('#site [data-key]').every(el => el.dataset.b === S.state.elements[el.dataset.key].b);
  const hiddenOk = keysOf(4).every(el => getComputedStyle(el).visibility === 'hidden') && keysOf(0).every(el => getComputedStyle(el).visibility === 'visible');
  t('S-12 DOM が状態と一致', domOk && hiddenOk);

  // ---- S-15 操作できる範囲 ----
  await S.setScene(1, 0.5);
  const pe = el => getComputedStyle(el).pointerEvents;
  t('S-15 完成した場面だけ操作できる', pe($('#site [data-key="hero-btns"] a')) !== 'none' && pe($('#site [data-key="card-1"]')) === 'none');

  // ---- S-21 進行表示 ----
  await S.setScene(0, 0.3);
  t('S-21 進行表示に場面と工程', /ヒーロー/.test($('#stage-name').textContent) && /骨組み|文字とパーツ|色|仕上げ/.test($('#stage-name').textContent), $('#stage-name').textContent);
  const f = $$('#controls [data-seg]').map(s => parseFloat(s.style.getPropertyValue('--f')));
  t('S-21b 区切りが進み具合を表す', Math.abs(f[0] - 0.3) < 0.01 && f[1] === 0, f.join(','));

  // ---- 共通 ----
  const h1 = $('#site h1');
  t('COM-20 見出しが HTML にある', h1 && h1.textContent.trim().length > 4);
  const src = await fetch(location.pathname).then(r => r.text());
  t('COM-23 HTML の初期値は static、ライブラリに依存しない', /<body[^>]*data-mode="static"/.test(src) && !/gsap/i.test(src));
  t('COM-40 横スクロールなし', document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + '/' + window.innerWidth);
  t('COM-01 同じ進行度は同じ状態', JSON.stringify(S.stateAt(0.37)) === JSON.stringify(S.stateAt(0.37)));

  await S.setScene(0, 0);
  return done();
})();

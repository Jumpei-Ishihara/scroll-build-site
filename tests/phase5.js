/* Phase 5 セクション固定方式: 固定、移動、組み立て、操作
 * 対象: SPEC-03 S-01〜S-24
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
  if (S.mode === 'done') { S.replay(); await new Promise(r => setTimeout(r, 200)); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const site = $('#site');
  const top = () => site.getBoundingClientRect().top;
  const M = S.m, N = M.scenes.length;
  const keysOf = k => M.scenes[k].keys.map(key => $(`#site [data-key="${key}"]`));
  const y0 = window.scrollY;

  // ---- S-01 ツール UI なし、実寸 ----
  t('S-01a 編集ツール風の UI がない', !$('#tool') && !$('#tool-bg') && !$('#t-layers') && !$('.cur') && !$('.name'));
  await S.setScene(1, 0.5);
  const sr = site.getBoundingClientRect();
  t('S-01b 演出中も実寸', Math.abs(sr.width - document.documentElement.clientWidth) <= 1 && Math.abs(sr.left) <= 1 && getComputedStyle($('#frame')).transform.replace(/[^\d.,-]/g, '').split(',').slice(0, 4).join() === '1,0,0,1',
    `w=${sr.width} left=${sr.left}`);
  t('P5-02 場面は 5 つ', N === 5 && $$('#controls [data-seg]').length === 5, N);

  // ---- S-02 / S-05 固定中は動かない、境界で飛ばない ----
  let pinOk = true, pinD = [];
  for (let k = 0; k < N; k++) {
    const tops = [];
    for (const q of [0, 0.02, 0.5, 0.98, 1]) { await S.setScene(k, q); tops.push(top()); }
    const spread = Math.max(...tops) - Math.min(...tops);
    // 固定の直前と直後(移動側)の位置
    const sc = S.m.scenes[k];
    window.scrollTo(0, Math.max(0, sc.s0 - 1)); await S.settle(); const before = top();
    window.scrollTo(0, sc.s1 + 1); await S.settle(); const after = top();
    const jumpIn = k === 0 ? 0 : Math.abs(before - tops[0]) - 1, jumpOut = Math.abs(after - tops[4]) - 1;
    pinD.push(`${k}:${spread.toFixed(1)}/${jumpIn.toFixed(1)}/${jumpOut.toFixed(1)}`);
    if (spread > 1 || jumpIn > 1 || jumpOut > 1 || !S.stateAt(S.pOf(k, 0.5)).pinned) pinOk = false;
  }
  t('S-02 / S-05 固定中は動かず、境界で飛ばない', pinOk, pinD.join(' '));

  // ---- S-03 固定の長さ ----
  t('S-03 固定の長さは画面の 2.8 倍', M.scenes.every(sc => Math.abs(sc.hold - M.vh * 2.8) < 1), M.scenes.map(s => Math.round(s.hold)).join(','));

  // ---- S-04 移動中は 1:1 ----
  const sc1 = M.scenes[1], sc2 = M.scenes[2];
  if (sc2.s0 - sc1.s1 > 140) {
    window.scrollTo(0, sc1.s1 + 20); await S.settle(); const a = top();
    window.scrollTo(0, sc1.s1 + 120); await S.settle(); const b = top();
    t('S-04 移動中はスクロールと同じ量だけ動く', Math.abs((a - b) - 100) <= 1 && !S.state.pinned, (a - b).toFixed(1));
  } else t('S-04 移動中はスクロールと同じ量だけ動く', true, '移動区間が短いため省略');

  // ---- S-06 上に戻らない ----
  let mono = true, last = -1;
  for (let i = 0; i <= 400; i++) { const c = S.stateAt(i / 400).cam; if (c < last - 0.01) mono = false; last = c; }
  t('S-06 ページが上に戻らない', mono && last > 100, '最終位置=' + last.toFixed(0));

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
  t('S-02 / S-07 場面を画面の中央(高い場合は上端)に固定', center, cD.join(' '));

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

  // ---- S-14 巻き戻し(見出しの運び方は phase7 の P-09) ----
  await S.setScene(3, 1); await S.setScene(1, 0.3);
  t('S-14 巻き戻し', S.state.pinned && JSON.stringify(S.state.elements) === JSON.stringify(S.stateAt(S.progress).elements) && S.state.elements['work-1'].b === 'hidden');

  // ---- S-15 操作できる範囲 ----
  await S.setScene(1, 0.5);
  const pe = el => getComputedStyle(el).pointerEvents;
  t('S-15 完成した場面だけ操作できる', pe($('#site [data-key="hero-btns"] a')) !== 'none' && pe($('#site [data-key="card-1"]')) === 'none');

  // ---- S-20 / S-21 案内と進行表示 ----
  await S.setScene(0, 0);
  const hintOn = getComputedStyle($('#hint')).opacity !== '0' && $('#hint').textContent.includes('スクロール');
  await S.setScene(0, 0.3);
  t('S-20 先頭だけ案内を出す', hintOn && getComputedStyle($('#hint')).opacity === '0');
  t('S-21 進行表示に場面と工程', /ヒーロー/.test($('#stage-name').textContent) && /骨組み|文字とパーツ|色|仕上げ/.test($('#stage-name').textContent), $('#stage-name').textContent);

  // ---- S-24 ページ内リンク ----
  await S.setScene(0, 1);
  $('#site [data-key="hero-btns"] a[href="#works"]').click();
  await wait(120); await S.settle();
  const w1 = $('#site [data-key="work-1"]').getBoundingClientRect();
  t('S-24 ページ内リンクで組み上がった場面へ', S.state.elements['work-1'].b === 'final' && w1.top >= 0 && w1.top < innerHeight, `b=${S.state.elements['work-1'].b} top=${w1.top.toFixed(0)}`);

  // ---- S-22 / S-23 スキップとやり直し ----
  await S.setScene(2, 0.5);
  const before = $('#site [data-key="works-title"]').getBoundingClientRect().top;
  const skip = $('#skip'), replay = $('#replay');
  t('COM-12 ボタンはキーボードで操作できる', skip.tagName === 'BUTTON' && replay.tagName === 'BUTTON' && skip.tabIndex >= 0 && replay.tabIndex >= 0);
  skip.click(); await wait(150);
  const after = $('#site [data-key="works-title"]').getBoundingClientRect().top;
  const allFinal = $$('#site [data-key]').every(el => getComputedStyle(el).visibility === 'visible');
  t('S-22a スキップで通常のページになる', S.mode === 'done' && document.body.dataset.mode === 'done' && allFinal &&
    Math.abs(document.documentElement.scrollHeight - site.getBoundingClientRect().height) <= 2 && getComputedStyle($('#controls')).display === 'none',
    `mode=${S.mode} h=${document.documentElement.scrollHeight}/${site.getBoundingClientRect().height.toFixed(0)}`);
  t('S-22b 見えていた位置を保つ', Math.abs(after - before) <= 1, `${before.toFixed(1)} → ${after.toFixed(1)}`);
  let maxD = 0; const sr2 = site.getBoundingClientRect();
  for (const el of $$('#site [data-key]')) { const a = el.getBoundingClientRect(), b = M.rects[el.dataset.key]; maxD = Math.max(maxD, Math.abs(a.left - sr2.left - b.x), Math.abs(a.top - sr2.top - b.y), Math.abs(a.width - b.w), Math.abs(a.height - b.h)); }
  t('S-22c 完成サイトと 1px 以内で一致', maxD <= 1, maxD.toFixed(2));
  replay.click(); await wait(200);
  t('S-23 やり直しで先頭から', window.scrollY === 0 && S.mode === 'build' && S.state.elements['hero-title'].b === 'hidden', `y=${scrollY} mode=${S.mode}`);

  // ---- 共通 ----
  const h1 = $('#site h1');
  t('COM-20 見出しが HTML にある', h1 && (h1.getAttribute('aria-label') || h1.textContent).trim().length > 4);
  const src = await fetch(location.pathname).then(r => r.text());
  t('COM-23 HTML の初期値は static、ライブラリに依存しない', /<body[^>]*data-mode="static"/.test(src) && !/gsap/i.test(src));
  t('COM-40 横スクロールなし', document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + '/' + window.innerWidth);
  t('COM-01 同じ進行度は同じ状態', JSON.stringify(S.stateAt(0.37)) === JSON.stringify(S.stateAt(0.37)));

  window.scrollTo(0, Math.min(y0, document.documentElement.scrollHeight)); await S.settle();
  return done();
})();

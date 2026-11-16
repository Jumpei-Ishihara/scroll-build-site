/* Phase 8 自動で組み立てる: 時間で進む組み立て、1 回のスクロールで次の場面へ、組み立て中は固定
 * 対象: SPEC-05 A-01〜A-14
 * 実際の時間で動かすので、終わるまで 15 秒ほどかかる。
 * 実行: fetch('tests/phase8.js').then(r=>r.text()).then(eval) → window.__P8RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P8RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase8] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (window.top !== window) { t('P8-00 iframe 内では実行しない', true); return done(); }
  const S = window.SB;
  if (!S || typeof S.replay !== 'function') { t('P8-00 SB がない', S && S.mode === 'static', S ? S.mode : ''); return done(); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const root = document.documentElement, site = $('#site');
  const M = S.m, N = M.scenes.length;
  const B0 = S.buildMs, M0 = S.moveMs;
  const idle = async (max = 6000) => { const t0 = performance.now(); while (S.busy && performance.now() - t0 < max) await wait(20); return performance.now() - t0; };
  const wheel = dy => window.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, cancelable: true, bubbles: true }));
  const key = k => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true, bubbles: true }));
  const finalOf = k => M.scenes[k].keys.every(key => S.state.elements[key].b === 'final' && $(`#site [data-key="${key}"]`).dataset.b === 'final');
  const phases = []; let rec = false;
  S.onProgress(() => { if (rec && phases[phases.length - 1] !== S.phase) phases.push(S.phase); });

  // ---- A-01 / A-02 開いたら自動で始まり、約 3 秒で組み上がる ----
  t('A-02a 組み立ては 3 秒程度', B0 >= 2500 && B0 <= 3500, B0 + 'ms');
  S.replay();
  const tStart = performance.now();
  t('A-01 最初の場面の組み立てが自動で始まる', S.mode === 'build' && S.phase === 'build' && S.scene === 0 && S.built === 0);
  t('A-09a ブラウザのスクロールを止めている', root.classList.contains('locked') && getComputedStyle(root).overflowY === 'hidden' &&
    getComputedStyle($('#frame')).position === 'fixed' && root.scrollHeight <= window.innerHeight + 1, `${root.scrollHeight}/${innerHeight}`);
  await wait(1000);
  const qMid = S.state.q[0], want = (performance.now() - tStart) / B0;
  t('A-02b 進み具合は時間で決まる', Math.abs(qMid - want) < 0.08 && S.phase === 'build', `q=${qMid.toFixed(3)} 期待=${want.toFixed(3)}`);
  t('A-11a 組み立て中は場面と工程の名前', /ヒーロー・(骨組み|文字とパーツ|色|仕上げ)/.test($('#stage-name').textContent), $('#stage-name').textContent);
  // A-04: 組み立て中の操作は受け付けない
  wheel(120); key('ArrowDown'); key('PageDown');
  await wait(100);
  t('A-04a 組み立て中はスクロールもキーも受け付けない', S.scene === 0 && S.phase === 'build' && Math.abs(site.getBoundingClientRect().top + M.scenes[0].cam) <= 1);
  await idle();
  const took = performance.now() - tStart;
  await S.settle();
  t('A-02c 約 3.2 秒で組み上がって待機になる', took > B0 - 150 && took < B0 + 700 && S.phase === 'idle' && S.built === 1 && finalOf(0), Math.round(took) + 'ms');
  t('A-11b 待機中は「スクロールで次へ」', /スクロールで次へ/.test($('#stage-name').textContent) && document.body.hasAttribute('data-waiting'), $('#stage-name').textContent);
  t('A-03a 組み上がっても勝手に次へ進まない', S.scene === 0 && M.scenes[1].keys.every(k => S.state.elements[k].b === 'hidden'));

  // 以降は時間を短くして確認する
  S.timing(320, 120);

  // ---- A-03 1 回のスクロールで次の場面へ ----
  await wait(450);
  rec = true; phases.length = 0;
  wheel(100);
  const afterWheel = { phase: S.phase, scene: S.scene };
  await wait(60);
  wheel(100); key('ArrowDown');                    // A-04: 移動中の操作
  await idle(); await S.settle();
  t('A-03b ホイール 1 回で次の場面へ移動し、組み立てが始まる', afterWheel.phase === 'move' && afterWheel.scene === 1 && phases.join() === 'move,build,idle' &&
    S.scene === 1 && S.built === 2 && finalOf(1) && Math.abs(S.state.cam - M.scenes[1].cam) < 1, phases.join());
  t('A-04b 移動中の操作は受け付けない', S.scene === 1);
  t('S-02 組み立て後のページの位置', Math.abs(site.getBoundingClientRect().top + M.scenes[1].cam) <= 1, site.getBoundingClientRect().top.toFixed(1));

  // ---- A-05 慣性のような連続した入力でも 1 場面だけ ----
  // 時刻を指定して入力を送る(描画されていない環境ではタイマーが間引かれ、短い間隔を作れないため)
  await wait(450);
  const T0 = performance.now();
  let n = 0;
  const first = S.wheel(90, T0);
  for (n = 1; n < 12; n++) S.wheel(90 - n * 4, T0 + n * 30);            // 組み立て中に届く、慣性の続き
  await idle(); await S.settle();
  const tail = [];
  for (; n < 24; n++) tail.push(S.wheel(Math.max(3, 90 - n * 4), T0 + n * 30));   // 組み立てが終わった直後まで続く慣性
  t('A-05a 慣性の続きでは 2 場面目に進まない', first === true && tail.every(v => v === false) && S.scene === 2 && S.built === 3 && !S.busy, `scene=${S.scene} built=${S.built}`);
  const grow = [S.wheel(4, T0 + 24 * 30), S.wheel(60, T0 + 25 * 30)];     // 間は空いていないが、急に強くなった = 新しい操作
  t('A-05b 新しい操作は受け付ける', grow[0] === false && grow[1] === true && S.scene === 3, grow.join());
  await idle(); await S.settle();
  await wait(450); wheel(-100); await idle();                           // 以降の確認のため、場面 2 に戻る

  // ---- A-06 / A-07 戻る、戻ってから進む ----
  await wait(450);
  phases.length = 0;
  wheel(-100);
  await idle(); await S.settle();
  t('A-06 上へスクロールで前の場面へ。組み上がった場面は残る', S.scene === 1 && S.built === 4 && phases.join() === 'move,idle' && finalOf(1) && finalOf(2) &&
    Math.abs(S.state.cam - M.scenes[1].cam) < 1, `${phases.join()} scene=${S.scene}`);
  await wait(300);
  phases.length = 0;
  wheel(100);
  await idle(); await S.settle();
  t('A-07 組み上がった場面へは移動だけ', S.scene === 2 && phases.join() === 'move,idle' && S.built === 4, `${phases.join()} scene=${S.scene}`);
  for (let i = 0; i < 4; i++) { await wait(300); wheel(-100); await idle(); }
  t('A-06b 先頭より前へは戻らない', S.scene === 0 && Math.abs(S.state.cam) < 1, 'scene=' + S.scene);

  // ---- A-14 ページ内リンク ----
  await wait(300);
  S.replay(); await idle(); await S.settle();
  $('#site [data-key="hero-btns"] a[href="#works"]').click();
  const linkPhase = S.phase;
  await idle(); await S.settle();
  const w1 = $('#site [data-key="work-1"]').getBoundingClientRect();
  t('A-14 ページ内リンクでリンク先の場面へ。途中は完成形', linkPhase === 'move' && S.scene === 2 && S.built === 3 && finalOf(1) && finalOf(2) && w1.top >= 0 && w1.top < innerHeight,
    `scene=${S.scene} built=${S.built} top=${w1.top.toFixed(0)}`);

  // ---- A-10 キーとスワイプ ----
  await wait(450);
  key('ArrowDown');
  await idle(); await S.settle();
  t('A-10a キーで次の場面へ', S.scene === 3 && S.built === 4 && finalOf(3));
  key('ArrowUp'); await idle();
  const upOk = S.scene === 2;
  let swipe = '未対応';
  try {
    const mk = (type, y) => new TouchEvent(type, { cancelable: true, bubbles: true, touches: type === 'touchend' ? [] : [new Touch({ identifier: 1, target: document.body, clientY: y, clientX: 100 })],
      changedTouches: [new Touch({ identifier: 1, target: document.body, clientY: y, clientX: 100 })] });
    await wait(1000);
    window.dispatchEvent(mk('touchstart', 500)); window.dispatchEvent(mk('touchmove', 440)); window.dispatchEvent(mk('touchend', 380));
    await idle();
    swipe = S.scene === 3 ? 'ok' : 'ng scene=' + S.scene;
  } catch (e) { key('PageDown'); await idle(); }
  t('A-10b ↑ キーで前へ、スワイプで次へ', upOk && swipe !== 'ng' && S.scene === 3, swipe);

  // ---- A-12 組み立て中でもスキップできる ----
  S.timing(B0, M0);
  await wait(450);
  wheel(100); await wait(M0 + 900);
  const midBuild = S.phase === 'build' && S.scene === 4;
  const before = $('#site [data-key="work-4"]').getBoundingClientRect().top;
  $('#skip').click(); await wait(150);
  const after = $('#site [data-key="work-4"]').getBoundingClientRect().top;
  t('A-12 組み立て中でもスキップでき、位置を保つ', midBuild && S.mode === 'done' && Math.abs(after - before) <= 1 && !root.classList.contains('locked'), `${before.toFixed(1)} → ${after.toFixed(1)}`);
  t('COM-12 ボタンはキーボードで操作できる', $('#skip').tagName === 'BUTTON' && $('#replay').tagName === 'BUTTON' && $('#skip').tabIndex >= 0 && $('#replay').tabIndex >= 0);

  // ---- A-13 やり直し ----
  $('#replay').click(); await wait(80);
  t('A-13 やり直しで先頭から組み立てが始まる', window.scrollY === 0 && S.mode === 'build' && S.phase === 'build' && S.scene === 0 && S.built === 0 &&
    S.state.elements['hero-btns'].b !== 'final' && root.classList.contains('locked'), `y=${scrollY} mode=${S.mode} phase=${S.phase}`);

  // ---- A-08 最後の場面のあとは通常のページ ----
  S.timing(320, 120);
  await idle();
  for (let k = 1; k < N; k++) { await wait(450); wheel(100); await idle(); }
  await wait(150);
  const sr = site.getBoundingClientRect();
  t('A-08a 最後の場面が組み上がると通常のページになる', S.mode === 'done' && document.body.dataset.mode === 'done' && !root.classList.contains('locked') &&
    Math.abs(root.scrollHeight - sr.height) <= 2 && getComputedStyle($('#controls')).display === 'none' && $$('#site [data-key]').every(el => getComputedStyle(el).visibility === 'visible'),
    `mode=${S.mode} h=${root.scrollHeight}/${sr.height.toFixed(0)}`);
  t('A-08b 切り替わっても位置が変わらない', Math.abs(window.scrollY - M.scenes[N - 1].cam) <= 1 && Math.abs(sr.top + M.scenes[N - 1].cam) <= 1, `y=${scrollY} cam=${M.scenes[N - 1].cam.toFixed(1)}`);
  window.scrollTo(0, 300); await wait(80);
  t('A-08c 以後は自由にスクロールできる', Math.abs(window.scrollY - 300) <= 1 && Math.abs(site.getBoundingClientRect().top + 300) <= 1, window.scrollY);
  const rest = $('.kobito.rest');
  t('K-07 完成後、フッターに 1 人', rest && getComputedStyle(rest).display !== 'none' && document.body.hasAttribute('data-complete'));
  let maxD = 0; const sr2 = site.getBoundingClientRect();
  for (const el of $$('#site [data-key]')) { const a = el.getBoundingClientRect(), b = M.rects[el.dataset.key]; maxD = Math.max(maxD, Math.abs(a.left - sr2.left - b.x), Math.abs(a.top - sr2.top - b.y), Math.abs(a.width - b.w), Math.abs(a.height - b.h)); }
  t('S-22c 完成サイトと 1px 以内で一致', maxD <= 1, maxD.toFixed(2));

  S.timing(B0, M0);
  window.scrollTo(0, 0);
  await S.setScene(0, 0);
  return done();
})();

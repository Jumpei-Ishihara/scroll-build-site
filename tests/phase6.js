/* Phase 6 小人、スマホ幅、動きを減らす設定、再読み込み、性能の目安
 * 対象: SPEC-03 K-01〜K-07 / SPEC-05 A-16 / SPEC-00 COM-30, COM-40〜42, COM-50, COM-51
 * 別の幅と設定は、同じページを iframe で開いて確認する。
 * 実行: fetch('tests/phase6.js').then(r=>r.text()).then(eval) → window.__P6RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P6RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase6] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (window.top !== window) { t('P6-00 iframe 内では実行しない', true); return done(); }
  const S = window.SB;
  if (!S || typeof S.setScene !== 'function') { t('P6-00 SB がない', false); return done(); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const seen = el => { const cs = getComputedStyle(el); return el.getClientRects().length > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };

  if (S.mode !== 'static') {
    if (S.mode === 'done') { S.replay(); await wait(200); }
    const N = S.m.scenes.length;
    const POSES = ['walk', 'pull', 'carry', 'put', 'wave'];

    // ---- K-01 / K-03 ----
    const ws = $$('#crew .worker');
    t('K-01 名前ラベルも矢印もない', ws.length >= 2 && !$('#crew .name') && !$('#crew .arrow') && ws.every(w => w.querySelector('.kobito')), ws.length);
    t('K-03a 動作がそろっている', ws.every(w => POSES.every(p => w.querySelector(`[data-pose^="${p}"]`))));
    const colors = ws.map(w => getComputedStyle(w.querySelector('.helmet')).fill);
    t('K-01b ヘルメットの色で見分けられる', new Set(colors).size === ws.length, colors.join(' '));

    // ---- K-02 固定中だけ画面にいる ----
    let onlyPinned = true, used = new Set(), maxVisible = 0;
    for (let i = 0; i <= 600; i++) {
      const st = S.stateAt(i / 600);
      const vis = Object.values(st.workers).filter(w => w.visible);
      maxVisible = Math.max(maxVisible, vis.length);
      if (!st.pinned && vis.length) onlyPinned = false;
      vis.forEach(w => used.add(w.pose));
    }
    t('K-02 小人がいるのは固定中だけ', onlyPinned && maxVisible >= 2, '最大 ' + maxVisible + ' 人');
    t('K-03b 歩く・引っ張る・運ぶ・置く・手を振るを使う', POSES.every(p => used.has(p)), [...used].join(','));
    t('K-04 人数', maxVisible <= (S.m.mobile ? 2 : 3), maxVisible);
    const enter = S.stateAt(S.pOf(1, 0.001)).workers, mid = S.stateAt(S.pOf(1, 0.4)).workers, leave = S.stateAt(S.pOf(1, 0.995)).workers;
    const off = w => w.x < -20 || w.x > S.m.vw + 20;
    t('K-02b 外から入り、作業して、出ていく', Object.values(enter).filter(w => w.visible).every(off) && Object.values(mid).some(w => w.visible && !off(w)) &&
      Object.values(leave).filter(w => w.visible).every(w => w.pose === 'walk'));
    const fin = S.stateAt(S.pOf(N - 1, 0.99)).workers;
    t('K-06 最後の場面では手を振る', Object.values(fin).some(w => w.visible && w.pose === 'wave' && !off(w)), Object.values(fin).map(w => w.pose).join(','));

    // ---- 描画 ----
    await S.setScene(0, 0.4);
    const vis = ws.filter(seen);
    const k = vis[0] && vis[0].querySelector('.kobito');
    const on = k ? [...k.querySelectorAll('[data-pose]')].filter(g => getComputedStyle(g).display !== 'none') : [];
    t('K-03c 表示するコマは 1 つだけ', vis.length >= 1 && on.length === 1, on.map(g => g.dataset.pose).join(','));
    const h = k ? k.getBoundingClientRect().height : 0;
    t('K-05 小人の大きさ', S.m.mobile ? (h >= 24 && h <= 32) : (h >= 32 && h <= 48), h.toFixed(1));
    // パーツを取りに外へ出ている小人もいるので、全員ではなく 1 人以上が画面内にいることを確認する
    const inView = vis.some(w => { const r = w.querySelector('.kobito').getBoundingClientRect(); return r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; });
    t('K-02c 作業中の小人が画面内にいる', inView);
    await S.setProgress((S.m.scenes[1].s1 + 30) / S.m.maxScroll);
    t('K-02d 移動中は小人を出さない', ws.filter(seen).length === 0 && !S.state.pinned);

    // ---- K-07 完成後 ----
    await S.setProgress(1);
    const rest = $('.kobito.rest');
    t('K-07 完成後、フッターに 1 人', rest && seen(rest) && !!rest.closest('#site footer') && ws.filter(seen).length === 0 && document.body.hasAttribute('data-complete'));
    await S.setScene(0, 0.5);
    t('K-07b 組み立て中はフッターの小人を出さない', rest && !seen(rest));

    // ---- 性能の目安 ----
    const N2 = 300, t0 = performance.now();
    for (let i = 0; i < N2; i++) S.stateAt(i / N2);
    const perState = (performance.now() - t0) / N2;
    t('COM-50a 状態の計算は 1 回 1 ミリ秒未満', perState < 1, perState.toFixed(3) + 'ms');
    const t1 = performance.now();
    for (let i = 0; i <= 60; i++) S.setProgress(i / 60);      // 待たずに、状態の計算と DOM への反映だけを測る
    const perFrame = (performance.now() - t1) / 61;
    t('COM-50b 1 コマあたりの更新は 4 ミリ秒未満', perFrame < 4, perFrame.toFixed(2) + 'ms');
    await wait(150); await S.setScene(0, 0);
  }
  const own = performance.getEntriesByType('resource').filter(e => e.name.startsWith(location.origin) && !/\/tests\//.test(e.name));
  const bytes = own.reduce((a, e) => a + (e.decodedBodySize || 0), 0);
  t('COM-51a 自前のファイルは合計 100KB 未満(圧縮前)', bytes > 0 && bytes < 100 * 1024, (bytes / 1024).toFixed(1) + 'KB / ' + own.length + ' 件');

  // ---- iframe で別の設定を確認 ----
  async function open(url, w, h) {
    const f = document.createElement('iframe');
    f.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;opacity:0.01;pointer-events:none;z-index:9999`;
    f.src = url;
    document.body.appendChild(f);
    await new Promise(r => f.addEventListener('load', r, { once: true }));
    for (let i = 0; i < 60 && !f.contentWindow.SB; i++) await wait(50);
    await wait(250);
    return f;
  }
  const disp = (w, s) => { const el = w.document.querySelector(s); return el ? w.getComputedStyle(el).display : 'なし'; };

  {
    const f = await open('./?motion=reduce', 1100, 700), w = f.contentWindow, d = w.document, T = w.SB;
    const site = d.querySelector('#site').getBoundingClientRect(), h1 = d.querySelector('#site h1').getBoundingClientRect();
    t('COM-30a 演出なしで static', T && T.mode === 'static' && d.body.dataset.mode === 'static');
    t('COM-30b 小人・進行表示・案内が出ない', disp(w, '#crew') === 'none' && disp(w, '#controls') === 'none' && disp(w, '#replay') === 'none' && !d.documentElement.classList.contains('locked'));
    t('COM-30c 最初から完成サイト', h1.top > 0 && h1.top < 500 && w.getComputedStyle(d.body).visibility === 'visible' &&
      [...d.querySelectorAll('#site [data-key]')].every(el => w.getComputedStyle(el).visibility === 'visible') && Math.abs(d.documentElement.scrollHeight - site.height) <= 2,
      `${d.documentElement.scrollHeight}/${site.height.toFixed(0)}`);
    f.remove();
  }
  {
    const f = await open('./', 375, 700), w = f.contentWindow, d = w.document, T = w.SB;
    const cw = d.documentElement.clientWidth;
    t('COM-41a スマホ幅でも演出が動く', T && T.mode === 'build' && T.m.mobile === true);
    await T.setScene(2, 0.5);
    const n = Object.values(T.state.workers).length;
    t('K-04 スマホでは 2 人以下', n >= 1 && n <= 2, n);
    t('COM-40 スマホ幅で横スクロールなし', d.documentElement.scrollWidth <= cw, d.documentElement.scrollWidth + '/' + cw);
    const kb = [...d.querySelectorAll('#crew .worker')].map(x => x.querySelector('.kobito').getBoundingClientRect().height)[0];
    t('K-05 スマホでの小人の大きさ', kb >= 24 && kb <= 32, kb);
    const tops = [];
    for (const q of [0, 0.5, 1]) { await T.setScene(2, q); tops.push(d.querySelector('#site').getBoundingClientRect().top); }
    t('S-02 スマホ幅でも固定中は動かない', Math.max(...tops) - Math.min(...tops) <= 1, tops.map(v => v.toFixed(1)).join(','));
    f.remove();
  }
  {
    const f = await open('./', 1100, 700), w = f.contentWindow, d = w.document;
    let T = w.SB;
    await T.setScene(2, 0.5);
    f.style.width = '600px'; await wait(300);
    T.refresh(); await wait(200);       // 描画されていない環境では resize が届かないので直接呼ぶ(自動の再計算は手動確認の対象)
    const st = T.state;
    const domOk = [...d.querySelectorAll('#site [data-key]')].every(el => el.dataset.b === st.elements[el.dataset.key].b);
    t('COM-42 幅を変えても同じ場面・同じ進み具合', st.pinned && st.scene === 2 && Math.abs(st.q[2] - 0.5) < 0.03 && T.m.mobile === true && domOk &&
      d.documentElement.scrollWidth <= d.documentElement.clientWidth, `scene=${st.scene} q=${st.q[2].toFixed(3)} mobile=${T.m.mobile}`);
    f.style.width = '1100px'; await wait(300); T.refresh(); await wait(200);
    await w.SB.setScene(3, 0.5);
    w.location.reload();
    await new Promise(r => f.addEventListener('load', r, { once: true }));
    for (let i = 0; i < 60 && !f.contentWindow.SB; i++) await wait(50);
    await wait(1200);
    T = f.contentWindow.SB;
    const st2 = T && T.state;
    t('A-16 再読み込みしても同じ場面で、前の場面は完成形', T && T.mode === 'build' && T.scene === 3 && T.built >= 3 && st2.elements['work-1'].b === 'final' &&
      st2.elements['contact'].b === 'hidden' && Math.abs(st2.cam - T.m.scenes[3].cam) < 1 && (T.phase === 'build' || T.built === 4),
      T ? `scene=${T.scene} built=${T.built} phase=${T.phase}` : 'SB なし');
    f.remove();
  }
  return done();
})();

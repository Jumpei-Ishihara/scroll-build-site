/* Phase 4 スマホ構成・動きを減らす設定・幅の変更・性能の受け入れテスト
 * 対象: SPEC-00 COM-06, COM-30, COM-40〜42, COM-51 / SPEC-01 画面構成(T-C-08)
 * 別の幅と設定は、同じページを iframe で開いて確認する。
 * 実行: fetch('tests/phase4.js').then(r=>r.text()).then(eval) → window.__P4RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P4RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase4] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (window.top !== window) { t('P4-00 iframe 内では実行しない', true); return done(); }

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

  // ---- COM-30 動きを減らす設定 ----
  {
    const f = await open('./?motion=reduce', 1100, 700), w = f.contentWindow, d = w.document;
    const S = w.SB;
    t('COM-30a 演出なしで static', S && S.mode === 'static' && d.body.dataset.mode === 'static', S && S.mode);
    t('COM-30b ツール UI と進行表示が出ない', disp(w, '#tool') === 'none' && disp(w, '#tool-bg') === 'none' && disp(w, '#controls') === 'none');
    const h1 = d.querySelector('#site h1').getBoundingClientRect();
    const site = d.querySelector('#site').getBoundingClientRect();
    t('COM-30c 最初から完成サイトが見える', w.scrollY === 0 && h1.top > 0 && h1.top < 500 && w.getComputedStyle(d.body).visibility === 'visible' &&
      !d.querySelector('#frame').style.transform && Math.abs(site.width - d.documentElement.clientWidth) <= 1, `h1.top=${h1.top.toFixed(0)}`);
    t('COM-30d 余分なスクロール領域がない', Math.abs(d.documentElement.scrollHeight - site.height) <= 2, `${d.documentElement.scrollHeight} / ${site.height.toFixed(0)}`);
    t('COM-30e やり直しボタンを出さない', disp(w, '#replay') === 'none');
    f.remove();
  }

  // ---- スマホ幅(COM-41、T-C-08) ----
  {
    const f = await open('./', 375, 700), w = f.contentWindow, d = w.document, S = w.SB;
    t('COM-41a スマホ幅でも演出が動く', S && S.mode === 'build' && S.m.mobile === true, S && S.mode);
    t('T-C-08 スマホではパネルを出さない', disp(w, '#t-layers') === 'none' && disp(w, '#t-props') === 'none');
    await S.setProgress(0.4);
    const ids = Object.keys(S.state.cursors);
    t('COM-41b スマホではカーソルを 2 人以下に減らす', ids.length >= 1 && ids.length <= 2, ids.join(','));
    const cw = d.documentElement.clientWidth;   // スクロールバーを除いた幅
    t('COM-40 スマホ幅で横スクロールなし', d.documentElement.scrollWidth <= cw && cw <= 375, d.documentElement.scrollWidth + '/' + cw);
    const fr = d.querySelector('#frame').getBoundingClientRect();
    t('COM-41c 縮小したページが画面幅に収まる', fr.left >= 0 && fr.right <= cw + 0.5, `${fr.left.toFixed(1)}〜${fr.right.toFixed(1)}`);
    const k = d.querySelector('#tool .cur[data-cur="a"] .kobito').getBoundingClientRect().height;
    t('C-25 スマホでの小人の大きさ', k >= 24 && k <= 32, k.toFixed(1));
    await S.setProgress(1);
    const sr = d.querySelector('#site').getBoundingClientRect();
    t('C-13 スマホ幅でも公開後にずれない', S.mode === 'done' && Math.abs(sr.left) <= 1 && Math.abs(sr.top) <= 1 && Math.abs(sr.width - cw) <= 1, `${sr.left},${sr.top.toFixed(1)},${sr.width}/${cw}`);
    f.remove();
  }

  // ---- COM-42 幅を変えても進行度を保つ / COM-06 再読み込み ----
  {
    const f = await open('./', 1100, 700), w = f.contentWindow, d = w.document;
    let S = w.SB;
    await S.setProgress(0.5);
    const before = S.progress;
    f.style.width = '600px';
    await wait(400);
    // 画面が描画されていない環境では resize イベントが届かないので、再計算を直接呼ぶ。
    // resize から再計算が自動で走ることは、このテストでは確認できない(手動確認の対象)
    S.refresh();
    await wait(300);
    const st = S.state;
    const domOk = [...d.querySelectorAll('#site [data-key]')].every(el => el.dataset.b === st.elements[el.dataset.key].b);
    t('COM-42a 幅を変えても進行度を保つ', Math.abs(S.progress - before) < 0.03 && S.mode === 'build', `${before.toFixed(3)} → ${S.progress.toFixed(3)}`);
    t('COM-42b 幅の変更後も崩れない', S.m.mobile === true && domOk && d.documentElement.scrollWidth <= d.documentElement.clientWidth && Object.keys(st.cursors).length <= 2,
      `mobile=${S.m.mobile} sw=${d.documentElement.scrollWidth}`);
    f.style.width = '1100px';
    await wait(300); S.refresh(); await wait(300);
    await w.SB.setProgress(0.5);
    const y = w.scrollY;
    w.location.reload();
    await new Promise(r => f.addEventListener('load', r, { once: true }));
    for (let i = 0; i < 60 && !f.contentWindow.SB; i++) await wait(50);
    await wait(700);
    S = f.contentWindow.SB;
    t('COM-06 途中で再読み込みしても同じ位置', S && Math.abs(S.progress - 0.5) < 0.03 && S.mode === 'build' && S.state.stage === 3,
      S ? `p=${S.progress.toFixed(3)} y=${f.contentWindow.scrollY}/${y}` : 'SB なし');
    f.remove();
  }

  // ---- 性能の目安 ----
  {
    const S = window.SB;
    if (S && S.mode !== 'static') {
      const y0 = window.scrollY;
      const N = 300, t0 = performance.now();
      for (let i = 0; i < N; i++) S.stateAt(i / N);
      const perState = (performance.now() - t0) / N;
      t('COM-50a 状態の計算は 1 回 1 ミリ秒未満', perState < 1, perState.toFixed(3) + 'ms');
      const t1 = performance.now();
      for (let i = 0; i <= 40; i++) { window.scrollTo(0, i * 80); window.ScrollTrigger.update(); }
      const perFrame = (performance.now() - t1) / 41;
      t('COM-50b スクロール 1 回あたりの更新は 4 ミリ秒未満', perFrame < 4, perFrame.toFixed(2) + 'ms');
      window.scrollTo(0, y0);
    }
    const own = performance.getEntriesByType('resource').filter(e => e.name.startsWith(location.origin) && !/\/tests\//.test(e.name));
    const bytes = own.reduce((a, e) => a + (e.decodedBodySize || 0), 0);
    t('COM-51a 自前のファイルは合計 300KB 未満(圧縮前)', bytes > 0 && bytes < 300 * 1024, (bytes / 1024).toFixed(1) + 'KB / ' + own.length + ' 件');
  }

  return done();
})();

/* Phase 1 骨格(段階 0・1・5、モード、スキップ)の受け入れテスト
 * 対象: SPEC-00 COM-01〜23, COM-31, COM-40 / SPEC-01 C-05, C-10, C-13
 * 実行: fetch('tests/phase1.js').then(r=>r.text()).then(eval) → window.__P1RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P1RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase1] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const S = window.SB;
  t('P1-01 SB の API', S && ['stateAt', 'setProgress', 'onProgress'].every(k => typeof S[k] === 'function') && 'mode' in S && 'state' in S);
  if (!S || typeof S.stateAt !== 'function') return done();
  if (S.mode === 'static') { t('P1-00 演出なしのため対象外', true, 'static'); return done(); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const keys = $$('#site [data-key]');
  const N = keys.length;
  const y0 = window.scrollY;

  // ---- 状態(スクロール不要) ----
  const s0 = S.stateAt(0);
  t('COM-01a 進行度0は段階0・未配置', s0.stage === 0 && s0.layers.length === 0, `stage=${s0.stage} layers=${s0.layers.length}`);
  const sEnd1 = S.stateAt(0.28);
  t('C-10a 段階1の終わりで全要素が箱', N >= 6 && sEnd1.layers.length === N && Object.values(sEnd1.elements).every(e => e.b === 'box' && e.t === 1),
    `layers=${sEnd1.layers.length}/${N}`);
  let mono = true, prev = -1;
  for (let p = 0.08; p <= 0.28001; p += 0.01) { const n = S.stateAt(p).layers.length; if (n < prev) mono = false; prev = n; }
  t('COM-01b 段階1で配置数が単調に増える', mono);
  t('COM-01c 同じ進行度は同じ状態', JSON.stringify(S.stateAt(0.2)) === JSON.stringify(S.stateAt(0.2)));
  const s1 = S.stateAt(1);
  t('C-13a 進行度1で縮小なし', s1.frame.s === 1 && s1.frame.x === 0 && s1.frame.y === 0 && s1.toolVisible === 0, JSON.stringify(s1.frame));
  const sMid = S.stateAt(0.5);
  t('COM-04a 演出中は縮小表示', sMid.frame.s > 0.2 && sMid.frame.s < 1 && sMid.toolVisible === 1, 's=' + sMid.frame.s);

  // ---- 描画 ----
  await S.setProgress(0);
  t('COM-04b 開始時は build モード', document.body.dataset.mode === 'build' && S.mode === 'build', document.body.dataset.mode);
  t('C-05a 演出中はツール UI が見える', getComputedStyle($('#tool')).display !== 'none');
  t('COM-31 ツール UI は読み上げ対象外', $('#tool').getAttribute('aria-hidden') === 'true' && $('#tool').hasAttribute('inert'));

  await S.setProgress(0.2);
  const st = S.state;
  const domOk = keys.every(el => el.dataset.b === st.elements[el.dataset.key].b);
  t('COM-01d DOM が状態と一致', domOk && Math.abs(S.progress - 0.2) < 0.01, 'p=' + S.progress);
  t('COM-05 段階名の表示', $('#stage-name') && $('#stage-name').textContent.trim().length > 0 && $$('#controls [data-seg]').length === 6, $('#stage-name') && $('#stage-name').textContent);

  await S.setProgress(0.28);
  const f = S.state.frame, m = S.m.rects, k0 = keys[1];
  const r = k0.getBoundingClientRect(), mr = m[k0.dataset.key];
  const boxOk = Math.abs(r.left - (f.x + mr.x * f.s)) <= 1 && Math.abs(r.top - (f.y + mr.y * f.s)) <= 1 &&
    Math.abs(r.width - mr.w * f.s) <= 1 && Math.abs(r.height - mr.h * f.s) <= 1;
  t('C-10b 箱が完成サイトと同じ位置・大きさ(縮小後)', boxOk, `${r.left.toFixed(1)},${r.top.toFixed(1)} ${r.width.toFixed(1)}x${r.height.toFixed(1)}`);

  // ---- 公開 ----
  await S.setProgress(1);
  t('COM-04c 進行度1で done モード', S.mode === 'done' && document.body.dataset.mode === 'done', S.mode);
  t('C-05b / COM-22 ツール UI が消えている', getComputedStyle($('#tool')).display === 'none' && getComputedStyle($('#tool-bg')).display === 'none');
  const sr = $('#site').getBoundingClientRect();
  let maxD = 0;
  for (const el of keys) {
    const a = el.getBoundingClientRect(), b = m[el.dataset.key];
    maxD = Math.max(maxD, Math.abs(a.left - sr.left - b.x), Math.abs(a.top - sr.top - b.y), Math.abs(a.width - b.w), Math.abs(a.height - b.h));
  }
  t('C-13b 完成サイトと 1px 以内で一致', maxD <= 1 && Math.abs(sr.left) <= 1 && Math.abs(sr.top) <= 1 && Math.abs(sr.width - document.documentElement.clientWidth) <= 1,
    `maxD=${maxD.toFixed(2)} site=${sr.left.toFixed(1)},${sr.top.toFixed(1)} w=${sr.width}`);
  const top = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
  t('COM-22b 画面中央は完成サイト', top && !!top.closest('#site'), top && top.tagName);

  // ---- 巻き戻し ----
  await S.setProgress(0.2);
  t('COM-02 巻き戻し', S.mode === 'build' && JSON.stringify(S.state.elements) === JSON.stringify(S.stateAt(S.progress).elements) && Math.abs(S.progress - 0.2) < 0.01, 'p=' + S.progress);

  // ---- スキップとやり直し ----
  const skip = $('#skip'), replay = $('#replay');
  t('COM-12 ボタンはキーボードで操作できる', skip && replay && skip.tagName === 'BUTTON' && replay.tagName === 'BUTTON' && skip.tabIndex >= 0 && replay.tabIndex >= 0);
  if (skip && replay) {
    skip.click();
    await new Promise(r => setTimeout(r, 500));
    t('COM-10 スキップで公開完了へ', S.progress >= 0.999 && S.mode === 'done', 'p=' + S.progress);
    replay.click();
    await new Promise(r => setTimeout(r, 500));
    t('COM-11 やり直しで先頭へ', window.scrollY === 0 && S.progress < 0.01 && S.mode === 'build', `y=${window.scrollY} p=${S.progress}`);
  }

  // ---- 完成サイト ----
  const h1 = $('#site h1');
  t('COM-20 見出しが HTML にある', h1 && (h1.getAttribute('aria-label') || h1.textContent).trim().length > 4);
  const src = await fetch(location.pathname).then(r => r.text());
  t('COM-23 HTML の初期値は static', /<body[^>]*data-mode="static"/.test(src) && /<h1/.test(src));
  t('COM-21 セクション構成', ['header', 'main', 'footer'].every(s => $('#site ' + s)) && $$('#site [data-key^="card-"]').length === 3);
  t('COM-40 横スクロールなし', document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + '/' + window.innerWidth);

  window.scrollTo(0, y0);
  return done();
})();

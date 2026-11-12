/* 全スイート一括実行
 * 実行: ページ上で fetch('tests/run-all.js').then(r=>r.text()).then(eval) → window.__ALLRESULTS
 * フェーズを追加したら suites に番号を足す(tests/phase<番号>.js、結果は window.__P<番号>RESULTS)
 */
(async () => {
  const suites = ['1', '2', '3', '4'];
  const out = {};
  for (const n of suites) {
    const src = await fetch(`tests/phase${n}.js?all=${Date.now()}`).then(r => r.text());
    await eval(src);
    await new Promise(r => setTimeout(r, 250));
    out['phase' + n] = window['__P' + n + 'RESULTS'] || null;
  }
  const flat = Object.entries(out).map(([k, v]) => ({
    suite: k,
    total: v ? v.length : 0,
    ng: v ? v.filter(x => !x.pass).length : -1,
    fails: v ? v.filter(x => !x.pass).map(x => x.id) : ['NO RESULT'],
  }));
  window.__ALLRESULTS = flat;
  const totalNg = flat.reduce((a, s) => a + Math.abs(s.ng), 0);
  console.info(`[run-all] ${flat.reduce((a, s) => a + s.total, 0)} tests, ${totalNg} failures`, totalNg ? flat : 'ALL GREEN');
  return flat;
})();

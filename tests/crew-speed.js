/* 小人の人数ごとに、動きの速さを測る(SPEC-06 の検証)
 * 人数を ?crew=N で切り替えた iframe を開き、状態の計算結果から画面内での速さを求める。
 * 実行: fetch('tests/crew-speed.js').then(r=>r.text()).then(eval) → window.__CREW(表は console.table)
 *   window.__CREW_OPTS = { crews: [3, 6], sizes: [[1280, 800]] } で対象を変えられる
 */
(async () => {
  const opts = window.__CREW_OPTS || {};
  const crews = opts.crews || [3, 4, 5, 6, 8];
  const sizes = opts.sizes || [[1280, 800], [375, 700]];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const open = async (url, w, h) => {
    const f = document.createElement('iframe');
    f.style.cssText = `position:fixed;left:0;top:0;width:${w}px;height:${h}px;border:0;opacity:0;pointer-events:none;z-index:-1`;
    f.src = url; document.body.appendChild(f);
    for (let i = 0; i < 100; i++) { await wait(100); const S = f.contentWindow.SB; if (S && S.m && S.timeline) break; }
    await wait(300);
    return f;
  };
  const rows = [];
  for (const [w, h] of sizes) for (const n of crews) {
    const f = await open(`./?crew=${n}`, w, h), S = f.contentWindow.SB, M = S.m;
    const sec = S.buildMs / 1000, STEPS = 1600, dt = sec / STEPS;
    const carry = S.timeline.flatMap(t => t.steps.filter(s => s.action === 'carry').map(s => (s.b - s.a) * sec));
    const sp = { walk: [], carry: [], work: [] };
    let maxOn = 0;
    for (let k = 0; k < M.scenes.length; k++) {
      let prev = null;
      for (let i = 0; i <= STEPS; i++) {
        const ws = S.stateAt(S.pOf(k, i / STEPS)).workers;
        const on = x => x >= 0 && x <= M.vw;
        maxOn = Math.max(maxOn, Object.values(ws).filter(v => v.visible && on(v.x)).length);
        if (prev) for (const [id, v] of Object.entries(ws)) {
          const p = prev[id];
          if (!p || !p.visible || !v.visible || !on(p.x) || !on(v.x) || p.pose !== v.pose) continue;
          const kind = v.pose === 'walk' ? 'walk' : v.pose === 'carry' ? 'carry' : v.pose === 'wave' ? null : 'work';
          if (kind) sp[kind].push(Math.hypot(v.x - p.x, v.y - p.y) / dt);
        }
        prev = ws;
      }
    }
    const stat = a => { const s = [...a].sort((x, y) => x - y); return { mean: Math.round(a.reduce((x, y) => x + y, 0) / (a.length || 1)), p95: Math.round(s[Math.floor(s.length * 0.95)] || 0), max: Math.round(s[s.length - 1] || 0) }; };
    const c = stat(sp.carry), wk = stat(sp.walk), wo = stat(sp.work);
    rows.push({ 幅: w, 人数: S.crew, '運ぶ時間(秒)': +(carry.reduce((x, y) => x + y, 0) / carry.length).toFixed(2), '運ぶ 平均': c.mean, '運ぶ 95%': c.p95, '歩く 平均': wk.mean, '歩く 95%': wk.p95, '歩く 最大': wk.max, '作業 平均': wo.mean, '作業 95%': wo.p95, '画面内の最大人数': maxOn });
    f.remove();
  }
  window.__CREW = rows;
  console.table(rows);
  return rows;
})();

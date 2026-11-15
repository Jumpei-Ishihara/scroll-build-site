/* Phase 7 小人がパーツを運ぶ
 * 対象: SPEC-04 P-01〜P-12
 * 実行: fetch('tests/phase7.js').then(r=>r.text()).then(eval) → window.__P7RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P7RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase7] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  if (window.top !== window) { t('P7-00 iframe 内では実行しない', true); return done(); }
  const S = window.SB;
  if (!S || typeof S.setScene !== 'function') { t('P7-00 SB がない', false); return done(); }
  if (S.mode === 'static') { t('P7-00 演出なしのため対象外', true); return done(); }
  if (S.mode === 'done') { S.replay(); await wait(200); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const M = S.m, N = M.scenes.length;
  const ids = Object.keys(M.parts || {});
  const domParts = $$('#site [data-key] [data-part]');
  t('P7-01 パーツが定義されている', ids.length >= 20 && ids.length === domParts.length, `${ids.length}/${domParts.length}`);
  if (!ids.length) return done();

  // 場面ごとに細かく進めて、状態を集める
  const carried = new Set(), fromOutside = new Set(), order = {};
  let under = true, underD = '', maxCarry = 0, mono = true, slot = true, walkOut = 0, walkOutOk = true, waitDx = true;
  const nWorkers = M.mobile ? 2 : 3;
  const foot = M.mobile ? 25 : 36;
  for (let k = 0; k < N; k++) {
    const prev = {};
    let prevWorkers = null;
    for (let i = 0; i <= 500; i++) {
      const st = S.stateAt(S.pOf(k, i / 500));
      const now = ids.filter(id => st.parts[id].s === 'carry');
      maxCarry = Math.max(maxCarry, now.length);
      const ws = Object.values(st.workers).filter(w => w.visible);
      for (const id of ids) {
        const p = st.parts[id], r = M.parts[id];
        const rank = { wait: 0, carry: 1, placed: 2 }[p.s];
        if (prev[id] !== undefined && rank < prev[id]) mono = false;
        if (prev[id] === 0 && rank === 1) {
          const left = r.x + p.dx, right = left + r.w;
          if (right <= 0 || left >= M.vw) fromOutside.add(id);
          (order[r.key] = order[r.key] || []).push(id);
        }
        prev[id] = rank;
        if (p.s === 'wait' && M.scenes[k].keys.includes(r.key)) { const l = r.x + p.dx; if (!(l + r.w <= 0 || l >= M.vw)) waitDx = false; }
        if (p.s !== 'carry') continue;
        carried.add(id);
        if (st.elements[r.key].b !== 'text') slot = false;
        // 真下に、運ぶ動作の小人がいる
        const cx = r.x + r.w / 2 + p.dx, by = r.y + r.h + p.dy - st.cam + foot;
        const w = ws.find(w => w.pose === 'carry' && Math.abs(w.x - cx) <= 1.5 && Math.abs(w.y - by) <= 1.5);
        if (!w) { under = false; underD = underD || `${id} q=${(i / 500).toFixed(3)}`; }
      }
      // 置いた直後の小人は、歩いて外へ向かう
      if (prevWorkers) for (const [wid, w] of Object.entries(st.workers)) {
        const pw = prevWorkers[wid];
        if (pw && pw.visible && pw.pose === 'carry' && w.visible && w.pose === 'walk') {
          walkOut++;
          const later = S.stateAt(S.pOf(k, Math.min(1, (i + 3) / 500))).workers[wid];
          if (later && later.visible && later.pose === 'walk' && Math.abs(later.x - M.vw / 2) < Math.abs(w.x - M.vw / 2) - 0.01) walkOutOk = false;
        }
      }
      prevWorkers = st.workers;
    }
  }
  t('P-01 全パーツが運ばれる', carried.size === ids.length, `${carried.size}/${ids.length} 未: ${ids.filter(i => !carried.has(i)).slice(0, 4).join(',')}`);
  t('P-02 運び始めは画面の外', fromOutside.size === ids.length, `${fromOutside.size}/${ids.length}`);
  t('P-05 待機中のパーツは画面の外に置く', waitDx);
  t('P-03 運んでいるパーツの真下に小人がいる', under, underD);
  t('P-07 同時に運ぶ数は人数以下', maxCarry >= 2 && maxCarry <= nWorkers, `${maxCarry}/${nWorkers}`);
  t('P-04a 置いたパーツは戻らない', mono);
  t('P-06 置いたあとは歩いて外へ', walkOut >= ids.length * 0.8 && walkOutOk, `${walkOut} 回`);
  t('P-08a 運んでいる間は枠の状態', slot);
  const title = order['hero-title'] || [];
  t('P-09 見出しは 3 つのかたまりで順に運ぶ', title.length === 3 && title.join() === M.partsOf['hero-title'].join(), title.join(' '));

  // 左右
  const sides = ids.map(id => M.parts[id].dx0 < 0 ? 'L' : 'R');
  const sideOk = ids.every(id => { const r = M.parts[id]; return (r.x + r.w / 2 < M.siteW / 2 - 1) === (r.dx0 < 0); });
  t('P-02b 左寄りは左から、それ以外は右から', sideOk && sides.includes('L') && sides.includes('R'), sides.join(''));

  // ---- DOM ----
  const el = id => domParts[ids.indexOf(id)];
  const site = $('#site');
  const inCarry = async (k, want) => {              // 場面 k で、運んでいる最中のパーツがある進み具合を探す
    for (let i = 0; i <= 400; i++) {
      const st = S.stateAt(S.pOf(k, i / 400));
      const c = ids.filter(id => st.parts[id].s === 'carry' && (!want || want(st, id)));
      if (c.length) { await S.setScene(k, i / 400); return c; }
    }
    return [];
  };
  const onScreen = (st, id) => { const r = M.parts[id], l = r.x + st.parts[id].dx; return l < M.vw - 30 && l + r.w > 30 && Math.abs(st.parts[id].dx) > 30 && Math.abs(st.parts[id].dx) < M.vw * 0.5; };
  const c1 = await inCarry(1, onScreen);
  if (c1.length) {
    const id = c1[0], p = S.state.parts[id], r = M.parts[id];
    const b = el(id).getBoundingClientRect(), sr = site.getBoundingClientRect();
    t('P-03b 運んでいるパーツが DOM でもずれている', Math.abs((b.left - sr.left) - (r.x + p.dx)) <= 1.5 && Math.abs((b.top - sr.top) - (r.y + p.dy)) <= 1.5 && getComputedStyle(el(id)).visibility === 'visible',
      `${id} dx=${p.dx} 実測=${(b.left - sr.left - r.x).toFixed(1)}`);
    const key = $(`#site [data-key="${r.key}"]`), cs = getComputedStyle(key);
    t('P-08b 枠が表示されている', key.dataset.b === 'text' && (cs.outlineStyle === 'dashed' || key.hasAttribute('data-surface')), `${r.key} ${cs.outlineStyle}`);
    const waiting = ids.filter(i => S.state.parts[i].s === 'wait');
    t('P-05b 待機中のパーツは非表示', waiting.length > 0 && waiting.every(i => getComputedStyle(el(i)).visibility === 'hidden'), waiting.length);
    const ws = $$('#crew .worker').filter(w => getComputedStyle(w).visibility !== 'hidden' && w.querySelector('.kobito').dataset.pose === 'carry');
    const kb = ws.map(w => w.querySelector('.kobito').getBoundingClientRect());
    const hands = kb.some(q => Math.abs((q.left + q.right) / 2 - (b.left + b.right) / 2) <= 3 && q.top >= b.bottom - 8 && q.top <= b.bottom + 12);
    t('P-03c 小人の手がパーツの下の辺にある', hands, kb.map(q => `${((q.left + q.right) / 2).toFixed(0)},${q.top.toFixed(0)}`).join(' ') + ` / ${((b.left + b.right) / 2).toFixed(0)},${b.bottom.toFixed(0)}`);
    t('P-12 運んでいる最中も横スクロールなし', document.documentElement.scrollWidth <= window.innerWidth, document.documentElement.scrollWidth + '/' + window.innerWidth);
  } else t('P-03b 運んでいる最中の場面が見つかる', false);

  // 工程の終わりで完成サイトと一致
  let maxD = 0;
  for (let k = 0; k < N; k++) {
    await S.setScene(k, 0.67);
    const sr = site.getBoundingClientRect();
    for (const id of M.scenes[k].keys.flatMap(key => M.partsOf[key])) {
      const b = el(id).getBoundingClientRect(), r = M.parts[id];
      maxD = Math.max(maxD, Math.abs(b.left - sr.left - r.x), Math.abs(b.top - sr.top - r.y));
      if (S.state.parts[id].s !== 'placed' || getComputedStyle(el(id)).visibility !== 'visible') maxD = 999;
    }
  }
  t('P-04b 置かれた位置が完成サイトと一致', maxD <= 1, maxD.toFixed(2));

  // 画像は絵が入った状態で運ぶ
  const c2 = await inCarry(2, (st, id) => el(id).classList.contains('thumb'));
  if (c2.length) {
    const th = el(c2[0]);
    t('P-10 画像は絵が入った状態で運ぶ', getComputedStyle(th, '::before').opacity !== '0' && !/gradient/.test(getComputedStyle(th).backgroundImage), getComputedStyle(th).backgroundImage.slice(0, 30));
  } else t('P-10 画像を運ぶ場面が見つかる', false);

  // 巻き戻し
  await S.setScene(2, 0.9); await S.setScene(2, 0.4);
  const same = JSON.stringify(S.state.parts) === JSON.stringify(S.stateAt(S.progress).parts);
  const domSame = ids.every(id => (getComputedStyle(el(id)).visibility === 'hidden') === (S.state.parts[id].s === 'wait' || S.state.elements[M.parts[id].key].b === 'hidden' || S.state.elements[M.parts[id].key].b === 'box'));
  t('P-11 巻き戻すとパーツも戻る', same && domSame && ids.some(id => S.state.parts[id].s !== 'placed' && M.parts[id].key === 'work-2'));

  // スキップ後は全部その場にある
  await S.setScene(1, 0.4);
  $('#skip').click(); await wait(150);
  t('P-04c スキップ後、パーツにずれが残らない', domParts.every(e => !e.style.transform && getComputedStyle(e).visibility === 'visible'));
  $('#replay').click(); await wait(200);

  // スマホ幅
  {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:fixed;left:0;top:0;width:375px;height:700px;border:0;opacity:0.01;pointer-events:none;z-index:9999';
    f.src = './';
    document.body.appendChild(f);
    await new Promise(r => f.addEventListener('load', r, { once: true }));
    for (let i = 0; i < 60 && !f.contentWindow.SB; i++) await wait(50);
    await wait(250);
    const T = f.contentWindow.SB, d = f.contentWindow.document;
    let mc = 0, all = new Set();
    const mids = Object.keys(T.m.parts);
    for (let k = 0; k < N; k++) for (let i = 0; i <= 300; i++) {
      const st = T.stateAt(T.pOf(k, i / 300));
      const c = mids.filter(id => st.parts[id].s === 'carry'); mc = Math.max(mc, c.length); c.forEach(id => all.add(id));
    }
    await T.setScene(1, 0.4);
    t('P-07 スマホでは同時に 2 つまで、全パーツを運ぶ', mc <= 2 && all.size === mids.length, `${mc} / ${all.size}/${mids.length}`);
    t('P-12 スマホ幅で運んでいる最中も横スクロールなし', d.documentElement.scrollWidth <= d.documentElement.clientWidth, d.documentElement.scrollWidth + '/' + d.documentElement.clientWidth);
    f.remove();
  }

  window.scrollTo(0, 0); await S.settle();
  return done();
})();

/* Phase 3 小人の受け入れテスト
 * 対象: SPEC-01 C-20〜C-25
 * 実行: fetch('tests/phase3.js').then(r=>r.text()).then(eval) → window.__P3RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P3RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase3] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const S = window.SB;
  if (!S || typeof S.stateAt !== 'function') { t('P3-00 SB がない', false); return done(); }
  if (S.mode === 'static') { t('P3-00 演出なしのため対象外', true, 'static'); return done(); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const y0 = window.scrollY;
  const POSES = ['hang', 'pull', 'carry', 'put', 'wave'];
  const shown = el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && !!el.offsetParent || (cs.position === 'fixed' && cs.display !== 'none' && cs.visibility !== 'hidden'); };

  // ---- C-20 動作は 5 種類 ----
  const ks = $$('#tool .cur .kobito');
  t('C-20a カーソルごとに小人がいる', ks.length === $$('#tool .cur').length && ks.length >= 2, ks.length);
  t('C-20b 動作は 5 種類', ks.length > 0 && ks.every(k => POSES.every(p => k.querySelector(`[data-pose^="${p}"]`))),
    ks[0] ? [...new Set([...ks[0].querySelectorAll('[data-pose]')].map(g => g.dataset.pose.split('-')[0]))].join(',') : '');

  // ---- C-21 見せ場は段階 1・2・3・5 に 1 か所ずつ ----
  const spots = new Map(), bad = [];
  for (let p = 0; p <= 1.0001; p += 0.002) {
    const st = S.stateAt(Math.min(1, p));
    for (const [id, c] of Object.entries(st.cursors)) {
      if (c.kobito === 'hang') continue;
      if (c.kobito === 'wave') { if (st.stage !== 5 || !st.pressed) bad.push('wave@' + p.toFixed(3)); continue; }
      const key = st.stage + ':' + (c.target || '');
      spots.set(key, c.kobito);
    }
  }
  const stagesWithSpot = [...new Set([...spots.keys()].map(k => +k.split(':')[0]))].sort().join(',');
  t('C-21 見せ場は 4 か所(段階 1・2・3・5)', spots.size === 4 && stagesWithSpot === '1,2,3,5' && bad.length === 0, [...spots].join(' | ') + ' ' + bad.slice(0, 3));
  t('C-20c 公開後は手を振る', S.stateAt(0.95).cursors.a.kobito === 'wave');

  // ---- C-23 巻き戻し中は逆再生しない ----
  await S.setProgress(0.30);
  await S.setProgress(0.36);
  const ka = $('#tool .cur[data-cur="a"] .kobito');
  const fwd = ka && ka.dataset.pose;
  await S.setProgress(0.34);
  const back = ka && ka.dataset.pose;
  await S.setProgress(0.35);
  const fwd2 = ka && ka.dataset.pose;
  t('C-23 巻き戻し中はぶら下がるだけ', fwd === 'carry' && back === 'hang' && fwd2 === 'carry', `${fwd} → ${back} → ${fwd2}`);
  const visPose = ka ? [...ka.querySelectorAll('[data-pose]')].filter(g => getComputedStyle(g).display !== 'none').map(g => g.dataset.pose) : [];
  t('C-20d 表示するコマは 1 つだけ', visPose.length === 1 && visPose[0].startsWith('carry'), visPose.join(','));

  // ---- C-22 止まると待機の動き ----
  const pr = S.setProgress(0.31);
  const moving = document.body.hasAttribute('data-idle');
  await pr; await wait(320);
  const idle = document.body.hasAttribute('data-idle');
  const anim = ka ? getComputedStyle(ka).animationName : 'none';
  t('C-22 止まると待機の動きに切り替わる', !moving && idle && anim !== 'none', `移動中=${moving} 停止後=${idle} anim=${anim}`);

  // ---- C-25 大きさ ----
  await S.setProgress(0.2);
  const h = ka ? ka.getBoundingClientRect().height : 0;
  const mobile = innerWidth < 768;
  t('C-25 小人の大きさ', mobile ? (h >= 24 && h <= 32) : (h >= 32 && h <= 48), `${h.toFixed(1)}px (${mobile ? 'スマホ' : 'デスクトップ'})`);

  // ---- C-24 公開後に残るのは 1 人 ----
  await S.setProgress(1);
  const remain = $$('.kobito').filter(el => { const cs = getComputedStyle(el); return el.getClientRects().length > 0 && cs.visibility !== 'hidden'; });
  t('C-24 公開後に残る小人は 1 人', remain.length === 1 && !!remain[0].closest('#site footer'), remain.length);

  window.scrollTo(0, y0);
  return done();
})();

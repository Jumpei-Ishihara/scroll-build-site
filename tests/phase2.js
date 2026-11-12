/* Phase 2 段階 2〜4 とツール UI の連動の受け入れテスト
 * 対象: SPEC-01 C-01〜C-04, C-11, C-12
 * 実行: fetch('tests/phase2.js').then(r=>r.text()).then(eval) → window.__P2RESULTS
 */
(async () => {
  const R = [];
  const t = (id, pass, detail = '') => R.push({ id, pass: !!pass, detail: String(detail) });
  const done = () => {
    window.__P2RESULTS = R;
    const ng = R.filter(x => !x.pass);
    console.info(`[phase2] ${R.length} tests, ${ng.length} failures`, ng.length ? ng : 'ALL GREEN');
    return R;
  };
  const S = window.SB;
  if (!S || typeof S.stateAt !== 'function') { t('P2-00 SB がない', false); return done(); }
  if (S.mode === 'static') { t('P2-00 演出なしのため対象外', true, 'static'); return done(); }

  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const keys = $$('#site [data-key]');
  const N = keys.length;
  const y0 = window.scrollY;
  const hex = rgb => { const m = rgb.match(/[\d.]+/g).map(Number); return m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(); };
  const count = (st, b) => Object.values(st.elements).filter(e => e.b === b).length;

  // ---- 状態 ----
  let inc = true, last = -1, seen = new Set();
  for (let p = 0.28; p <= 0.40001; p += 0.004) { const c = S.stateAt(p).elements['hero-title'].chars || 0; if (c < last) inc = false; last = c; seen.add(c); }
  t('C-11a 見出しの文字数が単調に増える', inc && seen.size >= 5 && last === S.m.nchars, `最終=${last}/${S.m.nchars} 種類=${seen.size}`);
  let dec = true; last = 1e9;
  for (let p = 0.40; p >= 0.27999; p -= 0.004) { const c = S.stateAt(p).elements['hero-title'].chars || 0; if (c > last) dec = false; last = c; }
  t('C-11b 巻き戻すと単調に減る', dec && last === 0, '最小=' + last);
  t('P2-01 段階2の終わりで全要素が文字', count(S.stateAt(0.48), 'text') === N, count(S.stateAt(0.48), 'text') + '/' + N);
  const cA = count(S.stateAt(0.53), 'color'), cB = count(S.stateAt(0.60), 'color'), cC = count(S.stateAt(0.68), 'color');
  t('C-12 色はセクション単位で順に入る', cA > 0 && cA < cB && cB < cC && cC === N, `${cA} < ${cB} < ${cC}`);
  t('P2-02 段階4の終わりで全要素が仕上げ済み', count(S.stateAt(0.85), 'final') === N);
  const cm1 = S.stateAt(0.73).comment, cm2 = S.stateAt(0.83).comment;
  t('P2-03 コメントピンが付いて解決される', cm1 && !cm1.resolved && cm2 && cm2.resolved, JSON.stringify([cm1, cm2]));
  const fr = [0.1, 0.3, 0.6, 0.84].map(p => S.stateAt(p).frame.s);
  t('P2-04 公開まで縮小率は一定', fr.every(s => Math.abs(s - fr[0]) < 1e-9) && fr[0] < 1, fr.join(','));

  // ---- C-01 レイヤーパネル ----
  let c01 = true, c01d = [];
  for (const p of [0.1, 0.3, 0.6]) {
    await S.setProgress(p);
    const rows = $$('#t-layers [data-layer]').filter(el => !el.hidden).length;
    const placed = keys.filter(el => el.dataset.b !== 'hidden').length;
    c01d.push(`${p}:${rows}/${placed}`);
    if (rows !== placed || rows !== S.state.layers.length) c01 = false;
  }
  t('C-01 レイヤーの行数 = 配置済みの要素数', c01, c01d.join(' '));

  // ---- C-11 描画 ----
  await S.setProgress(0.33);
  const shown = $$('#site [data-key="hero-title"] .ch').filter(el => !el.classList.contains('off')).length;
  t('C-11c 表示文字数が状態と一致', shown === S.state.elements['hero-title'].chars && shown > 0 && shown < S.m.nchars, `${shown}/${S.m.nchars}`);

  // ---- C-02 選択枠 ----
  const sel = S.state.selected, selEl = sel && $(`#site [data-key="${sel}"]`), box = $('#t-sel');
  if (selEl && box) {
    const a = selEl.getBoundingClientRect(), b = box.getBoundingClientRect();
    const ok = getComputedStyle(box).visibility !== 'hidden' && Math.abs(a.left - b.left) <= 2 && Math.abs(a.top - b.top) <= 2 &&
      Math.abs(a.width - b.width) <= 3 && Math.abs(a.height - b.height) <= 3;
    t('C-02 選択枠が要素に重なり寸法を表示', ok && /\d+\s*×\s*\d+/.test($('#t-dim').textContent) && box.querySelectorAll('.h').length === 4,
      `${a.left.toFixed(0)},${a.top.toFixed(0)} vs ${b.left.toFixed(0)},${b.top.toFixed(0)} / ${$('#t-dim').textContent}`);
  } else t('C-02 選択枠が要素に重なり寸法を表示', false, 'selected=' + sel);

  // ---- C-03 プロパティパネル ----
  for (const p of [0.6, 0.8]) {
    await S.setProgress(p);
    const key = S.state.selected, el = key && $(`#site [data-key="${key}"]`);
    if (!el) { t(`C-03 プロパティが実際の見た目と一致 (${p})`, false, 'selected なし'); continue; }
    const cs = getComputedStyle(el);
    const surface = el.hasAttribute('data-surface');
    const actual = hex(surface ? cs.backgroundColor : cs.color);
    const rad = Math.round(parseFloat(cs.borderTopLeftRadius));
    const pf = $('#t-fill').textContent.trim().toUpperCase(), pr = $('#t-radius').textContent.trim();
    t(`C-03 プロパティが実際の見た目と一致 (${p})`, pf === actual && Number(pr) === rad, `${key}: 塗り ${pf}/${actual} 角丸 ${pr}/${rad}`);
  }

  // ---- C-04 カーソル ----
  await S.setProgress(0.2);
  const curs = $$('#tool .cur');
  const names = curs.map(c => c.querySelector('.name').textContent.trim());
  const colors = curs.map(c => getComputedStyle(c.querySelector('.name')).backgroundColor);
  t('C-04 カーソルは名前と色で区別', curs.length >= 2 && new Set(names).size === curs.length && new Set(colors).size === curs.length, names.join(',') + ' ' + colors.length);
  const ca = S.state.cursors.a;
  t('P2-05 作業中のカーソルは画面内', ca && ca.visible && ca.x >= 0 && ca.x <= innerWidth && ca.y >= 0 && ca.y <= innerHeight, JSON.stringify(ca));
  t('P2-06 段階0でカーソルが入室', !S.stateAt(0.002).cursors.a.visible && S.stateAt(0.06).cursors.a.visible);

  window.scrollTo(0, y0);
  return done();
})();

/* 状態 → 画面(SPEC-03、SPEC-04)。書き込みだけ行う */
import { $, $$ } from '../core/util.js';
import { ORDER, WORKERS } from './timeline.js';

export function createRenderer(hooks = {}) {
  const frame = $('#frame'), crew = $('#crew');
  const els = Object.fromEntries(ORDER.map(k => [k, $(`#site [data-key="${k}"]`)]));
  const stageName = $('#stage-name'), segs = $$('#controls [data-seg]');
  // パーツ。ID は measure.js と同じ「要素:番号」
  const partEls = {};
  for (const k of ORDER) $$('[data-part]', els[k]).forEach((el, i) => { partEls[`${k}:${i}`] = el; });

  const workerEls = {};
  for (const [id, color] of Object.entries(WORKERS)) {
    const d = document.createElement('div');
    d.className = 'worker'; d.dataset.w = id; d.style.setProperty('--c', color);
    crew.appendChild(d); workerEls[id] = d;
    if (hooks.mountWorker) hooks.mountWorker(d, id);
  }

  const set = (el, prop, v) => { if (el.style[prop] !== v) el.style[prop] = v; };
  const text = (el, v) => { if (el.textContent !== v) el.textContent = v; };

  return function render(st, M, mode) {
    if (mode !== 'build') {                       // 通常のページ。固定も高さの上乗せもなし
      set(frame, 'transform', '');
      document.body.toggleAttribute('data-complete', mode === 'done');
      for (const el of Object.values(partEls)) { set(el, 'visibility', ''); set(el, 'transform', ''); }
      return;
    }
    // ページは画面に貼り付けてあり、表示位置の分だけ上にずらす(A-09)
    set(frame, 'transform', `translate3d(0, ${(-st.cam).toFixed(2)}px, 0)`);

    for (const k of ORDER) {
      const e = st.elements[k], el = els[k];
      if (el.dataset.b !== e.b) el.dataset.b = e.b;
      if (e.b === 'box') el.style.setProperty('--b', e.t.toFixed(3));
    }
    // パーツ: 待機中は外で隠しておき、運んでいる間は小人と一緒に動かす(P-03〜P-05)
    for (const [id, el] of Object.entries(partEls)) {
      const p = st.parts[id];
      set(el, 'visibility', p.s === 'wait' ? 'hidden' : '');
      set(el, 'transform', p.s === 'placed' ? '' : `translate3d(${p.dx}px, ${p.dy}px, 0)`);
    }

    for (const [id, el] of Object.entries(workerEls)) {
      const w = st.workers[id];
      if (!w || !w.visible) { set(el, 'visibility', 'hidden'); continue; }
      set(el, 'transform', `translate(${w.x}px, ${w.y}px)`);
      set(el, 'visibility', 'visible');
      if (hooks.renderWorker) hooks.renderWorker(el, id, w);
    }

    document.body.toggleAttribute('data-complete', st.complete);
    const sc = M.scenes[st.scene];
    const working = st.pinned && st.q[st.scene] < 1;
    text(stageName, st.complete ? '完成しました' : working ? `${sc.name}・${st.sub}` : st.moving ? sc.name : 'スクロールで次へ ↓');   // A-11
    document.body.toggleAttribute('data-waiting', !st.complete && !working && !st.moving);
    segs.forEach((s, i) => s.style.setProperty('--f', st.q[i].toFixed(3)));
  };
}

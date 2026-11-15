/* 状態 → 画面(SPEC-03、SPEC-04)。書き込みだけ行う */
import { $, $$ } from '../core/util.js';
import { ORDER, WORKERS } from './timeline.js';

export function createRenderer(hooks = {}) {
  const frame = $('#frame'), pin = $('#pin'), crew = $('#crew'), hint = $('#hint');
  const els = Object.fromEntries(ORDER.map(k => [k, $(`#site [data-key="${k}"]`)]));
  const stageName = $('#stage-name'), segs = $$('#controls [data-seg]');
  // パーツ。ID は measure.js と同じ「要素:番号」
  const partEls = {};
  for (const k of ORDER) $$('[data-part]', els[k]).forEach((el, i) => { partEls[`${k}:${i}`] = el; });
  const lastX = {};

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
      frame.classList.remove('pinned');
      set(frame, 'transform', ''); set(pin, 'height', '');
      document.body.toggleAttribute('data-complete', mode === 'done');
      for (const el of Object.values(partEls)) { set(el, 'visibility', ''); set(el, 'transform', ''); }
      return;
    }
    // 固定中はページを画面に貼り付ける。移動中は通常の流れに戻し、終えた固定の分だけ下にずらす(S-02、S-04、S-05)
    set(pin, 'height', (M.siteH + M.holds).toFixed(1) + 'px');
    frame.classList.toggle('pinned', st.pinned);
    set(frame, 'transform', `translate3d(0, ${(st.pinned ? -st.cam : st.off).toFixed(2)}px, 0)`);

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
      if (!w || !w.visible) { set(el, 'visibility', 'hidden'); lastX[id] = null; continue; }
      const tf = `translate(${w.x}px, ${w.y}px)`;
      // 外で次のパーツを取って反対側から入るときなど、離れた場所へ移るときは補間しない
      if (lastX[id] == null || Math.abs(w.x - lastX[id]) > M.vw * 0.5) {
        el.style.transition = 'none'; set(el, 'transform', tf);
        void el.offsetWidth;
        el.style.transition = '';
      } else set(el, 'transform', tf);
      lastX[id] = w.x;
      set(el, 'visibility', 'visible');
      if (hooks.renderWorker) hooks.renderWorker(el, id, w);
    }

    document.body.toggleAttribute('data-complete', st.complete);
    set(hint, 'opacity', st.y < 8 ? '1' : '0');                                  // S-20
    const sc = M.scenes[st.scene];
    text(stageName, st.complete ? '完成しました' : st.pinned ? `${sc.name}・${st.sub}` : 'スクロールして次へ');   // S-21
    segs.forEach((s, i) => s.style.setProperty('--f', st.q[i].toFixed(3)));
  };
}

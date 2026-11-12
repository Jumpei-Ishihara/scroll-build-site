/* 状態 → 画面(SPEC-11 6.3、6.5)。DOM は読まず、書き込みだけ行う */
import { $, $$ } from '../core/util.js';
import { STAGES } from '../core/stages.js';
import { ORDER, LABELS, CURSORS } from './timeline.js';

const ARROW = '<svg class="arrow" viewBox="0 0 18 18"><path d="M2 2l5 14 2.2-5.8L15 8z"/></svg>';

export function createRenderer(chars, hooks = {}) {
  const frame = $('#frame');
  const els = Object.fromEntries(ORDER.map(k => [k, $(`#site [data-key="${k}"]`)]));
  const overlay = $('#t-overlay'), bg = $('#tool-bg');
  const bar = $('#t-bar'), layersEl = $('#t-layers'), propsEl = $('#t-props');
  const sel = $('#t-sel'), dim = $('#t-dim'), fname = $('#t-fname'), pin = $('#t-pin'), pub = $('#t-publish');
  const txt = { name: $('#t-name'), w: $('#t-w'), h: $('#t-h'), x: $('#t-x'), y: $('#t-y'), fill: $('#t-fill'), radius: $('#t-radius') };
  const chip = $('#t-chip'), stageName = $('#stage-name'), segs = $$('#controls [data-seg]');

  // レイヤーの行は最初に全部作り、表示と非表示だけ切り替える
  const list = $('#t-layer-list');
  const rows = {};
  for (const k of ORDER) {
    const d = document.createElement('div');
    d.className = 'layer' + (LABELS[k][1] ? ' in' : '');
    d.dataset.layer = k; d.textContent = LABELS[k][0]; d.hidden = true;
    list.appendChild(d); rows[k] = d;
  }
  const curEls = {};
  for (const [id, c] of Object.entries(CURSORS)) {
    const d = document.createElement('div');
    d.className = 'cur'; d.dataset.cur = id; d.style.setProperty('--c', c.color);
    d.innerHTML = `${ARROW}<span class="name">${c.name}</span>`;
    overlay.appendChild(d); curEls[id] = d;
    if (hooks.mountCursor) hooks.mountCursor(d, id);
  }

  let shownChars = -1;
  const set = (el, prop, v) => { if (el.style[prop] !== v) el.style[prop] = v; };
  const text = (el, v) => { if (el.textContent !== v) el.textContent = v; };

  return function render(st, M, mode, dir) {
    if (mode === 'done') { set(frame, 'transform', ''); return; }
    const f = st.frame, v = st.toolVisible;
    set(frame, 'transform', `translate3d(${f.x.toFixed(2)}px, ${f.y.toFixed(2)}px, 0) scale(${f.s.toFixed(5)})`);
    set(frame, 'boxShadow', v < 0.05 ? 'none' : '');

    // 完成サイトの各要素
    for (const k of ORDER) {
      const e = st.elements[k], el = els[k];
      if (el.dataset.b !== e.b) el.dataset.b = e.b;
      if (e.b === 'box') el.style.setProperty('--b', e.t.toFixed(3));
    }
    const n = st.elements['hero-title'].chars ?? (st.elements['hero-title'].b === 'hidden' || st.elements['hero-title'].b === 'box' ? 0 : chars.length);
    if (n !== shownChars) { chars.forEach((c, i) => c.classList.toggle('off', i >= n)); shownChars = n; }

    // レイヤーパネル(C-01)
    const placed = new Set(st.layers);
    for (const k of ORDER) {
      const row = rows[k];
      if (row.hidden === placed.has(k)) row.hidden = !placed.has(k);
      row.classList.toggle('sel', st.selected === k);
    }

    // プロパティパネル(C-03)と選択枠(C-02)
    const p = st.props;
    if (p) {
      text(txt.name, LABELS[p.key][0]);
      text(txt.w, String(p.w)); text(txt.h, String(p.h)); text(txt.x, String(p.x)); text(txt.y, String(p.y));
      text(txt.fill, p.fill.slice(1)); text(txt.radius, String(p.radius));
      set(chip, 'background', p.fill);
      const r = M.rects[p.key], e = st.elements[p.key], k = e.b === 'box' ? e.t : 1;
      set(sel, 'transform', `translate(${(f.x + r.x * f.s).toFixed(1)}px, ${(f.y + r.y * f.s).toFixed(1)}px)`);
      set(sel, 'width', (r.w * k * f.s).toFixed(1) + 'px');
      set(sel, 'height', (r.h * k * f.s).toFixed(1) + 'px');
      text(dim, `${p.w} × ${p.h}`);
      set(sel, 'visibility', 'visible');
    } else {
      set(sel, 'visibility', 'hidden');
      if (st.stage === 0) for (const el of Object.values(txt)) text(el, '—');
    }
    set(fname, 'transform', `translate(${f.x.toFixed(1)}px, ${(f.y - 24).toFixed(1)}px)`);

    // コメントピン
    if (st.comment) {
      const r = M.rects[st.comment.key];
      set(pin, 'transform', `translate(${(f.x + (r.x + r.w) * f.s + 6).toFixed(1)}px, ${(f.y + r.y * f.s - 30).toFixed(1)}px)`);
    }
    pin.classList.toggle('on', !!st.comment);
    pin.classList.toggle('resolved', !!(st.comment && st.comment.resolved));

    // カーソル
    for (const [id, el] of Object.entries(curEls)) {
      const c = st.cursors[id];
      if (!c || !c.visible) { set(el, 'visibility', 'hidden'); continue; }
      set(el, 'visibility', 'visible');
      set(el, 'transform', `translate(${c.x}px, ${c.y}px)`);
      if (hooks.renderCursor) hooks.renderCursor(el, id, c, dir);
    }

    // 公開: ツール UI が退場する(C-05)
    pub.classList.toggle('pressed', st.pressed);
    text(pub, st.pressed ? '公開しました' : '公開');
    const out = ((1 - v) * 100).toFixed(2);
    set(bar, 'transform', v === 1 ? '' : `translateY(-${out}%)`);
    set(layersEl, 'transform', v === 1 ? '' : `translateX(-${out}%)`);
    set(propsEl, 'transform', v === 1 ? '' : `translateX(${out}%)`);
    set(bg, 'opacity', v.toFixed(3));
    set(overlay, 'opacity', Math.min(1, v * 1.6).toFixed(3));

    // 進行の表示(COM-05)
    text(stageName, STAGES[st.stage].name);
    segs.forEach((s, i) => s.style.setProperty('--f', i < st.stage ? 1 : i === st.stage ? st.local.toFixed(3) : 0));
  };
}

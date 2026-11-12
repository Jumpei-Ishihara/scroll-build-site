import { $, $$ } from '../core/util.js';
import { ORDER } from './timeline.js';

const hex = rgb => {
  const m = rgb.match(/[\d.]+/g).map(Number);
  return { hex: '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(), alpha: m.length > 3 ? m[3] : 1 };
};

/* 見出しを 1 文字ずつ <span class="ch"> に分ける。元の文章は aria-label に残す(COM-20) */
export function splitTitle(el) {
  el.setAttribute('aria-label', el.textContent.replace(/\s+/g, ' ').trim());
  const wrap = document.createElement('span');
  wrap.setAttribute('aria-hidden', 'true');
  while (el.firstChild) wrap.appendChild(el.firstChild);
  el.appendChild(wrap);
  const walk = node => {
    for (const n of [...node.childNodes]) {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const c of n.textContent) {
          if (/\s/.test(c)) { frag.appendChild(document.createTextNode(c)); continue; }
          const s = document.createElement('span');
          s.className = 'ch'; s.textContent = c;
          frag.appendChild(s);
        }
        n.replaceWith(frag);
      } else if (n.nodeType === 1) walk(n);
    }
  };
  walk(wrap);
  return $$('.ch', el);
}

/* 完成形の色と角丸を読む。data-mode="static" の間に 1 回だけ呼ぶ(C-03 の元データ) */
export function measureFinal() {
  const final = {};
  for (const key of ORDER) {
    const el = $(`#site [data-key="${key}"]`);
    const cs = getComputedStyle(el);
    const bg = hex(cs.backgroundColor);
    const surface = bg.alpha > 0;
    if (surface) el.setAttribute('data-surface', '');
    final[key] = { surface, fill: surface ? bg.hex : hex(cs.color).hex, radius: Math.round(parseFloat(cs.borderTopLeftRadius)) || 0 };
  }
  return final;
}

/* 位置と大きさを測る。起動時と画面幅の変更時だけ呼ぶ。スクロール中は呼ばない(SPEC-11 8 章) */
export function measure(chars) {
  const frame = $('#frame'), site = $('#site');
  const prev = frame.style.transform;
  frame.style.transform = 'none';
  const sr = site.getBoundingClientRect();
  const rects = {};
  for (const key of ORDER) {
    const r = $(`#site [data-key="${key}"]`).getBoundingClientRect();
    rects[key] = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
  }
  const chs = chars.map(c => { const r = c.getBoundingClientRect(); return { l: r.left - sr.left, r: r.right - sr.left, b: r.bottom - sr.top }; });
  frame.style.transform = prev;

  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const w = el => (el && getComputedStyle(el).display !== 'none' ? el.getBoundingClientRect().width : 0);
  const L = w($('#t-layers')), Rw = w($('#t-props'));
  const bar = $('#t-bar').getBoundingClientRect().height || 44;
  const pubR = $('#t-publish').getBoundingClientRect();
  const mobile = vw < 768;
  const canvasW = vw - L - Rw;
  const ws = mobile ? 0.74 : (canvasW * 0.84) / vw;        // 作業中の縮小率
  return {
    rects, chars: chs, nchars: chs.length,
    siteW: sr.width, siteH: sr.height, vw, vh, mobile,
    ws, x0: L + (canvasW - vw * ws) / 2, topPad: bar + 44, bar,
    pub: { x: pubR.left + pubR.width * 0.3, y: pubR.top + pubR.height * 0.7 },
  };
}

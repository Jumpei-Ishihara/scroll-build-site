import { $, $$ } from '../core/util.js';
import { ORDER, SCENES, HOLD } from './timeline.js';

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

/* 位置と大きさを測り、場面ごとの固定位置を決める。起動時と画面の大きさの変更時だけ呼ぶ */
export function measure(chars) {
  const site = $('#site');
  const sr = site.getBoundingClientRect();
  const rects = {};
  for (const key of ORDER) {
    const r = $(`#site [data-key="${key}"]`).getBoundingClientRect();
    rects[key] = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
  }
  const chs = chars.map(c => { const r = c.getBoundingClientRect(); return { l: r.left - sr.left, r: r.right - sr.left, b: r.bottom - sr.top }; });

  const vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const siteH = sr.height;
  const maxCam = Math.max(0, siteH - vh);
  const hold = vh * HOLD;
  let passed = 0, prevCam = 0;
  const scenes = SCENES.map(sc => {
    const top = Math.min(...sc.keys.map(k => rects[k].y));
    const bottom = Math.max(...sc.keys.map(k => rects[k].y + rects[k].h));
    const h = bottom - top;
    // S-02: 画面の中央に固定する。S-07: 画面より高い場合は上端を合わせる
    let cam = h <= vh - 40 ? top + h / 2 - vh / 2 : top - 20;
    cam = Math.max(prevCam, Math.min(maxCam, Math.max(0, cam)));   // S-06: 上に戻らない
    const s0 = cam + passed;
    passed += hold; prevCam = cam;
    return { id: sc.id, name: sc.name, keys: sc.keys, top, h, cam, hold, s0, s1: s0 + hold };
  });
  return {
    rects, chars: chs, nchars: chs.length, scenes,
    siteW: sr.width, siteH, vw, vh, mobile: vw < 768,
    maxCam, holds: passed, maxScroll: maxCam + passed,
  };
}

import { $, $$ } from '../core/util.js';
import { ORDER, SCENES, HOLD } from './timeline.js';

const hex = rgb => {
  const m = rgb.match(/[\d.]+/g).map(Number);
  return { hex: '#' + m.slice(0, 3).map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase(), alpha: m.length > 3 ? m[3] : 1 };
};

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
export function measure() {
  const site = $('#site');
  const sr = site.getBoundingClientRect();
  const rects = {};
  for (const key of ORDER) {
    const r = $(`#site [data-key="${key}"]`).getBoundingClientRect();
    rects[key] = { x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height };
  }
  const vw = sr.width, vh = window.innerHeight;   // 幅はスクロールバーの分を除いた、ページの実際の幅

  // パーツ(小人が運ぶ単位)。運んでいる途中は transform でずれているので、transform の影響を受けない offset で測る
  const parts = {}, partsOf = {};
  for (const key of ORDER) {
    partsOf[key] = $$('[data-part]', $(`#site [data-key="${key}"]`)).map((el, i) => {
      let x = 0, y = 0;
      for (let n = el; n && n !== site; n = n.offsetParent) { x += n.offsetLeft; y += n.offsetTop; }
      const w = el.offsetWidth, h = el.offsetHeight;
      // P-02: 置き場所が左寄りなら左の外から、それ以外は右の外から入る。dx0 は運び始めのずれ
      const dx0 = x + w / 2 < sr.width / 2 - 1 ? -(x + w + 70) : vw - x + 70;
      const id = `${key}:${i}`;
      parts[id] = { key, x, y, w, h, dx0 };
      return id;
    });
  }
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
    rects, parts, partsOf, scenes,
    siteW: sr.width, siteH, vw, vh, mobile: vw < 768,
    maxCam, holds: passed, maxScroll: maxCam + passed,
  };
}

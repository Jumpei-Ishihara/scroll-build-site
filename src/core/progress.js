/* スクロール位置 → 進行度 → 状態 → 描画(SPEC-11 1.2、4.1)
 * opts: { stateAt(p), render(state, mode, dir), remeasure() }
 */
const DONE_AT = 0.9995;
const wait = ms => new Promise(r => setTimeout(r, ms));

export function createProgress(opts) {
  const { gsap, ScrollTrigger } = window;
  gsap.registerPlugin(ScrollTrigger);
  const listeners = [];
  const proxy = { p: 0 };
  let state = null, mode = 'build', lastP = 0;

  function apply(p) {
    const dir = p < lastP ? -1 : p > lastP ? 1 : 0;
    lastP = p;
    state = opts.stateAt(p);
    const next = p >= DONE_AT ? 'done' : 'build';
    if (next !== mode || document.body.dataset.mode !== next) { mode = next; document.body.dataset.mode = next; }
    opts.render(state, mode, dir);
    for (const fn of listeners) fn(p, state);
  }

  const trigger = ScrollTrigger.create({
    trigger: '#pin',
    start: 'top top',
    end: () => '+=' + window.innerHeight * 5,       // COM-03: 画面 5 枚分
    pin: true,
    pinSpacing: true,
    invalidateOnRefresh: true,
    onUpdate(self) {
      const target = self.progress;
      // 両端は遅らせない。固定が外れる瞬間に縮小が残るのを防ぐ
      if (target <= 0 || target >= 1 || Math.abs(target - proxy.p) > 0.25) {
        gsap.killTweensOf(proxy); proxy.p = target; apply(target);
      } else {
        gsap.to(proxy, { p: target, duration: 0.25, ease: 'power2.out', overwrite: true, onUpdate: () => apply(proxy.p) });
      }
    },
    onRefresh(self) {                                // COM-42: 幅が変わったら測り直す
      opts.remeasure();
      gsap.killTweensOf(proxy); proxy.p = self.progress; apply(self.progress);
    },
  });

  const api = {
    get progress() { return proxy.p; },
    get state() { return state; },
    get mode() { return mode; },
    onProgress(fn) { listeners.push(fn); if (state) fn(proxy.p, state); },
    stateAt: p => opts.stateAt(p),
    /* テスト用: 進行度 p の位置へ移動し、補間が落ち着くまで待つ */
    async setProgress(p) {
      window.scrollTo(0, trigger.start + (trigger.end - trigger.start) * p);
      ScrollTrigger.update();
      gsap.killTweensOf(proxy);
      proxy.p = trigger.progress; apply(proxy.p);
      await wait(80);
      gsap.killTweensOf(proxy);
      // 色や角丸の補間を終わらせる。画面が描画されていない環境では補間が進まないため、待つだけでは足りない
      for (const a of document.getAnimations()) { if (a.constructor.name === 'CSSTransition') a.finish(); }
      return proxy.p;
    },
    skip() { window.scrollTo(0, trigger.end); ScrollTrigger.update(); },
    replay() { window.scrollTo(0, 0); ScrollTrigger.update(); },
    refresh() { ScrollTrigger.refresh(); },
  };
  opts.remeasure();
  proxy.p = trigger.progress;
  apply(proxy.p);
  return api;
}

/* 同じキャラシートの全身コマで、待機・走り・じゃんけん・勝敗を再生する。 */
(function () {
  "use strict";
  const configs = window.JQMotionAtlases || {};
  const cache = new Map(), records = new WeakMap(), running = new Set();
  const rows = { idle: 0, run: 1, G: 2, C: 3, P: 4, hurt: 5, win: 6, lose: 7, jump: 8, tf: 0 };
  const rates = { idle: 4, run: 12, G: 26, C: 26, P: 26, hurt: 10, win: 7, lose: 6, jump: 12, tf: 12 };
  const W = 384, H = 448, PAD = 64;
  let raf = 0;
  function preload(key) {
    if (cache.has(key)) return cache.get(key);
    const config = configs[key];
    if (!config) return Promise.reject(new Error('No motion atlas: ' + key));
    const promise = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
          const g = canvas.getContext('2d', { willReadFrequently: true });
          g.drawImage(image, 0, 0);
          const data = g.getImageData(0, 0, canvas.width, canvas.height);
          resolve({ config, pixels: new Uint32Array(data.data.buffer), width: canvas.width });
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error('Cannot load motion atlas: ' + key));
      image.src = config.src + (config.src.startsWith('data:') ? '' : '?v=' + (window.JQ_MOTION_VER || window.JQ_VER || '2026-11-08-0044'));
    });
    cache.set(key, promise);
    promise.catch(() => cache.delete(key));
    return promise;
  }
  function keyOf(image) {
    return image.dataset.motionKey || /\/chars\/(c\d+d?)\.png/.exec(image.src)?.[1];
  }
  function render(r, frame, shiftY = 0) {
    if (!r.atlas || r.drawn === frame + ':' + shiftY) return;
    r.drawn = frame + ':' + shiftY;
    const { config, pixels, width } = r.atlas;
    const [l, t, right, bottom, ox, oy] = config.frames[frame], scale = config.scale;
    const x0 = PAD + 136, y0 = PAD + 314 + shiftY;
    r.out.fill(0);
    const xStart = Math.max(0, Math.floor(x0 + (l - ox) * scale));
    const xEnd = Math.min(W, Math.ceil(x0 + (right - ox) * scale));
    const yStart = Math.max(0, Math.floor(y0 + (t - oy) * scale));
    const yEnd = Math.min(H, Math.ceil(y0 + (bottom - oy) * scale));
    for (let y = yStart; y < yEnd; y++) {
      const sy = Math.round((y - y0) / scale + oy);
      if (sy < t || sy >= bottom) continue;
      for (let x = xStart; x < xEnd; x++) {
        const sx = Math.round((x - x0) / scale + ox);
        if (sx < l || sx >= right) continue;
        const color = pixels[sy * width + sx];
        // 低いアルファの背景かぶりを表示せず、キャラの輪郭だけを描く。
        // 最近傍参照で色の補間・白マット・隣のコマのにじみを作らない。
        if ((color >>> 24) >= 224) r.out[y * W + x] = (color | 0xff000000) >>> 0;
      }
    }
    r.context.putImageData(r.output, 0, 0);
    r.canvas.dataset.motion = r.name; r.canvas.dataset.frame = String(frame);
  }
  function schedule() { if (!raf) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    for (const r of running) {
      if (!r.actor.isConnected) { running.delete(r); continue; }
      const homeStandard = r.rate >= 1 && r.actor.classList.contains('home-actor');
      const homePace = homeStandard && (r.name === 'jump' || r.name === 'tf') ? 1.8 : 1;
      const frameMs = 1000 / (r.options.fps || rates[r.name] || 5) * r.rate * homePace;
      const elapsed = Math.max(0, now - r.start);
      const loop = r.name === 'idle' || !!r.options.loop;
      if (!loop && r.options.then && elapsed >= frameMs * 4 + (r.options.hold || 0) * r.rate) {
        play(r.actor, r.options.then, { rate: r.rate }); continue;
      }
      let n = r.options.still ? 0 : loop ? Math.floor(elapsed / frameMs) % 4 : Math.min(3, Math.floor(elapsed / frameMs));
      // ホームの標準待機は立ち姿を長めに保ち、まばたきだけ短くする。
      // 戦闘中と「演出：速い」の既存のテンポは変えない。
      if (r.name === 'idle' && !r.options.still && r.rate >= 1 && r.actor.classList.contains('home-actor')) {
        const phase = elapsed % 4800;
        n = phase < 4000 ? 0 : phase < 4260 ? 1 : phase < 4400 ? 2 : 3;
      }
      // 全身のポーズに跳躍の高さを加える。canvas内をずらさず、髪の見切れを防ぐ。
      const jumpProgress = r.options.still ? 0 : (loop ? elapsed % (frameMs * 4) : Math.min(elapsed, frameMs * 4)) / (frameMs * 4);
      const lift = r.name === 'jump' ? Math.round(Math.sin(Math.PI * jumpProgress) * 32) : 0;
      r.canvas.style.transform = lift ? 'translateY(-' + lift + 'px)' : '';
      const offset = r.name === 'tf' ? [0, -4, -8, 0][n] : 0;
      render(r, (rows[r.name] || 0) * 4 + n, offset);
    }
    if (running.size) schedule();
  }
  function prepare(r) {
    const key = keyOf(r.image);
    if (!key || !configs[key] || r.key === key) return;
    r.key = key; const token = r.token = {};
    preload(key).then(atlas => {
      if (r.token !== token) return;
      r.atlas = atlas; r.drawn = null; r.canvas.dataset.character = key;
      const style = getComputedStyle(r.image);
      Object.assign(r.canvas.style, { position: 'absolute', left: ((parseFloat(style.left) || 0) - 32) + 'px', bottom: ((parseFloat(style.bottom) || 0) - 32) + 'px', width: '192px', height: '224px', maxWidth: 'none', pointerEvents: 'none', imageRendering: 'pixelated' });
      render(r, (rows[r.name] || 0) * 4);
      r.image.style.visibility = 'hidden'; r.canvas.hidden = false;
      r.actor.classList.add('motion-rendered'); running.add(r); schedule();
    }).catch(error => {
      if (r.token !== token) return;
      r.key = null; r.image.style.visibility = ''; r.canvas.hidden = true;
      r.actor.classList.remove('motion-rendered'); running.delete(r);
      console.warn(error.message);
    });
  }
  function play(actor, name, options = {}) {
    let r = records.get(actor);
    if (!r) {
      const image = actor.querySelector('.spr'); if (!image) return;
      const canvas = document.createElement('canvas'); canvas.className = 'sprm'; canvas.width = W; canvas.height = H; canvas.hidden = true;
      canvas.setAttribute('aria-hidden', 'true'); image.after(canvas);
      const context = canvas.getContext('2d'), output = context.createImageData(W, H);
      r = { actor, image, canvas, context, output, out: new Uint32Array(output.data.buffer), name: 'idle', start: performance.now(), rate: 1, options: {} };
      records.set(actor, r); image.addEventListener('load', () => prepare(r));
    }
    r.name = name; r.start = performance.now(); r.rate = options.rate || 1; r.options = options; r.drawn = null;
    r.canvas.style.transform = '';
    actor._cur = name; prepare(r);
    if (r.atlas) { running.add(r); render(r, (rows[name] || 0) * 4); schedule(); }
  }
  window.JQMotion = { play, preload };
})();

/* =========================================================
   じゃんけんクエスト：ドット絵（味方・敵・手・アイコン・タロット）
   ルール：濃紺の輪郭線／2.5頭身／髪は4色（光・基本・暗・毛束線）／服は2色のベタ影
           顔（肌）には影を付けない／全員 44×50 ドット（内部は2倍の細かさ）
   ========================================================= */
(function () {
"use strict";
const OUT = "#22204a", SK = "#f8dcc4", HS = "#f8dcc4";
function tone(c, f) {
  if (!/^#[0-9a-f]{6}$/i.test(c)) return c;
  const n = parseInt(c.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const [tr, tg, tb] = f > 0 ? [255, 250, 236] : [34, 32, 74], k = Math.abs(f);
  const m = (a, t) => Math.round(a + (t - a) * k).toString(16).padStart(2, "0");
  return "#" + m(r, tr) + m(g, tg) + m(b, tb);
}
const NOSHADE = new Set([OUT, "#ffffff"]);   // 線も影も付けない（目・口など）
const NOSHADOW = new Set([SK]);               // 線は付けるが影は付けない（肌）
let ZC = 0;                                   // 描いた順番（前後関係）

// 座標は論理ピクセル（ox, oy だけずらして描く）。内部は S 倍の細かさ
function Pix(w, h, S = 2, ox = 0, oy = 0) {
  const W = w * S, H = h * S, OX = ox * S, OY = oy * S;
  const b = Array.from({ length: H }, () => Array(W).fill(null)), m = b.map(r => r.slice()), z = b.map(r => r.map(() => 0));
  const ok = (X, Y) => X >= 0 && Y >= 0 && X < W && Y < H;
  const put = (X, Y, c) => { if (ok(X, Y)) { b[Y][X] = c; m[Y][X] = c; z[Y][X] = ZC; } };
  const lx = X => (X + .5) / S - ox, ly = Y => (Y + .5) / S - oy;
  const P = {
    w, h, S, W, H, b,
    get: (X, Y) => (ok(X, Y) ? b[Y][X] : undefined),
    dot(X, Y, c) { ZC++; put(Math.round(X) + OX, Math.round(Y) + OY, c); return P; },
    hrect(X, Y, rw, rh, c) { ZC++; for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) put(X + x + OX, Y + y + OY, c); return P; },
    set(x, y, c) { return P.hrect(Math.round(x) * S, Math.round(y) * S, S, S, c); },
    ell(cx, cy, rx, ry, c, only) { ZC++; for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { const dx = (lx(X) - cx) / rx, dy = (ly(Y) - cy) / ry; if (dx * dx + dy * dy <= 1 && (!only || only(b[Y][X], lx(X), ly(Y)))) put(X, Y, c); } return P; },
    rect(x0, y0, rw, rh, c, only) { ZC++; for (let Y = Math.round((y0 + oy) * S); Y < Math.round((y0 + rh + oy) * S); Y++) for (let X = Math.round((x0 + ox) * S); X < Math.round((x0 + rw + ox) * S); X++) if (ok(X, Y) && (!only || only(b[Y][X], lx(X), ly(Y)))) put(X, Y, c); return P; },
    tri(ax, ay, bx, by, cx, cy, c) {
      ZC++; const s = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
      for (let Y = Math.floor((Math.min(ay, by, cy) + oy) * S); Y <= Math.ceil((Math.max(ay, by, cy) + oy) * S); Y++) for (let X = Math.floor((Math.min(ax, bx, cx) + ox) * S); X <= Math.ceil((Math.max(ax, bx, cx) + ox) * S); X++) { const px = lx(X), py = ly(Y); const d1 = s(px, py, ax, ay, bx, by), d2 = s(px, py, bx, by, cx, cy), d3 = s(px, py, cx, cy, ax, ay); if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) put(X, Y, c); }
      return P;
    },
    cap(x0, y0, x1, y1, r, c) { const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2 * S) + 1; for (let i = 0; i <= n; i++) { const t = i / n; P.ell(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, r, c); } return P; },
    line(x0, y0, x1, y1, c, t = S) { ZC++; x0 = Math.round((x0 + ox) * S); y0 = Math.round((y0 + oy) * S); x1 = Math.round((x1 + ox) * S); y1 = Math.round((y1 + oy) * S); let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, e = dx + dy; for (;;) { for (let a = 0; a < t; a++) for (let q = 0; q < t; q++) put(x0 + a, y0 + q, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; x0 += sx; } if (e2 <= dx) { e += dx; y0 += sy; } } return P; },
    recolor(from, to, test) { for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) if (b[Y][X] === from && test(lx(X), ly(Y))) b[Y][X] = to; return P; },
    // 毛束・しわなど：base の部分にだけ線を引く（境界線は付かない）。t=2 で太く
    stroke(pts, c, base, t = 1) { ZC++; for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * S * 2) + 1; for (let k = 0; k <= n; k++) { const X0 = Math.round((x0 + ox + (x1 - x0) * k / n) * S), Y0 = Math.round((y0 + oy + (y1 - y0) * k / n) * S); for (let a = 0; a < t; a++) { const X = X0 + a; if (ok(X, Y0) && m[Y0][X] === base) b[Y0][X] = c; } } } return P; },
    lines() {
      const add = [];
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const me = m[Y][X]; if (!me || NOSHADE.has(me)) continue;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!ok(X + dx, Y + dy)) continue; const v = m[Y + dy][X + dx]; if (v && v !== me && !NOSHADE.has(v) && z[Y + dy][X + dx] > z[Y][X]) { add.push([X, Y]); break; } }
      }
      add.forEach(([X, Y]) => { b[Y][X] = OUT; m[Y][X] = OUT; });
      return P;
    },
    // 2色のベタ影：右下のふち＋前のパーツの下
    shade(k = -.26) {
      const src = b.map(r => r.slice()), mat = (X, Y) => (ok(X, Y) ? m[Y][X] : null);
      for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) {
        const me = m[Y][X], c = src[Y][X]; if (!c || NOSHADE.has(me) || NOSHADOW.has(me) || me === OUT) continue;
        const other = (dx, dy) => { const v = mat(X + dx, Y + dy); return v !== me && !(v && NOSHADE.has(v)); };
        let sh = [[3, 0], [0, 3], [2, 2], [3, 2], [2, 3], [3, 1], [1, 3]].some(([dx, dy]) => other(dx, dy));
        for (let d = 1; d <= 3 && !sh; d++) { const v = mat(X, Y - d); if (v && v !== me && !NOSHADE.has(v) && v !== OUT && z[Y - d][X] > z[Y][X]) sh = true; }
        if (sh) b[Y][X] = tone(c, k);
      }
      return P;
    },
    outline() { const add = []; for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) if (!b[Y][X] && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => P.get(X + dx, Y + dy))) add.push([X, Y]); add.forEach(([X, Y]) => { b[Y][X] = OUT; m[Y][X] = OUT; }); return P; },
    finish() { return P.lines().shade().outline(); },
    draw(g, dx = 0, dy = 0) { for (let Y = 0; Y < H; Y++) for (let X = 0; X < W; X++) { const c = b[Y][X]; if (c) { g.fillStyle = c; g.fillRect(dx + X, dy + Y, 1, 1); } } },
    canvas() { const c = document.createElement("canvas"); c.width = W; c.height = H; P.draw(c.getContext("2d")); return c; },
  };
  return P;
}

// ---- 目：キャラごとに形を変える ----
function face(p, cx, y, o = {}) {
  const S = p.S, Y = Math.round(y * S), eye = o.eye || "#4a5a9a", pupil = tone(eye, -.55), light = tone(eye, .45), W = "#ffffff", sk = o.skin || SK;
  [eye, pupil, light].forEach(c => NOSHADE.add(c)); if (o.browColor) NOSHADE.add(o.browColor);
  const shape = o.closed ? "closed" : o.slit ? "slit" : o.shape || "std";
  if (shape === "none") return;
  for (const s of [-1, 1]) {
    const X = Math.round((cx + s * 4.6) * S) - 3, inner = s < 0 ? 1 : -1, outer = s < 0 ? X - 1 : X + 6;
    if (shape === "closed") { p.dot(X, Y + 4, OUT); p.hrect(X + 1, Y + 5, 4, 1, OUT); p.dot(X + 5, Y + 4, OUT); }
    else if (shape === "slit") { p.hrect(X, Y + 2, 6, 3, eye); p.hrect(X - 1, Y + 1, 7, 1, OUT); p.hrect(X + 2, Y + 2, 2, 3, pupil); p.hrect(X, Y + 5, 6, 1, OUT); p.dot(outer, Y, OUT); }
    else if (shape === "square") { p.hrect(X - 1, Y + 1, 8, 2, OUT); p.hrect(X, Y + 3, 6, 3, eye); p.hrect(X + 2, Y + 3, 2, 3, pupil); p.dot(X + 1, Y + 3, W); p.hrect(X, Y + 6, 6, 1, OUT); }
    else if (shape === "cat") { p.hrect(X, Y + 1, 6, 2, OUT); p.dot(outer, Y, OUT); p.dot(outer + (s < 0 ? -1 : 1), Y - 1, OUT); p.hrect(X, Y + 3, 6, 4, eye); p.hrect(X + 2, Y + 3, 2, 4, pupil); p.hrect(X + 1, Y + 6, 4, 1, light); p.dot(X + 1, Y + 3, W); }
    else if (shape === "tare") { p.hrect(X, Y + 1, 6, 1, OUT); p.dot(outer, Y + 2, OUT); p.dot(outer, Y + 3, OUT); p.hrect(X, Y + 2, 6, 5, eye); p.hrect(X + 2, Y + 3, 2, 3, pupil); p.hrect(X + 1, Y + 5, 4, 1, light); p.hrect(X, Y + 6, 1, 1, sk); p.hrect(X + 5, Y + 6, 1, 1, sk); p.dot(X + 1, Y + 3, W); p.dot(X + 4, Y + 5, W); }
    else if (shape === "dot") { p.hrect(X + 1, Y + 2, 4, 5, OUT); p.dot(X + 2, Y + 3, W); }
    else if (shape === "big") { p.hrect(X - 1, Y, 8, 2, OUT); p.hrect(X, Y + 2, 6, 6, eye); p.hrect(X + 2, Y + 3, 2, 5, pupil); p.hrect(X + 1, Y + 6, 4, 1, light); p.hrect(X + 1, Y + 3, 2, 2, W); p.dot(X + 4, Y + 6, W); }
    else if (shape === "fierce") { p.hrect(X - 1, Y + 1, 8, 2, OUT); p.hrect(X, Y + 3, 6, 3, W); p.hrect(X + (s < 0 ? 3 : 1), Y + 3, 2, 3, eye); p.hrect(X + 1, Y + 6, 4, 1, OUT); }
    else if (shape === "squint") { p.hrect(X, Y + 4, 6, 1, OUT); p.dot(X + (s < 0 ? 0 : 5), Y + 3, OUT); p.dot(outer, Y + 5, OUT); }
    else if (shape === "glow") { p.hrect(X, Y + 1, 6, 5, OUT); p.hrect(X + 1, Y + 2, 4, 3, eye); p.dot(X + 2, Y + 2, W); }
    else if (shape === "hollow") { p.hrect(X, Y + 1, 6, 6, OUT); p.hrect(X + 2, Y + 3, 2, 2, eye); }
    else { p.hrect(X - (s < 0 ? 1 : 0), Y, 7, 2, OUT); p.hrect(X, Y + 2, 6, 5, eye); p.hrect(X + 2, Y + 3, 2, 4, pupil); p.hrect(X, Y + 2, 6, 1, pupil); p.hrect(X + 1, Y + 6, 4, 1, light); p.dot(X + 1, Y + 3, W); }
    const br = o.brow || "normal", bc = o.browColor || OUT, by = Y - 4;
    const slope = (k, t) => { for (let i = 0; i < 6; i++) p.hrect(X + i, by + Math.round((inner > 0 ? i : 5 - i) * k), 1, t, bc); };
    if (br === "angry") slope(.6, 2);
    else if (br === "sharp") slope(.3, 2);
    else if (br === "thick") p.hrect(X - 1, by, 8, 3, bc);
    else if (br === "kind") { p.hrect(X + 1, by, 4, 1, bc); p.dot(X, by + 1, bc); p.dot(X + 5, by + 1, bc); }
    else if (br !== "none") p.hrect(X, by + 1, 6, 1, bc);
  }
}

// ---- じゃんけんの手（0=グー 1=チョキ 2=パー）----
function handPix(h, size = 24, skin = HS) {
  const k = size / 24, p = Pix(size, size), S = skin, S2 = tone(skin, -.14);
  NOSHADOW.add(S);
  const E = (x, y, rx, ry, c) => p.ell(x * k, y * k, Math.max(.8, rx * k), Math.max(.8, ry * k), c);
  const C = (x0, y0, x1, y1, r, c) => p.cap(x0 * k, y0 * k, x1 * k, y1 * k, Math.max(.8, r * k), c);
  const L = (x0, y0, x1, y1) => p.line(x0 * k, y0 * k, x1 * k, y1 * k, OUT, 1);
  if (h === 0) { E(12, 14, 8.5, 7.5, S); for (let i = 0; i < 4; i++) E(6 + i * 4, 9, 2.3, 3.2, S); for (let i = 1; i < 4; i++) L(4 + i * 4, 7, 4 + i * 4, 12); C(6, 17, 15, 15.5, 2.4, S2); }
  else if (h === 1) { E(12, 17, 6.5, 5.5, S); C(9.5, 14, 5.5, 3, 2.3, S); C(14.5, 14, 18.5, 3, 2.3, S); E(15.5, 17.5, 2.6, 2.4, S2); C(7, 20, 13, 18.5, 2, S2); }
  else { E(12, 16, 6.8, 6.2, S); C(7, 13, 3, 4, 1.9, S); C(10, 11.5, 9, 1.5, 1.9, S); C(13.5, 11.5, 14.5, 1.5, 1.9, S); C(16.5, 13, 20, 4.5, 1.9, S); C(17, 17, 22.5, 13.5, 2, S2); }
  return p.finish();
}

// ---- 人型の体（味方・敵共通）。頭は大きく、服は裾の広がった形 ----
const CX = 20, HY = 14, OY = 3;   // OY：角・王冠などがはみ出ないように上に余白
function body(o) {
  const p = Pix(44, 50, 2, 0, OY), W = o.wide ? 1.5 : 0, cl = o.cloth, sk = o.skin || SK;
  NOSHADOW.add(sk); if (o.handSkin) NOSHADOW.add(o.handSkin);
  if (o.back) o.back(p);
  if (!o.noBody) {
    p.cap(14.5 - W, 25, 12.5 - W, 32, 2, o.sleeve || cl);                                                         // うしろの腕
    if (o.trim) p.ell(12.6 - W, 31.8, 1.9, 1, o.trim);
    p.ell(12.5 - W, 33.5, 1.9, 1.9, o.handSkin || sk);
    p.rect(15.5 - W, 35, 3.5 + W, 7, o.pants); p.rect(21, 35, 3.5 + W, 7, o.pants);                               // 脚
    p.rect(15 - W, 41, 4.5 + W, 3, o.shoes || "#4a3a2a"); p.rect(20.5, 41, 4.5 + W, 3, o.shoes || "#4a3a2a");     // 靴
    p.ell(CX, 24.5, 6.5 + W, 2.5, cl); p.rect(14 - W, 24.5, 12 + 2 * W, 10.5, cl);                                // 胴（すそが広がる）
    p.tri(14 - W, 29, 14 - W, 35, 12.8 - W, 35, cl); p.tri(26 + W, 29, 26 + W, 35, 27.2 + W, 35, cl);
    if (o.trim) p.stroke([[12.9 - W, 34.6], [27.1 + W, 34.6]], o.trim, cl, 1), p.stroke([[12.9 - W, 34.1], [27.1 + W, 34.1]], o.trim, cl, 1);
    if (o.belt) p.rect(14 - W, 33.2, 12 + 2 * W, 1.6, o.belt);
    if (o.body) o.body(p, W);
  }
  if (o.head) o.head(p);
  else {
    p.ell(CX, HY, 10.5, 10, sk);
    p.ell(CX - 10, HY + 2, 1.5, 2.2, sk); p.ell(CX + 10, HY + 2, 1.5, 2.2, sk);
    if (o.hair) o.hair(p);
    if (o.hairColor) hairTone(p, o.hairColor, o.tips);
    face(p, CX, HY + .5, Object.assign({ skin: sk }, o.face || {}));
    (o.mouth || (q => q.hrect(CX * 2 - 1, (HY + 7) * 2, 3, 1, OUT)))(p);
  }
  if (o.front) o.front(p);
  return p.finish();
}
// 髪：毛先と右側は暗く、頭のてっぺんから毛束の線、左上に光の筋
function hairTone(p, H, tips = [12.5, 16.5, 20.5, 24.5, 28]) {
  const lt = tone(H, .4), dk = tone(H, -.32), ln = tone(H, -.5);
  p.recolor(H, dk, (x, y) => y > 11.6 || x > 28.6);
  for (const t of tips) p.stroke([[20 + (t - 20) * .25, 2.2], [20 + (t - 20) * .7, 6.5], [t, 11]], ln, H);
  for (const [x0, y0, x1, y1] of [[12.6, 7.4, 14.6, 4.4], [16.2, 6.6, 17.6, 3.4], [21, 5.6, 21.6, 3]]) p.stroke([[x0, y0], [x1, y1]], lt, H, 2);
}
const capH = (p, c, bottom = 11.5, ry = 8.5) => p.ell(CX, HY - 3, 11.6, ry, c, (v, x, y) => y < bottom);
const bangs = (p, c, list) => list.forEach(([x0, x1, tx, ty]) => p.tri(x0, 9, x1, 9, tx, ty, c));

/* ---------- 味方 9人（id はゲームのキャラ番号）---------- */
const STEEL = "#aab4c8";
const ALLY = {
  1: { /* テツ */ hairColor: "#34407a", cloth: "#56607a", pants: "#353650", handSkin: STEEL, belt: "#2a2a3a", trim: "#e8b84a", shoes: "#4a3a2a",
    face: { brow: "thick", eye: "#7a5a3a", shape: "square" }, tips: [13, 17, 21, 25, 28.5],
    body: p => { p.rect(16, 27, 8, 6, "#9aa6bc"); p.stroke([[16.5, 29.5], [23.5, 29.5]], "#7a86a0", "#9aa6bc"); p.hrect(33, 55, 2, 2, "#e8b84a"); p.hrect(45, 55, 2, 2, "#e8b84a"); p.ell(13.5, 25, 3.6, 2.6, STEEL); p.ell(26.5, 25, 3.6, 2.6, STEEL); },
    hair: p => { const H = "#34407a"; capH(p, H); for (let i = 0; i < 6; i++) p.tri(9 + i * 4, 7, 13.5 + i * 4, 7, 10 + i * 4 + (i > 2 ? 3 : -1), 1 + (i % 2) * 1.5, H);
      p.rect(9.2, 9, 2, 6, H); p.rect(28.8, 9, 2, 6, H); bangs(p, H, [[11, 15, 12, 13], [15, 20, 17, 13.5], [20, 25, 23, 13], [25, 29, 28, 12.5]]);
      p.rect(9, 8.5, 22, 2, "#e8b84a"); p.tri(30, 8.5, 37, 6.5, 36, 12, "#e8b84a"); },
    mouth: p => p.hrect(37, 42, 6, 1, OUT) },
  2: { /* キリ */ hairColor: "#f07aa8", cloth: "#c8406e", pants: "#2a2238", shoes: "#3a2a3a", trim: "#e8b84a",
    face: { brow: "sharp", eye: "#d0405a", shape: "cat" },
    back: p => { for (const s of [-1, 1]) { const x = 20 + s * 8; p.line(x, 28, x + s * 6, 17, "#d0d4e0"); p.rect(x + s * 6 - 1.5, 13.5, 3, 3.5, "#3a2a2a"); p.rect(x + s * 6 - 2, 16.8, 4, 1, "#e8b84a"); }
      const H = "#f07aa8"; p.ell(31, 8, 3.5, 5, H); p.ell(33.5, 14, 3, 6, H); p.ell(33.5, 21, 2, 4, H); },
    body: p => { p.rect(14, 23, 12, 2.8, "#e03a3a"); p.tri(23.5, 24, 27.5, 24, 27, 31, "#e03a3a"); p.stroke([[20, 26.5], [20, 33]], "#9a2a52", "#c8406e"); },
    hair: p => { const H = "#f07aa8"; capH(p, H); p.rect(9.2, 9, 2.3, 9, H); p.rect(28.5, 9, 2.3, 6, H); p.tri(10, 9, 22, 9, 12, 14, H); p.tri(18, 9, 30, 9, 27, 13, H); p.rect(28.5, 7, 2, 2, "#ffd166"); } },
  3: { /* ハル */ hairColor: "#5cb070", cloth: "#f2efe6", pants: "#f2efe6", sleeve: "#e4e2d8", shoes: "#4a7a5a", trim: "#5cb070",
    face: { brow: "kind", eye: "#3a9a6a", shape: "tare" },
    back: p => { const H = "#5cb070"; p.ell(20, 13, 12.2, 11, H); p.rect(7.8, 13, 24.4, 16, H); p.tri(7.8, 28, 12, 28, 9, 32, H); p.tri(28, 28, 32.2, 28, 31, 32, H);
      p.line(6.5, 19, 6.5, 44, "#a07040"); p.ell(6.5, 17.5, 2.4, 2.4, "#9fe8b0"); },
    body: p => { p.rect(14, 33, 12, 8, "#f2efe6"); p.rect(14, 40, 12, 1, "#5cb070"); p.rect(19, 26.5, 2, 5.5, "#e04a5a"); p.rect(17.5, 28.2, 5, 2, "#e04a5a"); p.stroke([[16, 33], [16, 40]], "#c8c4d8", "#f2efe6"); },
    hair: p => { const H = "#5cb070"; capH(p, H); p.tri(9, 9, 20, 9, 9.5, 16, H); p.tri(20, 9, 31, 9, 30.5, 16, H); p.tri(14, 9, 21, 9, 17, 13, H);
      p.ell(28, 6.5, 2, 2, "#ffffff"); p.dot(56, 13, "#ff8fa8"); } },
  4: { /* ゴン */ wide: true, hairColor: "#4a3424", cloth: "#f08a3a", pants: "#d0702a", belt: "#2a2236", shoes: "#4a3a2a",
    face: { brow: "thick", eye: "#6a4a2a", shape: "dot" }, tips: [14, 18, 22, 26],
    body: p => { p.tri(17, 23, 23, 23, 20, 28.5, SK); p.rect(19, 33.2, 2, 3.5, "#2a2236"); p.rect(10.5, 31, 3.5, 1.5, "#f0f0ea"); p.stroke([[16, 27], [17.5, 31]], "#c86a22", "#f08a3a"); },
    hair: p => { const H = "#4a3424"; capH(p, H, 10.5, 7); p.rect(9.3, 9, 1.8, 4, H); p.rect(28.9, 9, 1.8, 4, H);
      p.rect(9.3, 8.5, 21.4, 2.2, "#f0f0ea"); p.tri(29, 9, 35, 12, 33, 14.5, "#f0f0ea"); },
    front: p => { p.line(12.5, 19, 15, 21, "#b04040", 1); p.line(12.6, 21, 14.6, 19, "#b04040", 1); },
    mouth: p => { p.hrect(36, 41, 8, 3, OUT); p.hrect(37, 41, 6, 1, "#ffffff"); } },
  5: { /* レン */ hairColor: "#7ab4f0", cloth: "#f4f6fb", pants: "#2a3a6a", sleeve: "#dde4f2", shoes: "#e04a4a",
    face: { brow: "normal", eye: "#3a7ad8", shape: "big" },
    back: p => { p.cap(15, 24, 4, 21, 1.9, "#3a7ad8"); p.cap(4, 21, 0.5, 26, 1.6, "#3a7ad8"); },
    body: p => { p.rect(14, 22.5, 12, 3, "#3a7ad8"); p.rect(14, 28, 12, 1.3, "#3a7ad8"); p.rect(14, 31, 12, 1.3, "#3a7ad8"); },
    hair: p => { const H = "#7ab4f0"; capH(p, H); p.tri(26, 4, 39, 2.5, 30, 11, H); p.tri(27, 9, 38, 11, 29, 14, H); bangs(p, H, [[10, 18, 11, 14], [16, 24, 18, 13], [22, 30, 29, 14.5]]);
      p.rect(9.3, 7, 21.4, 1.6, "#3a3a4a"); p.ell(15.5, 7.6, 2.6, 2, "#ffb03a"); p.ell(24.5, 7.6, 2.6, 2, "#ffb03a"); p.dot(28, 14, "#ffffff"); p.dot(46, 14, "#ffffff"); } },
  6: { /* ナギ */ hairColor: "#40306c", cloth: "#a88ae0", pants: "#a88ae0", sleeve: "#9a7cd2", shoes: "#3a2a6a",
    face: { closed: true, brow: "none" }, tips: [14, 20, 26],
    back: p => { const H = "#40306c"; p.rect(8.5, 10, 23, 20, H); p.tri(12, 33, 3.5, 28, 5.5, 38.5, "#e8c050"); },
    body: p => { p.line(16, 23, 20, 29, "#f4ecdc"); p.line(24, 23, 20, 29, "#f4ecdc"); p.rect(14, 33, 12, 9, "#a88ae0"); p.rect(14, 30.5, 12, 3.5, "#3a2a6a"); p.stroke([[14, 32], [26, 32]], "#e8c050", "#3a2a6a"); p.stroke([[17, 35], [16.5, 41]], "#8a6cc4", "#a88ae0"); },
    hair: p => { const H = "#40306c"; capH(p, H); p.rect(10, 8.5, 20, 4.5, H); p.rect(8.5, 10, 3, 15, H); p.rect(28.5, 10, 3, 15, H); p.rect(27.5, 6.5, 3.5, 1.5, "#e8c050"); },
    mouth: p => p.hrect(39, 42, 2, 1, OUT) },
  7: { /* ガロウ */ hairColor: "#d8402e", cloth: "#2e2838", pants: "#4a3a4a", belt: "#6a4a2a", shoes: "#2a2028",
    face: { brow: "angry", eye: "#e0a030", shape: "fierce" }, tips: [12, 16, 20, 24, 28],
    body: p => { p.rect(18, 23, 4, 11, "#a83a3a"); p.line(15, 24, 25, 24, "#d8d0c0", 1); for (let i = 0; i < 4; i++) p.tri(16.5 + i * 2.2, 24.3, 18.3 + i * 2.2, 24.3, 17.4 + i * 2.2, 27, "#f4ecdc");
      p.tri(14, 33, 16.5, 33, 15, 35.2, null); p.tri(23.5, 33, 26, 33, 25, 35.2, null); },
    hair: p => { const H = "#d8402e"; capH(p, H); for (let i = 0; i < 7; i++) p.tri(8 + i * 4, 8, 12.5 + i * 4, 8, 9 + i * 4 + (i < 3 ? -2.5 : i > 3 ? 3 : 0), -1.5 + (i % 2) * 2, H);
      p.tri(9, 9, 12, 9, 6, 17, H); p.tri(28, 9, 31, 9, 34, 17, H); bangs(p, H, [[11, 15, 12, 14], [15, 19, 17, 13.5], [19, 23, 22, 14], [23, 28, 26, 13]]); },
    front: p => { p.line(17, 19.2, 23, 18.2, "#a83a3a", 1); },
    mouth: p => { p.hrect(37, 42, 6, 1, OUT); p.dot(38, 43, "#ffffff"); p.dot(42, 43, "#ffffff"); } },
  8: { /* イワオ */ wide: true, cloth: "#6e7e60", pants: "#4e4e40", handSkin: "#ecc8a6", shoes: "#3a3028", trim: "#c8a050",
    face: { brow: "thick", browColor: "#f4f4f0", eye: "#5a5a6a", shape: "squint" },
    back: p => { p.ell(8.5, 30, 7, 8.5, "#7a5a3a"); p.ell(8.5, 30, 5, 6.5, "#9a7a52"); p.ell(8.5, 30, 1.8, 1.8, "#c8ccd8"); },
    body: p => { p.rect(15, 28, 10, 6, "#959c86"); p.stroke([[17, 29], [18.5, 31], [18, 33]], "#5e6450", "#959c86"); p.stroke([[22, 29], [23, 32]], "#5e6450", "#959c86"); },
    hair: p => { p.ell(10, 14.5, 1.8, 3.2, "#e8e8e4"); p.ell(30, 14.5, 1.8, 3.2, "#e8e8e4"); p.hrect(26, 9, 3, 2, "#ffffff"); },
    front: p => { const B = "#f0f0ea"; p.ell(20, 24.5, 8, 6.5, B); p.ell(16.5, 20.5, 3.6, 1.7, B); p.ell(23.5, 20.5, 3.6, 1.7, B); p.stroke([[17, 23], [18, 29]], "#c8c8c0", B); p.stroke([[23, 23], [22, 29]], "#c8c8c0", B); },
    mouth: () => {} },
  9: { /* カゲ */ cloth: "#2f6a6e", pants: "#1e4042", belt: "#7fd6d6", shoes: "#1e4042",
    face: { brow: "sharp", eye: "#c8303a", slit: true },
    back: p => { p.line(27, 27, 34, 16, "#c8ccd8"); p.rect(33, 12.5, 2.5, 4, "#3a2a2a"); p.cap(28, 9.5, 38, 7.5, 1.3, "#7fd6d6"); p.cap(28, 10.5, 37, 12, 1.1, "#7fd6d6"); },
    body: p => { p.stroke([[16, 26], [24, 33]], "#24575a", "#2f6a6e"); },
    hair: p => { const H = "#2f6a6e"; p.ell(20, 13.5, 11.8, 11, H, (v, x, y) => y < 13.3 || x < 10.6 || x > 29.4); p.rect(8.5, 8.5, 23, 2, "#7fd6d6"); p.rect(17, 8.5, 6, 2, "#c8ccd8"); p.stroke([[13, 4], [11, 9]], "#3e8488", H, 2); },
    front: p => { p.ell(20, 20, 10.4, 5.5, "#2f6a6e", (v, x, y) => y >= 18.6); p.stroke([[13, 21], [27, 21]], "#24575a", "#2f6a6e"); },
    mouth: () => {} },
  10: { /* シズク：封じの札を持つ巫女 */ hairColor: "#2a2440", cloth: "#f4f2ee", pants: "#c8303a", sleeve: "#e6e2dc", shoes: "#3a2a2a", trim: "#c8303a",
    face: { brow: "normal", eye: "#7a4ab0", shape: "tare" },
    back: p => { const H = "#2a2440"; p.rect(9, 10, 22, 22, H); p.rect(17.5, 30, 5, 1.6, "#f4f2ee");
      p.rect(31, 18, 4, 7, "#f4ecc8"); p.line(32, 20, 34, 20, "#c8303a"); p.line(33, 21.5, 33, 24, "#c8303a"); },
    body: p => { p.tri(16, 23, 24, 23, 20, 28, "#c8303a"); p.tri(17, 23, 23, 23, 20, 26.5, "#f4f2ee"); p.rect(14, 31, 12, 2, "#c8303a"); p.stroke([[17, 34], [16.5, 41]], "#9a2028", "#c8303a"); },
    hair: p => { const H = "#2a2440"; capH(p, H); bangs(p, H, [[10, 16, 12, 14], [15, 21, 18, 13.5], [20, 26, 23, 14], [25, 30, 28.5, 13]]);
      p.rect(9, 10, 2.4, 14, H); p.rect(28.6, 10, 2.4, 14, H); p.rect(27, 6.5, 4, 2, "#c8303a"); p.rect(28, 8.5, 2, 1.5, "#f4f2ee"); },
    mouth: p => p.hrect(38, 42, 4, 1, OUT) },
  11: { /* ツツミ：大きな布で包む子 */ hairColor: "#f6a8c8", cloth: "#fff0f6", pants: "#e88ab0", sleeve: "#f6dde8", shoes: "#c86a90", trim: "#f6b8d8",
    face: { brow: "kind", eye: "#d0508a", shape: "big" },
    back: p => { p.ell(20, 33, 13, 9, "#f6b8d8"); p.ell(20, 33, 11, 7, "#ffd8ea"); },
    body: p => { p.rect(14, 23, 12, 3, "#f6b8d8"); p.ell(20, 24.5, 2.2, 1.6, "#e88ab0"); p.stroke([[17, 28], [17, 33]], "#e8c0d4", "#fff0f6"); },
    hair: p => { const H = "#f6a8c8"; capH(p, H); bangs(p, H, [[10, 16, 12, 14], [15, 22, 18, 13.5], [21, 30, 27, 14]]);
      p.ell(9.5, 13, 3, 4.5, H); p.ell(30.5, 13, 3, 4.5, H); p.ell(29, 5.5, 2.4, 1.8, "#ffffff"); p.ell(31.5, 5.5, 2.4, 1.8, "#ffffff"); } },
  12: { /* ウガチ：錐のような細い刃 */ hairColor: "#e8d860", cloth: "#3a3a5a", pants: "#2a2a40", belt: "#e8d860", shoes: "#2a2a3a", trim: "#e8d860",
    face: { brow: "sharp", eye: "#e0b020", shape: "cat" },
    back: p => { p.line(9, 30, 3, 10, "#e0e4f0"); p.tri(1.8, 10.5, 4.2, 10.5, 3, 5.5, "#ffffff"); p.rect(7.5, 29, 3, 2, "#e8d860"); },
    body: p => { p.tri(14, 23, 26, 23, 20, 30, "#4a4a72"); p.stroke([[20, 24], [20, 33]], "#e8d860", "#3a3a5a"); },
    hair: p => { const H = "#e8d860"; capH(p, H); for (let i = 0; i < 5; i++) p.tri(10 + i * 4.4, 8, 14 + i * 4.4, 8, 12 + i * 4.4 + 2, 0.5 + (i % 2) * 2, H);
      bangs(p, H, [[11, 17, 13, 14.5], [17, 24, 21, 13.5], [24, 30, 28, 14.5]]); },
    mouth: p => p.hrect(37, 42, 6, 1, OUT) },
  13: { /* ホムラ：包帯と炎 */ hairColor: "#ff6a3a", cloth: "#3a2420", pants: "#5a3020", belt: "#ff9a4a", shoes: "#2a1a18", handSkin: "#f4ecdc",
    face: { brow: "angry", eye: "#ff8a2a", shape: "fierce" }, tips: [12, 16, 20, 24, 28],
    back: p => { p.tri(10, 30, 4, 24, 6, 36, "#ff9a4a"); p.tri(30, 30, 36, 24, 34, 36, "#ff9a4a"); },
    body: p => { p.rect(14, 26, 12, 1.5, "#f4ecdc"); p.rect(14, 29, 12, 1.5, "#f4ecdc"); p.stroke([[16, 24], [24, 33]], "#2a1a18", "#3a2420"); },
    hair: p => { const H = "#ff6a3a"; capH(p, H); for (let i = 0; i < 6; i++) p.tri(8.5 + i * 4, 8, 13 + i * 4, 8, 10 + i * 4 + (i < 3 ? -1.5 : 2), -0.5 + (i % 2) * 2.5, i % 2 ? "#ffb03a" : H);
      bangs(p, H, [[11, 16, 12, 14], [16, 22, 19, 13.5], [22, 29, 27, 14]]); p.rect(9, 9.5, 22, 1.8, "#f4ecdc"); },
    front: p => { p.line(23, 18.5, 26, 21.5, "#f4ecdc", 1); },
    mouth: p => { p.hrect(37, 42, 6, 1, OUT); p.dot(41, 43, "#ffffff"); } },
  14: { /* マサ：どっしり構える大男（籠手） */ wide: true, hairColor: "#2a3a4a", cloth: "#4a6a8a", pants: "#2a3a4a", belt: "#c8a050", shoes: "#2a2a30", handSkin: "#8a9ab0", trim: "#c8a050",
    face: { brow: "thick", eye: "#3a5a7a", shape: "square" }, tips: [14, 18, 22, 26],
    body: p => { p.rect(15, 23, 10, 2.5, "#8ab4d8"); p.stroke([[20, 25], [20, 33]], "#3a5a7a", "#4a6a8a"); p.ell(13.5, 25, 3.4, 2.4, "#8a9ab0"); p.ell(26.5, 25, 3.4, 2.4, "#8a9ab0"); },
    hair: p => { const H = "#2a3a4a"; capH(p, H, 10.5, 7); p.rect(9.3, 9, 1.8, 4, H); p.rect(28.9, 9, 1.8, 4, H); p.ell(20, 2.5, 3, 2.5, H); p.rect(18.5, 4.5, 3, 1.2, "#c8a050"); },
    mouth: p => p.hrect(37, 42, 6, 1, OUT) },
  15: { /* トキ：砂時計を背負う時の番人 */ hairColor: "#d8d0c0", cloth: "#5a4a7a", pants: "#3a3050", belt: "#e8c070", shoes: "#2a2438", trim: "#e8c070",
    face: { brow: "normal", eye: "#e8a030" },
    back: p => { p.rect(29, 14, 7, 1.6, "#a07a3a"); p.rect(29, 27, 7, 1.6, "#a07a3a"); p.tri(29.5, 15.6, 35.5, 15.6, 32.5, 21, "#cfe8f0"); p.tri(29.5, 27, 35.5, 27, 32.5, 21.5, "#cfe8f0");
      p.tri(31, 24.5, 34, 24.5, 32.5, 22, "#e8c070"); p.tri(30.5, 27, 34.5, 27, 32.5, 25, "#e8c070"); },
    body: p => { p.rect(14, 23, 12, 2, "#e8c070"); p.ell(20, 28, 2.6, 2.6, "#e8c070"); p.ell(20, 28, 1.7, 1.7, "#f8f0d8"); p.line(20, 28, 20, 26.8, "#3a3050", 0.6); p.line(20, 28, 21, 28, "#3a3050", 0.6); },
    hair: p => { const H = "#d8d0c0"; capH(p, H); bangs(p, H, [[10, 15, 11.5, 14], [15, 21, 18, 13.5], [21, 26, 23.5, 14], [26, 30, 28.5, 13.5]]);
      p.rect(9, 10, 2.2, 10, H); p.rect(28.8, 10, 2.2, 10, H); p.rect(10, 8.8, 20, 1.4, "#e8c070"); },
    mouth: p => p.hrect(38, 42, 4, 1, OUT) },
  16: { /* ミツ：三色の帯を締めた型の使い手 */ hairColor: "#3a5a54", cloth: "#f0ece4", pants: "#3a4a48", belt: "#7ad0c0", shoes: "#2a3230", trim: "#7ad0c0",
    face: { brow: "kind", eye: "#3aa090" },
    body: p => { p.rect(14, 30, 12, 2.2, "#7ad0c0"); p.rect(14.5, 30.4, 3, 1.4, "#e86a6a"); p.rect(18.5, 30.4, 3, 1.4, "#f0c040"); p.rect(22.5, 30.4, 3, 1.4, "#6aa8e8");
      p.stroke([[17, 23], [20, 29], [23, 23]], "#c8c2b8", "#f0ece4"); },
    hair: p => { const H = "#3a5a54"; capH(p, H); bangs(p, H, [[10, 16, 12.5, 14], [16, 22, 19, 13.5], [22, 30, 27, 14]]);
      p.ell(20, 1.8, 2.6, 2.2, H); p.rect(17.6, 3.2, 1.6, 1.2, "#e86a6a"); p.rect(19.2, 3.2, 1.6, 1.2, "#f0c040"); p.rect(20.8, 3.2, 1.6, 1.2, "#6aa8e8"); },
    mouth: p => p.hrect(38, 42, 4, 1, OUT) },
};

/* ---------- 敵：動物・妖怪の頭＋共通の体 ---------- */
const EARS = {
  round: (p, c, i, r = 3.4) => { p.ell(11, 6, r, r, c); p.ell(29, 6, r, r, c); p.ell(11, 6, r / 2, r / 2, i); p.ell(29, 6, r / 2, r / 2, i); },
  big: (p, c, i) => EARS.round(p, c, i, 4.6),
  point: (p, c, i) => { p.tri(8.5, 11, 10, -0.5, 16.5, 5, c); p.tri(23.5, 5, 30, -0.5, 31.5, 11, c); p.tri(10.5, 8, 11, 2.5, 14.5, 5.5, i); p.tri(25.5, 5.5, 29, 2.5, 29.5, 8, i); },
  small: (p, c) => { p.tri(10, 9, 11.5, 3, 15, 6, c); p.tri(25, 6, 28.5, 3, 30, 9, c); },
  tuft: (p, c) => { p.tri(9, 9, 7, 0, 15, 5, c); p.tri(25, 5, 33, 0, 31, 9, c); },
  bat: (p, c, i) => { p.tri(8, 12, 6, -2, 16, 6, c); p.tri(24, 6, 34, -2, 32, 12, c); p.tri(9.5, 9, 8, 1, 14, 6, i); p.tri(26, 6, 32, 1, 30.5, 9, i); },
};
const HORNS = (p, c, tall = 0) => { p.tri(9, 9, 10, -2 - tall, 15, 6, c); p.tri(25, 6, 30, -2 - tall, 31, 9, c); };
function beast(a) {
  return p => {
    const c = a.c, inner = a.in || tone(c, .35); NOSHADOW.add(c);
    if (a.backHead) a.backHead(p);
    if (a.ears) EARS[a.ears](p, c, inner);
    if (a.horns) HORNS(p, a.horns, a.tall || 0);
    if (a.shape === "wide") p.ell(CX, HY + 1, 12, 9.3, c);
    else if (a.shape === "dome") p.ell(CX, HY - 1, 11, 11.5, c);
    else if (a.shape === "box") p.rect(9.5, 4.5, 21, 19, c);
    else p.ell(CX, HY, 10.5, 10, c);
    if (a.under) a.under(p);
    if (a.snout === "muzzle") { p.ell(CX, 19.2, 5.6, 3.6, a.m || inner); p.ell(CX, 17, 1.6, 1.1, OUT); }
    else if (a.snout === "long") { p.ell(23, 19, 7, 3.6, a.m || inner); p.ell(29, 17.4, 1.6, 1.1, OUT); }
    else if (a.snout === "beak") p.tri(17.5, 17, 22.5, 17, CX, 22.5, a.m || "#e8b030");
    else if (a.snout === "hook") { p.tri(17.5, 16.5, 23.5, 16.5, 21.5, 23.5, a.m || "#d8c070"); }
    else if (a.snout === "pig") { p.ell(CX, 18.8, 3.6, 2.5, a.m || inner); p.hrect(37, 37, 2, 2, OUT); p.hrect(41, 37, 2, 2, OUT); }
    face(p, CX, HY + .5 - (a.eyeUp || 0), { shape: a.eye || "dot", eye: a.ec || "#2a2a3a", brow: a.brow || "none", skin: c, browColor: a.bc });
    if (a.mouth === "fang") { p.hrect(37, 44, 7, 1, OUT); p.dot(38, 45, "#ffffff"); p.dot(42, 45, "#ffffff"); }
    else if (a.mouth === "frown") { p.hrect(38, 44, 5, 1, OUT); p.dot(37, 45, OUT); p.dot(43, 45, OUT); }
    else if (a.mouth === "grin") { p.hrect(34, 42, 13, 3, OUT); for (let i = 0; i < 3; i++) p.hrect(35 + i * 4, 42, 3, 1, "#ffffff"); }
    else if (a.mouth === "smile") { p.hrect(38, 44, 5, 1, OUT); p.dot(37, 43, OUT); p.dot(43, 43, OUT); }
    else if (a.mouth !== "none") p.hrect(39, 44, 3, 1, OUT);
    if (a.x) a.x(p);
  };
}
// 人の顔の敵（髪の関数を渡す）
const human = (skin, hair, faceO, mouth) => p => {
  NOSHADOW.add(skin); p.ell(CX, HY, 10.5, 10, skin); p.ell(CX - 10, HY + 2, 1.5, 2.2, skin); p.ell(CX + 10, HY + 2, 1.5, 2.2, skin);
  if (hair) hair(p); face(p, CX, HY + .5, Object.assign({ skin }, faceO)); (mouth || (q => q.hrect(39, 41, 3, 1, OUT)))(p);
};
const tiger = p => { for (const y of [36.4, 39]) p.rect(13, y, 15, .9, "#2a2230", v => v === "#e8b030"); };   // 虎柄のパンツ
const buttons = (p, n = 3, c = "#e8b84a") => { for (let i = 0; i < n; i++) p.hrect(39, 53 + i * 6, 2, 2, c); };
const wings = (c, big = 0) => p => { for (const s of [-1, 1]) { p.tri(20 + s * 8, 22, 20 + s * (19 + big), 12 - big, 20 + s * (15 + big), 35, c); p.stroke([[20 + s * 11, 22], [20 + s * 16, 31]], tone(c, -.35), c); } };

const ENEMY = {
  frog: { cloth: "#262a3a", pants: "#262a3a", handSkin: "#6ab858", shoes: "#1a1a24", trim: "#e8b84a",
    body: p => { buttons(p, 4); p.rect(16.5, 22.5, 7, 2, "#262a3a"); },
    head: p => { const G = "#5aa850"; NOSHADOW.add(G); p.ell(20, 15, 12, 9, G); p.ell(13, 8, 4.6, 4.3, G); p.ell(27, 8, 4.6, 4.3, G); p.ell(20, 20, 8, 3.2, "#c8d890");
      for (const x of [13, 27]) { p.ell(x, 8.2, 3, 2.8, "#f4f0d0"); p.hrect(x * 2 - 3, 16, 6, 2, OUT); p.hrect(x * 2 - 4, 13, 8, 1, OUT); }
      p.ell(20, 6.5, 6.5, 2.6, "#262a3a"); p.rect(14, 7, 13, 1.5, "#262a3a"); p.hrect(38, 12, 4, 2, "#e8b84a");
      p.line(11, 17.5, 29, 17.5, OUT, 1); p.line(27, 17.5, 33, 15, "#3a8a3a", 2); } },
  rat: { cloth: "#5a6a8a", pants: "#3a4660", handSkin: "#c8b8c4", shoes: "#2a2a3a", belt: "#8a6a3a",
    body: p => { p.line(15, 24, 25, 33, "#8a6a3a", 1); }, back: p => p.line(5, 40, 3, 30, "#c8a0b0", 2),
    head: beast({ c: "#9a8f99", ears: "big", in: "#e8a0b0", snout: "muzzle", m: "#d8ccd4", eye: "dot", mouth: "none",
      x: p => { p.ell(20, 5.5, 8.5, 3.4, "#7a8494", (v, x, y) => y < 7.5); p.line(12, 18, 7, 17, OUT, 1); p.line(28, 18, 33, 17, OUT, 1); p.hrect(39, 42, 2, 2, "#ffffff"); } }) },
  sparrow: { cloth: "#d8c8a8", pants: "#8a6a4a", handSkin: "#b07a4f", shoes: "#c89a4a", trim: "#8a6a4a",
    head: beast({ c: "#b07a4f", ears: "tuft", snout: "beak", m: "#3a3030", eye: "dot", mouth: "none", under: p => { p.ell(13, 18, 3, 2.2, "#f4ecdc"); p.ell(27, 18, 3, 2.2, "#f4ecdc"); p.ell(20, 22, 5, 2.6, "#f4ecdc"); } }) },
  tanuki: { cloth: "#c8a060", pants: "#7a5a3a", handSkin: "#5a4632", shoes: "#3a2a1a", belt: "#4a3a2a",
    head: beast({ c: "#8a7458", ears: "round", in: "#4a3a2a", snout: "muzzle", m: "#f0e2c8", eye: "dot", mouth: "smile",
      under: p => { p.ell(15.4, 15.6, 3.6, 2.8, "#4a3a2a"); p.ell(24.6, 15.6, 3.6, 2.8, "#4a3a2a"); }, x: p => { p.tri(17, 4, 23, 4, 22, -1, "#5aa850"); p.stroke([[18, 3.5], [22, 0]], "#3a8a3a", "#5aa850"); } }) },
  snake: { cloth: "#2a5a3a", pants: "#1e4028", handSkin: "#4f9a6a", shoes: "#1a2a1e", trim: "#c8a040",
    head: beast({ c: "#4f9a6a", shape: "wide", eye: "slit", ec: "#e8c040", mouth: "none",
      x: p => { p.stroke([[12, 8], [16, 6], [20, 8], [24, 6], [28, 8]], "#3a7a52", "#4f9a6a"); p.line(14, 21, 26, 21, OUT, 1); p.line(20, 21, 20, 24, "#e04050", 1); p.line(20, 24, 18.5, 25.5, "#e04050", 1); p.line(20, 24, 21.5, 25.5, "#e04050", 1); } }) },
  owl: { cloth: "#4a3a5a", pants: "#3a2a4a", handSkin: "#8a6a4a", shoes: "#c89a4a", trim: "#c8a040",
    head: beast({ c: "#8a6a4a", ears: "tuft", snout: "beak", m: "#e8b030", eye: "big", ec: "#e8a020", mouth: "none",
      under: p => { p.ell(15.4, 15.5, 4.6, 4.2, "#f0e2c8"); p.ell(24.6, 15.5, 4.6, 4.2, "#f0e2c8"); } }) },
  wolf: { cloth: "#3a3040", pants: "#2a2430", handSkin: "#6a7690", shoes: "#1e1a24", trim: "#c84a3a",
    body: p => { p.rect(14, 22.5, 12, 2.6, "#c84a3a"); p.tri(13, 23, 16, 23, 12, 29, "#c84a3a"); },
    head: beast({ c: "#6a7690", ears: "point", in: "#c8ccd8", snout: "long", m: "#d8dce8", eye: "slit", ec: "#e8c040", brow: "angry", mouth: "fang" }) },
  boar: { cloth: "#6a4a32", pants: "#4a3424", handSkin: "#8a5a3a", shoes: "#2a1e14", belt: "#c8a040",
    body: p => { p.rect(15, 26, 10, 6, "#8a8a9a"); },
    head: beast({ c: "#8a5a3a", ears: "small", snout: "pig", m: "#c88a6a", eye: "dot", brow: "angry", mouth: "none",
      x: p => { p.tri(14, 20, 15.5, 20, 13, 16, "#f4f0e0"); p.tri(24.5, 20, 26, 20, 27, 16, "#f4f0e0"); p.stroke([[16, 4], [20, 2], [24, 4]], "#5a3a22", "#8a5a3a", 2); } }) },
  ghost: { noBody: true, handSkin: "#e4e8ff", cloth: "#e4e8ff",
    head: p => { const C = "#e4e8ff"; NOSHADOW.add(C); p.ell(20, 15, 11, 10.5, C); p.rect(9, 15, 22, 12, C); p.ell(14, 28, 6, 5, C); p.cap(19, 30, 27, 40, 3.6, C); p.cap(27, 40, 32, 42, 2, C);
      p.cap(10, 22, 5.5, 26, 1.8, C); face(p, 20, 12, { shape: "hollow", eye: "#8a8aff", brow: "none", skin: C }); for (let i = 0; i < 5; i++) p.hrect(32 + i * 3, 40 + (i % 2) * 2, 3, 2, OUT); } },
  robot: { cloth: "#8f9bb3", pants: "#6a7690", handSkin: "#aab4c8", shoes: "#4a5266", trim: "#e8b84a",
    body: p => { p.rect(16, 27, 8, 5, "#4a5266"); p.hrect(34, 56, 2, 2, "#ff5a5a"); p.hrect(38, 56, 2, 2, "#5aff9a"); p.hrect(42, 56, 2, 2, "#ffd166"); },
    head: beast({ c: "#aab4c8", shape: "box", eye: "glow", ec: "#5ae0ff", mouth: "none",
      under: p => { p.rect(11.5, 12, 17, 6, "#2a3046"); }, x: p => { p.line(20, 4.5, 20, 0, "#6a7690"); p.ell(20, -0.5, 1.4, 1.4, "#ff5a5a"); p.hrect(36, 40, 8, 1, OUT); p.hrect(36, 42, 8, 1, OUT); } }) },
  dragon: { cloth: "#c8a040", pants: "#2f6a4a", handSkin: "#3f8f5f", shoes: "#1e3a2a", belt: "#8a2a2a", back: wings("#2f6a4a"),
    head: beast({ c: "#3f8f5f", horns: "#f0e0b0", snout: "long", m: "#a8d8a0", eye: "slit", ec: "#e04030", brow: "angry", mouth: "fang",
      x: p => { p.stroke([[14, 5], [20, 3.5], [26, 5]], "#2f6a4a", "#3f8f5f", 2); } }) },
  ninja: { cloth: "#4a4f6a", pants: "#34384c", shoes: "#34384c", belt: "#c84a5a",
    head: human(SK, p => { const H = "#4a4f6a"; p.ell(20, 13.5, 11.8, 11, H, (v, x, y) => y < 13.3 || x < 10.6 || x > 29.4); p.rect(8.5, 8.5, 23, 2, "#c84a5a"); p.ell(20, 20, 10.4, 5.5, H, (v, x, y) => y >= 18.6); }, { slit: true, eye: "#e8e8f0", brow: "sharp" }, () => {}) },
  tengu: { cloth: "#f0ece0", pants: "#4a5a8a", handSkin: "#d8463a", shoes: "#8a5a3a", back: p => { wings("#33333f")(p); p.ell(20, 13, 12.6, 12, "#f0ece0"); },
    body: p => { for (const [x, y] of [[16, 26], [24, 26], [16, 30], [24, 30]]) p.ell(x, y, 1.3, 1.3, "#ff8a3a"); },
    head: p => { const R = "#d8463a"; NOSHADOW.add(R); p.ell(20, 14, 10.5, 10, R); p.ell(20, 3.8, 3.4, 2.4, "#1c1c24"); face(p, 20, 14, { brow: "angry", eye: "#ffd166", browColor: "#f0ece0", skin: R });
      p.cap(22, 18, 38, 16.5, 1.8, R); p.ell(38, 16.5, 1.4, 1.4, R); p.hrect(37, 44, 6, 1, OUT); } },
  oni: { wide: true, cloth: "#3a6ac2", pants: "#e8b030", handSkin: "#3a6ac2", shoes: "#2a3a6a", body: tiger, back: p => { p.cap(34, 42, 37, 17, 3, "#6a4a2a"); for (let i = 0; i < 4; i++) p.ell(34.5 + (i % 2) * 3, 19 + i * 5, 1, 1, "#c8ccd8"); },
    head: beast({ c: "#3a6ac2", horns: "#f0d060", eye: "std", ec: "#ffd040", brow: "angry", bc: OUT, mouth: "grin", x: p => p.ell(20, 6.5, 9, 3.5, "#2a2230", (v, x, y) => y < 8) }) },
  octo: { cloth: "#f4f0e8", pants: "#2a3a6a", handSkin: "#c25a8a", shoes: "#2a3a6a", trim: "#3a5ab0",
    back: p => { for (let i = 0; i < 4; i++) p.cap(12 + i * 5.3, 30, 6 + i * 9, 44, 1.6, "#c25a8a"); },
    body: p => { p.tri(15, 23, 25, 23, 20, 28, "#3a5ab0"); },
    head: beast({ c: "#c25a8a", shape: "dome", eye: "std", ec: "#2a2a3a", mouth: "none", x: p => { p.ell(13, 9, 1.6, 1.6, "#e88ab0"); p.ell(27, 6, 1.4, 1.4, "#e88ab0"); p.ell(20, 21, 2.4, 2.4, tone("#c25a8a", -.2)); p.hrect(39, 42, 3, 2, OUT); } }) },
  scorp: { cloth: "#c28a3a", pants: "#8a5a2a", handSkin: "#c28a3a", shoes: "#5a3a1a", belt: "#5a3a1a",
    back: p => { p.cap(30, 34, 36, 26, 1.8, "#c28a3a"); p.cap(36, 26, 36, 14, 1.8, "#c28a3a"); p.cap(36, 14, 31, 7, 1.6, "#c28a3a"); p.tri(29, 8, 31, 3, 32, 8, "#3a2a1a"); },
    body: p => { p.stroke([[14, 28], [26, 28]], "#8a5a2a", "#c28a3a"); p.stroke([[14, 31], [26, 31]], "#8a5a2a", "#c28a3a"); },
    head: beast({ c: "#c28a3a", shape: "wide", eye: "glow", ec: "#ff4040", mouth: "fang", x: p => { p.stroke([[11, 9], [20, 6], [29, 9]], "#8a5a2a", "#c28a3a", 2); } }) },
  camel: { cloth: "#e8dcc0", pants: "#a08060", handSkin: "#c2a06a", shoes: "#6a4a2a", trim: "#c84a3a",
    head: beast({ c: "#c2a06a", ears: "small", snout: "long", m: "#d8bc8a", eye: "squint", brow: "none", mouth: "smile",
      x: p => { p.ell(20, 6, 11, 4.5, "#f4f0e8", (v, x, y) => y < 8); p.ell(14, 4, 2, 2, "#c84a3a"); } }) },
  lizard: { cloth: "#c8a060", pants: "#6a5a3a", handSkin: "#6aa04a", shoes: "#3a2a1a", belt: "#6a4a2a",
    head: beast({ c: "#6aa04a", shape: "wide", eye: "slit", ec: "#e8c040", mouth: "none",
      x: p => { for (let i = 0; i < 4; i++) p.tri(13 + i * 4, 6.5, 16 + i * 4, 6.5, 14.5 + i * 4, 3, "#e0b040"); p.line(12, 20, 28, 20, OUT, 1); p.ell(16, 9, 1.2, 1.2, "#4a8a3a"); p.ell(25, 10, 1.2, 1.2, "#4a8a3a"); } }) },
  vulture: { cloth: "#3a3030", pants: "#2a2424", handSkin: "#d89a8a", shoes: "#c89a4a", back: wings("#4a3a32"),
    body: p => { p.ell(20, 24, 8, 3, "#f0ece0"); },
    head: beast({ c: "#d89a8a", eye: "dot", brow: "angry", snout: "hook", m: "#e8d880", mouth: "none" }) },
  penguin: { cloth: "#2a3450", pants: "#2a3450", handSkin: "#2a3450", shoes: "#e8a030",
    body: p => { p.ell(20, 30, 4.5, 5.5, "#f4f6fb"); p.tri(18, 23, 22, 23, 20, 25.5, "#c83a4a"); },
    head: beast({ c: "#3a4a6a", eye: "dot", snout: "beak", m: "#e8a030", mouth: "none", under: p => { p.ell(20, 16, 8, 6.5, "#f4f6fb"); } }) },
  pbear: { cloth: "#5a8ac2", pants: "#3a5a8a", handSkin: "#e8eef4", shoes: "#2a3a5a", trim: "#f4f6fb",
    body: p => { p.rect(14, 22.5, 12, 2.6, "#c84a4a"); },
    head: beast({ c: "#e8eef4", ears: "round", in: "#c8d4e4", snout: "muzzle", m: "#f8fbff", eye: "dot", mouth: "smile" }) },
  seal: { cloth: "#f4f6fb", pants: "#3a5a8a", handSkin: "#8a96a8", shoes: "#3a4a5a",
    body: p => { p.rect(14, 27, 12, 1.4, "#3a5ab0"); p.rect(14, 30.5, 12, 1.4, "#3a5ab0"); },
    head: beast({ c: "#8a96a8", eye: "big", ec: "#1a1a2a", snout: "muzzle", m: "#c8d0dc", mouth: "none", x: p => { p.line(13, 19, 8, 18, OUT, 1); p.line(27, 19, 32, 18, OUT, 1); p.ell(13, 9, 1.4, 1.4, "#6a7688"); } }) },
  snowman: { cloth: "#f4f6fb", pants: "#e4e8f2", handSkin: "#8a6a4a", shoes: "#c8d0e0",
    body: p => { buttons(p, 3, "#2a2a3a"); p.rect(14, 22.5, 12, 2.6, "#c84a4a"); p.tri(23, 24, 27, 24, 26.5, 31, "#c84a4a"); },
    head: beast({ c: "#f4f6fb", eye: "dot", mouth: "none", x: p => { p.rect(13, 0.5, 14, 6, "#3a3a4a"); p.rect(11, 5.5, 18, 1.6, "#3a3a4a"); p.tri(20, 16.5, 20, 19, 29, 18, "#ff8a2a"); for (let i = 0; i < 5; i++) p.hrect(33 + i * 3, 44 + (i % 2 ? 0 : -1), 2, 2, OUT); } }) },
  skull: { cloth: "#3a3448", pants: "#2a2434", handSkin: "#e8e2d4", shoes: "#2a2434", trim: "#8a7a9a",
    body: p => { p.tri(14, 33, 16, 33, 15, 35.5, null); p.tri(21, 33, 23, 33, 22, 35.5, null); },
    head: beast({ c: "#e8e2d4", eye: "hollow", ec: "#ff5a5a", mouth: "none", x: p => { p.tri(19, 18, 21, 18, 20, 16, OUT); p.rect(15, 21, 10, 2, "#e8e2d4"); for (let i = 0; i < 5; i++) p.hrect(31 + i * 4, 42, 1, 4, OUT); p.stroke([[25, 6], [27, 9]], "#b8b0a0", "#e8e2d4"); } }) },
  zombie: { cloth: "#6a5a7a", pants: "#4a4a3a", handSkin: "#8aa878", shoes: "#3a3028", trim: "#5a4a6a",
    body: p => { p.tri(14, 33, 16, 33, 15, 35.5, null); p.tri(24, 33, 26, 33, 25, 35.5, null); p.stroke([[15, 27], [18, 29]], "#4a3a5a", "#6a5a7a"); },
    head: human("#8aa878", p => { const H = "#3a3428"; capH(p, H, 10.5, 7.5); bangs(p, H, [[11, 16, 12, 13.5], [18, 23, 21, 12.5], [24, 29, 28, 14]]); }, { shape: "dot", brow: "none" },
      p => { p.hrect(37, 42, 6, 1, OUT); p.line(13, 18, 16, 21, "#4a5a3a", 1); p.line(13.5, 20.5, 15.5, 18.5, "#4a5a3a", 1); }) },
  bat: { cloth: "#2a2034", pants: "#2a2034", handSkin: "#4a3a5a", shoes: "#1a1424", back: wings("#3a2a4a", 2), belt: "#c83a4a",
    head: beast({ c: "#4a3a5a", ears: "bat", in: "#c86a8a", eye: "glow", ec: "#ff4a4a", mouth: "fang" }) },
  spider: { cloth: "#5a3a6a", pants: "#3a2a44", handSkin: "#3a3040", shoes: "#2a2030",
    back: p => { for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { p.cap(20 + s * 6, 24 + i * 3, 20 + s * 15, 20 + i * 5, 1, "#3a3040"); p.cap(20 + s * 15, 20 + i * 5, 20 + s * 18, 30 + i * 5, 1, "#3a3040"); } },
    body: p => { p.ell(20, 29, 3, 3.5, "#c83a3a"); },
    head: beast({ c: "#3a3040", eye: "glow", ec: "#ff3a3a", mouth: "none", x: p => { p.ell(16, 9, 1.3, 1.3, "#ff3a3a"); p.ell(24, 9, 1.3, 1.3, "#ff3a3a"); p.tri(16, 20, 18, 20, 17, 24, "#e8e2d4"); p.tri(22, 20, 24, 20, 23, 24, "#e8e2d4"); } }) },
  ufo: { cloth: "#c8d0dc", pants: "#8a96a8", handSkin: "#8ad0a0", shoes: "#5a6678", trim: "#5ae0ff",
    head: beast({ c: "#8ad0a0", shape: "dome", eye: "none", mouth: "none",
      x: p => { p.ell(15, 15, 3.6, 4.6, "#1a1a2a"); p.ell(25, 15, 3.6, 4.6, "#1a1a2a"); p.hrect(28, 24, 2, 3, "#ffffff"); p.hrect(48, 24, 2, 3, "#ffffff"); p.hrect(39, 42, 3, 1, OUT);
        p.ell(20, 2.5, 12, 2.6, "#9aa4b8"); p.ell(20, 0.5, 5, 2.4, "#9fe8ff", (v, x, y) => y < 1.5); for (let i = 0; i < 4; i++) p.ell(12 + i * 5.3, 2.8, .9, .9, "#ffd166"); } }) },
  invader: { cloth: "#5a3a8a", pants: "#3a2a5a", handSkin: "#8a5ac2", shoes: "#2a1a3a", trim: "#5aff9a",
    head: beast({ c: "#8a5ac2", shape: "box", eye: "none", mouth: "none",
      x: p => { p.line(13, 4.5, 11, 0, "#8a5ac2"); p.line(27, 4.5, 29, 0, "#8a5ac2"); p.rect(13, 11, 4, 4, OUT); p.rect(23, 11, 4, 4, OUT); p.rect(14, 12, 2, 2, "#5aff9a"); p.rect(24, 12, 2, 2, "#5aff9a");
        p.rect(14, 19, 2, 2, OUT); p.rect(18, 19, 4, 2, OUT); p.rect(24, 19, 2, 2, OUT); } }) },
  rocket: { cloth: "#f4f6fb", pants: "#c83a3a", handSkin: "#c8ccd8", shoes: "#3a3a4a", trim: "#c83a3a",
    back: p => { p.rect(8.5, 25, 4, 9, "#9aa4b8"); p.tri(8.5, 34, 12.5, 34, 10.5, 39, "#ff9a3a"); p.tri(9.5, 34, 11.5, 34, 10.5, 37, "#ffe080"); },
    head: p => { const R = "#c83a3a", Wt = "#f4f6fb"; NOSHADOW.add(Wt); p.rect(10, 9, 20, 15, Wt); p.tri(10, 9.5, 30, 9.5, 20, -2.5, R); p.rect(10, 21, 20, 3, R);
      p.ell(20, 15, 5, 5, "#5a6a8a"); p.ell(20, 15, 3.8, 3.8, "#9fe8ff"); p.hrect(37, 26, 3, 3, "#ffffff"); p.ell(20, 15.5, 1.4, 1.4, OUT); } },
  sat: { cloth: "#c8a040", pants: "#8a7030", handSkin: "#aab4c8", shoes: "#4a4a5a",
    back: p => { for (const s of [-1, 1]) { p.rect(s < 0 ? 0 : 30, 18, 10, 12, "#3a5ab0"); for (let i = 1; i < 3; i++) p.stroke([[s < 0 ? i * 3.3 : 30 + i * 3.3, 18], [s < 0 ? i * 3.3 : 30 + i * 3.3, 30]], "#9fc5ff", "#3a5ab0"); p.line(s < 0 ? 10 : 30, 24, s < 0 ? 14 : 26, 24, "#8a96a8"); } },
    head: beast({ c: "#aab4c8", shape: "box", eye: "glow", ec: "#ffd166", mouth: "none", x: p => { p.ell(20, 1.5, 6, 2.5, "#e8eef4"); p.line(20, 1.5, 20, -2.5, "#8a96a8"); p.ell(20, -2.8, 1, 1, "#ff5a5a"); } }) },
  whale: { cloth: "#2a3a6a", pants: "#2a3a6a", handSkin: "#4a7ac2", shoes: "#1a2440", trim: "#e8b84a", body: p => buttons(p, 3),
    head: beast({ c: "#4a7ac2", shape: "wide", eye: "dot", mouth: "smile", under: p => { p.ell(20, 20, 10, 4, "#e8eef4", (v, x, y) => y > 18.5); for (let i = 0; i < 4; i++) p.stroke([[14 + i * 4, 19], [14 + i * 4, 23]], "#a8b8d0", "#e8eef4"); },
      x: p => { p.cap(20, 5, 17, 0, .8, "#9fd8ff"); p.cap(20, 5, 23, 0, .8, "#9fd8ff"); p.rect(14, 4, 12, 2, "#2a3a6a"); } }) },
  squid: { cloth: "#f4ecdc", pants: "#8a4a5a", handSkin: "#c27a8a", shoes: "#5a2a3a", trim: "#c27a8a",
    back: p => { for (let i = 0; i < 3; i++) p.cap(15 + i * 5, 32, 10 + i * 10, 44, 1.4, "#c27a8a"); },
    head: beast({ c: "#c27a8a", eye: "big", ec: "#2a1a2a", mouth: "none", x: p => { p.tri(9, 9, 31, 9, 20, -3, "#c27a8a"); p.tri(8, 6, 13, 3, 11, 10, "#c27a8a"); p.tri(27, 3, 32, 6, 29, 10, "#c27a8a"); for (let i = 0; i < 3; i++) p.cap(16 + i * 4, 21, 16 + i * 4, 25, 1.1, "#c27a8a"); } }) },
  star: { cloth: "#5a3a9a", pants: "#3a2a6a", handSkin: "#e0c24a", shoes: "#2a1a4a", trim: "#ffd166",
    body: p => { for (const [x, y] of [[16, 27], [23, 30], [18, 32]]) p.hrect(x * 2, y * 2, 2, 2, "#ffd166"); },
    head: p => { const Y = "#e0c24a"; NOSHADOW.add(Y); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * Math.PI * 2 / 5, b = a + Math.PI / 5; p.tri(20, 14, 20 + Math.cos(a) * 14, 14 + Math.sin(a) * 13, 20 + Math.cos(b) * 7, 14 + Math.sin(b) * 7, Y); p.tri(20, 14, 20 + Math.cos(a) * 14, 14 + Math.sin(a) * 13, 20 + Math.cos(a - Math.PI / 5) * 7, 14 + Math.sin(a - Math.PI / 5) * 7, Y); }
      face(p, 20, 12.5, { shape: "dot", brow: "none", skin: Y }); p.hrect(38, 38, 5, 1, OUT); } },
  dolphin: { cloth: "#2a5a8a", pants: "#2a5a8a", handSkin: "#5a9ac2", shoes: "#1a3a5a", trim: "#9fe8ff",
    head: beast({ c: "#5a9ac2", eye: "big", ec: "#1a2a3a", snout: "long", m: "#c8e0f0", mouth: "none", x: p => { p.tri(17, 5, 23, 4.5, 26, -2.5, "#5a9ac2"); p.line(23, 21, 29, 20, OUT, 1); } }) },
  // ---- ボス ----
  gantetsu: { wide: true, cloth: "#8a8e9a", pants: "#e8b030", handSkin: "#8a8e9a", shoes: "#5a5e6a", body: tiger,
    back: p => { p.cap(34, 42, 37, 17, 3, "#6a4a2a"); for (let i = 0; i < 4; i++) p.ell(34.5 + (i % 2) * 3, 19 + i * 5, 1, 1, "#c8ccd8"); },
    head: beast({ c: "#8a8e9a", horns: "#f0d060", tall: 1, eye: "std", ec: "#ffb030", brow: "angry", mouth: "grin", x: p => { p.ell(20, 6.5, 9, 3.5, "#2a2230", (v, x, y) => y < 8); p.stroke([[12, 19], [14, 22]], "#5e626e", "#8a8e9a"); } }) },
  yomi: { cloth: "#f4ecdc", pants: "#f4ecdc", handSkin: "#e8903a", shoes: "#7a4ab0", trim: "#7a4ab0",
    back: p => { for (let i = 0; i < 9; i++) { const a = -1.45 + i * .3625, x = 20 + Math.sin(a) * 18.5, y = 32 - Math.cos(a) * 20; p.cap(20, 32, x, y, 2.6, "#e8903a"); p.ell(x, y, 2.2, 2.2, "#fff4e0"); } },
    body: p => { p.rect(14, 30.5, 12, 3, "#7a4ab0"); p.line(16, 23, 20, 29, "#c8b8a0", 1); p.line(24, 23, 20, 29, "#c8b8a0", 1); },
    head: beast({ c: "#e8903a", ears: "point", in: "#7a4ab0", snout: "muzzle", m: "#fff4e0", eye: "slit", ec: "#ffd040", mouth: "none", x: p => { p.line(12, 11, 15, 10, "#7a4ab0", 1); p.line(28, 11, 25, 10, "#7a4ab0", 1); } }) },
  king: { wide: true, cloth: "#c23a3a", pants: "#8a2a2a", shoes: "#3a2a1a", trim: "#ffd166",
    back: p => { p.rect(9.5, 24, 21, 20, "#7a1e2a"); p.line(8, 44, 9, 18, "#c89a3a"); p.ell(9, 16.5, 2.5, 2.5, "#ffd166"); },
    body: p => { p.rect(19, 25, 2, 10, "#ffd166"); p.ell(20, 24, 9, 2.6, "#f4f4f0"); for (let i = 0; i < 5; i++) p.hrect(26 + i * 6, 47 + (i % 2), 2, 1, OUT); },
    head: human(SK, null, { brow: "thick", browColor: "#f4f4f0", eye: "#5a3a2a", shape: "square" }, p => {
      const B = "#f0f0ea"; p.ell(20, 21.5, 8.5, 5.5, B); p.ell(16.5, 18.5, 3.6, 1.5, B); p.ell(23.5, 18.5, 3.6, 1.5, B); p.stroke([[18, 21], [19, 26]], "#c8c8c0", B); p.stroke([[22, 21], [21, 26]], "#c8c8c0", B);
      const Y = "#ffd166"; p.rect(10, 3, 20, 5, Y); for (let i = 0; i < 4; i++) p.tri(10 + i * 6.7, 3.5, 16.6 + i * 6.7, 3.5, 13.3 + i * 6.7, -2, Y);
      p.ell(20, 5.5, 1.8, 1.8, "#4a9aff"); p.ell(13.5, 5.5, 1.3, 1.3, "#ff5a6a"); p.ell(26.5, 5.5, 1.3, 1.3, "#ff5a6a"); }) },
  fujin: { cloth: "#3a8a6a", pants: "#2a6a52", handSkin: "#5ac2a0", shoes: "#1a3a2a", trim: "#e8e0c8",
    back: p => { p.ell(20, 14, 18, 6, "#f4f0e0", (v, x, y) => y < 12); p.cap(4, 12, 2, 22, 2.6, "#f4f0e0"); p.cap(36, 12, 38, 22, 2.6, "#f4f0e0"); },
    head: beast({ c: "#5ac2a0", horns: "#f0e0b0", eye: "std", ec: "#ffd040", brow: "angry", mouth: "grin", x: p => { capH(p, "#f4f4f4", 9, 7.5); for (let i = 0; i < 5; i++) p.tri(9 + i * 5, 6, 13 + i * 5, 6, 9.5 + i * 5 - 2, -1, "#f4f4f4"); } }) },
  raijin: { wide: true, cloth: "#e0c23a", pants: "#e8b030", handSkin: "#e05a3a", shoes: "#5a2a1a", body: tiger,
    back: p => { for (let i = 0; i < 7; i++) { const a = Math.PI * (0.95 + i * 0.185), x = 20 + Math.cos(a) * 17, y = 15 + Math.sin(a) * 13; p.ell(x, y, 3, 3, "#c83a3a"); p.ell(x, y, 1.6, 1.6, "#ffd166"); } },
    head: beast({ c: "#e05a3a", horns: "#f0e0b0", tall: 1, eye: "std", ec: "#ffff60", brow: "angry", mouth: "grin", x: p => { p.ell(20, 6.5, 9.5, 3.8, "#2a2230", (v, x, y) => y < 8); for (let i = 0; i < 4; i++) p.tri(11 + i * 5, 4.5, 15 + i * 5, 4.5, 12 + i * 5, 0, "#2a2230"); } }) },
  djinn: { cloth: "#7a4ab0", pants: "#c86ad8", handSkin: "#5a8ae0", shoes: "#ffd166", trim: "#ffd166",
    body: p => { p.tri(16, 23, 24, 23, 20, 30, "#5a8ae0"); p.rect(10.5, 30, 3.5, 1.5, "#ffd166"); },
    head: human("#5a8ae0", p => { p.ell(20, 2, 3, 3.5, "#2a2240"); p.rect(19, 4, 2, 2, "#ffd166"); p.ell(9.5, 18, 1.2, 1.6, "#ffd166"); p.ell(30.5, 18, 1.2, 1.6, "#ffd166"); }, { shape: "fierce", eye: "#ffd040", brow: "angry" },
      p => { p.tri(17, 21, 23, 21, 20, 27, "#2a2240"); p.hrect(37, 41, 6, 1, OUT); }) },
  yuki: { cloth: "#f4f8ff", pants: "#f4f8ff", sleeve: "#e4ecf8", handSkin: "#f4f4fa", shoes: "#9fc5ff", trim: "#9fc5ff",
    back: p => { const H = "#c8e0f4"; p.rect(8, 10, 24, 26, H); p.tri(8, 35, 13, 35, 9, 40, H); p.tri(27, 35, 32, 35, 31, 40, H); },
    body: p => { p.rect(14, 33, 12, 9, "#f4f8ff"); p.rect(14, 30.5, 12, 3, "#5a8ac2"); p.line(16, 23, 20, 29, "#9fc5ff", 1); p.line(24, 23, 20, 29, "#9fc5ff", 1); },
    head: human("#f4f4fa", p => { const H = "#c8e0f4"; capH(p, H); p.rect(10, 8.5, 20, 3.5, H); p.rect(8.5, 10, 3, 16, H); p.rect(28.5, 10, 3, 16, H); hairTone(p, H, [14, 20, 26]); p.ell(28, 6.5, 2, 2, "#ffffff"); p.ell(28, 6.5, .9, .9, "#9fc5ff"); }, { shape: "cat", eye: "#5a9ae0", brow: "none" },
      p => { p.hrect(39, 42, 3, 1, "#7a6aa0"); }) },
  hyoryu: { wide: true, cloth: "#8ad8e8", pants: "#4a8aa8", handSkin: "#6ac2c2", shoes: "#2a5a6a", belt: "#e8f8ff", back: wings("#9fe0ee", 1),
    head: beast({ c: "#6ac2c2", horns: "#e8f8ff", tall: 2, snout: "long", m: "#c8f0f0", eye: "slit", ec: "#4a7aff", brow: "angry", mouth: "fang",
      x: p => { for (let i = 0; i < 3; i++) p.tri(13 + i * 5, 6, 16 + i * 5, 6, 14.5 + i * 5, 1.5, "#e8f8ff"); } }) },
  vamp: { cloth: "#2a2030", pants: "#1a1420", shoes: "#1a1420", trim: "#c83a4a",
    back: p => { p.rect(9, 23, 22, 21, "#8a2a3a"); p.tri(9, 23, 13, 16, 15, 23, "#8a2a3a"); p.tri(25, 23, 27, 16, 31, 23, "#8a2a3a"); },
    body: p => { p.tri(17, 23, 23, 23, 20, 29, "#f4f0f0"); p.ell(20, 27, 1.2, 1.2, "#c83a4a"); },
    head: human("#e8e4f0", p => { const H = "#1e1a2a"; capH(p, H, 10, 7.8); p.tri(14, 8.5, 26, 8.5, 20, 12, H); p.rect(9.2, 8.5, 2, 6, H); p.rect(28.8, 8.5, 2, 6, H); hairTone(p, H, [15, 25]); }, { shape: "slit", eye: "#e02a3a", brow: "sharp" },
      p => { p.hrect(37, 42, 6, 1, OUT); p.dot(38, 43, "#ffffff"); p.dot(42, 43, "#ffffff"); }) },
  pumpkin: { wide: true, cloth: "#5a3a7a", pants: "#3a2a4a", handSkin: "#3a6a3a", shoes: "#2a1a2a", trim: "#e07a2a",
    head: p => { const O = "#e07a2a"; NOSHADOW.add(O); p.ell(20, 14, 13, 10.5, O); for (const x of [14, 20, 26]) p.stroke([[x, 5], [x + (x - 20) * .2, 23]], "#b85a1a", O, 2); p.rect(18.5, 0.5, 3, 4.5, "#3a6a3a");
      p.tri(12, 15, 18, 15, 15, 10, "#ffd040"); p.tri(22, 15, 28, 15, 25, 10, "#ffd040"); for (let i = 0; i < 4; i++) p.tri(12 + i * 4, 18, 16 + i * 4, 18, 14 + i * 4, 22.5, "#ffd040"); } },
  mother: { cloth: "#f4f6fb", pants: "#c8d0dc", handSkin: "#c8d0dc", shoes: "#8a96a8", trim: "#e08ab0",
    body: p => { p.ell(20, 29, 3, 3, "#5ae0ff"); p.ell(20, 29, 1.6, 1.6, "#ffffff"); },
    head: p => { const G = "#c8f0ff"; NOSHADOW.add(G); p.rect(9, 17, 22, 7, "#8a96a8"); p.ell(20, 13, 11, 11, G, (v, x, y) => y < 18);
      p.ell(20, 12, 8, 6.5, "#e08ab0"); for (const s of [[14, 9, 18, 14], [22, 8, 19, 13], [26, 12, 21, 16]]) p.stroke([[s[0], s[1]], [s[2], s[3]]], "#b8607a", "#e08ab0"); p.hrect(26, 12, 3, 2, "#ffffff");
      p.rect(13, 19, 14, 2.5, "#2a3046"); p.rect(14, 19.6, 3, 1.3, "#ff5a8a"); p.rect(23, 19.6, 3, 1.3, "#ff5a8a"); } },
  sun: { wide: true, cloth: "#e86a2a", pants: "#c84a1a", handSkin: "#f0c070", shoes: "#8a3a1a", trim: "#ffd166",
    back: p => { for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, x = 20 + Math.cos(a) * 13, y = 13 + Math.sin(a) * 13; p.tri(20 + Math.cos(a - .2) * 9, 13 + Math.sin(a - .2) * 9, 20 + Math.cos(a + .2) * 9, 13 + Math.sin(a + .2) * 9, x + Math.cos(a) * 3, y + Math.sin(a) * 3, "#ffb84a"); } },
    head: human("#f0c070", p => { const H = "#ffd166"; capH(p, H); bangs(p, H, [[11, 16, 12, 13], [16, 22, 19, 13.5], [22, 29, 27, 13]]); hairTone(p, H); p.rect(10, 7, 20, 2, "#e86a2a"); p.ell(20, 8, 1.5, 1.5, "#ff4a2a"); }, { shape: "std", eye: "#c84a1a", brow: "thick" }) },
  moon: { cloth: "#2a3060", pants: "#1e2448", sleeve: "#262c58", handSkin: "#e4e8f8", shoes: "#c2c8e8", trim: "#c2c8e8",
    back: p => { const H = "#c2c8e8"; p.rect(8, 10, 24, 24, H); p.ell(35, 6, 5, 5, "#fff4c0"); p.ell(37, 4.5, 4.4, 4.4, null); },
    body: p => { for (const [x, y] of [[16, 27], [23, 29], [18, 32], [24, 33]]) p.hrect(x * 2, y * 2, 2, 2, "#fff4c0"); },
    head: human("#e4e8f8", p => { const H = "#c2c8e8"; capH(p, H); p.rect(10, 8.5, 20, 3.5, H); p.rect(8.5, 10, 3, 16, H); p.rect(28.5, 10, 3, 16, H); hairTone(p, H, [14, 20, 26]); p.ell(20, 6, 2.4, 2.4, "#fff4c0"); p.ell(21, 5.4, 2, 2, "#c2c8e8"); }, { closed: true, brow: "none" },
      p => p.hrect(39, 42, 2, 1, OUT)) },
  god: { wide: true, cloth: "#f4f0e0", pants: "#e8e0c8", sleeve: "#e8e2d0", handSkin: "#f0d0b0", shoes: "#c8a040", trim: "#ffd166",
    back: p => { p.ell(20, 12, 14, 14, "#ffe890"); p.ell(20, 12, 12.5, 12.5, null); p.line(34, 44, 34, 6, "#c8a040"); p.tri(31, 8, 37, 8, 34, 0, "#ffd166"); p.line(31, 8, 31, 3, "#ffd166"); p.line(37, 8, 37, 3, "#ffd166"); },
    body: p => { p.rect(19, 24, 2, 11, "#ffd166"); },
    head: human("#f0d0b0", p => { p.ell(10, 13, 2, 3.4, "#f4f4f0"); p.ell(30, 13, 2, 3.4, "#f4f4f0"); }, { shape: "squint", brow: "thick", browColor: "#f4f4f0" },
      p => { const B = "#f4f4f0"; p.ell(20, 23, 8, 7.5, B); p.ell(16.5, 19.5, 3.6, 1.6, B); p.ell(23.5, 19.5, 3.6, 1.6, B); p.stroke([[17, 22], [18, 29]], "#c8c8c0", B); p.stroke([[23, 22], [22, 29]], "#c8c8c0", B); }) },
  lion: { wide: true, cloth: "#c8a040", pants: "#8a6a2a", handSkin: "#e0a04a", shoes: "#5a3a1a", belt: "#8a2a2a",
    body: p => { p.rect(15, 27, 10, 6, "#e8c060"); p.ell(20, 30, 1.8, 1.8, "#c83a3a"); },
    head: beast({ c: "#e0a04a", ears: "round", in: "#c87a2a", snout: "muzzle", m: "#f4dca0", eye: "std", ec: "#c87a2a", brow: "angry", mouth: "fang",
      backHead: p => { for (let i = 0; i < 14; i++) { const a = i * Math.PI / 7, x = 20 + Math.cos(a) * 13, y = 14 + Math.sin(a) * 12; p.ell(x, y, 4, 4, "#a8582a"); } p.ell(20, 14, 13, 12, "#a8582a"); } }) },
};

/* ---------- 画像の作成（キャッシュ）---------- */
const cache = {};
const url = p => p.canvas().toDataURL();
function defOf(kind, key) { return kind === "p" ? ALLY[key] || ALLY[1] : ENEMY[key] || ENEMY.frog; }
// 前の腕：肩（2.5, 3.5）を回転の中心にした横向きの腕
function armPix(o) {
  const p = Pix(12, 7), sk = o.handSkin || o.skin || SK; NOSHADOW.add(sk);
  p.cap(2.5, 3.5, 6.4, 3.5, 2, o.sleeve || o.cloth); if (o.trim) p.ell(6.2, 3.5, 1, 2, o.trim); p.ell(7, 3.5, 1.9, 1.9, sk);
  return p.finish();
}
function actor(kind, key) {
  const id = kind + key; if (cache[id]) return cache[id];
  const o = defOf(kind, key), sk = o.handSkin || o.skin || SK;
  const bodyP = body(o), c = bodyP.canvas();
  const pc = document.createElement("canvas"); pc.width = 48; pc.height = 50; pc.getContext("2d").drawImage(c, 16, 0, 48, 50, 0, 0, 48, 50);
  return (cache[id] = { body: c.toDataURL(), arm: url(armPix(o)), hand: [0, 1, 2].map(h => url(handPix(h, 12, sk))), face: pc.toDataURL() });
}
const handIcon = h => cache["h" + h] || (cache["h" + h] = url(handPix(h, 24)));

/* ---------- アイコン ---------- */
const ICON = {
  lock: () => { const p = Pix(16, 16); p.ell(8, 6, 4.4, 4.6, "#aab4c8"); p.ell(8, 6, 2.4, 2.8, null); p.rect(2.5, 7, 11, 8, "#e8b84a"); p.rect(7, 9.5, 2, 3.5, "#5a3a1a"); return p.finish(); },
  chat: () => { const p = Pix(16, 16); p.ell(8, 7, 7, 5.5, "#f4f6fb"); p.tri(3, 10, 7, 11, 2, 15, "#f4f6fb"); for (let i = 0; i < 3; i++) p.ell(5 + i * 3, 7, .9, .9, "#5a6aa0"); return p.finish(); },
  wave: () => { const p = handPix(2, 16); return p; },
  bow: () => { const p = Pix(16, 16); NOSHADOW.add(SK); p.ell(6, 6, 3.6, 3.4, SK); p.rect(2.5, 3, 7, 2.5, "#34407a"); p.cap(8, 9, 13, 13, 2.8, "#5a7ad8"); p.hrect(8, 14, 3, 1, OUT); p.ell(4, 13, 2, 1.4, "#e8b84a"); return p.finish(); },
  swords: () => { const p = Pix(16, 16); for (const s of [-1, 1]) { p.line(8 - s * 6, 2, 8 + s * 5, 13, "#d0d4e0"); p.rect(s < 0 ? 11 : 3, 10.5, 2.5, 2.5, "#e8b84a"); p.line(s < 0 ? 13 : 3, 13, s < 0 ? 14.5 : 1.5, 14.5, "#6a4a2a"); } return p.finish(); },
  // ホーム画面・下のメニュー用
  gear: () => { const p = Pix(16, 16); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.ell(8 + Math.cos(a) * 5.6, 8 + Math.sin(a) * 5.6, 1.5, 1.5, "#a8b0c8"); } p.ell(8, 8, 5, 5, "#a8b0c8"); p.ell(8, 8, 2, 2, null); return p.finish(); },
  scroll: () => { const p = Pix(16, 16); p.rect(3, 3, 10, 10, "#f4ecdc"); p.ell(3, 3.5, 2, 1.6, "#c8b890"); p.ell(13, 12.5, 2, 1.6, "#c8b890"); p.rect(1.5, 2, 3, 3, "#c8962a"); p.rect(11.5, 11, 3, 3, "#c8962a");
    for (let i = 0; i < 3; i++) p.stroke([[5, 6 + i * 2], [11, 6 + i * 2]], "#8a7aa0", "#f4ecdc"); return p.finish(); },
  coin: () => { const p = Pix(16, 16); p.ell(8, 8, 6.5, 6.5, "#ffd166"); p.ell(8, 8, 4.4, 4.4, "#e8a83a"); p.rect(7, 5, 2, 6, "#ffd166"); p.stroke([[4, 5], [6, 3]], "#fff4c0", "#ffd166", 2); return p.finish(); },
  crystal: () => { const p = Pix(16, 16); p.rect(4, 12, 8, 3, "#8a5a2a"); p.rect(3, 14, 10, 1.5, "#c8962a"); p.ell(8, 7.5, 5.6, 5.6, "#8a6ae0"); p.ell(8, 7.5, 3.6, 3.6, "#c8a8ff"); p.ell(6.4, 5.6, 1.4, 1.4, "#ffffff"); p.dot(26, 6, "#fff4c0"); return p.finish(); },
  book: () => { const p = Pix(16, 16); p.tri(1, 4, 8, 5, 8, 14, "#f4ecdc"); p.tri(1, 4, 1, 12.5, 8, 14, "#f4ecdc"); p.tri(15, 4, 8, 5, 8, 14, "#e8dcc4"); p.tri(15, 4, 15, 12.5, 8, 14, "#e8dcc4"); p.line(8, 5, 8, 14, "#8a6a4a", 1);
    for (let i = 0; i < 3; i++) { p.stroke([[3, 6.5 + i * 2], [6.5, 7 + i * 2]], "#a8a0b8", "#f4ecdc"); p.stroke([[9.5, 7 + i * 2], [13, 6.5 + i * 2]], "#a8a0b8", "#e8dcc4"); } p.line(12, 1, 14, 6, "#5a7ad8", 2); return p.finish(); },
  map: () => { const p = Pix(16, 16); p.rect(2, 3, 12, 10, "#e8d8a8"); p.rect(1.5, 2.5, 2, 11, "#c8a060"); p.rect(12.5, 2.5, 2, 11, "#c8a060"); p.stroke([[4, 10], [7, 7], [9, 9], [12, 5]], "#c84a4a", "#e8d8a8", 1); p.ell(12, 5, 1.2, 1.2, "#c84a4a"); p.ell(6, 5.5, 1.6, 1.2, "#5ac06a"); return p.finish(); },
  person: () => { const p = Pix(16, 16); NOSHADOW.add(SK); p.tri(2.5, 15, 13.5, 15, 8, 8.5, "#5a7ad8"); p.ell(8, 6, 3.6, 3.8, SK); p.ell(8, 4.4, 4, 2.6, "#34407a", (v, x, y) => y < 5); p.rect(4.2, 4, 7.6, 1.2, "#c83a3a"); p.hrect(13, 12, 1, 2, OUT); p.hrect(18, 12, 1, 2, OUT); return p.finish(); },
  cards: () => { const p = Pix(16, 16); p.rect(1.5, 3, 7.5, 11, "#5a3ab0"); p.rect(7, 2, 7.5, 11, "#3a5ab0"); p.rect(8.5, 3.5, 4.5, 8, "#24184a"); starP(p, 10.75, 7.5, 2.2, "#ffd166"); return p.finish(); },
  door: () => { const p = Pix(16, 16); p.ell(8, 7, 6.2, 6, "#8a8aa8", (v, x, y) => y < 7); p.rect(1.8, 7, 12.4, 8, "#8a8aa8"); p.ell(8, 7.5, 4, 3.8, "#5ae0ff", (v, x, y) => y < 7.5); p.rect(4, 7.5, 8, 6.5, "#5ae0ff"); p.rect(5, 8.5, 6, 5.5, "#2ab0e8"); p.rect(1, 14, 14, 1.5, "#6a6a88"); return p.finish(); },
  chest: () => { const p = Pix(16, 16); p.ell(8, 6.5, 6.5, 3.5, "#3a6ac2", (v, x, y) => y < 6.5); p.rect(1.5, 6.5, 13, 7.5, "#3a6ac2"); p.rect(1.5, 6, 13, 1.6, "#ffd166"); p.rect(3.5, 3, 1.6, 11, "#ffd166"); p.rect(10.9, 3, 1.6, 11, "#ffd166"); p.rect(6.8, 6.5, 2.4, 3, "#e8e8f0"); p.ell(4, 14, 2.4, 1.4, "#ffd166"); return p.finish(); },
};
const icon = n => cache["i" + n] || (cache["i" + n] = url(ICON[n]()));

/* ---------- タロット（32×48 を2倍の細かさで）---------- */
const FONT = {
  A: [".#.", "#.#", "###", "#.#", "#.#"], P: ["##.", "#.#", "##.", "#..", "#.."], N: ["#.#", "###", "###", "###", "#.#"],
  Q: [".#.", "#.#", "#.#", "##.", ".##"], K: ["#.#", "##.", "#..", "##.", "#.#"],
  0: ["###", "#.#", "#.#", "#.#", "###"], 1: [".#.", "##.", ".#.", ".#.", "###"], 2: ["###", "..#", "###", "#..", "###"],
  3: ["###", "..#", "###", "..#", "###"], 4: ["#.#", "#.#", "###", "..#", "..#"], 5: ["###", "#..", "###", "..#", "###"],
  6: ["###", "#..", "###", "#.#", "###"], 7: ["###", "..#", "..#", "..#", "..#"], 8: ["###", "#.#", "###", "#.#", "###"],
  9: ["###", "#.#", "###", "..#", "###"], I: ["###", ".#.", ".#.", ".#.", "###"], V: ["#.#", "#.#", "#.#", "#.#", ".#."], X: ["#.#", "#.#", ".#.", "#.#", "#.#"],
};
const RARC = ["#b8bfdc", "#6fb3ff", "#c48bff", "#ffd166"];
// 小さな人物：頭・髪・ローブ
function fig(p, x, y, robe, o = {}) {
  NOSHADOW.add(SK);
  p.tri(x - 3.4, y + 10, x + 3.4, y + 10, x, y + 1.5, robe);
  if (o.arms !== false) p.cap(x - 2.4, y + 4, x - 4, y + 7, .9, robe), p.cap(x + 2.4, y + 4, x + 4, y + 7, .9, robe);
  p.ell(x, y, 2.4, 2.4, o.skin || SK);
  if (o.hair) p.ell(x, y - 1, 2.6, 1.8, o.hair, (v, X, Y) => Y < y - .4);
  p.hrect(Math.round(x * 2) - 2, Math.round(y * 2), 1, 1, OUT); p.hrect(Math.round(x * 2) + 1, Math.round(y * 2), 1, 1, OUT);
}
const G = "#ffd166", GD = "#c8962a", SV = "#d0d4e0";
function sunP(p, x, y, r, face) { for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; p.tri(x + Math.cos(a - .25) * r, y + Math.sin(a - .25) * r, x + Math.cos(a + .25) * r, y + Math.sin(a + .25) * r, x + Math.cos(a) * (r + 2.5), y + Math.sin(a) * (r + 2.5), "#ffb84a"); } p.ell(x, y, r, r, G); if (face) { p.hrect(Math.round(x * 2) - 3, Math.round(y * 2) - 1, 2, 2, OUT); p.hrect(Math.round(x * 2) + 2, Math.round(y * 2) - 1, 2, 2, OUT); p.hrect(Math.round(x * 2) - 2, Math.round(y * 2) + 3, 5, 1, OUT); } }
function starP(p, x, y, r, c = G) { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; p.tri(x + Math.cos(a + Math.PI / 4) * r * .35, y + Math.sin(a + Math.PI / 4) * r * .35, x + Math.cos(a - Math.PI / 4) * r * .35, y + Math.sin(a - Math.PI / 4) * r * .35, x + Math.cos(a) * r, y + Math.sin(a) * r, c); } p.ell(x, y, r * .4, r * .4, c); }
function wingP(p, x, y, s, c = "#f4f6fb") { p.tri(x, y, x + s * 7, y - 4, x + s * 5, y + 5, c); }
const MAJOR = {
  fool: p => { sunP(p, 25, 14, 3); p.rect(3, 33, 15, 6, "#6a5a4a"); fig(p, 14, 21, "#e8a040", { hair: "#c8a040" }); p.tri(12, 18.5, 16, 18.5, 17, 15, "#c84a4a"); p.line(17, 24, 22, 17, "#8a6a3a", 1); p.ell(22.5, 16.5, 1.8, 1.6, "#c84a4a"); p.ell(8, 31.5, 2.4, 1.6, SV); p.ell(6.5, 30, 1.5, 1.4, SV); },
  magician: p => { for (let a = 0; a < 60; a++) { const t = a / 60 * Math.PI * 2, x = 16 + 4 * Math.cos(t) / (1 + Math.sin(t) ** 2), y = 13 + 4 * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) ** 2); p.dot(x * 2, y * 2, G); }
    p.ell(16, 36.5, 9, 2, "#7a5ad0"); p.tri(10, 36, 22, 36, 16, 22, "#5a3ab0"); p.ell(16, 21, 3.2, 3, SK); p.ell(16, 23.5, 3, 2, "#f4f4f4"); p.ell(16, 18.8, 6, 1.4, "#5a3ab0"); p.tri(12, 18.8, 20, 18.8, 18.5, 12, "#5a3ab0"); p.rect(13, 17.5, 6, 1.2, G);
    p.line(22, 34, 23, 17, "#a06a3a", 1); p.ell(23, 16, 2, 2, "#9fe0ff"); p.hrect(28, 41, 1, 1, OUT); p.hrect(34, 41, 1, 1, OUT); },
  priestess: p => { p.rect(4, 14, 4, 24, "#2a2a3a"); p.rect(24, 14, 4, 24, "#e8e8f0"); fig(p, 16, 19, "#4a7ac2"); p.ell(16, 18, 3.2, 3, "#6a9ae0", (v, x, y) => y < 17.4); p.ell(16, 16, 2, 1, G); p.rect(13, 24, 6, 3, "#f4ecdc"); p.ell(16, 35.5, 4, 1.8, G); p.ell(16, 34.5, 3.6, 1.4, null); },
  empress: p => { p.ell(16, 30, 10, 6, "#4a8a3a"); fig(p, 16, 18, "#8ad06a", { hair: "#e8a040" }); for (let i = -2; i <= 2; i++) p.ell(16 + i * 1.6, 14.6, .6, .6, G); p.ell(8.5, 33, 2.6, 2.4, "#e04a6a"); for (let i = 0; i < 3; i++) p.line(22 + i * 2, 38, 23 + i * 2, 30, GD, 1); },
  emperor: p => { p.rect(8, 16, 16, 21, "#7a7a8a"); p.ell(8.5, 16, 2, 2, "#9a9aaa"); p.ell(23.5, 16, 2, 2, "#9a9aaa"); fig(p, 16, 20, "#c84a3a"); p.ell(16, 23, 2.4, 2, "#f4f4f0"); p.rect(13.5, 16, 5, 1.6, G); p.tri(13.5, 16, 15, 16, 14, 14.4, G); p.tri(17, 16, 18.5, 16, 18, 14.4, G); p.line(22, 30, 22, 21, G, 1); p.ell(22, 20.5, 1.2, 1.2, G); },
  hierophant: p => { p.rect(5, 16, 3, 22, "#8a8a9a"); p.rect(24, 16, 3, 22, "#8a8a9a"); fig(p, 16, 21, "#c83a3a"); p.tri(13.5, 19.5, 18.5, 19.5, 16, 12.5, G); p.line(13.5, 17.5, 18.5, 17.5, GD, 1); p.line(11, 37, 15, 33, G, 1); p.line(21, 37, 17, 33, SV, 1); },
  lovers: p => { sunP(p, 16, 13, 3); wingP(p, 12, 14, -1); wingP(p, 20, 14, 1); fig(p, 10.5, 24, "#e8c0a0", { hair: "#c8a040" }); fig(p, 21.5, 24, "#c8a0e0", { hair: "#8a5a3a" }); p.ell(15.2, 30, 1.4, 1.3, "#e04a6a"); p.ell(16.8, 30, 1.4, 1.3, "#e04a6a"); p.tri(13.9, 30.4, 18.1, 30.4, 16, 33, "#e04a6a"); },
  chariot: p => { p.rect(7, 13, 18, 2, "#4a5aa0"); p.line(8, 15, 8, 25, GD, 1); p.line(24, 15, 24, 25, GD, 1); fig(p, 16, 17, "#9aa4b8"); p.rect(7, 25, 18, 8, "#c8a040"); starP(p, 16, 29, 2.4, "#fff4c0"); p.ell(10, 35.5, 3, 2, "#2a2a3a"); p.ell(22, 35.5, 3, 2, "#f0f0f0"); },
  strength: p => { for (let a = 0; a < 40; a++) { const t = a / 40 * Math.PI * 2, x = 18 + 2.8 * Math.cos(t) / (1 + Math.sin(t) ** 2), y = 12.5 + 2.8 * Math.sin(t) * Math.cos(t) / (1 + Math.sin(t) ** 2); p.dot(x * 2, y * 2, G); }
    fig(p, 19, 17, "#f4f0e8", { hair: "#e8a040" }); p.ell(16, 31, 8, 4.4, "#e0a040"); p.ell(9.5, 28, 4.4, 4.4, "#b8682a"); p.ell(9, 28.5, 2.8, 2.6, "#e0a040"); p.hrect(16, 55, 1, 1, OUT); },
  hermit: p => { fig(p, 17, 19, "#6a6a8a"); p.ell(17, 18.5, 3, 3.2, "#5a5a7a", (v, x, y) => y < 18.4 || x > 18.6 || x < 15.4); p.ell(17, 21.5, 1.8, 1.4, "#f4f4f0"); p.line(22, 38, 22, 18, "#8a6a3a", 1); p.ell(11, 24, 2.4, 2.6, "#ffe080"); starP(p, 11, 24, 1.8, "#ffffff"); p.line(11, 21.4, 13, 22.5, OUT, 1); },
  wheel: p => { p.ell(16, 25, 10, 10, G); p.ell(16, 25, 7.5, 7.5, "#4a3a7a"); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.line(16, 25, 16 + Math.cos(a) * 7.5, 25 + Math.sin(a) * 7.5, GD, 1); } p.ell(16, 25, 2.2, 2.2, G); for (const [x, y] of [[5, 14], [27, 14], [5, 36], [27, 36]]) p.ell(x, y, 2.2, 1.4, "#e8eef8"); },
  justice: p => { p.rect(6, 15, 20, 3, "#8a2a3a"); fig(p, 16, 21, "#c83a3a"); p.rect(13.5, 18, 5, 1.2, G); p.line(22, 12, 22, 30, SV, 1); p.rect(20.5, 26, 3, 1, G); p.line(6, 26, 12, 26, G, 1); p.line(9, 22, 9, 26, G, 1); p.ell(6.5, 28, 1.6, 1, G); p.ell(11.5, 28, 1.6, 1, G); },
  hanged: p => { p.rect(5, 12, 22, 2, "#6a8a4a"); p.rect(5, 12, 2, 26, "#6a8a4a"); p.rect(25, 12, 2, 26, "#6a8a4a"); p.line(16, 14, 16, 18, "#c8a040", 1);
    p.tri(13.5, 18, 18.5, 18, 16, 29, "#4a6ac2"); p.ell(16, 31, 2.4, 2.4, SK); p.ell(16, 31, 4, 4, G); p.ell(16, 31, 3, 3, SK); p.hrect(31, 62, 1, 1, OUT); p.hrect(33, 62, 1, 1, OUT); },
  death: p => { sunP(p, 26, 34, 2.5); p.tri(9, 37, 21, 37, 15, 21, "#2a2236"); p.ell(15, 19.5, 3, 3, "#e8e2d4"); p.hrect(27, 37, 2, 2, OUT); p.hrect(32, 37, 2, 2, OUT); p.line(21, 13, 21, 38, "#8a6a3a", 1); p.tri(21, 13, 21, 15, 12, 13.5, SV); p.ell(10, 30, 1.6, 1.6, "#f4f4f4"); },
  temperance: p => { p.ell(16, 37, 10, 2, "#4a8ad0"); wingP(p, 13, 19, -1, "#e8a0b0"); wingP(p, 19, 19, 1, "#e8a0b0"); fig(p, 16, 17, "#f4f0e8", { hair: G }); p.tri(14.6, 21.5, 17.4, 21.5, 16, 24, G); p.ell(10, 24, 1.6, 2, G); p.ell(22, 28, 1.6, 2, G); p.line(11, 24, 21, 27.5, "#6ab0ff", 1); },
  devil: p => { wingP(p, 12, 18, -1, "#3a2a4a"); wingP(p, 20, 18, 1, "#3a2a4a"); p.ell(16, 21, 6, 6, "#8a2a3a"); p.tri(11, 17, 12.5, 17, 9.5, 11.5, "#f0e0b0"); p.tri(19.5, 17, 21, 17, 22.5, 11.5, "#f0e0b0"); p.hrect(28, 40, 2, 2, "#ffd040"); p.hrect(34, 40, 2, 2, "#ffd040"); p.hrect(29, 47, 6, 1, OUT);
    starP(p, 16, 13.5, 2, G); p.line(9, 32, 13, 27, SV, 1); p.line(23, 32, 19, 27, SV, 1); fig(p, 8, 31, "#c8a0a0"); fig(p, 24, 31, "#c8a0a0"); },
  tower: p => { p.rect(12, 16, 8, 22, "#8a8a9a"); p.rect(14, 22, 4, 4, "#ff8a2a"); p.rect(14, 30, 4, 4, "#ff8a2a"); p.tri(11, 16, 21, 16, 16, 11, G); p.line(4, 11, 9, 16, "#fff4a0", 1); p.line(9, 16, 7, 18, "#fff4a0", 1); p.line(7, 18, 12, 23, "#fff4a0", 1); p.ell(23, 20, 1.8, 1.4, "#ff6a2a"); p.ell(9, 28, 1.6, 1.2, "#ff6a2a"); },
  star: p => { starP(p, 16, 15, 6); starP(p, 7, 13, 2, "#fff4c0"); starP(p, 25, 12, 2, "#fff4c0"); starP(p, 26, 22, 1.6, "#fff4c0"); p.ell(16, 36, 11, 2.6, "#4a8ad0"); fig(p, 12, 26, "#e8e0f0", { hair: G }); p.ell(17, 30, 1.4, 1.6, "#c8a0e0"); p.line(17, 31.5, 18, 34, "#6ab0ff", 1); },
  moon: p => { p.ell(16, 15, 6, 6, "#e8e8c0"); p.ell(18.5, 14, 5, 5, tone("#5a6694", -.7)); p.hrect(25, 30, 2, 2, OUT); p.rect(3, 22, 5, 15, "#7a7a8a"); p.rect(24, 22, 5, 15, "#7a7a8a"); p.ell(11, 33, 2.4, 1.6, "#c8a070"); p.ell(21, 33, 2.4, 1.6, "#8a8a9a"); p.ell(16, 38, 4, 1.4, "#4a8ad0"); for (let i = 0; i < 5; i++) p.dot(30 + i % 2, 38 + i * 4, "#fff4c0"); },
  sun: p => { sunP(p, 16, 16, 5.5, true); p.rect(3, 31, 26, 7, "#a08a6a"); for (let i = 0; i < 4; i++) { p.line(6 + i * 7, 31, 6 + i * 7, 27, "#4a8a3a", 1); p.ell(6 + i * 7, 26, 2, 2, G); p.ell(6 + i * 7, 26, .9, .9, "#8a5a2a"); } },
  judgement: p => { p.ell(16, 13, 5, 2.4, "#e8eef8"); wingP(p, 14, 15, -1); wingP(p, 18, 15, 1); fig(p, 16, 14, "#f4f0e8", { hair: G }); p.line(18, 17, 25, 21, G, 1); p.ell(25.5, 21.5, 1.4, 1.4, G); p.rect(4, 33, 9, 4, "#5a4a3a"); p.rect(19, 33, 9, 4, "#5a4a3a"); fig(p, 8.5, 27, "#c8c8d8", { arms: false }); fig(p, 23.5, 27, "#c8c8d8", { arms: false }); },
  world: p => { p.ell(16, 25, 8, 11, "#4a9a4a"); p.ell(16, 25, 6.3, 9.3, null); for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; p.ell(16 + Math.cos(a) * 7.2, 25 + Math.sin(a) * 10.2, .9, .9, "#e04a6a"); } fig(p, 16, 20, "#9a6ac8", { hair: "#e8a040" }); p.cap(12, 24, 20, 28, .7, "#e04a6a");
    for (const [x, y, c] of [[4, 13, "#f4f0e8"], [28, 13, "#c8a040"], [4, 37, "#a07a4a"], [28, 37, "#e0a040"]]) p.ell(x, y, 2, 2, c); },
};
// 小アルカナの紋章（k：大きさ）
function suitP(p, s, x, y, k = 1) {
  if (s === "wand") { p.cap(x - 1.6 * k, y + 3.2 * k, x + 1.6 * k, y - 3.2 * k, .8 * k, "#b07a3a"); p.ell(x + 1.8 * k, y - 3.2 * k, 1.1 * k, .9 * k, "#5ac06a"); p.ell(x - .4 * k, y - 1 * k, .8 * k, .6 * k, "#5ac06a"); }
  else if (s === "cup") { p.ell(x, y - 1.4 * k, 2.6 * k, 1.8 * k, G, (v, X, Y) => Y > y - 1.8 * k); p.rect(x - 2.6 * k, y - 2.6 * k, 5.2 * k, 1.4 * k, G); p.rect(x - .5 * k, y, 1 * k, 2 * k, GD); p.rect(x - 1.8 * k, y + 2 * k, 3.6 * k, 1 * k, G); p.ell(x, y - 2.4 * k, 2 * k, .6 * k, "#6fd0ff"); }
  else if (s === "sword") { p.line(x, y - 3.6 * k, x, y + 1.6 * k, SV, Math.max(1, Math.round(k * 2))); p.rect(x - 2 * k, y + 1.6 * k, 4.4 * k, .9 * k, G); p.rect(x - .3 * k, y + 2.5 * k, 1 * k, 1.6 * k, "#6a4a2a"); }
  else { p.ell(x, y, 2.8 * k, 2.8 * k, G); p.ell(x, y, 1.9 * k, 1.9 * k, GD); starP(p, x, y, 1.6 * k, "#fff4c0"); }
}
const PIPS = [[[16, 25]], [[16, 18], [16, 32]], [[16, 16], [16, 25], [16, 34]], [[10, 18], [22, 18], [10, 32], [22, 32]], [[10, 17], [22, 17], [16, 25], [10, 33], [22, 33]],
  [[10, 16], [22, 16], [10, 25], [22, 25], [10, 34], [22, 34]], [[10, 16], [22, 16], [16, 21], [10, 26], [22, 26], [10, 34], [22, 34]],
  [[10, 15], [22, 15], [10, 22], [22, 22], [10, 29], [22, 29], [10, 36], [22, 36]], [[10, 15], [22, 15], [16, 18.5], [10, 22], [22, 22], [10, 29], [22, 29], [10, 36], [22, 36]],
  [[10, 14], [22, 14], [16, 17.5], [10, 21], [22, 21], [10, 28], [22, 28], [16, 31.5], [10, 35], [22, 35]]];
function minorP(p, suit, rank) {
  if (rank === 0) { starP(p, 16, 25, 9, tone(G, -.5)); suitP(p, suit, 16, 25, 2.4); return; }
  if (rank <= 9) { PIPS[rank].forEach(([x, y]) => suitP(p, suit, x, y, rank > 6 ? .85 : 1)); return; }
  suitP(p, suit, 16, 29, 1.9);
  if (rank === 10) { p.ell(16, 16, 3, 1.4, "#3a5ab0"); p.cap(18, 15.5, 22, 12, .8, "#f4f4f4"); }
  else if (rank === 11) { p.ell(16, 16, 3.4, 3, SV); p.rect(13, 16, 6, 1.4, "#3a3a4a"); p.cap(16, 13, 19, 11, .8, "#c84a4a"); }
  else if (rank === 12) { p.rect(12.5, 15, 7, 2.4, G); for (let i = 0; i < 3; i++) p.tri(12.5 + i * 2.4, 15, 14.9 + i * 2.4, 15, 13.7 + i * 2.4, 12.6, G); p.ell(16, 16.2, .9, .9, "#e04a8a"); }
  else { p.rect(11.5, 14.5, 9, 3, G); for (let i = 0; i < 4; i++) p.tri(11.5 + i * 2.25, 14.5, 13.75 + i * 2.25, 14.5, 12.6 + i * 2.25, 11.5, G); p.ell(16, 16, 1, 1, "#4a9aff"); }
}
function paintCard(cv) {
  const d = cv.dataset, art = d.art, r = +d.r || 0, label = d.label || "", unk = art === "unknown";
  const col = unk ? "#5a6694" : /^#[0-9a-f]{6}$/i.test(d.col || "") ? d.col : "#a9b0cf", rc = unk ? "#3a4675" : RARC[r];
  cv.width = 64; cv.height = 96;
  const g = cv.getContext("2d"); g.imageSmoothingEnabled = false; g.clearRect(0, 0, 64, 96);
  // 地：夜空の3段＋星
  const bands = [[0, 12, tone(col, -.84)], [12, 24, tone(col, -.76)], [24, 38, tone(col, -.68)], [38, 48, tone(col, -.6)]];
  bands.forEach(([a, b, c]) => { g.fillStyle = c; g.fillRect(0, a * 2, 64, (b - a) * 2); });
  g.fillStyle = tone(col, -.3); for (const [x, y] of [[5, 12], [27, 16], [8, 29], [25, 33], [12, 20], [21, 11]]) g.fillRect(x * 2, y * 2, 2, 2);
  // 絵
  const p = Pix(32, 48);
  if (unk) { p.ell(16, 21, 6, 6, "#5a6694"); p.ell(16, 21, 3, 3, null); p.rect(10, 18, 3.5, 6, null); p.rect(14.5, 25, 3, 4, "#5a6694"); p.rect(14.5, 31, 3, 3, "#5a6694"); }
  else if (d.kind === "major") (MAJOR[d.id] || MAJOR.star)(p);
  else minorP(p, d.suit, +d.rank || 0);
  p.finish(); p.draw(g);
  // 上帯（番号）と下帯（★）
  g.fillStyle = "rgba(6,8,20,.85)"; g.fillRect(6, 6, 52, 14); g.fillRect(6, 76, 52, 14);
  const glyphs = label.split(""); let x0 = Math.round((32 - (glyphs.length * 4 - 1)) / 2);
  g.fillStyle = unk ? "#5a6694" : "#f4ecdc";
  for (const ch of glyphs) { (FONT[ch] || []).forEach((row, y) => [...row].forEach((q, x) => { if (q === "#") g.fillRect((x0 + x) * 2, (4 + y) * 2, 2, 2); })); x0 += 4; }
  if (!unk) { g.fillStyle = rc; const n = r + 1, sx = Math.round((32 - (n * 4 - 1)) / 2); for (let i = 0; i < n; i++) { const x = (sx + i * 4) * 2; g.fillRect(x + 2, 78, 2, 2); g.fillRect(x, 80, 6, 2); g.fillRect(x + 2, 82, 2, 2); } }
  // 枠：濃紺の外線＋レアリティ色の二重枠＋四隅
  const fr = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, 2); g.fillRect(x, y + h - 2, w, 2); g.fillRect(x, y, 2, h); g.fillRect(x + w - 2, y, 2, h); };
  fr(0, 0, 64, 96, OUT); fr(2, 2, 60, 92, rc); fr(4, 4, 56, 88, tone(rc, -.45));
  g.fillStyle = rc; [[2, 2], [56, 2], [2, 88], [56, 88]].forEach(([x, y]) => g.fillRect(x, y, 6, 6)); g.fillStyle = OUT; [[4, 4], [58, 4], [4, 90], [58, 90]].forEach(([x, y]) => g.fillRect(x, y, 2, 2));
  if (r >= 2 && !unk) { g.fillStyle = r === 3 ? "#fff6c2" : "#ecdcff"; [[6, 24], [52, 28], [8, 62], [54, 66]].forEach(([x, y]) => { g.fillRect(x, y - 2, 2, 6); g.fillRect(x - 2, y, 6, 2); }); }
}

window.JQArt = { actor, handIcon, icon, paintCard, Pix, tone, ALLY, ENEMY, OUT };
})();

/*! ed-render.js — BK쇼츠 영상 편집: 그리기 · 소리 · MP4 · 모아보기 그림 */
(function (g) {
'use strict';
const ED = g.ED, { clamp, ease, sleep, fmtS, CAPS, FILTERS, PURPOSE, SRC, eff, clipLen, timeline, clipAt, srcTime } = ED;
const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
const SYS = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",system-ui,sans-serif';
const EMO = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/* ═════════ 글꼴 ═════════ */
function fdef(id) { return ENG.fontDef(id || 'noto'); }
function fspec(id, px) { const d = fdef(id); return `${d.weight} ${Math.round(px)}px ${d.family ? '"' + d.family + '",' : ''}${SYS}`; }
async function loadFonts(ids, text) { await Promise.all(Array.from(new Set(ids.filter(Boolean))).map(id => ENG.ensureFont(fdef(id), text || '가나다라마바사아자차카타파하0123456789'))); }
ED.loadFonts = loadFonts; ED.fspec = fspec;

/* ═════════ 브랜드 (가게 정보) ═════════ */
function brands() { try { return JSON.parse(localStorage.getItem('bkEdBrands') || '[]'); } catch (e) { return []; } }
function saveBrands(L) { try { localStorage.setItem('bkEdBrands', JSON.stringify(L)); } catch (e) { ED.toast && ED.toast('저장 공간이 부족해요 (로고를 작게 해 주세요)'); } }
function brand() { const P = ED.P; if (!P || !P.info.brandId) return null; return brands().find(b => b.id === P.info.brandId) || null; }
Object.assign(ED, { brands, saveBrands, brand });
const IMGC = new Map();
function imgFromData(d) {
  if (!d) return null; if (IMGC.has(d)) return IMGC.get(d);
  const im = new Image(); im.src = d; IMGC.set(d, im); return im;
}
const QRC = new Map();
function qrCanvas(text) {
  if (!text || !g.BKQR) return null; if (QRC.has(text)) return QRC.get(text);
  let q; try { q = g.BKQR.encode(text); } catch (e) { return null; }
  const n = q.size + 4, cell = 8, c = document.createElement('canvas'); c.width = c.height = n * cell;
  const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = '#111827';
  for (let yy = 0; yy < q.size; yy++) for (let xx = 0; xx < q.size; xx++) if (q.dark(xx, yy)) x.fillRect((xx + 2) * cell, (yy + 2) * cell, cell, cell);
  QRC.set(text, c); return c;
}
ED.qrCanvas = qrCanvas;

/* ═════════ 도우미 ═════════ */
function rr(x, l, t, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r); x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath(); }
function h01(a, b) { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }
const CV = {};
function tmp(name, W, H) { let c = CV[name]; if (!c) c = CV[name] = document.createElement('canvas'); if (c.width !== W || c.height !== H) { c.width = W; c.height = H; } return c; }
function wrap(x, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const w of para.split(/(\s+)/)) {
      const t = line + w;
      if (x.measureText(t).width <= maxW || !line.trim()) { line = t; continue; }
      out.push(line.trim()); line = w.trim();
    }
    // 띄어쓰기 없는 긴 줄은 글자 단위로
    while (x.measureText(line).width > maxW && line.length > 1) {
      let k = line.length; while (k > 1 && x.measureText(line.slice(0, k)).width > maxW) k--;
      out.push(line.slice(0, k)); line = line.slice(k);
    }
    out.push(line.trim());
  }
  return out.filter((l, i, a) => l || a.length === 1);
}

/* ═════════ 미디어 그리기 ═════════ */
function srcEl(c, endRaw) {
  if (c.kind === 'card') return null;
  const s = SRC.get(c.src); if (!s) return null;
  if (s.kind === 'image') return { el: s.img, w: s.w, h: s.h };
  if (endRaw) { const e = ED.endRaw.get(c.id); if (e && e.key === endKey(c)) return { el: e.c, w: e.c.width, h: e.c.height }; return null; }
  if (s.vid.readyState < 2) return null;
  return { el: s.vid, w: s.w, h: s.h };
}
function coverRect(ew, eh, W, H, fx, fy) {
  const k = Math.max(W / ew, H / eh), w = ew * k, h = eh * k;
  return [(W - w) * clamp(fx, 0, 1), (H - h) * clamp(fy, 0, 1), w, h];
}
/** 흐린 배경: 아주 작게 줄였다가 두 번에 나눠 키워서 부드럽게 */
function blurBg(x, el, ew, eh, W, H, flt, key) {
  const tw = Math.max(6, Math.round(W / 24)), th = Math.max(6, Math.round(H / 24)), t = tmp(key + 's', tw, th), tx = t.getContext('2d');
  tx.imageSmoothingQuality = 'high'; const r0 = coverRect(ew, eh, tw, th, .5, .5); tx.filter = flt || 'none'; tx.drawImage(el, r0[0], r0[1], r0[2], r0[3]); tx.filter = 'none';
  const mw = Math.max(12, Math.round(W / 6)), mh = Math.max(12, Math.round(H / 6)), m = tmp(key + 'm', mw, mh), mx = m.getContext('2d');
  mx.imageSmoothingEnabled = true; mx.imageSmoothingQuality = 'high'; mx.drawImage(t, 0, 0, mw, mh);
  x.save(); x.filter = 'none'; x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high'; x.drawImage(m, -W * .04, -H * .04, W * 1.08, H * 1.08); x.restore();
}
function containRect(ew, eh, W, H) { const k = Math.min(W / ew, H / eh), w = ew * k, h = eh * k; return [(W - w) / 2, (H - h) / 2, w, h]; }
function drawMedia(x, W, H, c, m, lt, len, idx) {
  const P = ED.P;
  if (!m) { x.fillStyle = '#111'; x.fillRect(0, 0, W, H); return; }
  const fit = eff(P, c, 'fit'), flt = (FILTERS[eff(P, c, 'filter')] || FILTERS.none)[1], E = c.efx || [];
  let sc = 1, ox = 0, oy = 0; const p = clamp(lt / Math.max(.1, len), 0, 1);
  if (c.kind === 'image') {
    const kb = c.kb === 'auto' ? (idx % 2 ? 'out' : 'in') : c.kb, q = p;
    if (kb === 'in') sc = 1 + .1 * q; else if (kb === 'out') sc = 1.1 - .1 * q;
    else if (kb === 'left') { sc = 1.1; ox = (.5 - q) * .08 * W; } else if (kb === 'right') { sc = 1.1; ox = (q - .5) * .08 * W; }
  }
  if (E.includes('punch') && lt < .45) sc *= 1 + .28 * (1 - ease(lt / .45));
  if (E.includes('shake')) { const a = lt < 1 ? 1 : .45; ox += Math.sin(lt * 47) * W * .012 * a; oy += Math.cos(lt * 59) * H * .009 * a; }
  const mir = E.includes('mirror');
  x.save();
  x.translate(W / 2 + ox, H / 2 + oy); x.scale(sc * (mir ? -1 : 1), sc); x.translate(-W / 2, -H / 2);
  if (flt !== 'none') x.filter = flt;
  const ar = m.w / m.h, wr = W / H, close = Math.abs(Math.log(ar / wr)) < .08;
  if (fit === 'cover' || (fit === 'blur' && close)) { const r = coverRect(m.w, m.h, W, H, c.fx, c.fy); x.drawImage(m.el, r[0], r[1], r[2], r[3]); }
  else {
    if (fit === 'blur') {
      x.filter = 'none'; blurBg(x, m.el, m.w, m.h, W, H, flt, 'bb');
      x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(0, 0, W, H);
      if (flt !== 'none') x.filter = flt;
    } else { x.fillStyle = '#000'; x.fillRect(0, 0, W, H); }
    const r = containRect(m.w, m.h, W, H); x.drawImage(m.el, r[0], r[1], r[2], r[3]);
  }
  x.restore(); x.filter = 'none';
  postFx(x, W, H, c, lt, len);
}
let GRAIN = null;
function postFx(x, W, H, c, lt, len) {
  const E = c.efx || [];
  if (E.includes('vignette') || ED.P.purpose === 'memory') {
    const gr = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * .35, W / 2, H / 2, Math.max(W, H) * .75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, `rgba(0,0,0,${E.includes('vignette') ? .55 : .3})`); x.fillStyle = gr; x.fillRect(0, 0, W, H);
  }
  if (E.includes('grain')) {
    if (!GRAIN) { GRAIN = document.createElement('canvas'); GRAIN.width = GRAIN.height = 256; const gx = GRAIN.getContext('2d'), id = gx.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 40; } gx.putImageData(id, 0, 0); }
    x.save(); x.globalAlpha = .55; const o = (Math.floor(lt * 24) % 7) * 37; x.fillStyle = x.createPattern(GRAIN, 'repeat'); x.translate(-o, -o * .7); x.fillRect(0, 0, W + 300, H + 300); x.restore();
    x.fillStyle = 'rgba(112,66,20,.08)'; x.fillRect(0, 0, W, H);
  }
  for (const k of ['heart', 'confetti', 'snow', 'petal']) if (E.includes(k)) particles(x, W, H, k, lt);
  if (E.includes('flash') && lt < .35) { x.fillStyle = `rgba(255,255,255,${1 - lt / .35})`; x.fillRect(0, 0, W, H); }
}
function particles(x, W, H, k, t) {
  const N = k === 'snow' ? 60 : 28, m = Math.min(W, H);
  x.save();
  for (let i = 0; i < N; i++) {
    const r1 = h01(i, 1), r2 = h01(i, 2), r3 = h01(i, 3), sp = .08 + r2 * .14;
    let yy = ((r1 + t * sp) % 1.15) - .08, xx = r3 + Math.sin(t * (.6 + r2) + i) * .03;
    if (k === 'heart' || k === 'confetti') yy = 1.08 - yy;
    const px = xx * W, py = yy * H, s = m * (.022 + r2 * .03);
    if (k === 'heart') { x.globalAlpha = .85; x.font = `${s * 1.6}px ${EMO}`; x.textAlign = 'center'; x.fillText(r1 > .5 ? '💗' : '💕', px, py); }
    else if (k === 'confetti') { x.globalAlpha = .9; x.fillStyle = ['#f43f5e', '#facc15', '#22c55e', '#3b82f6', '#a855f7'][i % 5]; x.save(); x.translate(px, py); x.rotate(t * 3 + i); x.fillRect(-s * .35, -s * .15, s * .7, s * .3); x.restore(); }
    else if (k === 'snow') { x.globalAlpha = .8; x.fillStyle = '#fff'; x.beginPath(); x.arc(px, py, s * .22, 0, 7); x.fill(); }
    else { x.globalAlpha = .85; x.fillStyle = r1 > .5 ? '#fbcfe8' : '#f9a8d4'; x.save(); x.translate(px, py); x.rotate(t + i); x.beginPath(); x.ellipse(0, 0, s * .45, s * .25, 0, 0, 7); x.fill(); x.restore(); }
  }
  x.restore();
}

/* ═════════ 장면 끝 화면 (전환용) ═════════ */
ED.endRaw = new Map();
const endKey = c => c.src + '|' + c.out.toFixed(2);
async function ensureEnds() {
  const P = ED.P;
  for (let i = 0; i < P.clips.length - 1; i++) {
    const c = P.clips[i], n = P.clips[i + 1];
    if (c.kind !== 'video' || eff(P, n, 'trans') === 'cut') continue;
    const e = ED.endRaw.get(c.id); if (e && e.key === endKey(c)) continue;
    const s = SRC.get(c.src); if (!s) continue;
    try { const cv = await ED.grabFrame(s, c.out - .04, 1080); ED.endRaw.set(c.id, { key: endKey(c), c: cv }); } catch (err) { /* 건너뜀 */ }
  }
}
ED.ensureEnds = ensureEnds;

/* ═════════ 한 장면 (미디어 + 효과) ═════════ */
function drawLayer(x, W, H, i, lt, atEnd) {
  const P = ED.P, c = P.clips[i], len = clipLen(c);
  if (c.kind === 'card') return drawCard(x, W, H, c, lt, len);
  drawMedia(x, W, H, c, srcEl(c, atEnd && c.kind === 'video'), lt, len, i);
}
function drawFrame(x, W, H, t, opt) {
  opt = opt || {};
  const P = ED.P; x.save(); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.restore();
  if (!P || !P.clips.length) return;
  const A = clipAt(P, t); if (!A.c) return;
  const c = A.c, len = clipLen(c), still = !!opt.still, lt = still ? (c.kind === 'card' ? Math.max(A.lt, Math.min(1.8, len * .6)) : Math.max(A.lt, Math.min(.6, len * .4))) : A.lt, tr = eff(P, c, 'trans');
  const prevLen = A.i > 0 ? clipLen(P.clips[A.i - 1]) : 0, td = Math.min(c.td || .6, len * .45, prevLen * .45);
  if (!still && A.i > 0 && tr !== 'cut' && lt < td && (P.clips[A.i - 1].kind !== 'video' || srcEl(P.clips[A.i - 1], true))) {
    const a = tmp('la', W, H), b = tmp('lb', W, H), ax = a.getContext('2d'), bx = b.getContext('2d');
    drawLayer(ax, W, H, A.i - 1, prevLen, true); drawLayer(bx, W, H, A.i, lt, false);
    const p = lt / td, e = ease(p);
    x.save();
    if (tr === 'fade') { x.drawImage(a, 0, 0); x.globalAlpha = p; x.drawImage(b, 0, 0); }
    else if (tr === 'black' || tr === 'white') { const col = tr === 'black' ? '#000' : '#fff'; x.drawImage(p < .5 ? a : b, 0, 0); x.globalAlpha = 1 - Math.abs(p * 2 - 1); x.fillStyle = col; x.fillRect(0, 0, W, H); }
    else if (tr === 'slide') { x.drawImage(a, -e * W, 0); x.drawImage(b, W - e * W, 0); }
    else if (tr === 'up') { x.drawImage(a, 0, -e * H); x.drawImage(b, 0, H - e * H); }
    else if (tr === 'zoom') { x.drawImage(a, 0, 0); x.globalAlpha = e; const s = 1.35 - .35 * e; x.translate(W / 2, H / 2); x.scale(s, s); x.drawImage(b, -W / 2, -H / 2); }
    else if (tr === 'wipe') { x.drawImage(a, 0, 0); x.beginPath(); x.rect(0, 0, W * e, H); x.clip(); x.drawImage(b, 0, 0); }
    else if (tr === 'whoosh') { const s = Math.sin(p * Math.PI); x.translate(W / 2, H / 2); x.rotate((p < .5 ? -1 : 1) * .06 * s); x.scale(1 + .25 * s, 1 + .25 * s); x.translate(-W / 2, -H / 2); x.drawImage(p < .5 ? a : b, (p < .5 ? -e : 1 - e) * W * .4, 0); }
    else x.drawImage(b, 0, 0);
    x.restore();
  } else drawLayer(x, W, H, A.i, lt, false);
  const hits = [];
  if (c.kind !== 'card') {
    for (let k = 0; k < (c.blur || []).length; k++) hits.push(drawBlur(x, W, H, c.blur[k], k));
    for (let k = 0; k < (c.stk || []).length; k++) hits.push(drawSticker(x, W, H, c.stk[k], still ? Math.max(lt, .5) : lt, len, k));
  }
  const cb = drawCaption(x, W, H, c, lt, len, still); if (cb) hits.push(cb);
  drawWatermark(x, W, H, c);
  if (opt.hits) ED.hits = hits.filter(Boolean);
}
ED.drawFrame = drawFrame;

/* ═════════ 모자이크 ═════════ */
function drawBlur(x, W, H, b, k) {
  const l = Math.round(b.x * W), t = Math.round(b.y * H), w = Math.max(4, Math.round(b.w * W)), h = Math.max(4, Math.round(b.h * H));
  const n = Math.max(4, Math.round(w / Math.max(W, H) * 60)), m = Math.max(4, Math.round(n * h / w)), c = tmp('px', n, m), cx = c.getContext('2d');
  cx.drawImage(x.canvas, l, t, w, h, 0, 0, n, m);
  x.save(); x.imageSmoothingEnabled = false; rr(x, l, t, w, h, Math.min(w, h) * .2); x.clip(); x.drawImage(c, 0, 0, n, m, l, t, w, h); x.restore();
  return { type: 'blur', k, l, t, w, h };
}

/* ═════════ 자막 ═════════ */
function capInfo(c) {
  const P = ED.P, cd = P.capDef, cap = c.cap || {}, key = cap.style || cd.style, st = CAPS[key] || CAPS.basic;
  return { key, st, font: cap.font || cd.font || st.font, size: (cap.size || cd.size || 1) * (st.big || 1) * (st.small || 1), color: cap.color || cd.color || st.fill, anim: cap.anim || cd.anim || st.anim, x: cap.x == null ? .5 : cap.x, y: cap.y == null ? st.y : cap.y };
}
ED.capInfo = capInfo;
function drawCaption(x, W, H, c, lt, len, force) {
  const cap = c.cap || {}; if (!cap.t || !cap.t.trim()) return null;
  const I = capInfo(c), st = I.st, m = Math.min(W, H), px = m * .066 * I.size;
  x.save();
  x.font = fspec(I.font, px); x.textAlign = 'center'; x.textBaseline = 'middle';
  const maxW = W * (st.box === 'bubble' ? .72 : .86) - px;
  let lines = wrap(x, cap.t.trim(), maxW);
  // 등장 · 사라짐
  const aIn = I.anim === 'slowfade' ? .9 : .32, k = force ? 1 : clamp(lt / aIn, 0, 1), out = force ? 1 : clamp((len - lt) / .25, 0, 1);
  let alpha = Math.min(I.anim === 'none' ? 1 : (I.anim === 'pop' || I.anim === 'bounce' ? Math.min(1, k * 2) : ease(k)), out), sc = 1, dx = 0, dy = 0;
  if (I.anim === 'pop') sc = k < 1 ? .6 + .55 * ease(k) - .15 * Math.max(0, k - .7) / .3 : 1;
  if (I.anim === 'bounce') dy = -Math.abs(Math.sin(lt * 5)) * px * .18 * (lt < 1.5 ? 1 : .4);
  if (I.anim === 'slide') dx = (1 - ease(k)) * W * .35;
  if (I.anim === 'type' && !force) { const all = lines.join('\n'), n = Math.floor(all.length * clamp(lt / Math.max(.8, Math.min(len * .55, all.length * .09)), 0, 1)); lines = all.slice(0, n).split('\n'); if (!lines.join('').length) { x.restore(); return null; } }
  const lh = px * 1.28, bw = Math.max(...lines.map(l => x.measureText(l).width)) + px * 1.1, bh = lines.length * lh + px * .55;
  const cxp = I.x * W + dx, cyp = I.y * H + dy;
  x.globalAlpha = alpha; x.translate(cxp, cyp); if (st.tilt) x.rotate(st.tilt * Math.PI / 180); x.scale(sc, sc);
  if (st.box === 'dark') { x.fillStyle = 'rgba(0,0,0,.58)'; rr(x, -bw / 2, -bh / 2, bw, bh, px * .35); x.fill(); }
  else if (st.box === 'red') { x.fillStyle = '#e11d48'; rr(x, -bw / 2, -bh / 2, bw, bh, px * .3); x.fill(); x.strokeStyle = '#fff'; x.lineWidth = px * .1; x.stroke(); }
  else if (st.box === 'band') { const bwf = W * 1.2; x.fillStyle = 'rgba(23,71,130,.92)'; x.fillRect(-bwf / 2, -bh / 2, bwf, bh); x.fillStyle = '#ef4444'; x.fillRect(-W / 2, -bh / 2, px * .35, bh); }
  else if (st.box === 'bubble') { x.fillStyle = '#ffffff'; rr(x, -bw / 2, -bh / 2, bw, bh, px * .7); x.fill(); x.beginPath(); x.moveTo(-bw * .18, bh / 2 - 2); x.lineTo(-bw * .3, bh / 2 + px * .7); x.lineTo(-bw * .05, bh / 2 - 2); x.closePath(); x.fill(); x.strokeStyle = 'rgba(0,0,0,.12)'; x.lineWidth = 2; rr(x, -bw / 2, -bh / 2, bw, bh, px * .7); x.stroke(); }
  const y0 = -(lines.length - 1) * lh / 2;
  x.lineJoin = 'round'; x.miterLimit = 2;
  lines.forEach((l, i) => {
    const yy = y0 + i * lh;
    if (st.outer) { x.strokeStyle = st.outer; x.lineWidth = px * st.sw * 1.9; x.strokeText(l, 0, yy); }
    if (st.stroke) { x.strokeStyle = st.stroke; x.lineWidth = px * st.sw; x.strokeText(l, 0, yy); }
    if (st.shadow) { x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = px * .3; x.shadowOffsetY = px * .06; }
    if (st.glow) { x.shadowColor = st.glow; x.shadowBlur = px * .7; x.fillStyle = I.color; x.fillText(l, 0, yy); }
    x.fillStyle = st.box === 'bubble' && !(c.cap || {}).color ? '#222' : I.color; x.fillText(l, 0, yy);
    x.shadowColor = 'transparent'; x.shadowBlur = 0; x.shadowOffsetY = 0;
  });
  x.restore();
  return { type: 'cap', l: cxp - bw / 2, t: cyp - bh / 2, w: bw, h: bh };
}
ED.drawCaption = drawCaption;

/* ═════════ 스티커 ═════════ */
function starPath(x, r1, r2, n) { x.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = i * Math.PI / n - Math.PI / 2; x.lineTo(Math.cos(a) * r, Math.sin(a) * r); } x.closePath(); }
function drawSticker(x, W, H, s, lt, len, k) {
  const m = Math.min(W, H), base = m * .16 * (s.s || 1);
  let sc = 1, rot = 0, dy = 0;
  if (s.a === 'pop' || !s.a) sc = lt < .35 ? .3 + .85 * ease(lt / .35) - .15 * Math.max(0, lt / .35 - .7) / .3 : 1;
  if (s.a === 'bounce') dy = -Math.abs(Math.sin(lt * 4)) * base * .2;
  if (s.a === 'spin') rot = Math.sin(lt * 3) * .25;
  if (s.a === 'float') dy = Math.sin(lt * 2) * base * .08;
  const cx = s.x * W, cy = s.y * H + dy;
  x.save(); x.translate(cx, cy); x.rotate(rot); x.scale(sc, sc); x.textAlign = 'center'; x.textBaseline = 'middle';
  let w = base, h = base;
  if (s.k === 'emoji') { x.font = `${base}px ${EMO}`; x.fillText(s.v || '😂', 0, base * .05); }
  else {
    const b = s.b, v = s.v || '', fs = base * .3;
    if (b === 'sale') { starPath(x, base * .62, base * .48, 14); x.fillStyle = '#ef4444'; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = base * .04; x.stroke(); x.fillStyle = '#fff'; x.font = fspec('blackhan', fs * .95); const L = wrap(x, v || '할인', base * .85); L.forEach((l, i) => x.fillText(l, 0, (i - (L.length - 1) / 2) * fs * 1.1)); w = h = base * 1.25; }
    else if (b === 'new' || b === 'best' || b === 'open') { const col = { new: '#22c55e', best: '#f59e0b', open: '#ec4899' }[b], tx = v || b.toUpperCase(); x.beginPath(); x.arc(0, 0, base * .45, 0, 7); x.fillStyle = col; x.fill(); x.strokeStyle = '#fff'; x.lineWidth = base * .05; x.stroke(); x.fillStyle = '#fff'; x.font = fspec('blackhan', fs * (tx.length > 4 ? .75 : 1)); x.fillText(tx, 0, 2); w = h = base * .95; }
    else if (b === 'qr') { const q = qrCanvas(v || 'https://bangkeukryul.github.io/'); const sz = base * 1.1; x.fillStyle = '#fff'; rr(x, -sz / 2 - 8, -sz / 2 - 8, sz + 16, sz + 16 + fs, 12); x.fill(); if (q) { x.imageSmoothingEnabled = false; x.drawImage(q, -sz / 2, -sz / 2, sz, sz); } x.fillStyle = '#111'; x.font = fspec('noto', fs * .55); x.fillText('찍어 보세요', 0, sz / 2 + fs * .45); w = sz + 16; h = sz + 16 + fs; }
    else if (b === 'arrow') { x.font = `${base}px ${EMO}`; x.fillText(v || '👉', 0, base * .05); }
    else {
      const pre = b === 'pin' ? '📍 ' : b === 'phone' ? '📞 ' : '', t = pre + (v || BADGE_DEF[b] || ''), font = b === 'text' ? fspec('blackhan', fs * 1.25) : fspec(b === 'price' ? 'blackhan' : 'noto', fs);
      x.font = font; const tw = x.measureText(t).width, pw = tw + fs * 1.2, ph = fs * (b === 'text' ? 1.9 : 1.75);
      if (b === 'text') { x.lineJoin = 'round'; x.strokeStyle = '#111'; x.lineWidth = fs * .3; x.strokeText(t, 0, 0); x.fillStyle = '#ffe14d'; x.fillText(t, 0, 0); }
      else {
        const bg = { price: '#ffdd00', pin: '#ffffff', phone: '#16a34a' }[b] || '#fff', fg = { price: '#111', pin: '#111', phone: '#fff' }[b] || '#111';
        x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = fs * .5; x.fillStyle = bg; rr(x, -pw / 2, -ph / 2, pw, ph, ph / 2); x.fill(); x.shadowBlur = 0; x.shadowColor = 'transparent';
        if (b === 'price') { x.strokeStyle = '#111'; x.lineWidth = fs * .08; x.stroke(); }
        x.fillStyle = fg; x.fillText(t, 0, fs * .05);
      }
      w = pw; h = ph;
    }
  }
  x.restore();
  return { type: 'stk', k, l: cx - w * sc / 2, t: cy - h * sc / 2, w: w * sc, h: h * sc };
}
const BADGE_DEF = { price: '가격', pin: '주소', phone: '전화번호', text: '글씨' };
ED.drawSticker = drawSticker;

/* ═════════ 워터마크 (가게 로고) ═════════ */
function drawWatermark(x, W, H, c) {
  const P = ED.P, B = brand(); if (!P.wm || !B || !B.logo || c.kind === 'card') return;
  const im = imgFromData(B.logo); if (!im || !im.complete || !im.naturalWidth) return;
  const m = Math.min(W, H), s = m * .13, k = s / Math.max(im.naturalWidth, im.naturalHeight);
  x.save(); x.globalAlpha = .85; x.drawImage(im, W - im.naturalWidth * k - m * .04, m * .04, im.naturalWidth * k, im.naturalHeight * k); x.restore();
}

/* ═════════ 제목 · 엔딩 카드 ═════════ */
const CTA = { store: '지금 방문하세요!', menu: '오늘 맛보러 오세요!', product: '지금 만나 보세요!', realty: '문의 환영합니다', company: '감사합니다', me: '편하게 연락 주세요' };
function firstMedia() { const P = ED.P; for (const c of P.clips) { if (c.kind === 'image') { const s = SRC.get(c.src); if (s) return s.img; } } for (const c of P.clips) if (c.kind === 'video') { const e = ED.thumbs && ED.thumbs.get(c.src); if (e) return e; } return null; }
function cardBg(x, W, H, type, B) {
  const P = ED.P;
  if (type === 'memorial') { const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0b0b0f'); gr.addColorStop(1, '#1c1917'); x.fillStyle = gr; x.fillRect(0, 0, W, H); return; }
  if (type === 'credits') { x.fillStyle = '#0b1020'; x.fillRect(0, 0, W, H); return; }
  if ((type === 'store' || type === 'company') && B) { const col = B.color || '#174782', gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, col); gr.addColorStop(1, '#0f172a'); x.fillStyle = gr; x.fillRect(0, 0, W, H); return; }
  const im = firstMedia();
  if (im) { blurBg(x, im, im.width || im.videoWidth, im.height || im.videoHeight, W, H, 'none', 'cb'); x.fillStyle = 'rgba(0,0,0,.5)'; x.fillRect(0, 0, W, H); return; }
  const pal = { meet: ['#7c3aed', '#db2777'], family: ['#f59e0b', '#ef4444'], kids: ['#f9a8d4', '#a78bfa'], travel: ['#0ea5e9', '#14b8a6'], event: ['#174782', '#0f172a'], church: ['#78350f', '#1c1917'], blog: ['#334155', '#0f172a'] }[P.purpose] || ['#174782', '#0f172a'];
  const gr = x.createLinearGradient(0, 0, W, H); gr.addColorStop(0, pal[0]); gr.addColorStop(1, pal[1]); x.fillStyle = gr; x.fillRect(0, 0, W, H);
}
function txt(x, s, px, font, col, cx, cy, maxW, opt) {
  opt = opt || {}; x.font = fspec(font, px); x.textAlign = opt.align || 'center'; x.textBaseline = 'middle';
  const L = wrap(x, s, maxW), lh = px * (opt.lh || 1.3), y0 = cy - (L.length - 1) * lh / 2;
  if (opt.shadow !== false) { x.shadowColor = 'rgba(0,0,0,.55)'; x.shadowBlur = px * .25; }
  x.fillStyle = col; L.forEach((l, i) => x.fillText(l, cx, y0 + i * lh)); x.shadowColor = 'transparent'; x.shadowBlur = 0;
  return L.length * lh;
}
function drawCard(x, W, H, c, lt, len) {
  const P = ED.P, I = P.info, B = brand(), pp = PURPOSE[P.purpose] || PURPOSE.meet, m = Math.min(W, H), wide = W / H > 1.2;
  const type = c.card === 'title' ? 'title' : (c.card || pp.end);
  const ff = P.capDef.font || (CAPS[P.capDef.style] || CAPS.basic).font;
  x.save(); cardBg(x, W, H, type, B);
  const a = k => clamp((lt - k) / .6, 0, 1), out = clamp((len - lt) / .4, 0, 1);
  x.globalAlpha = out;
  if (type === 'title') {
    const ttl = I.title || (B && B.name) || pp.n, sub = I.sub || (B && pp.biz ? B.slogan : '') || '';
    const logo = B && B.logo && pp.biz ? imgFromData(B.logo) : null;
    let y = H * .5;
    if (logo && logo.complete && logo.naturalWidth) { const s = m * .2, k = s / Math.max(logo.naturalWidth, logo.naturalHeight); x.globalAlpha = out * a(0); x.drawImage(logo, W / 2 - logo.naturalWidth * k / 2, H * .5 - m * .32, logo.naturalWidth * k, logo.naturalHeight * k); y = H * .5 + m * .02; }
    x.globalAlpha = out * a(.1); const s1 = 1 + .06 * (1 - ease(a(.1)));
    x.save(); x.translate(W / 2, y); x.scale(s1, s1); txt(x, ttl, m * .11, ff, '#ffffff', 0, 0, W * .86); x.restore();
    if (sub) { x.globalAlpha = out * a(.6); txt(x, sub, m * .05, 'noto', '#e2e8f0', W / 2, y + m * .13, W * .8); }
  } else if (type === 'memorial') {
    x.globalAlpha = out * clamp((lt - .3) / 1.4, 0, 1);
    txt(x, I.ending || '보고 싶습니다. 사랑합니다.', m * .075, ff || 'gowunbatang', '#fef3c7', W / 2, H * .47, W * .8, { lh: 1.5 });
    if (I.sub) { x.globalAlpha = out * clamp((lt - 1.2) / 1.2, 0, 1); txt(x, I.sub, m * .042, 'gowunbatang', '#a8a29e', W / 2, H * .47 + m * .2, W * .8); }
  } else if (type === 'credits') {
    const names = (I.names || '').split(/[,\n、·]+/).map(s => s.trim()).filter(Boolean);
    x.globalAlpha = out * a(0); txt(x, I.ending || (names.length ? '함께한 사람들' : '함께해 주셔서 감사합니다'), m * .07, ff, '#fde68a', W / 2, names.length ? H * .14 : H * .5, W * .86);
    if (names.length) {
      const px = m * .055, lh = px * 1.7, cols = wide ? 3 : 2, rows = Math.ceil(names.length / cols), totalH = rows * lh, top = H * .26;
      const scroll = totalH > H * .66 ? (lt / len) * (totalH - H * .55) : 0;
      x.save(); x.beginPath(); x.rect(0, top - px, W, H - top - m * .04); x.clip();
      names.forEach((n, i) => { const r = Math.floor(i / cols), cc = i % cols, yy = top + r * lh - scroll, xx = W * (cc + .5) / cols; x.globalAlpha = out * clamp((lt - .3 - i * .06) / .5, 0, 1); txt(x, n, px, 'noto', '#ffffff', xx, yy, W / cols * .9, { shadow: false }); });
      x.restore();
    }
  } else if (type === 'store' || type === 'company') {
    const name = (B && B.name) || I.title || '가게 이름', rows = [];
    if (B) { if (B.addr) rows.push('📍 ' + B.addr); if (B.hours) rows.push('⏰ ' + B.hours); if (B.phone) rows.push('📞 ' + B.phone); if (B.parking && type === 'store') rows.push('🅿️ ' + B.parking); }
    const q = B && B.link ? qrCanvas(B.link) : null, logo = B && B.logo ? imgFromData(B.logo) : null;
    const colW = wide && q ? W * .58 : W * .86, cx = wide && q ? W * .36 : W / 2;
    let y = wide ? H * .2 : H * .17;
    if (logo && logo.complete && logo.naturalWidth) { const s = m * .16, k = s / Math.max(logo.naturalWidth, logo.naturalHeight); x.globalAlpha = out * a(0); x.drawImage(logo, cx - logo.naturalWidth * k / 2, y - s * .55, logo.naturalWidth * k, logo.naturalHeight * k); y += s * .7; }
    x.globalAlpha = out * a(.1); y += txt(x, name, m * .095, ff, '#ffffff', cx, y + m * .04, colW) * .6 + m * .07;
    if (B && B.slogan) { x.globalAlpha = out * a(.3); y += txt(x, B.slogan, m * .045, 'noto', '#e0e7ff', cx, y, colW) + m * .03; }
    rows.forEach((r, i) => { x.globalAlpha = out * a(.5 + i * .15); y += txt(x, r, m * .043, 'noto', '#ffffff', cx, y + m * .02, colW) + m * .015; });
    if (B && B.event && type === 'store') { x.globalAlpha = out * a(.9); x.font = fspec('blackhan', m * .048); const tw = x.measureText(B.event).width + m * .08, ph = m * .085; y += m * .05; x.fillStyle = '#ef4444'; rr(x, cx - tw / 2, y - ph / 2, tw, ph, ph / 2); x.fill(); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(B.event, cx, y + 2); y += ph * .6; }
    if (q) { const s = wide ? Math.min(H * .5, W * .26) : m * .34, qx = wide ? W * .78 - s / 2 : W / 2 - s / 2, qy = wide ? H * .38 - s / 2 : Math.max(y + m * .05, H * .66 - s / 2); x.globalAlpha = out * a(1); x.fillStyle = '#fff'; rr(x, qx - 10, qy - 10, s + 20, s + 20 + m * .06, 14); x.fill(); x.imageSmoothingEnabled = false; x.drawImage(q, qx, qy, s, s); x.imageSmoothingEnabled = true; txt(x, '📱 찍으면 바로 연결', m * .033, 'noto', '#111827', qx + s / 2, qy + s + m * .03, s + 20, { shadow: false }); }
    x.globalAlpha = out * a(1.3); txt(x, CTA[P.purpose] || '감사합니다', m * .07, 'blackhan', '#fde047', W / 2, H * .9, W * .9);
  } else {
    x.globalAlpha = out * a(.1); txt(x, I.ending || '감사합니다', m * .085, ff, '#ffffff', W / 2, H * .46, W * .84, { lh: 1.4 });
    if (I.sub) { x.globalAlpha = out * a(.6); txt(x, I.sub, m * .045, 'noto', '#e2e8f0', W / 2, H * .46 + m * .15, W * .8); }
  }
  x.restore();
}
ED.drawCard = drawCard;

/* ═════════ 효과음 (프로그램이 직접 만드는 소리 — 저작권 걱정 없음) ═════════ */
function nbuf(oc, d) { const n = Math.max(1, Math.ceil(oc.sampleRate * d)), b = oc.createBuffer(1, n, oc.sampleRate), a = b.getChannelData(0); for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1; return b; }
function env(g2, t, a, d, pk) { g2.gain.setValueAtTime(0, t); g2.gain.linearRampToValueAtTime(pk, t + a); g2.gain.exponentialRampToValueAtTime(.0008, t + a + d); }
function osc(oc, dst, type, f0, f1, t, d, pk) { const o = oc.createOscillator(), g2 = oc.createGain(); o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + d); env(g2, t, .006, d, pk); o.connect(g2); g2.connect(dst); o.start(t); o.stop(t + d + .1); return o; }
function nz(oc, dst, t, d, pk, type, f, q) { const s = oc.createBufferSource(); s.buffer = nbuf(oc, d + .1); const fl = oc.createBiquadFilter(); fl.type = type || 'bandpass'; fl.frequency.setValueAtTime(f || 1500, t); fl.Q.value = q || 1; const g2 = oc.createGain(); env(g2, t, .002, d, pk); s.connect(fl); fl.connect(g2); g2.connect(dst); s.start(t); s.stop(t + d + .1); return fl; }
function sfx(oc, dst, k, t) {
  if (k === 'clap') { for (let i = 0; i < 14; i++) nz(oc, dst, t + i * .085 + Math.random() * .04, .08, .55, 'bandpass', 1200 + Math.random() * 900, 1.3); }
  else if (k === 'boing') { const o = oc.createOscillator(), g2 = oc.createGain(), l = oc.createOscillator(), lg = oc.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(200, t); o.frequency.linearRampToValueAtTime(560, t + .14); o.frequency.exponentialRampToValueAtTime(170, t + .75); l.frequency.value = 14; lg.gain.value = 26; l.connect(lg); lg.connect(o.frequency); env(g2, t, .01, .75, .55); o.connect(g2); g2.connect(dst); o.start(t); l.start(t); o.stop(t + .9); l.stop(t + .9); }
  else if (k === 'pop') osc(oc, dst, 'sine', 380, 1400, t, .13, .7);
  else if (k === 'dun') { osc(oc, dst, 'sine', 130, 42, t, .45, 1); osc(oc, dst, 'sine', 120, 38, t + .38, .9, 1); nz(oc, dst, t + .38, .25, .25, 'lowpass', 400, .7); }
  else if (k === 'ding') { [[784, 0], [659, .3], [1047, .6]].forEach(([f, d]) => { osc(oc, dst, 'sine', f, 0, t + d, .7, .45); osc(oc, dst, 'sine', f * 2, 0, t + d, .35, .1); }); }
  else if (k === 'buzz') { osc(oc, dst, 'square', 140, 0, t, .55, .22); osc(oc, dst, 'sawtooth', 147, 0, t, .55, .15); }
  else if (k === 'whoosh') { const fl = nz(oc, dst, t, .5, .7, 'bandpass', 300, 1.6); fl.frequency.exponentialRampToValueAtTime(3200, t + .45); }
  else if (k === 'tada') { [523, 659, 784, 1047].forEach((f, i) => osc(oc, dst, 'triangle', f, 0, t + i * .08, i === 3 ? 1.1 : .3, .35)); [523, 659, 784].forEach(f => osc(oc, dst, 'triangle', f, 0, t + .32, 1, .18)); }
  else if (k === 'shutter') { nz(oc, dst, t, .035, .9, 'highpass', 2500, .7); nz(oc, dst, t + .09, .05, .7, 'highpass', 1800, .7); }
  else if (k === 'roll') { for (let i = 0; i < 26; i++) nz(oc, dst, t + i * .048, .045, .2 + i * .02, 'bandpass', 1800, .8); nz(oc, dst, t + 1.3, 1.1, .7, 'highpass', 4000, .5); osc(oc, dst, 'sine', 110, 50, t + 1.3, .5, .8); }
  else if (k === 'sparkle') { for (let i = 0; i < 9; i++) osc(oc, dst, 'sine', 1800 + Math.random() * 2600, 0, t + i * .055, .28, .16); }
  else if (k === 'heart') { [0, .2, .75, .95].forEach(d => osc(oc, dst, 'sine', 75, 45, t + d, .18, .9)); }
}
ED.sfx = sfx;
async function sfxPreview(k) {
  const sr = 44100, oc = new OAC(2, sr * 3, sr); sfx(oc, oc.destination, k, .02);
  const buf = await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const p = oc.startRendering(); if (p && p.then) p.then(res, rej); });
  const ac = ED.ac(); const s = ac.createBufferSource(); s.buffer = buf; s.connect(ac.destination); s.start();
}
ED.sfxPreview = sfxPreview;
let AC = null; ED.ac = () => { if (!AC) AC = new (g.AudioContext || g.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; };

/* ═════════ 소리 섞기 (원래 소리 · 목소리 · 효과음 · 음악) ═════════ */
const MUSIC = new Map();
async function musicBuf(total) {
  const P = ED.P, M = P.music, pp = PURPOSE[P.purpose] || PURPOSE.meet;
  const kind = M.kind === 'auto' ? pp.mus : M.kind;
  if (!kind || kind === 'none') return null;
  if (kind === 'file') { const s = SRC.get(M.fileId); return s && s.buf ? s.buf : null; }
  const need = Math.ceil(total + 1), key = kind;
  const hit = MUSIC.get(key); if (hit && hit.duration >= need) return hit;
  if (!g.BKMUSIC) return null;
  const b = await g.BKMUSIC.render(kind, Math.max(need, 20)); MUSIC.set(key, b); return b;
}
async function mixAudio(sr) {
  const P = ED.P, { st, total } = timeline(P), len = Math.max(1, Math.ceil(total * sr));
  const oc = new OAC(2, len, sr), comp = oc.createDynamicsCompressor(); comp.threshold.value = -8; comp.ratio.value = 4; comp.connect(oc.destination);
  const master = oc.createGain(); master.connect(comp);
  const voiced = [];
  for (let i = 0; i < P.clips.length; i++) {
    const c = P.clips[i], at = st[i];
    if (c.kind === 'video' && !c.mute && (c.vol || 0) > 0 && P.clipVol > 0) {
      const s = SRC.get(c.src), buf = s ? await ED.clipAudio(s) : null;
      if (buf && c.in < buf.duration - .05) {
        const d = Math.min(c.out - c.in, buf.duration - c.in), td = d / (c.speed || 1);
        const n = oc.createBufferSource(); n.buffer = buf; n.playbackRate.value = c.speed || 1;
        const g2 = oc.createGain(), v = c.vol * P.clipVol, f = Math.min(.06, td / 4);
        g2.gain.setValueAtTime(0, at); g2.gain.linearRampToValueAtTime(v, at + f); g2.gain.setValueAtTime(v, at + td - f); g2.gain.linearRampToValueAtTime(0, at + td);
        n.connect(g2); g2.connect(master); n.start(at, c.in, d); voiced.push([at, at + td]);
      }
    }
    if (c.vo) { const a = SRC.get(c.vo.src); if (a && a.buf) { const n = oc.createBufferSource(), g2 = oc.createGain(); n.buffer = a.buf; g2.gain.value = c.vo.vol || 1.2; n.connect(g2); g2.connect(master); const t0 = at + (c.vo.at || .2); n.start(t0); voiced.push([t0, t0 + a.buf.duration]); } }
    for (const s of (c.sfx || [])) sfx(oc, master, s.k, at + clamp(s.at || 0, 0, clipLen(c)));
  }
  const mb = await musicBuf(total);
  if (mb) {
    const M = P.music, s = oc.createBufferSource(); s.buffer = mb; s.loop = M.kind === 'file';
    const gv = oc.createGain(), duck = oc.createGain(); gv.gain.value = M.vol;
    duck.gain.setValueAtTime(0, 0); duck.gain.linearRampToValueAtTime(1, .5);
    if (M.duck) {
      const zones = voiced.sort((p, q) => p[0] - q[0]).reduce((acc, z) => { const l = acc[acc.length - 1]; if (l && z[0] - l[1] < .7) l[1] = Math.max(l[1], z[1]); else acc.push(z.slice()); return acc; }, []);
      for (const [a, b] of zones) { duck.gain.setValueAtTime(1, Math.max(.5, a - .25)); duck.gain.linearRampToValueAtTime(.2, Math.max(.51, a)); duck.gain.setValueAtTime(.2, b); duck.gain.linearRampToValueAtTime(1, b + .35); }
    }
    const fo = Math.min(M.fade || 0, total / 3); if (fo > 0) { duck.gain.setValueAtTime(duck.gain.value, Math.max(0, total - fo)); }
    const fade = oc.createGain(); fade.gain.setValueAtTime(1, 0); if (fo > 0) { fade.gain.setValueAtTime(1, total - fo); fade.gain.linearRampToValueAtTime(0, total); }
    s.connect(gv); gv.connect(duck); duck.connect(fade); fade.connect(master); s.start(0);
  }
  return await new Promise((res, rej) => { oc.oncomplete = e => res(e.renderedBuffer); const p = oc.startRendering(); if (p && p.then) p.then(res, rej); });
}
ED.mixAudio = mixAudio;

/* ═════════ MP4 만들기 ═════════ */
async function pickV(W, H, fps, hq) {
  const list = Math.min(W, H) >= 1080 ? ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032'] : ['avc1.64001f', 'avc1.4d001f', 'avc1.42e01f', 'avc1.640028'];
  const bitrate = Math.min(W, H) >= 1080 ? (hq ? 12e6 : 8e6) : (hq ? 6e6 : 4e6);
  for (const codec of list) { const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } }; try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (e) { /* 다음 */ } }
  return null;
}
async function pickA(sr) {
  if (typeof AudioEncoder === 'undefined') return null;
  for (const c of [{ codec: 'mp4a.40.2', mux: 'aac', b: 160000 }, { codec: 'opus', mux: 'opus', b: 128000 }]) { const cfg = { codec: c.codec, sampleRate: sr, numberOfChannels: 2, bitrate: c.b }; try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux: c.mux }; } catch (e) { /* 다음 */ } }
  return null;
}
async function prepare() {
  const P = ED.P, ids = [P.capDef.font, ...Object.values(CAPS).map(s => s.font).filter((f, i, a) => a.indexOf(f) === i && P.clips.some(c => capInfo(c).font === f)), 'blackhan', 'noto', 'gowunbatang'];
  const text = P.clips.map(c => (c.cap || {}).t || '').join('') + Object.values(P.info).join('') + JSON.stringify(brand() || {}) + P.clips.map(c => (c.stk || []).map(s => s.v || '').join('')).join('') + '가나다0123456789';
  await loadFonts(ids, text.slice(0, 4000));
  const B = brand(); if (B && B.logo) { const im = imgFromData(B.logo); if (!im.complete) await new Promise(r => { im.onload = r; im.onerror = r; setTimeout(r, 3000); }); }
  await ensureEnds();
}
ED.prepare = prepare;
async function exportMp4(ratio, q, onProg, ctl) {
  ctl = ctl || {};
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('이 브라우저는 영상 만들기를 지원하지 않아요. 안드로이드는 크롬, 아이폰은 최신 사파리를 써 주세요.');
  const P = ED.P, [W, H] = ED.outSize(ratio, q), fps = 30, SR = 48000, { total } = timeline(P);
  if (total < .5) throw new Error('장면이 없어요.');
  const vcfg = await pickV(W, H, fps, false); if (!vcfg) throw new Error(`이 휴대폰은 ${W}x${H} 영상을 못 만들어요. 화질을 720으로 낮춰 보세요.`);
  onProg && onProg(0, 1, 'prep'); await prepare();
  const acfg = await pickA(SR); let warning = acfg ? null : '이 브라우저는 소리 넣기를 지원하지 않아 소리 없이 만들었어요.';
  const mux = new g.Mp4Muxer({ video: { width: W, height: H }, audio: acfg ? { codec: acfg.mux, sampleRate: SR, numberOfChannels: 2, bitrate: acfg.cfg.bitrate } : undefined });
  let err = null;
  if (acfg) {
    onProg && onProg(0, 1, 'audio');
    const ab = await mixAudio(SR);
    const ae = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: e => { err = e; } }); ae.configure(acfg.cfg);
    const L = ab.getChannelData(0), R = ab.numberOfChannels > 1 ? ab.getChannelData(1) : L, N = ab.length, BLK = 4800;
    for (let i = 0; i < N; i += BLK) { const n = Math.min(BLK, N - i), d = new Float32Array(n * 2); d.set(L.subarray(i, i + n), 0); d.set(R.subarray(i, i + n), n); const a = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / SR), data: d }); ae.encode(a); a.close(); if (ae.encodeQueueSize > 16) await sleep(1); if (err) throw err; }
    await ae.flush(); ae.close(); if (err) throw err;
  }
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d', { alpha: false }); x.imageSmoothingQuality = 'high';
  const ve = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: e => { err = e; } }); ve.configure(vcfg);
  const nF = Math.max(1, Math.round(total * fps)), fd = Math.round(1e6 / fps), t0 = performance.now();
  for (const s of SRC.values()) if (s.vid) s.vid.pause();
  try {
    for (let i = 0; i < nF; i++) {
      if (ctl.aborted) throw new Error('취소했어요.'); if (err) throw err;
      const t = i / fps, A = clipAt(P, t);
      if (A.c && A.c.kind === 'video') { const s = SRC.get(A.c.src); if (s) await ENG.seekVideo(s.vid, srcTime(A.c, A.lt)); }
      drawFrame(x, W, H, t);
      const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: fd }); ve.encode(vf, { keyFrame: i % (fps * 2) === 0 }); vf.close();
      while (ve.encodeQueueSize > 6) await sleep(2);
      if (i % 6 === 0 || i === nF - 1) { onProg && onProg((i + 1) / nF, (performance.now() - t0) / 1000, 'video'); await sleep(0); }
    }
    await ve.flush(); if (err) throw err;
  } finally { try { ve.close(); } catch (e) { /* 닫힘 */ } cv.width = cv.height = 0; }
  return { blob: new Blob(mux.finalize(), { type: 'video/mp4' }), W, H, warning };
}
ED.exportMp4 = exportMp4;

/* ═════════ AI용 모아보기 그림 ═════════ */
async function contactSheets(mode) {
  const P = ED.P, tiles = [];
  if (mode === 'clips') {
    const { st } = timeline(P);
    for (let i = 0; i < P.clips.length; i++) {
      const c = P.clips[i];
      tiles.push({ label: `C${i + 1}`, sub: fmtS(clipLen(c)) + '초', get: async () => {
        if (c.kind === 'card') { const cv = document.createElement('canvas'); cv.width = 360; cv.height = 360 * (ED.RATIOS[P.ratio][1] / ED.RATIOS[P.ratio][0]); drawCard(cv.getContext('2d'), cv.width, cv.height, c, 1.5, 3); return cv; }
        const s = SRC.get(c.src); return s ? ED.grabFrame(s, c.kind === 'video' ? (c.in + c.out) / 2 : 0, 420) : null;
      } });
    }
  } else {
    for (const m of P.srcs) {
      const s = SRC.get(m.id); if (!s || s.kind === 'audio') continue;
      if (s.kind === 'image') tiles.push({ label: m.code, sub: '사진', get: async () => s.img });
      else {
        const d = s.dur, step = d <= 20 ? 2 : d <= 60 ? 4 : d <= 180 ? 8 : 12, n = Math.min(24, Math.max(2, Math.floor(d / step) + 1));
        for (let k = 0; k < n; k++) { const t = Math.min(d - .1, k * step); tiles.push({ label: m.code, sub: fmtS(t), get: () => ED.grabFrame(s, t, 420) }); }
      }
    }
  }
  const per = 16, cols = 4, TW = 300, TH = 300, LH = 34, out = [];
  for (let p = 0; p < tiles.length; p += per) {
    const part = tiles.slice(p, p + per), rows = Math.ceil(part.length / cols), cv = document.createElement('canvas'); cv.width = cols * TW; cv.height = rows * (TH + LH);
    const x = cv.getContext('2d'); x.fillStyle = '#111827'; x.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < part.length; i++) {
      const tl = part[i], l = (i % cols) * TW, t = Math.floor(i / cols) * (TH + LH); let im = null; try { im = await tl.get(); } catch (e) { /* 빈칸 */ }
      if (im) { const iw = im.width || im.videoWidth, ih = im.height || im.videoHeight, r = containRect(iw, ih, TW - 6, TH - 6); x.drawImage(im, l + 3 + r[0], t + 3 + r[1], r[2], r[3]); }
      x.fillStyle = '#fde047'; x.fillRect(l, t + TH, TW, LH); x.fillStyle = '#111'; x.font = `800 22px ${SYS}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(`${tl.label} · ${tl.sub}`, l + TW / 2, t + TH + LH / 2 + 1);
    }
    const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', .82)); out.push({ blob, url: URL.createObjectURL(blob), n: part.length });
  }
  return out;
}
ED.contactSheets = contactSheets;

/* ═════════ 블로그 묶음 ═════════ */
function srtText() {
  const P = ED.P, { st } = timeline(P), ts = s => { const ms = Math.round(s * 1000), h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, ss = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
  let n = 0; const L = [];
  P.clips.forEach((c, i) => { const t = (c.cap || {}).t; if (!t || !t.trim()) return; n++; L.push(n, `${ts(st[i] + .1)} --> ${ts(st[i] + clipLen(c) - .1)}`, t.trim(), ''); });
  return L.join('\n');
}
async function thumbnail(t, title) {
  const W = 1280, H = 720, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const P = ED.P, A = clipAt(P, t); if (A.c && A.c.kind === 'video') { const s = SRC.get(A.c.src); if (s) await ENG.seekVideo(s.vid, srcTime(A.c, A.lt)); }
  const keepCap = A.c ? A.c.cap : null; if (A.c) A.c.cap = { t: '' };
  drawFrame(x, W, H, t); if (A.c) A.c.cap = keepCap;
  if (title) {
    const gr = x.createLinearGradient(0, H * .45, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.78)'); x.fillStyle = gr; x.fillRect(0, H * .45, W, H * .55);
    await loadFonts(['blackhan'], title);
    x.font = fspec('blackhan', 92); x.textAlign = 'center'; x.textBaseline = 'middle'; const L = wrap(x, title, W * .9).slice(0, 2);
    L.forEach((l, i) => { const y = H - 70 - (L.length - 1 - i) * 104; x.lineJoin = 'round'; x.strokeStyle = '#111'; x.lineWidth = 16; x.strokeText(l, W / 2, y); x.fillStyle = '#ffe14d'; x.fillText(l, W / 2, y); });
  }
  return await new Promise(r => cv.toBlob(r, 'image/jpeg', .9));
}
Object.assign(ED, { srtText, thumbnail, coverRect, containRect });
})(window);

/*!
 * engine.js — BK쇼츠 렌더링 엔진 (Canvas 2D + WebCodecs)
 * 사진 슬라이드(켄 번스) · 장면 전환 · 한글 자막 애니메이션 · 파티클 · 테두리 · 박자 분석 · MP4 인코딩
 */
(function (g) {
  'use strict';

  // ═══════════════════════════════════════════════
  // 옵션 목록
  // ═══════════════════════════════════════════════
  const SYS_STACK = '"Apple SD Gothic Neo","Noto Sans KR","Noto Sans CJK KR","Malgun Gothic",sans-serif';
  const OPT = {
    transitions: [['crossfade', '크로스페이드'], ['fade_black', '블랙 페이드'], ['fade_white', '화이트 페이드'],
      ['zoom', '줌 디졸브'], ['push_up', '위로 밀기'], ['push_left', '왼쪽으로 밀기'], ['random', '랜덤 섞기']],
    motions: [['random', '랜덤 (추천)'], ['zoom_in', '줌 인'], ['zoom_out', '줌 아웃'], ['pan_h', '좌우로 흐르기'],
      ['pan_v', '위아래로 흐르기'], ['none', '움직임 없음']],
    fits: [['auto', '자동 (추천)'], ['cover', '화면 꽉 채우기'], ['blur', '사진 전체 + 흐린 배경']],
    filters: [['none', '없음'], ['warm', '따뜻한 감성'], ['vivid', '선명하게'], ['glow', '뽀샤시 글로우'],
      ['vintage', '빈티지'], ['bw', '흑백']],
    anims: [['lines', '한 줄씩 나타나기'], ['fade', '페이드 인/아웃'], ['typing', '타자기'], ['scroll', '아래→위 스크롤'],
      ['none', '효과 없음']],
    frames: [['none', '없음'], ['dot_mint', '도트 테두리 · 민트'], ['dot_pink', '도트 테두리 · 핑크'],
      ['dot_lavender', '도트 테두리 · 라벤더'], ['white', '화이트 테두리'], ['cinema', '시네마 바 (위·아래)'],
      ['custom', '내 PNG 프레임']],
    fonts: [
      { id: 'system', label: '휴대폰 기본 고딕', family: null, weight: 800 },
      { id: 'noto', label: '본고딕 굵게', family: 'Noto Sans KR', weight: 800, gf: 'Noto+Sans+KR:wght@800' },
      { id: 'nanumgothic', label: '나눔고딕 굵게', family: 'Nanum Gothic', weight: 800, gf: 'Nanum+Gothic:wght@800' },
      { id: 'blackhan', label: '검은고딕', family: 'Black Han Sans', weight: 400, gf: 'Black+Han+Sans' },
      { id: 'dohyeon', label: '배민 도현체', family: 'Do Hyeon', weight: 400, gf: 'Do+Hyeon' },
      { id: 'jua', label: '배민 주아체', family: 'Jua', weight: 400, gf: 'Jua' },
      { id: 'gowundodum', label: '고운돋움', family: 'Gowun Dodum', weight: 400, gf: 'Gowun+Dodum' },
      { id: 'gowunbatang', label: '고운바탕 (명조)', family: 'Gowun Batang', weight: 700, gf: 'Gowun+Batang:wght@700' },
      { id: 'nanummyeongjo', label: '나눔명조 굵게', family: 'Nanum Myeongjo', weight: 800, gf: 'Nanum+Myeongjo:wght@800' },
      { id: 'songmyung', label: '송명체', family: 'Song Myung', weight: 400, gf: 'Song+Myung' },
      { id: 'nanumpen', label: '나눔손글씨 펜', family: 'Nanum Pen Script', weight: 400, gf: 'Nanum+Pen+Script' },
      { id: 'nanumbrush', label: '나눔손글씨 붓', family: 'Nanum Brush Script', weight: 400, gf: 'Nanum+Brush+Script' },
      { id: 'gaegu', label: '개구쟁이체', family: 'Gaegu', weight: 700, gf: 'Gaegu:wght@700' },
      { id: 'gamja', label: '감자꽃체', family: 'Gamja Flower', weight: 400, gf: 'Gamja+Flower' },
      { id: 'himelody', label: '하이멜로디체', family: 'Hi Melody', weight: 400, gf: 'Hi+Melody' },
    ],
  };
  // 파티클: rise(떠오름) fall(떨어짐) twinkle(제자리 반짝) fall_twinkle drift(부유)
  const PARTICLES = {
    hearts: { label: '하트', motion: 'rise', count: 12, size: [40, 92], speed: [70, 150], sway: [15, 45], add: false, alpha: [0.75, 1], rot: false },
    stars: { label: '별 반짝', motion: 'twinkle', count: 14, size: [26, 66], period: [1.6, 3.2], add: true, alpha: [0.8, 1], rot: false },
    glints: { label: '반짝이', motion: 'fall_twinkle', count: 26, size: [18, 56], speed: [25, 70], sway: [5, 20], period: [0.7, 1.5], add: true, alpha: [0.8, 1], rot: false },
    snow: { label: '눈송이', motion: 'fall', count: 55, size: [8, 26], speed: [60, 150], sway: [10, 35], add: false, alpha: [0.6, 0.95], rot: false },
    petals: { label: '벚꽃잎', motion: 'fall', count: 18, size: [22, 46], speed: [70, 140], sway: [30, 80], add: false, alpha: [0.85, 1], rot: true },
    maple: { label: '단풍잎', motion: 'fall', count: 10, size: [44, 96], speed: [80, 160], sway: [30, 90], add: false, alpha: [0.9, 1], rot: true },
    bokeh: { label: '빛망울', motion: 'drift', count: 9, size: [70, 190], speed: [8, 25], sway: [10, 30], add: true, alpha: [0.35, 0.6], rot: false },
    custom: { label: '내 스티커', motion: 'fall', count: 8, size: [60, 130], speed: [60, 130], sway: [25, 70], add: false, alpha: [0.95, 1], rot: true },
  };

  // ═══════════════════════════════════════════════
  // 유틸
  // ═══════════════════════════════════════════════
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const ease = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function mkCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  }
  function freeCanvas(c) { if (c) { c.width = 0; c.height = 0; } } // iOS 메모리 즉시 반환
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const uni = (r, [a, b]) => a + (b - a) * r();
  function h01(a, b) { const v = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return v - Math.floor(v); }
  function hexRgb(h) { h = h.replace('#', ''); return [0, 2, 4].map(i => parseInt(h.substr(i, 2), 16)); }
  function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }
  function roundRectPath(x, ctx, l, t, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    x.beginPath();
    x.moveTo(l + r, t);
    x.arcTo(l + w, t, l + w, t + h, r);
    x.arcTo(l + w, t + h, l, t + h, r);
    x.arcTo(l, t + h, l, t, r);
    x.arcTo(l, t, l + w, t, r);
    x.closePath();
  }

  // ═══════════════════════════════════════════════
  // 글꼴 로딩 (구글 폰트는 필요한 글자만 내려받으므로 실제 자막 글자로 로드)
  // ═══════════════════════════════════════════════
  const fontLinks = new Map();
  let customFontDef = null;
  function setCustomFont(def) { customFontDef = def; }
  function fontDef(id) {
    if (id === 'custom' && customFontDef) return customFontDef;
    return OPT.fonts.find(f => f.id === id) || OPT.fonts[0];
  }
  function fontSpec(def, px) {
    const fam = def.family ? `"${def.family}", ${SYS_STACK}` : SYS_STACK;
    return `${def.weight} ${Math.round(px)}px ${fam}`;
  }
  function loadCss(href) {
    if (fontLinks.has(href)) return fontLinks.get(href);
    const p = new Promise(res => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = href;
      l.onload = () => res(true);
      l.onerror = () => res(false);
      document.head.appendChild(l);
      setTimeout(() => res(false), 8000);
    });
    fontLinks.set(href, p);
    return p;
  }
  async function ensureFont(def, text) {
    if (!def.family || !document.fonts) return;
    if (def.gf) await loadCss(`https://fonts.googleapis.com/css2?family=${def.gf}&display=swap`);
    const uniq = Array.from(new Set(Array.from(text || '가나다'))).join('') || '가';
    try {
      await Promise.race([document.fonts.load(fontSpec(def, 40), uniq), sleep(10000)]);
    } catch (e) { /* 오프라인 등 → 기본 글꼴로 */ }
  }

  // ═══════════════════════════════════════════════
  // 사진 → 세로 캔버스 (꽉 채우기 / 흐린 배경) + 색감 필터
  // ═══════════════════════════════════════════════
  async function loadImage(src) {
    const url = typeof src === 'string' ? src : URL.createObjectURL(src);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    try { await img.decode(); } catch (e) {
      await new Promise((res, rej) => { if (img.complete && img.naturalWidth) res(); img.onload = res; img.onerror = () => rej(new Error('이미지를 열 수 없습니다')); });
    }
    return { img, release() { if (typeof src !== 'string') URL.revokeObjectURL(url); img.src = ''; } };
  }

  function drawCover(x, img, iw, ih, W, H, cy = 0.5) {
    const s = Math.max(W / iw, H / ih);
    const dw = iw * s, dh = ih * s;
    x.drawImage(img, (W - dw) / 2, (H - dh) * cy, dw, dh);
  }
  function softBlurInto(src, W, H, factor) {
    // 축소 → 확대를 두 번 반복해 부드러운 블러 (사파리 canvas filter 미지원 대비)
    const a = mkCanvas(W / factor, H / factor);
    const ax = a.getContext('2d');
    ax.imageSmoothingQuality = 'high';
    ax.drawImage(src, 0, 0, a.width, a.height);
    const b = mkCanvas(W / (factor / 4), H / (factor / 4));
    const bx = b.getContext('2d');
    bx.imageSmoothingQuality = 'high';
    bx.drawImage(a, 0, 0, b.width, b.height);
    freeCanvas(a);
    return b;
  }

  function applyPixelFilter(x, W, H, name) {
    const id = x.getImageData(0, 0, W, H);
    const d = id.data;
    const n = d.length;
    if (name === 'warm') {
      for (let i = 0; i < n; i += 4) { d[i] = d[i] * 1.06 + 8; d[i + 1] = d[i + 1] * 1.02 + 3; d[i + 2] = d[i + 2] * 0.9; }
    } else if (name === 'vivid') {
      for (let i = 0; i < n; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        const l = 0.299 * r + 0.587 * gg + 0.114 * b;
        d[i] = ((l + (r - l) * 1.3) - 128) * 1.08 + 128;
        d[i + 1] = ((l + (gg - l) * 1.3) - 128) * 1.08 + 128;
        d[i + 2] = ((l + (b - l) * 1.3) - 128) * 1.08 + 128;
      }
    } else if (name === 'vintage') {
      for (let i = 0; i < n; i += 4) {
        const r = d[i], gg = d[i + 1], b = d[i + 2];
        const m = (r + gg + b) / 3;
        d[i] = (r * 0.65 + m * 0.35) * 0.88 + 22 + 12;
        d[i + 1] = (gg * 0.65 + m * 0.35) * 0.88 + 22;
        d[i + 2] = (b * 0.65 + m * 0.35) * 0.88 + 22 - 14;
      }
    } else if (name === 'bw') {
      for (let i = 0; i < n; i += 4) {
        const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2] - 128) * 1.12 + 128;
        d[i] = d[i + 1] = d[i + 2] = l;
      }
    }
    x.putImageData(id, 0, 0);
  }

  async function makeBase(photo, BW, BH, fit, filter) {
    const { img, release } = await loadImage(photo.file);
    try {
      const iw = img.naturalWidth, ih = img.naturalHeight;
      const c = mkCanvas(BW, BH);
      const x = c.getContext('2d', { alpha: false });
      x.imageSmoothingQuality = 'high';
      let mode = fit;
      if (fit === 'auto') mode = Math.abs((iw / ih) / (BW / BH) - 1) < 0.25 ? 'cover' : 'blur';
      if (mode === 'cover') {
        drawCover(x, img, iw, ih, BW, BH, 0.45);
      } else {
        const small = mkCanvas(BW / 16, BH / 16);
        const sx = small.getContext('2d');
        drawCover(sx, img, iw, ih, small.width, small.height);
        const mid = softBlurInto(small, BW, BH, 2);
        x.drawImage(mid, 0, 0, BW, BH);
        freeCanvas(small); freeCanvas(mid);
        x.fillStyle = 'rgba(0,0,0,0.38)';
        x.fillRect(0, 0, BW, BH);
        const s = Math.min(BW / iw, BH / ih);
        x.drawImage(img, (BW - iw * s) / 2, (BH - ih * s) / 2, iw * s, ih * s);
      }
      if (filter === 'glow') {
        const bl = softBlurInto(c, BW, BH, 40);
        x.globalCompositeOperation = 'screen';
        x.globalAlpha = 0.45;
        x.drawImage(bl, 0, 0, BW, BH);
        x.globalCompositeOperation = 'source-over';
        x.globalAlpha = 1;
        freeCanvas(bl);
      } else if (filter && filter !== 'none') {
        applyPixelFilter(x, c.width, c.height, filter);
      }
      return c;
    } finally {
      release();
    }
  }

  // ═══════════════════════════════════════════════
  // 동영상 장면: 매 프레임 영상 화면을 세로 캔버스에 맞춰 그림
  // ═══════════════════════════════════════════════
  const VFILTER = { warm: 'sepia(0.22) saturate(1.15) brightness(1.03)', vivid: 'saturate(1.3) contrast(1.08)',
    glow: 'brightness(1.08) saturate(1.1) contrast(0.95)', vintage: 'sepia(0.45) contrast(0.9) brightness(1.05)', bw: 'grayscale(1) contrast(1.12)' };
  class VideoPainter {
    constructor(BW, BH) {
      this.BW = BW; this.BH = BH;
      this.c = mkCanvas(BW, BH); this.x = this.c.getContext('2d', { alpha: false });
      this.x.imageSmoothingQuality = 'high';
      this.s1 = mkCanvas(BW / 16, BH / 16); this.s2 = mkCanvas(BW / 4, BH / 4);
      this.canFilter = typeof this.x.filter === 'string';
    }
    paint(v, fit, filter) {
      const x = this.x, BW = this.BW, BH = this.BH;
      const iw = v.videoWidth, ih = v.videoHeight;
      if (!iw || !ih || v.readyState < 2) return false;
      let mode = fit;
      if (fit === 'auto') mode = Math.abs((iw / ih) / (BW / BH) - 1) < 0.25 ? 'cover' : 'blur';
      const f = this.canFilter && VFILTER[filter] ? VFILTER[filter] : 'none';
      if (mode === 'cover') {
        if (this.canFilter) x.filter = f;
        drawCover(x, v, iw, ih, BW, BH, 0.45);
      } else {
        const a = this.s1.getContext('2d'), b = this.s2.getContext('2d');
        drawCover(a, v, iw, ih, this.s1.width, this.s1.height);
        b.imageSmoothingQuality = 'high';
        b.drawImage(this.s1, 0, 0, this.s2.width, this.s2.height);
        if (this.canFilter) x.filter = f;
        x.drawImage(this.s2, 0, 0, BW, BH);
        if (this.canFilter) x.filter = 'none';
        x.fillStyle = 'rgba(0,0,0,0.38)';
        x.fillRect(0, 0, BW, BH);
        if (this.canFilter) x.filter = f;
        const s = Math.min(BW / iw, BH / ih);
        x.drawImage(v, (BW - iw * s) / 2, (BH - ih * s) / 2, iw * s, ih * s);
      }
      if (this.canFilter) x.filter = 'none';
      return true;
    }
    free() { freeCanvas(this.c); freeCanvas(this.s1); freeCanvas(this.s2); }
  }

  // ═══════════════════════════════════════════════
  // 내 명함 (원형 얼굴 사진 + 명함) — 코드로 그려서 글자가 정확함
  // ═══════════════════════════════════════════════
  function fitFont(x, text, weight, px, maxW, fam) {
    let p = px;
    for (let i = 0; i < 30; i++) {
      x.font = `${weight} ${Math.round(p)}px ${fam}`;
      if (x.measureText(text).width <= maxW || p < 10) break;
      p *= 0.93;
    }
    return p;
  }
  function makeCard(info, W, face) {
    const fam = `"Noto Sans KR", ${SYS_STACK}`;
    const hasFace = !!face;
    const D = Math.round(W * 0.27);                       // 얼굴 원 지름
    const ch = Math.round(D * 0.84);                       // 명함 높이
    const cw = Math.round(hasFace ? W * 0.86 - D * 0.45 : W * 0.78);
    const totalW = hasFace ? Math.round(D * 0.45 + cw) : cw;
    const pad = Math.round(W * 0.03);
    const c = mkCanvas(totalW + pad * 2, D + pad * 2);
    const x = c.getContext('2d');
    const cardL = pad + (hasFace ? Math.round(D * 0.45) : 0), cardT = pad + Math.round((D - ch) / 2);
    // 명함 본체
    x.save();
    x.shadowColor = 'rgba(0,0,0,0.35)'; x.shadowBlur = W * 0.02; x.shadowOffsetY = W * 0.006;
    roundRectPath(x, x, cardL, cardT, cw, ch, W * 0.028);
    const gr = x.createLinearGradient(0, cardT, 0, cardT + ch);
    gr.addColorStop(0, '#fffdf6'); gr.addColorStop(1, '#f6eedb');
    x.fillStyle = gr; x.fill();
    x.restore();
    roundRectPath(x, x, cardL + W * 0.008, cardT + W * 0.008, cw - W * 0.016, ch - W * 0.016, W * 0.022);
    x.strokeStyle = '#c9a24a'; x.lineWidth = Math.max(1, W * 0.0035); x.stroke();
    // 글자
    const tx = cardL + (hasFace ? D * 0.62 : W * 0.05), maxW = cardL + cw - tx - W * 0.04;
    const lines = [];
    const top = [info.company, info.branch].filter(Boolean).join(' ');
    if (top) lines.push({ t: top, w: 700, px: W * 0.033, col: '#9a7425' });
    const nm = [info.role, info.name].filter(Boolean);
    if (nm.length) lines.push({ t: nm.join('  '), w: 800, px: W * 0.056, col: '#2a2140', name: true });
    if (info.phone) lines.push({ t: info.phone, w: 700, px: W * 0.04, col: '#3b3355' });
    if (info.msg) lines.push({ t: info.msg, w: 500, px: W * 0.03, col: '#6e6488' });
    lines.forEach(l => { l.px = fitFont(x, l.t, l.w, l.px, maxW, fam); });
    const gap = W * 0.012;
    const totH = lines.reduce((a, l) => a + l.px * 1.12, 0) + gap * Math.max(0, lines.length - 1);
    let y = cardT + (ch - totH) / 2;
    x.textBaseline = 'top';
    for (const l of lines) {
      x.font = `${l.w} ${Math.round(l.px)}px ${fam}`;
      x.fillStyle = l.col;
      if (l.name && nm.length === 2) {
        // 직함은 작게, 이름은 크게
        const rp = l.px * 0.62;
        x.font = `700 ${Math.round(rp)}px ${fam}`;
        const rw = x.measureText(info.role + ' ').width;
        x.fillStyle = '#6e6488';
        x.fillText(info.role, tx, y + (l.px - rp) * 0.8);
        x.font = `${l.w} ${Math.round(l.px)}px ${fam}`;
        x.fillStyle = l.col;
        x.fillText(info.name, tx + rw, y);
      } else x.fillText(l.t, tx, y);
      y += l.px * 1.12 + gap;
    }
    // 원형 얼굴
    if (hasFace) {
      const cx = pad + D / 2, cy = pad + D / 2, R = D / 2;
      x.save();
      x.shadowColor = 'rgba(0,0,0,0.4)'; x.shadowBlur = W * 0.02;
      x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.fillStyle = '#c9a24a'; x.fill();
      x.restore();
      x.beginPath(); x.arc(cx, cy, R - W * 0.006, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
      x.save();
      x.beginPath(); x.arc(cx, cy, R - W * 0.013, 0, Math.PI * 2); x.clip();
      const iw = face.naturalWidth || face.width, ih = face.naturalHeight || face.height;
      const r2 = (R - W * 0.013) * 2, sc = Math.max(r2 / iw, r2 / ih);
      x.drawImage(face, cx - iw * sc / 2, cy - ih * sc * 0.42, iw * sc, ih * sc);
      x.restore();
    }
    return c;
  }

  class BaseCache {
    constructor(limit) { this.limit = limit; this.map = new Map(); this.pending = new Map(); }
    key(photo, BW, BH, fit, filter) { return `${photo.id}|${BW}x${BH}|${fit}|${filter}`; }
    peek(k) {
      const c = this.map.get(k);
      if (c) { this.map.delete(k); this.map.set(k, c); }
      return c || null;
    }
    async get(photo, BW, BH, fit, filter) {
      const k = this.key(photo, BW, BH, fit, filter);
      const c = this.peek(k);
      if (c) return c;
      if (this.pending.has(k)) return this.pending.get(k);
      const p = makeBase(photo, BW, BH, fit, filter).then(cv => {
        this.pending.delete(k);
        this.map.set(k, cv);
        while (this.map.size > this.limit) {
          const first = this.map.keys().next().value;
          freeCanvas(this.map.get(first));
          this.map.delete(first);
        }
        return cv;
      }, e => { this.pending.delete(k); throw e; });
      this.pending.set(k, p);
      return p;
    }
    clear() { for (const c of this.map.values()) freeCanvas(c); this.map.clear(); }
  }

  // ═══════════════════════════════════════════════
  // 자막 렌더링
  // ═══════════════════════════════════════════════
  const measureCtx = mkCanvas(8, 8).getContext('2d');

  function wrapText(text, font, maxW, sw) {
    measureCtx.font = font;
    const w = s => measureCtx.measureText(s).width + sw * 2;
    const out = [];
    for (let para of text.replace(/\r/g, '').split('\n')) {
      para = para.replace(/\s+$/, '');
      if (!para.trim()) { out.push(''); continue; }
      let cur = '';
      for (const word of para.split(' ')) {
        const cand = cur ? cur + ' ' + word : word;
        if (w(cand) <= maxW) { cur = cand; continue; }
        if (cur) { out.push(cur); cur = ''; }
        if (w(word) <= maxW) cur = word;
        else {
          for (const ch of Array.from(word)) {
            if (w(cur + ch) <= maxW) cur += ch; else { out.push(cur); cur = ch; }
          }
        }
      }
      out.push(cur);
    }
    while (out.length && !out[0].trim()) out.shift();
    while (out.length && !out[out.length - 1].trim()) out.pop();
    return out;
  }

  function renderLine(line, st, s, font, px) {
    measureCtx.font = font;
    const m = measureCtx.measureText(line);
    const asc = m.fontBoundingBoxAscent || px * 0.92;
    const desc = m.fontBoundingBoxDescent || px * 0.26;
    const lh = asc + desc;
    const tw = Math.max(1, m.width);
    const sw = Math.max(0, Math.round(st.strokeW * s));
    const shOff = st.shadow ? Math.round(5 * s) : 0;
    const shBlur = st.shadow ? Math.round(8 * s) : 0;
    const bx = Math.round(24 * s), by = Math.round(8 * s);
    const pad = sw + shOff + shBlur * 2 + (st.box ? bx : 0) + 4;
    const c = mkCanvas(tw + pad * 2, lh + pad * 2);
    const x = c.getContext('2d');
    x.font = font;
    x.textBaseline = 'alphabetic';
    x.lineJoin = 'round';
    x.miterLimit = 2;
    const ox = pad, oy = pad + asc;
    if (st.box) {
      x.fillStyle = rgba(hexRgb(st.boxColor), st.boxOp);
      roundRectPath(x, x, pad - bx, pad - by, tw + bx * 2, lh + by * 2, Math.round(16 * s));
      x.fill();
    }
    if (st.shadow) {
      x.save();
      x.shadowColor = 'rgba(0,0,0,0.8)';
      x.shadowBlur = shBlur;
      x.shadowOffsetX = shOff;
      x.shadowOffsetY = shOff;
      x.fillStyle = sw > 0 ? st.stroke : '#000';
      x.strokeStyle = sw > 0 ? st.stroke : '#000';
      if (sw > 0) { x.lineWidth = sw * 2; x.strokeText(line, ox, oy); } else x.fillText(line, ox, oy);
      x.restore();
    }
    if (sw > 0) {
      x.lineWidth = sw * 2;
      x.strokeStyle = st.stroke;
      x.strokeText(line, ox, oy);
    }
    x.fillStyle = st.color;
    x.fillText(line, ox, oy);
    return { canvas: c, pad };
  }

  function layoutText(text, st, W, H, s, yPos, sizeMul = 1) {
    const def = fontDef(st.font);
    const px = st.size * s * sizeMul;
    const font = fontSpec(def, px);
    const sw = Math.round(st.strokeW * s);
    const maxW = W * 0.86;
    const lines = wrapText(text, font, maxW, sw);
    measureCtx.font = font;
    const m = measureCtx.measureText('가');
    const asc = m.fontBoundingBoxAscent || px * 0.92, desc = m.fontBoundingBoxDescent || px * 0.26;
    const lh = (asc + desc) * st.lineSp;
    const hs = lines.map(l => (l.trim() ? lh : lh * 0.55));
    const blockH = hs.reduce((a, b) => a + b, 0) - (lines.length ? lh - (asc + desc) : 0);
    let top = H * (yPos == null ? st.yPos / 100 : yPos) - blockH / 2;
    top = clamp(top, H * 0.04, H * 0.96 - blockH);
    const out = [];
    let y = top;
    lines.forEach((l, i) => {
      if (l.trim()) {
        const r = renderLine(l, st, s, font, px);
        const xx = st.align === 'center' ? (W - r.canvas.width) / 2 : W * 0.07 - r.pad;
        out.push({ text: l, canvas: r.canvas, x: Math.round(xx), y: Math.round(y - r.pad) });
      }
      y += hs[i];
    });
    return { lines: out, top, height: blockH, font, px };
  }

  // ═══════════════════════════════════════════════
  // 파티클 스프라이트
  // ═══════════════════════════════════════════════
  const spriteCache = new Map();
  function spr(size, fn) {
    const c = mkCanvas(size, size);
    fn(c.getContext('2d'), size);
    return c;
  }
  function polyPath(x, pts, S) {
    x.beginPath();
    pts.forEach(([px, py], i) => (i ? x.lineTo(px * S, py * S) : x.moveTo(px * S, py * S)));
    x.closePath();
  }
  const HEART = (() => {
    const pts = [];
    let xs = [], ys = [];
    for (let i = 0; i < 160; i++) {
      const t = i / 160 * Math.PI * 2;
      xs.push(16 * Math.sin(t) ** 3);
      ys.push(-(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)));
    }
    const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
    for (let i = 0; i < xs.length; i++) pts.push([0.2 + 0.6 * (xs[i] - mnx) / (mxx - mnx), 0.2 + 0.6 * (ys[i] - mny) / (mxy - mny)]);
    return pts;
  })();
  const MAPLE_R = [[50, 4], [55, 17], [61, 13], [60, 28], [70, 21], [73, 27], [84, 19], [80, 35], [95, 37], [86, 45],
    [92, 53], [74, 57], [76, 65], [60, 61], [54, 70], [53, 88], [51.5, 97]];
  const MAPLE = MAPLE_R.concat(MAPLE_R.slice().reverse().map(([a, b]) => [100 - a, b])).map(([a, b]) => [a / 100 * 0.84 + 0.08, b / 100 * 0.84 + 0.08]);

  function makeSprites(key, size, stickers) {
    const ck = key + size;
    if (key !== 'custom' && spriteCache.has(ck)) return spriteCache.get(ck);
    let out = [];
    if (key === 'hearts') {
      out = [[255, 92, 150], [240, 40, 70], [255, 160, 200], [255, 120, 120]].map(c => spr(size, (x, S) => {
        x.shadowColor = rgba(c, 0.8); x.shadowBlur = S * 0.08;
        polyPath(x, HEART, S); x.fillStyle = rgba(c, 1); x.fill();
        x.shadowBlur = 0;
        const gr = x.createRadialGradient(S * 0.36, S * 0.33, 0, S * 0.36, S * 0.33, S * 0.1);
        gr.addColorStop(0, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
      }));
    } else if (key === 'stars') {
      const pts = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.15 : 0.36, a = -Math.PI / 2 + i * Math.PI / 5; pts.push([0.5 + r * Math.cos(a), 0.52 + r * Math.sin(a)]); }
      out = [[255, 222, 110], [255, 255, 255], [255, 200, 120]].map(c => spr(size, (x, S) => {
        x.shadowColor = rgba(c, 1); x.shadowBlur = S * 0.14; polyPath(x, pts, S); x.fillStyle = rgba(c, 1); x.fill(); x.fill();
      }));
    } else if (key === 'glints') {
      const w = 0.035;
      const pts = [[0.5, 0.06], [0.5 + w, 0.5 - w], [0.94, 0.5], [0.5 + w, 0.5 + w], [0.5, 0.94], [0.5 - w, 0.5 + w], [0.06, 0.5], [0.5 - w, 0.5 - w]];
      out = [[255, 240, 200], [210, 230, 255], [255, 210, 240]].map(c => spr(size, (x, S) => {
        x.shadowColor = rgba(c, 1); x.shadowBlur = S * 0.1; polyPath(x, pts, S); x.fillStyle = '#fff'; x.fill(); x.fill();
        x.shadowBlur = 0;
        const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * 0.28);
        gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
      }));
    } else if (key === 'snow') {
      out = [spr(size, (x, S) => {
        const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
      })];
    } else if (key === 'bokeh') {
      out = [[255, 236, 190], [255, 200, 220], [200, 225, 255], [255, 255, 255]].map(c => spr(size, (x, S) => {
        const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
        gr.addColorStop(0, rgba(c, 0.38)); gr.addColorStop(0.78, rgba(c, 0.42)); gr.addColorStop(0.88, rgba(c, 0.7)); gr.addColorStop(0.97, rgba(c, 0));
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
      }));
    } else if (key === 'petals') {
      out = [[255, 183, 197], [255, 205, 215], [250, 160, 185]].map(c => spr(size, (x, S) => {
        x.fillStyle = rgba(c, 1);
        x.beginPath(); x.ellipse(S / 2, S / 2, S * 0.22, S * 0.36, 0, 0, Math.PI * 2); x.fill();
        x.globalCompositeOperation = 'destination-out';
        polyPath(x, [[0.43, 0.1], [0.5, 0.24], [0.57, 0.1]], S); x.fill();
        x.globalCompositeOperation = 'source-atop';
        const gr = x.createRadialGradient(S / 2, S * 0.62, 0, S / 2, S * 0.62, S * 0.2);
        gr.addColorStop(0, 'rgba(255,245,248,0.6)'); gr.addColorStop(1, 'rgba(255,245,248,0)');
        x.fillStyle = gr; x.fillRect(0, 0, S, S);
      }));
    } else if (key === 'maple') {
      out = [[235, 105, 25], [205, 35, 30], [245, 175, 30], [225, 70, 20]].map(c => spr(size, (x, S) => {
        polyPath(x, MAPLE, S); x.fillStyle = rgba(c, 1); x.fill();
        x.globalCompositeOperation = 'source-atop';
        x.strokeStyle = rgba(c.map(v => v * 0.7 | 0), 0.8); x.lineWidth = Math.max(1, S / 45);
        for (const [tx, ty] of [[50, 12], [84, 26], [16, 26], [86, 50], [14, 50], [50, 92]]) {
          x.beginPath(); x.moveTo(S * 0.5, S * 0.6); x.lineTo(S * (tx / 100 * 0.84 + 0.08), S * (ty / 100 * 0.84 + 0.08)); x.stroke();
        }
      }));
    } else if (key === 'custom') {
      out = (stickers || []).map(img => spr(size, (x, S) => {
        const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
        const sc = (S * 0.8) / Math.max(iw, ih);
        x.drawImage(img, (S - iw * sc) / 2, (S - ih * sc) / 2, iw * sc, ih * sc);
      }));
      return out;
    }
    spriteCache.set(ck, out);
    return out;
  }

  class Particles {
    constructor(keys, density, W, H, s, stickers) {
      this.W = W; this.H = H;
      const r = rng(7);
      this.items = [];
      for (const key of keys) {
        const cfg = PARTICLES[key];
        if (!cfg) continue;
        const bank = makeSprites(key, Math.round(cfg.size[1] * s) + 2, stickers);
        if (!bank.length) continue;
        const n = Math.max(1, Math.round(cfg.count * density));
        for (let i = 0; i < n; i++) {
          this.items.push({
            spr: bank[i % bank.length], sz: uni(r, cfg.size) * s, motion: cfg.motion, add: cfg.add, rot: cfg.rot,
            id: this.items.length + 1, x0: r() * W, y0: r() * H * 1.5,
            v: uni(r, cfg.speed || [0, 0]) * s, amp: uni(r, cfg.sway || [0, 0]) * s,
            f: 0.15 + r() * 0.3, ph: r() * Math.PI * 2, per: uni(r, cfg.period || [2, 3]),
            alpha: uni(r, cfg.alpha), a0: r() * 360, w: -70 + r() * 140, fw: 0.6 + r() * 1.2,
          });
        }
      }
    }
    draw(x, t) {
      const { W, H } = this;
      for (const p of this.items) {
        const sz = p.sz, m = sz, travel = H + 2 * m;
        let a = p.alpha, px, py;
        if (p.motion === 'fall' || p.motion === 'fall_twinkle') {
          py = ((p.y0 + p.v * t) % travel) - m;
          px = p.x0 + p.amp * Math.sin(2 * Math.PI * p.f * t + p.ph);
          if (p.motion === 'fall_twinkle') { const s = Math.sin(Math.PI * ((t / p.per + p.ph) % 1)); a *= 0.25 + 0.75 * s * s; }
        } else if (p.motion === 'rise') {
          py = H + m - ((p.y0 + p.v * t) % travel);
          px = p.x0 + p.amp * Math.sin(2 * Math.PI * p.f * t + p.ph);
          a *= clamp(py / (H * 0.35), 0, 1) * clamp((H + m - py) / (H * 0.08), 0, 1);
        } else if (p.motion === 'twinkle') {
          const ph = t / p.per + p.ph, cyc = Math.floor(ph), s = Math.sin(Math.PI * (ph - cyc));
          a *= s * s;
          px = h01(p.id, cyc) * W;
          py = h01(p.id + 0.37, cyc + 11) * H;
        } else {
          py = H + m - ((p.y0 + p.v * t) % travel);
          px = p.x0 + p.amp * Math.sin(2 * Math.PI * p.f * 0.5 * t + p.ph);
          a *= 0.65 + 0.35 * Math.sin(2 * Math.PI * 0.25 * t + p.ph);
        }
        if (a <= 0.01) continue;
        x.globalAlpha = Math.min(1, a);
        x.globalCompositeOperation = p.add ? 'lighter' : 'source-over';
        if (p.rot) {
          const ang = (p.a0 + p.w * t) * Math.PI / 180;
          const sx = 0.3 + 0.7 * Math.abs(Math.cos(p.fw * t + p.ph));
          x.setTransform(1, 0, 0, 1, px, py);
          x.rotate(ang);
          x.scale(sx, 1);
          x.drawImage(p.spr, -sz / 2, -sz / 2, sz, sz);
          x.setTransform(1, 0, 0, 1, 0, 0);
        } else {
          x.drawImage(p.spr, px - sz / 2, py - sz / 2, sz, sz);
        }
      }
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
    }
  }

  // ═══════════════════════════════════════════════
  // 테두리 프레임 · 비네트
  // ═══════════════════════════════════════════════
  function makeFrame(kind, W, H, s, png) {
    if (kind === 'none') return null;
    const c = mkCanvas(W, H);
    const x = c.getContext('2d');
    if (kind === 'custom') {
      if (!png) return null;
      x.drawImage(png, 0, 0, W, H);
      return c;
    }
    if (kind.startsWith('dot_')) {
      const col = { dot_mint: '#6ecdc4', dot_pink: '#f7a0be', dot_lavender: '#baa5e6' }[kind];
      x.fillStyle = col; x.fillRect(0, 0, W, H);
      const sp = W * 0.075, r = sp * 0.36;
      x.fillStyle = '#fff';
      let row = 0;
      for (let yy = -sp; yy < H + sp; yy += sp, row++) {
        for (let xx = -sp + (row % 2 ? sp / 2 : 0); xx < W + sp; xx += sp) { x.beginPath(); x.arc(xx, yy, r, 0, Math.PI * 2); x.fill(); }
      }
      const side = W * 0.06, topb = W * 0.09;
      x.globalCompositeOperation = 'destination-out';
      roundRectPath(x, x, side, topb, W - side * 2, H - topb * 2, 36 * s);
      x.fill();
    } else if (kind === 'white') {
      x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      const b = W * 0.035;
      x.globalCompositeOperation = 'destination-out';
      roundRectPath(x, x, b, b, W - b * 2, H - b * 2, 28 * s);
      x.fill();
    } else if (kind === 'cinema') {
      const bar = H * 0.085;
      x.fillStyle = '#000'; x.fillRect(0, 0, W, bar); x.fillRect(0, H - bar, W, bar);
    }
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  function makeVignette(W, H, strength) {
    if (!(strength > 0)) return null;
    const c = mkCanvas(W, H);
    const x = c.getContext('2d');
    x.translate(W / 2, H / 2);
    x.scale(1, H / W);
    const R = (W / 2) * Math.SQRT2;
    const gr = x.createRadialGradient(0, 0, 0, 0, 0, R);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(0.5, 'rgba(0,0,0,0)');
    gr.addColorStop(1, `rgba(0,0,0,${strength})`);
    x.fillStyle = gr;
    x.fillRect(-W, -W * 2, W * 2, W * 4);
    return c;
  }

  // ═══════════════════════════════════════════════
  // 타임라인
  // ═══════════════════════════════════════════════
  function parseTs(s) { return s.trim().replace(',', '.').split(':').reduce((v, p) => v * 60 + parseFloat(p), 0); }
  function parseSrt(text) {
    const segs = [];
    for (const block of text.replace(/\r/g, '').trim().split(/\n\s*\n/)) {
      const lines = block.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^\s*([\d:.,]+)\s*-->\s*([\d:.,]+)/);
        if (m) {
          const body = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').trim();
          if (body) segs.push({ start: parseTs(m[1]), end: parseTs(m[2]), text: body });
          break;
        }
      }
    }
    return segs.sort((a, b) => a.start - b.start);
  }
  function splitBlocks(text) {
    return text.replace(/\r/g, '').trim().split(/\n\s*\n/).map(b => b.replace(/^\n+|\n+$/g, '')).filter(b => b.trim());
  }

  function planScenes({ nImages, perDur, musicMode, musicDur, minScenes = 0, minTotal = 0, maxTotal = 0, beats = null }) {
    let n = Math.max(nImages, minScenes, 1);
    let total, per;
    if (musicMode && musicDur) {
      total = musicDur;
      if (maxTotal > 0) total = Math.min(total, maxTotal);
      total = Math.max(total, minTotal);
      per = total / n;
      if (per > perDur * 1.6) { n = Math.max(n, Math.round(total / perDur)); per = total / n; }
      if (per < 1.2) { per = 1.2; total = n * per; }
    } else {
      total = Math.max(n * perDur, minTotal);
      if (maxTotal > 0) total = Math.min(total, maxTotal);
      n = Math.max(1, Math.ceil(total / perDur - 1e-6));
      per = total / n;
    }
    let cuts = [];
    for (let k = 1; k < n; k++) cuts.push(k * per);
    if (beats && beats.length > 4) {
      const out = [];
      let prev = 0;
      const minGap = Math.min(1.0, per * 0.5);
      for (const c of cuts) {
        let best = null, bd = Infinity;
        for (const b of beats) {
          if (b <= prev + minGap || b >= total - minGap) continue;
          const d = Math.abs(b - c);
          if (d < bd) { bd = d; best = b; }
        }
        let c2 = best != null && bd < per * 0.5 ? best : c;
        if (c2 <= prev + minGap * 0.5) c2 = c;
        out.push(c2);
        prev = c2;
      }
      cuts = out;
    }
    const bounds = [0, ...cuts, total];
    const scenes = [];
    for (let k = 0; k < n; k++) scenes.push({ img: k % nImages, start: bounds[k], end: bounds[k + 1], text: '' });
    return { scenes, total };
  }

  function subsFromScenes(scenes, trans, total) {
    const out = [];
    scenes.forEach((sc, k) => {
      if (!sc.text || !sc.text.trim()) return;
      let s = sc.start + (k > 0 ? trans / 2 : 0) + 0.15;
      let e = sc.end - (k < scenes.length - 1 ? trans / 2 : 0) - 0.1;
      if (k === scenes.length - 1) e = Math.min(e, total - 0.3);
      if (e - s < 0.8) { s = sc.start; e = Math.max(sc.end, sc.start + 0.8); }
      out.push({ start: s, end: e, text: sc.text });
    });
    return out;
  }

  // ═══════════════════════════════════════════════
  // 렌더러
  // ═══════════════════════════════════════════════
  const MOTION_CYCLE = ['zoom_in', 'pan_right', 'zoom_out', 'pan_up', 'zoom_in', 'pan_left', 'zoom_out', 'pan_down'];
  const TRANS_CYCLE = ['crossfade', 'zoom', 'fade_white', 'push_up', 'crossfade', 'push_left', 'fade_black'];

  class Renderer {
    /** @param pj 프로젝트  @param W,H 출력 크기  @param cache BaseCache */
    constructor(pj, W, H, cache) {
      this.pj = pj; this.W = W; this.H = H; this.s = W / 1080; this.cache = cache;
      this.zb = 1 + Math.max(0, pj.strength) + 0.02;
      this.BW = Math.round(W * this.zb); this.BH = Math.round(H * this.zb);
      const sc = pj.scenes;
      this.bounds = sc.map(x => x.start).concat([pj.total]);
      const minLen = Math.min(...sc.map(x => x.end - x.start));
      this.T = pj.transDur >= 1 / 60 ? Math.min(pj.transDur, 0.45 * minLen) : 0;
      this.vkey = pj.exporting ? 'xel' : 'el';
      this.vp = new Map();
      this.card = null;
      this.motions = sc.map((_, k) => {
        const m = pj.motion;
        if (this.isVid(k)) return 'none';
        if (m === 'random') return MOTION_CYCLE[k % MOTION_CYCLE.length];
        if (m === 'pan_h') return k % 2 ? 'pan_left' : 'pan_right';
        if (m === 'pan_v') return k % 2 ? 'pan_down' : 'pan_up';
        return m;
      });
      const r = rng(11);
      this.trans = sc.map(() => (pj.transition === 'random' ? TRANS_CYCLE[Math.floor(r() * TRANS_CYCLE.length)] : pj.transition));
      this.layouts = new Map();
      this.typing = new Map();
      this.fixed = [];
      this.particles = pj.particles.length ? new Particles(pj.particles, pj.density, W, H, this.s, pj.stickers) : null;
      this.frame = makeFrame(pj.frame, W, H, this.s, pj.frameImg);
      this.vig = makeVignette(W, H, pj.vignette);
      this.ov = pj.overlayVideo || null;
    }

    async init() {
      const st = this.pj.style;
      const texts = this.pj.subs.map(x => x.text).concat([this.pj.topText, this.pj.bottomText]).join('');
      await ensureFont(fontDef(st.font), texts);
      if (this.pj.topText.trim()) this.fixed.push(layoutText(this.pj.topText, st, this.W, this.H, this.s, 0.10, 0.62));
      if (this.pj.bottomText.trim()) this.fixed.push(layoutText(this.pj.bottomText, st, this.W, this.H, this.s, 0.865, 0.58));
      const cd = this.pj.card;
      if (cd && cd.mode !== 'none' && (cd.info.name || cd.info.company || cd.info.phone)) {
        const i = cd.info;
        await ensureFont({ family: 'Noto Sans KR', weight: 800, gf: 'Noto+Sans+KR:wght@500;700;800' }, Object.values(i).join('') + '0123456789-');
        this.card = makeCard(i, this.W, cd.face || null);
      }
    }

    destroy() {
      for (const L of this.layouts.values()) L.lines.forEach(l => freeCanvas(l.canvas));
      for (const L of this.fixed) L.lines.forEach(l => freeCanvas(l.canvas));
      for (const c of this.typing.values()) freeCanvas(c);
      for (const v of this.vp.values()) v.free();
      freeCanvas(this.frame); freeCanvas(this.vig); freeCanvas(this.card);
    }

    item(k) { return this.pj.photos[this.pj.scenes[k].img]; }
    isVid(k) { const it = this.item(k); return !!(it && it.kind === 'video'); }
    vidEl(k) { return this.item(k)[this.vkey]; }
    /** 장면 k 에서 시각 t 일 때 영상 안의 재생 위치 */
    vidTime(k, t) {
      const sc = this.pj.scenes[k], it = this.item(k);
      const cs = sc.clipStart || 0, len = sc.end - sc.start;
      return clamp(cs + (t - sc.start), cs, Math.max(cs, Math.min(cs + len, (it.dur || len) ) - 0.05));
    }
    /** 미리보기 재생 중: 보이는 영상만 재생, 나머지는 멈춤 */
    syncPlay(t, playing) {
      const act = new Map();
      if (playing) for (const k of this.scenesAt(t)) if (this.isVid(k)) act.set(this.vidEl(k), this.vidTime(k, t));
      for (const it of this.pj.photos) {
        if (it.kind !== 'video') continue;
        const v = it[this.vkey];
        if (act.has(v)) {
          const want = act.get(v);
          if (Math.abs(v.currentTime - want) > 0.35) v.currentTime = want;
          if (v.paused) v.play().catch(() => {});
        } else if (!v.paused) v.pause();
      }
    }

    sceneIndex(t) {
      const b = this.bounds, n = this.pj.scenes.length;
      let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (b[mid] <= t) lo = mid; else hi = mid - 1; }
      return lo;
    }
    scenesAt(t) {
      const k = this.sceneIndex(t), n = this.pj.scenes.length, T = this.T, b = this.bounds;
      const ks = [k];
      if (T > 0 && k < n - 1 && t > b[k + 1] - T / 2) ks.push(k + 1);
      if (T > 0 && k > 0 && t < b[k] + T / 2) ks.push(k - 1);
      return ks;
    }
    baseFor(k) {
      const p = this.item(k);
      if (p.kind === 'video') {
        let vp = this.vp.get(k);
        if (!vp) {
          if (this.vp.size >= 3) { const [k0, v0] = this.vp.entries().next().value; v0.free(); this.vp.delete(k0); }
          vp = new VideoPainter(this.BW, this.BH); this.vp.set(k, vp);
        }
        if (vp.paint(p[this.vkey], this.pj.fit, this.pj.filter)) vp.ok = true;
        return vp.ok ? vp.c : null;
      }
      return this.cache.peek(this.cache.key(p, this.BW, this.BH, this.pj.fit, this.pj.filter));
    }
    loadScene(k) {
      const p = this.item(k);
      if (p.kind === 'video') return Promise.resolve(null);
      return this.cache.get(p, this.BW, this.BH, this.pj.fit, this.pj.filter);
    }
    async ensureFor(t) {
      const ks = this.scenesAt(t);
      for (const k of ks) {
        if (this.isVid(k)) { const v = this.vidEl(k); if (!v.paused) v.pause(); await seekVideo(v, this.vidTime(k, t)); }
        else await this.loadScene(k);
      }
      const nxt = this.sceneIndex(t) + 1;
      if (nxt < this.pj.scenes.length) this.loadScene(nxt).catch(() => {});
      if (this.ov && this.ov.duration) await seekVideo(this.ov, t % this.ov.duration);
    }

    drawScene(x, k, t, extraZoom = 1, offX = 0, offY = 0) {
      const B = this.baseFor(k);
      if (!B) return false;
      const sc = this.pj.scenes, T = this.T;
      const s0 = sc[k].start - (k > 0 ? T / 2 : 0), e0 = sc[k].end + (k < sc.length - 1 ? T / 2 : 0);
      const u = clamp((t - s0) / Math.max(e0 - s0, 1e-6), 0, 1);
      const st = this.pj.strength, m = this.motions[k];
      let z = 1, dx = 0, dy = 0;
      if (m === 'zoom_in') z = 1 + st * u;
      else if (m === 'zoom_out') z = 1 + st * (1 - u);
      else if (m.startsWith('pan_')) {
        z = 1 + st;
        const d = (2 * u - 1) * 0.9;
        if (m === 'pan_right') dx = d; else if (m === 'pan_left') dx = -d; else if (m === 'pan_up') dy = -d; else dy = d;
      }
      z *= extraZoom;
      const zr = z / this.zb, cwb = this.W / zr, chb = this.H / zr;
      const cx = this.BW / 2 + dx * Math.max(0, (this.BW - cwb) / 2);
      const cy = this.BH / 2 + dy * Math.max(0, (this.BH - chb) / 2);
      x.setTransform(zr, 0, 0, zr, this.W / 2 - zr * cx + offX, this.H / 2 - zr * cy + offY);
      x.drawImage(B, 0, 0);
      x.setTransform(1, 0, 0, 1, 0, 0);
      return true;
    }

    compose(x, t) {
      const W = this.W, H = this.H, b = this.bounds, n = this.pj.scenes.length, T = this.T;
      x.globalAlpha = 1;
      x.globalCompositeOperation = 'source-over';
      x.fillStyle = '#000';
      x.fillRect(0, 0, W, H);
      const k = this.sceneIndex(t);
      let A = -1, Bk = -1, p = 0;
      if (T > 0 && k < n - 1 && t > b[k + 1] - T / 2) { A = k; Bk = k + 1; p = (t - (b[k + 1] - T / 2)) / T; }
      else if (T > 0 && k > 0 && t < b[k] + T / 2) { A = k - 1; Bk = k; p = (t - (b[k] - T / 2)) / T; }
      if (A < 0) { this.drawScene(x, k, t); return; }
      p = ease(p);
      const tr = this.trans[A];
      const clipDraw = (kk, l, tp, w, h, ox, oy) => {
        x.save(); x.beginPath(); x.rect(l, tp, w, h); x.clip(); this.drawScene(x, kk, t, 1, ox, oy); x.restore();
      };
      if (tr === 'fade_black') {
        x.globalAlpha = p < 0.5 ? 1 - 2 * p : 2 * p - 1;
        this.drawScene(x, p < 0.5 ? A : Bk, t);
      } else if (tr === 'fade_white') {
        this.drawScene(x, p < 0.5 ? A : Bk, t);
        x.globalAlpha = p < 0.5 ? 2 * p : 2 - 2 * p;
        x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
      } else if (tr === 'push_up') {
        const off = H * p;
        clipDraw(A, 0, 0, W, H - off, 0, -off);
        clipDraw(Bk, 0, H - off, W, off, 0, H - off);
      } else if (tr === 'push_left') {
        const off = W * p;
        clipDraw(A, 0, 0, W - off, H, -off, 0);
        clipDraw(Bk, W - off, 0, off, H, W - off, 0);
      } else {
        this.drawScene(x, A, t, tr === 'zoom' ? 1 + 0.25 * p : 1);
        x.globalAlpha = p;
        this.drawScene(x, Bk, t);
      }
      x.globalAlpha = 1;
    }

    layout(i) {
      if (!this.layouts.has(i)) this.layouts.set(i, layoutText(this.pj.subs[i].text, this.pj.style, this.W, this.H, this.s));
      return this.layouts.get(i);
    }

    drawSub(x, i, t) {
      const seg = this.pj.subs[i], st = this.pj.style, L = this.layout(i), s = this.s;
      if (!L.lines.length) return;
      const tau = t - seg.start, D = seg.end - seg.start;
      const fout = clamp((D - tau) / 0.4, 0, 1);
      const put = (c, xx, yy, a) => { if (a > 0.003) { x.globalAlpha = Math.min(1, a); x.drawImage(c, xx, yy); } };
      if (st.anim === 'lines') {
        const n = L.lines.length, step = Math.min(0.75, Math.max(0.22, D * 0.5 / n));
        L.lines.forEach((l, j) => { const a = ease((tau - j * step) / 0.5); put(l.canvas, l.x, l.y + (1 - a) * 24 * s, a * fout); });
      } else if (st.anim === 'fade') {
        const a = ease(tau / 0.6);
        L.lines.forEach(l => put(l.canvas, l.x, l.y + (1 - a) * 18 * s, a * fout));
      } else if (st.anim === 'typing') {
        const chars = L.lines.map(l => Array.from(l.text));
        const total = chars.reduce((a, c) => a + c.length, 0);
        const cps = Math.max(7, total / Math.max(0.5, D * 0.6));
        let shown = Math.floor(tau * cps);
        for (let j = 0; j < L.lines.length && shown > 0; j++) {
          const l = L.lines[j], cs = chars[j], nch = Math.min(cs.length, shown);
          shown -= cs.length;
          let c = l.canvas;
          if (nch < cs.length) {
            const key = i + ':' + j + ':' + nch;
            if (!this.typing.has(key)) {
              if (this.typing.size > 48) { for (const v of this.typing.values()) freeCanvas(v); this.typing.clear(); }
              this.typing.set(key, renderLine(cs.slice(0, nch).join(''), st, s, L.font, L.px).canvas);
            }
            c = this.typing.get(key);
          }
          put(c, l.x, l.y, fout);
        }
      } else if (st.anim === 'scroll') {
        const u = clamp(tau / Math.max(D, 1e-6), 0, 1);
        const startTop = this.H * 0.92, endTop = this.H * 0.08 - L.height;
        const shift = startTop + (endTop - startTop) * u - L.top;
        L.lines.forEach(l => {
          const y = l.y + shift, cy = y + l.canvas.height / 2;
          const a = Math.min(1, (this.H * 0.96 - cy) / (this.H * 0.1), (cy - this.H * 0.04) / (this.H * 0.1));
          put(l.canvas, l.x, y, a);
        });
      } else {
        const a = clamp(tau / 0.15, 0, 1) * fout;
        L.lines.forEach(l => put(l.canvas, l.x, l.y, a));
      }
      x.globalAlpha = 1;
    }

    /** 명함이 보이는 정도(0~1) — 처음과 끝 / 끝에만 / 계속 */
    cardAlpha(t) {
      const mode = this.pj.card.mode, T = this.pj.total;
      const win = (a, b) => clamp(Math.min((t - a) / 0.5, (b - t) / 0.5), 0, 1);
      if (mode === 'always') return win(0.3, T + 1);
      const endA = Math.max(0, T - 4.5);
      if (mode === 'end') return win(endA, T + 1);
      if (T < 10) return win(0.3, T + 1);
      return Math.max(win(0.3, Math.min(4, endA - 1)), win(endA, T + 1));
    }
    drawCard(x, t) {
      const a = this.cardAlpha(t);
      if (a <= 0.003) return;
      const c = this.card, W = this.W, H = this.H;
      const always = this.pj.card.mode === 'always';
      const sc = always ? 0.8 : 1;
      const w = c.width * sc, h = c.height * sc;
      // 명함 · 얼굴 사진은 항상 아래쪽 (글귀는 꾸미기 → 세로 위치로 올려서 맞춤)
      let cy = always ? 0.835 : 0.75;
      if (this.pj.bottomText.trim()) cy -= 0.07;
      const yy = H * cy - h / 2 + (1 - ease(a)) * 30 * this.s;
      x.globalAlpha = a;
      x.drawImage(c, (W - w) / 2, yy, w, h);
      x.globalAlpha = 1;
    }

    draw(x, t) {
      const pj = this.pj, W = this.W, H = this.H;
      this.compose(x, t);
      if (this.ov && this.ov.readyState >= 2) {
        const vw = this.ov.videoWidth, vh = this.ov.videoHeight;
        if (vw && vh) {
          x.globalCompositeOperation = 'screen';
          x.globalAlpha = pj.ovOpacity;
          const sc = Math.max(W / vw, H / vh);
          x.drawImage(this.ov, (W - vw * sc) / 2, (H - vh * sc) / 2, vw * sc, vh * sc);
          x.globalCompositeOperation = 'source-over';
          x.globalAlpha = 1;
        }
      }
      if (this.vig) x.drawImage(this.vig, 0, 0);
      if (this.particles) this.particles.draw(x, t);
      if (this.frame) x.drawImage(this.frame, 0, 0);
      for (let i = 0; i < pj.subs.length; i++) {
        const sg = pj.subs[i];
        if (t >= sg.start && t < sg.end) this.drawSub(x, i, t);
      }
      const fa = ease(t / 0.8);
      for (const L of this.fixed) for (const l of L.lines) { x.globalAlpha = fa; x.drawImage(l.canvas, l.x, l.y); }
      x.globalAlpha = 1;
      if (this.card) this.drawCard(x, t);
      if (pj.fadeEdges) {
        const gch = Math.min(1, t / 0.35, (pj.total - t) / 1.0);
        if (gch < 1) { x.globalAlpha = clamp(1 - gch, 0, 1); x.fillStyle = '#000'; x.fillRect(0, 0, W, H); x.globalAlpha = 1; }
      }
    }
  }

  function seekVideo(v, time) {
    return new Promise(res => {
      if (Math.abs(v.currentTime - time) < 0.004) return res();
      let done = false;
      const fin = () => { if (!done) { done = true; v.removeEventListener('seeked', fin); res(); } };
      v.addEventListener('seeked', fin);
      v.currentTime = time;
      setTimeout(fin, 600);
    });
  }

  // ═══════════════════════════════════════════════
  // 오디오: 디코딩 · 박자 분석 · 가공(볼륨/페이드/반복)
  // ═══════════════════════════════════════════════
  const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
  async function decodeAudio(file) {
    const buf = await file.arrayBuffer();
    const ctx = new OAC(2, 44100, 44100);
    return await new Promise((res, rej) => {
      const p = ctx.decodeAudioData(buf, res, () => rej(new Error('음악 파일을 읽을 수 없습니다 (MP3·M4A·WAV 권장)')));
      if (p && p.then) p.then(res, () => rej(new Error('음악 파일을 읽을 수 없습니다 (MP3·M4A·WAV 권장)')));
    });
  }

  function fftMag(re, im, n, rev, cosT, sinT) {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let i = 0; i < n; i += size) {
        for (let k = 0; k < half; k++) {
          const c = cosT[k * step], s = sinT[k * step];
          const a = i + k, b = a + half;
          const tr = re[b] * c + im[b] * s, ti = im[b] * c - re[b] * s;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  }

  function detectBeats(buffer) {
    const SR = 11025, NFFT = 1024, HOP = 256;
    // 모노 + 11025Hz 리샘플
    const src = buffer.getChannelData(0), src2 = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : null;
    const ratio = buffer.sampleRate / SR, len = Math.floor(src.length / ratio);
    if (len < SR * 4) return { bpm: null, beats: [] };
    const y = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      const p = i * ratio, i0 = Math.floor(p), f = p - i0, i1 = Math.min(i0 + 1, src.length - 1);
      let v = src[i0] * (1 - f) + src[i1] * f;
      if (src2) v = (v + src2[i0] * (1 - f) + src2[i1] * f) / 2;
      y[i] = v;
    }
    const nfr = 1 + Math.floor((len - NFFT) / HOP), bins = NFFT / 2 + 1;
    const rev = new Uint32Array(NFFT), bitsN = Math.log2(NFFT);
    for (let i = 0; i < NFFT; i++) { let r = 0; for (let b = 0; b < bitsN; b++) r |= ((i >> b) & 1) << (bitsN - 1 - b); rev[i] = r; }
    const cosT = new Float32Array(NFFT / 2), sinT = new Float32Array(NFFT / 2);
    for (let k = 0; k < NFFT / 2; k++) { cosT[k] = Math.cos(2 * Math.PI * k / NFFT); sinT[k] = Math.sin(2 * Math.PI * k / NFFT); }
    const win = new Float32Array(NFFT);
    for (let i = 0; i < NFFT; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (NFFT - 1));
    const re = new Float32Array(NFFT), im = new Float32Array(NFFT);
    let prev = new Float32Array(bins), cur = new Float32Array(bins);
    const flux = new Float32Array(nfr);
    for (let f = 0; f < nfr; f++) {
      const off = f * HOP;
      for (let i = 0; i < NFFT; i++) { re[i] = y[off + i] * win[i]; im[i] = 0; }
      fftMag(re, im, NFFT, rev, cosT, sinT);
      let sum = 0;
      for (let k = 0; k < bins; k++) {
        const m = Math.log1p(1000 * Math.hypot(re[k], im[k]));
        cur[k] = m;
        if (f > 0) { const d = m - prev[k]; if (d > 0) sum += d; }
      }
      flux[f] = sum / bins;
      const t = prev; prev = cur; cur = t;
    }
    const fps = SR / HOP, n = nfr;
    // 이동 평균 제거
    const kk = (Math.floor(fps * 0.5) | 1), half = kk >> 1;
    const pre = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + flux[i];
    const env = new Float32Array(n);
    let mx = 0;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - half), b = Math.min(n, i + half + 1);
      env[i] = Math.max(0, flux[i] - (pre[b] - pre[a]) / kk);
      if (env[i] > mx) mx = env[i];
    }
    if (mx <= 0) return { bpm: null, beats: [] };
    let mean = 0; for (let i = 0; i < n; i++) mean += env[i]; mean /= n;
    let sd = 0; for (let i = 0; i < n; i++) sd += (env[i] - mean) ** 2; sd = Math.sqrt(sd / n) + 1e-9;
    for (let i = 0; i < n; i++) env[i] /= sd;
    mean /= sd;
    // 1) 자기상관으로 템포 후보
    const lo = Math.floor(fps * 60 / 200), hi = Math.min(n - 2, Math.floor(fps * 60 / 55));
    let bestLag = lo, bestScore = -Infinity;
    for (let lag = lo; lag <= hi; lag++) {
      let ac = 0;
      for (let i = 0; i + lag < n; i++) ac += (env[i] - mean) * (env[i + lag] - mean);
      const bpm = 60 * fps / lag;
      const w = Math.exp(-0.5 * (Math.log2(bpm / 115)) ** 2);
      if (ac * w > bestScore) { bestScore = ac * w; bestLag = lag; }
    }
    // 2) 콤 필터로 주기·위상 정밀화
    const gk = [-3, -2, -1, 0, 1, 2, 3].map(v => Math.exp(-0.5 * (v / 1.2) ** 2));
    const gs = gk.reduce((a, b) => a + b, 0);
    const sm = new Float32Array(n);
    for (let i = 0; i < n; i++) { let v = 0; for (let j = -3; j <= 3; j++) { const q = i + j; if (q >= 0 && q < n) v += env[q] * gk[j + 3]; } sm[i] = v / gs; }
    let best = { s: -1, p: bestLag, o: 0 };
    for (let p = Math.max(2, bestLag - 1); p <= bestLag + 1.0001; p += 0.02) {
      const K = Math.floor((n - 1) / p);
      if (K < 4) continue;
      for (let o = 0; o < Math.ceil(p); o++) {
        let sc = 0;
        for (let k = 0; k < K; k++) { const idx = Math.round(o + k * p); if (idx < n) sc += sm[idx]; }
        sc /= K;
        if (sc > best.s) best = { s: sc, p, o };
      }
    }
    const beats = [];
    for (let b = best.o; b < n - 1; b += best.p) {
      const a = Math.max(0, Math.floor(b) - 3), c = Math.min(n, Math.floor(b) + 4);
      let am = a; for (let i = a; i < c; i++) if (env[i] > env[am]) am = i;
      beats.push((am * HOP + NFFT / 2) / SR);
    }
    return { bpm: 60 * fps / best.p, beats };
  }

  async function analyzeAudio(file) {
    const buffer = await decodeAudio(file);
    let bpm = null, beats = [];
    try { ({ bpm, beats } = detectBeats(buffer)); } catch (e) { console.warn(e); }
    return { buffer, duration: buffer.duration, bpm, beats };
  }

  function analyzeBuffer(buffer) {
    let bpm = null, beats = [];
    try { ({ bpm, beats } = detectBeats(buffer)); } catch (e) { console.warn(e); }
    return { buffer, duration: buffer.duration, bpm, beats };
  }
  /** 동영상 파일 속 소리 꺼내기 (소리가 없거나 못 읽으면 null) */
  async function decodeClipAudio(file) {
    try {
      if (file.size > 400 * 1048576) return null;
      return await decodeAudio(file);
    } catch (e) { return null; }
  }

  /**
   * a = { buffer(배경음악·없으면 null), start, volume, fadeIn, fadeOut,
   *       clips:[{buffer, at, offset, dur}] (영상 속 소리), duck:[[시작,끝]] (이 구간엔 배경음악 끄기) }
   */
  async function renderAudio(a, total, sr = 48000) {
    const len = Math.max(1, Math.ceil(total * sr));
    const oc = new OAC(2, len, sr);
    const master = oc.createGain();
    const fi = Math.min(a.fadeIn || 0, total / 4), fo = Math.min(a.fadeOut || 0, total / 2);
    master.gain.setValueAtTime(fi > 0 ? 0 : 1, 0);
    if (fi > 0) master.gain.linearRampToValueAtTime(1, fi);
    master.gain.setValueAtTime(1, Math.max(fi, total - fo));
    if (fo > 0) master.gain.linearRampToValueAtTime(0, total);
    master.connect(oc.destination);
    if (a.buffer) {
      const src = oc.createBufferSource();
      src.buffer = a.buffer;
      src.loop = true;
      const gn = oc.createGain();
      gn.gain.value = a.volume;
      const duck = oc.createGain();
      duck.gain.setValueAtTime(1, 0);
      // 겹치거나 가까운 구간은 하나로 합침
      const zones = (a.duck || []).slice().sort((p, q) => p[0] - q[0]).reduce((acc, z) => {
        const l = acc[acc.length - 1];
        if (l && z[0] - l[1] < 0.8) l[1] = Math.max(l[1], z[1]); else acc.push([z[0], z[1]]);
        return acc;
      }, []);
      for (const [s, e] of zones) {
        const s0 = Math.max(0, s - 0.3);
        duck.gain.setValueAtTime(s <= 0.05 ? 0 : 1, s0);
        duck.gain.linearRampToValueAtTime(0, Math.max(s0 + 0.01, s));
        if (e < total - 0.05) { duck.gain.setValueAtTime(0, e); duck.gain.linearRampToValueAtTime(1, e + 0.3); }
      }
      src.connect(gn); gn.connect(duck); duck.connect(master);
      src.start(0, Math.min(Math.max(0, a.start), a.buffer.duration - 0.01));
    }
    for (const c of (a.clips || [])) {
      if (!c.buffer || c.dur <= 0.05 || c.at >= total) continue;
      const off = Math.min(Math.max(0, c.offset), Math.max(0, c.buffer.duration - 0.05));
      const dur = Math.min(c.dur, c.buffer.duration - off, total - c.at);
      if (dur <= 0.05) continue;
      const s = oc.createBufferSource();
      s.buffer = c.buffer;
      const g2 = oc.createGain(), f = Math.min(0.08, dur / 4), v = a.clipVolume == null ? 1 : a.clipVolume;
      g2.gain.setValueAtTime(0, c.at);
      g2.gain.linearRampToValueAtTime(v, c.at + f);
      g2.gain.setValueAtTime(v, c.at + dur - f);
      g2.gain.linearRampToValueAtTime(0, c.at + dur);
      s.connect(g2); g2.connect(master);
      s.start(c.at, off, dur);
    }
    return await new Promise((res, rej) => {
      oc.oncomplete = e => res(e.renderedBuffer);
      const p = oc.startRendering();
      if (p && p.then) p.then(res, rej);
    });
  }

  // ═══════════════════════════════════════════════
  // MP4 내보내기 (WebCodecs)
  // ═══════════════════════════════════════════════
  async function pickVideoConfig(W, H, fps, hq) {
    const list = W >= 1080 ? ['avc1.640028', 'avc1.4d0028', 'avc1.42e028', 'avc1.640032']
      : ['avc1.64001f', 'avc1.4d001f', 'avc1.42e01f', 'avc1.640028'];
    const bitrate = W >= 1080 ? (hq ? 12e6 : 8e6) : (hq ? 6e6 : 4e6);
    for (const codec of list) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } };
      try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (e) { /* 다음 후보 */ }
    }
    return null;
  }
  async function pickAudioConfig(sr) {
    if (typeof AudioEncoder === 'undefined') return null;
    const list = [
      { codec: 'mp4a.40.2', mux: 'aac', sampleRate: sr, numberOfChannels: 2, bitrate: 160000 },
      { codec: 'opus', mux: 'opus', sampleRate: sr, numberOfChannels: 2, bitrate: 128000 },
    ];
    for (const c of list) {
      const cfg = { codec: c.codec, sampleRate: c.sampleRate, numberOfChannels: 2, bitrate: c.bitrate };
      try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux: c.mux }; } catch (e) { /* 다음 */ }
    }
    return null;
  }
  function supportInfo() {
    return { video: typeof VideoEncoder !== 'undefined' && typeof VideoFrame !== 'undefined', audio: typeof AudioEncoder !== 'undefined' };
  }

  /**
   * @param pj 프로젝트  @param opt {W,H,fps,hq}  @param onProgress (done,total,sec,phase)  @param ctl {aborted:boolean}
   * @returns {Promise<{blob:Blob, audioCodec:string|null, warning:string|null}>}
   */
  async function exportVideo(pj, opt, onProgress, ctl = {}) {
    const { W, H, fps, hq } = opt;
    if (!supportInfo().video) throw new Error('이 브라우저는 영상 만들기(WebCodecs)를 지원하지 않습니다. 안드로이드는 크롬, 아이폰은 최신 사파리를 사용해 주세요.');
    const vcfg = await pickVideoConfig(W, H, fps, hq);
    if (!vcfg) throw new Error(`이 기기는 ${W}x${H} H.264 인코딩을 지원하지 않습니다. 해상도를 720으로 낮춰 보세요.`);
    let warning = null, acfg = null, audioBuf = null;
    const SR = 48000;
    if (pj.audio) {
      acfg = await pickAudioConfig(SR);
      if (!acfg) warning = '이 브라우저는 오디오 인코딩을 지원하지 않아 무음 영상으로 만들었습니다.';
      else {
        onProgress && onProgress(0, 1, 0, 'audio');
        audioBuf = await renderAudio(pj.audio, pj.total, SR);
      }
    }
    const mux = new g.Mp4Muxer({
      video: { width: W, height: H },
      audio: acfg ? { codec: acfg.mux, sampleRate: SR, numberOfChannels: 2, bitrate: acfg.cfg.bitrate } : undefined,
    });
    let encErr = null;
    // ── 오디오 인코딩 ──
    if (acfg && audioBuf) {
      const ae = new AudioEncoder({ output: (c, m) => mux.addAudioChunk(c, m), error: e => { encErr = e; } });
      ae.configure(acfg.cfg);
      const L = audioBuf.getChannelData(0), R = audioBuf.numberOfChannels > 1 ? audioBuf.getChannelData(1) : L;
      const N = audioBuf.length, BLK = 4800;
      for (let i = 0; i < N; i += BLK) {
        const n = Math.min(BLK, N - i);
        const data = new Float32Array(n * 2);
        data.set(L.subarray(i, i + n), 0);
        data.set(R.subarray(i, i + n), n);
        const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i * 1e6 / SR), data });
        ae.encode(ad);
        ad.close();
        if (ae.encodeQueueSize > 16) await sleep(1);
        if (encErr) throw encErr;
      }
      await ae.flush();
      ae.close();
      if (encErr) throw encErr;
    }
    // ── 영상 인코딩 ──
    const canvas = mkCanvas(W, H);
    const x = canvas.getContext('2d', { alpha: false });
    x.imageSmoothingQuality = 'high';
    const cache = new BaseCache(4);
    const r = new Renderer(pj, W, H, cache);
    await r.init();
    const ve = new VideoEncoder({ output: (c, m) => mux.addVideoChunk(c, m), error: e => { encErr = e; } });
    ve.configure(vcfg);
    const nFrames = Math.max(1, Math.round(pj.total * fps));
    const t0 = performance.now();
    const frameDur = Math.round(1e6 / fps);
    try {
      for (let i = 0; i < nFrames; i++) {
        if (ctl.aborted) throw new Error('취소했습니다.');
        if (encErr) throw encErr;
        const t = i / fps;
        await r.ensureFor(t);
        r.draw(x, t);
        const vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: frameDur });
        ve.encode(vf, { keyFrame: i % (fps * 2) === 0 });
        vf.close();
        while (ve.encodeQueueSize > 6) await sleep(2);
        if (i % 6 === 0 || i === nFrames - 1) {
          onProgress && onProgress(i + 1, nFrames, (performance.now() - t0) / 1000, 'video');
          await sleep(0);
        }
      }
      await ve.flush();
      if (encErr) throw encErr;
    } finally {
      try { ve.close(); } catch (e) { /* 이미 닫힘 */ }
      r.destroy();
      cache.clear();
      freeCanvas(canvas);
    }
    const blob = new Blob(mux.finalize(), { type: 'video/mp4' });
    return { blob, audioCodec: acfg ? acfg.mux : null, warning, videoCodec: vcfg.codec };
  }

  g.ENG = {
    OPT, PARTICLES, BaseCache, Renderer, planScenes, subsFromScenes, parseSrt, splitBlocks,
    analyzeAudio, analyzeBuffer, decodeClipAudio, renderAudio, exportVideo, supportInfo, fontDef, setCustomFont, ensureFont, loadImage, mkCanvas,
    seekVideo, makeCard,
  };
})(window);

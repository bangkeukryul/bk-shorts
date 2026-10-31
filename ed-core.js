/*!
 * ed-core.js — BK쇼츠 🎬 영상 편집 (모임 · 추억 · 가게 홍보 · 블로그 …)
 * 사진 · 동영상 자르기/나누기/순서/속도 · 자막 · 스티커 · 효과 · 효과음 · 음악 · 목소리 녹음
 * AI 장면 분석 요청서(모아보기 그림) · 가게 정보(브랜드 키트) · 세로/가로/정사각 MP4 · 블로그 묶음
 * 휴대폰 브라우저 안에서만 처리해요 (Canvas + WebCodecs). 서버로 올라가지 않아요.
 */
(function (g) {
'use strict';
const ED = g.ED = {};
const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const uid = p => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = s => { s = Math.max(0, s || 0); const m = Math.floor(s / 60), r = s - m * 60; return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1); };
const fmtS = s => { s = Math.max(0, Math.round(s || 0)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
Object.assign(ED, { $, sleep, clamp, uid, esc, fmt, fmtS, ease });

/* ═════════ 비율 ═════════ */
const RATIOS = { '9:16': [1080, 1920, '📱 세로 (쇼츠 · 릴스 · 틱톡)'], '16:9': [1920, 1080, '🖥 가로 (블로그 · 유튜브 · TV)'], '1:1': [1080, 1080, '⬛ 정사각 (인스타 · 카톡 프로필)'] };
function outSize(r, q) { const [w, h] = RATIOS[r]; const k = q / Math.min(w, h); return [Math.round(w * k / 2) * 2, Math.round(h * k / 2) * 2]; }

/* ═════════ 목적 템플릿 ═════════ */
// biz: 가게 정보 쓰기 · end: 엔딩 종류 · cap: 자막 스타일 · mus: 음악 · tr: 전환 · flt: 색감 · img: 사진 길이
const PURPOSE = {
  meet:    { ic: '😂', n: '모임 · 동창회', d: '웃음 · 예능 자막 · 효과음', cap: 'variety', mus: 'bright', tr: 'zoom', flt: 'vivid', img: 3, end: 'credits', ratio: '9:16', title: '우리들의 동창회', tone: '친구들끼리 보며 크게 웃을 수 있는 예능 프로그램 같은 재미있는 말투(반말 섞인 유쾌한 자막, 과장된 리액션)', plan: '처음 3초에 가장 웃긴 장면 → 반가운 얼굴들 → 웃음 터진 순간들 → 단체 사진 → 마지막 인사' },
  memory:  { ic: '🕊', n: '추억 · 추모', d: '부모님 · 그리운 분 · 잔잔하게', cap: 'memory', mus: 'piano', tr: 'fade', flt: 'warm', img: 4.5, end: 'memorial', ratio: '16:9', title: '그리운 우리 부모님', tone: '그리움과 감사가 담긴 따뜻하고 잔잔한 말투(존댓말, 짧은 편지처럼). 과장하지 않고 담담하게', plan: '젊은 시절 사진(옛날부터 시간 순서) → 가족과 함께한 순간 → 웃는 모습 → 마지막 감사 인사' },
  family:  { ic: '🎉', n: '가족 행사', d: '생일 · 칠순 · 결혼기념일', cap: 'bubble', mus: 'bright', tr: 'slide', flt: 'warm', img: 3.5, end: 'simple', ratio: '16:9', title: '축하합니다', tone: '가족끼리 축하하는 따뜻하고 밝은 말투, 주인공에게 건네는 축하 말', plan: '주인공 소개 → 지난 추억 사진 → 오늘 행사 장면 → 가족 단체 사진 → 축하 메시지' },
  kids:    { ic: '👶', n: '아이 성장', d: '우리 아이 자라는 모습', cap: 'cute', mus: 'bells', tr: 'slide', flt: 'soft', img: 3, end: 'simple', ratio: '9:16', title: '우리 아이 성장 일기', tone: '귀엽고 사랑스러운 말투, 아이의 마음을 대신 말해 주는 자막', plan: '태어났을 때 → 처음 걸음마 · 웃음 → 자라는 모습 순서대로 → 지금 모습' },
  travel:  { ic: '✈️', n: '여행 브이로그', d: '여행지 · 맛집 · 풍경', cap: 'cinema', mus: 'lofi', tr: 'whoosh', flt: 'film', img: 2.5, end: 'simple', ratio: '16:9', title: '여행 기록', tone: '감성 여행 브이로그 말투, 장소 이름과 그때 느낌을 짧게', plan: '출발 → 도착 풍경 → 맛집 · 체험 → 기억에 남는 순간 → 돌아오는 길' },
  store:   { ic: '🏪', n: '가게 홍보', d: '소상공인 · 매장 · 이벤트', cap: 'variety', mus: 'pop', tr: 'zoom', flt: 'vivid', img: 2.5, end: 'store', ratio: '9:16', biz: 1, title: '', tone: '손님이 가고 싶어지는 짧고 힘 있는 광고 문구(존댓말), 첫 3초에 눈길을 끄는 한마디', plan: '첫 3초 눈길 끌기 → 대표 메뉴 · 상품 → 가게 분위기 → 가격 · 이벤트 → 위치 · 연락처 → 지금 방문하세요' },
  menu:    { ic: '🍽', n: '메뉴 소개', d: '음식점 · 카페 대표 메뉴', cap: 'variety2', mus: 'pop', tr: 'zoom', flt: 'vivid', img: 2.5, end: 'store', ratio: '9:16', biz: 1, title: '', tone: '먹고 싶어지는 맛 표현(바삭, 촉촉, 진한 등)과 메뉴 이름 · 가격을 또렷하게', plan: '가장 맛있어 보이는 장면 → 메뉴 하나씩(이름 · 가격) → 만드는 모습 → 매장 → 위치 · 연락처' },
  product: { ic: '📦', n: '제품 소개 · 리뷰', d: '상품 장점 · 사용 모습', cap: 'news', mus: 'bright', tr: 'slide', flt: 'none', img: 3, end: 'store', ratio: '9:16', biz: 1, title: '', tone: '제품의 장점을 쉽게 알려 주는 믿음 가는 말투, 숫자 · 특징을 짧게', plan: '문제 상황 한마디 → 제품 등장 → 장점 3가지 → 사용 모습 → 가격 · 구매 방법' },
  company: { ic: '🏢', n: '회사 · 기관 소개', d: '회사 · 단체 · 사무실', cap: 'news', mus: 'strings', tr: 'fade', flt: 'cool', img: 3.5, end: 'company', ratio: '16:9', biz: 1, title: '', tone: '신뢰감 있는 공식 소개 말투(존댓말), 숫자와 강점을 또렷하게', plan: '회사 첫인상 → 하는 일 → 강점 · 실적 → 사람들 · 현장 → 연락처' },
  realty:  { ic: '🏠', n: '부동산 매물', d: '집 · 상가 · 토지 소개', cap: 'news', mus: 'lofi', tr: 'slide', flt: 'soft', img: 3, end: 'store', ratio: '16:9', biz: 1, title: '', tone: '매물의 장점을 정확하게 알려 주는 말투(평수 · 방 개수 · 층 · 주변 시설)', plan: '외관 · 전망 → 거실 → 방 · 주방 · 욕실 → 주변 환경 → 가격 · 연락처' },
  event:   { ic: '🎓', n: '행사 · 세미나 스케치', d: '행사 · 교육 · 시상식', cap: 'box', mus: 'strings', tr: 'fade', flt: 'none', img: 3, end: 'credits', ratio: '16:9', title: '행사 스케치', tone: '행사 분위기를 전하는 깔끔한 기록 말투', plan: '행사 이름 · 날짜 → 시작 장면 → 주요 순서 → 참석자 모습 → 단체 사진 · 마무리' },
  church:  { ic: '⛪', n: '교회 · 동호회', d: '예배 · 봉사 · 동호회 활동', cap: 'memory', mus: 'h_grace', tr: 'fade', flt: 'warm', img: 3.5, end: 'credits', ratio: '16:9', title: '함께한 시간', tone: '따뜻하고 감사가 담긴 말투', plan: '모임 소개 → 함께한 활동 → 웃는 얼굴들 → 감사 인사' },
  blog:    { ic: '📝', n: '블로그 · 일상', d: '일상 기록 · 후기', cap: 'cinema', mus: 'lofi', tr: 'fade', flt: 'film', img: 3, end: 'simple', ratio: '16:9', title: '오늘의 기록', tone: '블로그 후기처럼 솔직하고 친근한 말투', plan: '오늘의 주제 → 순서대로 장면 → 느낀 점 → 마무리 인사' },
  me:      { ic: '💼', n: '내 소개 · 명함 영상', d: '1인 사업자 · 상담사 · 강사', cap: 'box', mus: 'strings', tr: 'fade', flt: 'none', img: 3.5, end: 'company', ratio: '9:16', biz: 1, title: '', tone: '믿음 가는 자기소개 말투(존댓말), 경력과 도와드릴 수 있는 일을 쉽게', plan: '인사 · 이름 → 하는 일 → 경력 · 자격 → 고객 이야기 · 활동 → 연락처' },
};

/* ═════════ 자막 스타일 ═════════ */
const CAPS = {
  basic:    { n: '기본', font: 'noto', fill: '#ffffff', stroke: '#000000', sw: .16, y: .84, anim: 'fade' },
  variety:  { n: '예능 노랑', font: 'blackhan', fill: '#ffe14d', stroke: '#111111', sw: .22, outer: '#ff4d6d', y: .76, anim: 'pop', tilt: -3 },
  variety2: { n: '예능 분홍', font: 'jua', fill: '#ffffff', stroke: '#ff3d7f', sw: .22, y: .76, anim: 'bounce' },
  bubble:   { n: '말풍선', font: 'jua', fill: '#222222', box: 'bubble', y: .2, anim: 'pop' },
  news:     { n: '뉴스 띠', font: 'noto', fill: '#ffffff', box: 'band', y: .87, anim: 'slide' },
  box:      { n: '반투명 상자', font: 'noto', fill: '#ffffff', box: 'dark', y: .84, anim: 'fade' },
  memory:   { n: '추억 명조', font: 'gowunbatang', fill: '#fffaf0', shadow: 1, y: .8, anim: 'slowfade' },
  hand:     { n: '손글씨', font: 'nanumpen', fill: '#ffffff', shadow: 1, y: .8, anim: 'fade', big: 1.25 },
  cute:     { n: '귀여운', font: 'gaegu', fill: '#ffffff', stroke: '#ff8fb1', sw: .2, y: .8, anim: 'bounce' },
  neon:     { n: '네온', font: 'dohyeon', fill: '#e0fbff', glow: '#22d3ee', y: .8, anim: 'fade' },
  typing:   { n: '타자기', font: 'noto', fill: '#ffffff', box: 'dark', y: .84, anim: 'type' },
  cinema:   { n: '영화 자막', font: 'noto', fill: '#ffffff', shadow: 1, y: .9, anim: 'fade', small: .78 },
  price:    { n: '가격 강조', font: 'blackhan', fill: '#ffffff', box: 'red', y: .78, anim: 'pop' },
};
const CAP_ANIMS = { fade: '스르르', pop: '톡 튀어나옴', bounce: '통통', slide: '옆에서 쓱', slowfade: '천천히', type: '한 글자씩', none: '그대로' };
const COLORS = ['#ffffff', '#ffe14d', '#ff4d6d', '#ff8fb1', '#7dd3fc', '#86efac', '#fdba74', '#c4b5fd', '#111111'];

/* ═════════ 색감 · 효과 · 전환 ═════════ */
const FILTERS = { none: ['원본', 'none'], warm: ['따뜻하게', 'sepia(.22) saturate(1.18) brightness(1.04)'], old: ['옛날 사진', 'sepia(.6) contrast(.94) brightness(1.03) saturate(.75)'], bw: ['흑백', 'grayscale(1) contrast(1.12)'], vivid: ['선명하게', 'saturate(1.45) contrast(1.08)'], cool: ['시원하게', 'saturate(1.1) hue-rotate(-12deg) brightness(1.04)'], film: ['필름 감성', 'contrast(1.12) saturate(.82) sepia(.18)'], soft: ['뽀얗게', 'brightness(1.09) contrast(.9) saturate(.95)'], bright: ['밝게', 'brightness(1.18) contrast(1.02)'] };
const EFX = { punch: '💥 확 줌인', shake: '🫨 흔들림', flash: '⚡ 번쩍', vignette: '🌑 가장자리 어둡게', grain: '🎞 옛날 필름', mirror: '↔️ 좌우 뒤집기', heart: '💗 하트 날리기', confetti: '🎊 꽃가루', snow: '❄️ 눈 내림', petal: '🌸 꽃잎' };
const TRANS = { cut: '바로', fade: '스르르', black: '검은 화면', white: '하얀 번쩍', slide: '옆으로 밀기', up: '위로 밀기', zoom: '줌 확대', wipe: '닦아내기', whoosh: '휙 (흔들며)' };
const KB = { auto: '자동', none: '움직임 없음', in: '천천히 확대', out: '천천히 축소', left: '왼쪽으로', right: '오른쪽으로' };

/* ═════════ 스티커 ═════════ */
const EMOJI = ['😂', '🤣', '😍', '🥹', '😭', '😎', '🤩', '😱', '👍', '👏', '🙏', '❤️', '💕', '🔥', '✨', '🎉', '🎂', '🍻', '☕', '🍜', '🌸', '⭐', '💯', '❗', '❓', '👉', '👆', '💰', '📍', '📞', '🎁', '🏆'];
const BADGES = { price: '💰 가격표', sale: '🔥 할인', new: '🆕 NEW', best: '🏆 BEST', open: '🎉 오픈', pin: '📍 위치', phone: '📞 전화', text: '🔤 글씨', arrow: '👉 화살표', qr: '🔳 QR' };

/* ═════════ 효과음 ═════════ */
const SFX = { clap: '👏 박수', boing: '🌀 띠용', pop: '💥 뿅', dun: '🥁 두둥', ding: '🔔 딩동댕', buzz: '❌ 땡', whoosh: '💨 휙', tada: '🎉 짜잔', shutter: '📸 찰칵', roll: '🥁 두구두구', sparkle: '✨ 반짝', heart: '💗 두근' };

Object.assign(ED, { RATIOS, outSize, PURPOSE, CAPS, CAP_ANIMS, COLORS, FILTERS, EFX, TRANS, KB, EMOJI, BADGES, SFX });

/* ═════════ 저장소 (IndexedDB · 이어서 하기) ═════════ */
const IDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('bk-edit', 1);
      r.onupgradeneeded = () => { r.result.createObjectStore('f'); r.result.createObjectStore('p'); };
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async tx(store, mode, fn) {
    const db = await this.open();
    return new Promise((res, rej) => { const t = db.transaction(store, mode), s = t.objectStore(store); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  },
  put(store, k, v) { return this.tx(store, 'readwrite', s => s.put(v, k)); },
  get(store, k) { return this.tx(store, 'readonly', s => s.get(k)); },
  del(store, k) { return this.tx(store, 'readwrite', s => s.delete(k)); },
  clear(store) { return this.tx(store, 'readwrite', s => s.clear()); },
};
ED.IDB = IDB;

/* ═════════ 프로젝트 ═════════ */
function newProject(purpose, ratio) {
  const pp = PURPOSE[purpose] || PURPOSE.meet;
  return {
    v: 1, purpose, ratio: ratio || pp.ratio, srcs: [], clips: [], nP: 1, nV: 1, nA: 1,
    capDef: { style: pp.cap, font: '', size: 1, color: '', anim: '' },
    music: { kind: 'auto', fileId: null, vol: .7, duck: 1, fade: 2.5 }, clipVol: 1, wm: 1,
    info: { title: pp.title, sub: '', ending: purpose === 'memory' ? '보고 싶습니다. 사랑합니다.' : '', names: '', brandId: null },
  };
}
function newClip(kind, src, o) {
  return Object.assign({ id: uid('c'), kind, src: src || null, in: 0, out: 0, dur: 3, speed: 1, vol: 1, mute: 0, fit: 'auto', fx: .5, fy: .5, kb: 'auto', filter: 'auto', trans: 'auto', td: .6, efx: [], hold: 0, cap: { t: '' }, stk: [], blur: [], sfx: [], vo: null }, o || {});
}
ED.newProject = newProject; ED.newClip = newClip;

/* ═════════ 자료 (사진 · 동영상 · 녹음) ═════════ */
const SRC = new Map();
ED.SRC = SRC;
function vidEl(url) {
  const v = document.createElement('video');
  v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.crossOrigin = 'anonymous'; v.src = url;
  return v;
}
function waitMeta(v) {
  return new Promise((res, rej) => {
    if (v.readyState >= 1 && isFinite(v.duration)) return res();
    const ok = () => { cl(); res(); }, no = () => { cl(); rej(new Error('동영상을 열 수 없어요 (MP4 권장)')); };
    const cl = () => { v.removeEventListener('loadedmetadata', ok); v.removeEventListener('error', no); };
    v.addEventListener('loadedmetadata', ok); v.addEventListener('error', no);
    setTimeout(() => { cl(); v.readyState >= 1 ? res() : rej(new Error('동영상을 여는 데 시간이 너무 걸려요')); }, 15000);
  });
}
async function loadSource(meta, blob) {
  const s = Object.assign({}, meta, { file: blob, url: URL.createObjectURL(blob) });
  if (s.kind === 'image') {
    let bmp = null;
    try { bmp = await createImageBitmap(blob, { imageOrientation: 'from-image' }); } catch (e) { bmp = await ENG.loadImage(s.url); }
    // 너무 큰 사진은 줄여서 (메모리)
    const mx = 2160, k = Math.min(1, mx / Math.max(bmp.width, bmp.height));
    if (k < 1) { const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close(); bmp = c; }
    s.img = bmp; s.w = bmp.width; s.h = bmp.height; s.dur = 0;
  } else if (s.kind === 'video') {
    s.vid = vidEl(s.url); await waitMeta(s.vid);
    s.dur = s.vid.duration; s.w = s.vid.videoWidth || 1280; s.h = s.vid.videoHeight || 720;
  } else if (s.kind === 'audio') {
    s.buf = await decodeAudioBlob(blob); s.dur = s.buf ? s.buf.duration : 0;
  }
  SRC.set(s.id, s);
  return s;
}
async function decodeAudioBlob(blob) {
  try {
    const ab = await blob.arrayBuffer(); const ctx = new OAC(2, 44100, 44100);
    return await new Promise((res, rej) => { const p = ctx.decodeAudioData(ab, res, rej); if (p && p.then) p.then(res, rej); });
  } catch (e) { return null; }
}
async function clipAudio(s) {
  if (s.audioTried) return s.audio;
  s.audioTried = true;
  s.audio = (s.file && s.file.size < 400 * 1048576) ? await decodeAudioBlob(s.file) : null;
  return s.audio;
}
Object.assign(ED, { loadSource, clipAudio, vidEl, waitMeta, decodeAudioBlob });

/* 화면 잡기용 영상 (미리보기와 따로) */
async function grabFrame(s, t, maxSide) {
  if (s.kind === 'image') return s.img;
  if (!s.grab) { s.grab = vidEl(s.url); await waitMeta(s.grab); }
  s.grabQ = (s.grabQ || Promise.resolve()).then(async () => {
    await ENG.seekVideo(s.grab, clamp(t, 0, Math.max(0, s.dur - 0.05)));
    const k = Math.min(1, (maxSide || 640) / Math.max(s.w, s.h)), c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(s.w * k)); c.height = Math.max(2, Math.round(s.h * k));
    c.getContext('2d').drawImage(s.grab, 0, 0, c.width, c.height);
    return c;
  });
  return s.grabQ;
}
ED.grabFrame = grabFrame;

/* ═════════ 장면 시간 ═════════ */
function clipLen(c) {
  if (c.kind === 'video') return Math.max(.1, (c.out - c.in) / (c.speed || 1)) + (c.hold || 0);
  return Math.max(.3, c.dur || 3);
}
function timeline(P) {
  let t = 0; const st = [];
  for (const c of P.clips) { st.push(t); t += clipLen(c); }
  return { st, total: t };
}
function clipAt(P, t) {
  const { st, total } = timeline(P);
  for (let i = P.clips.length - 1; i >= 0; i--) if (t >= st[i] - 1e-6) return { i, c: P.clips[i], lt: t - st[i], st: st[i], total };
  return { i: -1, c: null, lt: 0, st: 0, total };
}
/** 장면 안 시간 → 영상 원본 시간 */
function srcTime(c, lt) {
  const play = (c.out - c.in) / (c.speed || 1);
  return c.in + Math.min(lt, play) * (c.speed || 1);
}
Object.assign(ED, { clipLen, timeline, clipAt, srcTime });

/* 목적 기본값 풀어 쓰기 */
function eff(P, c, key) {
  const pp = PURPOSE[P.purpose] || PURPOSE.meet;
  if (key === 'fit') return c.fit === 'auto' ? 'blur' : c.fit;
  if (key === 'filter') return c.filter === 'auto' ? pp.flt : c.filter;
  if (key === 'trans') return c.trans === 'auto' ? pp.tr : c.trans;
  return c[key];
}
ED.eff = eff;
})(window);

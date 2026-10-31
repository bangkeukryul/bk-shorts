/*! ed-ui.js — BK쇼츠 영상 편집 화면 */
(function (g) {
'use strict';
const ED = g.ED, { $, sleep, clamp, uid, esc, fmt, fmtS, PURPOSE, CAPS, CAP_ANIMS, COLORS, FILTERS, EFX, TRANS, KB, EMOJI, BADGES, SFX, RATIOS, SRC, IDB, clipLen, timeline, clipAt, srcTime, eff } = ED;
let P = null, SEL = -1, T = 0, TAB = 'edit', PLAY = false, SELOV = null, FOCUS = false, startPurpose = 'meet', startRatio = '', aiMode = 'all', aiTone = '', aiLen = '1분', aiExtra = '', sheets = [], results = [];
const FONTS = ['noto', 'blackhan', 'dohyeon', 'jua', 'gowundodum', 'gowunbatang', 'nanummyeongjo', 'nanumpen', 'nanumbrush', 'gaegu', 'gamja', 'himelody', 'songmyung'];
ED.thumbs = new Map();

/* ═════════ 알림 · 기다림 ═════════ */
let tT = 0;
function toast(m, ms) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(tT); tT = setTimeout(() => { t.hidden = true; }, ms || 2600); }
ED.toast = toast;
function busy(m) { $('busy').hidden = !m; if (m) $('busyT').textContent = m; }
const pressed = (a, b) => ` aria-pressed="${a === b}"`;

/* ═════════ 되돌리기 · 저장 ═════════ */
let hist = [], hi = -1, saveT = 0;
function commit(noHist) {
  if (!noHist) { const s = JSON.stringify(P); if (s !== hist[hi]) { hist = hist.slice(0, hi + 1); hist.push(s); if (hist.length > 50) hist.shift(); hi = hist.length - 1; } }
  updUndo(); renderTL(); drawNow(); clearTimeout(saveT); saveT = setTimeout(saveProj, 700); premix();
}
function setP(p) { P = ED.P = p; }
function undo(d) { const n = hi + d; if (n < 0 || n >= hist.length) return; hi = n; setP(JSON.parse(hist[hi])); if (SEL >= P.clips.length) SEL = P.clips.length - 1; SELOV = null; T = Math.min(T, timeline(P).total); renderAll(); clearTimeout(saveT); saveT = setTimeout(saveProj, 700); toast(d < 0 ? '↩️ 되돌렸어요' : '↪️ 다시 했어요'); }
function updUndo() { $('undoBtn').disabled = hi <= 0; $('redoBtn').disabled = hi >= hist.length - 1; }
async function saveProj() { if (!P) return; try { await IDB.put('p', 'cur', { P, at: Date.now() }); } catch (e) { toast('저장 공간이 부족해 「이어서 하기」 저장을 못 했어요'); } }

/* ═════════ 시작 화면 ═════════ */
function renderStart() {
  $('pGrid').innerHTML = Object.entries(PURPOSE).map(([k, p]) => `<button type="button" class="pcard" data-p="${k}"${pressed(startPurpose, k)}><span class="pi">${p.ic}</span><b>${esc(p.n)}</b><small>${esc(p.d)}</small></button>`).join('');
  const r = startRatio || PURPOSE[startPurpose].ratio;
  $('rChips').innerHTML = Object.entries(RATIOS).map(([k, v]) => `<button type="button" data-r="${k}"${pressed(r, k)}>${v[2]}${k === PURPOSE[startPurpose].ratio ? ' <em>추천</em>' : ''}</button>`).join('');
}
$('pGrid').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; startPurpose = b.dataset.p; startRatio = ''; renderStart(); });
$('rChips').addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; startRatio = b.dataset.r; renderStart(); });
$('fStart').addEventListener('change', async e => {
  const fs = Array.from(e.target.files || []); e.target.value = ''; if (!fs.length) return;
  try { await IDB.clear('f'); await IDB.clear('p'); } catch (err) { /* 무시 */ }
  SRC.clear(); ED.endRaw.clear(); ED.thumbs.clear();
  setP(ED.newProject(startPurpose, startRatio || PURPOSE[startPurpose].ratio));
  const pp = PURPOSE[P.purpose];
  P.clips.push(ED.newClip('card', null, { card: 'title', dur: P.purpose === 'memory' ? 4 : 3 }));
  P.clips.push(ED.newClip('card', null, { card: pp.end, dur: pp.end === 'credits' ? 6 : pp.end === 'memorial' ? 5 : 4.5 }));
  hist = []; hi = -1; SEL = -1; T = 1.2;
  showEditor();
  await addFiles(fs, 1);
  commit(); TAB = 'edit'; renderPanel();
  toast(`🤖 「AI」 탭에서 자르기 · 자막을 한 번에 맡길 수 있어요`, 4500);
});
async function checkResume() {
  let d = null; try { d = await IDB.get('p', 'cur'); } catch (e) { /* 없음 */ }
  if (!d || !d.P || !d.P.clips) { $('resume').hidden = true; return; }
  const pp = PURPOSE[d.P.purpose] || PURPOSE.meet, dt = new Date(d.at);
  $('resume').hidden = false;
  $('resumeInfo').innerHTML = `${pp.ic} <b>${esc(pp.n)}</b> · 장면 ${d.P.clips.length}개 · ${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  $('resumeBtn').onclick = () => resume(d.P);
  $('resumeDel').onclick = async () => { if (!confirm2('이전 작업을 지울까요?')) return; await IDB.clear('f'); await IDB.clear('p'); $('resume').hidden = true; toast('지웠어요'); };
}
function confirm2(m) { return window.confirm(m); }
async function resume(p) {
  busy('이전 작업을 여는 중…');
  try {
    SRC.clear();
    for (const m of p.srcs) { const b = await IDB.get('f', m.id); if (b) { try { await ED.loadSource(m, b); } catch (e) { /* 열 수 없는 파일 */ } } }
    p.clips = p.clips.filter(c => c.kind === 'card' || SRC.has(c.src));
    setP(p); hist = []; hi = -1; SEL = -1; T = 0; showEditor(); commit(); busy('');
    makeThumbs();
  } catch (e) { busy(''); toast('열지 못했어요: ' + e.message, 5000); }
}

/* ═════════ 자료 넣기 ═════════ */
async function addFiles(fs, pos) {
  const pp = PURPOSE[P.purpose], add = [];
  if (pos == null) { pos = P.clips.length; if (P.clips.length && P.clips[P.clips.length - 1].kind === 'card' && P.clips[P.clips.length - 1].card !== 'title') pos--; }
  let n = 0;
  for (const f of fs) {
    n++; busy(`자료 여는 중… ${n} / ${fs.length}`);
    const kind = /^image\//.test(f.type) ? 'image' : /^video\//.test(f.type) ? 'video' : /^audio\//.test(f.type) ? 'audio' : (/\.(mp4|mov|m4v|webm)$/i.test(f.name) ? 'video' : /\.(jpe?g|png|webp|gif|heic)$/i.test(f.name) ? 'image' : null);
    if (!kind || kind === 'audio') continue;
    const id = uid('s'), code = kind === 'image' ? 'P' + (P.nP++) : 'V' + (P.nV++);
    const meta = { id, code, kind, name: f.name, lm: f.lastModified || 0 };
    try {
      const s = await ED.loadSource(meta, f);
      Object.assign(meta, { dur: s.dur, w: s.w, h: s.h });
      P.srcs.push(meta);
      try { await IDB.put('f', id, f); } catch (e) { /* 공간 부족 */ }
      add.push(kind === 'image' ? ED.newClip('image', id, { dur: pp.img }) : ED.newClip('video', id, { in: 0, out: s.dur }));
    } catch (e) { toast(`${f.name}: ${e.message}`, 4000); }
  }
  P.clips.splice(pos, 0, ...add);
  busy(''); if (SEL < 0 && add.length) SEL = pos;
  makeThumbs();
  const long = add.filter(c => c.kind === 'video' && c.out > 60).length;
  if (long) toast(`🎞 긴 동영상이 ${long}개 있어요 · ✂️ 편집에서 필요한 부분만 자르거나 🤖 AI에 맡겨 보세요`, 5000);
  return add.length;
}
async function makeThumbs() {
  for (const c of P.clips) {
    if (c.kind === 'card') continue;
    const s = SRC.get(c.src); if (!s) continue;
    const key = c.src + '@' + (c.kind === 'video' ? Math.round(c.in) : 0);
    if (ED.thumbs.has(key)) continue;
    try { ED.thumbs.set(key, await ED.grabFrame(s, c.kind === 'video' ? Math.min(c.in + .3, s.dur - .1) : 0, 200)); if (!ED.thumbs.has(c.src)) ED.thumbs.set(c.src, ED.thumbs.get(key)); renderTL(); } catch (e) { /* 건너뜀 */ }
  }
}

/* ═════════ 편집 화면 ═════════ */
function showEditor() { $('start').hidden = true; $('editor').hidden = false; document.body.classList.add('editing'); renderAll(); }
function sizeCanvas() {
  const [w, h] = RATIOS[P.ratio], k = 540 / Math.min(w, h), cv = $('cv');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  $('screen').style.aspectRatio = `${w} / ${h}`; $('screen').dataset.r = P.ratio;
  $('ratioLbl').textContent = (PURPOSE[P.purpose] || {}).ic + ' ' + P.ratio;
}
function renderAll() { sizeCanvas(); renderTL(); renderTabs(); renderPanel(); updUndo(); drawNow(); }

/* ── 타임라인 ── */
function renderTL() {
  if (!P) return;
  const { st, total } = timeline(P);
  $('tl').innerHTML = P.clips.map((c, i) => {
    const len = clipLen(c), w = Math.round(clamp(len * 22, 58, 230)), b = [];
    if ((c.cap || {}).t) b.push('💬'); if (c.kind === 'video' && (c.mute || c.vol === 0)) b.push('🔇'); if (c.speed !== 1) b.push(c.speed + '×'); if ((c.efx || []).length) b.push('✨'); if ((c.sfx || []).length) b.push('🔔'); if (c.vo) b.push('🎤'); if ((c.stk || []).length) b.push('😀');
    const lbl = c.kind === 'card' ? (c.card === 'title' ? '🎬 오프닝' : '🏁 엔딩') : (c.kind === 'video' ? '🎞' : '🖼');
    return `<button type="button" class="tli ${c.kind} ${i === SEL ? 'sel' : ''}" data-i="${i}" style="width:${w}px"><span class="th" data-th="${i}"></span><span class="tn">${i + 1}</span><span class="tk">${lbl}</span><span class="td">${len.toFixed(1)}초</span>${b.length ? `<span class="tb">${b.join('')}</span>` : ''}</button>`;
  }).join('') + `<label class="tli addi"><input type="file" id="fAdd2" accept="image/*,video/*" multiple hidden><span>＋<small>자료 더</small></span></label>`;
  $('tl').querySelectorAll('[data-th]').forEach(el => {
    const c = P.clips[+el.dataset.th]; if (c.kind === 'card') return;
    const th = ED.thumbs.get(c.src + '@' + (c.kind === 'video' ? Math.round(c.in) : 0)) || ED.thumbs.get(c.src); if (!th) return;
    const cv = document.createElement('canvas'); cv.width = 90; cv.height = 90; const x = cv.getContext('2d'); const r = ED.coverRect(th.width, th.height, 90, 90, .5, .5); x.drawImage(th, r[0], r[1], r[2], r[3]); el.appendChild(cv);
  });
  $('fAdd2').onchange = async e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (!fs.length) return; const n = await addFiles(fs); commit(); toast(`＋ ${n}개를 넣었어요`); };
  $('tLbl').textContent = `${fmtS(T)} / ${fmtS(total)}`; $('scrub').max = Math.max(.1, total).toFixed(2); $('scrub').value = T.toFixed(2);
  playhead();
}
function playhead() {
  const A = clipAt(P, T), items = $('tl').querySelectorAll('.tli[data-i]'); let ph = $('ph'); if (!ph) { ph = document.createElement('i'); ph.id = 'ph'; }
  const it = items[A.i]; if (!it) { ph.remove(); return; }
  if (ph.parentNode !== $('tl')) $('tl').appendChild(ph);
  ph.style.left = (it.offsetLeft + it.offsetWidth * clamp(A.lt / clipLen(A.c), 0, 1)) + 'px';
}
$('tl').addEventListener('click', e => { const b = e.target.closest('.tli[data-i]'); if (!b) return; const i = +b.dataset.i; select(i, true); });
function select(i, seek) {
  if (PLAY) pause(); SEL = i; SELOV = null; FOCUS = false;
  if (seek && i >= 0) { const { st } = timeline(P); T = st[i] + .02; }
  renderTL(); renderPanel(); drawNow();
  const it = $('tl').querySelector(`.tli[data-i="${i}"]`); if (it) it.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}

/* ═════════ 미리보기 ═════════ */
let drawTok = 0;
async function drawNow() {
  if (!P || PLAY) return;
  const tok = ++drawTok, x = $('cv').getContext('2d'), W = $('cv').width, H = $('cv').height, A = clipAt(P, T);
  if (A.c && A.c.kind === 'video') { const s = SRC.get(A.c.src); if (s) { s.vid.pause(); await ENG.seekVideo(s.vid, srcTime(A.c, A.lt)); } }
  if (tok !== drawTok) return;
  ED.drawFrame(x, W, H, T, { hits: true, still: true }); drawSel(x);
  $('tLbl').textContent = `${fmtS(T)} / ${fmtS(A.total)}`; $('scrub').value = T.toFixed(2); playhead();
}
ED.drawNow = drawNow;
function drawSel(x) {
  if (FOCUS) { x.save(); x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, 0, x.canvas.width, 44); x.fillStyle = '#fff'; x.font = '700 22px sans-serif'; x.textAlign = 'center'; x.fillText('📍 보이게 할 중심을 눌러 주세요', x.canvas.width / 2, 30); x.restore(); }
  if (!SELOV) return; const h = (ED.hits || []).find(q => q.type === SELOV.type && (q.k === SELOV.k || SELOV.type === 'cap')); if (!h) return;
  x.save(); x.setLineDash([10, 6]); x.lineWidth = 3; x.strokeStyle = '#facc15'; x.strokeRect(h.l - 6, h.t - 6, h.w + 12, h.h + 12); x.restore();
}
/* ── 재생 ── */
let mixKey = '', mixBuf = null, asrc = null, acT0 = 0, T0 = 0, raf = 0;
function audioKey() { return JSON.stringify([P.purpose, P.music, P.clipVol, P.clips.map(c => [c.kind, c.src, c.in, c.out, c.dur, c.hold, c.speed, c.vol, c.mute, c.sfx, c.vo])]); }
let mixing = null;
async function getMix(silent) {
  const k = audioKey(); if (k === mixKey && mixBuf) return mixBuf;
  if (mixing && mixing.k === k) { if (!silent) busy('🎵 소리 준비 중…'); try { return await mixing.p; } finally { if (!silent) busy(''); } }
  if (!silent) busy('🎵 소리 준비 중…');
  const job = { k, p: ED.mixAudio(44100) }; mixing = job;
  try { const b = await job.p; if (mixing === job) { mixBuf = b; mixKey = k; } return b; } finally { if (mixing === job) mixing = null; if (!silent) busy(''); }
}
let premixT = 0;
function premix() { clearTimeout(premixT); premixT = setTimeout(() => { if (!PLAY && !exp.busy && P && P.clips.length) getMix(true).catch(() => {}); }, 1500); }
let useAC = true;
const clock = () => useAC ? ED.ac().currentTime : performance.now() / 1000;
async function play() {
  if (PLAY) return pause();
  const ac = ED.ac();  // 누르는 순간 소리 장치를 깨워야 휴대폰에서 소리가 나요
  const { total } = timeline(P); if (total < .2) return;
  if (T >= total - .05) T = 0;
  let ab = null; try { ab = await getMix(); } catch (e) { toast('소리를 준비하지 못했어요 (소리 없이 미리보기)'); }
  await ED.ensureEnds();
  if (ac.state === 'suspended') { try { await Promise.race([ac.resume(), sleep(400)]); } catch (e) { /* 무시 */ } }
  useAC = ac.state === 'running';
  if (ab && useAC) { asrc = ac.createBufferSource(); asrc.buffer = ab; asrc.connect(ac.destination); asrc.start(0, T); }
  else if (ab) toast('🔇 소리가 안 나오면 ▶를 한 번 더 눌러 주세요');
  acT0 = clock(); T0 = T; PLAY = true; $('playBtn').textContent = '⏸'; SELOV = null; loop();
}
function pause() {
  PLAY = false; cancelAnimationFrame(raf); $('playBtn').textContent = '▶';
  try { if (asrc) asrc.stop(); } catch (e) { /* 이미 멈춤 */ } asrc = null;
  for (const s of SRC.values()) if (s.vid) s.vid.pause();
  drawNow();
}
function loop() {
  if (!PLAY) return;
  const t = T0 + (clock() - acT0), { total } = timeline(P);
  if (t >= total) { T = total - .01; pause(); return; }
  T = t; const A = clipAt(P, t);
  let cur = null;
  if (A.c && A.c.kind === 'video') {
    const s = SRC.get(A.c.src); cur = s && s.vid;
    if (cur) {
      const play = (A.c.out - A.c.in) / (A.c.speed || 1), target = srcTime(A.c, A.lt);
      if (A.lt >= play) { if (!cur.paused) cur.pause(); }
      else { cur.playbackRate = A.c.speed || 1; if (cur.paused) cur.play().catch(() => {}); if (Math.abs(cur.currentTime - target) > .3) cur.currentTime = target; }
    }
  }
  const nx = P.clips[A.i + 1];
  if (nx && nx.kind === 'video' && clipLen(A.c) - A.lt < .5) { const s = SRC.get(nx.src); if (s && s.vid !== cur && s.vid.paused && Math.abs(s.vid.currentTime - nx.in) > .2) s.vid.currentTime = nx.in; }
  for (const s of SRC.values()) if (s.vid && s.vid !== cur && !s.vid.paused) s.vid.pause();
  ED.drawFrame($('cv').getContext('2d'), $('cv').width, $('cv').height, t, { hits: true });
  $('tLbl').textContent = `${fmtS(t)} / ${fmtS(total)}`; $('scrub').value = t.toFixed(2); playhead();
  raf = requestAnimationFrame(loop);
}
$('playBtn').addEventListener('click', play);
$('scrub').addEventListener('input', e => { if (PLAY) pause(); T = +e.target.value; const A = clipAt(P, T); if (A.i !== SEL) { SEL = A.i; renderTL(); renderPanel(); } drawNow(); });
$('undoBtn').addEventListener('click', () => undo(-1)); $('redoBtn').addEventListener('click', () => undo(1));

/* ── 미리보기 위에서 끌기 (스티커 · 자막 · 모자이크 · 중심) ── */
let drag = null;
function cvPos(e) { const r = $('cv').getBoundingClientRect(); return [(e.clientX - r.left) * $('cv').width / r.width, (e.clientY - r.top) * $('cv').height / r.height]; }
$('cv').addEventListener('pointerdown', e => {
  if (!P || PLAY) return;
  const [px, py] = cvPos(e), W = $('cv').width, H = $('cv').height, A = clipAt(P, T); if (!A.c) return;
  if (FOCUS) { A.c.fx = clamp(px / W, 0, 1); A.c.fy = clamp(py / H, 0, 1); if (A.c.fit === 'auto' || A.c.fit === 'contain') A.c.fit = 'cover'; FOCUS = false; commit(); renderPanel(); toast('📍 중심을 맞췄어요'); return; }
  const hs = (ED.hits || []).slice().reverse(), h = hs.find(q => px >= q.l - 10 && px <= q.l + q.w + 10 && py >= q.t - 10 && py <= q.t + q.h + 10);
  if (!h) { if (SELOV) { SELOV = null; drawNow(); renderPanel(); } return; }
  SELOV = { type: h.type, k: h.k }; if (A.i !== SEL) { SEL = A.i; renderTL(); }
  const o = h.type === 'cap' ? A.c.cap : h.type === 'stk' ? A.c.stk[h.k] : A.c.blur[h.k];
  drag = { o, type: h.type, sx: px, sy: py, ox: h.type === 'cap' ? ED.capInfo(A.c).x : o.x, oy: h.type === 'cap' ? ED.capInfo(A.c).y : o.y, W, H, moved: false };
  $('cv').setPointerCapture(e.pointerId); e.preventDefault();
  if (h.type === 'cap' && TAB !== 'cap') { TAB = 'cap'; renderTabs(); } else if (h.type !== 'cap' && TAB !== 'stk') { TAB = 'stk'; renderTabs(); }
  renderPanel(); drawNow();
});
$('cv').addEventListener('pointermove', e => {
  if (!drag) return; const [px, py] = cvPos(e), dx = (px - drag.sx) / drag.W, dy = (py - drag.sy) / drag.H;
  if (Math.abs(dx) + Math.abs(dy) > .004) drag.moved = true;
  drag.o.x = clamp(drag.ox + dx, drag.type === 'blur' ? 0 : .05, drag.type === 'blur' ? 1 - (drag.o.w || .1) : .95); drag.o.y = clamp(drag.oy + dy, drag.type === 'blur' ? 0 : .05, drag.type === 'blur' ? 1 - (drag.o.h || .1) : .95);
  const x = $('cv').getContext('2d'); ED.drawFrame(x, drag.W, drag.H, T, { hits: true, still: true }); drawSel(x);
});
$('cv').addEventListener('pointerup', () => { if (drag) { if (drag.moved) commit(); drag = null; } });

/* ═════════ 도구 탭 ═════════ */
const TABS = [['edit', '✂️', '편집'], ['cap', '💬', '자막'], ['stk', '😀', '스티커'], ['fx', '✨', '효과'], ['snd', '🎵', '소리'], ['ai', '🤖', 'AI'], ['info', '🏷', '정보'], ['save', '💾', '저장']];
function renderTabs() { $('tabs').innerHTML = TABS.map(([k, i, n]) => `<button type="button" data-tab="${k}"${pressed(TAB, k)}><span>${i}</span>${n}</button>`).join(''); }
$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; TAB = b.dataset.tab; renderTabs(); renderPanel(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
const cur = () => (SEL >= 0 && SEL < P.clips.length ? P.clips[SEL] : null);
function head(c) {
  if (!c) return `<p class="empty">아래 줄(타임라인)에서 <b>장면을 눌러</b> 골라 주세요.</p>`;
  const k = c.kind === 'card' ? (c.card === 'title' ? '🎬 오프닝 카드' : '🏁 엔딩 카드') : c.kind === 'video' ? '🎞 동영상' : '🖼 사진', s = SRC.get(c.src);
  return `<div class="ph"><b>장면 ${SEL + 1}</b> <span>${k}${s ? ' · ' + esc(s.code) : ''} · ${clipLen(c).toFixed(1)}초</span></div>`;
}
const chips = (key, map, val, extra) => `<div class="chips">${(Array.isArray(map) ? map : Object.entries(map)).map(([k, v]) => `<button type="button" data-a="${key}" data-v="${esc(k)}"${pressed(String(val), String(k))}>${esc(Array.isArray(v) ? v[0] : v)}</button>`).join('')}${extra || ''}</div>`;
const range = (key, val, min, max, step, lbl) => `<label class="rg"><span>${lbl}</span><input type="range" data-a="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${lbl.includes('%') ? Math.round(val * 100) + '%' : (+val).toFixed(step < 1 ? 1 : 0)}</output></label>`;

function renderPanel() {
  if (!P) return;
  const c = cur(), f = { edit: pEdit, cap: pCap, stk: pStk, fx: pFx, snd: pSnd, ai: pAI, info: pInfo, save: pSave }[TAB];
  $('panel').innerHTML = f(c);
  const ta = $('panel').querySelector('textarea[data-auto]'); if (ta) autoGrow(ta);
}
function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(320, t.scrollHeight + 4) + 'px'; }

/* ── ✂️ 편집 ── */
function pEdit(c) {
  let h = head(c);
  if (c) {
    h += `<div class="btns4"><button type="button" data-a="mv" data-v="-1">◀ 앞으로</button><button type="button" data-a="mv" data-v="1">뒤로 ▶</button><button type="button" data-a="dup">📄 복제</button><button type="button" data-a="del" class="dg">🗑 지우기</button></div>`;
    if (c.kind === 'video') {
      const s = SRC.get(c.src), d = s ? s.dur : c.out;
      h += `<div class="grp"><h3>✂️ 자르기 <small>필요한 부분만 남겨요</small></h3>
        <label class="rg"><span>시작</span><input type="range" data-a="in" min="0" max="${d.toFixed(2)}" step="0.05" value="${c.in}"><output>${fmt(c.in)}</output></label>
        <div class="nudge"><button type="button" data-a="nin" data-v="-0.5">−0.5초</button><button type="button" data-a="nin" data-v="-0.1">−0.1</button><button type="button" data-a="nin" data-v="0.1">+0.1</button><button type="button" data-a="nin" data-v="0.5">+0.5초</button></div>
        <label class="rg"><span>끝</span><input type="range" data-a="out" min="0" max="${d.toFixed(2)}" step="0.05" value="${c.out}"><output>${fmt(c.out)}</output></label>
        <div class="nudge"><button type="button" data-a="nout" data-v="-0.5">−0.5초</button><button type="button" data-a="nout" data-v="-0.1">−0.1</button><button type="button" data-a="nout" data-v="0.1">+0.1</button><button type="button" data-a="nout" data-v="0.5">+0.5초</button></div>
        <p class="hint">원본 ${fmt(d)} 중 <b>${fmt(c.out - c.in)}</b> 사용</p>
        <div class="btns2"><button type="button" data-a="split" class="pri">✂️ 지금 위치에서 나누기</button><button type="button" data-a="playclip">▶ 이 장면만 보기</button></div>
        <p class="hint">가운데 필요 없는 부분은: 그 앞에서 한 번, 뒤에서 한 번 <b>나누기</b> → 가운데 조각 <b>🗑 지우기</b></p></div>
       <div class="grp"><h3>⏩ 속도</h3>${chips('speed', [['0.5', '0.5× 느리게'], ['1', '1× 보통'], ['1.5', '1.5×'], ['2', '2× 빠르게'], ['3', '3×']], c.speed)}<p class="hint">속도를 바꾸면 소리 높낮이도 함께 바뀌어요 (재밌는 효과)</p></div>
       <div class="grp"><h3>🔊 원래 소리</h3>${chips('mute', [['0', '🔊 켜기'], ['1', '🔇 끄기']], c.mute ? 1 : 0)}${c.mute ? '' : range('vol', c.vol, 0, 1.5, .05, '크기 %')}</div>
       <div class="grp"><h3>⏸ 마지막 화면 멈춤</h3>${chips('hold', { 0: '없음', 1: '1초', 2: '2초', 3: '3초' }, c.hold || 0)}</div>`;
    } else if (c.kind === 'image') h += `<div class="grp"><h3>⏱ 보여 줄 시간</h3>${range('dur', c.dur, 1, 12, .5, '초')}<button type="button" data-a="alldur" class="sec">모든 사진을 ${c.dur}초로</button></div>`;
    else h += `<div class="grp"><h3>⏱ 카드 시간</h3>${range('dur', c.dur, 2, 12, .5, '초')}<p class="hint">카드 글자는 <b>🏷 정보</b> 탭에서 고쳐요.</p><button type="button" data-a="goinfo" class="sec">🏷 정보 탭 열기</button></div>`;
    if (c.kind !== 'card') h += `<div class="grp"><h3>🖼 화면에 맞추기</h3>${chips('fit', { auto: '자동 (흐린 배경)', cover: '꽉 채우기', contain: '전체 보이기 (검은 배경)' }, c.fit)}<button type="button" data-a="focus" class="sec">📍 ${FOCUS ? '화면을 눌러 주세요…' : '보일 중심 맞추기 (얼굴이 잘릴 때)'}</button></div>`;
    h += `<div class="grp"><h3>🔀 넘어가는 효과 <small>이 장면이 시작될 때</small></h3>${chips('trans', Object.assign({ auto: '추천' }, TRANS), c.trans)}<button type="button" data-a="alltrans" class="sec">모든 장면에 같게</button></div>`;
  }
  h += `<div class="grp"><h3>🗂 전체</h3><div class="btns2"><label class="btnf">＋ 사진 · 동영상 더<input type="file" data-a="addf" accept="image/*,video/*" multiple hidden></label><button type="button" data-a="sortdate">🗓 찍은 날짜 순서로</button></div></div>`;
  return h;
}
/* ── 💬 자막 ── */
function pCap(c) {
  const cd = P.capDef, I = c ? ED.capInfo(c) : null;
  let h = head(c);
  if (c) h += `<div class="grp"><h3>💬 이 장면 자막</h3><textarea data-a="cap" data-auto rows="2" placeholder="예: 그 시절 우리 ㅋㅋ (줄을 바꾸면 두 줄)">${esc(c.cap.t || '')}</textarea>
    <div class="chips"><span class="lbl">위치</span><button type="button" data-a="cy" data-v=".18">⬆ 위</button><button type="button" data-a="cy" data-v=".5">가운데</button><button type="button" data-a="cy" data-v=".82">⬇ 아래</button><button type="button" data-a="cy" data-v="">스타일대로</button></div>
    <p class="hint">미리보기에서 자막을 <b>손가락으로 끌어</b> 옮길 수도 있어요.</p>
    <details class="sub"><summary>이 장면만 다르게 (모양 · 색 · 크기)</summary>${chips('cst', Object.assign({ '': '전체와 같게' }, Object.fromEntries(Object.entries(CAPS).map(([k, v]) => [k, v.n]))), c.cap.style || '')}
     <div class="colors">${['', ...COLORS].map(v => `<button type="button" data-a="ccol" data-v="${v}" style="${v ? 'background:' + v : ''}"${pressed(c.cap.color || '', v)}>${v ? '' : '기본'}</button>`).join('')}</div>${range('csize', c.cap.size || 1, .5, 2, .05, '크기')}</details></div>`;
  h += `<div class="grp"><h3>🎨 전체 자막 모양</h3>${chips('style', Object.fromEntries(Object.entries(CAPS).map(([k, v]) => [k, v.n])), cd.style)}
    <h4>글씨체</h4><div class="chips">${['', ...FONTS].map(id => `<button type="button" data-a="font" data-v="${id}"${pressed(cd.font || '', id)}>${id ? esc(ENG.fontDef(id).label) : '모양에 맞게'}</button>`).join('')}</div>
    <h4>색</h4><div class="colors">${['', ...COLORS].map(v => `<button type="button" data-a="col" data-v="${v}" style="${v ? 'background:' + v : ''}"${pressed(cd.color || '', v)}>${v ? '' : '기본'}</button>`).join('')}</div>
    ${range('size', cd.size || 1, .6, 1.8, .05, '크기')}
    <h4>나타나는 효과</h4>${chips('anim', Object.assign({ '': '모양에 맞게' }, CAP_ANIMS), cd.anim || '')}</div>
   <div class="grp"><h3>📋 한 번에 쓰기</h3><p class="hint">한 줄에 한 장면씩 (오프닝 · 엔딩 카드는 빼고 순서대로 들어가요)</p><textarea id="capAll" rows="4" placeholder="첫 장면 자막&#10;두 번째 장면 자막">${esc(P.clips.filter(x => x.kind !== 'card').map(x => (x.cap.t || '').replace(/\n/g, ' / ')).join('\n'))}</textarea><button type="button" data-a="capall" class="pri">✅ 순서대로 넣기</button></div>`;
  return h;
}
/* ── 😀 스티커 ── */
function pStk(c) {
  let h = head(c); if (!c || c.kind === 'card') return h + (c ? '<p class="empty">카드에는 스티커를 넣을 수 없어요.</p>' : '');
  const B = ED.brand();
  if (SELOV && SELOV.type === 'stk' && c.stk[SELOV.k]) {
    const s = c.stk[SELOV.k];
    h += `<div class="grp selbox"><h3>✋ 고른 스티커</h3>${s.k === 'badge' && s.b !== 'arrow' ? `<input type="text" data-a="sv" value="${esc(s.v || '')}" placeholder="글씨">` : ''}${range('ss', s.s || 1, .4, 3, .05, '크기')}${chips('sa', { pop: '톡', bounce: '통통', float: '둥실', spin: '흔들', none: '그대로' }, s.a || 'pop')}<button type="button" data-a="sdel" class="dg">🗑 이 스티커 지우기</button></div>`;
  } else if (SELOV && SELOV.type === 'blur' && c.blur[SELOV.k]) {
    const b = c.blur[SELOV.k];
    h += `<div class="grp selbox"><h3>🫥 고른 가림 상자</h3>${range('bw', b.w, .05, 1, .01, '가로')}${range('bh', b.h, .05, 1, .01, '세로')}<button type="button" data-a="bdel" class="dg">🗑 이 상자 지우기</button></div>`;
  }
  h += `<p class="hint">넣은 다음 미리보기에서 <b>손가락으로 끌어</b> 옮기고, 눌러서 크기를 바꿔요.</p>
   <div class="grp"><h3>😀 이모지</h3><div class="emo">${EMOJI.map(e => `<button type="button" data-a="emo" data-v="${e}">${e}</button>`).join('')}</div></div>
   <div class="grp"><h3>🏷 글씨 배지</h3><input type="text" id="bdTxt" placeholder="배지에 쓸 글씨 (예: 20% 할인, 아메리카노 4,500원)">${chips('badge', BADGES, '')}
    ${B && B.menu ? `<h4>📋 메뉴로 가격표 넣기</h4><div class="chips">${B.menu.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 20).map(m => `<button type="button" data-a="menu" data-v="${esc(m)}">💰 ${esc(m)}</button>`).join('')}</div>` : ''}</div>
   <div class="grp"><h3>🫥 얼굴 · 번호판 가리기</h3><button type="button" data-a="blur" class="sec">＋ 모자이크 상자 넣기</button><p class="hint">손님 얼굴이 나오면 가려 주세요 (초상권).</p></div>`;
  return h;
}
/* ── ✨ 효과 ── */
function pFx(c) {
  let h = head(c); if (!c) return h;
  if (c.kind !== 'card') {
    h += `<div class="grp"><h3>🎨 색감</h3>${chips('flt', Object.assign({ auto: ['추천'] }, FILTERS), c.filter)}<button type="button" data-a="allflt" class="sec">모든 장면에 같게</button></div>
     <div class="grp"><h3>✨ 화면 효과 <small>여러 개 가능</small></h3><div class="chips">${Object.entries(EFX).map(([k, v]) => `<button type="button" data-a="efx" data-v="${k}"${pressed((c.efx || []).includes(k), true)}>${v}</button>`).join('')}</div></div>`;
    if (c.kind === 'image') h += `<div class="grp"><h3>🎥 사진 움직임</h3>${chips('kb', KB, c.kb)}</div>`;
  }
  const { st } = timeline(P);
  h += `<div class="grp"><h3>🔔 효과음 <small>지금 위치(${fmt(Math.max(0, T - st[SEL]))}초)에 넣어요</small></h3><div class="chips">${Object.entries(SFX).map(([k, v]) => `<button type="button" data-a="sfx" data-v="${k}">${v}</button>`).join('')}</div>
    ${(c.sfx || []).length ? `<ul class="lst">${c.sfx.map((s, i) => `<li>${SFX[s.k] || s.k} · ${(+s.at).toFixed(1)}초 <button type="button" data-a="sfxplay" data-v="${s.k}">▶</button><button type="button" data-a="sfxdel" data-v="${i}">✕</button></li>`).join('')}</ul>` : ''}
    <p class="hint">재생바를 원하는 곳에 두고 누르세요. 소리는 프로그램이 직접 만들어서 저작권 걱정이 없어요.</p></div>`;
  return h;
}
/* ── 🎵 소리 ── */
function pSnd(c) {
  const M = P.music, pp = PURPOSE[P.purpose], L = (g.BKMUSIC && g.BKMUSIC.LIST) || [];
  let h = `<div class="grp"><h3>🎵 배경 음악</h3><div class="chips"><button type="button" data-a="mus" data-v="auto"${pressed(M.kind, 'auto')}>✨ 추천 (${esc(g.BKMUSIC ? g.BKMUSIC.label(pp.mus) : pp.mus)})</button><button type="button" data-a="mus" data-v="none"${pressed(M.kind, 'none')}>🔇 음악 없음</button></div>
    ${L.map(([gn, items]) => `<h4>${esc(gn)}</h4><div class="chips">${items.map(([k, n]) => `<button type="button" data-a="mus" data-v="${k}"${pressed(M.kind, k)}>${esc(n)}</button>`).join('')}</div>`).join('')}
    <h4>내 음악</h4><label class="btnf ${M.kind === 'file' ? 'on' : ''}">📁 내 음악 파일 고르기 ${M.kind === 'file' ? '(넣음)' : ''}<input type="file" data-a="musf" accept="audio/*,.mp3,.m4a,.wav" hidden></label>
    <p class="hint">홍보 영상에는 <b>저작권 걱정 없는 음악</b>만 쓰세요. 기본 음악은 프로그램이 직접 연주해서 괜찮아요.</p>
    ${range('mvol', M.vol, 0, 1.2, .05, '음악 크기 %')}${chips('duck', [['1', '🗣 말소리 나올 때 음악 작게'], ['0', '항상 같은 크기']], M.duck ? 1 : 0)}
    <h4>끝날 때 음악 줄이기</h4>${chips('mfade', [['0', '바로 끝'], ['2.5', '2.5초'], ['5', '5초']], M.fade)}</div>
   <div class="grp"><h3>🎞 동영상 원래 소리 (전체)</h3>${range('cvol', P.clipVol, 0, 1.5, .05, '크기 %')}</div>`;
  h += `<div class="grp"><h3>🎤 내 목소리 넣기 ${c ? `<small>장면 ${SEL + 1}에</small>` : ''}</h3>`;
  if (!c) h += '<p class="empty">장면을 먼저 골라 주세요.</p>';
  else if (c.vo && SRC.get(c.vo.src)) h += `<p>🎤 목소리 ${SRC.get(c.vo.src).dur.toFixed(1)}초</p>${range('vovol', c.vo.vol || 1.2, .3, 2, .05, '목소리 크기 %')}<div class="btns2"><button type="button" data-a="voplay">▶ 들어 보기</button><button type="button" data-a="vodel" class="dg">🗑 지우기</button></div>`;
  else h += `<button type="button" data-a="rec" class="pri" id="recBtn">${REC ? '■ 녹음 멈추기' : '● 녹음 시작'}</button><p class="hint">장면을 설명하는 말, 부모님께 드리는 편지 등을 직접 녹음해 넣어요. 녹음이 나오는 동안 음악은 작아져요.</p>`;
  h += `</div><button type="button" data-a="play" class="pri">▶ 소리까지 미리 듣기</button>`;
  return h;
}
/* ── 🤖 AI ── */
function pAI() {
  const pp = PURPOSE[P.purpose];
  return `<div class="grp"><h3>🤖 AI에게 맡기기</h3><p class="hint" style="margin-top:0">사진 · 영상을 <b>모아보기 그림</b>으로 만들어 ChatGPT · Gemini에 보내면, AI가 장면을 보고 <b>어디를 몇 초 쓸지 · 자막 · 멘트 · 효과</b>를 정해 줘요. 답을 붙여넣으면 자동으로 들어가요.</p>
    ${chips('aimode', { all: '🎬 전부 맡기기 (자르기 · 순서 · 자막)', caps: '💬 자막 · 멘트만 (지금 순서대로)' }, aiMode)}
    <h4>말투</h4>${chips('aitone', { '': `${pp.ic} ${pp.n}에 맞게`, fun: '😂 웃기게', touch: '🥹 감동적으로', ad: '📢 홍보 · 광고', calm: '🙂 담백하게' }, aiTone)}
    ${aiMode === 'all' ? `<h4>영상 길이</h4>${chips('ailen', { '30초': '30초', '1분': '1분', '2분': '2분', '3분': '3분', '알아서': '알아서' }, aiLen)}` : ''}
    <h4>더 알려 줄 것 <small>(안 써도 돼요)</small></h4><textarea id="aiExtra" rows="2" placeholder="예: 2026년 10월 31일 전주 ○○식당 동창회 · 아버지 칠순 잔치 · 신메뉴 출시 이벤트">${esc(aiExtra)}</textarea></div>
   <div class="grp"><h3>① 모아보기 그림 만들기</h3><button type="button" data-a="mksheet" class="pri">🧩 모아보기 그림 만들기</button>
    ${sheets.length ? `<div class="sheets">${sheets.map((s, i) => `<a href="${s.url}" target="_blank"><img src="${s.url}" alt="모아보기 ${i + 1}"></a>`).join('')}</div><p class="hint">그림 ${sheets.length}장 · ${sheets.length > 10 ? '⚠️ AI는 한 번에 10장 정도만 받아요. 길게 찍은 영상은 먼저 잘라 주세요.' : '노란 띠의 「자료 · 시간」을 AI가 읽어요.'}</p>` : ''}</div>
   <div class="grp"><h3>② AI에게 보내기</h3><div class="two"><button type="button" data-a="aisend" data-v="gpt" class="gpt">ChatGPT로 보내기</button><button type="button" data-a="aisend" data-v="gem" class="gem">Gemini로 보내기</button></div>
    ${aiMode === 'all' && P.srcs.some(s => s.kind === 'video') ? '<button type="button" data-a="aigemv" class="sec">🎞 Gemini에 동영상을 그대로 보내기 (소리까지 듣고 골라요)</button>' : ''}
    <p class="hint">버튼을 누르면 <b>요청서가 복사</b>되고 그림을 보낼 곳이 열려요 → AI 앱에서 그림을 올리고 글 칸을 <b>길게 눌러 붙여넣기</b> → 보내기</p>
    <details class="sub"><summary>요청서 보기</summary><pre class="pre">${esc(aiPrompt(false))}</pre><button type="button" data-a="aicopy" class="sec">📋 요청서만 복사</button></details></div>
   <div class="grp"><h3>③ AI 답 붙여넣기</h3><textarea id="aiAns" rows="5" placeholder="장면|자료|시작초|끝초|자막|효과|효과음&#10;1|P3|0|4|그 시절 우리|확대|"></textarea>
    <div class="two"><button type="button" data-a="aipaste" class="sec">📋 붙여넣기</button><button type="button" data-a="aiapply" class="pri">✅ 영상에 넣기</button></div><p class="hint">넣은 다음에도 ✂️ 편집 · 💬 자막에서 마음대로 고칠 수 있어요. 마음에 안 들면 ↩️ 되돌리기.</p></div>`;
}
const TONES = { fun: '배꼽 잡게 웃긴 예능 자막 말투', touch: '마음이 뭉클해지는 감동적인 말투', ad: '사고 싶고 가고 싶어지는 광고 문구 말투', calm: '담백하고 깔끔한 말투' };
function aiPrompt(gemVideo) {
  const pp = PURPOSE[P.purpose], B = ED.brand(), tone = aiTone ? TONES[aiTone] : pp.tone, ratio = RATIOS[P.ratio][2];
  const L = ['[BK쇼츠 영상 편집 요청]'];
  const fxList = '확대, 흔들림, 번쩍, 느리게, 빠르게, 멈춤, 흑백, 옛날필름, 하트, 꽃가루, 눈, 꽃잎', sfxList = '박수, 띠용, 뿅, 두둥, 딩동댕, 땡, 휙, 짜잔, 찰칵, 두구두구, 반짝, 두근';
  if (aiMode === 'caps') {
    L.push('첨부한 그림은 지금 만든 영상의 장면들(C1, C2 …)이에요. 장면 순서와 길이는 그대로 두고, 장면마다 자막과 효과만 정해 주세요.', '');
    L.push('장면 목록:'); P.clips.forEach((c, i) => L.push(`C${i + 1} · ${c.kind === 'card' ? (c.card === 'title' ? '오프닝 제목 카드' : '엔딩 카드') : c.kind === 'video' ? '동영상' : '사진'} · ${clipLen(c).toFixed(1)}초`));
  } else {
    L.push(gemVideo ? '첨부한 동영상(V1, V2 … 순서)과 사진(P1, P2 …)을 보고 소리까지 들어서' : '첨부한 모아보기 그림은 제 사진(P1, P2 …)과 동영상(V1, V2 …)의 장면이에요. 각 칸 아래 노란 띠에 「자료 번호 · 시간」이 적혀 있어요. 이것을 보고', '재미있고 보기 좋은 영상으로 편집해 주세요.', '');
    L.push('자료 목록:'); P.srcs.filter(s => s.kind !== 'audio').forEach(s => L.push(`${s.code} · ${s.kind === 'video' ? '동영상 (전체 ' + fmtS(s.dur) + ')' : '사진'}`));
  }
  L.push('', `만들 영상: ${pp.ic} ${pp.n} · ${ratio}${aiMode === 'all' ? ' · 길이 약 ' + aiLen : ''}`, `말투 · 분위기: ${tone}`);
  if (aiMode === 'all') L.push(`장면 순서 추천: ${pp.plan}`);
  if (aiExtra.trim()) L.push(`참고: ${aiExtra.trim()}`);
  if (pp.biz && B) L.push(`가게 · 회사 정보: ${[B.name, B.biz, B.slogan, B.menu && ('메뉴/상품: ' + B.menu.replace(/\n/g, ', ')), B.addr && ('주소: ' + B.addr), B.hours && ('영업: ' + B.hours), B.event && ('이벤트: ' + B.event)].filter(Boolean).join(' / ')}`);
  L.push('', '규칙');
  if (aiMode === 'all') L.push('- 사진은 3~5초, 동영상은 재미있거나 의미 있는 부분만 골라 2~8초씩', '- 같은 동영상을 여러 구간으로 나눠 써도 돼요. 흐릿하거나 흔들린 장면은 빼 주세요', '- 사진은 시작초를 0, 끝초를 「보여 줄 초」로 써 주세요');
  L.push('- 자막은 한 줄 15자 안팎, 길면 두 줄까지. 모르는 사람 이름은 지어내지 마세요', `- 효과는 이 중에서만 (없으면 비워 두기): ${fxList}`, `- 효과음은 이 중에서만 (없으면 비워 두기): ${sfxList}`, '- 인사말이나 설명 없이 아래 형식의 줄만 써 주세요', '', '형식');
  if (aiMode === 'caps') L.push('제목|오프닝 카드에 쓸 제목', 'C1|자막|효과|효과음', 'C2|자막|효과|효과음', '엔딩|마지막 카드 문구');
  else L.push('제목|영상 제목', '장면|자료|시작초|끝초|자막|효과|효과음', '1|P3|0|4|그 시절 우리|확대|', '2|V1|12|18|이 표정 실화냐ㅋㅋ|흔들림|띠용', '엔딩|마지막 카드 문구', '음악|잔잔한 · 신나는 · 감동 · 귀여운 · 웅장한 · 감성 중 하나');
  return L.join('\n');
}
const FXMAP = [[/확대|줌/, c => add(c, 'punch')], [/흔들/, c => add(c, 'shake')], [/번쩍|플래시/, c => add(c, 'flash')], [/느리|슬로/, c => { if (c.kind === 'video') c.speed = .5; }], [/빠르/, c => { if (c.kind === 'video') c.speed = 2; }], [/멈춤|정지/, c => { if (c.kind === 'video') c.hold = 1.5; }], [/흑백/, c => { c.filter = 'bw'; }], [/옛날|필름/, c => { add(c, 'grain'); c.filter = 'old'; }], [/하트/, c => add(c, 'heart')], [/꽃가루|축하/, c => add(c, 'confetti')], [/^눈|눈 ?내/, c => add(c, 'snow')], [/꽃잎|벚꽃/, c => add(c, 'petal')]];
function add(c, k) { c.efx = c.efx || []; if (!c.efx.includes(k)) c.efx.push(k); }
const SFXMAP = [[/박수/, 'clap'], [/띠용/, 'boing'], [/뿅/, 'pop'], [/두둥/, 'dun'], [/딩동/, 'ding'], [/땡/, 'buzz'], [/휙/, 'whoosh'], [/짜잔/, 'tada'], [/찰칵/, 'shutter'], [/두구/, 'roll'], [/반짝/, 'sparkle'], [/두근/, 'heart']];
const MOOD = [[/잔잔|차분/, 'piano'], [/감동|웅장/, 'strings'], [/신나|경쾌|밝/, 'pop'], [/귀여/, 'bells'], [/감성|여행|로파이/, 'lofi'], [/기타/, 'guitar']];
function secs(v) { v = String(v || '').replace(/초/g, '').trim(); if (!v) return NaN; if (v.includes(':')) return v.split(':').reduce((a, p) => a * 60 + parseFloat(p), 0); return parseFloat(v); }
function aiApply(text) {
  const pp = PURPOSE[P.purpose], lines = String(text || '').replace(/```[a-z]*/gi, '').split(/\r?\n/).map(l => l.trim().replace(/^[-*•]\s*/, '')).filter(l => l.includes('|'));
  if (!lines.length) return toast('읽을 줄이 없어요. 「장면|자료|시작초|끝초|자막|효과|효과음」 모양인지 확인해 주세요', 5000);
  const scenes = []; let n = 0;
  for (const l of lines) {
    const f = l.replace(/^\|/, '').replace(/\|$/, '').split('|').map(s => s.trim()), k0 = f[0];
    if (/^제목/.test(k0)) { P.info.title = f[1] || P.info.title; continue; }
    if (/^부제/.test(k0)) { P.info.sub = f[1] || ''; continue; }
    if (/^엔딩/.test(k0)) { P.info.ending = f[1] || P.info.ending; continue; }
    if (/^음악/.test(k0)) { const m = MOOD.find(([r]) => r.test(f[1] || '')); if (m) P.music.kind = m[1]; continue; }
    if (/^장면$/.test(k0)) continue;
    if (aiMode === 'caps') {
      const m = k0.match(/^C\s*(\d+)/i); if (!m) continue; const c = P.clips[+m[1] - 1]; if (!c) continue;
      c.cap.t = f[1] || ''; applyFx(c, f[2]); applySfx(c, f[3]); n++;
    } else {
      const code = (f[1] || '').toUpperCase().match(/[PV]\d+/); if (!code) continue;
      const s = P.srcs.find(x => x.code === code[0]); if (!s) continue;
      let a = secs(f[2]), b = secs(f[3]); const c = ED.newClip(s.kind, s.id);
      if (s.kind === 'image') c.dur = clamp(b > 0 ? b - (a > 0 && a < b ? a : 0) : pp.img, 1.5, 10);
      else { a = clamp(isNaN(a) ? 0 : a, 0, Math.max(0, s.dur - .3)); b = isNaN(b) || b <= a ? Math.min(s.dur, a + 4) : Math.min(s.dur, b); if (b - a < .4) b = Math.min(s.dur, a + .4); c.in = a; c.out = b; }
      c.cap.t = (f[4] || '').replace(/\\n|\/\s/g, '\n'); applyFx(c, f[5]); applySfx(c, f[6]); scenes.push(c);
    }
  }
  if (aiMode === 'all') {
    if (!scenes.length) return toast('장면 줄을 찾지 못했어요. 자료 번호(P1 · V1)가 있는지 확인해 주세요', 5000);
    const first = P.clips[0] && P.clips[0].kind === 'card' && P.clips[0].card === 'title' ? P.clips[0] : null, last = P.clips.length && P.clips[P.clips.length - 1].kind === 'card' && P.clips[P.clips.length - 1].card !== 'title' ? P.clips[P.clips.length - 1] : null;
    P.clips = [first, ...scenes, last].filter(Boolean); n = scenes.length;
  }
  SEL = -1; T = 0; commit(); renderPanel(); makeThumbs();
  toast(`🤖 ${n}개 장면에 넣었어요 · ▶ 눌러 보세요 (마음에 안 들면 ↩️)`, 4500);
}
function applyFx(c, s) { if (!s) return; for (const [r, fn] of FXMAP) if (r.test(s)) fn(c); }
function applySfx(c, s) { if (!s) return; const m = SFXMAP.find(([r]) => r.test(s)); if (m) { c.sfx = c.sfx || []; c.sfx.push({ k: m[1], at: .2 }); } }
/* ── 🏷 정보 ── */
const BF = [['name', '이름 (상호 · 회사)', '예: 비케이 커피'], ['slogan', '한 줄 소개', '예: 매일 아침 직접 볶는 커피'], ['biz', '업종', '예: 카페 · 보험 상담'], ['menu', '대표 메뉴 · 상품 · 가격 (한 줄에 하나)', '아메리카노 4,500원\n수제 케이크 6,500원'], ['addr', '주소', '예: 전주시 완산구 ○○로 12'], ['hours', '영업시간', '예: 매일 10:00~21:00 (월 휴무)'], ['phone', '전화', '예: 063-123-4567'], ['parking', '주차', '예: 건물 뒤 주차 가능'], ['event', '이벤트 · 쿠폰', '예: 오픈 기념 전 메뉴 20% 할인'], ['link', '링크 (지도 · 예약 · 홈페이지) → 엔딩에 QR', 'https://naver.me/…']];
function pInfo() {
  const pp = PURPOSE[P.purpose], I = P.info, B = ED.brand(), BL = ED.brands();
  const hasT = P.clips.some(c => c.kind === 'card' && c.card === 'title'), endC = P.clips.find(c => c.kind === 'card' && c.card !== 'title');
  let h = `<div class="grp"><h3>${pp.ic} 이 영상: ${esc(pp.n)}</h3><details class="sub"><summary>목적 바꾸기</summary><div class="chips">${Object.entries(PURPOSE).map(([k, v]) => `<button type="button" data-a="purp" data-v="${k}"${pressed(P.purpose, k)}>${v.ic} ${esc(v.n)}</button>`).join('')}</div></details>
    <h4>화면 모양</h4>${chips('ratio', Object.fromEntries(Object.entries(RATIOS).map(([k, v]) => [k, v[2]])), P.ratio)}</div>
   <div class="grp"><h3>🎬 오프닝 · 🏁 엔딩 글자</h3>
    <label class="fl">제목<input type="text" data-a="it" data-v="title" value="${esc(I.title)}" placeholder="${esc(pp.biz && B ? B.name : '예: 2026 전주초 52회 동창회')}"></label>
    <label class="fl">부제 (날짜 · 장소)<input type="text" data-a="it" data-v="sub" value="${esc(I.sub)}" placeholder="예: 2026. 10. 31 · 전주 ○○식당"></label>
    <label class="fl">엔딩 문구<textarea data-a="it" data-v="ending" rows="2" placeholder="${esc(pp.end === 'memorial' ? '보고 싶습니다. 사랑합니다.' : '함께해 주셔서 감사합니다')}">${esc(I.ending)}</textarea></label>
    ${(endC && endC.card === 'credits') || pp.end === 'credits' ? `<label class="fl">함께한 사람들 (쉼표로) → 엔딩에 올라가요<textarea data-a="it" data-v="names" rows="2" placeholder="홍길동, 김철수, 이영희">${esc(I.names)}</textarea></label>` : ''}
    <div class="btns2"><button type="button" data-a="tcard">${hasT ? '🎬 오프닝 빼기' : '🎬 오프닝 넣기'}</button><button type="button" data-a="ecard">${endC ? '🏁 엔딩 빼기' : '🏁 엔딩 넣기'}</button></div>
    ${endC ? `<h4>엔딩 모양</h4>${chips('etype', { credits: '🎞 이름 올라가기', memorial: '🕊 추모 문구', simple: '💌 감사 문구', store: '🏪 가게 정보 + QR', company: '🏢 회사 · 연락처' }, endC.card)}` : ''}</div>`;
  h += `<div class="grp"><h3>🏪 가게 · 회사 정보 <small>(브랜드 키트 · 저장해서 다시 써요)</small></h3>
    <div class="chips">${BL.map(b => `<button type="button" data-a="bsel" data-v="${b.id}"${pressed(I.brandId, b.id)}>${esc(b.name || '이름 없음')}</button>`).join('')}<button type="button" data-a="bnew">＋ 새로 만들기</button>${I.brandId ? '<button type="button" data-a="bsel" data-v="">안 씀</button>' : ''}</div>`;
  if (B) {
    h += BF.map(([k, l, ph]) => `<label class="fl">${l}${k === 'menu' ? `<textarea data-a="bf" data-v="${k}" rows="3" placeholder="${esc(ph)}">${esc(B[k] || '')}</textarea>` : `<input type="text" data-a="bf" data-v="${k}" value="${esc(B[k] || '')}" placeholder="${esc(ph)}">`}</label>`).join('');
    h += `<label class="fl">대표 색<input type="color" data-a="bf" data-v="color" value="${esc(B.color || '#174782')}"></label>
     <div class="logo">${B.logo ? `<img src="${B.logo}" alt="로고">` : ''}<label class="btnf">🖼 로고 ${B.logo ? '바꾸기' : '넣기'}<input type="file" data-a="logo" accept="image/*" hidden></label>${B.logo ? '<button type="button" data-a="nologo" class="sec">로고 빼기</button>' : ''}</div>
     ${chips('wm', [['1', '로고를 화면 구석에 계속 보이기'], ['0', '안 보이기']], P.wm ? 1 : 0)}
     <button type="button" data-a="bdel" class="dg">🗑 이 가게 정보 지우기</button>`;
  } else h += `<p class="hint">가게 홍보 · 회사 소개 영상이면 정보를 넣어 두세요. 엔딩 카드에 주소 · 전화 · QR이 자동으로 들어가고, AI 요청서에도 함께 들어가요.</p>`;
  return h + '</div>';
}
/* ── 💾 저장 ── */
let exp = { ratios: null, q: 1080, busy: false, ctl: null };
function pSave() {
  if (!exp.ratios) exp.ratios = [P.ratio];
  const { total } = timeline(P), pp = PURPOSE[P.purpose], B = ED.brand();
  let h = `<div class="grp"><h3>🎬 MP4 영상 만들기</h3><p class="hint" style="margin-top:0">길이 ${fmtS(total)} · 장면 ${P.clips.length}개</p>
    <h4>화면 모양 <small>(여러 개 고르면 차례로 만들어요)</small></h4><div class="chips">${Object.entries(RATIOS).map(([k, v]) => `<button type="button" data-a="xr" data-v="${k}"${pressed(exp.ratios.includes(k), true)}>${v[2]}</button>`).join('')}</div>
    <h4>화질</h4>${chips('xq', [['1080', '1080 (선명)'], ['720', '720 (빠르게 · 오래된 휴대폰)']], exp.q)}
    <button type="button" data-a="export" class="pri big" ${exp.busy ? 'disabled' : ''}>${exp.busy ? '⏳ 만드는 중…' : '🎬 영상 만들기'}</button>
    <div id="xprog" ${exp.busy ? '' : 'hidden'}><div class="bar"><i id="xbar"></i></div><p class="hint" id="xtxt"></p><button type="button" data-a="xstop" class="sec">취소</button></div>
    <p class="hint">만드는 동안 <b>화면을 켜 두고</b> 다른 앱으로 넘어가지 마세요. 1분 영상에 보통 1~3분 걸려요.</p>
    ${results.length ? `<ul class="res">${results.map((r, i) => `<li><b>${esc(r.name)}</b> <small>${(r.blob.size / 1048576).toFixed(1)}MB${r.warning ? ' · ⚠️ ' + esc(r.warning) : ''}</small><div class="two"><button type="button" data-a="rdl" data-v="${i}" class="pri">💾 휴대폰에 저장</button><button type="button" data-a="rsh" data-v="${i}" class="sec">📤 보내기</button></div></li>`).join('')}</ul>` : ''}</div>
   <div class="grp"><h3>📝 블로그 · 유튜브에 올릴 것</h3>
    <label class="fl">대표 이미지 제목<input type="text" id="thTitle" value="${esc(P.info.title || (B && B.name) || '')}" placeholder="예: 전주 신상 카페 솔직 후기"></label>
    <button type="button" data-a="thumb" class="sec">🖼 대표 이미지 만들기 (지금 화면 · 가로)</button>
    <button type="button" data-a="srt" class="sec">📄 자막 파일(SRT) 받기</button>
    <button type="button" data-a="blog" class="sec">✍️ 블로그 글 요청서 복사 → ChatGPT</button>
    <p class="hint">블로그에는 <b>가로(16:9)</b> 영상이 잘 맞고, 쇼츠 · 릴스에는 세로 영상을 올려요.</p></div>
   <div class="grp"><h3>🗂 작업</h3><p class="hint" style="margin-top:0">작업은 이 휴대폰에 자동으로 저장돼서, 다음에 「이어서 하기」로 열 수 있어요.</p><button type="button" data-a="newproj" class="dg">🆕 새 영상 시작하기 (지금 작업 지우기)</button></div>`;
  return h;
}

/* ═════════ 패널 동작 ═════════ */
function giveFile(blob, name, share) {
  if (share) { try { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], title: name }).catch(() => {}); } catch (e) { /* 아래로 */ } toast('바로 보내기가 안 돼서 저장했어요'); }
  const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000);
  toast('💾 저장했어요 · 내 파일 → 다운로드 · ' + name, 5000);
}
async function copy(t) { try { await navigator.clipboard.writeText(t); return true; } catch (e) { const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (er) { /* 실패 */ } a.remove(); return ok; } }
const stamp = () => { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`; };
let REC = null;
$('panel').addEventListener('input', e => {
  const el = e.target, a = el.dataset.a, c = cur(); if (!a) { if (el.id === 'aiExtra') aiExtra = el.value; return; }
  const v = el.value, out = el.parentNode.querySelector('output');
  if (el.type === 'range' && out) out.textContent = (el.closest('.rg').querySelector('span').textContent.includes('%') ? Math.round(v * 100) + '%' : (+v).toFixed(+el.step < 1 ? (a === 'in' || a === 'out' ? 2 : 1) : 0));
  if (a === 'cap' && c) { c.cap.t = v; autoGrow(el); drawNow(); return; }
  if (a === 'in' && c) { c.in = Math.min(+v, c.out - .2); out.textContent = fmt(c.in); T = timeline(P).st[SEL] + .01; drawNow(); return; }
  if (a === 'out' && c) { c.out = Math.max(+v, c.in + .2); out.textContent = fmt(c.out); T = timeline(P).st[SEL] + clipLen(c) - (c.hold || 0) - .05; drawNow(); return; }
  if (a === 'dur' && c) { c.dur = +v; drawNow(); return; }
  if (a === 'vol' && c) { c.vol = +v; return; } if (a === 'mvol') { P.music.vol = +v; return; } if (a === 'cvol') { P.clipVol = +v; return; } if (a === 'vovol' && c && c.vo) { c.vo.vol = +v; return; }
  if (a === 'size') { P.capDef.size = +v; drawNow(); return; } if (a === 'csize' && c) { c.cap.size = +v; drawNow(); return; }
  if (a === 'ss' && c && SELOV) { c.stk[SELOV.k].s = +v; drawNow(); return; } if (a === 'sv' && c && SELOV) { c.stk[SELOV.k].v = v; drawNow(); return; }
  if ((a === 'bw' || a === 'bh') && c && SELOV) { c.blur[SELOV.k][a === 'bw' ? 'w' : 'h'] = +v; drawNow(); return; }
  if (a === 'it') { P.info[el.dataset.v] = v; drawNow(); return; }
  if (a === 'bf') { const L = ED.brands(), b = L.find(x => x.id === P.info.brandId); if (b) { b[el.dataset.v] = v; ED.saveBrands(L); drawNow(); } return; }
});
$('panel').addEventListener('change', async e => {
  const el = e.target, a = el.dataset.a, c = cur(); if (!a) return;
  if (el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'color') { if (a === 'in' || a === 'out') makeThumbs(); commit(); if (a === 'in' || a === 'out' || a === 'dur') renderPanel(); return; }
  if (el.type === 'file') {
    const fs = Array.from(el.files || []); el.value = ''; if (!fs.length) return;
    if (a === 'addf') { const n = await addFiles(fs); commit(); renderPanel(); toast(`＋ ${n}개를 넣었어요`); }
    if (a === 'musf') { const f = fs[0], id = uid('s'), meta = { id, code: 'A' + (P.nA++), kind: 'audio', name: f.name }; busy('음악 여는 중…'); const s = await ED.loadSource(meta, f); busy(''); if (!s.buf) return toast('음악 파일을 열 수 없어요 (MP3 · M4A 권장)'); meta.dur = s.dur; P.srcs.push(meta); try { await IDB.put('f', id, f); } catch (er) { /* 공간 */ } P.music.kind = 'file'; P.music.fileId = id; commit(); renderPanel(); toast('🎵 내 음악을 넣었어요'); }
    if (a === 'logo') { const f = fs[0], url = URL.createObjectURL(f), im = await ENG.loadImage(url), k = Math.min(1, 360 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); const L = ED.brands(), b = L.find(x => x.id === P.info.brandId); if (b) { b.logo = cv.toDataURL('image/png'); ED.saveBrands(L); } commit(); renderPanel(); }
  }
});
$('panel').addEventListener('click', async e => {
  const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'TEXTAREA') return;
  const a = b.dataset.a, v = b.dataset.v, c = cur(), { st } = timeline(P);
  const re = (noHist) => { commit(noHist); renderPanel(); };
  switch (a) {
    case 'mv': { const j = SEL + +v; if (!c || j < 0 || j >= P.clips.length) return; P.clips.splice(SEL, 1); P.clips.splice(j, 0, c); SEL = j; return re(); }
    case 'dup': { if (!c) return; const d = JSON.parse(JSON.stringify(c)); d.id = uid('c'); P.clips.splice(SEL + 1, 0, d); SEL++; return re(); }
    case 'del': { if (!c) return; P.clips.splice(SEL, 1); SEL = Math.min(SEL, P.clips.length - 1); T = Math.min(T, timeline(P).total); toast('🗑 지웠어요 (↩️ 되돌리기 가능)'); return re(); }
    case 'nin': if (c) { c.in = clamp(c.in + +v, 0, c.out - .2); T = st[SEL] + .01; makeThumbs(); return re(); } return;
    case 'nout': if (c) { const s = SRC.get(c.src); c.out = clamp(c.out + +v, c.in + .2, s ? s.dur : c.out); T = timeline(P).st[SEL] + clipLen(c) - (c.hold || 0) - .05; return re(); } return;
    case 'split': {
      if (!c || c.kind === 'card') return; const lt = T - st[SEL];
      if (lt < .15 || lt > clipLen(c) - .15) return toast('재생바를 이 장면 <안쪽>에 두고 눌러 주세요 (위 재생바로 옮겨요)', 4000);
      const d = JSON.parse(JSON.stringify(c)); d.id = uid('c'); d.cap = { t: '' }; d.stk = []; d.blur = JSON.parse(JSON.stringify(c.blur || [])); d.vo = null;
      if (c.kind === 'video') { const cut = srcTime(c, lt); d.in = cut; c.out = cut; d.hold = c.hold; c.hold = 0; } else { d.dur = c.dur - lt; c.dur = lt; }
      d.sfx = (c.sfx || []).filter(s => s.at >= lt).map(s => ({ k: s.k, at: s.at - lt })); c.sfx = (c.sfx || []).filter(s => s.at < lt); d.trans = 'cut';
      P.clips.splice(SEL + 1, 0, d); SEL++; makeThumbs(); toast('✂️ 나눴어요 · 필요 없는 조각은 🗑 지우기'); return re();
    }
    case 'playclip': { T = st[SEL] + .01; play(); setTimeout(function chk() { if (!PLAY) return; if (T >= st[SEL] + clipLen(c) - .05) return pause(); setTimeout(chk, 80); }, 80); return; }
    case 'speed': if (c) { c.speed = +v; return re(); } return;
    case 'mute': if (c) { c.mute = +v; return re(); } return;
    case 'hold': if (c) { c.hold = +v; return re(); } return;
    case 'alldur': P.clips.forEach(x => { if (x.kind === 'image') x.dur = c.dur; }); toast('모든 사진 길이를 맞췄어요'); return re();
    case 'goinfo': TAB = 'info'; renderTabs(); return renderPanel();
    case 'fit': if (c) { c.fit = v; return re(); } return;
    case 'focus': FOCUS = !FOCUS; drawNow(); return renderPanel();
    case 'trans': if (c) { c.trans = v; return re(); } return;
    case 'alltrans': P.clips.forEach((x, i) => { if (i) x.trans = c.trans; }); toast('모든 장면에 같게 했어요'); return re();
    case 'sortdate': { const lm = id => (P.srcs.find(s => s.id === id) || {}).lm || 0, first = P.clips[0] && P.clips[0].card === 'title' ? [P.clips[0]] : [], last = P.clips.length && P.clips[P.clips.length - 1].kind === 'card' && P.clips[P.clips.length - 1].card !== 'title' ? [P.clips[P.clips.length - 1]] : [], mid = P.clips.filter(x => !first.includes(x) && !last.includes(x)).sort((p, q) => lm(p.src) - lm(q.src)); P.clips = [...first, ...mid, ...last]; toast('🗓 찍은(저장된) 날짜 순서로 놓았어요'); return re(); }
    case 'cy': if (c) { c.cap.y = v === '' ? null : +v; c.cap.x = v === '' ? null : .5; return re(); } return;
    case 'cst': if (c) { c.cap.style = v || null; return re(); } return;
    case 'ccol': if (c) { c.cap.color = v || null; return re(); } return;
    case 'style': P.capDef.style = v; P.clips.forEach(x => { x.cap.style = null; }); ED.loadFonts([CAPS[v].font], '가나다').then(drawNow); return re();
    case 'font': P.capDef.font = v; busy('글씨체 불러오는 중…'); await ED.loadFonts([v || CAPS[P.capDef.style].font], P.clips.map(x => x.cap.t || '').join('') + '가나다'); busy(''); return re();
    case 'col': P.capDef.color = v; return re();
    case 'anim': P.capDef.anim = v; return re();
    case 'capall': { const L = $('capAll').value.split('\n'); let k = 0; P.clips.forEach(x => { if (x.kind === 'card') return; if (k < L.length) x.cap.t = L[k].replace(/\s\/\s/g, '\n').trim(); k++; }); toast('✅ 순서대로 넣었어요'); return re(); }
    case 'emo': if (c && c.kind !== 'card') { c.stk.push({ k: 'emoji', v, x: .5 + (Math.random() - .5) * .2, y: .4 + (Math.random() - .5) * .2, s: 1, a: 'pop' }); SELOV = { type: 'stk', k: c.stk.length - 1 }; return re(); } return toast('장면을 먼저 골라 주세요');
    case 'badge': case 'menu': {
      if (!c || c.kind === 'card') return toast('장면을 먼저 골라 주세요');
      const B = ED.brand(), tv = ($('bdTxt') || {}).value || '';
      let txt = a === 'menu' ? v : tv || ({ pin: B && B.addr, phone: B && B.phone, qr: B && B.link, sale: B && B.event }[v]) || '';
      c.stk.push({ k: 'badge', b: a === 'menu' ? 'price' : v, v: txt, x: .5, y: a === 'menu' || v === 'price' ? .7 : .35, s: v === 'qr' ? .9 : 1, a: 'pop' }); SELOV = { type: 'stk', k: c.stk.length - 1 }; return re();
    }
    case 'sa': if (c && SELOV) { c.stk[SELOV.k].a = v; return re(); } return;
    case 'sdel': if (c && SELOV) { c.stk.splice(SELOV.k, 1); SELOV = null; return re(); } return;
    case 'blur': if (c && c.kind !== 'card') { c.blur.push({ x: .35, y: .25, w: .3, h: .22 }); SELOV = { type: 'blur', k: c.blur.length - 1 }; return re(); } return;
    case 'bdel': if (b.closest('.selbox')) { if (c && SELOV) { c.blur.splice(SELOV.k, 1); SELOV = null; return re(); } return; }
      if (!confirm2('이 가게 정보를 지울까요?')) return; ED.saveBrands(ED.brands().filter(x => x.id !== P.info.brandId)); P.info.brandId = null; return re();
    case 'flt': if (c) { c.filter = v; return re(); } return;
    case 'allflt': P.clips.forEach(x => { x.filter = c.filter; }); toast('모든 장면에 같게 했어요'); return re();
    case 'efx': if (c) { c.efx = c.efx || []; const i = c.efx.indexOf(v); if (i >= 0) c.efx.splice(i, 1); else c.efx.push(v); return re(); } return;
    case 'kb': if (c) { c.kb = v; return re(); } return;
    case 'sfx': if (c) { const at = clamp(T - st[SEL], 0, clipLen(c) - .1); c.sfx = c.sfx || []; c.sfx.push({ k: v, at: +at.toFixed(2) }); ED.sfxPreview(v); toast(`${SFX[v]} 넣었어요`); return re(); } return;
    case 'sfxplay': return ED.sfxPreview(v);
    case 'sfxdel': if (c) { c.sfx.splice(+v, 1); return re(); } return;
    case 'mus': P.music.kind = v; return re();
    case 'duck': P.music.duck = +v; return re();
    case 'mfade': P.music.fade = +v; return re();
    case 'play': return play();
    case 'rec': return rec();
    case 'voplay': { const s = c && c.vo && SRC.get(c.vo.src); if (s && s.buf) { const ac = ED.ac(), n = ac.createBufferSource(); n.buffer = s.buf; n.connect(ac.destination); n.start(); } return; }
    case 'vodel': if (c) { c.vo = null; return re(); } return;
    case 'aimode': aiMode = v; return renderPanel(); case 'aitone': aiTone = v; return renderPanel(); case 'ailen': aiLen = v; return renderPanel();
    case 'mksheet': { busy('🧩 모아보기 그림 만드는 중…'); try { sheets.forEach(s => URL.revokeObjectURL(s.url)); sheets = await ED.contactSheets(aiMode === 'caps' ? 'clips' : 'all'); } catch (er) { toast('그림을 만들지 못했어요: ' + er.message, 5000); } busy(''); return renderPanel(); }
    case 'aisend': {
      if (!sheets.length) { busy('🧩 모아보기 그림 만드는 중…'); sheets = await ED.contactSheets(aiMode === 'caps' ? 'clips' : 'all'); busy(''); renderPanel(); }
      const text = aiPrompt(false); await copy(text);
      const files = sheets.map((s, i) => new File([s.blob], `모아보기_${i + 1}.jpg`, { type: 'image/jpeg' }));
      try { if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); toast('📋 요청서도 복사해 뒀어요 · AI 앱 글 칸에 붙여넣기', 6000); return; } } catch (er) { if (er && er.name === 'AbortError') return; }
      sheets.forEach((s, i) => giveFile(s.blob, `모아보기_${i + 1}.jpg`)); window.open(v === 'gem' ? 'https://gemini.google.com/app' : 'https://chatgpt.com/', '_blank', 'noopener');
      return toast('📋 요청서를 복사했어요 · 받은 그림을 AI에 올리고 붙여넣기 하세요', 7000);
    }
    case 'aigemv': {
      const text = aiPrompt(true); await copy(text); const vids = P.srcs.filter(s => s.kind === 'video').map(s => SRC.get(s.id)).filter(Boolean);
      const files = vids.slice(0, 5).map(s => new File([s.file], s.code + '_' + (s.name || 'video.mp4'), { type: s.file.type || 'video/mp4' }));
      try { if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); toast('📋 요청서도 복사해 뒀어요 · Gemini 글 칸에 붙여넣기', 6000); return; } } catch (er) { if (er && er.name === 'AbortError') return; }
      window.open('https://gemini.google.com/app', '_blank', 'noopener'); return toast('📋 요청서를 복사했어요 · Gemini에서 동영상을 올리고(V1, V2 순서) 붙여넣기', 7000);
    }
    case 'aicopy': await copy(aiPrompt(false)); return toast('📋 요청서를 복사했어요');
    case 'aipaste': { try { const t = await navigator.clipboard.readText(); if (t) { $('aiAns').value = t; return toast('붙여넣었어요 · ✅ 영상에 넣기를 누르세요'); } } catch (er) { /* 아래 */ } $('aiAns').focus(); return toast('글 칸을 길게 눌러 「붙여넣기」를 눌러 주세요'); }
    case 'aiapply': return aiApply($('aiAns').value);
    case 'purp': { P.purpose = v; const pp = PURPOSE[v]; P.capDef.style = pp.cap; P.music.kind = 'auto'; const e2 = P.clips.find(x => x.kind === 'card' && x.card !== 'title'); if (e2) e2.card = pp.end; toast(`${pp.ic} ${pp.n}에 맞게 바꿨어요`); return re(); }
    case 'ratio': P.ratio = v; exp.ratios = [v]; sizeCanvas(); return re();
    case 'tcard': { const i = P.clips.findIndex(x => x.kind === 'card' && x.card === 'title'); if (i >= 0) P.clips.splice(i, 1); else P.clips.unshift(ED.newClip('card', null, { card: 'title', dur: 3 })); SEL = -1; return re(); }
    case 'ecard': { const i = P.clips.findIndex(x => x.kind === 'card' && x.card !== 'title'); if (i >= 0) P.clips.splice(i, 1); else P.clips.push(ED.newClip('card', null, { card: PURPOSE[P.purpose].end, dur: 4.5 })); SEL = -1; return re(); }
    case 'etype': { const e2 = P.clips.find(x => x.kind === 'card' && x.card !== 'title'); if (e2) { e2.card = v; if (v === 'credits') e2.dur = Math.max(e2.dur, 6); } return re(); }
    case 'bsel': P.info.brandId = v || null; return re();
    case 'bnew': { const L = ED.brands(), nb = { id: uid('b'), name: '', color: '#174782' }; L.push(nb); ED.saveBrands(L); P.info.brandId = nb.id; re(); const f = $('panel').querySelector('[data-a=bf][data-v=name]'); if (f) f.focus(); return; }
    case 'nologo': { const L = ED.brands(), b2 = L.find(x => x.id === P.info.brandId); if (b2) { delete b2.logo; ED.saveBrands(L); } return re(); }
    case 'wm': P.wm = +v; return re();
    case 'xr': { const i = exp.ratios.indexOf(v); if (i >= 0) { if (exp.ratios.length > 1) exp.ratios.splice(i, 1); } else exp.ratios.push(v); return renderPanel(); }
    case 'xq': exp.q = +v; return renderPanel();
    case 'export': return doExport();
    case 'xstop': if (exp.ctl) exp.ctl.aborted = true; return;
    case 'rdl': return giveFile(results[+v].blob, results[+v].name);
    case 'rsh': return giveFile(results[+v].blob, results[+v].name, true);
    case 'thumb': { busy('🖼 대표 이미지 만드는 중…'); try { const bl = await ED.thumbnail(T, $('thTitle').value.trim()); giveFile(bl, `대표이미지_${stamp()}.jpg`); } finally { busy(''); } return; }
    case 'srt': { const s = ED.srtText(); if (!s) return toast('자막이 있는 장면이 없어요'); return giveFile(new Blob(['﻿' + s], { type: 'text/plain' }), `자막_${stamp()}.srt`); }
    case 'blog': { await copy(blogPrompt()); window.open('https://chatgpt.com/', '_blank', 'noopener'); return toast('📋 블로그 글 요청서를 복사했어요 · ChatGPT 글 칸에 붙여넣기', 6000); }
    case 'newproj': { if (!confirm2('지금 작업을 지우고 새로 시작할까요? (만든 MP4는 먼저 저장해 두세요)')) return; if (PLAY) pause(); await IDB.clear('f'); await IDB.clear('p'); location.reload(); return; }
  }
});
async function rec() {
  const c = cur(); if (!c) return;
  if (REC) { REC.stop(); return; }
  let stream; try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { return toast('마이크를 쓸 수 없어요 (권한을 허용해 주세요)', 4000); }
  const parts = [], mr = new MediaRecorder(stream); REC = mr;
  mr.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
  mr.onstop = async () => {
    stream.getTracks().forEach(t => t.stop()); REC = null;
    const blob = new Blob(parts, { type: mr.mimeType || 'audio/webm' }), id = uid('s'), meta = { id, code: 'A' + (P.nA++), kind: 'audio', name: '목소리' };
    busy('🎤 목소리 정리 중…'); const s = await ED.loadSource(meta, blob); busy('');
    if (!s.buf) return toast('녹음을 읽지 못했어요. 다시 해 주세요');
    meta.dur = s.dur; P.srcs.push(meta); try { await IDB.put('f', id, blob); } catch (er) { /* 공간 */ }
    c.vo = { src: id, at: .2, vol: 1.2 }; if (c.kind === 'image' && c.dur < s.dur + .6) c.dur = Math.ceil((s.dur + .8) * 2) / 2;
    commit(); renderPanel(); toast('🎤 목소리를 넣었어요');
  };
  mr.start(); renderPanel(); toast('● 녹음 중… 다 말하면 「■ 녹음 멈추기」', 4000);
}
function blogPrompt() {
  const pp = PURPOSE[P.purpose], B = ED.brand(), caps = P.clips.map((c, i) => (c.cap.t || '').trim()).filter(Boolean);
  return ['[블로그 글 요청]', `제가 만든 「${pp.n}」 영상을 블로그(네이버 블로그)에 올리려고 해요. 아래 내용을 바탕으로 블로그 글을 써 주세요.`, '',
    `영상 제목: ${P.info.title || (B && B.name) || ''}`, P.info.sub ? `날짜 · 장소: ${P.info.sub}` : '', aiExtra ? `참고: ${aiExtra}` : '',
    B ? `가게 · 회사 정보: ${[B.name, B.slogan, B.biz, B.menu && ('메뉴/상품: ' + B.menu.replace(/\n/g, ', ')), B.addr && ('주소: ' + B.addr), B.hours && ('영업시간: ' + B.hours), B.phone && ('전화: ' + B.phone), B.parking && ('주차: ' + B.parking), B.event && ('이벤트: ' + B.event), B.link].filter(Boolean).join(' / ')}` : '',
    caps.length ? '영상 속 장면 자막:\n' + caps.map(s => '- ' + s.replace(/\n/g, ' ')).join('\n') : '', '',
    '써 주실 것', '1. 블로그 제목 후보 3개 (검색이 잘 되게, 지역명 · 핵심 단어 포함)', '2. 본문 1,200~1,800자 · 소제목 3~4개 · 친근한 말투 · 중간에 [영상] [사진] 넣을 자리 표시', `3. ${pp.biz ? '마지막에 위치 · 영업시간 · 연락처 정리' : '마지막에 느낀 점 한 문단'}`, '4. 해시태그 15개', '5. 검색 키워드 5개'].filter(s => s !== '').join('\n');
}
async function doExport() {
  if (exp.busy) return; if (PLAY) pause();
  exp.busy = true; exp.ctl = { aborted: false }; renderPanel();
  const pp = PURPOSE[P.purpose];
  try {
    for (let k = 0; k < exp.ratios.length; k++) {
      const r = exp.ratios[k], tag = r.replace(':', 'x');
      const res = await ED.exportMp4(r, exp.q, (p, sec, ph) => {
        const bar = $('xbar'), tx = $('xtxt'); if (!bar) return;
        if (ph === 'prep') { tx.textContent = `(${k + 1}/${exp.ratios.length}) 준비 중…`; return; } if (ph === 'audio') { tx.textContent = `(${k + 1}/${exp.ratios.length}) 소리 만드는 중…`; return; }
        bar.style.width = (p * 100).toFixed(1) + '%'; const left = p > .02 ? sec / p * (1 - p) : 0; tx.textContent = `(${k + 1}/${exp.ratios.length}) ${RATIOS[r][2]} · ${Math.round(p * 100)}%${left ? ' · 약 ' + Math.ceil(left) + '초 남음' : ''}`;
      }, exp.ctl);
      results.unshift({ blob: res.blob, name: `BK영상_${pp.n.replace(/[\s·]+/g, '')}_${tag}_${stamp()}.mp4`, warning: res.warning });
    }
    toast('🎉 다 만들었어요! 💾 휴대폰에 저장을 눌러 주세요', 5000);
  } catch (e) { toast('만들지 못했어요: ' + e.message, 6000); }
  exp.busy = false; exp.ctl = null; renderPanel(); drawNow();
}

/* ═════════ 시작 ═════════ */
renderStart(); checkResume();
window.addEventListener('beforeunload', () => { if (P) saveProj(); });
g.__ed = { get P() { return P; }, aiApply: t => aiApply(t), aiPrompt: () => aiPrompt(false), select, play, pause, get T() { return T; }, set T(v) { T = v; drawNow(); }, setMode: (m) => { aiMode = m; } };
})(window);

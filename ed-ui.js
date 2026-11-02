/*! ed-ui.js — BK쇼츠 영상 편집 화면 */
(function (g) {
'use strict';
const ED = g.ED, { $, sleep, clamp, uid, esc, fmt, fmtS, PURPOSE, CAPS, CAP_ANIMS, COLORS, FILTERS, EFX, TRANS, KB, EMOJI, BADGES, SFX, RATIOS, SRC, IDB, clipLen, timeline, clipAt, srcTime, eff } = ED;
let P = null, SEL = -1, T = 0, TAB = 'scene', PLAY = false, SELOV = null, FOCUS = false, startPurpose = 'meet', startRatio = '', aiMode = 'all', aiTone = '', aiLen = '1분', aiExtra = '', sheets = [], results = [];
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
  fixPins();
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
  commit(); setTab('scene');
  toast(`🤖 「AI」 탭에서 자르기 · 자막을 한 번에 맡길 수 있어요`, 4500);
});
/* 📁 내 파일에서 고르기: 사진 고르기 화면 대신 「내 파일 · 다운로드」 목록으로 열림 → 사진 · 동영상만 골라서 위와 똑같이 */
$('fStart2').addEventListener('change', e => {
  const ok = Array.from(e.target.files || []).filter(f => /^(image|video)\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|mp4|mov|m4v|webm)$/i.test(f.name)); e.target.value = '';
  if (!ok.length) { toast('사진이나 동영상 파일을 골라 주세요'); return; }
  try { const dt = new DataTransfer(); ok.forEach(f => dt.items.add(f)); $('fStart').files = dt.files; $('fStart').dispatchEvent(new Event('change')); } catch (err) { toast('파일을 열 수 없어요'); }
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
    p.clips = p.clips.filter(c => c.kind === 'card' || c.blank || SRC.has(c.src));
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
  let more = 0;   // 장면에서 빠진 자료도 그림 칸이 보이게 (빈칸 채우기 · 가사 고르기)
  for (const m of P.srcs) { if (m.kind === 'audio' || ED.thumbs.has(m.id)) continue; const s = SRC.get(m.id); if (!s) continue; try { ED.thumbs.set(m.id, await ED.grabFrame(s, m.kind === 'video' ? Math.min(.3, s.dur - .1) : 0, 200)); more++; } catch (e) { /* 건너뜀 */ } }
  if (more) fillThumbs($('panel'));
}

/* ═════════ 편집 화면 ═════════ */
function showEditor() { $('start').hidden = true; $('editor').hidden = false; document.body.classList.add('editing'); renderAll(); }
function sizeCanvas() {
  const [w, h] = RATIOS[P.ratio], k = 540 / Math.min(w, h), cv = $('cv');
  cv.width = Math.round(w * k); cv.height = Math.round(h * k);
  $('screen').style.aspectRatio = `${w} / ${h}`; $('screen').dataset.r = P.ratio;
  $('ratioLbl').textContent = (PURPOSE[P.purpose] || {}).ic + ' ' + P.ratio;
}
function renderAll() { sizeCanvas(); renderTL(); renderTabs(); renderPanel(); updUndo(); drawNow(); renderCut(); renderPaste(); }

/* ── 타임라인 ── */
function renderTL() {
  if (!P) return;
  const { st, total } = timeline(P);
  $('tl').innerHTML = P.clips.map((c, i) => {
    const len = clipLen(c), w = Math.round(clamp(len * 22, 58, 230)), b = [];
    if ((c.cap || {}).t) b.push('💬'); if (c.kind === 'video' && (c.mute || c.vol === 0)) b.push('🔇'); if (c.speed !== 1) b.push(c.speed + '×'); if ((c.efx || []).length) b.push('✨'); if ((c.sfx || []).length) b.push('🔔'); if (c.vo) b.push('🎤'); if ((c.stk || []).length) b.push('😀');
    const lbl = c.blank ? '⬜ 빈칸' : c.kind === 'card' ? (c.card === 'title' ? '🎬 오프닝' : '🏁 엔딩') : (c.pin === 'first' ? '📌 ' : c.pin === 'last' ? '🏁 ' : '') + (c.kind === 'video' ? '🎞' : '🖼');
    return `<button type="button" class="tli ${c.kind}${c.blank ? ' blank' : ''} ${i === SEL ? 'sel' : ''}" data-i="${i}" style="width:${w}px"><span class="th" data-th="${i}"></span><span class="tn">${i + 1}</span><span class="tk">${lbl}</span><span class="td">${len.toFixed(1)}초</span>${b.length ? `<span class="tb">${b.join('')}</span>` : ''}</button>`;
  }).join('') + `<label class="tli addi"><input type="file" id="fAdd2" accept="image/*,video/*" multiple hidden><span>＋<small>자료 더</small></span></label>`;
  $('tl').querySelectorAll('[data-th]').forEach(el => {
    const c = P.clips[+el.dataset.th]; if (c.kind === 'card') return;
    const th = ED.thumbs.get(c.src + '@' + (c.kind === 'video' ? Math.round(c.in) : 0)) || ED.thumbs.get(c.src); if (!th) return;
    const cv = document.createElement('canvas'); cv.width = 90; cv.height = 90; const x = cv.getContext('2d'); const r = ED.coverRect(th.width, th.height, 90, 90, .5, .5); x.drawImage(th, r[0], r[1], r[2], r[3]); el.appendChild(cv);
  });
  $('fAdd2').onchange = async e => { const fs = Array.from(e.target.files || []); e.target.value = ''; if (!fs.length) return; const pos = insPos(), n = await addFiles(fs, pos); commit(); if (n && pos != null) select(pos, true); toast(pos == null ? `＋ ${n}개를 맨 뒤에 넣었어요` : `＋ ${n}개를 장면 ${pos + 1} 자리(커서 앞)에 넣었어요`, 3500); };
  $('tLbl').textContent = `${fmtS(T)} / ${fmtS(total)}`; $('scrub').max = Math.max(.1, total).toFixed(2); $('scrub').value = T.toFixed(2);
  playhead();
}
function playhead() {
  const bt = $('blkT'); if (bt) bt.textContent = fmtS(T); cutInfo();
  const A = clipAt(P, T), items = $('tl').querySelectorAll('.tli[data-i]'); let ph = $('ph'); if (!ph) { ph = document.createElement('i'); ph.id = 'ph'; ph.innerHTML = '<b></b>'; phBind(ph); }
  const it = items[A.i]; if (!it) { ph.remove(); return; }
  if (ph.parentNode !== $('tl')) $('tl').appendChild(ph);
  ph.style.left = (it.offsetLeft + it.offsetWidth * clamp(A.lt / clipLen(A.c), 0, 1)) + 'px';
}
$('tl').addEventListener('click', e => { if (TLNOCLICK) { TLNOCLICK = false; return; } const b = e.target.closest('.tli[data-i]'); if (!b) return; const i = +b.dataset.i; select(i, true); });
/* ── 🔴 빨간 커서 손잡이: 아래 동그라미를 잡고 좌우로 끌기 (화면 끝에 닿으면 저절로 넘어감) ── */
let TLNOCLICK = false, phD = null, phRaf = 0;
function tlTimeAt(cx) {
  const tl = $('tl'), r = tl.getBoundingClientRect(), x = cx - r.left + tl.scrollLeft, { st } = timeline(P); let last = -1;
  for (const it of tl.querySelectorAll('.tli[data-i]')) { const i = +it.dataset.i, l = it.offsetLeft, w = it.offsetWidth; if (x < l) return last < 0 ? 0 : st[i]; if (x <= l + w) return st[i] + clipLen(P.clips[i]) * clamp((x - l) / w, 0, .999); last = i; }
  return last < 0 ? 0 : st[last] + clipLen(P.clips[last]) - .02;
}
function phApply() {
  const tl = $('tl'), { total } = timeline(P); T = clamp(tlTimeAt(phD.x), 0, Math.max(0, total - .01));
  $('tLbl').textContent = `${fmtS(T)} / ${fmtS(total)}`; $('scrub').value = T.toFixed(2); playhead();
  const A = clipAt(P, T); if (A.i !== SEL) { SEL = A.i; tl.querySelectorAll('.tli.sel').forEach(x => x.classList.remove('sel')); const it = tl.querySelector(`.tli[data-i="${A.i}"]`); if (it) it.classList.add('sel'); }
  if (!phRaf) phRaf = requestAnimationFrame(() => { phRaf = 0; drawNow(); });
}
function phBind(ph) {
  ph.addEventListener('pointerdown', e => {
    e.preventDefault(); e.stopPropagation(); if (PLAY) pause(); try { ph.setPointerCapture(e.pointerId); } catch (er) { /* 무시 */ }
    phD = { x: e.clientX, iv: setInterval(() => { if (!phD) return; const tl = $('tl'), r = tl.getBoundingClientRect(); if (phD.x < r.left + 70) { tl.scrollLeft -= 14; phApply(); } else if (phD.x > r.right - 70) { tl.scrollLeft += 14; phApply(); } }, 40) };
    ph.classList.add('drag');
  });
  ph.addEventListener('pointermove', e => { if (!phD) return; e.preventDefault(); phD.x = e.clientX; phApply(); });
  const end = () => { if (!phD) return; clearInterval(phD.iv); phD = null; ph.classList.remove('drag'); { const tl = $('tl'), kx = ph.offsetLeft - tl.scrollLeft; if (kx < 64) tl.scrollBy({ left: kx - 64, behavior: 'smooth' }); else if (kx > tl.clientWidth - 64) tl.scrollBy({ left: kx - tl.clientWidth + 64, behavior: 'smooth' }); } /* 손잡이가 화면 끝(휴대폰 뒤로 가기 제스처)에 붙지 않게 */ TLNOCLICK = true; setTimeout(() => { TLNOCLICK = false; }, 350); renderTL(); renderPanel(); drawNow(); };
  ph.addEventListener('pointerup', end); ph.addEventListener('pointercancel', end);
}
/* ── ✋ 사진 꾹 눌러 끌어서 순서 바꾸기 (살짝 밀면 넘기기 · 0.45초 꾹 누르면 들어 올리기) ── */
let LP = null;
$('tl').addEventListener('contextmenu', e => { if (e.target.closest('.tli')) e.preventDefault(); });
$('tl').addEventListener('pointerdown', e => {
  if (e.target.closest('#ph')) return; const b = e.target.closest('.tli[data-i]'); if (!b || PLAY) return;
  const i = +b.dataset.i, c = P.clips[i]; if (!c || c.kind === 'card') return;
  LP = { i, b, x: e.clientX, y: e.clientY, x0: e.clientX, on: false, moved: false, t: setTimeout(lpStart, 450) };
});
function lpStart() {
  if (!LP) return; try { navigator.vibrate && navigator.vibrate(25); } catch (e) { /* 무시 */ }
  if (P.clips[LP.i] && P.clips[LP.i].pin) { const i = LP.i; LP = null; TLNOCLICK = true; setTimeout(() => { TLNOCLICK = false; }, 600); return clipMenu(i); }   // 고정 장면: 끌기 없이 메뉴만
  LP.on = true;
  const r = LP.b.getBoundingClientRect(), gh = LP.b.cloneNode(true); gh.classList.add('tlghost'); gh.style.width = r.width + 'px'; gh.style.left = (LP.x - r.width / 2) + 'px'; gh.style.top = (r.top - 14) + 'px';
  const cs = LP.b.querySelectorAll('canvas'), cg = gh.querySelectorAll('canvas'); cs.forEach((cv, k) => { if (cg[k]) cg[k].getContext('2d').drawImage(cv, 0, 0); });
  document.body.appendChild(gh); LP.gh = gh; LP.b.style.opacity = '.3';
  const di = document.createElement('i'); di.id = 'dropi'; $('tl').appendChild(di); LP.di = di; lpMove(LP.x);
  LP.iv = setInterval(() => { if (!LP || !LP.on) return; const tl = $('tl'), rr = tl.getBoundingClientRect(); if (LP.x < rr.left + 40) { tl.scrollLeft -= 14; lpMove(LP.x); } else if (LP.x > rr.right - 40) { tl.scrollLeft += 14; lpMove(LP.x); } }, 40);
}
function lpIndex(cx) { const tl = $('tl'), r = tl.getBoundingClientRect(), x = cx - r.left + tl.scrollLeft, items = Array.from(tl.querySelectorAll('.tli[data-i]')); for (const it of items) if (x < it.offsetLeft + it.offsetWidth / 2) return { j: +it.dataset.i, left: it.offsetLeft - 3 }; const l = items[items.length - 1]; return { j: P.clips.length, left: l ? l.offsetLeft + l.offsetWidth + 2 : 0 }; }
function lpMove(cx) { if (!LP || !LP.on) return; LP.x = cx; if (Math.abs(cx - LP.x0) > 14) LP.moved = true; LP.gh.style.left = (cx - LP.gh.offsetWidth / 2) + 'px'; const d = lpIndex(cx); LP.j = d.j; LP.di.style.left = d.left + 'px'; }
document.addEventListener('pointermove', e => { if (!LP) return; if (!LP.on) { if (Math.hypot(e.clientX - LP.x, e.clientY - LP.y) > 10) { clearTimeout(LP.t); LP = null; } return; } e.preventDefault(); lpMove(e.clientX); }, { passive: false });
$('tl').addEventListener('touchmove', e => { if (LP && LP.on) e.preventDefault(); }, { passive: false });
function lpEnd(drop) {
  if (!LP) return; clearTimeout(LP.t); const L = LP; LP = null; if (!L.on) return;
  clearInterval(L.iv); L.gh.remove(); L.di.remove(); L.b.style.opacity = ''; TLNOCLICK = true; setTimeout(() => { TLNOCLICK = false; }, 350);
  if (drop && !L.moved) { renderTL(); return clipMenu(L.i); }   // 꾹 눌렀다 그냥 떼면 → 복사 · 넣기 · 옮기기 메뉴
  if (!drop || L.j == null) return renderTL();
  const c = P.clips[L.i]; let j = L.j > L.i ? L.j - 1 : L.j; if (j === L.i) return renderTL();
  P.clips.splice(L.i, 1); const [lo, hi] = movRange(); j = clamp(j, lo, hi + 1); P.clips.splice(j, 0, c); SEL = j;
  commit(); renderPanel(); toast(`✋ ${j + 1}번째 자리로 옮겼어요`);
}
document.addEventListener('pointerup', () => lpEnd(true)); document.addEventListener('pointercancel', () => lpEnd(false));
/* ═════════ 📄 복사 · 📋 붙여넣기 · 📍 몇 번과 몇 번 사이에 넣기 · 🗂 사진 서랍 ═════════ */
let CLIPB = null, SHX = null;
const srcCode = id => { const m = P.srcs.find(s => s.id === id); return m ? m.code : ''; };
function cloneClip(c) { const d = JSON.parse(JSON.stringify(c)); d.id = uid('c'); d.pin = null; delete d.blank; return d; }
function newFromSrc(id) { const m = P.srcs.find(s => s.id === id), s = SRC.get(id); if (!m || !s) return null; return m.kind === 'video' ? ED.newClip('video', id, { in: 0, out: s.dur }) : ED.newClip('image', id, { dur: PURPOSE[P.purpose].img }); }
function nearPos() {   // 빨간 커서에서 가까운 장면 사이
  const [lo, hi] = movRange(), A = clipAt(P, T); if (A.i < 0 || !A.c) return hi + 1;
  return clamp(A.lt < clipLen(A.c) / 2 ? A.i : A.i + 1, lo, hi + 1);
}
const between = pos => pos <= 0 ? '맨 앞' : pos >= P.clips.length ? '맨 뒤' : `${pos}번과 ${pos + 1}번 사이`;
function putAt(clip, pos, how) {
  const [lo, hi] = movRange(), p = clamp(pos, lo, hi + 1);
  P.clips.splice(p, 0, clip); SEL = p; T = timeline(P).st[p] + .02;
  commit(); makeThumbs(); renderPanel(); drawNow();
  const it = $('tl').querySelector(`.tli[data-i="${p}"]`); if (it) it.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  toast(`${how} ${p + 1}번 장면으로 넣었어요${p !== pos ? ' (오프닝 · 고정 장면 안쪽으로)' : ''} · 뒤 장면은 ${clipLen(clip).toFixed(1)}초 밀렸어요`, 4000);
}
function moveTo(i, pos) {
  const [lo, hi] = movRange(), c = P.clips[i]; if (!c) return; let p = clamp(pos, lo, hi + 1); if (p > i) p--;
  if (p === i) return toast('이미 그 자리예요'); P.clips.splice(i, 1); P.clips.splice(p, 0, c); SEL = p; T = timeline(P).st[p] + .02;
  commit(); renderPanel(); drawNow(); toast(`↔ ${p + 1}번 장면으로 옮겼어요`);
}
/* 아래에서 올라오는 작은 창 */
function sheet(html) {
  let el = $('edSheet'); if (!el) { el = document.createElement('div'); el.id = 'edSheet'; el.className = 'edsheet'; document.body.appendChild(el); el.addEventListener('click', sheetClick); el.addEventListener('change', sheetChange); el.addEventListener('input', sheetInput); }
  el.innerHTML = `<div class="shbg" data-s="close"></div><div class="shbox">${html}</div>`; el.hidden = false; fillThumbs(el);
}
function sheetClose() { const el = $('edSheet'); if (el) el.hidden = true; SHX = null; }
/* 🗂 서랍에서 빼기 · 다시 넣기 */
const trayHidden = id => (P.trayHide || []).includes(id);
function useCount(id) { return P.clips.filter(c => c.src === id).length; }
function trayMenu(id) {
  const m = P.srcs.find(s => s.id === id); if (!m) return; SHX = { src: id };
  sheet(`<div class="shh"><span class="shth" data-gth="${id}"></span><div><b>🗂 서랍 · ${esc(m.code)}</b><small>${m.kind === 'video' ? '🎞 동영상' : '🖼 사진'} · 영상에 ${useCount(id)}번 씀</small></div></div>
    <button type="button" data-s="twhere" class="pri">📍 몇 번과 몇 번 사이에 넣기</button>
    <button type="button" data-s="thide">🙈 서랍에서 빼기 <small>서랍만 깔끔하게 · 영상에 들어간 장면은 그대로</small></button>
    <button type="button" data-s="close" class="cl">닫기</button>`);
}
function trayFlash(id) {
  if (TAB !== 'scene') return; renderPanel();
  const el = $('panel').querySelector(`.trs [data-v="${id}"]`); if (!el) return;
  el.classList.add('flash'); el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); setTimeout(() => el.classList.remove('flash'), 2200);
}
/* 🔄 다른 사진으로 바꾸기 (시간 · 글씨 · 효과는 그대로) */
function swapSrc(c, id) {
  const m = P.srcs.find(s => s.id === id), s = SRC.get(id); if (!m || !s) return false;
  const d = clipLen(c); delete c.blank; c.src = id; c.fx = .5; c.fy = .5;
  if (m.kind === 'video') { c.kind = 'video'; c.speed = c.speed || 1; c.in = 0; c.out = r2(Math.min(s.dur, d * c.speed)); c.hold = r2(Math.max(0, d - c.out / c.speed)); if (c.vol == null) c.vol = 1; if (c.mute == null) c.mute = 0; }
  else { c.kind = 'image'; c.dur = r2(d); c.speed = 1; c.in = 0; c.out = 0; c.hold = 0; if (!c.kb || c.kb === 'none') c.kb = 'auto'; }
  return true;
}
function swapSheet(cid) {
  const c = P.clips.find(x => x.id === cid); if (!c) return; SHX = { id: cid };
  const i = P.clips.indexOf(c), ids = P.srcs.filter(s => s.kind !== 'audio' && SRC.has(s.id) && !trayHidden(s.id)).map(s => s.id);
  sheet(`<div class="shh"><span class="shth" data-gth="${c.src || ''}"></span><div><b>🔄 ${i + 1}번 장면 ${c.blank ? '빈칸에 사진 넣기' : '사진 바꾸기'}</b><small>${clipLen(c).toFixed(1)}초 · 시간 · 글씨 · 효과는 그대로, 사진만 바뀌어요</small></div></div>
    <h4 style="margin:10px 0 4px">🗂 서랍에서 고르기</h4><div class="ggrid">${ids.map(id => { const m = P.srcs.find(s => s.id === id); return `<button type="button" class="gbtn${id === c.src ? ' on' : ''}" data-s="swapto" data-v="${id}"><span data-gth="${id}"></span><small>${esc(m.code)}${m.kind === 'video' ? ' 🎞' : ''}</small></button>`; }).join('')}</div>
    <div class="btns2" style="margin-top:10px"><label class="btnf">📷 갤러리에서<input type="file" data-s="swapf" accept="image/*,video/*" hidden></label><label class="btnf">📁 폴더(내 파일)에서<input type="file" data-s="swapf" hidden></label></div>
    <p class="hint" style="margin:4px 0 0">새로 고른 사진은 서랍에도 담겨요.</p>
    <button type="button" data-s="close" class="cl">취소</button>`);
}
function swapDone(c, id) {
  if (!swapSrc(c, id)) return toast('사진을 열 수 없어요');
  const i = P.clips.indexOf(c); SEL = i; T = timeline(P).st[i] + .02;
  commit(); makeThumbs(); renderPanel(); drawNow(); toast(`🔄 ${i + 1}번 장면을 ${srcCode(id)}(으)로 바꿨어요 · ${clipLen(c).toFixed(1)}초 그대로`, 4000);
}
async function sheetChange(e) {
  const el = e.target; if (el.dataset.s !== 'swapf') return; const fs = Array.from(el.files || []); el.value = ''; if (!fs.length) return;
  const X = SHX, c = X && P.clips.find(x => x.id === X.id); sheetClose(); if (!c) return;
  const n0 = P.clips.length, n = await addFiles(fs.slice(0, 1), n0); if (!n) return; const nc = P.clips.splice(n0)[0];
  swapDone(c, nc.src);
}
function clipMenu(i) {
  const c = P.clips[i]; if (!c || c.kind === 'card') return; SEL = i; renderTL();
  SHX = { i, id: c.id };
  sheet(`<div class="shh"><span class="shth" data-gth="${c.src || ''}"></span><div><b>${i + 1}번 장면</b><small>${c.blank ? '⬜ 빈칸' : esc(srcCode(c.src)) + (c.kind === 'video' ? ' 🎞' : ' 🖼')} · ${clipLen(c).toFixed(1)}초</small></div></div>
    ${c.blank ? '' : `<button type="button" data-s="copy" class="pri">📄 복사하기 <small>빨간 커서를 옮긴 뒤 「📋 붙여넣기」</small></button>
    <button type="button" data-s="where" data-v="copy">📍 한 번 더 넣기 — 몇 번과 몇 번 사이에</button>`}
    ${c.pin ? '' : `<button type="button" data-s="where" data-v="move">↔ 이 장면 옮기기 — 몇 번과 몇 번 사이로</button>`}
    <button type="button" data-s="swap">${c.blank ? '🖼 이 빈칸에 사진 넣기' : '🔄 다른 사진으로 바꾸기 <small>시간 · 글씨 · 효과는 그대로</small>'}</button>
    ${c.blank ? '' : `<button type="button" data-s="totray">🗂 서랍에 넣기</button>`}
    <button type="button" data-s="del" class="dg">🗑 이 장면 지우기</button><button type="button" data-s="close" class="cl">닫기</button>`);
}
function whereSheet(ctx) {   // ctx: { mode:'copy'|'move'|'src', i, id, src }
  SHX = ctx; const [lo, hi] = movRange(), def = clamp(nearPos(), lo, hi + 1);
  const code = ctx.mode === 'src' ? srcCode(ctx.src) : srcCode((P.clips.find(x => x.id === ctx.id) || {}).src);
  sheet(`<div class="shh"><span class="shth" data-gth="${ctx.mode === 'src' ? ctx.src : (P.clips.find(x => x.id === ctx.id) || {}).src || ''}"></span><div><b>📍 ${esc(code)} — 어디에 ${ctx.mode === 'move' ? '옮길까요' : '넣을까요'}?</b><small>아래 사진 줄의 번호를 보고 써 주세요</small></div></div>
    <div class="shnum"><button type="button" data-s="n" data-v="-1">−</button><input type="number" id="shN" inputmode="numeric" min="${lo}" max="${hi + 1}" value="${def}"><button type="button" data-s="n" data-v="1">＋</button></div>
    <p class="shsay">→ <b id="shSay">${between(def)}</b>에 ${ctx.mode === 'move' ? '옮겨요' : '들어가요'}</p>
    <p class="hint" style="text-align:center;margin:0 0 8px">숫자 = 그 번호 장면 <b>바로 뒤</b> (지금 장면 1 ~ ${P.clips.length})</p>
    <button type="button" data-s="put" class="pri">${ctx.mode === 'move' ? '↔ 옮기기' : '📍 넣기'}</button><button type="button" data-s="close" class="cl">취소</button>`);
  const n = $('shN'); if (n) setTimeout(() => { try { n.focus(); n.select(); } catch (e) { /* 무시 */ } }, 60);
}
function sheetInput(e) { if (e.target.id === 'shN') { const v = parseInt(e.target.value, 10); $('shSay').textContent = isNaN(v) ? '숫자를 써 주세요' : between(v); } }
function sheetClick(e) {
  const b = e.target.closest('[data-s]'); if (!b) return; const k = b.dataset.s, v = b.dataset.v, X = SHX;
  if (k === 'close') return sheetClose();
  if (k === 'n') { const n = $('shN'), [lo, hi] = movRange(); n.value = clamp((parseInt(n.value, 10) || 0) + +v, lo, hi + 1); return sheetInput({ target: n }); }
  if (!X) return sheetClose();
  if (k === 'twhere') return whereSheet({ mode: 'src', src: X.src });
  if (k === 'thide') { P.trayHide = Array.from(new Set([...(P.trayHide || []), X.src])); sheetClose(); commit(); renderPanel(); return toast(`🙈 ${srcCode(X.src)}을 서랍에서 뺐어요 · 다시 넣으려면 사진 줄에서 꾹 → 「🗂 서랍에 넣기」`, 4500); }
  const i = X.id ? P.clips.findIndex(c => c.id === X.id) : -1, c = P.clips[i];
  if (k === 'copy') { if (!c) return sheetClose(); CLIPB = { j: JSON.stringify(c), code: srcCode(c.src), src: c.src }; sheetClose(); renderPaste(); return toast(`📄 ${CLIPB.code}을 복사했어요 · 빨간 커서를 넣을 곳에 두고 「📋 붙여넣기」`, 4500); }
  if (k === 'swap') { if (!c) return sheetClose(); return swapSheet(c.id); }
  if (k === 'swapto') { if (!c) return sheetClose(); sheetClose(); return swapDone(c, v); }
  if (k === 'totray') { if (!c || !c.src) return sheetClose(); sheetClose(); const id = c.src;
    if (trayHidden(id)) { P.trayHide = P.trayHide.filter(x => x !== id); commit(); toast(`🗂 ${srcCode(id)}을 서랍에 넣었어요`); } else toast(`🗂 ${srcCode(id)}은 이미 서랍에 있어요 · 영상에 ${useCount(id)}번 씀`, 3500);
    return trayFlash(id); }
  if (k === 'where') { if (!c) return sheetClose(); return whereSheet({ mode: v, id: c.id }); }
  if (k === 'del') { if (!c) return sheetClose(); sheetClose(); P.clips.splice(i, 1); SEL = Math.min(i, P.clips.length - 1); T = Math.min(T, timeline(P).total); commit(); renderPanel(); return toast('🗑 지웠어요 (↩️ 되돌리기 가능)'); }
  if (k === 'put') {
    const n = parseInt($('shN').value, 10); if (isNaN(n)) return toast('숫자를 써 주세요'); sheetClose();
    if (X.mode === 'move') return moveTo(i, n);
    const nc = X.mode === 'src' ? newFromSrc(X.src) : c ? cloneClip(c) : null; if (!nc) return toast('사진을 찾지 못했어요');
    return putAt(nc, n, '📍');
  }
}
/* 📋 붙여넣기 줄 (복사해 두면 미리보기 아래에 나와요) */
function renderPaste() {
  const el = $('pastebar'); if (!el) return; if (!CLIPB || !P) { el.hidden = true; return; }
  el.hidden = false; el.innerHTML = `<span class="pth" data-gth="${CLIPB.src || ''}"></span><button type="button" data-p="go" class="pgo">📋 ${esc(CLIPB.code)} 붙여넣기 <small id="pasteAt">${between(nearPos())}</small></button><button type="button" data-p="x" class="px" aria-label="복사 지우기">✕</button>`;
  fillThumbs(el);
}
$('pastebar').addEventListener('click', e => {
  const b = e.target.closest('[data-p]'); if (!b || !P) return;
  if (b.dataset.p === 'x') { CLIPB = null; return renderPaste(); }
  if (PLAY) pause(); if (!CLIPB) return; putAt(cloneClip(JSON.parse(CLIPB.j)), nearPos(), '📋');
});
/* 🗂 사진 서랍 (✂️ 편집 탭 맨 위) */
function trayBox() {
  const all = P.srcs.filter(s => s.kind !== 'audio' && SRC.has(s.id)).map(s => s.id), ids = all.filter(id => !trayHidden(id)), nh = all.length - ids.length, use = {};
  P.clips.forEach(c => { if (c.src) use[c.src] = (use[c.src] || 0) + 1; });
  return `<div class="grp tray"><h3 style="margin-top:0">🗂 사진 서랍 <small>${ids.length}장 · 톡 = 빨간 커서 자리에 넣기 · 꾹 = 몇 번 사이에 · 빼기</small></h3>
    <div class="trs">${ids.map(id => { const m = P.srcs.find(s => s.id === id); return `<button type="button" class="gbtn" data-a="trayput" data-v="${id}" data-lp="tray"><span data-gth="${id}"></span>${use[id] ? `<i>${use[id]}번 씀</i>` : '<i class="nu">안 씀</i>'}<small>${esc(m.code)}${m.kind === 'video' ? ' 🎞' : ''}</small></button>`; }).join('') || '<p class="hint">아직 담은 사진이 없어요</p>'}</div>
    <p class="hint" style="margin:6px 0 0">지금 넣으면 → <b id="trayAt">${between(nearPos())}</b>${nh ? ` · <button type="button" data-a="trayunhide" class="lnk">🙈 뺀 사진 ${nh}장 다시 꺼내기</button>` : ''}</p>
    <div class="btns2"><label class="btnf">📷 갤러리에서 서랍에 담기<input type="file" data-a="trayf" accept="image/*,video/*" multiple hidden></label><label class="btnf">📁 폴더에서 서랍에 담기<input type="file" data-a="trayf" multiple hidden></label></div>
    <p class="hint" style="margin:4px 0 0">서랍에 담기만 하고 영상에는 아직 안 들어가요. 미리 많이 담아 두고 골라 넣으세요.</p></div>`;
}
async function trayFiles(fs) {
  const n0 = P.clips.length, n = await addFiles(fs, n0); if (!n) return;
  P.clips.splice(n0); if (SEL >= P.clips.length) SEL = P.clips.length - 1;
  commit(); renderPanel(); toast(`🗂 ${n}개를 사진 서랍에 담았어요 · 톡 누르면 빨간 커서 자리에 들어가요`, 4000);
}
/* 꾹 누르기 (사진 서랍 · 순서대로 톡톡 사진) → 몇 번 사이에 */
let PLP = null, PNOCLICK = false;
$('panel').addEventListener('contextmenu', e => { if (e.target.closest('[data-lp]')) e.preventDefault(); });
$('panel').addEventListener('pointerdown', e => {
  PNOCLICK = false; const b = e.target.closest('[data-lp]'); if (!b) return;
  PLP = { b, x: e.clientX, y: e.clientY, t: setTimeout(() => { const L = PLP; PLP = null; if (!L) return; PNOCLICK = true; try { navigator.vibrate && navigator.vibrate(25); } catch (er) { /* 무시 */ }
    if (L.b.dataset.lp === 'tray') trayMenu(L.b.dataset.v); else whereSheet({ mode: 'copy', id: L.b.dataset.v }); }, 480) };
});
document.addEventListener('pointermove', e => { if (PLP && Math.hypot(e.clientX - PLP.x, e.clientY - PLP.y) > 10) { clearTimeout(PLP.t); PLP = null; } });
['pointerup', 'pointercancel'].forEach(ev => document.addEventListener(ev, () => { if (PLP) { clearTimeout(PLP.t); PLP = null; } if (PNOCLICK) setTimeout(() => { PNOCLICK = false; }, 400); }));
/* 🔍 미리보기 크게 · 작게 */
function pvSet(big) { document.body.classList.toggle('pvbig', !!big); const b = $('pvBtn'); if (b) { b.textContent = big ? '🔍 작게' : '🔍 크게'; b.setAttribute('aria-pressed', String(!!big)); } try { localStorage.setItem('bkEdPvBig', big ? '1' : ''); } catch (e) { /* 무시 */ } }
$('pvBtn').addEventListener('click', () => { pvSet(!document.body.classList.contains('pvbig')); renderTL(); });
try { pvSet(localStorage.getItem('bkEdPvBig') === '1'); } catch (e) { pvSet(false); }
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
let PSTART = false;   // ▶ 준비 중에 또 누르면 소리가 두 번 나지 않게
async function play() {
  if (PLAY) return pause(); if (PSTART) return;
  PSTART = true; renderCut(); try { await play0(); } finally { PSTART = false; renderCut(); }
}
async function play0() {
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
  acT0 = clock(); T0 = T; PLAY = true; $('playBtn').textContent = '⏸'; SELOV = null; loop(); renderCut();
}
function pause() {
  PLAY = false; cancelAnimationFrame(raf); $('playBtn').textContent = '▶';
  try { if (asrc) asrc.stop(); } catch (e) { /* 이미 멈춤 */ } asrc = null;
  for (const s of SRC.values()) if (s.vid) s.vid.pause();
  drawNow(); renderCut();
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
$('fine').addEventListener('click', e => { const b = e.target.closest('[data-d]'); if (!b || !P) return; if (PLAY) pause(); const { total } = timeline(P); T = clamp(T + +b.dataset.d, 0, Math.max(0, total - .01)); const A = clipAt(P, T); $('tLbl').textContent = `${fmtS(T)} / ${fmtS(total)}`; $('scrub').value = T.toFixed(2); playhead(); if (A.i !== SEL) { SEL = A.i; renderTL(); renderPanel(); } drawNow(); });
/* ═════════ ⏱ 장면 끝 맞추기: ✂️ 여기서 끝 · ➡️ 앞 장면을 여기까지 · 🎵 들으면서 톡톡 넘기기 ═════════
   A(roll)  = 경계만 옮기기 → 옆 장면이 그만큼 늘거나 줄고, 그 뒤 장면들은 제자리
   B(ripple)= 뒤 장면 전부가 함께 당겨지거나 밀림 */
const r2 = v => Math.round(v * 100) / 100, r1 = v => Math.round(v * 10) / 10;
const minLen = c => c.kind === 'card' ? 1 : .5;
const cutMode = () => (P && P.cutMode === 'ripple') ? 'ripple' : 'roll';
function srcDur(c) { const s = SRC.get(c.src), m = P.srcs.find(x => x.id === c.src); return s && s.dur ? s.dur : m && m.dur ? m.dur : c.out; }
function setLenBack(c, L) {   // 끝을 옮겨서 길이 L (시작은 그대로)
  L = Math.max(minLen(c), L);
  if (c.kind !== 'video') { c.dur = r2(L); return; }
  const sp = c.speed || 1, hold = c.hold || 0, cur = (c.out - c.in) / sp + hold;
  if (L < cur) { let cut = cur - L; const h = Math.min(hold, cut); c.hold = r2(hold - h); cut -= h; if (cut > 0) c.out = r2(Math.max(c.in + .1, c.out - cut * sp)); }
  else { let add = L - cur; const g = Math.min(add, Math.max(0, (srcDur(c) - c.out) / sp)); c.out = r2(c.out + g * sp); add -= g; if (add > .001) c.hold = r2(hold + add); }
}
function setLenFront(c, L) {   // 시작을 옮겨서 길이 L (끝은 그대로)
  L = Math.max(minLen(c), L); const old = clipLen(c);
  if (c.kind !== 'video') c.dur = r2(L);
  else {
    const sp = c.speed || 1;
    if (L < old) { let cut = old - L; const f = Math.min(cut, Math.max(0, (c.out - c.in) / sp - .2)); c.in = r2(c.in + f * sp); cut -= f; if (cut > 0) c.hold = r2(Math.max(0, (c.hold || 0) - cut)); }
    else { let add = L - old; const g = Math.min(add, c.in / sp); c.in = r2(c.in - g * sp); add -= g; if (add > .001) c.hold = r2((c.hold || 0) + add); }
  }
  const sh = old - clipLen(c);   // 효과음은 노래의 같은 자리에 남게
  if (sh && (c.sfx || []).length) c.sfx = c.sfx.map(s => ({ k: s.k, at: r2(s.at - sh) })).filter(s => s.at >= 0 && s.at < clipLen(c));
}
/* 장면 i가 tEnd(노래 시간)에 끝나게 — 0.1초 단위로 */
function setEnd(i, tEnd) {
  const c = P.clips[i]; if (!c) return null;
  const { st } = timeline(P), old = clipLen(c), L = Math.max(minLen(c), r2(r1(tEnd) - st[i]));
  if (Math.abs(L - old) < .03) return { d: 0 };
  const n = P.clips[i + 1], roll = cutMode() === 'roll' && !!n;
  setLenBack(c, L); const d = clipLen(c) - old; let push = 0;
  if (roll) { const want = clipLen(n) - d, ok = Math.max(minLen(n), want); setLenFront(n, ok); push = r2(ok - want); }
  return { d: r2(d), push, roll, len: clipLen(c) };
}
function cutMsg(i, r, verb) {
  const s = Math.abs(r.d).toFixed(1);
  let m = `${verb} 장면 ${i + 1} → ${r.len.toFixed(1)}초 · `;
  m += r.roll ? (r.d < 0 ? `다음 장면이 ${s}초 일찍 시작 (그 뒤는 그대로)` : `다음 장면이 ${s}초 늦게 시작 (그 뒤는 그대로)`) : (r.d < 0 ? `뒤 장면이 모두 ${s}초 당겨졌어요` : `뒤 장면이 모두 ${s}초 밀렸어요`);
  if (r.push > .05) m += ` · 다음 장면이 너무 짧아져 뒤를 ${r.push.toFixed(1)}초 밀었어요`;
  return m;
}
function afterCut(i) {
  commit(); const { st } = timeline(P); T = (st[i + 1] != null ? st[i + 1] : st[i]) + .02; SEL = clipAt(P, T).i;
  renderTL(); renderPanel(); drawNow();
  const it = $('tl').querySelector(`.tli[data-i="${SEL}"]`); if (it) it.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
}
function cutHere() {
  if (PLAY) pause(); const A = clipAt(P, T); if (A.i < 0) return;
  if (A.lt < .3) return toast('이 장면이 막 시작한 자리예요 · 앞 장면을 늘리려면 「➡️ 앞 장면을 여기까지」', 4000);
  const r = setEnd(A.i, T); if (!r || !r.d) return toast('이미 여기서 끝나요');
  afterCut(A.i); toast(cutMsg(A.i, r, '✂️'), 4500);
}
function extHere() {
  if (PLAY) pause(); const A = clipAt(P, T); if (A.i <= 0) return toast('맨 앞 장면이라 늘릴 앞 장면이 없어요');
  if (A.lt < .05) return toast('이미 여기서 장면이 바뀌어요');
  const r = setEnd(A.i - 1, T); if (!r || !r.d) return toast('이미 여기서 바뀌어요');
  afterCut(A.i - 1); toast(cutMsg(A.i - 1, r, '➡️'), 4500);
}
/* 이 장면 길이 바꾸기 (편집 탭 −1 · −0.1 · +0.1 · +1) */
function lenNudge(dv) {
  const c = cur(); if (!c) return; const { st } = timeline(P), r = setEnd(SEL, st[SEL] + clipLen(c) + dv);
  if (!r || !r.d) return toast(clipLen(c) <= minLen(c) + .01 ? `더 짧게는 안 돼요 (최소 ${minLen(c)}초)` : '더 바꿀 수 없어요');
  if (T > st[SEL] + clipLen(c)) T = st[SEL] + clipLen(c) - .05;
  commit(); renderPanel(); toast(cutMsg(SEL, r, '⏱'), 3500);
}
/* 🎵 들으면서 톡톡 */
let TAPC = null;
function tapStart() {
  if (!P) return; const A = clipAt(P, T); if (A.i < 0) return;
  if (A.i >= P.clips.length - 1) { T = 0; }
  TAPC = { i: clipAt(P, T).i, n: 0 }; renderCut();
  if (!PLAY) play();
  toast('🎵 노래를 듣다가 「다음 장면!」이라고 느끼는 순간에 큰 버튼을 톡 누르세요', 5000);
}
function tapNow() {
  if (!TAPC || PSTART) return; if (!PLAY) { TAPC.i = clipAt(P, T).i; play(); renderCut(); return; }
  const i = TAPC.i, { st } = timeline(P), t = T;
  if (i >= P.clips.length - 1) return tapStop('✅ 마지막 장면까지 맞췄어요 · ▶로 확인해 보세요');
  if (t - st[i] < .4) return;   // 너무 빨리 두 번 누름
  const r = setEnd(i, t); TAPC.i = i + 1; TAPC.n++;
  commit(); renderCut();
  try { navigator.vibrate && navigator.vibrate(15); } catch (e) { /* 무시 */ }
  if (r && r.d) { const it = $('tl').querySelector(`.tli[data-i="${i + 1}"]`); if (it) it.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); }
  const nx = P.clips[TAPC.i]; if (nx && nx.kind === 'card' && nx.card !== 'title') tapStop(`✅ 엔딩 카드까지 왔어요 · 장면 ${TAPC.n}개를 노래에 맞췄어요`);
}
function tapBack() {
  if (!TAPC) return; if (PLAY) pause();
  if (TAPC.n > 0) { undo(-1); TAPC.n--; TAPC.i = Math.max(0, TAPC.i - 1); }
  const { st } = timeline(P); T = Math.max(0, (st[TAPC.i] || 0) - 1); renderCut(); play();
  toast(`↩ 장면 ${TAPC.i + 1} 끝을 다시 눌러 주세요`, 3000);
}
function tapStop(msg) {
  const n = TAPC ? TAPC.n : 0; TAPC = null; if (PLAY) pause(); renderCut(); renderPanel();
  toast(msg || (n ? `■ 그만했어요 · 장면 ${n}개를 맞췄어요 (↩️ 되돌리기로 하나씩 취소)` : '■ 그만했어요'), 4500);
}
function renderCut() {
  const el = $('cutbar'); if (!el || !P) return;
  if (TAPC) {
    el.className = 'cutbar tapping';
    el.innerHTML = `<button type="button" data-c="tapback" class="sm">↩<small>다시</small></button><button type="button" data-c="tapnow" class="tapbig">${PLAY ? `👆 다음 장면!<small>장면 ${TAPC.i + 1} 여기서 끝</small>` : PSTART ? '⏳ 노래 준비 중…' : '▶ 이어서 톡톡'}</button><button type="button" data-c="tapstop" class="sm">■<small>그만</small></button>`;
  } else {
    const m = cutMode();
    el.className = 'cutbar';
    el.innerHTML = `<button type="button" data-c="cut">✂️ 여기서 끝</button><button type="button" data-c="ext">➡️ 앞 장면<br>여기까지</button><button type="button" data-c="tap" class="tapgo">🎵 톡톡<br>넘기기</button><button type="button" data-c="mode" class="md">뒤 장면<b>${m === 'ripple' ? 'B 같이' : 'A 그대로'}</b></button>`;
  }
  cutInfo();
}
function cutInfo() {
  const el = $('cutInfo'); if (!el || !P || !P.clips.length) return; const A = clipAt(P, T); if (A.i < 0) { el.textContent = ''; return; }
  el.textContent = `${fmt(T)} · ${A.i + 1}번 ${A.lt.toFixed(1)}/${clipLen(A.c).toFixed(1)}초`;
  const w = between(nearPos()), pa = $('pasteAt'), ta = $('trayAt'); if (pa) pa.textContent = w; if (ta) ta.textContent = w;
}
$('cutbar').addEventListener('pointerdown', e => { const b = e.target.closest('[data-c="tapnow"]'); if (!b) return; e.preventDefault(); tapNow(); });
$('cutbar').addEventListener('click', e => {
  const b = e.target.closest('[data-c]'); if (!b || !P) return; const k = b.dataset.c;
  if (k === 'cut') return cutHere(); if (k === 'ext') return extHere(); if (k === 'tap') return tapStart();
  if (k === 'tapback') return tapBack(); if (k === 'tapstop') return tapStop();
  if (k === 'mode') { P.cutMode = cutMode() === 'ripple' ? 'roll' : 'ripple'; commit(); renderCut(); renderPanel(); return toast(P.cutMode === 'ripple' ? 'B: 장면 길이를 바꾸면 뒤 장면이 모두 함께 움직여요' : 'A: 옆 장면만 늘거나 줄고, 그 뒤 장면은 제자리예요', 3500); }
});
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
  if (TAB !== 'deco') { MODE = 'vid'; TAB = MLAST.vid = 'deco'; renderTabs(); }
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
/* ═════════ 큰 단계 3개: ① 🎬 영상 만들기 · ② 🎤 노래 맞추기 · ③ 💾 마무리 → 아래 탭은 그 단계 것만 ═════════ */
const MODES = {
  vid: ['①', '🎬', '영상 만들기', [['scene', '✂️', '장면'], ['order', '🧩', '순서'], ['deco', '😀', '글씨·스티커'], ['fx', '✨', '효과']]],
  song: ['②', '🎤', '노래 맞추기', [['mus', '🎵', '음악'], ['lyr', '🎤', '가사'], ['sync', '⏱', '장면 맞추기'], ['vo', '🎙', '내 목소리']]],
  fin: ['③', '💾', '마무리', [['info', '🏷', '카드·정보'], ['ai', '🤖', 'AI'], ['save', '💾', '저장']]]
};
const TAB_OLD = { edit: 'scene', cap: 'deco', stk: 'deco', snd: 'mus' };
let MODE = 'vid'; const MLAST = { vid: 'scene', song: 'mus', fin: 'info' };
function modeOf(t) { for (const [m, v] of Object.entries(MODES)) if (v[3].some(x => x[0] === t)) return m; return ''; }
function setTab(t) {
  t = TAB_OLD[t] || t; const m = modeOf(t); if (!m) return;
  if (TAB === 'lyr' && t !== 'lyr') lyrRemind();
  if (m !== 'song' && TAPC) tapStop();
  MODE = m; TAB = t; MLAST[m] = t; try { localStorage.setItem('bkEdTab', t); } catch (e) { /* 무시 */ }
  renderTabs(); renderPanel();
}
try { const t0 = localStorage.getItem('bkEdTab'); const t1 = TAB_OLD[t0] || t0; if (t1 && modeOf(t1)) { TAB = t1; MODE = modeOf(t1); MLAST[MODE] = t1; } } catch (e) { /* 무시 */ }
function renderTabs() {
  $('modes').innerHTML = Object.entries(MODES).map(([k, v]) => `<button type="button" data-m="${k}"${pressed(MODE, k)}><b>${v[0]}</b>${v[1]} ${v[2]}</button>`).join('');
  $('tabs').innerHTML = MODES[MODE][3].map(([k, i, n]) => `<button type="button" data-tab="${k}"${pressed(TAB, k)}><span>${i}</span>${n}</button>`).join('');
  $('cutbar').hidden = MODE !== 'song'; document.body.dataset.mode = MODE;
}
$('modes').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (!b) return; setTab(MLAST[b.dataset.m]); window.scrollTo({ top: 0, behavior: 'smooth' }); });
$('tabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (!b) return; setTab(b.dataset.tab); window.scrollTo({ top: 0, behavior: 'smooth' }); });
const cur = () => (SEL >= 0 && SEL < P.clips.length ? P.clips[SEL] : null);
function head(c) {
  if (!c) return `<p class="empty">아래 줄(타임라인)에서 <b>장면을 눌러</b> 골라 주세요.</p>`;
  const k = c.blank ? '⬜ 빈 장면' : c.kind === 'card' ? (c.card === 'title' ? '🎬 오프닝 카드' : '🏁 엔딩 카드') : c.kind === 'video' ? '🎞 동영상' : '🖼 사진', s = SRC.get(c.src);
  return `<div class="ph"><b>장면 ${SEL + 1}</b> <span>${k}${s ? ' · ' + esc(s.code) : ''} · ${clipLen(c).toFixed(1)}초</span></div>`;
}
const chips = (key, map, val, extra) => `<div class="chips">${(Array.isArray(map) ? map : Object.entries(map)).map(([k, v]) => `<button type="button" data-a="${key}" data-v="${esc(k)}"${pressed(String(val), String(k))}>${esc(Array.isArray(v) ? v[0] : v)}</button>`).join('')}${extra || ''}</div>`;
const range = (key, val, min, max, step, lbl) => `<label class="rg"><span>${lbl}</span><input type="range" data-a="${key}" min="${min}" max="${max}" step="${step}" value="${val}"><output>${lbl.includes('%') ? Math.round(val * 100) + '%' : (+val).toFixed(step < 1 ? 1 : 0)}</output></label>`;

function renderPanel() {
  if (!P) return;
  const c = cur(), f = { scene: pEdit, order: pOrder, deco: pDeco, fx: pFx, mus: pMus, lyr: pLyr, sync: pSync, vo: pVo, ai: pAI, info: pInfo, save: pSave }[TAB] || pEdit;
  $('panel').innerHTML = f(c); fillThumbs($('panel'));
  const ta = $('panel').querySelector('textarea[data-auto]'); if (ta) autoGrow(ta);
}
function autoGrow(t) { t.style.height = 'auto'; t.style.height = Math.min(320, t.scrollHeight + 4) + 'px'; }

/* ── ✂️ 편집 ── */
const lenBox = c => `<div class="nudge"><button type="button" data-a="lenn" data-v="-1">−1초</button><button type="button" data-a="lenn" data-v="-0.1">−0.1</button><button type="button" data-a="lenn" data-v="0.1">+0.1</button><button type="button" data-a="lenn" data-v="1">+1초</button></div><p class="hint" style="margin:4px 0 0">지금 <b>${clipLen(c).toFixed(1)}초</b> · 뒤 장면은 <b>${cutMode() === 'ripple' ? 'B 같이 당기기 · 밀기' : 'A 그대로 (다음 장면만 늘고 줄어요)'}</b></p>${chips('cutmode', [['roll', 'A 뒤 장면 그대로'], ['ripple', 'B 뒤 장면 같이 당기기 · 밀기']], cutMode())}`;
const cutHelp = () => `<details class="grp cuthelp"><summary>⏱ 미리보기 아래 「✂️ 여기서 끝 · ➡️ 앞 장면 여기까지 · 🎵 톡톡」 쓰는 법</summary><ol>
  <li>▶로 노래를 듣다가 장면을 바꾸고 싶은 곳에서 ⏸ → <b>◀ 0.1초 ▶</b>로 빨간 커서를 딱 맞춰요.</li>
  <li><b>✂️ 여기서 끝</b> — 빨간 커서가 있는 장면을 여기까지로 → 다음 장면이 바로 여기서 시작해요.</li>
  <li><b>➡️ 앞 장면 여기까지</b> — 장면이 너무 일찍 바뀌었을 때, 커서를 다음 장면 안에 두고 누르면 앞 장면이 커서까지 늘어나요.</li>
  <li><b>🎵 톡톡 넘기기</b> — 노래를 들으며 「다음 장면!」 순간마다 큰 버튼을 톡. 처음부터 끝까지 한 번에 맞춰요. (↩ 다시 = 방금 것 취소)</li>
  <li><b>뒤 장면</b> 버튼으로 바꿔요 — <b>A 그대로</b>: 옆 장면만 늘거나 줄고 그 뒤는 제자리 (뒤쪽을 이미 맞춰 뒀을 때) · <b>B 같이</b>: 뒤 장면 전부가 함께 당겨지거나 밀려요 (⬜ 빈칸 길이를 맞출 때 편해요)</li></ol></details>`;
function pEdit(c) {
  let h = trayBox() + head(c);
  if (c && c.blank) h += blankFill(c);
  if (c) {
    h += c.kind === 'card' ? `<div class="btns4"><button type="button" data-a="mv" data-v="-1">◀ 앞으로</button><button type="button" data-a="mv" data-v="1">뒤로 ▶</button><button type="button" data-a="dup">📄 복제</button><button type="button" data-a="del" class="dg">🗑 지우기</button></div>`
      : `<div class="btns4"><button type="button" data-a="mvfirst">⏮ 맨 앞</button><button type="button" data-a="mv" data-v="-1">◀ 앞으로</button><button type="button" data-a="mv" data-v="1">뒤로 ▶</button><button type="button" data-a="mvlast">맨 뒤 ⏭</button></div>
      <div class="btns4" style="grid-template-columns:2fr 1fr 1fr;margin-top:0"><button type="button" data-a="mvto">🔢 몇 번째로</button><button type="button" data-a="dup">📄 복제</button><button type="button" data-a="del" class="dg">🗑 지우기</button></div>
      <div class="btns2" style="margin-bottom:6px"><button type="button" data-a="swap" style="grid-column:1/-1">🔄 다른 사진으로 바꾸기 <small style="font-weight:600">(시간 · 글씨 · 효과는 그대로)</small></button></div><div class="btns2" style="margin-bottom:6px">${c.pin ? `<button type="button" data-a="pin" data-v="" style="grid-column:1/-1">${c.pin === 'first' ? '📌 첫 화면' : '🏁 엔딩 화면'}으로 고정됨 · 눌러서 고정 풀기</button>` : `<button type="button" data-a="pin" data-v="first">📌 첫 화면으로 고정</button><button type="button" data-a="pin" data-v="last">🏁 엔딩 화면으로 고정</button>`}</div>`;
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
       <div class="grp"><h3>⏸ 마지막 화면 멈춤</h3>${chips('hold', { 0: '없음', 1: '1초', 2: '2초', 3: '3초' }, c.hold || 0)}</div>
       <div class="grp"><h3>⏱ 장면 길이 <small>0.1초 단위</small></h3>${lenBox(c)}</div>`;
    } else if (c.kind === 'image') h += c.blank ? '' : `<div class="grp"><h3>⏱ 보여 줄 시간 <small>0.1초 단위</small></h3>${range('dur', c.dur, .5, 30, .1, '초')}${lenBox(c)}<button type="button" data-a="alldur" class="sec">모든 사진을 ${(+c.dur).toFixed(1)}초로</button></div>`;
    else h += `<div class="grp"><h3>⏱ 카드 시간</h3>${range('dur', c.dur, 1, 20, .1, '초')}${lenBox(c)}<p class="hint">카드 글자는 <b>🏷 정보</b> 탭에서 고쳐요.</p><button type="button" data-a="goinfo" class="sec">🏷 정보 탭 열기</button></div>`;
    if (c.kind !== 'card') h += `<div class="grp"><h3>🖼 화면에 맞추기</h3>${chips('fit', { auto: '자동 (흐린 배경)', cover: '꽉 채우기', contain: '전체 보이기 (검은 배경)' }, c.fit)}<button type="button" data-a="focus" class="sec">📍 ${FOCUS ? '화면을 눌러 주세요…' : '보일 중심 맞추기 (얼굴이 잘릴 때)'}</button></div>`;
    h += `<div class="grp"><h3>🔀 넘어가는 효과 <small>이 장면이 시작될 때</small></h3>${chips('trans', Object.assign({ auto: '추천' }, TRANS), c.trans)}<button type="button" data-a="alltrans" class="sec">모든 장면에 같게</button></div>`;
  }
  h += `<div class="grp"><h3>🗂 전체</h3><div class="btns2"><label class="btnf">＋ 사진 · 동영상 더<input type="file" data-a="addf" accept="image/*,video/*" multiple hidden></label><label class="btnf">📁 내 파일에서 더<input type="file" data-a="addf" multiple hidden></label></div><h4>넣는 곳</h4>${chips('insm', { cur: '📍 빨간 커서 앞 (지금 장면 앞)', end: '⏭ 맨 뒤' }, P.insMode || 'cur')}<p class="hint" style="margin:6px 0 0">📁 「작업 선택」이 나오면 <b>파일</b>을 고르고 → 첫 사진을 <b>꾹(길게) 누르면</b> 여러 장을 고를 수 있어요 → 나머지 톡톡 → 오른쪽 위 <b>「선택」</b></p><div class="btns2"><button type="button" data-a="sortdate">🗓 찍은 날짜 순서로</button></div></div>`;
  return h;
}
/* ── 💬 자막 ── */
function pCap(c) {
  const cd = P.capDef, I = c ? ED.capInfo(c) : null;
  let h = head(c);
  if (c) h += `<div class="grp"><h3>💬 이 장면 글씨 <small>장면 위에 얹는 자막</small></h3><textarea data-a="cap" data-auto rows="2" placeholder="예: 그 시절 우리 ㅋㅋ (줄을 바꾸면 두 줄)">${esc(c.cap.t || '')}</textarea>
    <div class="chips"><span class="lbl">위치</span><button type="button" data-a="cy" data-v=".18">⬆ 위</button><button type="button" data-a="cy" data-v=".5">가운데</button><button type="button" data-a="cy" data-v=".82">⬇ 아래</button><button type="button" data-a="cy" data-v="">스타일대로</button></div>
    <p class="hint">미리보기에서 자막을 <b>손가락으로 끌어</b> 옮길 수도 있어요.</p>
    <details class="sub"><summary>이 장면만 다르게 (모양 · 색 · 크기)</summary>${chips('cst', Object.assign({ '': '전체와 같게' }, Object.fromEntries(Object.entries(CAPS).map(([k, v]) => [k, v.n]))), c.cap.style || '')}
     <div class="colors">${['', ...COLORS].map(v => `<button type="button" data-a="ccol" data-v="${v}" style="${v ? 'background:' + v : ''}"${pressed(c.cap.color || '', v)}>${v ? '' : '기본'}</button>`).join('')}</div>${range('csize', c.cap.size || 1, .5, 2, .05, '크기')}</details></div>`;
  h += `<div class="grp"><h3>🎨 장면 글씨 모양 (전체)</h3>${chips('style', Object.fromEntries(Object.entries(CAPS).map(([k, v]) => [k, v.n])), cd.style)}
    <h4>글씨체</h4><div class="chips">${['', ...FONTS].map(id => `<button type="button" data-a="font" data-v="${id}"${pressed(cd.font || '', id)}>${id ? esc(ENG.fontDef(id).label) : '모양에 맞게'}</button>`).join('')}</div>
    <h4>색</h4><div class="colors">${['', ...COLORS].map(v => `<button type="button" data-a="col" data-v="${v}" style="${v ? 'background:' + v : ''}"${pressed(cd.color || '', v)}>${v ? '' : '기본'}</button>`).join('')}</div>
    ${range('size', cd.size || 1, .6, 1.8, .05, '크기')}
    <h4>나타나는 효과</h4>${chips('anim', Object.assign({ '': '모양에 맞게' }, CAP_ANIMS), cd.anim || '')}</div>
   <div class="grp"><h3>📋 한 번에 쓰기</h3><p class="hint">한 줄에 한 장면씩 (오프닝 · 엔딩 카드는 빼고 순서대로 들어가요)</p><textarea id="capAll" rows="4" placeholder="첫 장면 자막&#10;두 번째 장면 자막">${esc(P.clips.filter(x => x.kind !== 'card').map(x => (x.cap.t || '').replace(/\n/g, ' / ')).join('\n'))}</textarea><button type="button" data-a="capall" class="pri">✅ 순서대로 넣기</button><p class="hint">✏️ 칸의 글을 고치거나 지운 다음에는 <b>꼭 ✅ 순서대로 넣기</b>를 눌러야 화면에 바뀌어요.</p><button type="button" data-a="capclr" class="dg">🗑 장면 자막 전부 지우기</button></div>`;
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
  let h = transBox() + head(c); if (!c) return h;
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
/* ═════════ 순서 도우미: 맨 앞 · 맨 뒤 · 고정(📌 첫 화면 · 🏁 엔딩) · 커서 앞에 넣기 ═════════ */
const isTitle = c => c && c.kind === 'card' && c.card === 'title', isEndC = c => c && c.kind === 'card' && c.card !== 'title';
const freeImg = x => x.kind === 'image' && !x.pin;
function fixPins() {
  if (!P || !P.clips) return; const L = P.clips, selC = SEL >= 0 ? L[SEL] : null;
  const ti = L.filter(isTitle), en = L.filter(isEndC), pf = L.filter(c => c.pin === 'first'), pl = L.filter(c => c.pin === 'last');
  pf.slice(1).forEach(c => { c.pin = null; }); pl.slice(1).forEach(c => { c.pin = null; });
  const f1 = pf[0], l1 = pl[0], mid = L.filter(c => !isTitle(c) && !isEndC(c) && c !== f1 && c !== l1);
  const nl = [...ti, ...(f1 ? [f1] : []), ...mid, ...(l1 ? [l1] : []), ...en];
  if (nl.some((c, i) => c !== L[i])) { P.clips = nl; if (selC) SEL = nl.indexOf(selC); }
}
function movRange() { const L = P.clips; let lo = 0, hi = L.length - 1; while (lo < L.length && (isTitle(L[lo]) || L[lo].pin === 'first')) lo++; while (hi >= 0 && (isEndC(L[hi]) || L[hi].pin === 'last')) hi--; return [lo, Math.max(lo - 1, hi)]; }
function insPos() { if (P.insMode === 'end') return null; const A = clipAt(P, T); if (A.i < 0) return null; const [lo, hi] = movRange(); return clamp(A.i, lo, hi + 1); }
/* 그림 칸 채우기 (data-gth = 자료 id) */
function fillThumbs(root) {
  root.querySelectorAll('[data-gth]').forEach(el => { const th = ED.thumbs.get(el.dataset.gth); if (!th || el.querySelector('canvas')) return; const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96; const r = ED.coverRect(th.width, th.height, 96, 96, .5, .5); cv.getContext('2d').drawImage(th, r[0], r[1], r[2], r[3]); el.prepend(cv); });
}
/* ═════════ 🔀 장면 전환 (전체) · 🥁 박자 ═════════ */
function transBox() {
  const pp = PURPOSE[P.purpose];
  return `<div class="grp"><h3>🔀 장면 전환 (전체) <small>사진이 넘어갈 때 모양</small></h3>${chips('tmode', { one: `🎯 추천 한 가지 (${TRANS[pp.tr] || pp.tr})`, mix: '🎲 골고루 섞기 (자동)', cut: '⚡ 바로 넘기기' }, P.transMode || 'one')}
    <h4>전환 속도</h4>${chips('tspd', { fast: '빠르게', normal: '보통', slow: '느리게' }, P.transSpeed || 'normal')}
    <div class="btns2"><button type="button" data-a="tbeat">🥁 박자에 맞춰 넘기기</button><button type="button" data-a="treset">🔄 손으로 바꾼 것도 전체 방식으로</button></div>
    <p class="hint">장면 하나만 바꾸려면 그 장면을 고르고 ✂️ 편집 탭의 「🔀 넘어가는 효과」에서 골라요 (손으로 바꾼 장면은 그대로 지켜요). 🤖 AI 탭으로 맡기면 AI가 장면마다 어울리는 전환도 골라 줘요.</p></div>`;
}
function findBeats(buf) {
  const sr = buf.sampleRate, hop = 512, ch0 = buf.getChannelData(0), ch1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : ch0, n = Math.floor(ch0.length / hop);
  if (n < 200) return null; const env = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const o = i * hop; for (let k = 0; k < hop; k += 2) { const v = (ch0[o + k] + ch1[o + k]) * .5; s += v * v; } env[i] = Math.log(1e-6 + s); }
  const on = new Float32Array(n); for (let i = 1; i < n; i++) on[i] = Math.max(0, env[i] - env[i - 1]);
  const hs = hop / sr, minL = Math.round(60 / 180 / hs), maxL = Math.round(60 / 65 / hs); let best = 0, bl = minL;
  for (let L = minL; L <= maxL; L++) { let s = 0; for (let i = 0; i + L < n; i++) s += on[i] * on[i + L]; const bpm = 60 / (L * hs), w = Math.exp(-Math.pow(Math.log2(bpm / 115), 2) * 1.5); if (s * w > best) { best = s * w; bl = L; } }
  let bp = 0, bs = -1; for (let ph = 0; ph < bl; ph++) { let s = 0; for (let i = ph; i < n; i += bl) s += on[i]; if (s > bs) { bs = s; bp = ph; } }
  return { period: bl * hs, phase: bp * hs };
}
async function beatSync() {
  let buf = null; const mf = musFile(); if (mf) { const s = SRC.get(mf.id); buf = s && s.buf; }
  if (!buf) { try { buf = await ED.musicBuf(timeline(P).total); } catch (e) { buf = null; } }
  if (!buf) return toast('🎵 음악이 있어야 박자를 찾을 수 있어요');
  busy('🥁 박자 찾는 중…'); await sleep(40); let bt = null; try { bt = findBeats(buf); } catch (e) { bt = null; } busy('');
  if (!bt) return toast('박자를 찾지 못했어요');
  const per = bt.period, beats = per < .45 ? 2 : 1; let t = 0, k = 0;
  for (const c of P.clips) {
    const len = clipLen(c); if (c.kind !== 'image') { t += len; continue; }
    const want = t + c.dur, step = per * beats; let e2 = bt.phase + Math.round((want - bt.phase) / step) * step;
    while (e2 - t < Math.max(1, step * .9)) e2 += step;
    c.dur = Math.round((e2 - t) * 100) / 100; t = e2; k++;
  }
  commit(); renderPanel(); toast(`🥁 박자(약 ${Math.round(60 / per)} BPM)에 맞춰 사진 ${k}장이 넘어가요 · ▶로 들어 보세요`, 4500);
}
/* ═════════ ⬜ 빈 장면: 커서 자리에 빈칸을 끼워 뒤 사진을 밀고 → 나중에 사진으로 채우기 ═════════ */
const blanks = () => P.clips.map((c, i) => c.blank ? i : -1).filter(i => i >= 0);
function blankBox() {
  const B = blanks(), bd = P.blankDur || 4, c = cur();
  let h = `<div class="grp blkbox"><h3 style="margin-top:0">⬜ 빈 장면으로 자리 맞추기</h3>
    <p class="hint" style="margin-top:0">사진이 가사와 <b>어긋나기 시작하는 곳</b>에 보라 동그라미(재생 위치)를 멈추고 누르세요. <b>앞은 그대로</b>, 뒤 사진들은 빈 장면 길이만큼 뒤로 밀려요. 끝까지 맞춘 다음 빈칸에 사진을 넣어요.</p>
    <h4>빈 장면 길이 <small>넣은 다음 0.1초 단위로 고칠 수 있어요</small></h4>${chips('blankdur', [['1', '1초'], ['2', '2초'], ['3', '3초'], ['4', '4초'], ['5', '5초'], ['8', '8초']], bd)}
    <button type="button" data-a="blankins" class="pri" style="width:100%;padding:14px 8px;font-size:1.05rem">⬜ 지금 위치(<span id="blkT">${fmtS(T)}</span>)에 빈 장면 넣기</button>`;
  if (B.length) { const R = blankRuns(); h += `<p style="margin:10px 0 4px">빈 장면 <b>${B.length}개</b> 남았어요</p><div class="btns2"><button type="button" data-a="blanknext" class="sec">➡ 다음 빈칸으로 가기</button><button type="button" data-a="blankdelall" class="dg" style="margin-top:0">🗑 빈칸 전부 지우기</button></div>${R.length ? `<button type="button" data-a="bmergeall" class="sec" style="width:100%;margin-top:8px">🔗 붙어 있는 빈칸 전부 합치기 (${R.map(([lo, hi]) => `${hi - lo + 1}개 → ${runLen(lo, hi).toFixed(1)}초`).join(' · ')})</button>` : ''}`; }
  h += `<p class="hint" style="margin:8px 0 0">💡 빈칸 길이를 노래에 딱 맞추려면: 미리보기 아래 「뒤 장면」을 <b>B 같이</b>로 → ▶ 들으며 빈칸이 끝나야 할 곳에서 ⏸ → <b>✂️ 여기서 끝</b> (뒤 사진이 함께 따라와요)</p>`;
  h += '</div>';
  if (c && c.blank) h += blankFill(c);
  return h;
}
function blankFill(c) {
  const ms = mediaSrcs();
  return `<div class="grp blkbox" style="border-style:solid"><h3 style="margin-top:0">🖼 장면 ${SEL + 1} 빈칸 채우기 <small>${clipLen(c).toFixed(1)}초 · 시간은 그대로</small></h3>
    ${range('dur', c.dur, .5, 30, .1, '빈칸 길이 초')}${lenBox(c)}
    ${(() => { const [lo, hi] = blankRun(SEL); return hi > lo ? `<button type="button" data-a="bmerge" class="pri" style="width:100%;margin-top:8px">🔗 붙어 있는 빈칸 ${hi - lo + 1}개 합치기 → ${runLen(lo, hi).toFixed(1)}초 한 장면</button><p class="hint" style="margin:4px 0 0">${P.clips.slice(lo, hi + 1).map(x => clipLen(x).toFixed(1) + '초').join(' + ')} = ${runLen(lo, hi).toFixed(1)}초 · 합쳐도 뒤 사진 시간은 그대로예요</p>` : ''; })()}
    <div class="btns2"><label class="btnf">📷 갤러리에서 새 사진<input type="file" data-a="blankf" accept="image/*,video/*" multiple hidden></label><label class="btnf">📁 폴더(내 파일)에서<input type="file" data-a="blankf" multiple hidden></label></div>
    <p class="hint">여러 장을 고르면 이 빈칸부터 <b>다음 빈칸들에 차례로</b> 들어가요.</p>
    <h4>넣어 둔 사진에서 고르기</h4>
    <div class="ggrid">${ms.map(id => { const sm = P.srcs.find(s => s.id === id); return `<button type="button" class="gbtn" data-a="blanksel" data-v="${id}"><span data-gth="${id}"></span><small>${esc(sm ? sm.code : '')}${sm && sm.kind === 'video' ? ' 🎞' : ''}</small></button>`; }).join('')}</div>
    <h4>사진을 새로 안 넣고 옆 장면을 늘리기</h4><div class="btns2"><button type="button" data-a="bjoin" data-v="-1">◀ 앞 장면에 붙이기</button><button type="button" data-a="bjoin" data-v="1">뒤 장면에 붙이기 ▶</button></div>
    <p class="hint" style="margin:4px 0 0">빈칸 시간만큼 옆 장면이 길어지고 빈칸은 없어져요 (나머지 장면 시간은 그대로)</p>
    <button type="button" data-a="del" class="dg">🗑 이 빈칸 지우기 (뒤 사진이 다시 당겨져요)</button></div>`;
}
/* 🔗 빈칸 합치기 · 옆 장면에 붙이기 */
function blankRun(i) { let lo = i, hi = i; while (lo > 0 && P.clips[lo - 1].blank) lo--; while (hi < P.clips.length - 1 && P.clips[hi + 1].blank) hi++; return [lo, hi]; }
function blankRuns() { const R = []; for (let i = 0; i < P.clips.length; i++) if (P.clips[i].blank) { const [lo, hi] = blankRun(i); if (hi > lo) R.push([lo, hi]); i = hi; } return R; }
const runLen = (lo, hi) => { let s = 0; for (let j = lo; j <= hi; j++) s += clipLen(P.clips[j]); return r2(s); };
function mergeRun(lo, hi) { const k = P.clips[lo], s = runLen(lo, hi); k.dur = s; P.clips.splice(lo + 1, hi - lo); if (SEL > lo && SEL <= hi) SEL = lo; else if (SEL > hi) SEL -= hi - lo; return s; }
function blankMerge() {
  const c = cur(); if (!c || !c.blank) return; const [lo, hi] = blankRun(SEL); if (hi === lo) return toast('바로 옆에 붙은 빈칸이 없어요');
  const n = hi - lo + 1, s = mergeRun(lo, hi); SEL = lo; T = timeline(P).st[lo] + .02;
  commit(); renderPanel(); drawNow(); toast(`🔗 빈칸 ${n}개를 ${s.toFixed(1)}초 한 장면으로 합쳤어요 · 시간은 그대로예요`, 4000);
}
function blankMergeAll() {
  const R = blankRuns(); if (!R.length) return toast('붙어 있는 빈칸이 없어요'); let n = 0;
  for (let k = R.length - 1; k >= 0; k--) { mergeRun(R[k][0], R[k][1]); n += R[k][1] - R[k][0] + 1; }
  commit(); renderPanel(); drawNow(); toast(`🔗 붙어 있던 빈칸 ${n}개를 ${R.length}개 장면으로 합쳤어요 · 시간은 그대로예요`, 4000);
}
function blankJoin(dir) {   // 빈칸을 없애고 그 시간을 옆 장면에 붙이기 (나머지 장면 시간은 그대로)
  const c = cur(); if (!c || !c.blank) return; const j = SEL + dir, nb = P.clips[j];
  if (!nb) return toast(dir < 0 ? '앞 장면이 없어요' : '뒤 장면이 없어요');
  if (nb.blank) return toast('옆도 빈칸이에요 · 「🔗 빈칸 합치기」를 써 주세요');
  const L = clipLen(nb) + clipLen(c); if (dir < 0) setLenBack(nb, L); else setLenFront(nb, L);
  P.clips.splice(SEL, 1); SEL = dir < 0 ? j : SEL; T = timeline(P).st[SEL] + .02;
  commit(); renderPanel(); drawNow(); toast(`${dir < 0 ? '◀ 앞' : '뒤 ▶'} 장면을 ${clipLen(P.clips[SEL]).toFixed(1)}초로 늘리고 빈칸을 없앴어요`, 4000);
}
function splitAt(i, lt) {   // 장면 i를 lt초에서 둘로 나누기 → 뒤 조각은 i+1
  const c = P.clips[i], d = JSON.parse(JSON.stringify(c)); d.id = uid('c'); d.cap = { t: '' }; d.stk = []; d.vo = null;
  if (c.kind === 'video') { const cut = srcTime(c, lt); d.in = cut; c.out = cut; d.hold = c.hold; c.hold = 0; } else { d.dur = Math.round((c.dur - lt) * 100) / 100; c.dur = Math.round(lt * 100) / 100; }
  d.sfx = (c.sfx || []).filter(s => s.at >= lt).map(s => ({ k: s.k, at: s.at - lt })); c.sfx = (c.sfx || []).filter(s => s.at < lt); d.trans = 'cut';
  P.clips.splice(i + 1, 0, d);
}
function blankIns() {
  const bd = P.blankDur || 4, A = clipAt(P, T), [lo, hi] = movRange(); let pos, how = '';
  if (A.i < 0 || !A.c) pos = hi + 1;
  else { const len = clipLen(A.c);
    if (A.lt < .35) pos = A.i;
    else if (len - A.lt < .35) pos = A.i + 1;
    else if (A.c.kind === 'card' || A.c.blank) pos = A.lt < len / 2 ? A.i : A.i + 1;
    else { splitAt(A.i, A.lt); pos = A.i + 1; how = ' · 그 장면은 둘로 나눴어요 (필요 없으면 뒤 조각 🗑)'; } }
  pos = clamp(pos, lo, hi + 1);
  const b = ED.newClip('image', null, { dur: bd, blank: 1, trans: 'cut', kb: 'none' });
  P.clips.splice(pos, 0, b); SEL = pos; T = timeline(P).st[pos] + .02;
  commit(); makeThumbs(); renderTL(); renderPanel(); drawNow();
  const it = $('tl').querySelector(`.tli[data-i="${pos}"]`); if (it) it.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  toast(`⬜ ${bd}초 빈 장면을 넣었어요 · 뒤 사진은 ${bd}초 밀렸어요${how}`, 4500);
}
function blankFillWith(c, id) {
  const m = P.srcs.find(s => s.id === id), s = SRC.get(id); if (!m || !s) return false;
  const d = clipLen(c); delete c.blank; c.src = id; c.kind = m.kind; c.speed = 1; c.kb = 'auto';
  if (m.kind === 'video') { c.in = 0; c.out = Math.min(s.dur, d); c.hold = s.dur < d ? Math.round((d - s.dur) * 100) / 100 : 0; } else c.dur = d;
  return true;
}
function blankAfterFill(n) {
  commit(); makeThumbs(); renderTL(); renderPanel(); drawNow();
  const left = blanks().length; toast(`🖼 빈칸 ${n}개를 채웠어요${left ? ` · 남은 빈칸 ${left}개 → 「➡ 다음 빈칸으로」` : ' · 빈칸을 다 채웠어요 👍'}`, 4000);
}
async function blankFiles(fs) {
  const start = SEL; if (!P.clips[start] || !P.clips[start].blank) return;
  const targets = blanks().filter(i => i >= start), n0 = P.clips.length, n = await addFiles(fs, start);
  if (!n) return;
  const added = P.clips.splice(start, P.clips.length - n0);   // 새로 들어온 장면은 빼고 자료만 남김
  let k = 0; for (const nc of added) { if (k >= targets.length) break; if (blankFillWith(P.clips[targets[k]], nc.src)) k++; }
  SEL = start; T = timeline(P).st[start] + .02;
  blankAfterFill(k); if (added.length > k) toast(`🖼 ${k}개 빈칸을 채웠어요 · 남은 ${added.length - k}장은 「넣어 둔 사진」에 있어요`, 4500);
}

/* ═════════ 🧩 사진 순서 정하기: 🎤 가사 보며 고르기 · 🤖 AI 짝짓기 · 🔢 순서대로 톡톡 ═════════ */
let ORDM = '', LYROPEN = -1, TAPORD = [], ORDREST = 'after', LMANS = '';
const saveT2 = () => { commit(true); };
function mediaSrcs() { const order = []; P.clips.forEach(c => { if (c.src && !order.includes(c.src) && !c.pin) order.push(c.src); }); P.srcs.forEach(s => { if (s.kind !== 'audio' && !order.includes(s.id) && !P.clips.some(c => c.pin && c.src === s.id)) order.push(s.id); }); return order.filter(id => P.srcs.some(s => s.id === id)); }
function storyRows() { const n = P.lyrics.lines.length; if (!P.story || !Array.isArray(P.story.rows) || P.story.rows.length !== n) P.story = { rows: Array.from({ length: n }, () => []) }; return P.story.rows; }
function lyrUI() {
  const lines = P.lyrics.lines, rows = storyRows(), used = new Map(); rows.forEach((r, i) => r.forEach(id => { if (!used.has(id)) used.set(id, i); }));
  const done = rows.filter(r => r.length).length, ms = mediaSrcs();
  let h = `<div class="grp"><h3>🎤 가사 보며 사진 고르기 <small>가사 ${lines.length}줄 · 고른 줄 ${done}개</small></h3>
    <p class="hint" style="margin-top:0">「📷 사진 고르기」를 누르고 어울리는 사진을 톡톡 (한 줄에 여러 장 가능). 안 고른 줄은 <b>남은 사진으로 자동으로</b> 채워요. 📌 첫 화면 · 🏁 엔딩 고정 사진은 그대로 앞뒤에 있어요.</p>
    <div class="btns2"><button type="button" data-a="lbuild" class="pri">🎬 이 가사 순서로 영상 만들기</button><button type="button" data-a="lclear" class="dg" style="margin-top:0">🗑 고른 것 지우기</button></div></div>`;
  h += lines.map((L, i) => {
    const r = rows[i], open = i === LYROPEN;
    let row = `<div class="lrow${open ? ' open' : ''}"><div class="lrh"><b>${fmtS(L.t)}</b>${esc(L.text)}</div><div class="lph">${r.map(id => `<span class="lth" data-gth="${id}"></span>`).join('')}${r.length ? '' : '<span class="lauto">자동</span>'}<button type="button" data-a="lpick" data-v="${i}" class="sec">${open ? '✅ 다 골랐어요' : r.length ? '✏️ 바꾸기' : '📷 사진 고르기'}</button></div>`;
    if (open) row += `<div class="ggrid">${ms.map(id => { const k = r.indexOf(id), u = used.get(id), sm = P.srcs.find(s => s.id === id); return `<button type="button" class="gbtn${k >= 0 ? ' on' : ''}" data-a="lsel" data-v="${id}"><span data-gth="${id}"></span>${k >= 0 ? `<em>${k + 1}</em>` : u != null && u !== i ? `<i>L${u + 1}</i>` : ''}<small>${esc(sm ? sm.code : '')}</small></button>`; }).join('')}</div><p class="hint">숫자 = 이 줄에서 나오는 순서 · 「L3」 = 다른 줄(3번째)에 이미 고른 사진</p>`;
    return row + '</div>';
  }).join('');
  return h;
}
function buildFromLyrics() {
  const Ly = P.lyrics, mf = musFile(); if (!Ly || !Ly.lines.length || !mf) return toast('먼저 내 음악과 가사를 넣어 주세요');
  if (!confirm2('장면 순서를 가사에 맞게 새로 만들어요.\n(사진 모양 · 효과는 그대로 가져오고, 장면 자막은 다시 넣어야 할 수 있어요 · ↩️ 되돌리기 가능)\n만들까요?')) return;
  const lines = Ly.lines, rows = storyRows(), title = P.clips.find(isTitle), endc = P.clips.find(isEndC), pf = P.clips.find(c => c.pin === 'first'), pl = P.clips.find(c => c.pin === 'last');
  const proto = {}; P.clips.forEach(c => { if (c.src && !proto[c.src]) proto[c.src] = c; });
  const used = new Set(rows.flat()); let pool = mediaSrcs().filter(id => !used.has(id)); const all = mediaSrcs(); let pi = 0;
  const take = () => pool.length ? pool.shift() : (all.length ? all[(pi++) % all.length] : null);
  const out = [];
  const mk = (id, d) => { const s = P.srcs.find(x => x.id === id); if (!s) return null; const c = s.kind === 'image' ? ED.newClip('image', id, { dur: d }) : ED.newClip('video', id, { in: 0, out: Math.min(s.dur, d) }); if (s.kind === 'video' && s.dur < d) c.hold = Math.min(3, d - s.dur); const p = proto[id]; if (p) ['fit', 'fx', 'fy', 'kb', 'filter', 'efx', 'stk', 'blur', 'trans', 'speed', 'mute', 'vol'].forEach(k => { if (p[k] !== undefined) c[k] = JSON.parse(JSON.stringify(p[k])); }); if (s.kind === 'video') { c.speed = 1; c.in = 0; c.out = Math.min(s.dur, d); } return c; };
  const seg = (ids, dur) => { ids = ids.filter(Boolean); if (dur <= .05) return; if (dur < .6 || !ids.length) { const lc = out[out.length - 1]; if (lc && lc.kind === 'image') lc.dur += dur; return; } while (ids.length < 24 && dur / ids.length > 7) { const x = take(); if (!x) break; ids.push(x); } const n = Math.min(ids.length, Math.max(1, Math.floor(dur / 1.2))), d = dur / n; ids.slice(0, n).forEach(id => { const c = mk(id, d); if (c) out.push(c); }); };
  let t = (title ? clipLen(title) : 0) + (pf ? clipLen(pf) : 0); const endT = Math.max(t + 1, mf.dur - (endc ? clipLen(endc) : 0) - (pl ? clipLen(pl) : 0));
  const f0 = Math.min(endT, Math.max(t, lines[0].t)); if (f0 - t > .6) seg(Array.from({ length: Math.max(1, Math.round((f0 - t) / 4)) }, take), f0 - t); else if (out.length === 0 && f0 > t) { /* 짧은 머리 → 첫 줄에 합침 */ }
  t = Math.max(t, Math.min(f0, t + (f0 - t > .6 ? f0 - t : 0)));
  for (let i = 0; i < lines.length && t < endT - .3; i++) {
    const s0 = Math.max(t, lines[i].t), e0 = i + 1 < lines.length ? Math.min(endT, Math.max(s0, lines[i + 1].t)) : endT;
    if (s0 > t + .05) { const lc = out[out.length - 1]; if (lc && lc.kind === 'image') lc.dur += s0 - t; else seg([take()], s0 - t); }
    const ids = rows[i].length ? rows[i].slice() : Array.from({ length: Math.max(1, Math.round((e0 - s0) / 4.5)) }, take);
    seg(ids, e0 - s0); t = e0;
  }
  if (endT - t > .05) { const lc = out[out.length - 1]; if (lc && lc.kind === 'image') lc.dur += endT - t; }
  out.forEach(c => { if (c.kind === 'image') c.dur = Math.round(c.dur * 100) / 100; });
  P.clips = [title, pf, ...out, pl, endc].filter(Boolean); SEL = -1; T = 0; LYROPEN = -1;
  commit(); makeThumbs(); renderPanel(); toast(`🎬 가사 ${lines.length}줄에 맞춰 장면 ${out.length}개를 만들었어요 · ▶로 확인해 보세요`, 5000);
}
function aiUI() {
  const lines = P.lyrics.lines, rows = storyRows(), done = rows.filter(r => r.length).length;
  return `<div class="grp"><h3>① 모아보기 그림 만들기</h3><button type="button" data-a="lmsheet" class="pri">🧩 모아보기 그림 만들기 (사진 번호 붙이기)</button>
    ${sheets.length ? `<div class="sheets">${sheets.map((x, i) => `<a href="${x.url}" target="_blank"><img src="${x.url}" alt="모아보기 ${i + 1}"></a>`).join('')}</div>` : ''}</div>
   <div class="grp"><h3>② AI에게 보내기</h3><div class="two"><button type="button" data-a="lmsend" data-v="gpt" class="gpt">ChatGPT로 보내기</button><button type="button" data-a="lmsend" data-v="gem" class="gem">Gemini로 보내기</button></div>
    <p class="hint">요청서(가사 ${lines.length}줄 포함)가 복사되고 그림을 보낼 곳이 열려요 → AI 앱에서 그림을 올리고 글 칸을 <b>길게 눌러 붙여넣기</b> → 보내기</p>
    <details class="sub"><summary>요청서 보기</summary><pre class="pre">${esc(lmPrompt())}</pre><button type="button" data-a="lmcopy" class="sec">📋 요청서만 복사</button></details></div>
   <div class="grp"><h3>③ AI 답 붙여넣기</h3><textarea id="lmAns" rows="5" placeholder="L1|P3,P7&#10;L2|P12">${esc(LMANS)}</textarea>
    <div class="two"><button type="button" data-a="lmpaste" class="sec">📋 붙여넣기</button><button type="button" data-a="lmapply" class="pri">✅ 가사 줄에 넣기</button></div>
    <p class="hint">넣으면 🎤 「가사 보며 고르기」 화면으로 바뀌어요 → 마음에 안 드는 줄만 고치고 <b>🎬 만들기</b>. 지금 고른 줄: ${done} / ${lines.length}</p></div>`;
}
function lmPrompt() {
  const pp = PURPOSE[P.purpose], L = ['[BK쇼츠 가사 ↔ 사진 짝짓기 요청]', '첨부한 모아보기 그림은 제 사진(P1, P2 …)과 동영상(V1, V2 …)이에요. 각 칸 아래 노란 띠에 번호가 있어요.', '아래는 제가 만든 노래의 가사 줄(L1, L2 …)이에요. 가사 줄마다 그 내용과 분위기에 가장 잘 어울리는 사진 번호를 골라 주세요.', '', `영상 종류: ${pp.ic} ${pp.n}`];
  if (aiExtra.trim()) L.push(`참고: ${aiExtra.trim()}`);
  L.push('', '규칙', '- 한 줄에 사진 1~3개 (짧은 줄은 1개, 긴 줄은 2~3개)', '- 같은 사진은 되도록 한 번만 쓰고, 단체 사진은 후렴(반복되는 힘찬 줄)에 쓰면 좋아요', '- 흐릿하거나 어울리지 않는 사진은 안 써도 돼요', '- 인사말이나 설명 없이 아래 형식의 줄만 써 주세요', '', '형식', 'L1|P3,P7', 'L2|P12', '', '가사');
  P.lyrics.lines.forEach((x, i) => L.push(`L${i + 1} [${fmtS(x.t)}] ${x.text}`));
  return L.join('\n');
}
function lmApply(text) {
  const rows = storyRows(); let n = 0;
  String(text || '').split(/\r?\n/).forEach(l => { const m = l.trim().replace(/^[-*•]\s*/, '').match(/^L\s*(\d+)\s*[|:：]\s*(.+)$/i); if (!m) return; const i = +m[1] - 1; if (!rows[i]) return; const ids = (m[2].toUpperCase().match(/[PV]\d+/g) || []).map(code => (P.srcs.find(s => s.code === code) || {}).id).filter(Boolean); if (ids.length) { rows[i] = ids; n++; } });
  if (!n) return toast('읽을 줄이 없어요 · 「L1|P3,P7」 모양인지 확인해 주세요', 5000);
  saveT2(); ORDM = 'lyr'; LYROPEN = -1; renderPanel(); toast(`🤖 가사 ${n}줄에 AI가 고른 사진을 넣었어요 · 확인하고 🎬 만들기`, 5000);
}
function tapUI() {
  const [lo, hi] = movRange(), mid = P.clips.slice(lo, hi + 1);
  if (!mid.length) return '<div class="grp"><p class="empty">정리할 장면이 없어요.</p></div>';
  TAPORD = TAPORD.filter(id => mid.some(c => c.id === id));
  return `<div class="grp"><h3>🔢 순서대로 톡톡 <small>${TAPORD.length} / ${mid.length}장</small></h3>
    <p class="hint" style="margin-top:0">보여 줄 순서대로 사진을 톡톡 누르세요 (다시 누르면 빠져요). <b>꾹 누르면</b> 「몇 번과 몇 번 사이」에 그 사진을 한 번 더 넣어요. 📌 첫 화면 · 🏁 엔딩 고정 · 오프닝 · 엔딩 카드는 그대로예요.</p>
    <div class="ggrid">${mid.map(c => { const k = TAPORD.indexOf(c.id), sm = P.srcs.find(s => s.id === c.src); return `<button type="button" class="gbtn${k >= 0 ? ' on' : ''}" data-a="otap" data-v="${c.id}" data-lp="ord"><span data-gth="${c.src}"></span>${k >= 0 ? `<em>${k + 1}</em>` : ''}<small>${esc(sm ? sm.code : '')}${c.kind === 'video' ? ' 🎞' : ''}</small></button>`; }).join('')}</div>
    <h4>안 누른 사진은</h4>${chips('orest', { after: '뒤에 그대로 두기', drop: '빼기' }, ORDREST)}
    <div class="btns2"><button type="button" data-a="otapok" class="pri">✅ 이 순서로 정리</button><button type="button" data-a="otapclr" class="sec" style="margin-top:0">↺ 처음부터</button></div></div>`;
}
function tapApply() {
  if (!TAPORD.length) return toast('사진을 순서대로 눌러 주세요');
  const [lo, hi] = movRange(), mid = P.clips.slice(lo, hi + 1), sel = TAPORD.map(id => mid.find(c => c.id === id)).filter(Boolean), rest = mid.filter(c => !sel.includes(c));
  if (ORDREST === 'drop' && rest.length && !confirm2(`안 누른 ${rest.length}장을 영상에서 뺄까요? (↩️ 되돌리기 가능)`)) return;
  P.clips.splice(lo, hi - lo + 1, ...sel, ...(ORDREST === 'drop' ? [] : rest)); TAPORD = []; SEL = lo; T = timeline(P).st[lo] + .02;
  commit(); renderPanel(); toast(`🔢 ${sel.length}장을 순서대로 정리했어요`);
}

/* ── 🎵 노래 끝까지: 사진 시간 자동 맞추기 ──
   사진 한 장은 3.5~5초가 보기 좋아요 → 노래 1분에 사진 12~17장.
   · ⏱ 사진 시간 늘리기: 지금 사진만으로 노래 길이를 나눔 (한 장이 너무 길어지면 반복을 권함)
   · 🔁 사진 한 번 더 보여 주기: 한 장 4.5초가 되게, 모자란 만큼 사진을 섞어서 뒤쪽에 한 번 더 (같은 사진이 붙어 나오지 않게) */
function musFile() { const M = P.music; if (M.kind !== 'file' || !M.fileId) return null; const s = P.srcs.find(x => x.id === M.fileId); return s && s.dur ? s : null; }
function musFitInfo() {
  const mf = musFile(); if (!mf) return null;
  const imgs = P.clips.filter(freeImg), fixed = P.clips.filter(x => !freeImg(x)).reduce((a, x) => a + clipLen(x), 0);
  const L = mf.dur, avail = L - fixed, n = imgs.length, per = n ? avail / n : 0, reps = imgs.filter(x => x.rep).length;
  return { L, avail, n, per, reps, lo: Math.max(1, Math.round(avail / 5)), hi: Math.max(1, Math.round(avail / 3.5)), total: timeline(P).total };
}
function musFitBox() {
  const f = musFitInfo(); if (!f) return P.music.kind === 'file' ? '' : '<p class="hint">💡 기본 음악은 영상 길이에 맞춰 자동으로 연주돼요. <b>내 음악(MP3)</b>을 넣으면 「노래 끝까지 자동 맞추기」가 나와요.</p>';
  const orig = f.n - f.reps, per = Math.max(0, f.per), slow = per > 6, few = per > 12, many = f.avail / Math.max(1, f.n) < 1.5;
  return `<div class="grp" style="background:#fff8e6;border:2px solid #f2c14e;border-radius:14px;padding:10px 12px;margin-top:10px"><h3 style="margin-top:0">🎵 노래 끝까지 — 사진 시간 자동 맞추기</h3>
    <p>노래 <b>${fmtS(f.L)}</b> · 지금 영상 <b>${fmtS(f.total)}</b> · 사진 <b>${orig}장</b>${f.reps ? ` (+ 한 번 더 ${f.reps}장)` : ''}</p>
    <p class="hint">📌 이 노래에는 사진 <b>${f.lo}~${f.hi}장</b>이 딱 좋아요 (한 장 3.5~5초). 노래 1분에 사진 12~17장 정도예요.</p>
    <button type="button" data-a="tbeat" class="sec" style="margin-bottom:6px">🥁 박자에 맞춰 사진 넘기기 <small>(맞추기 다음에 누르세요)</small></button>
    <div class="btns2"><button type="button" data-a="mfit" data-v="stretch" class="pri">⏱ 지금 사진으로 맞추기<small style="display:block;font-weight:600">한 장 ${per.toFixed(1)}초${few ? ' → 최대 12초' : ''}</small></button><button type="button" data-a="mfit" data-v="repeat">🔁 사진 한 번 더 섞어서<small style="display:block;font-weight:600">한 장 4.5초쯤 · 같은 사진 최대 2번 더</small></button></div>
    ${many ? '<p class="hint" style="color:#b91c1c">⚠️ 사진이 노래보다 많아요. 맞추면 한 장이 아주 짧아져요 (사진을 줄이거나 더 긴 노래로).</p>' : slow ? '<p class="hint">💡 한 장이 6초가 넘으면 지루할 수 있어요 → <b>🔁 섞어서 한 번 더</b>나 사진을 더 넣는 걸 추천해요. 사진 움직임(천천히 확대)도 켜져요.</p>' : ''}
    ${f.reps ? '<button type="button" data-a="mfit" data-v="unrep" class="sec">↩ 한 번 더 넣은 사진 빼기</button>' : ''}</div>`;
}
function musFit(mode) {
  const f = musFitInfo(); if (!f) return toast('먼저 📁 내 음악 파일을 넣어 주세요');
  if (mode === 'unrep' || mode === 'repeat') { P.clips = P.clips.filter(x => !x.rep); }
  let imgs = P.clips.filter(freeImg); if (!imgs.length) return toast('사진이 없어요');
  const fixed = P.clips.filter(x => !freeImg(x)).reduce((a, x) => a + clipLen(x), 0), avail = f.L - fixed;
  if (mode === 'repeat') {
    const want = Math.max(imgs.length, Math.round(avail / 4.5)), extra = Math.min(want - imgs.length, imgs.length * 2); /* 같은 사진은 최대 2번 더 */
    if (extra > 0) {
      const sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
      const add = []; let pool = [], last = imgs[imgs.length - 1];
      while (add.length < extra) { if (!pool.length) pool = sh(imgs); let k = pool.findIndex(x => x.src !== (add.length ? add[add.length - 1].src : last.src)); if (k < 0) k = 0; const o = pool.splice(k, 1)[0], d = JSON.parse(JSON.stringify(o)); d.id = uid('c'); d.rep = 1; d.cap = { t: '' }; d.sfx = []; d.vo = null; d.trans = 'auto'; add.push(d); }
      const pos = movRange()[1] + 1;
      P.clips.splice(pos, 0, ...add); imgs = P.clips.filter(freeImg);
    }
  }
  if (mode === 'unrep') { commit(); renderPanel(); return toast('↩ 한 번 더 넣은 사진을 뺐어요'); }
  const per = Math.round(Math.min(12, Math.max(1, avail / imgs.length)) * 10) / 10;
  imgs.forEach(x => { x.dur = per; if (per > 5 && (!x.kb || x.kb === 'auto')) x.kb = 'auto'; });
  if (!P.music.fade || P.music.fade < 2.5) P.music.fade = 5;
  commit(); makeThumbs(); renderPanel();
  const tot = timeline(P).total;
  toast(per >= 12 && tot < f.L - 1 ? `사진이 모자라 ${fmtS(tot)}까지만 채웠어요 · 🔁 섞어서 한 번 더를 눌러 보세요` : `🎵 노래 끝까지! 사진 ${imgs.length}장 × ${per}초 = ${fmtS(tot)}`, 4500);
}
/* ── 🎤 노래 가사 자막 ──
   ① 가사 붙여넣기 (시간 없이도 OK · [00:15] 같은 시간이 있으면 그대로 · .lrc · .srt 도 OK)
   ② 🤖 Gemini에 MP3를 올려 가사와 시간을 받아 오기 ③ 👆 노래 들으며 줄마다 톡톡 눌러 시간 맞추기 ④ ↔ 고르게 나누기 */
let LYT = -1;   // 톡톡 맞추기 중인 줄 (-1 = 아님)
function lyrParse(text) {
  const raw = String(text || '').replace(/```[a-z]*/gi, '');
  const toS = (h, m, s, f) => (+h || 0) * 3600 + (+m) * 60 + (+s) + (f ? +('0.' + f) : 0);
  if (/-->/.test(raw)) {
    const out = []; raw.split(/\r?\n\s*\r?\n/).forEach(b => { const ls = b.split(/\r?\n/).map(s => s.trim()).filter(Boolean), k = ls.findIndex(l => /-->/.test(l)); if (k < 0) return; const m = ls[k].match(/(\d+):(\d+):(\d+)[,.](\d+)/); if (!m) return; const tx = ls.slice(k + 1).join(' ').trim(); if (tx) out.push({ t: toS(m[1], m[2], m[3], m[4]), text: tx }); });
    return { timed: out.length > 0, lines: out };
  }
  const out = []; let timed = 0;
  raw.split(/\r?\n/).forEach(l => {
    l = l.trim().replace(/^[-*•]\s*/, ''); if (!l) return;
    const m = l.match(/^\[?(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]?\s*[-–:]?\s*(.*)$/);
    if (m) { const tx = m[4].replace(/^\[?\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]?\s*/, '').trim(); if (tx && !/^[\[(].*[\])]$/.test(tx)) { out.push({ t: toS(0, m[1], m[2], m[3]), text: tx }); timed++; } return; }
    if (/^[\[(].*[\])]$/.test(l)) return;   // [Verse] [후렴] (간주) 같은 표시는 빼기
    out.push({ t: null, text: l });
  });
  return { timed: timed > 0 && timed >= out.length * .6, lines: out.filter(x => x.t != null || timed === 0) };
}
function lyrSpread(lines, L) { const s0 = Math.min(10, L * .06), e = L - Math.min(8, L * .05), st = (e - s0) / Math.max(1, lines.length); lines.forEach((x, i) => { x.t = Math.round((s0 + i * st) * 10) / 10; }); }
function lyrBox() {
  const mf = musFile(); if (!mf) return '';
  const Ly = P.lyrics || {}, n = (Ly.lines || []).length, on = n && Ly.on;
  let h = `<div class="grp" style="background:#f5f3ff;border:2px solid #c4b5fd;border-radius:14px;padding:10px 12px;margin-top:10px"><h3 style="margin-top:0">🎤 노래 가사 자막 <small>노래에 맞춰 한 줄씩 나와요</small></h3>`;
  if (LYT >= 0) {
    const cur = Ly.lines[LYT];
    h += `<p><b>👆 톡톡 맞추기 중</b> — 노래를 듣다가 <b>이 줄을 부르기 시작할 때</b> 큰 버튼을 누르세요. (${LYT + 1} / ${n})</p><button type="button" data-a="lyrtap" class="pri" style="width:100%;padding:18px 10px;font-size:1.1rem">▶ 「${esc(cur ? cur.text.slice(0, 22) : '')}」 시작!</button><div class="btns2" style="margin-top:8px"><button type="button" data-a="lyrtapback" class="sec">↶ 한 줄 전으로</button><button type="button" data-a="lyrtapstop" class="sec">■ 그만 (나머지는 고르게)</button></div></div>`;
    return h;
  }
  h += `<textarea data-a="lyr" rows="5" placeholder="가사를 붙여넣으세요 (한 줄에 한 마디)\n시간이 있으면 그대로 써요: [00:15] 첫 줄 가사\n[Verse] · [후렴] 같은 표시는 자동으로 빠져요">${esc(Ly.raw || '')}</textarea>
    <p id="lyrWarn" class="lyrwarn"${lyrNeed() ? '' : ' hidden'}>⚠️ 붙여넣은 가사는 바로 아래 <b>✅ 가사 넣기 (저장)</b>을 눌러야 자막으로 나와요</p>
    <div class="btns2"><button type="button" data-a="lyrset" class="pri">✅ 가사 넣기 (저장)</button><button type="button" data-a="lyrai">🤖 Gemini로 가사 · 시간 받기</button></div>
    <p class="hint">🤖 <b>수노 가사를 먼저 위 칸에 붙여넣고</b> 버튼을 누르면 요청 글(가사 포함)이 복사되고 Gemini가 열려요.<br>Gemini에서 <b>① 아래 ＋ → 파일 → 이 MP3를 꼭 먼저 올리고</b> ② 입력칸을 길게 눌러 붙여넣기 ③ 보내기 → 시간이 붙은 가사를 통째로 복사해서 위 칸에 붙여넣고 ✅.<br>⚠️ MP3를 안 올리면 「파일이 보이지 않습니다」라고 해요. 그래도 안 해 주면 <b>👆 톡톡 맞추기</b>가 가장 확실해요.</p>`;
  if (n) {
    h += `<p>✅ 가사 <b>${n}줄</b> · ${Ly.timed ? '시간 맞춤' : '고르게 나눔'}</p>
      <div class="chips"><button type="button" data-a="lyron" data-v="1"${pressed(!!on, true)}>🎤 자막 켜기</button><button type="button" data-a="lyron" data-v="0"${pressed(!!on, false)}>끄기</button></div>
      <h4>시간 맞추기</h4><div class="btns2"><button type="button" data-a="lyrtapgo" class="pri">👆 노래 들으며 톡톡 맞추기</button><button type="button" data-a="lyreven">↔ 고르게 나누기</button></div>
      <div class="chips"><button type="button" data-a="lyrshift" data-v="-0.5">전체 −0.5초 (빨리)</button><button type="button" data-a="lyrshift" data-v="0.5">전체 +0.5초 (늦게)</button></div>
      <h4>모양</h4><div class="chips">${[['karaoke', '🎤 노래방 (노랗게 채워짐)'], ['white', '흰 글씨'], ['band', '검은 띠']].map(([k, nm]) => `<button type="button" data-a="lyrst" data-v="${k}"${pressed(Ly.style || 'karaoke', k)}>${nm}</button>`).join('')}</div>
      <h4>가사 글씨 크기</h4>${range('lyrsz', Ly.size || 1.3, .6, 2.5, .05, '크기')}
      <div class="chips">${[['bottom', '⬇ 아래'], ['mid', '가운데'], ['top', '⬆ 위']].map(([k, nm]) => `<button type="button" data-a="lyrpos" data-v="${k}"${pressed(Ly.pos || 'bottom', k)}>${nm}</button>`).join('')}</div>
      <ul class="lst" style="max-height:180px;overflow:auto">${Ly.lines.map(x => `<li>${fmtS(x.t)} · ${esc(x.text)}</li>`).join('')}</ul>
      <p class="hint">💡 영상이 노래보다 짧으면 뒷부분 가사가 안 나와요 → 위의 「노래 끝까지 맞추기」를 먼저 해 주세요. 장면 자막과 겹치면 가사를 ⬆ 위로 옮기세요.</p>`;
  }
  return h + '</div>';
}
function lyrCmd(a, v) {
  const mf = musFile(); if (!mf) return toast('먼저 📁 내 음악 파일을 넣어 주세요');
  P.lyrics = P.lyrics || { on: 1, lines: [], raw: '', style: 'karaoke', pos: 'bottom' }; const Ly = P.lyrics;
  if (a === 'lyrset') { const r = lyrParse(Ly.raw); if (!r.lines.length) return toast('가사를 먼저 붙여넣어 주세요'); Ly.lines = r.lines; Ly.timed = r.timed; Ly.rawSet = Ly.raw; if (!r.timed) lyrSpread(Ly.lines, mf.dur); Ly.lines.sort((p, q) => p.t - q.t); Ly.on = 1; commit(); renderPanel(); return toast(r.timed ? `🎤 가사 ${Ly.lines.length}줄을 시간에 맞춰 넣었어요 · ▶로 확인해 보세요` : `🎤 가사 ${Ly.lines.length}줄을 고르게 나눴어요 · 「👆 톡톡 맞추기」로 정확히 맞출 수 있어요`, 4500); }
  if (a === 'lyrai') { const t = '(이 메시지와 함께 제가 만든 노래 MP3 파일을 첨부했어요)\n첨부한 노래(MP3)의 가사를 들리는 대로 받아 적어 주세요.\n- 한 줄씩 나눠서, 줄마다 맨 앞에 그 줄을 부르기 시작하는 시간을 [분:초] 형식으로 붙여 주세요. 예: [00:15] 첫 줄 가사\n- 반주만 나오는 부분(간주)은 쓰지 마세요.\n- 한 줄은 화면 자막에 맞게 15자 안팎으로 짧게 나눠 주세요.\n- 다른 설명 없이 시간과 가사만 써 주세요.' + (Ly.raw && Ly.raw.trim() ? '\n\n아래는 원래 가사예요. 이 글자 그대로 쓰고 시간만 맞춰 주세요:\n' + Ly.raw.trim() : ''); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => toast('📋 복사했어요 · Gemini에서 ① ＋로 MP3 먼저 올리기 ② 붙여넣기 ③ 보내기', 6000)).catch(() => {}); setTimeout(() => g.open('https://gemini.google.com/app', '_blank'), 300); return; }
  if (a === 'lyron') { Ly.on = +v; commit(); renderPanel(); return; }
  if (a === 'lyreven') { lyrSpread(Ly.lines, mf.dur); Ly.timed = 0; commit(); renderPanel(); return toast('↔ 고르게 나눴어요'); }
  if (a === 'lyrshift') { Ly.lines.forEach(x => { x.t = Math.max(0, Math.round((x.t + +v) * 10) / 10); }); commit(); renderPanel(); return; }
  if (a === 'lyrst') { Ly.style = v; commit(); renderPanel(); return; }
  if (a === 'lyrpos') { Ly.pos = v; commit(); renderPanel(); return; }
  if (a === 'lyrtapgo') { if (timeline(P).total < mf.dur - 3) toast('💡 영상이 노래보다 짧아요 → 「노래 끝까지 맞추기」를 먼저 하면 끝까지 맞출 수 있어요', 4500); Ly.on = 1; LYT = 0; if (PLAY) pause(); T = 0; renderPanel(); play(); return; }
  if (a === 'lyrtap') { if (LYT < 0) return; Ly.lines[LYT].t = Math.round(T * 10) / 10; LYT++; if (LYT >= Ly.lines.length) { LYT = -1; Ly.timed = 1; commit(); renderPanel(); return toast('✅ 가사 시간을 다 맞췄어요 · ▶로 확인해 보세요'); } renderPanel(); return; }
  if (a === 'lyrtapback') { if (LYT > 0) { LYT--; T = Math.max(0, Ly.lines[LYT].t - 2); if (PLAY) { pause(); play(); } } renderPanel(); return; }
  if (a === 'lyrtapstop') { if (LYT > 0) { const done = LYT, last = Ly.lines[done - 1].t, e = mf.dur - Math.min(8, mf.dur * .05), rest = Ly.lines.length - done, st = (e - last) / Math.max(1, rest + 1); for (let i = done; i < Ly.lines.length; i++) Ly.lines[i].t = Math.round((last + (i - done + 1) * st) * 10) / 10; } LYT = -1; if (PLAY) pause(); commit(); renderPanel(); return toast('■ 그만했어요 · 남은 줄은 고르게 나눴어요'); }
}
/* ── 🎵 소리 ── */
/* ── ② 🎤 노래 맞추기 탭들 ── */
function pMus(c) {
  const M = P.music, pp = PURPOSE[P.purpose], L = (g.BKMUSIC && g.BKMUSIC.LIST) || [];
  return `<div class="grp"><h3>🎵 배경 음악</h3><h4>내 음악 (수노 MP3 등)</h4><label class="btnf ${M.kind === 'file' ? 'on' : ''}">📁 내 음악 파일 고르기 ${M.kind === 'file' ? '(넣음)' : ''}<input type="file" data-a="musf" accept="audio/*,.mp3,.m4a,.wav" hidden></label>${musFitBox()}
    ${M.kind === 'file' ? `<button type="button" data-a="gotab" data-v="lyr" class="sec">🎤 노래방 가사 자막 넣으러 가기</button>` : ''}
    <h4>프로그램 음악</h4><div class="chips"><button type="button" data-a="mus" data-v="auto"${pressed(M.kind, 'auto')}>✨ 추천 (${esc(g.BKMUSIC ? g.BKMUSIC.label(pp.mus) : pp.mus)})</button><button type="button" data-a="mus" data-v="none"${pressed(M.kind, 'none')}>🔇 음악 없음</button></div>
    ${L.map(([gn, items]) => `<h4>${esc(gn)}</h4><div class="chips">${items.map(([k, n]) => `<button type="button" data-a="mus" data-v="${k}"${pressed(M.kind, k)}>${esc(n)}</button>`).join('')}</div>`).join('')}
    <p class="hint">홍보 영상에는 <b>저작권 걱정 없는 음악</b>만 쓰세요. 기본 음악은 프로그램이 직접 연주해서 괜찮아요.</p>
    ${range('mvol', M.vol, 0, 1.2, .05, '음악 크기 %')}${chips('duck', [['1', '🗣 말소리 나올 때 음악 작게'], ['0', '항상 같은 크기']], M.duck ? 1 : 0)}
    <h4>끝날 때 음악 줄이기</h4>${chips('mfade', [['0', '바로 끝'], ['2.5', '2.5초'], ['5', '5초']], M.fade)}</div>
   <div class="grp"><h3>🎞 동영상 원래 소리 (전체)</h3>${range('cvol', P.clipVol, 0, 1.5, .05, '크기 %')}</div><button type="button" data-a="play" class="pri">▶ 소리까지 미리 듣기</button>`;
}
function pLyr() {
  if (!musFile()) return `<div class="grp"><h3>🎤 노래방 가사 자막</h3><p style="margin-top:0">먼저 <b>내 음악(MP3)</b>을 넣어 주세요. 가사를 그 노래에 맞춰 노래방처럼 보여 줘요.</p><label class="btnf">📁 내 음악 파일 고르기<input type="file" data-a="musf" accept="audio/*,.mp3,.m4a,.wav" hidden></label><p class="hint">수노에서 받은 MP3를 고르면 돼요. 프로그램 음악은 🎵 음악 탭에 있어요.</p></div>`;
  let h = lyrBox(); const Ly = P.lyrics;
  if (Ly && Ly.lines && Ly.lines.length) { if (ORDM !== 'ai') ORDM = 'lyr'; h += `<div class="grp"><h3>🖼 가사 줄마다 사진 고르기 <small>그 가사를 부르는 동안 그 사진이 나와요</small></h3>${chips('ordm', { lyr: '🎤 내가 고르기', ai: '🤖 AI가 짝짓기' }, ORDM)}</div>` + (ORDM === 'ai' ? aiUI() : lyrUI()); }
  return h;
}
function pSync() {
  return cutHelp().replace('<details class="grp cuthelp">', '<details class="grp cuthelp" open>') + blankBox()
    + `<div class="grp"><h3>🥁 박자에 맞춰 넘기기</h3><button type="button" data-a="tbeat" class="sec">🥁 사진이 노래 박자에 맞춰 넘어가게</button><p class="hint">노래의 박자를 찾아 사진 길이를 박자에 맞춰요. 그다음 ✂️ · 🎵 톡톡으로 다듬으면 돼요.</p></div>`;
}
function pVo(c) {
  let h = head(c) + `<div class="grp"><h3>🎙 내 목소리 넣기 ${c ? `<small>장면 ${SEL + 1}에</small>` : ''}</h3>`;
  if (!c) h += '<p class="empty">아래 사진 줄에서 장면을 먼저 골라 주세요.</p>';
  else if (c.vo && SRC.get(c.vo.src)) h += `<p>🎤 목소리 ${SRC.get(c.vo.src).dur.toFixed(1)}초</p>${range('vovol', c.vo.vol || 1.2, .3, 2, .05, '목소리 크기 %')}<div class="btns2"><button type="button" data-a="voplay">▶ 들어 보기</button><button type="button" data-a="vodel" class="dg">🗑 지우기</button></div>`;
  else h += `<button type="button" data-a="rec" class="pri" id="recBtn">${REC ? '■ 녹음 멈추기' : '● 녹음 시작'}</button><p class="hint">장면을 설명하는 말, 부모님께 드리는 편지 등을 직접 녹음해 넣어요. 녹음이 나오는 동안 음악은 작아져요.</p>`;
  return h + `</div><button type="button" data-a="play" class="pri">▶ 소리까지 미리 듣기</button>`;
}
/* ── ① 😀 글씨·스티커 (장면 글씨 + 스티커 한곳에) ── */
function pDeco(c) {
  return `<p class="hint" style="margin:0 0 8px">🎤 노래 가사 자막은 <b>② 노래 맞추기 › 🎤 가사</b>에 있어요. 여기는 장면 위에 얹는 글씨 · 스티커예요.</p>` + pCap(c) + pStk(c).replace(head(c), '');
}
/* ── ① 🧩 순서 ── */
function pOrder() {
  return `<div class="grp"><h3>🧩 순서 바꾸는 방법</h3><ul class="tips"><li>아래 사진 줄에서 사진을 <b>꾹 누른 채 끌면</b> 옮겨져요</li><li><b>꾹 눌렀다 떼면</b> 📄 복사 · 📍 몇 번 사이에 · ↔ 옮기기 · 🔄 바꾸기 메뉴</li><li>✂️ 장면 탭: ⏮ 맨 앞 · 맨 뒤 ⏭ · 🔢 몇 번째로 · 📌 고정</li><li>가사에 맞춰 사진 고르기 → <b>② 노래 맞추기 › 🎤 가사</b></li></ul>
    <div class="btns2"><button type="button" data-a="sortdate">🗓 찍은 날짜 순서로</button><button type="button" data-a="gotab" data-v="lyr">🎤 가사 보며 고르기로</button></div></div>` + tapUI();
}
/* 🎤 가사: 붙여넣으면 바로 저장 · ✅ 안 누르면 알려 주기 */
function lyrNeed() { const Ly = P && P.lyrics; if (!Ly || !(Ly.raw || '').trim()) return false; if (!(Ly.lines || []).length) return true; return Ly.rawSet != null && Ly.raw !== Ly.rawSet; }
function lyrWarnUpd() { const el = $('lyrWarn'); if (el) el.hidden = !lyrNeed(); }
function lyrRemind() { if (lyrNeed()) toast('🎤 붙여넣은 가사는 「✅ 가사 넣기 (저장)」을 눌러야 자막으로 나와요', 5000); }
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
  const trList = '스르르, 줌, 줌축소, 휙, 옆으로, 위로, 번쩍, 검은화면, 닦아내기, 동그랗게, 흐릿하게, 빙글, 지지직, 하트, 바로', fxList = '확대, 흔들림, 번쩍, 느리게, 빠르게, 멈춤, 흑백, 옛날필름, 하트, 꽃가루, 눈, 꽃잎', sfxList = '박수, 띠용, 뿅, 두둥, 딩동댕, 땡, 휙, 짜잔, 찰칵, 두구두구, 반짝, 두근';
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
  L.push('- 자막은 한 줄 15자 안팎, 길면 두 줄까지. 모르는 사람 이름은 지어내지 마세요', `- 효과는 이 중에서만 (없으면 비워 두기): ${fxList}`, `- 효과음은 이 중에서만 (없으면 비워 두기): ${sfxList}`, `- 전환(이 장면이 시작될 때 넘어가는 모양)은 장면 분위기에 맞게 골고루, 이 중에서만: ${trList}`, '- 인사말이나 설명 없이 아래 형식의 줄만 써 주세요', '', '형식');
  if (aiMode === 'caps') L.push('제목|오프닝 카드에 쓸 제목', 'C1|자막|효과|효과음|전환', 'C2|자막|효과|효과음|전환', '엔딩|마지막 카드 문구');
  else L.push('제목|영상 제목', '장면|자료|시작초|끝초|자막|효과|효과음|전환', '1|P3|0|4|그 시절 우리|확대||스르르', '2|V1|12|18|이 표정 실화냐ㅋㅋ|흔들림|띠용|휙', '엔딩|마지막 카드 문구', '음악|잔잔한 · 신나는 · 감동 · 귀여운 · 웅장한 · 감성 중 하나');
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
      c.cap.t = f[1] || ''; applyFx(c, f[2]); applySfx(c, f[3]); applyTr(c, f[4]); n++;
    } else {
      const code = (f[1] || '').toUpperCase().match(/[PV]\d+/); if (!code) continue;
      const s = P.srcs.find(x => x.code === code[0]); if (!s) continue;
      let a = secs(f[2]), b = secs(f[3]); const c = ED.newClip(s.kind, s.id);
      if (s.kind === 'image') c.dur = clamp(b > 0 ? b - (a > 0 && a < b ? a : 0) : pp.img, 1.5, 10);
      else { a = clamp(isNaN(a) ? 0 : a, 0, Math.max(0, s.dur - .3)); b = isNaN(b) || b <= a ? Math.min(s.dur, a + 4) : Math.min(s.dur, b); if (b - a < .4) b = Math.min(s.dur, a + .4); c.in = a; c.out = b; }
      c.cap.t = (f[4] || '').replace(/\\n|\/\s/g, '\n'); applyFx(c, f[5]); applySfx(c, f[6]); applyTr(c, f[7]); scenes.push(c);
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
const TRMAP = [[/스르/, 'fade'], [/줌\s*축소|축소/, 'zoomout'], [/줌|확대/, 'zoom'], [/휙/, 'whoosh'], [/옆/, 'slide'], [/위로/, 'up'], [/번쩍|하얀/, 'white'], [/검은/, 'black'], [/닦/, 'wipe'], [/동그/, 'circle'], [/흐릿|블러/, 'blur'], [/빙글|회전/, 'spin'], [/지지|글리치/, 'glitch'], [/하트/, 'heart'], [/바로|컷/, 'cut']];
function applyTr(c, s) { if (!s) return; const m = TRMAP.find(([r]) => r.test(s)); if (m) c.trans = m[1]; }
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
  if (a === 'dur' && c) { setEnd(SEL, timeline(P).st[SEL] + +v); drawNow(); return; }
  if (a === 'vol' && c) { c.vol = +v; return; } if (a === 'mvol') { P.music.vol = +v; return; } if (a === 'cvol') { P.clipVol = +v; return; } if (a === 'vovol' && c && c.vo) { c.vo.vol = +v; return; }
  if (a === 'size') { P.capDef.size = +v; drawNow(); return; } if (a === 'csize' && c) { c.cap.size = +v; drawNow(); return; }
  if (a === 'ss' && c && SELOV) { c.stk[SELOV.k].s = +v; drawNow(); return; } if (a === 'sv' && c && SELOV) { c.stk[SELOV.k].v = v; drawNow(); return; }
  if ((a === 'bw' || a === 'bh') && c && SELOV) { c.blur[SELOV.k][a === 'bw' ? 'w' : 'h'] = +v; drawNow(); return; }
  if (a === 'it') { P.info[el.dataset.v] = v; drawNow(); return; }
  if (a === 'lyrsz') { if (P.lyrics) { P.lyrics.size = +v; drawNow(); } return; }
  if (el.id === 'lmAns') { LMANS = v; return; }
  if (a === 'lyr') { P.lyrics = P.lyrics || { on: 1, lines: [], raw: '', style: 'karaoke', pos: 'bottom' }; P.lyrics.raw = v; clearTimeout(saveT); saveT = setTimeout(saveProj, 600); lyrWarnUpd(); return; }
  if (a === 'bf') { const L = ED.brands(), b = L.find(x => x.id === P.info.brandId); if (b) { b[el.dataset.v] = v; ED.saveBrands(L); drawNow(); } return; }
});
$('panel').addEventListener('change', async e => {
  const el = e.target, a = el.dataset.a, c = cur(); if (!a) return;
  if (el.type === 'range' || el.tagName === 'TEXTAREA' || el.type === 'text' || el.type === 'color') { if (a === 'in' || a === 'out') makeThumbs(); commit(); if (a === 'in' || a === 'out' || a === 'dur') renderPanel(); return; }
  if (el.type === 'file') {
    const fs = Array.from(el.files || []); el.value = ''; if (!fs.length) return;
    if (a === 'blankf') return blankFiles(fs);
    if (a === 'trayf') return trayFiles(fs);
    if (a === 'addf') { const pos = insPos(), n = await addFiles(fs, pos); commit(); if (n && pos != null) select(pos, true); else renderPanel(); toast(pos == null ? `＋ ${n}개를 맨 뒤에 넣었어요` : `＋ ${n}개를 장면 ${pos + 1} 자리(커서 앞)에 넣었어요`, 3500); }
    if (a === 'musf') { const f = fs[0], id = uid('s'), meta = { id, code: 'A' + (P.nA++), kind: 'audio', name: f.name }; busy('음악 여는 중…'); const s = await ED.loadSource(meta, f); busy(''); if (!s.buf) return toast('음악 파일을 열 수 없어요 (MP3 · M4A 권장)'); meta.dur = s.dur; P.srcs.push(meta); try { await IDB.put('f', id, f); } catch (er) { /* 공간 */ } P.music.kind = 'file'; P.music.fileId = id; commit(); renderPanel(); toast(timeline(P).total < s.dur - 3 ? '🎵 내 음악을 넣었어요 · 노래가 영상보다 길어요 → 아래 「노래 끝까지 자동 맞추기」를 눌러 보세요' : '🎵 내 음악을 넣었어요', 4500); }
    if (a === 'logo') { const f = fs[0], url = URL.createObjectURL(f), im = await ENG.loadImage(url), k = Math.min(1, 360 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * k); cv.height = Math.round(im.height * k); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height); const L = ED.brands(), b = L.find(x => x.id === P.info.brandId); if (b) { b.logo = cv.toDataURL('image/png'); ED.saveBrands(L); } commit(); renderPanel(); }
  }
});
$('panel').addEventListener('click', async e => {
  if (PNOCLICK) { PNOCLICK = false; return; }
  const b = e.target.closest('[data-a]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'TEXTAREA') return;
  const a = b.dataset.a, v = b.dataset.v, c = cur(), { st } = timeline(P);
  const re = (noHist) => { commit(noHist); renderPanel(); };
  switch (a) {
    case 'mv': { const j = SEL + +v; if (!c || j < 0 || j >= P.clips.length) return; P.clips.splice(SEL, 1); P.clips.splice(j, 0, c); SEL = j; return re(); }
    case 'dup': { if (!c) return; const d = JSON.parse(JSON.stringify(c)); d.id = uid('c'); P.clips.splice(SEL + 1, 0, d); SEL++; return re(); }
    case 'blankdur': P.blankDur = +v; return renderPanel();
    case 'blankins': return blankIns();
    case 'blanknext': { const B = blanks(); if (!B.length) return toast('빈칸이 없어요'); const j = B.find(i => i > SEL); return select(j != null ? j : B[0], true); }
    case 'blankdelall': { const B = blanks(); if (!B.length || !confirm2(`빈 장면 ${B.length}개를 전부 지울까요?\n(뒤 사진들이 다시 앞으로 당겨져요 · ↩️ 되돌리기 가능)`)) return; P.clips = P.clips.filter(x => !x.blank); SEL = Math.min(SEL, P.clips.length - 1); T = Math.min(T, timeline(P).total); toast('🗑 빈칸을 전부 지웠어요'); return re(); }
    case 'lenn': return lenNudge(+v);
    case 'cutmode': P.cutMode = v; commit(); renderCut(); return renderPanel();
    case 'swap': if (c && c.kind !== 'card') swapSheet(c.id); return;
    case 'trayunhide': P.trayHide = []; commit(); renderPanel(); return toast('🗂 뺐던 사진을 서랍에 다시 꺼냈어요');
    case 'trayput': { if (PLAY) pause(); const nc = newFromSrc(v); if (!nc) return toast('사진을 열 수 없어요'); return putAt(nc, nearPos(), '🗂'); }
    case 'bmerge': return blankMerge();
    case 'bmergeall': return blankMergeAll();
    case 'bjoin': return blankJoin(+v);
    case 'blanksel': { if (!c || !c.blank) return; if (blankFillWith(c, v)) blankAfterFill(1); return; }
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
    case 'mfit': return musFit(v);
    case 'mvfirst': case 'mvlast': case 'mvto': {
      if (!c || c.kind === 'card') return; if (c.pin) return toast('고정된 장면이에요 · 먼저 「고정 풀기」를 눌러 주세요');
      const [lo, hi] = movRange(); let j = a === 'mvfirst' ? lo : a === 'mvlast' ? hi : null;
      if (a === 'mvto') { const n = parseInt(g.prompt(`몇 번째 장면으로 옮길까요? (${lo + 1} ~ ${hi + 1})`, String(SEL + 1)), 10); if (!n) return; j = clamp(n - 1, lo, hi); }
      P.clips.splice(SEL, 1); P.clips.splice(j, 0, c); SEL = j; toast(`${j + 1}번째로 옮겼어요`); return re();
    }
    case 'pin': {
      if (!c || c.kind === 'card') return;
      if (!v) { c.pin = null; toast('고정을 풀었어요'); return re(); }
      P.clips.forEach(x => { if (x.pin === v) x.pin = null; }); c.pin = v;
      const dup = P.clips.filter(x => x !== c && x.src === c.src && !x.pin);
      if (dup.length && confirm2(`같은 사진(영상)이 중간에도 ${dup.length}번 들어 있어요.\n중간에 있는 것은 뺄까요?`)) P.clips = P.clips.filter(x => !dup.includes(x));
      commit(); SEL = P.clips.indexOf(c); renderPanel(); renderTL(); return toast(v === 'first' ? '📌 첫 화면으로 고정했어요 · 오프닝 카드 배경도 이 사진이에요' : '🏁 엔딩 화면으로 고정했어요 · 엔딩 카드 배경도 이 사진이에요', 4000);
    }
    case 'insm': P.insMode = v; return re();
    case 'tmode': P.transMode = v; toast(v === 'mix' ? '🎲 장면마다 어울리는 전환을 골고루 넣었어요 · ▶로 보세요' : v === 'cut' ? '⚡ 효과 없이 바로 넘어가요' : '🎯 추천 전환 한 가지로 해요'); return re();
    case 'tspd': P.transSpeed = v; return re();
    case 'treset': P.clips.forEach(x => { x.trans = 'auto'; }); toast('🔄 모든 장면을 전체 방식으로 맞췄어요'); return re();
    case 'tbeat': return beatSync();
    case 'ordm': ORDM = v; LYROPEN = -1; return renderPanel();
    case 'gotab': return setTab(v);
    case 'otap': { const k = TAPORD.indexOf(v); if (k >= 0) TAPORD.splice(k, 1); else TAPORD.push(v); return renderPanel(); }
    case 'otapclr': TAPORD = []; return renderPanel();
    case 'orest': ORDREST = v; return renderPanel();
    case 'otapok': return tapApply();
    case 'lpick': LYROPEN = +v === LYROPEN ? -1 : +v; renderPanel(); { const r = $('panel').querySelector('.lrow.open'); if (r) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); } return;
    case 'lsel': { const rows = storyRows(); if (LYROPEN < 0) return; const L = rows[LYROPEN], k = L.indexOf(v); if (k >= 0) L.splice(k, 1); else L.push(v); saveT2(); return renderPanel(); }
    case 'lclear': if (!confirm2('가사 줄마다 고른 사진을 모두 지울까요?')) return; P.story = null; LYROPEN = -1; saveT2(); return renderPanel();
    case 'lbuild': return buildFromLyrics();
    case 'lmsheet': { busy('🧩 모아보기 그림 만드는 중…'); try { sheets.forEach(x => URL.revokeObjectURL(x.url)); sheets = await ED.contactSheets('all'); } catch (er) { toast('그림을 만들지 못했어요: ' + er.message, 5000); } busy(''); return renderPanel(); }
    case 'lmsend': {
      if (!sheets.length) { busy('🧩 모아보기 그림 만드는 중…'); sheets = await ED.contactSheets('all'); busy(''); renderPanel(); }
      const text = lmPrompt(); await copy(text);
      const files = sheets.map((x, i) => new File([x.blob], `모아보기_${i + 1}.jpg`, { type: 'image/jpeg' }));
      try { if (navigator.canShare && navigator.canShare({ files })) { await navigator.share({ files, text }); toast('📋 요청서도 복사해 뒀어요 · AI 앱 글 칸에 붙여넣기', 6000); return; } } catch (er) { if (er && er.name === 'AbortError') return; }
      sheets.forEach((x, i) => giveFile(x.blob, `모아보기_${i + 1}.jpg`)); window.open(v === 'gem' ? 'https://gemini.google.com/app' : 'https://chatgpt.com/', '_blank', 'noopener');
      return toast('📋 요청서를 복사했어요 · 받은 그림을 AI에 올리고 붙여넣기 하세요', 7000);
    }
    case 'lmcopy': await copy(lmPrompt()); return toast('📋 요청서를 복사했어요');
    case 'lmpaste': { try { const t = await navigator.clipboard.readText(); const ta = $('lmAns'); if (ta) { ta.value = t; LMANS = t; } } catch (er) { toast('칸을 길게 눌러 붙여넣기 해 주세요'); } return; }
    case 'lmapply': return lmApply(($('lmAns') || {}).value || LMANS);
    case 'lyrset': case 'lyrai': case 'lyron': case 'lyreven': case 'lyrshift': case 'lyrst': case 'lyrpos': case 'lyrtapgo': case 'lyrtap': case 'lyrtapback': case 'lyrtapstop': return lyrCmd(a, v);
    case 'alldur': P.clips.forEach(x => { if (x.kind === 'image') x.dur = c.dur; }); toast('모든 사진 길이를 맞췄어요'); return re();
    case 'goinfo': return setTab('info');
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
    case 'capall': { const L = $('capAll').value.split('\n'); let k = 0; P.clips.forEach(x => { if (x.kind === 'card') return; x.cap.t = (L[k] || '').replace(/\s\/\s/g, '\n').trim(); k++; }); toast('✅ 순서대로 넣었어요 (비운 줄은 자막 없음)'); return re(); }
    case 'capclr': { if (!confirm('장면 자막을 전부 지울까요?\n(노래 가사 자막은 그대로 · ↩ 되돌리기로 살릴 수 있어요)')) return; P.clips.forEach(x => { if (x.kind !== 'card' && x.cap) x.cap.t = ''; }); toast('🗑 장면 자막을 전부 지웠어요'); return re(); }
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
  { const nb = P.clips.filter(c => c.blank).length; if (nb && !confirm2(`⬜ 아직 채우지 않은 빈 장면이 ${nb}개 있어요.\n그 자리는 검은 화면으로 나와요.\n그래도 영상을 만들까요?`)) return; }
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

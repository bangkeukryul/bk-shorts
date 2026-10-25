/*!
 * app.js — BK쇼츠 화면 동작 (설정 · 사진/음악 관리 · 실시간 미리보기 · 내보내기 · PWA 설치)
 */
(function () {
  'use strict';
  const E = window.ENG;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

  const SAMPLE_TEXT = `마음은
빈 상자와 같다.

보석을 담으면
보석 상자가 되고

진정한 위로란
"힘내"라고 말하는 것이 아니라
"힘들지"라고 묻는 것이다.

오늘도 행복한
하루 되세요 ♡`;

  const DEF = {
    perDur: 4, motion: 'random', strength: 0.12, transition: 'crossfade', transDur: 1, fit: 'auto', filter: 'none',
    lengthMode: 'photos', beatSync: true, bgmStart: 0, maxLen: 0, volume: 1, fadeOut: 3,
    textMode: 'bulk', bulkText: SAMPLE_TEXT, topText: '', bottomText: '',
    font: 'noto', size: 72, color: '#ffffff', stroke: '#000000', strokeW: 7, shadow: true, box: false,
    boxColor: '#000000', boxOp: 0.45, align: 'center', yPos: 50, anim: 'lines', lineSp: 1.4,
    particles: ['glints', 'hearts'], density: 1, frame: 'none', vignette: 0.25, ovOp: 0.8, fadeEdges: true,
    res: '1080', fps: '30', hq: false,
  };
  const STORE_KEY = 'gamseong-shorts.v1';
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (s.font === 'custom') s.font = DEF.font; // 업로드 글꼴은 저장되지 않음
      if (s.frame === 'custom') s.frame = 'none';
      return Object.assign({}, DEF, s);
    } catch (e) { return Object.assign({}, DEF); }
  }
  let saveTimer = 0;
  function saveSettings() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, JSON.stringify(S.set)); } catch (e) { /* 저장 불가 */ } }, 300);
  }

  const S = {
    set: loadSettings(),
    photos: [], audio: null, perText: {}, srt: null, txtBlocks: null,
    stickers: [], frameImg: null, ov: null, busy: false,
  };
  let uid = 1;

  // ═════════ 공통 UI ═════════
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function busy(on, text) {
    $('#screenBusy').hidden = !on;
    if (text) $('#busyText').textContent = text;
  }
  const fmtTime = s => { s = Math.max(0, s); const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };
  const FMT = {
    perDur: v => `${v}초`, strength: v => `${Math.round(v * 100)}%`, transDur: v => (v > 0 ? `${v}초` : '없음'),
    bgmStart: v => fmtTime(v), maxLen: v => (v > 0 ? `${v}초` : '제한 없음'), volume: v => `${Math.round(v * 100)}%`,
    fadeOut: v => (v > 0 ? `${v}초` : '없음'), size: v => `${v}`, strokeW: v => `${v}`, boxOp: v => `${Math.round(v * 100)}%`,
    yPos: v => `${v}%`, lineSp: v => `×${v}`, density: v => `×${v}`, vignette: v => (v > 0 ? `${Math.round(v * 100)}%` : '없음'),
    ovOp: v => `${Math.round(v * 100)}%`,
  };

  // ═════════ 설정 컨트롤 연결 ═════════
  function fillSelects() {
    $$('select[data-opt]').forEach(sel => {
      const key = sel.dataset.opt;
      const list = key === 'fonts' ? E.OPT.fonts.map(f => [f.id, f.label]).concat([['custom', '내 글꼴 파일…']]) : E.OPT[key];
      sel.innerHTML = list.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
    });
    $('#chips').innerHTML = Object.entries(E.PARTICLES).map(([k, p]) => `<button type="button" data-v="${k}">${p.label}</button>`).join('');
  }
  function syncControls() {
    $$('[data-k]').forEach(el => {
      const k = el.dataset.k, v = S.set[k];
      if (el.classList.contains('seg')) el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(String(v) === b.dataset.v)));
      else if (el.classList.contains('chips')) el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(v.includes(b.dataset.v))));
      else if (el.type === 'checkbox') el.checked = !!v;
      else if (el.value !== String(v)) el.value = v;
    });
    $$('output[data-o]').forEach(o => { const k = o.dataset.o; o.textContent = FMT[k] ? FMT[k](S.set[k]) : S.set[k]; });
    updateShows();
  }
  function updateShows() {
    const flags = Object.assign({}, S.set, { hasOv: !!S.ov });
    $$('[data-show]').forEach(el => {
      const cond = el.dataset.show;
      let ok;
      if (cond.includes('~')) { const [k, v] = cond.split('~'); ok = (flags[k] || []).includes(v); }
      else { const [k, v] = cond.split('='); ok = String(flags[k]) === v; }
      el.hidden = !ok;
    });
  }
  function setVal(k, v) {
    S.set[k] = v;
    saveSettings();
    const o = document.querySelector(`output[data-o="${k}"]`);
    if (o) o.textContent = FMT[k] ? FMT[k](v) : v;
    updateShows();
    onSettingChange(k);
  }
  function bindControls() {
    $$('[data-k]').forEach(el => {
      const k = el.dataset.k;
      if (el.classList.contains('seg')) {
        el.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
          setVal(k, b.dataset.v);
        });
      } else if (el.classList.contains('chips')) {
        el.addEventListener('click', e => {
          const b = e.target.closest('button'); if (!b) return;
          const on = b.getAttribute('aria-pressed') !== 'true';
          b.setAttribute('aria-pressed', String(on));
          const cur = new Set(S.set.particles);
          if (on) cur.add(b.dataset.v); else cur.delete(b.dataset.v);
          setVal(k, Array.from(cur));
          if (on && b.dataset.v === 'custom' && !S.stickers.length) toast('아래에서 스티커 이미지를 추가해 주세요');
        });
      } else {
        const ev = (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'color') ? 'change' : 'input';
        el.addEventListener(ev, () => {
          let v = el.type === 'checkbox' ? el.checked : el.value;
          if (el.type === 'range') v = parseFloat(v);
          setVal(k, v);
        });
        if (el.type === 'color') el.addEventListener('input', () => setVal(k, el.value));
      }
    });
  }

  // ═════════ 탭 ═════════
  function showTab(name) {
    $$('.panel').forEach(p => { p.hidden = p.dataset.panel !== name; });
    $$('.tabbar button').forEach(b => { if (b.dataset.tab === name) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (name === 'text') renderPerList();
    if (name === 'export') updateSummary();
    const panels = $('.panels');
    const y = panels.getBoundingClientRect().top + window.scrollY - $('.stage').offsetHeight - 8;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
  }

  // ═════════ 사진 ═════════
  async function makeThumb(file) {
    const { img, release } = await E.loadImage(file);
    try {
      const c = E.mkCanvas(180, 320), x = c.getContext('2d');
      const iw = img.naturalWidth, ih = img.naturalHeight, s = Math.max(180 / iw, 320 / ih);
      x.drawImage(img, (180 - iw * s) / 2, (320 - ih * s) / 2, iw * s, ih * s);
      return c.toDataURL('image/jpeg', 0.75);
    } finally { release(); }
  }
  async function addPhotos(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    busy(true, `사진 불러오는 중… 0/${list.length}`);
    let bad = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      try {
        const thumb = await makeThumb(f);
        S.photos.push({ id: uid++, file: f, name: f.name, thumb });
      } catch (e) { bad++; }
      busy(true, `사진 불러오는 중… ${i + 1}/${list.length}`);
    }
    busy(false);
    if (bad) toast(`${bad}장은 열 수 없는 형식이라 건너뛰었어요 (JPG·PNG 권장)`);
    renderPhotos();
    scheduleRebuild(0);
  }
  const ICON = {
    left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
  };
  function renderPhotos() {
    const g = $('#photoGrid');
    g.innerHTML = S.photos.map((p, i) => `
      <li data-id="${p.id}"><img src="${p.thumb}" alt="${i + 1}번 사진"><span class="num tnum">${i + 1}</span>
        <div class="acts">
          <button type="button" data-act="left" aria-label="앞으로">${ICON.left.replace('<path', '<path stroke="currentColor" stroke-width="2.4" fill="none"')}</button>
          <button type="button" data-act="del" aria-label="삭제">${ICON.del}</button>
          <button type="button" data-act="right" aria-label="뒤로">${ICON.right.replace('<path', '<path stroke="currentColor" stroke-width="2.4" fill="none"')}</button>
        </div></li>`).join('');
    $('#screenEmpty').hidden = S.photos.length > 0;
    $('#playBtn').disabled = $('#scrub').disabled = !S.photos.length;
  }
  $('#photoGrid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = +b.closest('li').dataset.id, i = S.photos.findIndex(p => p.id === id);
    if (b.dataset.act === 'del') { S.photos.splice(i, 1); delete S.perText[id]; }
    else if (b.dataset.act === 'left' && i > 0) [S.photos[i - 1], S.photos[i]] = [S.photos[i], S.photos[i - 1]];
    else if (b.dataset.act === 'right' && i < S.photos.length - 1) [S.photos[i + 1], S.photos[i]] = [S.photos[i], S.photos[i + 1]];
    renderPhotos();
    scheduleRebuild(0);
  });
  $('#photoInput').addEventListener('change', e => { addPhotos(e.target.files); e.target.value = ''; });

  // ═════════ 음악 ═════════
  async function setMusic(file) {
    busy(true, '음악 분석 중 (길이 · 박자)…');
    try {
      const info = await E.analyzeAudio(file);
      S.audio = Object.assign({ file, name: file.name }, info);
      P.audioKey = null;
      if (S.set.bgmStart > info.duration - 1) setVal('bgmStart', 0);
      $('#bgmStart').max = Math.max(1, Math.floor(info.duration - 1));
      renderMusic();
      scheduleRebuild(0);
      toast(info.bpm ? `음악 분석 완료 · 약 ${Math.round(info.bpm)} BPM` : '음악을 불러왔어요');
    } catch (e) {
      toast(e.message || '음악을 열 수 없어요');
    } finally { busy(false); }
  }
  function renderMusic() {
    const a = S.audio;
    $('#musicCard').hidden = !a;
    $('#musicDropText').textContent = a ? '다른 음악으로 바꾸기' : '음악 선택';
    if (!a) return;
    $('#musicName').textContent = a.name;
    $('#musicDur').textContent = fmtTime(a.duration);
    $('#musicBpm').textContent = a.bpm ? `${Math.round(a.bpm)} BPM` : '검출 안 됨';
  }
  $('#musicInput').addEventListener('change', e => { const f = e.target.files[0]; if (f) setMusic(f); e.target.value = ''; });
  $('#musicRemove').addEventListener('click', () => { pause(); S.audio = null; P.audioKey = null; renderMusic(); scheduleRebuild(0); });

  // ═════════ 글귀 ═════════
  function renderPerList() {
    if (S.set.textMode !== 'per') return;
    const ul = $('#perList');
    if (!S.photos.length) { ul.innerHTML = '<li class="hint">먼저 사진을 추가해 주세요.</li>'; return; }
    ul.innerHTML = S.photos.map((p, i) => `<li><img src="${p.thumb}" alt=""><textarea data-pid="${p.id}" rows="3" placeholder="${i + 1}번 사진 글귀">${(S.perText[p.id] || '').replace(/</g, '&lt;')}</textarea></li>`).join('');
  }
  $('#perList').addEventListener('input', e => {
    const ta = e.target.closest('textarea[data-pid]'); if (!ta) return;
    S.perText[ta.dataset.pid] = ta.value;
    scheduleRebuild();
  });
  async function readTextFile(file) {
    const buf = await file.arrayBuffer();
    try { return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^﻿/, ''); }
    catch (e) { try { return new TextDecoder('euc-kr').decode(buf); } catch (e2) { return new TextDecoder().decode(buf); } }
  }
  $('#textFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    const txt = await readTextFile(f);
    if (/\.srt$/i.test(f.name) || /-->/.test(txt)) { S.srt = E.parseSrt(txt); S.txtBlocks = null; $('#textFileName').textContent = `${f.name} · 자막 ${S.srt.length}개`; }
    else { S.txtBlocks = E.splitBlocks(txt); S.srt = null; $('#textFileName').textContent = `${f.name} · 장면 ${S.txtBlocks.length}개`; }
    scheduleRebuild(0);
  });
  function updateBlockCount() {
    const n = E.splitBlocks(S.set.bulkText || '').length;
    $('#blockCount').textContent = `글 덩어리 ${n}개`;
  }

  // ═════════ 꾸미기: 글꼴 · 스티커 · 프레임 · 오버레이 영상 ═════════
  $('#fontFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const fam = 'UserFont' + Date.now();
      const face = new FontFace(fam, await f.arrayBuffer());
      await face.load();
      document.fonts.add(face);
      E.setCustomFont({ id: 'custom', label: f.name, family: fam, weight: 400 });
      $('#fontFileName').textContent = f.name;
      scheduleRebuild(0);
    } catch (err) { toast('글꼴 파일을 읽을 수 없어요 (.ttf / .otf)'); }
  });
  $('#stickerFile').addEventListener('change', async e => {
    for (const f of Array.from(e.target.files)) {
      try { const { img } = await E.loadImage(f); S.stickers.push(img); } catch (err) { toast('스티커 이미지를 열 수 없어요'); }
    }
    e.target.value = '';
    renderStickers();
    scheduleRebuild(0);
  });
  function renderStickers() {
    $('#stickerRow').innerHTML = S.stickers.map((im, i) => `<span><img src="${im.src}" alt=""><button type="button" data-i="${i}" aria-label="스티커 삭제">✕</button></span>`).join('');
  }
  $('#stickerRow').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.stickers.splice(+b.dataset.i, 1);
    renderStickers();
    scheduleRebuild(0);
  });
  $('#frameFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const { img } = await E.loadImage(f); S.frameImg = img; $('#frameFileName').textContent = f.name; scheduleRebuild(0); }
    catch (err) { toast('프레임 PNG 를 열 수 없어요'); }
  });
  function mkVideo(url) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.loop = true; v.src = url;
    return v;
  }
  $('#ovFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    if (S.ov) { URL.revokeObjectURL(S.ov.url); }
    const url = URL.createObjectURL(f);
    const el = mkVideo(url), exportEl = mkVideo(url);
    exportEl.loop = false;
    await new Promise(res => { el.onloadeddata = res; el.onerror = res; setTimeout(res, 4000); });
    el.play().catch(() => {});
    exportEl.play().then(() => exportEl.pause()).catch(() => {});
    S.ov = { url, el, exportEl, name: f.name };
    $('#ovFileName').textContent = f.name;
    updateShows();
    scheduleRebuild(0);
  });
  $('#ovRemove').addEventListener('click', () => {
    if (S.ov) { S.ov.el.pause(); URL.revokeObjectURL(S.ov.url); }
    S.ov = null;
    $('#ovFileName').textContent = '효과 영상 선택 (선택 사항)';
    updateShows();
    scheduleRebuild(0);
  });

  // ═════════ 프로젝트 구성 ═════════
  function buildProject() {
    if (!S.photos.length) return null;
    const st = S.set;
    const mode = st.textMode;
    const blocks = mode === 'bulk' ? E.splitBlocks(st.bulkText || '') : (mode === 'file' && S.txtBlocks ? S.txtBlocks : []);
    const srt = mode === 'file' && S.srt && S.srt.length ? S.srt : null;
    const musicMode = st.lengthMode === 'music' && !!S.audio;
    const mdur = S.audio ? Math.max(1, S.audio.duration - st.bgmStart) : null;
    let beats = null;
    if (st.beatSync && S.audio && S.audio.beats.length) beats = S.audio.beats.map(b => b - st.bgmStart).filter(b => b > 0.3);
    const minTotal = srt ? Math.max(...srt.map(s => s.end)) + 1 : 0;
    const { scenes, total } = E.planScenes({
      nImages: S.photos.length, perDur: st.perDur, musicMode, musicDur: mdur,
      minScenes: blocks.length, minTotal, maxTotal: st.maxLen, beats,
    });
    if (blocks.length) scenes.forEach((s, k) => { s.text = blocks[k] || ''; });
    else if (mode === 'per') scenes.forEach(s => { s.text = S.perText[S.photos[s.img].id] || ''; });
    const trans = Math.min(st.transDur, 0.45 * Math.min(...scenes.map(s => s.end - s.start)));
    const subs = srt || E.subsFromScenes(scenes, trans, total);
    return {
      photos: S.photos.slice(), scenes, total, subs,
      style: {
        font: st.font === 'custom' && !E.fontDef('custom').family ? 'noto' : st.font, size: st.size, color: st.color, stroke: st.stroke,
        strokeW: st.strokeW, shadow: st.shadow, box: st.box, boxColor: st.boxColor, boxOp: st.boxOp, align: st.align,
        yPos: st.yPos, anim: st.anim, lineSp: st.lineSp,
      },
      topText: st.topText || '', bottomText: st.bottomText || '',
      transition: st.transition, transDur: st.transDur, motion: st.motion, strength: st.strength, fit: st.fit, filter: st.filter,
      particles: st.particles.filter(k => k !== 'custom' || S.stickers.length), density: st.density, stickers: S.stickers,
      frame: st.frame === 'custom' && !S.frameImg ? 'none' : st.frame, frameImg: S.frameImg, vignette: st.vignette,
      overlayVideo: null, ovOpacity: st.ovOp, fadeEdges: st.fadeEdges,
      audio: S.audio ? { buffer: S.audio.buffer, start: st.bgmStart, volume: st.volume, fadeIn: 0.5, fadeOut: st.fadeOut } : null,
    };
  }

  // ═════════ 실시간 미리보기 ═════════
  const P = {
    canvas: $('#preview'), ctx: null, W: 540, H: 960, cache: new E.BaseCache(40),
    r: null, pj: null, t: 0, playing: false, raf: 0, actx: null, src: null, startAt: 0, t0: 0, perf0: 0,
    audioKey: null, audioBuf: null, gen: 0,
  };
  P.ctx = P.canvas.getContext('2d', { alpha: false });
  P.ctx.imageSmoothingQuality = 'high';

  let rebuildTimer = 0;
  function scheduleRebuild(delay = 220) {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(rebuild, delay);
  }
  async function rebuild() {
    const gen = ++P.gen;
    const pj = buildProject();
    if (!pj) {
      if (P.r) { P.r.destroy(); P.r = null; }
      P.pj = null; pause();
      P.ctx.fillStyle = '#000'; P.ctx.fillRect(0, 0, P.W, P.H);
      updateTime(); updateSummary();
      return;
    }
    pj.overlayVideo = S.ov ? S.ov.el : null;
    const r = new E.Renderer(pj, P.W, P.H, P.cache);
    await r.init();
    if (gen !== P.gen) { r.destroy(); return; }
    const old = P.r;
    P.r = r; P.pj = pj;
    if (old) old.destroy();
    $('#scrub').max = pj.total.toFixed(2);
    if (P.t >= pj.total) P.t = 0;
    updateSummary();
    if (P.playing) {
      const key = audioKey(pj);
      if (key !== P.audioKey) { const t = currentTime(); stopAudio(); P.t = t; await startAudio(t); }
      ensureAllBases(r);
    } else {
      drawStill();
    }
  }
  async function drawStill() {
    const r = P.r; if (!r) return;
    try { await r.ensureFor(P.t); } catch (e) { toast('사진을 불러오지 못했어요'); return; }
    if (r !== P.r || P.playing) return;
    r.draw(P.ctx, P.t);
    updateTime();
  }
  function updateTime() {
    const tot = P.pj ? P.pj.total : 0;
    $('#timeLbl').textContent = `${fmtTime(P.t)} / ${fmtTime(tot)}`;
    const sc = $('#scrub');
    if (document.activeElement !== sc) sc.value = P.t;
  }
  function updateSummary() {
    const pj = P.pj;
    $('#sumLen').textContent = pj ? `${pj.total.toFixed(1)}초` : '–';
    $('#sumScenes').textContent = pj ? `${pj.scenes.length}개` : '–';
    $('#sumSubs').textContent = pj ? `${pj.subs.length}개` : '–';
    updateBlockCount();
  }
  function audioKey(pj) {
    if (!pj.audio || !S.audio) return 'none';
    const a = pj.audio;
    return [S.audio.name, S.audio.duration, a.start, a.volume, a.fadeOut, pj.total.toFixed(2)].join('|');
  }
  async function ensureAllBases(r) {
    const n = r.pj.scenes.length;
    for (let k = 0; k < n; k++) { if (r !== P.r) return; await r.loadScene(k).catch(() => {}); }
  }
  async function startAudio(t) {
    const pj = P.pj;
    if (!pj || !pj.audio) { P.src = null; return; }
    const key = audioKey(pj);
    if (P.audioKey !== key || !P.audioBuf) {
      P.audioBuf = await E.renderAudio(pj.audio, pj.total, 44100);
      P.audioKey = key;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!P.actx) P.actx = new AC();
    if (P.actx.state === 'suspended') await P.actx.resume();
    const src = P.actx.createBufferSource();
    src.buffer = P.audioBuf;
    src.connect(P.actx.destination);
    src.start(0, Math.min(t, P.audioBuf.duration - 0.01));
    P.src = src; P.startAt = P.actx.currentTime; P.t0 = t;
  }
  function stopAudio() { if (P.src) { try { P.src.stop(); } catch (e) { /* 이미 멈춤 */ } P.src.disconnect(); P.src = null; } }
  function currentTime() {
    if (P.src && P.actx) return P.t0 + (P.actx.currentTime - P.startAt);
    return P.t0 + (performance.now() - P.perf0) / 1000;
  }
  async function play() {
    if (!P.r || P.playing) return;
    const r = P.r;
    if (P.t >= P.pj.total - 0.05) P.t = 0;
    // 첫 재생 전에 모든 장면 사진 준비 (미리보기용 작은 해상도)
    busy(true, '미리보기 준비 중…');
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!P.actx) P.actx = new AC();           // 사용자 탭 안에서 만들어야 아이폰에서 소리가 남
    try {
      for (let k = 0; k < r.pj.scenes.length; k++) {
        busy(true, `미리보기 준비 중… ${k + 1}/${r.pj.scenes.length}`);
        await r.loadScene(k);
      }
      await startAudio(P.t);
    } catch (e) { busy(false); toast(e.message || '미리보기를 시작하지 못했어요'); return; }
    busy(false);
    P.playing = true;
    P.perf0 = performance.now(); P.t0 = P.src ? P.t0 : P.t;
    if (S.ov) S.ov.el.play().catch(() => {});
    setPlayIcon(true);
    const loop = () => {
      if (!P.playing) return;
      const t = currentTime();
      if (!P.pj || t >= P.pj.total) { pause(); P.t = 0; drawStill(); return; }
      P.t = t;
      if (P.r) P.r.draw(P.ctx, t);
      updateTime();
      P.raf = requestAnimationFrame(loop);
    };
    P.raf = requestAnimationFrame(loop);
  }
  function pause() {
    if (P.playing) P.t = currentTime();
    P.playing = false;
    cancelAnimationFrame(P.raf);
    stopAudio();
    setPlayIcon(false);
  }
  function setPlayIcon(on) {
    $('#playBtn .i-play').hidden = on;
    $('#playBtn .i-pause').hidden = !on;
    $('#playBtn').setAttribute('aria-label', on ? '일시정지' : '재생');
  }
  $('#playBtn').addEventListener('click', () => (P.playing ? pause() : play()));
  $('#scrub').addEventListener('input', e => {
    const t = parseFloat(e.target.value);
    if (P.playing) { pause(); }
    P.t = t;
    drawStill();
  });

  function onSettingChange(k) {
    if (k === 'bulkText') updateBlockCount();
    if (k === 'textMode') renderPerList();
    if (k === 'res' || k === 'fps' || k === 'hq') return;
    if (k === 'ovOp' && P.r) { P.r.pj.ovOpacity = S.set.ovOp; if (!P.playing) drawStill(); return; }
    scheduleRebuild(k === 'bulkText' || k === 'topText' || k === 'bottomText' ? 400 : 160);
  }

  // ═════════ 내보내기 ═════════
  const X = { ctl: null, url: null, file: null, wake: null };
  async function doExport() {
    const pj = buildProject();
    if (!pj) { toast('먼저 사진을 추가해 주세요'); showTab('photo'); return; }
    pause();
    const W = S.set.res === '720' ? 720 : 1080, H = S.set.res === '720' ? 1280 : 1920, fps = +S.set.fps;
    if (S.ov) pj.overlayVideo = S.ov.exportEl;
    X.ctl = { aborted: false };
    S.busy = true;
    $('#exportBtn').disabled = true;
    $('#progress').hidden = false;
    $('#result').hidden = true;
    setProg(0, '준비 중…');
    try { if (navigator.wakeLock) X.wake = await navigator.wakeLock.request('screen'); } catch (e) { X.wake = null; }
    try {
      const res = await E.exportVideo(pj, { W, H, fps, hq: S.set.hq }, (i, n, sec, phase) => {
        if (phase === 'audio') { setProg(0, '음악 준비 중…'); return; }
        const eta = i > 10 ? sec / i * (n - i) : 0;
        setProg(i / n, `${Math.round(i / n * 100)}% · ${i}/${n} 프레임${eta ? ` · 약 ${Math.ceil(eta)}초 남음` : ''}`);
      }, X.ctl);
      showResult(res, W, H, fps, pj.total);
    } catch (e) {
      $('#progress').hidden = true;
      toast(e.message || '영상을 만들지 못했어요', 5000);
      console.error(e);
    } finally {
      S.busy = false;
      $('#exportBtn').disabled = false;
      if (X.wake) { X.wake.release().catch(() => {}); X.wake = null; }
    }
  }
  function setProg(f, text) {
    $('#progBar').style.width = `${Math.round(f * 100)}%`;
    $('#progText').textContent = text;
  }
  function stamp() {
    const d = new Date(), p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }
  function showResult(res, W, H, fps, total) {
    $('#progress').hidden = true;
    if (X.url) URL.revokeObjectURL(X.url);
    const name = `BK쇼츠_${stamp()}.mp4`;
    X.file = new File([res.blob], name, { type: 'video/mp4' });
    X.url = URL.createObjectURL(res.blob);
    window.__lastExport = res; // 테스트/디버그용
    const v = $('#resultVideo');
    v.src = X.url;
    const a = $('#downloadLink');
    a.href = X.url; a.download = name;
    let canShare = false;
    try { canShare = !!(navigator.canShare && navigator.canShare({ files: [X.file] })); } catch (e) { canShare = false; }
    $('#shareBtn').hidden = !canShare;
    const mb = (res.blob.size / 1048576).toFixed(1);
    let info = `${W}x${H} · ${fps}fps · ${total.toFixed(1)}초 · ${mb}MB`;
    if (res.audioCodec === 'opus') info += ' · 오디오 Opus (이 브라우저는 AAC 미지원)';
    if (res.warning) info += ` · ${res.warning}`;
    $('#resultInfo').textContent = info;
    $('#result').hidden = false;
    toast('영상이 완성됐어요!');
  }
  $('#exportBtn').addEventListener('click', doExport);
  $('#cancelBtn').addEventListener('click', () => { if (X.ctl) X.ctl.aborted = true; });
  $('#shareBtn').addEventListener('click', async () => {
    if (!X.file) return;
    try { await navigator.share({ files: [X.file], title: 'BK쇼츠' }); }
    catch (e) { if (e && e.name !== 'AbortError') toast('공유하지 못했어요. 다운로드 버튼을 이용해 주세요'); }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S.busy) toast('영상을 만드는 중이에요. 화면을 켠 채로 기다려 주세요', 4000);
    if (document.hidden && P.playing) pause();
  });

  // ═════════ 샘플 ═════════
  $('#sampleBtn').addEventListener('click', async () => {
    busy(true, '샘플 만드는 중…');
    try {
      const imgs = await window.SAMPLES.sampleImages();
      await addPhotos(imgs);
      if (!S.audio) { const m = await window.SAMPLES.sampleMusic(); await setMusic(m); }
      if (!S.set.bulkText.trim()) { S.set.bulkText = SAMPLE_TEXT; syncControls(); }
      toast('샘플 준비 완료 · ▶ 버튼으로 재생해 보세요');
    } catch (e) { toast('샘플을 만들지 못했어요'); console.error(e); }
    finally { busy(false); }
  });

  // ═════════ PWA: 설치 · 오프라인 ═════════
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredPrompt = e; $('#installBtn').hidden = false; });
  $('#installBtn').addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $('#installBtn').hidden = true;
  });
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let hintClosed = false;
  try { hintClosed = localStorage.getItem('gamseong-shorts.ioshint') === '1'; } catch (e) { /* 무시 */ }
  if (isIOS && !isStandalone && !hintClosed) $('#iosHint').hidden = false;
  $('#iosHintClose').addEventListener('click', () => {
    $('#iosHint').hidden = true;
    try { localStorage.setItem('gamseong-shorts.ioshint', '1'); } catch (e) { /* 무시 */ }
  });
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  // ═════════ 시작 ═════════
  function checkSupport() {
    const s = E.supportInfo();
    const w = $('#supportWarn');
    if (!s.video) {
      w.hidden = false;
      w.textContent = '이 브라우저에서는 영상 저장(WebCodecs)이 지원되지 않아요. 미리보기는 되지만, 영상을 만들려면 안드로이드는 크롬 · 삼성 인터넷, 아이폰은 iOS 16.4 이상의 사파리에서 열어 주세요.';
      $('#exportBtn').disabled = true;
    }
  }
  fillSelects();
  bindControls();
  syncControls();
  renderPhotos();
  renderMusic();
  updateBlockCount();
  checkSupport();
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  window.__app = { S, P, buildProject, addPhotos, setMusic, doExport }; // 테스트용
})();

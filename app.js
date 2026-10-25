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
    boxColor: '#000000', boxOp: 0.45, align: 'center', yPos: 50, anim: 'none', animV: 1, lineSp: 1.4,
    topFont: 'same', topSize: 46, topColor: '#ffffff', botFont: 'same', botSize: 42, botColor: '#ffffff',
    particles: ['glints', 'hearts'], density: 1, frame: 'none', vignette: 0.25, ovOp: 0.8, fadeEdges: true,
    res: '1080', fps: '30', hq: false,
    clipMax: '10', clipSound: 'clip', capTheme: 'life', cardMode: 'always', cardV: 2,
  };
  const STORE_KEY = 'gamseong-shorts.v1';
  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
      if (s.font === 'custom') s.font = DEF.font; // 업로드 글꼴은 저장되지 않음
      if (s.frame === 'custom') s.frame = 'none';
      if (s.cardV !== 2) { s.cardMode = 'always'; s.cardV = 2; } // 명함 기본값을 '계속'으로 바꿈 (2026-10-25)
      if (s.animV !== 1) { s.anim = 'none'; s.animV = 1; }      // 글귀 효과 기본값을 '없음'으로 바꿈 (2026-10-25)
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
    photos: [], audio: null, perText: {}, animPer: {}, srt: null, txtBlocks: null,
    stickers: [], frameImg: null, ov: null, busy: false,
    card: { company: '', companies: [''], branch: '', role: '', name: '', phone: '', msg: '' }, cardFace: null, cardFaceUrl: '',
  };
  const hasVid = () => S.photos.some(p => p.kind === 'video');
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
    yPos: v => `${v}%`, topSize: v => `${v}`, botSize: v => `${v}`, lineSp: v => `×${v}`, density: v => `×${v}`, vignette: v => (v > 0 ? `${Math.round(v * 100)}%` : '없음'),
    ovOp: v => `${Math.round(v * 100)}%`,
  };

  // ═════════ 설정 컨트롤 연결 ═════════
  function fillSelects() {
    $$('select[data-opt]').forEach(sel => {
      const key = sel.dataset.opt;
      const list = key === 'fonts' ? E.OPT.fonts.map(f => [f.id, f.label]).concat([['custom', '내 글꼴 파일…']])
        : key === 'fontsSame' ? [['same', '본문 글귀와 같은 글꼴']].concat(E.OPT.fonts.map(f => [f.id, f.label]))
          : E.OPT[key];
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
    const flags = Object.assign({}, S.set, { hasOv: !!S.ov, hasVid: hasVid(), hasFace: !!S.cardFace });
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
    if (name === 'text') { renderPerList(); renderAnimPer(); }
    if (name === 'export') updateSummary();
    const panels = $('.panels');
    const y = panels.getBoundingClientRect().top + window.scrollY - $('.stage').offsetHeight - 8;
    if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y) });
  }

  // ═════════ 사진 ═════════
  /** 사진을 고르는 순간 앱 안에 사본을 만들어 둠 (휴대폰이 나중에 원본 읽기를 막아도 영상 만들기가 되게) */
  async function keepPhoto(file) {
    const { img, release } = await E.loadImage(file);
    try {
      const iw = img.naturalWidth, ih = img.naturalHeight, mx = 2400, sc = Math.min(1, mx / Math.max(iw, ih));
      const c = E.mkCanvas(iw * sc, ih * sc), x = c.getContext('2d');
      x.imageSmoothingQuality = 'high';
      x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
      c.width = 0; c.height = 0;
      if (!blob) throw new Error('사진 저장 실패');
      return blob;
    } finally { release(); }
  }
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
    const all = Array.from(files || []);
    const vids = all.filter(f => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name));
    const list = all.filter(f => !vids.includes(f));
    if (vids.length) await addVideos(vids);
    if (!list.length) return;
    busy(true, `사진 불러오는 중… 0/${list.length}`);
    let bad = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      try {
        const kept = await keepPhoto(f);
        const thumb = await makeThumb(kept);
        S.photos.push({ id: uid++, kind: 'photo', file: kept, name: f.name, thumb });
      } catch (e) { bad++; }
      busy(true, `사진 불러오는 중… ${i + 1}/${list.length}`);
    }
    busy(false);
    if (bad) toast(`${bad}장은 열 수 없는 형식이라 건너뛰었어요 (JPG·PNG 권장)`);
    renderPhotos();
    scheduleRebuild(0);
  }
  // ═════════ 동영상 ═════════
  let vidBox = null;
  function mkClipVideo(url) {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.preload = 'auto'; v.src = url;
    if (!vidBox) {
      vidBox = document.createElement('div');
      vidBox.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:0;pointer-events:none';
      document.body.appendChild(vidBox);
    }
    vidBox.appendChild(v);
    return v;
  }
  function waitVideo(v) {
    return new Promise((res, rej) => {
      if (v.readyState >= 2) return res();
      const ok = () => { clean(); res(); }, bad = () => { clean(); rej(new Error('영상을 열 수 없어요')); };
      const clean = () => { v.removeEventListener('loadeddata', ok); v.removeEventListener('error', bad); };
      v.addEventListener('loadeddata', ok); v.addEventListener('error', bad);
      setTimeout(() => { clean(); v.readyState >= 1 ? res() : rej(new Error('영상을 열 수 없어요')); }, 15000);
    });
  }
  async function addVideos(files) {
    const list = Array.from(files || []);
    if (!list.length) return;
    let bad = 0, mute = 0;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      busy(true, `동영상 불러오는 중… ${i + 1}/${list.length}`);
      let src = f;
      if (f.size <= 200 * 1048576) {          // 200MB 이하면 앱 안에 사본 (나중에 원본 읽기가 막혀도 되게)
        try { src = new Blob([await f.arrayBuffer()], { type: f.type || 'video/mp4' }); } catch (e) { src = f; }
      }
      const url = URL.createObjectURL(src);
      const el = mkClipVideo(url), xel = mkClipVideo(url);
      try {
        await waitVideo(el);
        const dur = isFinite(el.duration) ? el.duration : 0;
        if (!(dur > 0.3)) throw new Error('짧음');
        el.play().then(() => el.pause()).catch(() => {});
        xel.play().then(() => xel.pause()).catch(() => {});
        await E.seekVideo(el, Math.min(0.4, dur / 2));
        const c = E.mkCanvas(180, 320), x = c.getContext('2d');
        const iw = el.videoWidth || 9, ih = el.videoHeight || 16, s = Math.max(180 / iw, 320 / ih);
        x.fillStyle = '#000'; x.fillRect(0, 0, 180, 320);
        try { x.drawImage(el, (180 - iw * s) / 2, (320 - ih * s) / 2, iw * s, ih * s); } catch (e) { /* 미리보기 그림 없음 */ }
        const thumb = c.toDataURL('image/jpeg', 0.75);
        busy(true, `영상 소리 읽는 중… ${i + 1}/${list.length}`);
        const abuf = await E.decodeClipAudio(src);
        if (!abuf) mute++;
        S.photos.push({ id: uid++, kind: 'video', file: src, name: f.name, thumb, url, el, xel, dur, abuf });
      } catch (e) {
        bad++; el.remove(); xel.remove(); URL.revokeObjectURL(url);
      }
    }
    busy(false);
    if (bad) toast(`${bad}개는 열 수 없는 영상이라 건너뛰었어요 (MP4 권장)`);
    else if (mute) toast('소리가 없는 영상은 배경음악이 나와요');
    renderPhotos();
    updateShows();
    scheduleRebuild(0);
  }
  function freeItem(p) {
    if (p.kind !== 'video') return;
    p.el.pause(); p.xel.pause(); p.el.remove(); p.xel.remove();
    p.el.src = ''; p.xel.src = '';
    URL.revokeObjectURL(p.url);
  }
  function clipLenOf(p) {
    const mx = +S.set.clipMax;
    return Math.max(1, mx > 0 ? Math.min(p.dur, mx) : p.dur);
  }
  const ICON = {
    left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    del: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>',
  };
  function renderPhotos() {
    const g = $('#photoGrid');
    g.innerHTML = S.photos.map((p, i) => `
      <li data-id="${p.id}"><img src="${p.thumb}" alt="${i + 1}번 ${p.kind === 'video' ? '동영상' : '사진'}"><span class="num tnum">${i + 1}</span>${p.kind === 'video' ? `<span class="vbadge tnum">▶ ${fmtTime(clipLenOf(p))}${p.abuf ? '' : ' 🔇'}</span>` : ''}
        <div class="acts">
          <button type="button" data-act="left" aria-label="앞으로">${ICON.left.replace('<path', '<path stroke="currentColor" stroke-width="2.4" fill="none"')}</button>
          <button type="button" data-act="del" aria-label="삭제">${ICON.del}</button>
          <button type="button" data-act="right" aria-label="뒤로">${ICON.right.replace('<path', '<path stroke="currentColor" stroke-width="2.4" fill="none"')}</button>
        </div></li>`).join('');
    $('#screenEmpty').hidden = S.photos.length > 0;
    if (!$('#p-text').hidden) renderAnimPer();
    $('#playBtn').disabled = $('#scrub').disabled = !S.photos.length;
  }
  $('#photoGrid').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    const id = +b.closest('li').dataset.id, i = S.photos.findIndex(p => p.id === id);
    if (b.dataset.act === 'del') { freeItem(S.photos[i]); S.photos.splice(i, 1); delete S.perText[id]; delete S.animPer[id]; updateShows(); }
    else if (b.dataset.act === 'left' && i > 0) [S.photos[i - 1], S.photos[i]] = [S.photos[i], S.photos[i - 1]];
    else if (b.dataset.act === 'right' && i < S.photos.length - 1) [S.photos[i + 1], S.photos[i]] = [S.photos[i], S.photos[i + 1]];
    renderPhotos();
    scheduleRebuild(0);
  });
  $('#photoInput').addEventListener('change', e => { addPhotos(e.target.files); e.target.value = ''; });
  $('#videoInput').addEventListener('change', e => { addVideos(e.target.files); e.target.value = ''; });

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
  async function setBuiltin(kind) {
    pause();
    busy(true, '음악 만드는 중… (처음 한 번 몇 초 걸려요)');
    try {
      const buf = await window.BKMUSIC.render(kind, 90);
      const info = E.analyzeBuffer(buf);
      S.audio = Object.assign({ builtin: kind, name: window.BKMUSIC.label(kind) }, info);
      P.audioKey = null;
      if (S.set.bgmStart > info.duration - 1) setVal('bgmStart', 0);
      $('#bgmStart').max = Math.max(1, Math.floor(info.duration - 1));
      renderMusic();
      scheduleRebuild(0);
      toast('음악을 넣었어요 · ▶ 버튼으로 들어 보세요');
    } catch (e) { toast('음악을 만들지 못했어요'); console.error(e); }
    finally { busy(false); }
  }
  function renderBuiltinList() {
    const box = $('#builtinList');
    if (!box || !window.BKMUSIC) return;
    box.innerHTML = window.BKMUSIC.LIST.map(([g, items]) => `<p class="mlbl">${g}</p><div class="chips mchips">${items.map(([k, l]) => `<button type="button" data-m="${k}">${l}</button>`).join('')}</div>`).join('');
  }
  function markBuiltin() {
    $$('#builtinList button').forEach(b => b.setAttribute('aria-pressed', String(!!S.audio && S.audio.builtin === b.dataset.m)));
  }
  $('#builtinList').addEventListener('click', e => { const b = e.target.closest('button[data-m]'); if (b) setBuiltin(b.dataset.m); });
  const PIXA = [['잔잔한 피아노', 'calm piano'], ['감성', 'emotional'], ['신나는', 'upbeat'], ['여행', 'travel'], ['로파이', 'lofi'],
    ['웨딩', 'wedding'], ['어린이', 'kids'], ['어쿠스틱', 'acoustic'], ['찬양·교회', 'worship'], ['크리스마스', 'christmas']];
  $('#pixaChips').innerHTML = PIXA.map(([k, en]) => `<a class="pchip" target="_blank" rel="noopener" href="https://pixabay.com/ko/music/search/${encodeURIComponent(en)}/">🔎 ${k}</a>`).join('');
  $('#pixaGo').addEventListener('click', () => {
    const q = $('#pixaQ').value.trim();
    window.open(q ? `https://pixabay.com/ko/music/search/${encodeURIComponent(q)}/` : 'https://pixabay.com/ko/music/', '_blank', 'noopener');
  });
  function renderMusic() {
    const a = S.audio;
    markBuiltin();
    $('#musicCard').hidden = !a;
    $('#musicDropText').textContent = a ? '내 음악 파일로 바꾸기' : '내 음악 파일 선택';
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
  // ═════════ 사진마다 글귀 효과 ═════════
  function renderAnimPer() {
    const ul = $('#animPerList');
    if (!S.photos.length) { ul.innerHTML = '<li class="hint">먼저 사진을 추가해 주세요.</li>'; return; }
    const opts = [['default', '위 기본 효과 따르기']].concat(E.OPT.anims.filter(([v]) => v !== 'auto'));
    ul.innerHTML = S.photos.map((p, i) => `<li><img src="${p.thumb}" alt=""><span class="tnum">${i + 1}</span><select data-ap="${p.id}">${opts.map(([v, l]) => `<option value="${v}"${(S.animPer[p.id] || 'default') === v ? ' selected' : ''}>${l}</option>`).join('')}</select></li>`).join('');
  }
  $('#animPerList').addEventListener('change', e => {
    const sel = e.target.closest('select[data-ap]'); if (!sel) return;
    S.animPer[sel.dataset.ap] = sel.value;
    scheduleRebuild(0);
  });

  // ═════════ 글귀 자동 채우기 (주제별 글귀 · ChatGPT) ═════════
  const CAPS = window.BKCAPS || {};
  function renderCapThemes() {
    $('#capThemes').innerHTML = Object.entries(CAPS).map(([k, v]) => `<button type="button" data-v="${k}">${v.label}</button>`).join('');
  }
  function markCapTheme() { $$('#capThemes button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === S.set.capTheme))); }
  $('#capThemes').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    S.set.capTheme = b.dataset.v; saveSettings(); markCapTheme(); fillCaptions();
  });
  let lastPick = [];
  function fillCaptions() {
    const th = CAPS[S.set.capTheme] || Object.values(CAPS)[0];
    if (!th) return;
    const n = Math.max(1, S.photos.length || 5);
    let pool = th.items.filter(t => !lastPick.includes(t));
    if (pool.length < Math.min(n, th.items.length)) pool = th.items.slice();
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const out = [];
    for (let i = 0; i < n; i++) out.push(pool[i % pool.length]);
    lastPick = out.slice();
    S.set.bulkText = out.join('\n\n');
    if (S.set.textMode !== 'bulk') S.set.textMode = 'bulk';
    saveSettings(); syncControls(); updateBlockCount(); scheduleRebuild(0);
    toast(`${th.label} 글귀 ${n}개를 넣었어요 · 마음대로 고쳐 써도 돼요`);
  }
  $('#capFill').addEventListener('click', fillCaptions);
  function gptPrompt() {
    const th = CAPS[S.set.capTheme];
    const n = Math.max(1, S.photos.length);
    return `첨부한 사진 ${n}장을 순서대로 보고, 사진마다 어울리는 짧은 감성 글귀를 한국어로 ${n}개 써 주세요.\n`
      + `주제: ${th ? th.label.replace(/^\S+\s/, '') : '자유'}\n`
      + `규칙:\n- 글귀 1개는 2~3줄, 한 줄은 15자 안쪽\n- 글귀와 글귀 사이에는 빈 줄 하나\n`
      + `- 번호, 따옴표, 제목, 설명 없이 글귀만\n- 명언이나 성경 구절을 쓸 때는 마지막 줄에 '— 출처'를 정확히 쓰고, 확실하지 않으면 직접 지은 글귀로 써 주세요`;
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { ok = false; }
      ta.remove(); return ok;
    }
  }
  async function dataUrlFile(url, name) { const b = await (await fetch(url)).blob(); return new File([b], name, { type: b.type || 'image/jpeg' }); }
  $('#capGpt').addEventListener('click', async () => {
    if (!S.photos.length) { toast('먼저 사진을 추가해 주세요'); showTab('photo'); return; }
    const prompt = gptPrompt();
    await copyText(prompt);
    const files = [];
    for (const p of S.photos.slice(0, 10)) {
      if (p.kind === 'video') files.push(await dataUrlFile(p.thumb, `video${p.id}.jpg`));
      else files.push(p.file);
    }
    let shared = false;
    try {
      if (navigator.canShare && navigator.canShare({ files, text: prompt })) {
        await navigator.share({ files, text: prompt });
        shared = true;
      }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    if (shared) toast('공유 목록에서 ChatGPT 를 고르세요 · 글이 안 들어가면 입력칸을 길게 눌러 붙여넣기', 6000);
    else { toast('질문을 복사했어요 · ChatGPT 에 사진을 올리고 붙여넣기 하세요', 6000); window.open('https://chatgpt.com/', '_blank', 'noopener'); }
    if (S.photos.length > 10) setTimeout(() => toast('ChatGPT 에는 사진을 10장까지만 보냈어요'), 6200);
  });
  function cleanGpt(t) {
    return t.replace(/\r/g, '').split('\n').map(l => l.replace(/^\s*(\d+[.)]|[-*•]|#+)\s*/, '').replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\*\*/g, '').trimEnd())
      .join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  $('#capPaste').addEventListener('click', async () => {
    let t = '';
    try { t = await navigator.clipboard.readText(); } catch (e) { t = ''; }
    if (!t.trim()) { toast('붙여넣을 글이 없어요 · 아래 글 칸을 길게 눌러 ‘붙여넣기’ 해 주세요', 5000); $('#bulkText').focus(); return; }
    S.set.bulkText = cleanGpt(t);
    if (S.set.textMode !== 'bulk') S.set.textMode = 'bulk';
    saveSettings(); syncControls(); updateBlockCount(); scheduleRebuild(0);
    toast('ChatGPT 글귀를 넣었어요');
  });

  // ═════════ 내 명함 ═════════
  const CARD_KEY = 'bk-shorts.card';
  const CARD_F = ['branch', 'role', 'name', 'phone', 'msg'];
  function fmtPhone(v) {
    const d = (v || '').replace(/\D/g, '');
    if (/^01\d{8,9}$/.test(d)) return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return (v || '').trim();
  }
  function saveCard() {
    try { localStorage.setItem(CARD_KEY, JSON.stringify({ info: S.card, face: S.cardFaceUrl || '' })); } catch (e) { /* 저장 공간 부족 */ }
  }
  function loadImg(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; }); }
  async function loadCard() {
    try {
      const d = JSON.parse(localStorage.getItem(CARD_KEY) || '{}');
      if (d.info) {
        CARD_F.forEach(k => { S.card[k] = d.info[k] || ''; });
        S.card.companies = Array.isArray(d.info.companies) && d.info.companies.length ? d.info.companies.slice(0, 3) : [d.info.company || ''];
      }
      if (d.face) { S.cardFaceUrl = d.face; S.cardFace = await loadImg(d.face); }
    } catch (e) { /* 무시 */ }
    CARD_F.forEach(k => { const el = $('#card_' + k); if (el) el.value = S.card[k]; });
    renderComps();
    renderFace();
  }
  // ── 여러 회사 (BK톡톡과 같음: 최대 3개, 여러 개면 지점명은 안 넣음) ──
  function syncComps() {
    const names = S.card.companies.map(v => v.trim()).filter(Boolean);
    S.card.company = names.join(' · ');
    const multi = names.length > 1;
    $('#card_branch').disabled = multi;
    $('#compNote').hidden = !multi;
    $('#compAdd').hidden = S.card.companies.length >= 3;
  }
  function renderComps() {
    $('#compList').innerHTML = S.card.companies.map((v, i) => `<div class="compRow"><input type="text" data-ci="${i}" value="${v.replace(/"/g, '&quot;')}" placeholder="${i ? '예: 삼성화재' : '예: 삼성생명'}">${i ? `<button type="button" data-cx="${i}" aria-label="회사 빼기">✕</button>` : ''}</div>`).join('');
    syncComps();
  }
  $('#compList').addEventListener('input', e => {
    const i = e.target.dataset.ci; if (i == null) return;
    S.card.companies[+i] = e.target.value; syncComps(); saveCard(); cardChanged(400);
  });
  $('#compList').addEventListener('click', e => {
    const b = e.target.closest('button[data-cx]'); if (!b) return;
    S.card.companies.splice(+b.dataset.cx, 1); renderComps(); saveCard(); cardChanged(0);
  });
  $('#compAdd').addEventListener('click', () => {
    if (S.card.companies.length >= 3) return;
    S.card.companies.push(''); renderComps();
    const ins = $$('#compList input'); ins[ins.length - 1].focus();
  });
  function cardInfo() {
    const multi = S.card.companies.map(v => v.trim()).filter(Boolean).length > 1;
    return { company: S.card.company, branch: multi ? '' : S.card.branch, role: S.card.role, name: S.card.name, phone: fmtPhone(S.card.phone), msg: S.card.msg };
  }
  // ── 명함 미리보기 + 바뀌면 미리보기 화면을 명함이 보이는 곳으로 ──
  let prevTimer = 0;
  function cardChanged(delay) {
    clearTimeout(prevTimer);
    prevTimer = setTimeout(async () => {
      const i = cardInfo(), has = !!(i.name || i.company || i.phone);
      $('#cardPrevEmpty').hidden = has; $('#cardPrev').hidden = !has;
      if (has) {
        await E.ensureFont({ family: 'Noto Sans KR', weight: 800, gf: 'Noto+Sans+KR:wght@500;700;800' }, Object.values(i).join('') + '0123456789-');
        const c = E.makeCard(i, 720, S.cardFace || null);
        $('#cardPrev').src = c.toDataURL('image/png');
        c.width = 0;
      }
      if (P.pj && !P.playing && S.set.cardMode !== 'none') {
        const T = P.pj.total, m = S.set.cardMode;
        if (m === 'ends' && P.t > 4 && P.t < T - 4) P.t = 1.5;
        if (m === 'end' && P.t < T - 4) P.t = Math.max(0, T - 2);
      }
      scheduleRebuild(0);
    }, delay);
  }
  function renderFace() {
    $('#faceThumb').src = S.cardFaceUrl || '';
    $('#faceThumb').hidden = !S.cardFaceUrl;
    $('#faceText').textContent = S.cardFaceUrl ? '얼굴 사진 바꾸기' : '얼굴 사진 선택 (선택)';
    updateShows();
  }
  CARD_F.forEach(k => {
    const el = $('#card_' + k);
    el.addEventListener('input', () => { S.card[k] = el.value.trim(); saveCard(); cardChanged(400); });
    if (k === 'phone') el.addEventListener('change', () => { el.value = fmtPhone(el.value); S.card.phone = el.value; saveCard(); cardChanged(0); });
  });
  $('#cardMsgChips').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    $('#card_msg').value = b.textContent; S.card.msg = b.textContent; saveCard(); cardChanged(0);
  });
  $('#faceFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const { img, release } = await E.loadImage(f);
      const S2 = 420, c = E.mkCanvas(S2, S2), x = c.getContext('2d');
      const iw = img.naturalWidth, ih = img.naturalHeight, sc = Math.max(S2 / iw, S2 / ih);
      x.drawImage(img, (S2 - iw * sc) / 2, (S2 - ih * sc) * 0.3, iw * sc, ih * sc);
      release();
      S.cardFaceUrl = c.toDataURL('image/jpeg', 0.85);
      S.cardFace = await loadImg(S.cardFaceUrl);
      saveCard(); renderFace(); cardChanged(0);
    } catch (err) { toast('사진을 열 수 없어요'); }
  });
  $('#faceRemove').addEventListener('click', () => { S.cardFace = null; S.cardFaceUrl = ''; saveCard(); renderFace(); cardChanged(0); });

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
    const { scenes, total } = hasVid() ? planMixed(blocks.length, minTotal) : E.planScenes({
      nImages: S.photos.length, perDur: st.perDur, musicMode, musicDur: mdur,
      minScenes: blocks.length, minTotal, maxTotal: st.maxLen, beats,
    });
    if (blocks.length) scenes.forEach((s, k) => { s.text = blocks[k] || ''; });
    else if (mode === 'per') scenes.forEach(s => { s.text = S.perText[S.photos[s.img].id] || ''; });
    const trans = Math.min(st.transDur, 0.45 * Math.min(...scenes.map(s => s.end - s.start)));
    scenes.forEach((sc, k) => {
      const per = S.animPer[S.photos[sc.img].id];
      let a = per && per !== 'default' ? per : st.anim;
      if (a === 'auto') a = E.AUTO_ANIMS[k % E.AUTO_ANIMS.length];
      sc.anim = a;
    });
    const subs = srt || E.subsFromScenes(scenes, trans, total);
    // 소리: 배경음악 + 영상 속 소리 (영상 소리가 나올 땐 배경음악은 쉼)
    const clips = [], duck = [];
    if (st.clipSound === 'clip') scenes.forEach(sc => {
      const it = S.photos[sc.img];
      if (it.kind === 'video' && it.abuf) {
        clips.push({ buffer: it.abuf, at: sc.start, offset: sc.clipStart || 0, dur: sc.end - sc.start });
        duck.push([sc.start, sc.end]);
      }
    });
    const audio = (S.audio || clips.length) ? {
      buffer: S.audio ? S.audio.buffer : null, start: st.bgmStart, volume: st.volume, fadeIn: 0.5, fadeOut: st.fadeOut,
      clips, duck, clipVolume: 1,
    } : null;
    const cardOn = st.cardMode !== 'none' && (S.card.name || S.card.company || S.card.phone);
    return {
      photos: S.photos.slice(), scenes, total, subs,
      style: {
        font: st.font === 'custom' && !E.fontDef('custom').family ? 'noto' : st.font, size: st.size, color: st.color, stroke: st.stroke,
        strokeW: st.strokeW, shadow: st.shadow, box: st.box, boxColor: st.boxColor, boxOp: st.boxOp, align: st.align,
        yPos: st.yPos, anim: st.anim, lineSp: st.lineSp,
      },
      topText: st.topText || '', bottomText: st.bottomText || '',
      fixedStyle: { top: { font: st.topFont, size: st.topSize, color: st.topColor }, bottom: { font: st.botFont, size: st.botSize, color: st.botColor } },
      transition: st.transition, transDur: st.transDur, motion: st.motion, strength: st.strength, fit: st.fit, filter: st.filter,
      particles: st.particles.filter(k => k !== 'custom' || S.stickers.length), density: st.density, stickers: S.stickers,
      frame: st.frame === 'custom' && !S.frameImg ? 'none' : st.frame, frameImg: S.frameImg, vignette: st.vignette,
      overlayVideo: null, ovOpacity: st.ovOp, fadeEdges: st.fadeEdges,
      audio,
      card: cardOn ? { mode: st.cardMode, info: cardInfo(), face: S.cardFace } : null,
    };
  }
  /** 동영상이 섞여 있을 때: 사진은 '1장당 시간', 동영상은 자기 길이(최대 길이까지) */
  function planMixed(nBlocks, minTotal) {
    const st = S.set, items = S.photos, n = Math.max(items.length, nBlocks, 1);
    const scenes = [];
    let t = 0;
    for (let k = 0; k < n; k++) {
      const it = items[k % items.length];
      const d = it.kind === 'video' ? clipLenOf(it) : st.perDur;
      scenes.push({ img: k % items.length, start: t, end: t + d, text: '', clipStart: 0 });
      t += d;
    }
    let total = Math.max(t, minTotal);
    if (st.maxLen > 0 && total > st.maxLen) {
      total = st.maxLen;
      while (scenes.length > 1 && scenes[scenes.length - 1].start > total - 1) scenes.pop();
    }
    scenes[scenes.length - 1].end = total;
    return { scenes, total };
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
    // 맨 처음(0초)은 '시작 페이드' 때문에 까맣게 보이므로, 멈춘 화면은 1.2초 장면을 보여 줌
    const tt = P.t < 0.05 ? Math.min(1.2, r.pj.total / 2) : P.t;
    r.syncPlay(tt, false);
    try { await r.ensureFor(tt); } catch (e) { toast('사진을 불러오지 못했어요'); return; }
    if (r !== P.r || P.playing) return;
    r.draw(P.ctx, tt);
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
    if (!pj.audio) return 'none';
    const a = pj.audio;
    const cl = a.clips.map(c => `${c.at.toFixed(2)}:${c.dur.toFixed(2)}:${S.photos.find(p => p.abuf === c.buffer)?.id}`).join(',');
    return [S.audio ? S.audio.name + S.audio.duration : '-', a.start, a.volume, a.fadeOut, pj.total.toFixed(2), cl].join('|');
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
      if (P.r) { P.r.syncPlay(t, true); P.r.draw(P.ctx, t); }
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
    if (P.r) P.r.syncPlay(0, false);
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
    if (k === 'clipMax') renderPhotos();
    if (k === 'cardMode') { cardChanged(0); return; }
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
    pj.exporting = true;
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
      if (!S.audio) { if (window.BKMUSIC) await setBuiltin('piano'); else { const m = await window.SAMPLES.sampleMusic(); await setMusic(m); } }
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
    // 새 버전이 올라오면 자동으로 바뀜 (BK톡톡과 같은 방식) — 영상을 만드는 중에는 새로고침하지 않음
    const had = !!navigator.serviceWorker.controller;
    let pendingReload = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!had || window.__rl) return;
      if (S.busy) { pendingReload = true; return; }
      if (S.photos.length) { toast('새 버전이 나왔어요 · 다음에 앱을 열 때 바뀌어요', 4000); return; }
      window.__rl = 1; location.reload();
    });
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(r => r.update()).catch(() => {}));
    setInterval(() => { if (pendingReload && !S.busy && !S.photos.length) location.reload(); }, 5000);
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
  renderBuiltinList();
  renderCapThemes();
  markCapTheme();
  renderPhotos();
  renderMusic();
  updateBlockCount();
  checkSupport();
  loadCard().then(() => cardChanged(0));
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  window.__app = { S, P, buildProject, addPhotos, addVideos, setMusic, setBuiltin, doExport, fillCaptions }; // 테스트용
})();

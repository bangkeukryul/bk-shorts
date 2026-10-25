/*!
 * samples.js — "샘플로 체험하기" 용 예시 사진 4장 + 배경음악(약 24초)을 코드로 직접 만듭니다.
 * (저작권 걱정 없는 자체 생성 이미지/음원)
 */
(function (g) {
  'use strict';
  function rnd(seed) { let a = seed; return () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; }; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function toFile(c, name) {
    return new Promise(res => c.toBlob(b => res(new File([b], name, { type: 'image/jpeg' })), 'image/jpeg', 0.9));
  }
  function stars(x, W, H, r, n, maxY) {
    for (let i = 0; i < n; i++) {
      const s = r() * 2.2 + 0.4;
      x.globalAlpha = 0.4 + r() * 0.6;
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(r() * W, r() * H * maxY, s, 0, Math.PI * 2); x.fill();
    }
    x.globalAlpha = 1;
  }
  function glow(x, cx, cy, rad, color) {
    const gr = x.createRadialGradient(cx, cy, 0, cx, cy, rad);
    gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gr; x.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }
  function hills(x, W, H, base, amp, color, seed) {
    const r = rnd(seed);
    x.fillStyle = color; x.beginPath(); x.moveTo(0, H);
    for (let i = 0; i <= 12; i++) x.lineTo(W * i / 12, H * base - amp * (0.4 + r() * 0.6) * Math.sin(i * 0.9 + seed));
    x.lineTo(W, H); x.closePath(); x.fill();
  }

  function nightSky() {
    const W = 1080, H = 1920, c = canvas(W, H), x = c.getContext('2d'), r = rnd(3);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0b1240'); gr.addColorStop(0.55, '#3b2a7a'); gr.addColorStop(1, '#c46aa3');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    stars(x, W, H, r, 260, 0.7);
    glow(x, 760, 420, 300, 'rgba(255,240,200,0.45)');
    x.fillStyle = '#fff6dc'; x.beginPath(); x.arc(760, 420, 90, 0, Math.PI * 2); x.fill();
    hills(x, W, H, 0.78, 140, '#2a1d55', 2);
    hills(x, W, H, 0.86, 110, '#160f33', 5);
    return c;
  }
  function sunset() {
    const W = 1080, H = 1920, c = canvas(W, H), x = c.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, H * 0.62);
    gr.addColorStop(0, '#3d2b6b'); gr.addColorStop(0.5, '#f0768b'); gr.addColorStop(1, '#ffc27a');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    glow(x, W / 2, H * 0.6, 520, 'rgba(255,214,140,0.8)');
    x.fillStyle = '#ffe2a8'; x.beginPath(); x.arc(W / 2, H * 0.6, 130, Math.PI, 0); x.fill();
    const sea = x.createLinearGradient(0, H * 0.6, 0, H);
    sea.addColorStop(0, '#d9708a'); sea.addColorStop(1, '#2a2050');
    x.fillStyle = sea; x.fillRect(0, H * 0.6, W, H * 0.4);
    x.strokeStyle = 'rgba(255,226,168,0.55)';
    for (let i = 0; i < 14; i++) { const y = H * 0.62 + i * 26, w = 260 - i * 14; x.lineWidth = 4; x.beginPath(); x.moveTo(W / 2 - w, y); x.lineTo(W / 2 + w, y); x.stroke(); }
    x.strokeStyle = '#2a1b3d'; x.lineWidth = 6; x.lineCap = 'round';
    [[300, 520], [380, 470], [700, 600], [770, 560]].forEach(([bx, by]) => { x.beginPath(); x.moveTo(bx - 30, by - 12); x.quadraticCurveTo(bx - 12, by - 20, bx, by); x.quadraticCurveTo(bx + 12, by - 20, bx + 30, by - 12); x.stroke(); });
    return c;
  }
  function flowers() {
    const W = 1080, H = 1920, c = canvas(W, H), x = c.getContext('2d'), r = rnd(9);
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#ffe3ec'); gr.addColorStop(1, '#c8e6c9');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 40; i++) glow(x, r() * W, r() * H * 0.6, 60 + r() * 120, `rgba(255,${180 + r() * 60 | 0},${200 + r() * 40 | 0},0.35)`);
    for (let i = 0; i < 26; i++) {
      const fx = r() * W, fy = H * 0.45 + r() * H * 0.55, s = 40 + r() * 70;
      x.strokeStyle = '#5d8a4e'; x.lineWidth = 6; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + (r() - 0.5) * 60, H); x.stroke();
      const col = ['#ff8fab', '#ffb3c6', '#f7d6e0', '#ffd166', '#cdb4db'][i % 5];
      x.fillStyle = col;
      for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; x.beginPath(); x.ellipse(fx + Math.cos(a) * s * 0.5, fy + Math.sin(a) * s * 0.5, s * 0.42, s * 0.26, a, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = '#ffe08a'; x.beginPath(); x.arc(fx, fy, s * 0.24, 0, Math.PI * 2); x.fill();
    }
    return c;
  }
  function forest() {
    const W = 1440, H = 1080, c = canvas(W, H), x = c.getContext('2d'), r = rnd(21); // 가로 사진 → 흐린 배경 맞춤 예시
    const gr = x.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#9ed2e6'); gr.addColorStop(0.6, '#e8f3d6'); gr.addColorStop(1, '#4c7a4a');
    x.fillStyle = gr; x.fillRect(0, 0, W, H);
    glow(x, W * 0.7, H * 0.25, 380, 'rgba(255,250,220,0.8)');
    for (let layer = 0; layer < 3; layer++) {
      x.fillStyle = ['#7fae86', '#4f8a5b', '#2e5e3e'][layer];
      for (let i = 0; i < 14; i++) {
        const tx = r() * W, base = H * (0.62 + layer * 0.1), th = 220 + r() * 260 - layer * 30, tw = th * 0.35;
        x.beginPath(); x.moveTo(tx, base - th); x.lineTo(tx - tw, base); x.lineTo(tx + tw, base); x.closePath(); x.fill();
      }
    }
    x.fillStyle = '#d9c7a1'; x.beginPath(); x.moveTo(W * 0.42, H); x.quadraticCurveTo(W * 0.5, H * 0.8, W * 0.52, H * 0.74); x.lineTo(W * 0.55, H * 0.74); x.quadraticCurveTo(W * 0.6, H * 0.8, W * 0.66, H); x.fill();
    return c;
  }

  async function sampleImages() {
    const list = [[nightSky, '샘플1_밤하늘.jpg'], [sunset, '샘플2_노을.jpg'], [flowers, '샘플3_꽃밭.jpg'], [forest, '샘플4_숲길.jpg']];
    const out = [];
    for (const [fn, name] of list) out.push(await toFile(fn(), name));
    return out;
  }

  // ── 배경음악: 90 BPM, C–G–Am–F 코드 + 킥 + 아르페지오 (약 24초) ──
  function encodeWav(buf) {
    const ch = buf.numberOfChannels, sr = buf.sampleRate, n = buf.length;
    const dv = new DataView(new ArrayBuffer(44 + n * ch * 2));
    const ws = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    ws(0, 'RIFF'); dv.setUint32(4, 36 + n * ch * 2, true); ws(8, 'WAVE'); ws(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true); dv.setUint32(24, sr, true);
    dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true); dv.setUint16(34, 16, true);
    ws(36, 'data'); dv.setUint32(40, n * ch * 2, true);
    const chans = []; for (let c = 0; c < ch; c++) chans.push(buf.getChannelData(c));
    let o = 44;
    for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) { const v = Math.max(-1, Math.min(1, chans[c][i])); dv.setInt16(o, v * 32767, true); o += 2; }
    return dv.buffer;
  }
  async function sampleMusic() {
    const SR = 44100, BPM = 90, beat = 60 / BPM, bars = 9, dur = bars * 4 * beat;
    const OAC = g.OfflineAudioContext || g.webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.ceil(dur * SR), SR);
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    const chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]];
    const note = (freq, t, len, type, vol, attack = 0.02) => {
      const o = ctx.createOscillator(), gn = ctx.createGain();
      o.type = type; o.frequency.value = freq;
      gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + attack); gn.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(gn); gn.connect(master); o.start(t); o.stop(t + len + 0.05);
    };
    for (let b = 0; b < bars; b++) {
      const t0 = b * 4 * beat, ch = chords[b % 4];
      ch.forEach(m => note(hz(m), t0, 4 * beat, 'triangle', 0.05, 0.4));
      note(hz(ch[0] - 24), t0, 2 * beat, 'sine', 0.22); note(hz(ch[0] - 24), t0 + 2 * beat, 2 * beat, 'sine', 0.18);
      for (let q = 0; q < 8; q++) note(hz(ch[q % 3] + 12 + (q > 3 ? 12 : 0)), t0 + q * beat / 2, 0.35, 'sine', 0.06);
      for (let q = 0; q < 4; q++) {
        const t = t0 + q * beat, o = ctx.createOscillator(), gn = ctx.createGain();
        o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
        gn.gain.setValueAtTime(q % 2 ? 0.45 : 0.75, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
        o.connect(gn); gn.connect(master); o.start(t); o.stop(t + 0.25);
      }
    }
    const buf = await new Promise((res, rej) => { ctx.oncomplete = e => res(e.renderedBuffer); const p = ctx.startRendering(); if (p && p.then) p.then(res, rej); });
    return new File([encodeWav(buf)], '샘플음악_90BPM.wav', { type: 'audio/wav' });
  }

  g.SAMPLES = { sampleImages, sampleMusic };
})(window);

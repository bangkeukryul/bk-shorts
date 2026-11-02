/*! lib.js — 📥 내 사진 보관함 (BK쇼츠 첫 화면 · 영상 편집이 함께 씀)
   사진 · 동영상 원본은 이 휴대폰 안(IndexedDB 'bk-lib')에만 보관해요. 밖으로 나가지 않아요. */
(function (g) {
  'use strict';
  let dbp = null;
  function db() {
    if (dbp) return dbp;
    dbp = new Promise((res, rej) => {
      let r; try { r = indexedDB.open('bk-lib', 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = () => { r.result.createObjectStore('f'); r.result.createObjectStore('m'); };
      r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
    });
    return dbp;
  }
  async function tx(store, mode, fn) {
    const d = await db();
    return new Promise((res, rej) => { const t = d.transaction(store, mode), s = t.objectStore(store); const q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
  }
  const kindOf = f => /^image\//.test(f.type) || /\.(jpe?g|png|webp|gif|heic|heif|bmp)$/i.test(f.name || '') ? 'image' : /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|3gp)$/i.test(f.name || '') ? 'video' : null;
  const keyOf = f => [f.name || '', f.size || 0, f.lastModified || 0].join('|');
  let listeners = [];
  const changed = () => listeners.forEach(fn => { try { fn(); } catch (e) { /* 무시 */ } });

  /* 작은 그림 (보관함 목록용) */
  function thumbImage(blob) {
    return new Promise(res => {
      const url = URL.createObjectURL(blob), im = new Image();
      im.onload = () => { try { const k = 160 / Math.max(im.width, im.height), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(im.width * Math.min(1, k))); c.height = Math.max(1, Math.round(im.height * Math.min(1, k))); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', .72)); } catch (e) { res(''); } URL.revokeObjectURL(url); };
      im.onerror = () => { URL.revokeObjectURL(url); res(''); }; im.src = url;
    });
  }
  function thumbVideo(blob) {
    return new Promise(res => {
      const url = URL.createObjectURL(blob), v = document.createElement('video'); let done = false;
      const fin = s => { if (done) return; done = true; URL.revokeObjectURL(url); res(s || ''); };
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      v.onloadeddata = () => { try { v.currentTime = Math.min(.5, (v.duration || 1) / 3); } catch (e) { fin(''); } };
      v.onseeked = () => { try { const k = 160 / Math.max(v.videoWidth, v.videoHeight), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(v.videoWidth * k)); c.height = Math.max(1, Math.round(v.videoHeight * k)); c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); fin(c.toDataURL('image/jpeg', .72)); } catch (e) { fin(''); } };
      v.onerror = () => fin(''); setTimeout(() => fin(''), 4000); v.src = url;
    });
  }
  async function list() { try { const a = await tx('m', 'readonly', s => s.getAll()); return (a || []).sort((x, y) => (y.at || 0) - (x.at || 0)); } catch (e) { return []; } }
  async function add(f) {
    const kind = kindOf(f); if (!kind) return null;
    const all = await list(), key = keyOf(f), old = all.find(m => m.key === key); if (old) return old.id;
    const id = 'L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const th = kind === 'image' ? await thumbImage(f) : await thumbVideo(f);
    await tx('f', 'readwrite', s => s.put(f, id));
    await tx('m', 'readwrite', s => s.put({ id, key, name: f.name || (kind === 'image' ? '사진.jpg' : '동영상.mp4'), type: f.type || '', size: f.size || 0, lm: f.lastModified || Date.now(), kind, th, at: Date.now() }, id));
    return id;
  }
  let q = Promise.resolve();
  function addMany(files) {   // 차례로 담기 (뒤에서 조용히)
    const fs = Array.from(files || []).filter(kindOf); if (!fs.length) return Promise.resolve([]);
    const job = q.then(async () => { const ids = []; for (const f of fs) { try { const id = await add(f); if (id) ids.push(id); } catch (e) { /* 공간 부족 등 */ } } changed(); return ids; });
    q = job.catch(() => []); return job;
  }
  async function getFile(id) {
    const [b, m] = await Promise.all([tx('f', 'readonly', s => s.get(id)), tx('m', 'readonly', s => s.get(id))]);
    if (!b || !m) return null;
    try { return new File([b], m.name, { type: m.type || b.type, lastModified: m.lm }); } catch (e) { b.name = m.name; return b; }
  }
  async function del(id) { await tx('f', 'readwrite', s => s.delete(id)); await tx('m', 'readwrite', s => s.delete(id)); changed(); }
  async function clear() { await tx('f', 'readwrite', s => s.clear()); await tx('m', 'readwrite', s => s.clear()); changed(); }
  const size = n => n >= 1e9 ? (n / 1e9).toFixed(1) + 'GB' : n >= 1e6 ? Math.round(n / 1e6) + 'MB' : Math.max(1, Math.round(n / 1e3)) + 'KB';
  g.BKLIB = { add, addMany, list, getFile, del, clear, keyOf, kindOf, size, on: fn => listeners.push(fn) };

  /* ── BK쇼츠 첫 화면 ✂️ 편집 탭: 보관함 칸 ── */
  function mount(box) {
    if (!box) return;
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    async function draw() {
      const L = await list(), tot = L.reduce((p, m) => p + (m.size || 0), 0), nv = L.filter(m => m.kind === 'video').length;
      box.innerHTML = `<div class="libh"><b>📥 내 사진 보관함</b><span>${L.length ? `${L.length - nv}장${nv ? ` · 동영상 ${nv}개` : ''} · ${size(tot)}` : '비어 있어요'}</span></div>
        <div class="libbtns"><label class="libpick">📷 사진 · 🎞 동영상 고르기<input type="file" accept="image/*,video/*" multiple hidden></label><label class="libpick f">📁 내 파일 · 다운로드에서<input type="file" multiple hidden></label></div>
        <p class="libhint">여기서 고르거나 <b>사진 탭</b>에서 고른 사진은 자동으로 담겨요 → 영상 편집의 🗂 서랍 · 첫 화면에서 「📥 보관함에서」로 바로 꺼내 써요. 📁 「파일」에서 첫 사진을 <b>꾹</b> 누르면 여러 장 고르기.</p>
        ${L.length ? `<div class="libgrid">${L.map(m => `<div class="libt" title="${esc(m.name)}">${m.th ? `<img src="${m.th}" alt="">` : `<span class="libno">${m.kind === 'video' ? '🎞' : '🖼'}</span>`}${m.kind === 'video' ? '<i>🎞</i>' : ''}<button type="button" data-del="${m.id}" aria-label="보관함에서 빼기">✕</button></div>`).join('')}</div>
        <button type="button" class="libclr">🗑 보관함 비우기</button>` : ''}`;
    }
    box.addEventListener('change', async e => {
      const inp = e.target; if (inp.type !== 'file') return; const fs = Array.from(inp.files || []).filter(kindOf); inp.value = '';
      if (!fs.length) return; const h = box.querySelector('.libh span'); if (h) h.textContent = `담는 중… (${fs.length}개)`; await addMany(fs);
    });
    box.addEventListener('click', async e => {
      const d = e.target.closest('[data-del]'); if (d) { if (confirm('이 사진을 보관함에서 뺄까요?\n(휴대폰 갤러리의 원본은 그대로예요)')) await del(d.dataset.del); return; }
      if (e.target.closest('.libclr')) { if (confirm('보관함을 모두 비울까요?\n(휴대폰 갤러리의 원본은 그대로예요)')) await clear(); }
    });
    listeners.push(draw); draw();
  }
  g.BKLIB.mount = mount;
})(window);

/*!
 * talk.js — 🎙 말하는 쇼츠 (관리자 미리보기)
 * 자료 → AI 대본(요청서) → 내 목소리(PC BK보이스 · 음성 파일 · 직접 녹음) → 문장마다 자막 · 장면이 목소리에 맞춰 넘어가는 쇼츠
 * 모든 처리는 이 휴대폰 안에서만 (PC 목소리를 쓸 때만 내 PC와 직접 연결)
 */
(function () {
  'use strict';
  const A = window.__app, E = window.ENG;
  if (!A || !E || !document.getElementById('p-talk')) return;
  const $ = s => document.getElementById(s);
  const KEY = 'bk-shorts-talk.v1';

  // ═════════ 소재 템플릿 ═════════
  const TOPICS = {
    politics: { e: '📰', n: '정치·정책 뉴스', ch: '1분 정치 뉴스', src: '정책브리핑 www.korea.kr', bg: ['#0b1f4d', '#1e3a8a', '#b91c1c'],
      hook: '정책의 핵심 변화나 대상자가 바로 알 수 있는 한 문장 (예: 이런 분들, 꼭 확인하세요!)',
      body: '무엇이 바뀌는지 → 누가 대상인지 → 금액 · 날짜 · 신청 방법 순서로. 어려운 법률 · 행정 용어는 쉬운 말로 풀어 줘.',
      tone: '차분하고 신뢰감 있는 뉴스 진행자 말투',
      rules: ['확정된 것과 예정 · 검토 중인 것을 꼭 구분해', '정부 발표와 언론의 해석을 구분해', '특정 정당 · 정치인을 근거 없이 칭찬하거나 비난하지 마', '조건 · 예외를 빼서 시청자가 오해하게 만들지 마'],
      cta: '‘신청 대상인지 확인해 보세요’ · ‘필요한 분께 공유해 주세요’ 같은 행동 한 가지' },
    economy: { e: '💰', n: '경제·재테크', ch: '1분 경제', src: '', bg: ['#052e16', '#166534', '#ca8a04'],
      hook: '내 지갑과 바로 연결되는 한 문장 (예: 이거 모르면 손해예요!)',
      body: '무슨 일인지 → 왜 중요한지 → 내 생활 · 지갑에 미치는 영향 → 지금 할 수 있는 일 순서로.',
      tone: '쉽고 친근한 경제 해설가 말투',
      rules: ['특정 종목 · 코인 · 상품을 사라 · 팔라고 권하지 마', '수익을 보장하는 표현 금지', '숫자는 자료에 있는 것만'],
      cta: '‘내 상황에 맞는지 꼭 확인하세요’ 같은 행동 한 가지' },
    life: { e: '🏠', n: '생활·보험 상식', ch: '1분 생활 꿀팁', src: '', bg: ['#0c4a6e', '#0369a1', '#f59e0b'],
      hook: '많이들 모르는 사실 한 문장 (예: 이거 알면 병원비 아껴요!)',
      body: '흔한 상황 → 핵심 정보 → 꼭 확인할 것 2~3가지 → 주의할 점 순서로.',
      tone: '친절한 상담사 말투',
      rules: ['특정 회사 · 상품 가입을 권하지 마', '보장 · 혜택은 상품 · 조건마다 다르다는 점을 꼭 밝혀', '의료 · 법률 판단은 전문가 확인을 권해'],
      cta: '‘내 보험 · 서류를 한번 확인해 보세요’ 같은 행동 한 가지' },
    humor: { e: '😂', n: '유머·웃긴 이야기', ch: '1분 웃음', src: '', bg: ['#4a044e', '#a21caf', '#facc15'],
      hook: '궁금증을 일으키는 상황 한 줄',
      body: '상황 설명 → 빌드업 → 마지막에 반전(펀치라인) 한 방.',
      tone: '빠르고 생동감 있는 입담',
      rules: ['특정인 · 지역 · 성별 · 외모 · 직업 비하 금지', '실존 인물에 대한 이야기를 지어내지 마'],
      cta: '‘친구에게 공유해 보세요’ 같은 한마디' },
    animal: { e: '🐶', n: '동물', ch: '1분 동물 이야기', src: '', bg: ['#431407', '#c2410c', '#fde68a'],
      hook: '귀엽거나 놀라운 순간 한 문장',
      body: '동물 소개 → 신기한 사실이나 속마음 더빙 → 귀여운 마무리.',
      tone: '다정하고 귀여운 말투',
      rules: ['동물을 괴롭히거나 위험한 행동을 재미로 그리지 마', '사실 정보는 자료와 확실한 상식 안에서만'],
      cta: '‘우리 집 아이 이야기도 댓글로 알려 주세요’ 같은 한마디' },
    story: { e: '💌', n: '감동 사연', ch: '1분 사연', src: '', bg: ['#1c1917', '#57534e', '#f472b6'],
      hook: '마음을 끄는 첫 장면 한 문장',
      body: '상황 → 어려움 → 따뜻한 반전 → 여운이 남는 마무리.',
      tone: '잔잔한 이야기체',
      rules: ['실제 인물을 알아볼 수 있는 정보(실명 · 회사 · 주소)를 넣지 마', '자료에 없는 일을 실화처럼 지어내지 마'],
      cta: '‘오늘 고마운 사람에게 연락해 보세요’ 같은 한마디' },
    free: { e: '✍️', n: '직접 입력', ch: '1분 이야기', src: '', bg: ['#1e1b4b', '#6d28d9', '#22d3ee'],
      hook: '자료 내용에 맞는 궁금증을 일으키는 한 문장',
      body: '자료 메모에 적은 주제와 방향대로, 핵심 → 이유 · 근거 → 마무리 순서로.',
      tone: '자연스럽고 친근한 말투',
      rules: ['자료에 없는 사실을 지어내지 마'],
      cta: '시청자가 할 수 있는 행동 한 가지' },
  };
  const LEN = { 15: [100, 6], 30: [200, 10], 45: [290, 14], 60: [380, 18] };
  const END_LINE = '좋아요와 구독 부탁드려요!';

  // ═════════ 저장 ═════════
  const DEF = { topic: 'politics', len: '60', per: {}, memo: '', ans: '', title: '', disp: '', read: '', thumb: '', desc: '', tags: '', srcOut: '', chk: '', pc: '', pin: '', vmode: 'pc', end: true };
  let T;
  try { T = Object.assign({}, DEF, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { T = Object.assign({}, DEF); }
  let saveT = 0;
  const save = () => { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(T)); } catch (e) { /* 저장 불가 */ } }, 250); };
  const P = () => { const t = TOPICS[T.topic] || TOPICS.politics; const p = T.per[T.topic] || {}; const ch = p.ch != null ? p.ch : t.ch;
    return { ch, open: p.open != null ? p.open : (ch ? `안녕하세요 ${ch}입니다.` : ''), src: p.src != null ? p.src : t.src }; };
  const setPer = (k, v) => { T.per[T.topic] = Object.assign({}, T.per[T.topic] || {}, { [k]: v }); save(); };

  const toast = (m, ms) => A.toast(m, ms);
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); return true; } catch (e) {
      const a = document.createElement('textarea'); a.value = t; document.body.appendChild(a); a.select();
      let r = false; try { r = document.execCommand('copy'); } catch (_) { /* 무시 */ } a.remove(); return r;
    }
  }
  function flash(btn, ok) { const o = btn.textContent; btn.textContent = ok ? '✅ 복사됨' : '복사 안 됨'; setTimeout(() => { btn.textContent = o; }, 1500); }
  const lines = t => String(t || '').replace(/\r/g, '').split('\n').map(s => s.trim()).filter(Boolean);
  const plain = s => s.replace(/[\s.,!?~·…'"“”‘’()\-]/g, '');

  // ═════════ ① 소재 · 분량 ═════════
  function renderTopics() {
    $('tkTopics').innerHTML = Object.entries(TOPICS).map(([k, t]) => `<button type="button" data-v="${k}" aria-pressed="${k === T.topic}">${t.e} ${t.n}</button>`).join('');
    $('tkLen').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === T.len)));
    const p = P(); $('tkCh').value = p.ch; $('tkOpen').value = p.open; $('tkSrc').value = p.src;
    const L = LEN[T.len]; $('tkLenInfo').textContent = `→ 화면 대본 약 ${L[0]}자 · ${L[1]}줄 안팎 (말 빠르기에 따라 조금 달라져요)`;
  }
  $('tkTopics').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; T.topic = b.dataset.v; save(); renderTopics(); });
  $('tkLen').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; T.len = b.dataset.v; save(); renderTopics(); });
  $('tkCh').addEventListener('input', () => { const old = P(); setPer('ch', $('tkCh').value.trim());
    if (old.open === (old.ch ? `안녕하세요 ${old.ch}입니다.` : '')) { const ch = $('tkCh').value.trim(); setPer('open', ch ? `안녕하세요 ${ch}입니다.` : ''); $('tkOpen').value = P().open; } });
  $('tkOpen').addEventListener('input', () => setPer('open', $('tkOpen').value.trim()));
  $('tkSrc').addEventListener('input', () => setPer('src', $('tkSrc').value.trim()));
  $('tkMemo').value = T.memo; $('tkMemo').addEventListener('input', () => { T.memo = $('tkMemo').value; save(); });

  // ═════════ ② AI 요청서 ═════════
  function buildReq() {
    const t = TOPICS[T.topic], p = P(), L = LEN[T.len], memo = T.memo.trim();
    return `너는 유튜브 쇼츠 · 인스타 릴스 · 틱톡용 '${t.n}' 대본 작가야.
첨부한 캡처 · 자료${memo ? '와 아래 메모' : ''}를 꼼꼼히 읽고, 그 내용만으로 약 ${T.len}초 분량의 쇼츠 대본을 써 줘.

[채널] ${p.ch || '(없음)'}
[분량] 화면 대본 약 ${L[0]}자 (띄어쓰기 포함 · 출처 제외) · ${L[1]}줄 안팎
${memo ? `[메모]\n${memo}\n` : ''}
[구성]
1. 첫 줄: ${p.open ? `반드시 "${p.open}"` : '바로 후킹 문장으로 시작'}
2. ${p.open ? '둘째 줄' : '첫 줄'}: 후킹 — ${t.hook}
3. 본문: ${t.body}
4. 마무리: ${t.cta}${T.end ? `\n5. 마지막 줄: "${END_LINE}"` : ''}

[말투] ${t.tone}. 사람이 직접 말하듯 자연스럽게.

[꼭 지킬 점]
- 자료에 없는 사실 · 숫자 · 날짜를 만들지 마. 확실하지 않은 건 ■ 확인 필요에 적어.
${t.rules.map(r => '- ' + r).join('\n')}
- 과장 · 낚시성 표현 금지. 후킹도 자료 내용 안에서만.
- 한 줄 = 한 문장 = 영상 한 장면. 한 줄은 25자 안팎으로 짧게.
- 줄 번호 · 장면 설명 · 괄호 지문 · 이모지 · 마크다운 기호(**, # 등)를 쓰지 마.
- ‘읽기용 대본’은 ‘화면 대본’과 줄 수 · 순서가 똑같아야 해. 숫자 · 단위 · 영어 · 기호는 소리 나는 대로 한글로 바꿔 줘.
  (예: 30만 원 → 삼십만 원 / 11월 30일 → 십일월 삼십일 / 3.5% → 삼 점 오 퍼센트 / AI → 에이아이)

[답변 형식] 아래 칸 이름 그대로, 다른 설명 없이 답해 줘.
■ 제목
(쇼츠 제목 1개 · 30자 이내)
■ 화면 대본
(한 줄에 한 문장)
■ 읽기용 대본
(화면 대본과 같은 줄 수 · 소리 나는 대로)
■ 썸네일 문구
(10자 안팎 2개)
■ 설명
(유튜브 설명란 2~3줄)
■ 해시태그
(#태그 8개 안팎 · 한 줄)
■ 출처
(${p.src ? `"${p.src}" — 자료 출처가 다르면 자료에 적힌 출처로` : '자료에 적힌 출처 그대로 · 없으면 “확인 필요”'})
■ 확인 필요
(자료에서 확인이 필요한 부분 · 없으면 “없음”)`;
  }
  $('tkReqBtn').addEventListener('click', () => { $('tkReq').value = buildReq(); $('tkReqBox').hidden = false; $('tkReqBox').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  $('tkReqCopy').addEventListener('click', async e => flash(e.target, await copy($('tkReq').value || buildReq())));
  $('tkEnd').checked = !!T.end; $('tkEnd').addEventListener('change', () => { T.end = $('tkEnd').checked; save(); });

  // ═════════ ③ 답 정리 ═════════
  const HEADS = { '제목': 'title', '화면 대본': 'disp', '화면대본': 'disp', '읽기용 대본': 'read', '읽기용대본': 'read', '썸네일 문구': 'thumb', '썸네일': 'thumb', '설명': 'desc', '해시태그': 'tags', '출처': 'srcOut', '확인 필요': 'chk', '확인필요': 'chk' };
  function parseAns(txt) {
    const out = {};
    let cur = null;
    for (let raw of String(txt).replace(/\r/g, '').split('\n')) {
      if (/^\s*```/.test(raw)) continue;
      const h = raw.replace(/[*#>`]/g, '').trim().match(/^■\s*([^:：(]+?)\s*[:：]?\s*$/) || raw.replace(/[*#>`]/g, '').trim().match(/^■\s*([가-힣 ]+?)\s*[:：]\s*(.*)$/);
      if (h && HEADS[h[1].trim()]) { cur = HEADS[h[1].trim()]; out[cur] = []; if (h[2]) out[cur].push(h[2]); continue; }
      if (cur) out[cur].push(raw);
    }
    const clean = (arr, list) => (arr || []).map(s => s.replace(/\*\*/g, '').replace(/^\s*[-•·]\s+/, '').replace(list ? /^\s*\d+\s*[.)]\s*/ : /^$/, '').trim())
      .filter(s => s && !/^\(.*\)$/.test(s)).join('\n').trim();
    const r = {};
    Object.keys(out).forEach(k => { r[k] = clean(out[k], k === 'disp' || k === 'read'); });
    if (r.title) r.title = r.title.split('\n')[0].replace(/^["“]|["”]$/g, '');
    if (r.srcOut) r.srcOut = r.srcOut.split('\n')[0].replace(/^["“]|["”]$/g, '').replace(/^<?\s*자료\s*출처\s*[=:：]\s*/, '').replace(/>$/, '').trim();
    return r;
  }
  const SF = ['title', 'disp', 'read', 'thumb', 'desc', 'tags'];
  const ID = { title: 'tkTitle', disp: 'tkDisp', read: 'tkRead', thumb: 'tkThumb', desc: 'tkDesc', tags: 'tkTags' };
  function fillScript() { SF.forEach(k => { $(ID[k]).value = T[k] || ''; }); renderChecks(); }
  $('tkAns').value = T.ans; $('tkAns').addEventListener('input', () => { T.ans = $('tkAns').value; save(); });
  $('tkPaste').addEventListener('click', async () => { try { const t = await navigator.clipboard.readText(); if (t) { $('tkAns').value = t; T.ans = t; save(); doParse(); } } catch (e) { toast('칸을 길게 눌러 붙여넣어 주세요'); } });
  function doParse() {
    const r = parseAns($('tkAns').value);
    if (!r.disp && !r.read) {   // 형식 없이 대본만 붙여넣은 경우
      const ls = lines($('tkAns').value).filter(s => !/^■/.test(s));
      if (!ls.length) { toast('붙여넣은 내용이 없어요'); return; }
      r.disp = ls.join('\n');
    }
    if (!r.read) r.read = r.disp; if (!r.disp) r.disp = r.read;
    SF.concat(['srcOut', 'chk']).forEach(k => { T[k] = r[k] || ''; });
    if (r.srcOut && !/확인\s*필요/.test(r.srcOut)) { setPer('src', r.srcOut); $('tkSrc').value = r.srcOut; }
    save(); fillScript(); syncNarrText();
    $('tkScript').scrollIntoView({ behavior: 'smooth', block: 'start' });
    toast('✨ 정리했어요 · 대본을 확인해 주세요');
  }
  $('tkParse').addEventListener('click', doParse);
  SF.forEach(k => $(ID[k]).addEventListener('input', () => { T[k] = $(ID[k]).value; save(); if (k === 'disp' || k === 'read') { renderChecks(); syncNarrText(); } }));
  $('tkSame').addEventListener('click', () => { $('tkRead').value = $('tkDisp').value; T.read = T.disp; save(); renderChecks(); });
  function readText() { return lines($('tkRead').value || $('tkDisp').value).join('\n'); }
  $('tkCopyRead').addEventListener('click', async e => { const t = readText(); if (!t) { toast('대본이 없어요'); return; } flash(e.target, await copy(t)); });
  [['tkCopyTitle', 'tkTitle'], ['tkCopyDesc', null], ['tkCopyTags', 'tkTags']].forEach(([b, f]) => $(b).addEventListener('click', async e => {
    const t = f ? $(f).value : [$('tkDesc').value.trim(), '', $('tkTags').value.trim(), P().src ? `\n자료 출처: ${P().src}` : ''].join('\n').trim();
    flash(e.target, await copy(t));
  }));
  function renderChecks() {
    const d = lines($('tkDisp').value), r = lines($('tkRead').value), L = LEN[T.len], p = P();
    const chars = d.join(' ').length;
    const items = [];
    if (!d.length) { $('tkDispInfo').textContent = ''; $('tkCheck').innerHTML = ''; return; }
    $('tkDispInfo').textContent = `${d.length}줄 · ${chars}자 (목표 약 ${L[0]}자)`;
    const ok = (c, t) => items.push(`<li class="${c}">${c === 'ok' ? '✅' : c === 'warn' ? '⚠️' : '❌'} ${t}</li>`);
    ok(chars <= L[0] * 1.15 && chars >= L[0] * 0.6 ? 'ok' : 'warn', chars > L[0] * 1.15 ? `조금 길어요 (${chars}자) · ${T.len}초를 넘을 수 있어요` : chars < L[0] * 0.6 ? `조금 짧아요 (${chars}자)` : `길이 알맞음 (${chars}자)`);
    if (p.open) ok(plain(d[0]).includes(plain(p.open)) ? 'ok' : 'warn', plain(d[0]).includes(plain(p.open)) ? '첫 인사 있음' : `첫 줄이 ‘${p.open}’이 아니에요`);
    ok(d.length === r.length ? 'ok' : 'bad', d.length === r.length ? `화면 자막 · 읽기용 대본 줄 수 같음 (${d.length}줄)` : `줄 수가 달라요 (화면 ${d.length}줄 · 읽기용 ${r.length}줄) → 자막이 목소리와 어긋나요`);
    const longL = d.filter(s => s.length > 32).length;
    if (longL) ok('warn', `너무 긴 줄 ${longL}개 (32자 넘음) · 자막이 3줄이 될 수 있어요`);
    if (/\d/.test(r.join(''))) ok('warn', '읽기용 대본에 숫자가 남아 있어요 · 한글로 바꾸면 더 자연스럽게 읽어요');
    ok(p.src ? 'ok' : 'warn', p.src ? `출처: ${p.src}` : '출처가 비어 있어요 (뉴스 · 정보 영상은 꼭 넣어 주세요)');
    if (T.chk && !/^없음/.test(T.chk.trim())) ok('warn', '확인 필요: ' + T.chk.replace(/\n/g, ' / '));
    $('tkCheck').innerHTML = items.join('');
  }

  // ═════════ ④ 목소리 ═════════
  const AC = window.AudioContext || window.webkitAudioContext;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  async function decode(blob) {
    const buf = await blob.arrayBuffer();
    const ctx = new OAC(1, 44100, 44100);
    return await new Promise((res, rej) => {
      const fail = () => rej(new Error('음성 파일을 읽을 수 없어요 (WAV · MP3 · M4A 권장)'));
      const p = ctx.decodeAudioData(buf.slice(0), res, fail);
      if (p && p.then) p.then(res, fail);
    });
  }
  /** BK보이스 WAV 안의 문장 시간표('bkts') 읽기 */
  async function readBkts(blob) {
    try {
      const b = new Uint8Array(await blob.slice(0, Math.min(blob.size, 64 * 1048576)).arrayBuffer());
      const s4 = i => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);
      if (s4(0) !== 'RIFF' || s4(8) !== 'WAVE') return null;
      const dv = new DataView(b.buffer);
      for (let i = 12; i + 8 <= b.length;) {
        const id = s4(i), n = dv.getUint32(i + 4, true);
        if (id === 'bkts') return JSON.parse(new TextDecoder().decode(b.subarray(i + 8, i + 8 + n))).segs || null;
        i += 8 + n + (n % 2);
      }
    } catch (e) { /* 시간표 없음 */ }
    return null;
  }
  /** 쉬는 곳을 찾아 n개 문장으로 나눔 */
  function splitBySilence(buf, n) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, hop = Math.round(sr * 0.02), F = Math.floor(d.length / hop);
    const rms = new Float32Array(F);
    for (let f = 0; f < F; f++) { let s = 0; for (let i = f * hop, e = i + hop; i < e; i++) s += d[i] * d[i]; rms[f] = Math.sqrt(s / hop); }
    const sorted = Array.from(rms).sort((a, b) => a - b), floor = sorted[Math.floor(F * 0.1)] || 0, peak = sorted[Math.floor(F * 0.98)] || 0.1;
    const th = Math.max(floor * 2.5, peak * 0.06, 0.004);
    const voiced = Array.from(rms, v => v > th);
    let first = voiced.indexOf(true), last = voiced.lastIndexOf(true);
    if (first < 0) { first = 0; last = F - 1; }
    const runs = [];
    for (let f = first; f <= last;) { if (!voiced[f]) { const s = f; while (f <= last && !voiced[f]) f++; if (f - s >= 6) runs.push([s, f]); } else f++; }
    const T0 = first * hop / sr, T1 = (last + 1) * hop / sr;
    if (n <= 1 || !runs.length) return [{ s: T0, e: T1 }];
    const pick = runs.slice().sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, n - 1).sort((a, b) => a[0] - b[0]);
    const segs = []; let s = T0;
    pick.forEach(r => { segs.push({ s, e: r[0] * hop / sr }); s = r[1] * hop / sr; });
    segs.push({ s, e: T1 });
    return segs;
  }
  function textsFor(n) {
    const d = lines($('tkDisp').value), r = lines($('tkRead').value);
    if (d.length === n) return d;
    if (r.length === n) return r;
    return null;
  }
  function setNarr(buffer, segs, name, how) {
    const texts = textsFor(segs.length);
    segs.forEach((g, k) => { g.t = texts ? texts[k] : (g.t || ''); });
    A.S.narr = { id: Date.now(), buffer, duration: buffer.duration, segs, name, how, on: true, gain: A.S.narr ? A.S.narr.gain : 1 };
    renderNarr();
    A.scheduleRebuild(0);
    if (!texts && !segs.some(g => g.t)) toast('⚠️ 문장 수가 대본 줄 수와 달라 자막을 못 맞췄어요 · ③ 대본을 확인해 주세요', 5000);
    else if (!A.S.photos.length) toast('목소리를 넣었어요 · 이제 사진(캡처)을 넣거나 🖼 배경 자동 만들기를 눌러 주세요', 4500);
    else toast('🎙 목소리를 넣었어요 · ▶ 위 화면에서 들어 보세요');
  }
  function syncNarrText() {
    const N = A.S.narr; if (!N) return;
    const texts = textsFor(N.segs.length); if (!texts) return;
    N.segs.forEach((g, k) => { g.t = texts[k]; }); renderNarrInfo(); A.scheduleRebuild(400);
  }
  let narrUrl = null;
  function renderNarrInfo() {
    const N = A.S.narr; if (!N) return;
    const bad = textsFor(N.segs.length) ? '' : ' · ⚠️ 대본 줄 수와 다름';
    $('tkNarrInfo').innerHTML = `✅ <b>${N.how}</b> · ${N.duration.toFixed(1)}초 · 문장 ${N.segs.length}개${bad}`;
    $('tkNarrSegs').innerHTML = N.segs.map(g => `<li><span class="tnum">${g.s.toFixed(1)}초</span> ${(g.t || '(자막 없음)').replace(/</g, '&lt;')}</li>`).join('');
  }
  function renderNarr() {
    const N = A.S.narr;
    $('tkNarr').hidden = !N;
    if (!N) return;
    $('tkNarrOn').checked = N.on;
    $('tkGain').value = N.gain || 1;
    if (narrUrl) URL.revokeObjectURL(narrUrl);
    narrUrl = URL.createObjectURL(toWav(N.buffer));
    $('tkAudio').src = narrUrl;
    renderNarrInfo();
  }
  $('tkNarrOn').addEventListener('change', () => { if (A.S.narr) { A.S.narr.on = $('tkNarrOn').checked; A.scheduleRebuild(0); } });
  $('tkGain').addEventListener('input', () => { if (A.S.narr) { A.S.narr.gain = parseFloat($('tkGain').value); A.scheduleRebuild(300); } });
  $('tkBgm').value = A.S.set.talkBgm; $('tkBgmOut').textContent = Math.round(A.S.set.talkBgm * 100) + '%';
  $('tkBgm').addEventListener('input', () => { const v = parseFloat($('tkBgm').value); $('tkBgmOut').textContent = Math.round(v * 100) + '%'; A.setVal('talkBgm', v); });
  $('tkNarrDel').addEventListener('click', () => { A.S.narr = null; renderNarr(); A.scheduleRebuild(0); toast('목소리를 뺐어요'); });

  // 목소리 방식 탭
  function renderVmode() {
    $('tkVmode').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.v === T.vmode)));
    ['pc', 'file', 'rec'].forEach(k => { $('tkV-' + k).hidden = k !== T.vmode; });
    if (T.vmode === 'rec') renderRec();
  }
  $('tkVmode').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; T.vmode = b.dataset.v; save(); renderVmode(); });

  // ── 💻 PC (BK보이스) ──
  const pcBase = () => { let u = $('tkPc').value.trim(); if (!u) return ''; if (!/^https?:\/\//i.test(u)) u = 'http://' + u; return u.replace(/\/+$/, ''); };
  $('tkPc').value = T.pc; $('tkPin').value = T.pin;
  $('tkPc').addEventListener('input', () => { T.pc = $('tkPc').value.trim(); save(); pcHint(); });
  $('tkPin').addEventListener('input', () => { T.pin = $('tkPin').value.trim(); save(); });
  function pcHint() {
    const u = pcBase();
    $('tkPcHint').innerHTML = !u ? 'PC의 BK보이스 검은 창에 나온 주소를 넣어 주세요. 예) <b>192.168.0.10:9870</b> (같은 와이파이) · <b>내PC이름.tail…ts.net</b> (외출 중)'
      : /^https:/i.test(u) ? '🔒 https 주소 → 버튼 한 번으로 목소리가 <b>바로 이 영상에 들어와요</b>.'
        : '🏠 http 주소 → 버튼을 누르면 <b>BK보이스 화면</b>이 열려요. 거기서 만들고 <b>💾 저장</b> → 돌아와서 <b>🎧 음성 파일</b>로 불러와요. (바로 들어오게 하려면 설명서의 ‘https 주소 만들기’)';
  }
  async function pcFetch(path, opt = {}) {
    const u = pcBase(); if (!u) throw new Error('PC 주소를 넣어 주세요');
    const r = await fetch(u + path, Object.assign({ mode: 'cors' }, opt, { headers: Object.assign({ 'X-BK-PIN': $('tkPin').value.trim() }, opt.headers || {}) }));
    if (!r.ok) { let m = '오류 ' + r.status; try { m = (await r.json()).error || m; } catch (e) { /* 무시 */ } throw new Error(m); }
    return r;
  }
  $('tkPcTest').addEventListener('click', async () => {
    const u = pcBase(); if (!u) { pcHint(); toast('PC 주소를 넣어 주세요'); return; }
    if (!/^https:/i.test(u)) { window.open(u + '/', '_blank', 'noopener'); return; }
    $('tkPcMsg').textContent = '연결 확인 중…';
    try { const d = await (await pcFetch('/api/status?pin=' + encodeURIComponent($('tkPin').value.trim()))).json();
      $('tkPcMsg').textContent = !d.pin_ok ? '🔐 PIN 번호가 맞지 않아요' : d.api !== 'ready' ? '⏳ ' + d.msg : d.ref_ok ? '✅ 연결됐어요 · 준비 완료' : '⚠️ 연결됐어요 · PC에 기준 음성이 없어요 (아래 🧬 등록)';
    } catch (e) { $('tkPcMsg').textContent = '❌ 연결 안 됨 · PC가 켜져 있는지, BK보이스 창이 열려 있는지 확인해 주세요 (' + e.message + ')'; }
  });
  $('tkPcGo').addEventListener('click', async () => {
    const text = readText(); if (!text) { toast('먼저 ③ 대본을 넣어 주세요'); return; }
    const u = pcBase(); if (!u) { pcHint(); toast('PC 주소를 넣어 주세요'); $('tkPc').focus(); return; }
    if (!/^https:/i.test(u)) { await copy(text); window.open(u + '/#t=' + encodeURIComponent(text), '_blank', 'noopener'); toast('BK보이스 화면을 열었어요 (대본도 복사해 뒀어요)', 4000); return; }
    const btn = $('tkPcGo'); btn.disabled = true; $('tkPcMsg').textContent = '⏳ PC에서 내 목소리를 만드는 중… (문장마다 1~3초)';
    try {
      const r = await pcFetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text, speed: $('tkSpeed').value }) });
      const blob = await r.blob();
      let segs = null; try { segs = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(r.headers.get('X-BK-Segs') || ''), c => c.charCodeAt(0)))); } catch (e) { segs = await readBkts(blob); }
      const buf = await decode(blob);
      setNarr(buf, (segs || splitBySilence(buf, lines(text).length)).map(g => ({ s: g.s, e: g.e, t: g.t })), 'BK보이스', '💻 내 PC 목소리');
      $('tkPcMsg').textContent = '✅ 완성! 위 화면 ▶로 들어 보세요';
    } catch (e) { $('tkPcMsg').textContent = '❌ ' + e.message; }
    finally { btn.disabled = false; }
  });

  // ── 🎧 음성 파일 ──
  $('tkFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    A.busy(true, '음성 파일 읽는 중…');
    try {
      const segs0 = await readBkts(f);
      const buf = await decode(f);
      const n = lines($('tkDisp').value).length || lines($('tkRead').value).length;
      const segs = segs0 ? segs0.map(g => ({ s: g.s, e: g.e, t: g.t })) : splitBySilence(buf, n || 1);
      setNarr(buf, segs, f.name, segs0 ? '🎧 BK보이스 파일 (문장 시간 포함)' : '🎧 음성 파일 (쉬는 곳으로 자동 나눔)');
    } catch (err) { toast(err.message, 4000); }
    finally { A.busy(false); }
  });

  // ── 🎤 문장별 직접 녹음 ──
  const R = { i: 0, takes: [], stream: null, rec: null, on: false };
  async function mic() {
    if (R.stream && R.stream.active) return R.stream;
    R.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    return R.stream;
  }
  function stopMic() { if (R.stream) { R.stream.getTracks().forEach(t => t.stop()); R.stream = null; } }
  function recLines() { return lines($('tkRead').value || $('tkDisp').value); }
  function renderRec() {
    const L = recLines();
    if (!L.length) { $('tkPrompt').innerHTML = '<p class="hint">먼저 ③ 대본을 넣어 주세요.</p>'; $('tkRecInfo').textContent = ''; return; }
    if (R.takes.length !== L.length) R.takes = L.map((_, k) => R.takes[k] || null);
    R.i = Math.min(R.i, L.length - 1);
    const d = lines($('tkDisp').value)[R.i];
    $('tkPrompt').innerHTML = `<div class="tk-pn">${R.i + 1} / ${L.length} ${R.takes[R.i] ? '· ✅ 녹음됨' : ''}</div><div class="tk-pt">${L[R.i].replace(/</g, '&lt;')}</div>${d && d !== L[R.i] ? `<div class="tk-pd">자막: ${d.replace(/</g, '&lt;')}</div>` : ''}`;
    const done = R.takes.filter(Boolean).length;
    $('tkRecInfo').textContent = `녹음 ${done} / ${L.length}문장`;
    $('tkRecJoin').disabled = done !== L.length;
    $('tkRecPlay').disabled = !R.takes[R.i];
    $('tkRecBtn').textContent = R.on ? '⏹ 멈춤' : (R.takes[R.i] ? '⏺ 다시 녹음' : '⏺ 녹음');
    $('tkRecBtn').classList.toggle('rec-on', R.on);
  }
  function trim(buf) {
    const d = buf.getChannelData(0), sr = buf.sampleRate; let pk = 0; for (let i = 0; i < d.length; i++) pk = Math.max(pk, Math.abs(d[i]));
    const th = Math.max(0.02, pk * 0.08), pad = Math.round(sr * 0.08);
    let a = 0, b = d.length - 1; while (a < b && Math.abs(d[a]) < th) a++; while (b > a && Math.abs(d[b]) < th) b--;
    a = Math.max(0, a - pad); b = Math.min(d.length, b + pad * 2);
    return slice(buf, a, b);
  }
  function slice(buf, a, b) {
    const out = new AudioBuffer({ length: Math.max(1, b - a), numberOfChannels: 1, sampleRate: buf.sampleRate });
    out.copyToChannel(buf.getChannelData(0).slice(a, b), 0); return out;
  }
  async function recordTake() {
    if (R.on) { R.rec.stop(); return; }
    let st; try { st = await mic(); } catch (e) { toast('마이크를 쓸 수 없어요 · 크롬 주소창 🔒 → 권한 → 마이크 허용', 5000); return; }
    const chunks = [];
    R.rec = new MediaRecorder(st);
    R.rec.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    R.rec.onstop = async () => {
      R.on = false; renderRec();
      try { const b = await decode(new Blob(chunks, { type: R.rec.mimeType })); R.takes[R.i] = trim(b); if (R.i < recLines().length - 1) R.i++; }
      catch (e) { toast('녹음을 읽지 못했어요 · 다시 해 주세요'); }
      renderRec();
    };
    R.rec.start(); R.on = true; renderRec();
  }
  $('tkRecBtn').addEventListener('click', recordTake);
  $('tkRecPrev').addEventListener('click', () => { if (R.on) return; R.i = Math.max(0, R.i - 1); renderRec(); });
  $('tkRecNext').addEventListener('click', () => { if (R.on) return; R.i = Math.min(recLines().length - 1, R.i + 1); renderRec(); });
  let pctx = null;
  function playBuf(buf) { if (!pctx) pctx = new AC(); const s = pctx.createBufferSource(); s.buffer = buf; s.connect(pctx.destination); s.start(); }
  $('tkRecPlay').addEventListener('click', () => { if (R.takes[R.i]) playBuf(R.takes[R.i]); });
  $('tkRecJoin').addEventListener('click', () => {
    const takes = R.takes.filter(Boolean); if (!takes.length) return;
    const sr = takes[0].sampleRate, gap = Math.round(sr * 0.3);
    const len = takes.reduce((a, b) => a + b.length, 0) + gap * (takes.length - 1);
    const out = new AudioBuffer({ length: len, numberOfChannels: 1, sampleRate: sr }), d = out.getChannelData(0);
    const segs = []; let p = 0;
    takes.forEach((b, k) => { d.set(b.getChannelData(0), p); segs.push({ s: p / sr, e: (p + b.length) / sr }); p += b.length + (k < takes.length - 1 ? gap : 0); });
    stopMic();
    setNarr(out, segs, '내 녹음', '🎤 직접 녹음');
  });

  // ═════════ WAV 만들기 (16bit · 모노) ═════════
  function toWav(buf, extra) {
    const d = buf.getChannelData(0), sr = buf.sampleRate, n = d.length;
    let ex = null; if (extra) { ex = new TextEncoder().encode(JSON.stringify(extra)); if (ex.length % 2) ex = new Uint8Array([...ex, 32]); }
    const size = 44 + n * 2 + (ex ? 8 + ex.length : 0), ab = new ArrayBuffer(size), v = new DataView(ab);
    const w = (o, s) => { for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, size - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
    for (let i = 0; i < n; i++) { const s = Math.max(-1, Math.min(1, d[i])); v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true); }
    if (ex) { const o = 44 + n * 2; w(o, 'bkts'); v.setUint32(o + 4, ex.length, true); new Uint8Array(ab, o + 8).set(ex); }
    return new Blob([ab], { type: 'audio/wav' });
  }
  function dl(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 8000); }
  const stamp = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`; };
  $('tkNarrSave').addEventListener('click', () => { const N = A.S.narr; if (N) dl(toWav(N.buffer, { v: 1, segs: N.segs }), `BK쇼츠_목소리_${stamp()}.wav`); });

  // ═════════ ⑤ 화면 ═════════
  $('tkBg').addEventListener('click', async () => {
    const t = TOPICS[T.topic], files = [];
    A.busy(true, '배경 만드는 중…');
    try {
      for (let k = 0; k < 3; k++) {
        const c = document.createElement('canvas'); c.width = 1080; c.height = 1920; const x = c.getContext('2d');
        const g = x.createLinearGradient(0, 0, 1080 * (k % 2 ? -0.2 : 1.2), 1920);
        g.addColorStop(0, t.bg[0]); g.addColorStop(0.62, t.bg[1]); g.addColorStop(1, t.bg[2]);
        x.fillStyle = g; x.fillRect(0, 0, 1080, 1920);
        x.globalAlpha = 0.07; x.fillStyle = '#fff';
        for (let i = 0; i < 26; i++) { const r = 40 + ((i * 97 + k * 31) % 160); x.beginPath(); x.arc((i * 211 + k * 140) % 1080, (i * 337 + k * 90) % 1920, r, 0, 7); x.fill(); }
        x.globalAlpha = 0.16; x.font = '520px "Noto Color Emoji","Apple Color Emoji","Segoe UI Emoji",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(t.e, 540 + (k - 1) * 120, 860 + k * 60); x.globalAlpha = 1;
        const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        files.push(new File([b], `배경_${k + 1}.jpg`, { type: 'image/jpeg' }));
      }
    } finally { A.busy(false); }
    await A.addPhotos(files);
    toast('🖼 배경 3장을 넣었어요 · 사진 탭에서 캡처 · 사진도 더 넣을 수 있어요');
  });
  $('tkStyle').addEventListener('click', () => {
    const p = P(), set = { yPos: 74, box: true, boxColor: '#000000', boxOp: 0.55, size: 70, strokeW: 4, color: '#ffffff', anim: 'none', lineSp: 1.35, align: 'center',
      topText: p.ch ? `● ${p.ch}` : '', topSize: 64, topY: 9, topColor: '#ffffff', bottomText: p.src ? `자료출처=${p.src}` : '', botSize: 34, botY: 96, botColor: '#e5e7eb',
      particles: [] };
    Object.entries(set).forEach(([k, v]) => { A.S.set[k] = v; });
    try { localStorage.setItem('gamseong-shorts.v1', JSON.stringify(A.S.set)); } catch (e) { /* 무시 */ }
    A.syncControls(); A.scheduleRebuild(0);
    toast('📺 자막은 아래쪽 반투명 상자로, 위엔 채널 이름 · 아래엔 출처를 넣고 반짝이 효과는 껐어요 (꾸미기 탭에서 바꿀 수 있어요)', 5000);
  });
  $('tkGoPhoto').addEventListener('click', () => A.showTab('photo'));
  $('tkGoMake').addEventListener('click', () => {
    if (!A.S.narr) { toast('먼저 ④ 목소리를 넣어 주세요'); return; }
    if (!A.S.photos.length) { toast('사진(캡처)을 넣거나 🖼 배경 자동 만들기를 눌러 주세요'); return; }
    A.showTab('export');
  });

  // ═════════ 🧬 내 목소리 등록 (PC 학습용 녹음) ═════════
  const REF_TEXT = '안녕하세요, 오늘도 쉽고 정확한 소식을 전해 드리겠습니다.';
  const TRAIN = [
    '안녕하세요, 오늘도 쉽고 정확한 소식을 전해 드리겠습니다.',
    '이번 주 날씨는 맑다가 주말부터 기온이 크게 떨어집니다.',
    '신청 기간은 다음 달 말일까지이니 꼭 확인해 보세요.',
    '여러분, 이런 경험 한 번쯤 있으시죠?',
    '정말요? 저도 처음 듣고 깜짝 놀랐어요!',
    '오늘 알려 드릴 내용은 딱 세 가지입니다.',
    '첫째, 대상이 넓어졌습니다. 둘째, 금액이 늘었습니다.',
    '마지막으로 꼭 기억하실 점이 하나 있어요.',
    '주민센터나 누리집에서 간단하게 신청할 수 있습니다.',
    '우리 집 강아지는 산책 가자는 말만 들으면 꼬리를 흔들어요.',
    '할머니는 늘 따뜻한 밥 한 그릇을 먼저 챙겨 주셨습니다.',
    '물가가 오르면서 장바구니 부담도 함께 커지고 있습니다.',
    '보험은 가입보다 내 보장을 제대로 아는 것이 더 중요합니다.',
    '이 방법, 생각보다 훨씬 쉽습니다. 한번 따라 해 보세요.',
    '와, 이건 진짜 대박이네요! 저만 몰랐던 건가요?',
    '천천히, 그리고 또박또박 말씀드리겠습니다.',
    '궁금한 점은 댓글로 남겨 주시면 다음 영상에서 알려 드릴게요.',
    '오늘 영상이 도움이 되셨다면 좋아요와 구독 부탁드려요.',
    '바쁜 하루 속에서도 잠깐 쉬어 가는 시간이 되셨으면 좋겠습니다.',
    '그럼 다음 시간에 더 알찬 소식으로 찾아뵙겠습니다. 감사합니다.',
  ];
  $('tkRefText').textContent = REF_TEXT;
  $('tkTrainList').innerHTML = TRAIN.map(s => `<li>${s}</li>`).join('');
  const G = { kind: null, rec: null, chunks: [], t0: 0, timer: 0 };
  async function startLong(kind) {
    if (G.rec) { G.rec.stop(); return; }
    let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }); }
    catch (e) { toast('마이크를 쓸 수 없어요 · 크롬 주소창 🔒 → 권한 → 마이크 허용', 5000); return; }
    G.kind = kind; G.chunks = []; G.rec = new MediaRecorder(st); G.t0 = Date.now();
    const btn = $(kind === 'ref' ? 'tkRefRec' : 'tkTrainRec'), msg = $(kind === 'ref' ? 'tkRefMsg' : 'tkTrainMsg');
    G.rec.ondataavailable = e => { if (e.data.size) G.chunks.push(e.data); };
    G.rec.onstop = async () => {
      clearInterval(G.timer); st.getTracks().forEach(t => t.stop());
      btn.textContent = kind === 'ref' ? '⏺ 기준 음성 녹음' : '⏺ 학습용 녹음 시작'; btn.classList.remove('rec-on');
      const rec = G.rec; G.rec = null;
      try {
        let b = await decode(new Blob(G.chunks, { type: rec.mimeType }));
        b = kind === 'ref' ? trim(b) : b;
        const sec = b.duration;
        if (kind === 'ref' && (sec < 3 || sec > 10)) { msg.textContent = `⚠️ ${sec.toFixed(1)}초예요 · 기준 음성은 3~10초여야 해요. 다시 녹음해 주세요.`; return; }
        if (kind === 'train' && sec < 50) msg.textContent = `⚠️ ${Math.round(sec)}초 · 1분 이상이면 더 좋아요. 그래도 저장했어요.`;
        else msg.textContent = `✅ ${sec.toFixed(1)}초 녹음 · 휴대폰 ‘다운로드’에 저장했어요`;
        const name = kind === 'ref' ? 'BK보이스_기준음성.wav' : `BK보이스_학습용_${stamp()}.wav`;
        const blob = toWav(b); dl(blob, name);
        G.last = G.last || {}; G.last[kind] = { blob, name };
        $(kind === 'ref' ? 'tkRefSend' : 'tkTrainSend').hidden = !/^https:/i.test(pcBase());
      } catch (e) { msg.textContent = '❌ 녹음을 읽지 못했어요 · 다시 해 주세요'; }
    };
    G.rec.start(); btn.textContent = '⏹ 녹음 끝내기'; btn.classList.add('rec-on');
    G.timer = setInterval(() => { msg.textContent = `🔴 녹음 중… ${Math.floor((Date.now() - G.t0) / 1000)}초`; }, 500);
  }
  $('tkRefRec').addEventListener('click', () => startLong('ref'));
  $('tkTrainRec').addEventListener('click', () => startLong('train'));
  async function sendPc(kind) {
    const L = G.last && G.last[kind]; if (!L) return;
    const msg = $(kind === 'ref' ? 'tkRefMsg' : 'tkTrainMsg');
    try {
      const d = await (await pcFetch(`/api/upload?kind=${kind}&name=${encodeURIComponent(L.name)}`, { method: 'POST', body: L.blob })).json();
      if (kind === 'ref') await pcFetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ref_audio: d.path, prompt_text: REF_TEXT }) });
      msg.textContent = kind === 'ref' ? '✅ PC로 보내고 기준 음성으로 정했어요' : '✅ PC의 bkvoice_data\\train 폴더로 보냈어요';
    } catch (e) { msg.textContent = '❌ PC로 못 보냈어요: ' + e.message; }
  }
  $('tkRefSend').addEventListener('click', () => sendPc('ref'));
  $('tkTrainSend').addEventListener('click', () => sendPc('train'));
  $('tkRefCopy').addEventListener('click', async e => flash(e.target, await copy(REF_TEXT)));

  // ═════════ 시작 ═════════
  renderTopics(); fillScript(); renderVmode(); pcHint(); renderNarr();
  document.querySelector('.tabbar button[data-tab="talk"]').addEventListener('click', () => { renderChecks(); if (T.vmode === 'rec') renderRec(); });
  window.__talk = { T, parseAns, splitBySilence, readBkts, toWav, setNarr, decode, buildReq }; // 테스트용
})();

/*! terms.js — BK스토리 이용약관 · 동의 받기 · 동의 확인 코드
 * 동의 기록은 ① 이 휴대폰(localStorage 'bkStoryConsent') ② 사용자가 관리자에게 보내는 「동의 확인 글」(카톡)
 * ③ 관리자가 BK라이선스 장부에 붙여 넣어 보관 — 이렇게 세 곳에 남아요. 서버로는 아무것도 보내지 않아요.
 * 확인 코드 = SHA-256("BKSTORY|기기코드|약관버전|동의시각|이름") 앞 5바이트 → 8글자 (BK라이선스에서 같은 방법으로 맞는지 확인)
 */
(function (g) {
'use strict';
const TERMS_VER = '1', TERMS_DATE = '2026.11.06', KEY = 'bkStoryConsent';
const B32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const TERMS = [
  ['제1조 (목적)', '이 약관은 BK Agent(비케이)가 제공하는 「BK스토리」(이하 「앱」)를 쓰는 분(이하 「이용자」)과 운영자 사이의 이용 조건을 정해요.'],
  ['제2조 (작업물의 보관)', '편집 중인 프로젝트와 사진 · 영상 · 음악 파일은 서버로 보내지 않고 이용자의 휴대폰 브라우저 안에만 저장돼요. 브라우저 데이터 삭제, 휴대폰 변경 · 고장, 저장 공간 부족 등으로 작업물이 사라질 수 있으니, 중요한 작업은 「백업 파일 저장」과 「영상 만들기(MP4)」로 직접 보관해 주세요.'],
  ['제3조 (콘텐츠에 대한 책임)', '이용자가 불러오고 편집 · 게시하는 영상 · 음악 · 사진 · 글꼴 등의 저작권 · 초상권 등 권리 확인과 그 이용에 대한 책임은 이용자에게 있어요. 보험 · 금융 상품 등 광고에 쓰는 영상은 소속 회사와 관련 법령의 광고 심의 기준을 이용자가 직접 확인해야 해요.'],
  ['제4조 (책임의 한계)', '앱은 제공 시점의 상태 그대로 제공돼요. 휴대폰 · 브라우저 환경, 프로그램 오류 등으로 결과가 기대와 다르거나 작업물이 손실될 수 있으며, 운영자는 고의 또는 중대한 과실이 없는 한 이로 인한 손해에 대해 책임을 지지 않아요. 결과물은 이용자가 확인한 뒤 사용해 주세요.'],
  ['제5조 (라이선스)', '앱은 운영자가 발급한 라이선스가 있는 휴대폰 1대에서만 쓸 수 있어요. 라이선스는 다른 사람에게 넘기거나 빌려줄 수 없고, 약관을 어기면 운영자가 라이선스를 해지할 수 있어요.'],
  ['제6조 (약관의 변경)', '약관은 필요에 따라 바뀔 수 있어요. 바뀌면 앱 화면으로 알리고, 바뀐 약관에 다시 동의를 받아요.'],
];
const PRIV = [
  ['수집하지 않는 것', '편집 중인 영상 · 사진 · 음악 파일, 프로젝트 내용, 입력한 글자는 서버로 보내거나 모으지 않아요.'],
  ['동의 기록으로 보관하는 것', '이름, 기기 코드, 동의한 약관 버전과 시각, 확인 코드. 이용자가 「동의 확인 글 보내기」로 관리자에게 직접 보낼 때만 전달돼요.'],
  ['보관 목적', '약관 동의 확인과 라이선스 관리 (누가 언제 어떤 약관에 동의했는지 확인)'],
  ['보관 기간', '라이선스를 쓰는 동안, 그리고 끝난 뒤 1년까지 관리자 장부에 보관한 다음 지워요.'],
  ['동의 거부', '동의하지 않을 수 있지만, 앱을 쓰려면 꼭 필요한 동의라 이 경우 앱을 쓸 수 없어요. 기록 삭제는 관리자에게 요청해 주세요.'],
];

function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { return null; } }
function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function stamp(d) { const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
async function code(dev, ver, at, name) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`BKSTORY|${dev}|${ver}|${at}|${name}`)));
  let bits = 0, val = 0, out = '';
  for (let i = 0; i < 5; i++) { val = (val << 8) | h[i]; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } }
  return out.slice(0, 4) + '-' + out.slice(4, 8);
}
function devCode() { try { return g.BKLIC ? g.BKLIC.fmtDev(g.BKLIC.deviceCode()) : ''; } catch (e) { return ''; } }
function saved() { try { const c = JSON.parse(ls(KEY) || 'null'); return c && c.ver === TERMS_VER ? c : null; } catch (e) { return null; } }
function message(c) {
  return `[BK스토리 약관 동의]\n이름: ${c.name || '(안 씀)'}\n기기 코드: ${c.dev || '(알 수 없음)'}\n약관: v${c.ver} (${TERMS_DATE})\n동의: ${c.at}\n확인: ${c.code}\n✅ [필수] 이용약관 · [필수] 동의 기록 보관에 동의했어요.`;
}
function termsHtml() {
  return `<div class="tdoc"><h4>BK스토리 이용약관 <small>v${TERMS_VER} · ${TERMS_DATE}</small></h4>${TERMS.map(t => `<p><b>${esc(t[0])}</b><br>${esc(t[1])}</p>`).join('')}</div>`;
}
function privHtml() {
  return `<div class="tdoc"><h4>동의 기록 보관 안내</h4>${PRIV.map(t => `<p><b>${esc(t[0])}</b><br>${esc(t[1])}</p>`).join('')}</div>`;
}

/** 동의 화면 — 동의하면 resolve(동의 기록) */
function ask(box) {
  return new Promise(resolve => {
    box.innerHTML = `<div class="consent">
      <h2>📜 시작하기 전에</h2>
      <p class="muted">BK스토리를 쓰려면 아래 약관에 동의해 주세요. 영상 · 사진은 서버로 올라가지 않아요.</p>
      <label class="ck all"><input type="checkbox" id="cAll"> <b>모두 동의합니다</b></label>
      <div class="ckrow"><label class="ck"><input type="checkbox" class="cOne" data-k="t"> <span class="req">[필수]</span> 이용약관 동의</label><button type="button" class="link" data-show="t">보기</button></div>
      <div class="tbox" id="tb_t" hidden>${termsHtml()}</div>
      <div class="ckrow"><label class="ck"><input type="checkbox" class="cOne" data-k="p"> <span class="req">[필수]</span> 동의 기록 보관 동의</label><button type="button" class="link" data-show="p">보기</button></div>
      <div class="tbox" id="tb_p" hidden>${privHtml()}</div>
      <label class="field" for="cName">이름 <small>(관리자가 누구인지 알아보기 쉽게)</small></label>
      <input id="cName" type="text" placeholder="예: 홍길동" autocomplete="off">
      <button type="button" class="big pri" id="cGo" disabled>✅ 동의하고 시작하기</button>
      <p class="muted small">동의한 날짜 · 시각과 확인 코드가 이 휴대폰에 저장돼요. 다음 화면에서 「동의 확인 글」을 관리자에게 보내 주세요.</p>
    </div>`;
    const all = box.querySelector('#cAll'), ones = [...box.querySelectorAll('.cOne')], go = box.querySelector('#cGo');
    const sync = () => { const okAll = ones.every(c => c.checked); all.checked = okAll; go.disabled = !okAll; };
    all.addEventListener('change', () => { ones.forEach(c => { c.checked = all.checked; }); sync(); });
    ones.forEach(c => c.addEventListener('change', sync));
    box.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => { const t = box.querySelector('#tb_' + b.dataset.show); t.hidden = !t.hidden; b.textContent = t.hidden ? '보기' : '접기'; }));
    go.addEventListener('click', async () => {
      const name = box.querySelector('#cName').value.trim().slice(0, 30), dev = devCode(), at = stamp(new Date());
      const c = { ver: TERMS_VER, date: TERMS_DATE, at, name, dev, items: ['terms', 'record'], ts: Date.now() };
      c.code = await code(dev, c.ver, at, name);
      ls(KEY, JSON.stringify(c));
      done(box, c, resolve);
    });
  });
}
function done(box, c, resolve) {
  box.innerHTML = `<div class="consent">
    <h2>✅ 동의했어요</h2>
    <div class="cbox"><div>📅 ${esc(c.at)}</div><div>📜 약관 v${esc(c.ver)} (${TERMS_DATE})</div><div>🔐 확인 코드 <b class="mono">${esc(c.code)}</b></div></div>
    <p>아래 버튼으로 <b>동의 확인 글</b>을 관리자(라이선스를 주는 분)에게 카톡으로 보내 주세요. 관리자 장부에 보관돼요.</p>
    <button type="button" class="big kk" id="cSend">💬 동의 확인 글 보내기</button>
    <button type="button" class="big sec" id="cNext">다음 ▶</button>
    <p class="ok" id="cMsg"></p>
  </div>`;
  box.querySelector('#cSend').addEventListener('click', () => send(c, box.querySelector('#cMsg')));
  box.querySelector('#cNext').addEventListener('click', () => resolve(c));
}
async function send(c, msgEl) {
  const t = message(c);
  try { if (navigator.share) { await navigator.share({ text: t }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
  try { await navigator.clipboard.writeText(t); if (msgEl) msgEl.textContent = '📋 글을 복사했어요 · 카톡에 붙여넣어 보내 주세요'; } catch (e) { prompt('아래 글을 길게 눌러 복사해 주세요', t); }
}

g.BKTERMS = { TERMS_VER, TERMS_DATE, saved, ask, send, message, code, termsHtml, privHtml };
})(window);

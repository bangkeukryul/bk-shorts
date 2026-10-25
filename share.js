/*!
 * share.js — BK쇼츠 주소 · QR코드 보내기 (BK톡톡과 같은 방식)
 */
(function () {
  'use strict';
  const URL_ = 'https://bangkeukryul.github.io/bk-shorts/';
  const ROWS = ["11111110010001001111101111111", "10000010000001110010101000001", "10111010100100110001101011101", "10111010100101100100001011101", "10111010111110101001101011101", "10000010101101011000001000001", "11111110101010101010101111111", "00000000100010000011100000000", "10111110001111111101001111100", "00101001011100101111011110001", "11010011010000111010011100000", "10011100110100011010101111010", "01011110110001100101000001100", "11010001010100100001111110001", "00101010111111011000100001100", "11000000101100100000100100010", "11011111110101000100100001100", "10101000000011001011101110101", "10010111111111110110100110100", "10100100010010100010000010010", "10101010000110010111111110111", "00000000101001001111100011111", "11111110000101111101101011100", "10000010101001001011100010000", "10111010110100100100111110111", "10111010101011000110100001111", "10111010100110111010011111110", "10000010010000001001111001010", "11111110110100100101001010100"];   // QR 무늬 (주소를 바꾸면 다시 만들어야 함)
  const MSG = '📲 BK쇼츠 (무료)\n사진 · 동영상 · 글귀 · 음악으로 유튜브 쇼츠 · 틱톡 · 릴스 영상을 휴대폰에서 바로 만들어요.\n\n👉 ' + URL_
    + '\n\n※ 카톡에서 열리면 오른쪽 ⋮ → ‘다른 브라우저로 열기’ → 크롬으로 열고, ⋮ → ‘홈 화면에 추가’ 하세요.';
  const F = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  const $ = id => document.getElementById(id);
  const inApp = /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(navigator.userAgent || '');
  const msg = (t, c) => { const m = $('qrMsg'); m.textContent = t; m.style.color = c || '#16a34a'; };
  function draw() {
    const n = ROWS.length, W = 1200, cell = Math.floor((W - 200) / (n + 8)), qs = cell * (n + 8), H = qs + 560;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
    const g = x.createLinearGradient(0, 0, W, 190); g.addColorStop(0, '#6d3fd6'); g.addColorStop(1, '#a77bf3');
    x.fillStyle = g; x.fillRect(0, 0, W, 190);
    x.textAlign = 'center'; x.textBaseline = 'top'; x.fillStyle = '#fff'; x.font = '800 84px ' + F; x.fillText('BK쇼츠', W / 2, 45);
    const qx = Math.floor((W - qs) / 2), qy = 230;
    x.fillStyle = '#000';
    ROWS.forEach((r, yy) => { for (let xx = 0; xx < n; xx++) if (r[xx] === '1') x.fillRect(qx + (xx + 4) * cell, qy + (yy + 4) * cell, cell, cell); });
    let y = qy + qs + 20;
    [['휴대폰 카메라로 찍으면 바로 열려요', '800 44px ', '#4c2a9e'], ['bangkeukryul.github.io/bk-shorts', '700 40px ', '#334155'],
      ['크롬으로 열고 ‘홈 화면에 추가’ 하세요 · 무료', '700 40px ', '#64748b']].forEach(([t, f, col]) => { x.font = f + F; x.fillStyle = col; x.fillText(t, W / 2, y); y += 78; });
    return c;
  }
  let cv = null;
  const make = () => { cv = draw(); $('qrImg').src = cv.toDataURL('image/png'); };
  let made = false;
  $('shareBox').addEventListener('toggle', () => {
    if (!$('shareBox').open || made) return;
    made = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(make); else make();
  });
  async function copy(t, ok) {
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(t); msg(ok); return; } } catch (e) { /* 아래 방법 */ }
    const a = document.createElement('textarea'); a.value = t; a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select();
    try { document.execCommand('copy'); msg(ok); } catch (e) { msg('주소를 길게 눌러 복사해 주세요.', '#b45309'); }
    a.remove();
  }
  $('copyUrlBtn').addEventListener('click', () => copy(URL_, '✅ 주소를 복사했어요. 카톡 대화창에 길게 눌러 붙여넣으세요.'));
  $('copyMsgBtn').addEventListener('click', () => copy(MSG, '✅ 안내 문구를 복사했어요. 카톡 대화창에 붙여넣으세요.'));
  const blob = () => new Promise(r => { if (!cv) make(); cv.toBlob(r, 'image/png'); });
  $('qrSave').addEventListener('click', async () => {
    const b = await blob(), u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = 'BK쇼츠_QR코드.png'; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 3000);
    if (inApp) msg('⚠️ 카톡 안 브라우저에서는 저장이 안 될 수 있어요. ⋮ → ‘다른 브라우저로 열기’로 크롬에서 연 뒤 다시 저장하세요.', '#b45309');
    else msg('✅ QR코드를 저장했어요. 내 파일 → 다운로드 폴더(갤러리의 ‘Download’ 앨범)에 BK쇼츠_QR코드.png 로 있어요.');
  });
  $('qrShareBtn').addEventListener('click', async () => {
    const f = new File([await blob()], 'BK쇼츠_QR코드.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f] }); } catch (e) { /* 취소 */ } }
    else msg('이 휴대폰은 바로 보내기를 지원하지 않아요. 저장한 뒤 카톡에서 사진으로 보내세요.', '#b45309');
  });
})();

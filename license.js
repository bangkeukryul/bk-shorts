/*! BK 라이선스 (BK톡톡 · BK쇼츠 공용) — 전자 서명(ECDSA P-256) 확인 · 기기 1대 잠금 · 기간 · 해지 목록
 * 비밀 도장(개인 키)은 관리자 휴대폰에만 있고, 여기에는 확인용 공개 키만 들어 있어요. (공개 키로는 라이선스를 만들 수 없어요)
 */
(function(){
'use strict';
if(window.BKLIC)return;
var PUB='BB_6icy4bOLsFVvaagojoVa4TBbDQG9xCxyQF944iKgGQkv5hFFf0Sbq5Zan11P1A0-p_75WDsGb3lyzFwBUX5U';                       /* 확인용 공개 키 (비어 있으면 라이선스 기능 꺼짐) */
var ON=PUB.length>40;
var PROGS=[['card','감성 인사 카드'],['event','이벤트 카드'],['profile','가게·개인 홍보'],['faith','말씀·법문 카드'],['emoji','나만의 이모티콘'],['motion','움직이는 카드'],['moim','모임공지 카드'],['music','BK뮤직'],['analysis','보장분석 도우미'],['shorts','BK쇼츠'],['fc','보험설계사 프로필'],['studio','BK영상']];
var DEFAULT_LOCK=['music','shorts','fc','studio'];
/* 설정 파일을 만들 때 있던 프로그램 목록(progs)에 없는 새 프로그램은 기본 잠금(DEFAULT_LOCK)을 따름 */
var OLD_PROGS=['card','event','profile','faith','emoji','motion','moim','music','analysis','shorts','fc'];
var CFG_URL='/bk-card/license-config.json',ACT_URL='https://bangkeukryul.github.io/bk-card/activate.html';
var DAY=864e5,EPOCH=Date.UTC(2024,0,1);
var B32='0123456789ABCDEFGHJKMNPQRSTVWXYZ';
function ls(k,v){try{if(v===undefined)return localStorage.getItem(k);if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v)}catch(e){return null}}
function b64u(u8){var s='';for(var i=0;i<u8.length;i++)s+=String.fromCharCode(u8[i]);return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
function unb64u(t){t=String(t).replace(/-/g,'+').replace(/_/g,'/');while(t.length%4)t+='=';var s=atob(t),u=new Uint8Array(s.length);for(var i=0;i<s.length;i++)u[i]=s.charCodeAt(i);return u}
/* 기기 코드: 처음 열 때 만든 고유 번호 12글자 (60비트) */
function devBytes(code){var c=String(code).toUpperCase().replace(/[^0-9A-Z]/g,'').replace(/[IL]/g,'1').replace(/O/g,'0');if(c.length!==12)return null;
 var bits=0,val=0,out=[];for(var i=0;i<12;i++){var d=B32.indexOf(c[i]);if(d<0)return null;val=(val<<5)|d;bits+=5;while(bits>=8){bits-=8;out.push((val>>bits)&255)}val&=(1<<bits)-1}
 out.push((val<<(8-bits))&255);return new Uint8Array(out.slice(0,8))}
function newDevice(){var r=new Uint8Array(8);crypto.getRandomValues(r);var bits=0,val=0,s='';for(var i=0;i<8&&s.length<12;i++){val=(val<<8)|r[i];bits+=8;while(bits>=5&&s.length<12){bits-=5;s+=B32[(val>>bits)&31]}val&=(1<<bits)-1}return s}
function deviceCode(){var c=ls('bkDev');if(!c||!devBytes(c)){c=newDevice();ls('bkDev',c)}return c}
function fmtDev(c){c=String(c||'').toUpperCase().replace(/[^0-9A-Z]/g,'');return c.length===12?c.slice(0,4)+'-'+c.slice(4,8)+'-'+c.slice(8):c}
function eq(a,b){if(!a||!b||a.length!==b.length)return false;for(var i=0;i<a.length;i++)if(a[i]!==b[i])return false;return true}
var keyP=null;function pubKey(){if(!keyP)keyP=crypto.subtle.importKey('raw',unb64u(PUB),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);return keyP}
function vfy(sig,data){return pubKey().then(function(k){return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},k,sig,data)}).catch(function(){return false})}
/* 라이선스 글: BKL1.<payload 19바이트 + 서명 64바이트> */
function pickKey(t){var m=String(t||'').match(/BKL1\.([A-Za-z0-9_-]{100,})/);return m?'BKL1.'+m[1]:null}
function parse(key){try{var u=unb64u(key.slice(5));if(u.length!==83||u[0]!==1)return null;var p=u.slice(0,19);
 return {key:key,payload:p,sig:u.slice(19),id:Array.prototype.map.call(p.slice(1,5),function(x){return('0'+x.toString(16)).slice(-2)}).join(''),dev:p.slice(5,13),mask:(p[13]<<8)|p[14],issued:(p[15]<<8)|p[16],exp:(p[17]<<8)|p[18]}}catch(e){return null}}
function dayNow(){var d=new Date();return Math.floor((Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())-EPOCH)/DAY)}  /* 휴대폰 날짜 기준 */
function dayStr(d){if(d===65535)return '영구';var t=new Date(EPOCH+d*DAY);return t.getUTCFullYear()+'. '+(t.getUTCMonth()+1)+'. '+t.getUTCDate()+'.'}
function progBit(p){for(var i=0;i<PROGS.length;i++)if(PROGS[i][0]===p)return 1<<i;return 0}
function maskNames(m){if((m&0xFFFF)===0xFFFF)return '전체 프로그램';return PROGS.filter(function(p,i){return m&(1<<i)}).map(function(p){return p[1]}).join(' · ')}
/* 날짜 되돌리기 방지: 마지막으로 본 시각보다 이틀 넘게 과거면 의심 */
function clockOk(){var seen=+ls('bkLicSeen')||0,now=Date.now();if(now>seen)ls('bkLicSeen',String(now));return now>seen-2*DAY}
/* 잠금 설정 (관리자가 서명한 파일) */
var cfgP=null;
function loadCfg(){if(cfgP)return cfgP;cfgP=new Promise(function(res){
 var cached=null;try{cached=JSON.parse(ls('bkLicCfg')||'null')}catch(e){}
 function check(c){if(!c||!c.p||!c.s)return Promise.resolve(null);var data=unb64u(c.p);return vfy(unb64u(c.s),data).then(function(ok){if(!ok)return null;try{return JSON.parse(new TextDecoder().decode(data))}catch(e){return null}})}
 var done=false;function fin(v){if(!done){done=true;res(v)}}
 check(cached).then(function(cc){
  var t=setTimeout(function(){fin(cc)},2500);
  fetch(CFG_URL+'?t='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null}).then(function(c){return check(c).then(function(nc){
   if(nc&&(!cc||nc.t>=cc.t)){ls('bkLicCfg',JSON.stringify(c));clearTimeout(t);fin(nc)}else{clearTimeout(t);fin(cc)}})}).catch(function(){clearTimeout(t);fin(cc)})})});
 return cfgP}
function isLocked(prog,cfg){if(!(cfg&&Array.isArray(cfg.locked)))return DEFAULT_LOCK.indexOf(prog)>=0;var known=Array.isArray(cfg.progs)?cfg.progs:OLD_PROGS;if(known.indexOf(prog)<0)return DEFAULT_LOCK.indexOf(prog)>=0;return cfg.locked.indexOf(prog)>=0}
function keys(){try{return JSON.parse(ls('bkLic')||'[]')}catch(e){return []}}
function saveKeys(a){ls('bkLic',JSON.stringify(a))}
/* 한 라이선스 확인 → {ok, reason, lic} */
function checkKey(key,prog,cfg){var L=parse(key);if(!L)return Promise.resolve({ok:false,reason:'bad'});
 return vfy(L.sig,L.payload).then(function(good){
  if(!good)return {ok:false,reason:'bad',lic:L};
  if(!eq(L.dev,devBytes(deviceCode())))return {ok:false,reason:'device',lic:L};
  if(cfg&&Array.isArray(cfg.revoked)&&cfg.revoked.indexOf(L.id)>=0)return {ok:false,reason:'revoked',lic:L};
  if(prog&&!(L.mask&progBit(prog)))return {ok:false,reason:'prog',lic:L};
  if(L.exp!==65535){if(!clockOk())return {ok:false,reason:'clock',lic:L};if(dayNow()>L.exp)return {ok:false,reason:'expired',lic:L}}
  return {ok:true,lic:L,daysLeft:L.exp===65535?Infinity:L.exp-dayNow()}})}
/* 이 프로그램을 써도 되나? */
function check(prog){
 if(!ON)return Promise.resolve({ok:true,off:true});
 return loadCfg().then(function(cfg){
  if(!isLocked(prog,cfg))return {ok:true,open:true};
  var ks=keys();if(!ks.length)return {ok:false,reason:'none'};
  return Promise.all(ks.map(function(k){return checkKey(k,prog,cfg)})).then(function(rs){
   var best=null;rs.forEach(function(r){if(r.ok&&(!best||r.daysLeft>best.daysLeft))best=r});
   if(best)return best;var pr=['clock','expired','revoked','device','prog','bad'];
   for(var i=0;i<pr.length;i++)for(var j=0;j<rs.length;j++)if(rs[j].reason===pr[i])return rs[j];return {ok:false,reason:'none'}})})}
/* 받은 라이선스 넣기 */
function addKey(text){var key=pickKey(text);if(!key)return Promise.resolve({ok:false,reason:'format'});
 return loadCfg().then(function(cfg){return checkKey(key,null,cfg).then(function(r){
  if(r.ok||r.reason==='expired'){var a=keys().filter(function(k){return k!==key});a.unshift(key);saveKeys(a.slice(0,20))}
  return r})})}
var REASON={none:'아직 라이선스가 없어요.',bad:'라이선스 글자가 올바르지 않아요. 받은 링크를 그대로 붙여넣어 주세요.',device:'다른 휴대폰용 라이선스예요. 이 휴대폰의 기기 코드로 다시 받아 주세요.',revoked:'사용이 중지된 라이선스예요.',prog:'이 프로그램이 들어 있지 않은 라이선스예요.',expired:'라이선스 기간이 끝났어요.',clock:'휴대폰 날짜 · 시간이 맞지 않아요. 자동 날짜로 맞춘 뒤 다시 열어 주세요.',format:'라이선스를 찾지 못했어요. 받은 링크나 BKL1.로 시작하는 글을 붙여넣어 주세요.'};
window.BKLIC={on:ON,pub:PUB,PROGS:PROGS,DEFAULT_LOCK:DEFAULT_LOCK,ACT_URL:ACT_URL,deviceCode:deviceCode,fmtDev:fmtDev,devBytes:devBytes,check:check,addKey:addKey,parse:parse,pickKey:pickKey,keys:keys,saveKeys:saveKeys,
 maskNames:maskNames,dayStr:dayStr,dayNow:dayNow,progBit:progBit,REASON:REASON,b64u:b64u,unb64u:unb64u,EPOCH:EPOCH,loadCfg:loadCfg,isLocked:isLocked};

/* ═════════ 잠금 화면 (window.BK_PROG 가 있는 화면에서만) ═════════ */
var prog=window.BK_PROG;
if(!ON||!prog)return;
var pname=(PROGS.filter(function(p){return p[0]===prog})[0]||[0,'이 프로그램'])[1];
var css='html.bk-lock body>*:not(#bkLicGate){display:none!important}html.bk-lock body{overflow:hidden}'+
 '#bkLicGate{position:fixed;inset:0;z-index:2147483647;background:#f3f6fb;overflow:auto;font:15px/1.6 system-ui,-apple-system,"Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1f2937}'+
 '#bkLicGate .w{max-width:520px;margin:0 auto;padding:22px 16px 40px}#bkLicGate .card{background:#fff;border:1px solid #dce3ee;border-radius:18px;padding:18px;margin-top:12px}'+
 '#bkLicGate h1{font-size:1.35rem;margin:6px 0 4px;color:#174782}#bkLicGate .lk{font-size:3rem;text-align:center}#bkLicGate .why{background:#fff8e7;border:1px solid #f1d48a;color:#714d00;border-radius:12px;padding:10px 12px;margin-top:10px;font-weight:700}'+
 '#bkLicGate .dev{font:900 1.6rem/1.2 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-align:center;background:#eef4fd;border:2px dashed #93c5fd;border-radius:14px;padding:14px 6px;color:#174782;margin:8px 0}'+
 '#bkLicGate button{display:block;width:100%;border:0;border-radius:12px;padding:13px;font:inherit;font-weight:800;cursor:pointer;margin-top:8px}'+
 '#bkLicGate .b1{background:#174782;color:#fff}#bkLicGate .b2{background:#e8eef8;color:#174782}#bkLicGate .kk{background:#fee500;color:#191919}'+
 '#bkLicGate textarea{width:100%;box-sizing:border-box;min-height:84px;border:1px solid #cbd5e1;border-radius:12px;padding:10px;font:inherit;font-size:.9rem}'+
 '#bkLicGate .msg{min-height:1.4em;font-weight:800;text-align:center;margin-top:8px}#bkLicGate small{color:#64748b}'+
 '#bkLicWarn{position:fixed;left:8px;right:8px;bottom:8px;z-index:2147483646;background:#fff7ed;border:2px solid #fb923c;color:#9a3412;border-radius:14px;padding:10px 12px;font:700 14px/1.5 system-ui,sans-serif;box-shadow:0 6px 20px #0003}'+
 '#bkLicWarn button{float:right;border:0;background:transparent;font-size:18px;color:#9a3412;margin:-4px -4px 0 6px}';
var st=document.createElement('style');st.textContent=css;(document.head||document.documentElement).appendChild(st);
/* 잠겼을 수 있으면 먼저 가려 두고(번쩍임 방지), 확인 뒤에 풀어 줌 */
var pre=null;try{pre=JSON.parse(ls('bkLicCfg')||'null')}catch(e){}
var mayLock=true;try{if(pre&&pre.p){var pc=JSON.parse(new TextDecoder().decode(unb64u(pre.p)));mayLock=isLocked(prog,pc)}}catch(e){}
if(mayLock)document.documentElement.classList.add('bk-lock');
function run(){check(prog).then(function(r){
 if(r.ok){document.documentElement.classList.remove('bk-lock');var g=document.getElementById('bkLicGate');if(g)g.remove();
  if(r.daysLeft!==undefined&&r.daysLeft!==Infinity&&r.daysLeft<=7)warn(r);return}
 document.documentElement.classList.add('bk-lock');gate(r)})}
function warn(r){if(document.getElementById('bkLicWarn'))return;var d=document.createElement('div');d.id='bkLicWarn';
 d.innerHTML='<button type="button" aria-label="닫기">✕</button>⏰ '+pname+' 라이선스가 <b>'+(r.daysLeft<=0?'오늘':r.daysLeft+'일 뒤')+'</b> 끝나요 ('+dayStr(r.lic.exp)+'까지). 연장은 BK Agent(비케이)에게 문의해 주세요.';
 d.querySelector('button').onclick=function(){d.remove()};document.body.appendChild(d)}
function gate(r){var old=document.getElementById('bkLicGate');if(old)old.remove();
 var code=fmtDev(deviceCode()),g=document.createElement('div');g.id='bkLicGate';
 var why=r.reason&&r.reason!=='none'?REASON[r.reason]+(r.reason==='expired'&&r.lic?' ('+dayStr(r.lic.exp)+'까지)':''):'';
 g.innerHTML='<div class="w"><div class="lk">🔒</div><h1>'+pname+'은(는) 라이선스가 필요해요</h1><small>라이선스를 받은 휴대폰에서만 쓸 수 있어요.</small>'+(why?'<div class="why">⚠️ '+why+'</div>':'')+
 '<div class="card"><b>① 이 휴대폰의 기기 코드</b><div class="dev">'+code+'</div><button type="button" class="kk" data-a="send">💬 카톡으로 라이선스 요청하기</button><button type="button" class="b2" data-a="copy">📋 기기 코드 복사</button></div>'+
 '<div class="card"><b>② 받은 라이선스 넣기</b><br><small>카톡으로 받은 <b>링크를 누르면</b> 바로 열려요. 또는 받은 글을 길게 눌러 복사한 뒤 아래에 붙여넣으세요.</small><textarea id="bkLicIn" placeholder="https://… 또는 BKL1.…"></textarea><button type="button" class="b2" data-a="paste">📋 붙여넣기</button><button type="button" class="b1" data-a="ok">✅ 라이선스 확인</button><div class="msg" id="bkLicMsg"></div></div>'+
 '<p style="text-align:center;margin-top:14px"><a href="/bk-card/" style="color:#174782;font-weight:800">← BK톡톡 처음 메뉴</a></p></div>';
 document.body.appendChild(g);
 var msg=function(t,c){var m=document.getElementById('bkLicMsg');m.textContent=t;m.style.color=c||'#b91c1c'};
 var txt='[BK 라이선스 요청]\n프로그램: '+pname+'\n기기 코드: '+code+'\n이름: \n전화: ';
 g.addEventListener('click',function(e){var b=e.target.closest('button[data-a]');if(!b)return;var a=b.getAttribute('data-a');
  if(a==='copy'){(navigator.clipboard?navigator.clipboard.writeText(code):Promise.reject()).then(function(){msg('✅ 기기 코드를 복사했어요','#059669')}).catch(function(){msg('기기 코드를 길게 눌러 복사해 주세요')});}
  if(a==='send'){if(navigator.share)navigator.share({text:txt}).catch(function(){});else (navigator.clipboard?navigator.clipboard.writeText(txt):Promise.reject()).then(function(){msg('✅ 요청 글을 복사했어요 · 카톡에 붙여넣어 보내 주세요','#059669')}).catch(function(){});}
  if(a==='paste'){(navigator.clipboard&&navigator.clipboard.readText?navigator.clipboard.readText():Promise.reject()).then(function(t){document.getElementById('bkLicIn').value=t;b.nextElementSibling.click()}).catch(function(){msg('칸을 길게 눌러 붙여넣기 해 주세요');document.getElementById('bkLicIn').focus()});}
  if(a==='ok'){msg('확인 중…','#174782');addKey(document.getElementById('bkLicIn').value).then(function(x){if(!x.ok){msg('❌ '+REASON[x.reason]);return}msg('✅ 확인됐어요! 여는 중…','#059669');setTimeout(run,400)})}
 })}
/* 받은 링크로 바로 열었을 때 (#BKL1.…) */
var hk=pickKey(location.hash);if(hk){addKey(hk).then(function(){try{history.replaceState(null,'',location.pathname+location.search)}catch(e){}run()})}
else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',run);else run();
})();

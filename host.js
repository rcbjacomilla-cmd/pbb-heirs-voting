import {createBackend} from './backend.js';
import {ROUNDS,ROUND_MAP,DEFAULT_STATE,makeSummary} from './rounds.js';
const $ = id => document.getElementById(id);
let backend = null, state = structuredClone(DEFAULT_STATE), votes={}, unsubVotes=null, activeRound='eviction', working=false, isSignedIn=false;
const escapeHTML=s=>String(s).replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const joinUrl = new URL('index.html',location.href).href.replace(/\?[^#]*$/,'');
function setPending(on){working=on;for(const id of ['open-voting','close-voting','reveal-results','hide-results','reset-round'])$(id).disabled=on;}
function message(error){$('control-error').textContent=error?.message || String(error || '');}
function showAuth(user) {
 isSignedIn=!!user && !user.isAnonymous;
 $('loading').classList.add('hidden');
 $('login-panel').classList.toggle('hidden',isSignedIn);
 $('dashboard').classList.toggle('hidden',!isSignedIn);
 $('logout').classList.toggle('hidden',!isSignedIn || backend.mode==='demo');
}
function connectVotes(roundId) {
 if(unsubVotes){unsubVotes();unsubVotes=null;}
 votes={};renderVotes();
 if(isSignedIn)unsubVotes=backend.subscribeVotes(roundId, val=>{votes=val;renderVotes();});
}
function renderRounds() {
 $('round-list').replaceChildren();
 for(const round of ROUNDS){
  const b=document.createElement('button');b.className='round-btn'+(round.id===activeRound?' active':'');
  b.innerHTML=`<strong>${escapeHTML(round.label)}</strong><small>${escapeHTML(round.kicker)}</small>`;
  b.disabled=working;
  b.addEventListener('click',()=>act(async()=>{
    await backend.setState({activeRound:round.id,status:'waiting',showResults:false,resultSummary:null});
  }));$('round-list').append(b);
 }
}
function renderVotes(){
 const round=ROUND_MAP[activeRound];if(!round)return;
 const summary=makeSummary(activeRound,votes);
 $('metric-votes').textContent=summary.total;
 $('metric-choices').textContent=round.options.length;
 $('live-bars').replaceChildren();
 for(const option of round.options){
   const count=summary.counts[option.id]||0;
   const pct=summary.total?Math.round(count*100/summary.total):0;
   const wrap=document.createElement('div');wrap.className='result-row';
   const top=document.createElement('div');top.className='result-top';
   const name=document.createElement('span');name.textContent=option.name;
   const result=document.createElement('small');result.textContent=`${count} vote${count===1?'':'s'} · ${pct}%`;
   top.append(name,result);
   const track=document.createElement('div');track.className='track';
   const fill=document.createElement('div');fill.className=`fill ${option.color}`;fill.style.width=`${pct}%`;
   track.append(fill);wrap.append(top,track);$('live-bars').append(wrap);
 }
 $('tally-note').textContent=state.showResults ? 'Results are now visible to the class on the projector screen.' : 'Voting counts are private to Kuya until REVEAL is clicked.';
}
function renderState(next){
 const changed=next.activeRound!==activeRound;
 state=next;activeRound=ROUND_MAP[state.activeRound]?state.activeRound:'eviction';
 const round=ROUND_MAP[activeRound];
 $('active-kicker').textContent=round.kicker;
 $('active-title').textContent=round.title;
 $('active-question').textContent=round.question;
 $('metric-status').textContent=state.status==='open'?'LIVE':state.status==='closed'?'CLOSED':'STANDBY';
 $('open-voting').disabled=working || state.status==='open';
 $('close-voting').disabled=working || state.status!=='open';
 $('reveal-results').disabled=working || state.showResults;
 $('hide-results').disabled=working || !state.showResults;
 if(changed || !unsubVotes)connectVotes(activeRound);
 renderRounds();renderVotes();
}
async function act(callback){if(working)return;setPending(true);message('');try{await callback();}catch(e){message(e);}finally{setPending(false);renderState(state);}}
$('open-voting').addEventListener('click',()=>act(async()=>{await backend.setState({status:'open',showResults:false,resultSummary:null});}));
$('close-voting').addEventListener('click',()=>act(async()=>{await backend.setState({status:'closed',showResults:false,resultSummary:null});}));
$('reveal-results').addEventListener('click',()=>act(async()=>{await backend.reveal(activeRound);}));
$('hide-results').addEventListener('click',()=>act(async()=>{await backend.setState({showResults:false,resultSummary:null});}));
$('reset-round').addEventListener('click',()=>{
 if(!confirm(`Delete ALL votes in “${ROUND_MAP[activeRound].label}”? This cannot be undone.`))return;
 act(async()=>{await backend.setState({status:'waiting',showResults:false,resultSummary:null});await backend.resetVotes(activeRound);});
});
$('login-form').addEventListener('submit',async e=>{e.preventDefault();$('login-error').textContent='';
 const button=$('login-form').querySelector('button');button.disabled=true;button.textContent='SIGNING IN…';
 try{await backend.login($('email').value.trim(),$('password').value);}
 catch(err){$('login-error').textContent=`Login failed: ${err.message || err}`;}
 finally{button.disabled=false;button.textContent='UNLOCK CONTROL ROOM';}
});
$('logout').addEventListener('click',async()=>{await backend.logout();});
$('copy-url').addEventListener('click',async()=>{
 try{await navigator.clipboard.writeText(joinUrl);$('copy-url').textContent='COPIED!';setTimeout(()=>$('copy-url').textContent='COPY LINK',1600);}
 catch(e){$('qr-note').textContent='Copy the URL from the box above manually.';}
});
function buildQR(){
 $('join-url').textContent=joinUrl;
 const isLocal=/^(file:|http:\/\/localhost|http:\/\/127\.0\.0\.1)/.test(joinUrl);
 if(isLocal)$('qr-note').textContent='Test link only: deploy to GitHub Pages first, then share the public URL/QR.';
 else $('qr-note').textContent='Share this QR during Nomination Time (page 18 of your deck), and paste the link in Zoom chat.';
 const qr=$('qr-host');qr.innerHTML='';
 if(typeof window.QRCode==='function')new window.QRCode(qr,{text:joinUrl,width:156,height:156,colorDark:'#123b73',colorLight:'#ffffff',correctLevel:window.QRCode.CorrectLevel.M});
 else qr.textContent='QR unavailable. Use the link below.';
}
const qrTimer=setInterval(()=>{if(typeof window.QRCode==='function'){clearInterval(qrTimer);buildQR();}},200);
setTimeout(()=>{clearInterval(qrTimer);if(!$('qr-host').querySelector('canvas'))buildQR();},3500);
$('projector-link').href=new URL('screen.html',location.href).href;
try{
 backend=await createBackend('host');
 $('mode-pill').classList.add(backend.mode==='demo'?'demo':'live');$('mode-text').textContent=backend.mode==='demo'?'DEMO MODE':'SUPABASE LIVE';
 if(backend.mode==='demo'){
  showAuth({uid:'demo-host',email:'demo@local.test'});
  backend.subscribeState(renderState);
 }else{
  let unsubState=null;
  backend.subscribeAuth(user=>{
   showAuth(user);
   if(unsubState){unsubState();unsubState=null;}
   if(unsubVotes){unsubVotes();unsubVotes=null;}
   if(isSignedIn){unsubState=backend.subscribeState(renderState);}
  });
 }
}catch(e){$('loading').innerHTML=`<h2 class="panel-title">Connection error</h2><p class="panel-caption">${escapeHTML(e.message||String(e))}</p>`;}

import {createBackend} from './backend.js?v=20261028-loginfix2';
import {ROUND_MAP} from './rounds.js';
const $=id=>document.getElementById(id);
const joinUrl=new URL('index.html',location.href).href.replace(/\?[^#]*$/,'');
function render(state){
 const round=ROUND_MAP[state.activeRound];
 if(!round)return;
 $('screen-kicker').textContent=round.kicker;
 $('screen-title').textContent=round.title;
 $('screen-question').textContent=round.question;
 $('screen-state').textContent=state.showResults?'RESULTS REVEALED':state.status==='open'?'VOTING LIVE':state.status==='closed'?'VOTING CLOSED':'STANDBY';
 $('screen-state-chip').classList.toggle('live',state.status==='open');
 $('screen-prompt').textContent=state.showResults?'OFFICIAL VOTE COUNT':state.status==='open'?'VOTING LINES ARE NOW OPEN!':state.status==='closed'?'VOTING HAS ENDED':'STANDBY FOR KUYA’S SIGNAL';
 const contestantWrap=$('screen-contestants'); contestantWrap.replaceChildren();
 for (const option of round.options) {
   const card=document.createElement('div');card.className='screen-contestant';
   const image=document.createElement('img'); image.src=option.image||'assets/pbb-eye.webp'; image.alt=option.name;
   const info=document.createElement('div'); const name=document.createElement('strong');name.textContent=option.name;
   const alias=document.createElement('small');alias.textContent=option.alias;
   info.append(name,alias); card.append(image,info); contestantWrap.append(card);
 }
 const summary=state.resultSummary;
 const show=state.showResults && summary && summary.roundId===round.id;
 $('results-section').classList.toggle('hidden',!show);
 if(show){
  $('screen-bars').replaceChildren();
  for(const option of round.options){
   const count=summary.counts?.[option.id]||0;
   const pct=summary.total?Math.round(count*100/summary.total):0;
   const row=document.createElement('div');row.className='result-row';
   const top=document.createElement('div');top.className='result-top';
   const name=document.createElement('span');name.textContent=option.name;
   const numbers=document.createElement('small');numbers.textContent=`${pct}% · ${count} vote${count===1?'':'s'}`;top.append(name,numbers);
   const track=document.createElement('div');track.className='track';
   const fill=document.createElement('div');fill.className=`fill ${option.color}`;fill.style.width=pct+'%';track.append(fill);row.append(top,track);$('screen-bars').append(row);
  }
  const sorted=[...round.options].sort((a,b)=>(summary.counts?.[b.id]||0)-(summary.counts?.[a.id]||0));
  const top=summary.counts?.[sorted[0].id]||0;
  const second=summary.counts?.[sorted[1]?.id]||0;
  const banner=$('screen-winner');
  if (!summary.total) banner.textContent='NO VOTES WERE CAST';
  else if (top===second) banner.textContent='IT’S A TIE — KUYA WILL DECIDE THE TIEBREAK';
  else if (round.id==='eviction') banner.textContent=`SAVED HOUSEMATE: ${sorted[0].name}!`;
  else if (round.id.startsWith('final-')) banner.textContent=`BIG WINNER: ${sorted[0].name}!`;
  else banner.textContent=`MOST VOTED ANSWER: ${sorted[0].name}`;
 } else {$('screen-winner').textContent='';}
}
$('screen-join-url').textContent=joinUrl;
function buildQR(){const el=$('qr-screen');el.innerHTML='';if(typeof window.QRCode==='function')new window.QRCode(el,{text:joinUrl,width:218,height:218,colorDark:'#123b73',colorLight:'#fff',correctLevel:window.QRCode.CorrectLevel.M});else el.textContent='Share the link below.';}
const timer=setInterval(()=>{if(typeof window.QRCode==='function'){clearInterval(timer);buildQR();}},200);
setTimeout(()=>{clearInterval(timer);if(!$('qr-screen').querySelector('canvas'))buildQR();},3500);
try{const backend=await createBackend('screen');backend.subscribeState(render);}catch(e){$('screen-title').textContent='CONNECTION ERROR';$('screen-question').textContent=e.message||String(e);}

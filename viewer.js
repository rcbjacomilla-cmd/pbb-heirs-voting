import { createBackend } from './backend.js';
import { ROUND_MAP } from './rounds.js';
const $ = id => document.getElementById(id);
const screens = ['loading','waiting','vote-content','already-voted','results-status','error-screen'];
let backend = null, state = null, chosen = null, currentRoundId = null, ownVote = null, unsubscribeOwn = null, submitting = false;
function show(id) {screens.forEach(screen=>$(screen).classList.toggle('hidden',screen!==id));}
function select(choice) {
  if (submitting || ownVote !== null) return;
  chosen = choice;
  document.querySelectorAll('.vote-tile').forEach(el => {
    const selected = el.dataset.choice === choice;
    el.classList.toggle('selected',selected);
    el.setAttribute('aria-pressed',String(selected));
    el.querySelector('.select-pill').textContent=selected ? '✓ SELECTED' : 'TAP TO SELECT';
  });
  $('submit-vote').disabled=false;
  $('submit-vote').textContent='SEND MY VOTE TO KUYA';
}
function buildRound() {
  const round=ROUND_MAP[currentRoundId];
  if(!round)return;
  $('round-kicker').textContent=round.kicker;
  $('round-title').textContent=round.title;
  $('round-question').textContent=round.question;
  $('round-instruction').textContent=round.instruction;
  $('vote-options').replaceChildren();
  for(const option of round.options) {
    const tile=document.createElement('button');tile.type='button';tile.className=`vote-tile ${option.color}`;tile.dataset.choice=option.id;tile.setAttribute('aria-pressed','false');
    const avatar=document.createElement('div');
    if (option.image) {
      avatar.className='portrait has-image';
      const img=document.createElement('img'); img.src=option.image; img.alt=option.name; img.loading='eager'; avatar.append(img);
    } else { avatar.className='quiz-icon'; avatar.textContent=option.symbol; }
    const name=document.createElement('div');name.className='vote-name';name.textContent=option.name;
    const alias=document.createElement('div');alias.className='vote-alias';alias.textContent=option.alias;
    const pill=document.createElement('div');pill.className='select-pill';pill.textContent=round.id==='diaz-quiz'?'CHOOSE ANSWER':'BBS · SAVE';
    tile.append(avatar,name,alias,pill);tile.addEventListener('click',()=>select(option.id));$('vote-options').append(tile);
  }
  chosen=null;$('submit-vote').disabled=true;$('submit-vote').textContent=round.id==='diaz-quiz'?'SELECT AN ANSWER':'SELECT A HOUSEMATE';$('vote-error').textContent='';
}
function render() {
  if(!state)return;
  const round=ROUND_MAP[state.activeRound];
  if (!round) {show('waiting');$('waiting-message').textContent='Kuya is preparing the next challenge.';return;}
  if (state.activeRound !== currentRoundId) {
    currentRoundId=state.activeRound;ownVote=null;buildRound();
    if(unsubscribeOwn)unsubscribeOwn();
    unsubscribeOwn=backend.subscribeOwnVote(currentRoundId, vote=>{ownVote=vote;render();});
  }
  if(state.showResults || state.status==='closed') {show('results-status');return;}
  if(state.status!=='open') {show('waiting');$('waiting-kicker').textContent=round.kicker;$('waiting-message').textContent=`Next: ${round.label}. Kuya will open the voting lines shortly. Keep this page open.`;return;}
  if(ownVote !== null) {
    const opt=round.options.find(o=>o.id===ownVote);
    $('your-vote-label').textContent=opt?`Your choice: ${opt.name}`:'Your vote was recorded.';
    show('already-voted');return;
  }
  show('vote-content');
}
$('submit-vote').addEventListener('click',async()=>{
  if(!chosen || submitting || !state || state.status!=='open')return;
  submitting=true;$('vote-error').textContent='';$('submit-vote').disabled=true;$('submit-vote').textContent='SUBMITTING…';
  try {await backend.castVote(currentRoundId,chosen);ownVote=chosen;render();}
  catch(error){$('vote-error').textContent=error.message || 'Unable to submit. Please try again.';}
  finally{submitting=false;$('submit-vote').disabled=!chosen;$('submit-vote').textContent='SEND MY VOTE TO KUYA';}
});
try {
  backend=await createBackend('viewer');
  $('mode-text').textContent=backend.mode==='demo'?'DEMO MODE':'LIVE VOTING';$('mode-pill').classList.add(backend.mode==='demo'?'demo':'live');
  if(backend.mode==='demo')$('demo-caveat').textContent='Demo votes sync only across tabs in the same browser.';
  backend.subscribeState(next=>{state=next;render();});
} catch(error){$('fatal-error').textContent=error.message || 'Check the Supabase configuration and try again.';show('error-screen');}

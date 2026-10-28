import {supabaseUrl, supabasePublishableKey, supabaseReady} from './supabase-config.js';
import {DEFAULT_STATE, makeSummary} from './rounds.js';

const deepCopy = value => JSON.parse(JSON.stringify(value));
const localKey = 'pbb-heirs-supabase-demo-v1';
const participantKey = 'pbb-heirs-supabase-demo-voter-v1';
const eventName = 'pbb-heirs-supabase-demo-event';

function demoData() {
  try {const data=JSON.parse(localStorage.getItem(localKey)||'null'); if(data?.state && data?.votes)return data;}
  catch (_) {}
  return {state:deepCopy(DEFAULT_STATE),votes:{}};
}
function saveDemo(data) {localStorage.setItem(localKey,JSON.stringify(data));window.dispatchEvent(new Event(eventName));}
function uniqueId(){return globalThis.crypto?.randomUUID?.()||`v${Date.now()}${Math.random().toString(36).slice(2)}`;}
function voterId(){let id=localStorage.getItem(participantKey);if(!id){id=uniqueId();localStorage.setItem(participantKey,id);}return id;}
function subscribeDemo(extract,cb) {
  const emit=()=>cb(deepCopy(extract(demoData())));
  window.addEventListener('storage',emit);window.addEventListener(eventName,emit);emit();
  return ()=>{window.removeEventListener('storage',emit);window.removeEventListener(eventName,emit);};
}
function demoBackend(){
  const uid=voterId();
  return {
    mode:'demo',
    subscribeAuth:cb=>{cb({uid:'demo-host',email:'demo@local.test',isAnonymous:false});return ()=>{};},
    login:async()=>true,logout:async()=>true,
    subscribeState:cb=>subscribeDemo(data=>data.state,cb),
    subscribeVotes:(rid,cb)=>subscribeDemo(data=>data.votes[rid]||{},cb),
    subscribeOwnVote:(rid,cb)=>subscribeDemo(data=>data.votes[rid]?.[uid]||null,cb),
    async setState(patch){const data=demoData();data.state={...data.state,...patch};saveDemo(data);},
    async castVote(rid,choice){const data=demoData();if(data.state.status!=='open'||data.state.activeRound!==rid)throw Error('Voting is closed for this round.');data.votes[rid]||={};if(data.votes[rid][uid])throw Error('You already voted in this round.');data.votes[rid][uid]=choice;saveDemo(data);},
    async resetVotes(rid){const data=demoData();delete data.votes[rid];saveDemo(data);},
    async reveal(rid){const data=demoData();data.state.status='closed';data.state.showResults=true;data.state.resultSummary=makeSummary(rid,data.votes[rid]||{});saveDemo(data);return data.state.resultSummary;}
  };
}
function unwrap(result,context){if(result.error)throw new Error(`${context}: ${result.error.message}`);return result.data;}
const stateKeys={activeRound:'active_round',status:'status',showResults:'show_results',resultSummary:'result_summary'};
function stateFromRow(row){if(!row)return deepCopy(DEFAULT_STATE);return {
  activeRound:row.active_round,status:row.status,showResults:row.show_results,resultSummary:row.result_summary
};}
function statePatch(patch){return Object.fromEntries(Object.entries(patch).map(([key,value])=>[stateKeys[key],value]).filter(([key])=>!!key));}

let modulePromise;
async function loadSupabase(){
  if(!modulePromise)modulePromise=import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  return modulePromise;
}
export async function createBackend(role='viewer'){
  if(!supabaseReady||new URLSearchParams(location.search).has('demo'))return demoBackend();
  const {createClient}=await loadSupabase();
  const client=createClient(supabaseUrl,supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  if(role!=='host'){
    let {data,error}=await client.auth.getSession();
    if(error)throw error;
    if(!data.session){const created=await client.auth.signInAnonymously();if(created.error)throw new Error('Enable Anonymous sign-ins in Supabase Auth first. '+created.error.message);}
  }
  const getUid=async()=>{const {data,error}=await client.auth.getUser();if(error||!data.user)throw new Error('Session expired. Reload the page and try again.');return data.user.id;};
  const getState=async()=>stateFromRow(unwrap(await client.from('pbb_house_state').select('*').eq('id',1).single(),'Loading voting state'));
  const getVotes=async rid=>{
    const data=unwrap(await client.from('pbb_votes').select('voter_id,choice').eq('round_id',rid),'Loading votes');
    return Object.fromEntries(data.map(item=>[item.voter_id,item.choice]));
  };
  const getOwnVote=async rid=>{
    const uid=await getUid();
    const item=unwrap(await client.from('pbb_votes').select('choice').eq('round_id',rid).eq('voter_id',uid).maybeSingle(),'Loading your vote');
    return item?.choice??null;
  };
  function watchTable(table,filter,read,cb,interval){
    let stopped=false,pending=false;
    const refresh=async()=>{if(stopped||pending)return;pending=true;try{const value=await read();if(!stopped)cb(value);}catch(err){if(!stopped)console.error(`[PBB] ${table} refresh:`,err);}finally{pending=false;}};
    const channel=client.channel(`pbb-${table}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes',{event:'*',schema:'public',table,...(filter?{filter}:{})},refresh).subscribe();
    const timer=setInterval(refresh,interval);
    refresh();
    return ()=>{stopped=true;clearInterval(timer);client.removeChannel(channel);};
  }
  async function updateState(patch){
    const columns=statePatch(patch);
    if(!Object.keys(columns).length)return;
    unwrap(await client.from('pbb_house_state').update(columns).eq('id',1).select('id').single(),'Updating voting state');
  }
  return {
    mode:'live',
    subscribeAuth:cb=>{
      let active=true;
      function send(user){if(!active)return;cb(user?{uid:user.id,email:user.email,isAnonymous:!!user.is_anonymous}:null);}
      client.auth.getUser().then(({data})=>send(data?.user||null));
      const {data:sub}=client.auth.onAuthStateChange((_event,session)=>send(session?.user||null));
      return ()=>{active=false;sub.subscription.unsubscribe();};
    },
    async login(email,password){
      const data=unwrap(await client.auth.signInWithPassword({email,password}),'Signing in');
      const isHost=unwrap(await client.rpc('pbb_is_host'),'Checking host permission');
      if(!isHost){await client.auth.signOut();throw new Error('This account is not authorized as Kuya. Add its user UID to pbb_hosts in Supabase.');}
      return data;
    },
    logout:async()=>unwrap(await client.auth.signOut(),'Signing out'),
    subscribeState:cb=>watchTable('pbb_house_state','id=eq.1',getState,cb,10000),
    subscribeVotes:(rid,cb)=>watchTable('pbb_votes',null,()=>getVotes(rid),cb,2500),
    subscribeOwnVote:(rid,cb)=>watchTable('pbb_votes',null,()=>getOwnVote(rid),cb,10000),
    setState:updateState,
    async castVote(rid,choice){
      const voter_id=await getUid();
      const result=await client.from('pbb_votes').insert({round_id:rid,voter_id,choice});
      if(result.error){
        if(result.error.code==='23505')throw new Error('This account already voted in this round.');
        if(result.error.code==='42501')throw new Error('Voting is closed or this choice is not allowed.');
        throw new Error('Your vote was not recorded: '+result.error.message);
      }
    },
    async resetVotes(rid){unwrap(await client.from('pbb_votes').delete().eq('round_id',rid),'Resetting votes');},
    async reveal(rid){
      // Close first, then count votes; the database refuses new votes when closed.
      await updateState({status:'closed',showResults:false,resultSummary:null});
      const summary=makeSummary(rid,await getVotes(rid));
      await updateState({showResults:true,resultSummary:summary});
      return summary;
    }
  };
}
export function currentMode(){return(!supabaseReady||new URLSearchParams(location.search).has('demo'))?'demo':'live';}

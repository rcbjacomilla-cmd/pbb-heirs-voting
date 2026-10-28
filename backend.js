import {supabaseUrl, supabasePublishableKey, supabaseReady} from './supabase-config.js';
import {DEFAULT_STATE, makeSummary} from './rounds.js?v=20261028-pinoybigben1';

const copy = data => JSON.parse(JSON.stringify(data));
const demoStore='pbb-heirs-name-login-demo-v1';
const demoSessionKey='pbb-heirs-demo-name-session';
const liveSessionKey='pbb-heirs-name-login-session-v1';
const demoIdentityKey='pbb-heirs-demo-voter-id';
const demoEvent='pbb-heirs-updated';

function demoData(){try{const x=JSON.parse(localStorage.getItem(demoStore)||'null');if(x?.state&&x?.votes)return x;}catch{}return{state:copy(DEFAULT_STATE),votes:{}};}
function saveDemo(d){localStorage.setItem(demoStore,JSON.stringify(d));window.dispatchEvent(new Event(demoEvent));}
function uniqueId(){return globalThis.crypto?.randomUUID?.()||`v${Date.now()}-${Math.random().toString(36).slice(2)}`;}
function demoId(){let id=sessionStorage.getItem(demoIdentityKey);if(!id){id=uniqueId();sessionStorage.setItem(demoIdentityKey,id);}return id;}
function demoSubscribe(extract,callback){const send=()=>callback(copy(extract(demoData())));window.addEventListener('storage',send);window.addEventListener(demoEvent,send);send();return()=>{window.removeEventListener('storage',send);window.removeEventListener(demoEvent,send);};}
function demoBackend(role){
  let authCb=null;let account=null;
  function notify(){authCb?.(account);}
  function demoAuthenticate(name,password){if(!name?.trim()||password?.length<8)throw Error('Enter your name and a password of at least 8 characters.');account={name:name.trim(),isHost:role==='host',is_host:role==='host',uid:demoId()};sessionStorage.setItem(demoSessionKey,JSON.stringify(account));notify();return account;}
  return{
    mode:'demo',
    async currentUser(){if(account)return account;try{account=JSON.parse(sessionStorage.getItem(demoSessionKey)||'null');}catch{};return account;},
    subscribeAuth(cb){authCb=cb;cb(account);return()=>{authCb=null;};},
    login:async(name,password)=>demoAuthenticate(name,password),
    register:async(name,password)=>demoAuthenticate(name,password),
    async logout(){account=null;sessionStorage.removeItem(demoSessionKey);notify();},
    subscribeState:cb=>demoSubscribe(d=>d.state,cb),
    subscribeVotes:(rid,cb)=>demoSubscribe(d=>d.votes[rid]||{},cb),
    subscribeOwnVote:(rid,cb)=>demoSubscribe(d=>d.votes[rid]?.[demoId()]||null,cb),
    async setState(patch){let d=demoData();d.state={...d.state,...patch};saveDemo(d);},
    async castVote(rid,choice){let d=demoData();if(d.state.status!=='open'||d.state.activeRound!==rid)throw Error('Voting is closed.');d.votes[rid]||={};if(d.votes[rid][demoId()])throw Error('You already voted in this round.');d.votes[rid][demoId()]=choice;saveDemo(d);},
    async resetVotes(rid){let d=demoData();delete d.votes[rid];saveDemo(d);},
    async reveal(rid){let d=demoData();d.state.status='closed';d.state.showResults=true;d.state.resultSummary=makeSummary(rid,d.votes[rid]||{});saveDemo(d);return d.state.resultSummary;},
  };
}

const TIMEOUT_MS=13000;
function withTimeout(promise, label, ms=TIMEOUT_MS){
  let timer;
  const limit=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(`${label} timed out after ${Math.round(ms/1000)} seconds. Check your connection and Supabase project status, then retry.`)),ms);});
  return Promise.race([Promise.resolve(promise),limit]).finally(()=>clearTimeout(timer));
}
let loader;
async function loadSupabase(){
  if(!loader) loader=withTimeout(import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'),'Loading Supabase library');
  return loader;
}
const stateColumns={activeRound:'active_round',status:'status',showResults:'show_results',resultSummary:'result_summary'};
const deserializeState=row=>row?{activeRound:row.active_round,status:row.status,showResults:row.show_results,resultSummary:row.result_summary}:copy(DEFAULT_STATE);
function unwrap(result,action){if(result.error)throw Error(`${action}: ${result.error.message}`);return result.data;}
function token(){try{return JSON.parse(localStorage.getItem(liveSessionKey)||'null')?.token||null;}catch{return null;}}
function storeSession(data){localStorage.setItem(liveSessionKey,JSON.stringify({token:data.token}));}
function forgetSession(){localStorage.removeItem(liveSessionKey);}

export async function createBackend(role='viewer'){
  if(!supabaseReady||new URLSearchParams(location.search).has('demo'))return demoBackend(role);
  const {createClient}=await loadSupabase();
  // Deliberately do not use Supabase Auth; we use separate, password-checked PBB RPCs.
  // This does NOT change or depend on the study website's Supabase Auth settings.
  const client=createClient(supabaseUrl,supabasePublishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'pbb-independent-name-login'}});
  let authCallback=null;
  const rpc=async(name,args,action)=>unwrap(await withTimeout(client.rpc(name,args),action),action);
  // Fail visibly with an actionable message if the new PBB SQL hasn't been installed.
  const health=await withTimeout(client.rpc('pbb_whoami',{p_token:''}),'Checking PBB database setup');
  if (health.error) {
    const missing=health.error.code==='PGRST202'||/could not find the function/i.test(health.error.message);
    throw new Error(missing
      ? 'The Name + Password tables are not installed yet. Run SETUP_NAME_PASSWORD.sql in Supabase SQL Editor, then refresh.'
      : 'Could not connect to Supabase. Check your public project URL/key and database setup: '+health.error.message);
  }
  function emit(user){authCallback?.(user);}
  async function currentUser(){
    const session=token();if(!session)return null;
    try{const me=await rpc('pbb_whoami',{p_token:session},'Checking session');if(!me){forgetSession();return null;}return{name:me.name,isHost:me.is_host,is_host:me.is_host};}
    catch(error){if(/session expired/i.test(error.message)){forgetSession();return null;}throw error;}
  }
  async function authenticate(name,password,mode){
    const result=await rpc(mode==='register'?'pbb_register':'pbb_login',{p_name:name.trim(),p_password:password},mode==='register'?'Creating account':'Signing in');
    storeSession(result);
    const user={name:result.name,isHost:result.is_host,is_host:result.is_host};
    if(role==='host'&&!user.isHost){emit(user);throw Error('This account is not yet authorized as Kuya. Have the project owner promote Ben using the SQL setup instructions.');}
    emit(user);return user;
  }
  const fetchState=async()=>{
    const record=unwrap(await withTimeout(client.from('pbb_house_state').select('*').eq('id',1).single(),'Loading voting state'),'Loading voting state');
    if(!record)throw Error('Voting state is missing. Run REPAIR_VOTING_CONNECTION.sql in your Supabase SQL Editor.');
    return deserializeState(record);
  };
  const fetchVotes=async rid=>await rpc('pbb_private_votes',{p_token:token(),p_round:rid},'Loading host tally')||{};
  const fetchOwn=async rid=>await rpc('pbb_my_vote',{p_token:token(),p_round:rid},'Loading your vote');
  function watchTable(table,filter,read,cb,interval,onError){
    let disposed=false,working=false,lastError='';
    const report=error=>{
      if(disposed)return;
      const msg=error?.message||String(error);
      if(msg!==lastError){console.error('[PBB] Sync error in '+table+':',error);lastError=msg;}
      if(typeof onError==='function')onError(error);
    };
    async function refresh(){
      if(disposed||working)return;
      working=true;
      try{
        const data=await read();
        if(!disposed){lastError='';cb(data);}
      }catch(e){report(e);}finally{working=false;}
    }
    let channel=null;
    try{
      channel=client.channel(`pbb-watch-${table}-${Math.random().toString(36).slice(2)}`)
        .on('postgres_changes',{event:'*',schema:'public',table,...(filter?{filter}:{})},refresh)
        .subscribe(status=>{
          // Polling is a working fallback even if a real-time socket cannot connect.
          if(status==='CHANNEL_ERROR'||status==='TIMED_OUT')console.warn('[PBB] Live socket unavailable; polling continues.');
        });
    }catch(error){console.warn('[PBB] Live subscription failed; polling continues.',error);}
    const timer=setInterval(refresh,interval);
    refresh();
    return()=>{disposed=true;clearInterval(timer);if(channel)client.removeChannel(channel);};
  }
  return{
    mode:'live',currentUser,
    subscribeAuth(cb){authCallback=cb;return()=>{authCallback=null;};},
    login:(name,password)=>authenticate(name,password,'login'),
    register:(name,password)=>authenticate(name,password,'register'),
    async logout(){const previous=token();forgetSession();if(previous){try{await rpc('pbb_logout',{p_token:previous},'Signing out');}catch(e){console.warn(e);}}emit(null);},
    subscribeState:(cb,onError)=>watchTable('pbb_house_state','id=eq.1',fetchState,cb,5000,onError),
    subscribeVotes:(rid,cb,onError)=>watchTable('pbb_votes',null,()=>fetchVotes(rid),cb,2500,onError),
    subscribeOwnVote:(rid,cb,onError)=>watchTable('pbb_votes',null,()=>fetchOwn(rid),cb,5000,onError),
    async setState(patch){await rpc('pbb_update_show',{p_token:token(),p_patch:patch},'Updating voting state');},
    async castVote(rid,choice){await rpc('pbb_submit_vote',{p_token:token(),p_round:rid,p_choice:choice},'Recording vote');},
    async resetVotes(rid){await rpc('pbb_clear_round',{p_token:token(),p_round:rid},'Resetting votes');},
    async reveal(rid){await this.setState({status:'closed',showResults:false,resultSummary:null});const summary=makeSummary(rid,await fetchVotes(rid));await this.setState({showResults:true,resultSummary:summary});return summary;},
  };
}
export function currentMode(){return(!supabaseReady||new URLSearchParams(location.search).has('demo'))?'demo':'live';}

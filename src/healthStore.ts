import type { BaselineRecord, HealthSession } from './healthTypes';

type DataClient={from:(name:string)=>any};
const PENDING_KEY='tu-chan:v2:pending';
const CACHE_KEY='tu-chan:v2:cache';

const readJson=<T,>(key:string,fallback:T):T=>{try{return JSON.parse(localStorage.getItem(key)||'') as T}catch{return fallback}};
const writeJson=(key:string,value:unknown)=>localStorage.setItem(key,JSON.stringify(value));

export function cachedSessions():HealthSession[]{return readJson<HealthSession[]>(CACHE_KEY,[])}
function cache(session:HealthSession){const old=cachedSessions();writeJson(CACHE_KEY,[session,...old.filter(x=>x.id!==session.id)].slice(0,60))}
function enqueue(session:HealthSession){const old=readJson<HealthSession[]>(PENDING_KEY,[]);writeJson(PENDING_KEY,[session,...old.filter(x=>x.id!==session.id)].slice(0,60));cache({...session,syncState:'pending'})}

const row=(s:HealthSession,userId:string)=>({
  id:s.id,user_id:userId,captured_at:s.capturedAt,observation:s.observation||null,listening:s.listening||null,inquiry:s.inquiry||null,tongue:s.tongue||null,
  fusion:s.fusion||null,safety:{...(s.safety||{}),answers:s.safetyAnswers||[]},recommendation:s.recommendation||null,feature_vector:s.featureVector||null,quality_score:s.fusion?.confidence||0,
});

async function persistAlert(client:DataClient,userId:string,session:HealthSession){
  if(!session.safety||session.safety.severity==='info')return;
  const code=session.safety.severity==='urgent'?'clinical-red-flag':'health-trend-watch';
  const {error}=await client.from('health_alerts').upsert({
    id:`${session.id}:${code}`,
    user_id:userId,
    session_id:session.id,
    severity:session.safety.severity,
    code,
    message:session.safety.message,
  },{onConflict:'id'});
  if(error)throw error;
}

async function persistSession(client:DataClient,userId:string,session:HealthSession){
  const {error}=await client.from('health_sessions').upsert(row(session,userId),{onConflict:'id'});
  if(error)throw error;
  await persistAlert(client,userId,session);
}

export async function saveSession(client:DataClient,userId:string,session:HealthSession){
  const cloud={...session,userId,syncState:'synced' as const};
  try{
    await persistSession(client,userId,cloud);
    cache(cloud);
    return {synced:true};
  }catch(error){
    enqueue({...session,userId,syncState:'pending'});
    return {synced:false,error};
  }
}

export async function syncPending(client:DataClient,userId:string){
  const pending=readJson<HealthSession[]>(PENDING_KEY,[]); if(!pending.length)return 0;
  const remain:HealthSession[]=[];let synced=0;
  for(const item of pending){
    try{
      await persistSession(client,userId,item);
      synced++;
      cache({...item,userId,syncState:'synced'});
    }catch{remain.push(item)}
  }
  writeJson(PENDING_KEY,remain); return synced;
}

export async function loadRecentSessions(client:DataClient,userId:string,limit=30):Promise<HealthSession[]>{
  try{
    const {data,error}=await client.from('health_sessions').select('*').eq('user_id',userId).order('captured_at',{ascending:false}).limit(limit); if(error)throw error;
    const mapped=(data||[]).map((r:any)=>({id:r.id,userId:r.user_id,date:String(r.captured_at).slice(0,10),capturedAt:r.captured_at,observation:r.observation,listening:r.listening,inquiry:r.inquiry,tongue:r.tongue,fusion:r.fusion,safety:r.safety?{severity:r.safety.severity,flags:r.safety.flags||[],message:r.safety.message}:undefined,safetyAnswers:r.safety?.answers||[],recommendation:r.recommendation,featureVector:r.feature_vector,syncState:'synced'} as HealthSession));
    writeJson(CACHE_KEY,mapped);return mapped;
  }catch{return cachedSessions().filter(x=>!x.userId||x.userId===userId).slice(0,limit)}
}

export async function loadBaseline(client:DataClient,userId:string):Promise<BaselineRecord|undefined>{
  try{const {data,error}=await client.from('health_baselines').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;if(!data)return undefined;return {userId:data.user_id,sessionCount:data.session_count,featureStats:data.feature_stats,lastSessionAt:data.last_session_at||undefined}}catch{return undefined}
}

export async function saveBaseline(client:DataClient,baseline:BaselineRecord){
  const {error}=await client.from('health_baselines').upsert({user_id:baseline.userId,session_count:baseline.sessionCount,feature_stats:baseline.featureStats,last_session_at:baseline.lastSessionAt||null,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;
}

export async function ensureProfile(client:DataClient,userId:string,name?:string){
  const {error}=await client.from('health_profiles').upsert({user_id:userId,display_name:name||null,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error;
}

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const {VoiceError} = require('./voice-core');
const STORE_URL = 'https://fqnphkqymzbxdzyqgsji.supabase.co';
function productionStore(env=process.env,fetcher=fetch) {
  const configured=()=>env.VOICE_BUDGET_URL===STORE_URL && typeof env.VOICE_BUDGET_KEY==='string' && env.VOICE_BUDGET_KEY.length>20;
  async function rpc(name,body) {
    if(!configured())throw new VoiceError(503,'voice_allowance_unavailable');
    const r=await fetcher(STORE_URL+'/rest/v1/rpc/'+name,{method:'POST',redirect:'error',signal:AbortSignal.timeout(5000),headers:{apikey:env.VOICE_BUDGET_KEY,authorization:'Bearer '+env.VOICE_BUDGET_KEY,'content-type':'application/json'},body:JSON.stringify(body)});
    if(!r.ok)throw new VoiceError(503,'voice_allowance_unavailable');
    const result=await r.json();if(!result||typeof result!=='object'||Array.isArray(result))throw new VoiceError(503,'voice_allowance_unavailable');return result;
  }
  return {
    ready:async({site})=>(await rpc('voice_pilot_health',{p_site:site})).available===true,
    begin:({site,id,tokenHash,payloadHash,rateKey,reserveMicroUsd})=>rpc('voice_pilot_begin',{p_site:site,p_id:id,p_token_hash:tokenHash,p_payload_hash:payloadHash,p_rate_key:rateKey,p_reserve:reserveMicroUsd}),
    recover:({site,id,tokenHash})=>rpc('voice_pilot_recover',{p_site:site,p_id:id,p_token_hash:tokenHash}),
    finish:({site,id,tokenHash,state,chargedMicroUsd,providerId,result,resultExpiresAt})=>rpc('voice_pilot_finish',{p_site:site,p_id:id,p_token_hash:tokenHash,p_state:state,p_charged:chargedMicroUsd,p_provider_id:providerId,p_result:result,p_result_expires_at:resultExpiresAt})
  };
}
// Explicit dependency injection for the attended loopback preview only. The public
// route below never selects this adapter from environment variables.
function fileStore(filename,{capMicroUsd=8000000,expiresAt,clock=Date.now}={}) {
  if(!path.isAbsolute(filename)||!Number.isSafeInteger(capMicroUsd)||capMicroUsd<250000||!Number.isFinite(expiresAt))throw new Error('Explicit file ledger policy required');
  fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
  const lock=filename+'.lock';
  async function locked(fn) {
    const started=Date.now();
    while(true) {
      try {fs.mkdirSync(lock,{mode:0o700});fs.writeFileSync(path.join(lock,'owner'),String(process.pid),{mode:0o600});break;}
      catch(e) {
        if(e.code!=='EEXIST')throw e;
        // Never reclaim a lock automatically, even when its recorded PID is dead.
        // Observing an orphan and deleting it is not atomic with another owner's
        // acquisition. Fail closed; recover manually with every writer stopped.
        if(Date.now()-started>5000)throw new VoiceError(503,'voice_allowance_unavailable');await new Promise(resolve=>setTimeout(resolve,20));
      }
    }
    try {
      if(fs.existsSync(filename)&&fs.lstatSync(filename).isSymbolicLink())throw new Error('Symlink ledger rejected');
      const data=fs.existsSync(filename)?JSON.parse(fs.readFileSync(filename,'utf8')):{version:1,capMicroUsd,expiresAt,disabled:false,requests:[]};
      // Existing ledgers never silently receive replenishment or a later expiry.
      if(data.version!==1||data.capMicroUsd!==capMicroUsd||data.expiresAt!==expiresAt)throw new Error('Ledger policy mismatch');
      for(const row of data.requests)if(row.resultExpiresAt<=clock())row.result=null;
      const result=fn(data);
      const temp=filename+'.'+process.pid+'.tmp';
      const fd=fs.openSync(temp,'w',0o600);try{fs.writeFileSync(fd,JSON.stringify(data));fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
      fs.renameSync(temp,filename);
      const directory=fs.openSync(path.dirname(filename),'r');try{fs.fsyncSync(directory);}finally{fs.closeSync(directory);}
      return result;
    } finally {fs.rmSync(lock,{recursive:true});}
  }
  const exposed=row=>row?{state:row.state,createdAt:row.createdAt,result:row.result,resultExpiresAt:row.resultExpiresAt}: {state:'missing'};
  return {
    ready:()=>locked(d=>!d.disabled&&d.expiresAt>clock()&&d.requests.reduce((s,r)=>s+(r.chargedMicroUsd===null?r.reservedMicroUsd:r.chargedMicroUsd),0)+250000<=d.capMicroUsd),
    begin:q=>locked(d=>{
      const previous=d.requests.find(r=>r.id===q.id&&r.site===q.site);
      if(previous) {if(previous.tokenHash!==q.tokenHash||previous.payloadHash!==q.payloadHash)throw new VoiceError(409,'request_conflict');return {status:'existing'};}
      if(d.disabled||clock()>=d.expiresAt||q.reserveMicroUsd!==250000)return {status:'budget_unavailable'};
      const used=d.requests.reduce((s,r)=>s+(r.chargedMicroUsd===null?r.reservedMicroUsd:r.chargedMicroUsd),0);
      if(used+q.reserveMicroUsd>d.capMicroUsd)return {status:'budget_unavailable'};
      const recent=d.requests.filter(r=>r.rateKey===q.rateKey&&clock()-r.createdAt<86400000);
      if(recent.length>=12||recent.some(r=>clock()-r.createdAt<3000))return {status:'rate_limited'};
      d.requests.push({...q,reservedMicroUsd:q.reserveMicroUsd,chargedMicroUsd:null,state:'pending',createdAt:clock(),result:null,resultExpiresAt:0});return {status:'admitted'};
    }),
    recover:q=>locked(d=>exposed(d.requests.find(r=>r.id===q.id&&r.site===q.site&&r.tokenHash===q.tokenHash))),
    finish:q=>locked(d=>{
      const row=d.requests.find(r=>r.id===q.id&&r.site===q.site&&r.tokenHash===q.tokenHash);
      if(!row)throw new VoiceError(404,'request_not_found');
      if(['complete','rejected','failed'].includes(row.state))return {ok:true};
      if(q.chargedMicroUsd!==null&&(!Number.isSafeInteger(q.chargedMicroUsd)||q.chargedMicroUsd<0))throw new Error('Invalid cost');
      Object.assign(row,{state:q.state,chargedMicroUsd:q.chargedMicroUsd,providerId:q.providerId,result:q.result,resultExpiresAt:q.resultExpiresAt,finishedAt:clock()});
      if(q.chargedMicroUsd>row.reservedMicroUsd)d.disabled=true;
      return {ok:true};
    })
  };
}
module.exports={productionStore,fileStore};

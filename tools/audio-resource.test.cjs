'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function environment(behavior = {}) {
  let now = 0, sequence = 0, maxNodes = 0;
  const timers = new Map(), contexts = [], listeners = new Map();
  const later = (callback, delay) => { const id = ++sequence; timers.set(id, {callback,time:now+delay}); return id; };
  const cancel = id => timers.delete(id);
  function liveNodes() { return contexts.reduce((n,c)=>n+c.nodes.filter(node=>!node.disconnected).length,0); }
  class Param {
    constructor(){this.value=0;}
    setValueAtTime(value,time){assert.ok(Number.isFinite(value)&&Number.isFinite(time));this.value=value;}
    linearRampToValueAtTime(value,time){this.setValueAtTime(value,time);}
    exponentialRampToValueAtTime(value,time){assert.ok(value>0);this.setValueAtTime(value,time);}
    cancelAndHoldAtTime(){}
    cancelScheduledValues(){}
  }
  class Node {
    constructor(context){this.context=context;this.disconnected=false;this.gain=new Param();this.frequency=new Param();this.Q=new Param();this.pan=new Param();this.delayTime=new Param();this.threshold=new Param();this.knee=new Param();this.ratio=new Param();this.attack=new Param();this.release=new Param();context.nodes.push(this);maxNodes=Math.max(maxNodes,liveNodes());}
    connect(){this.disconnected=false;return this;}
    disconnect(){this.disconnected=true;}
    start(time){assert.ok(time>=this.context.currentTime-0.00001);this.startAt=time;}
    stop(time=this.context.currentTime){if(this.endTimer)cancel(this.endTimer);this.endTimer=later(()=>this.onended?.(),Math.max(0,(time-this.context.currentTime)*1000));}
  }
  class Context {
    constructor(){this.state='suspended';this.currentTime=0;this.sampleRate=44100;this.nodes=[];this.destination={};this.resumeCalls=0;this.suspendCalls=0;contexts.push(this);}
    createGain(){return new Node(this);}createBiquadFilter(){return new Node(this);}createDynamicsCompressor(){return new Node(this);}createDelay(){return new Node(this);}createStereoPanner(){return new Node(this);}createOscillator(){return new Node(this);}createBufferSource(){return new Node(this);}
    createBuffer(channels,length,rate){return {getChannelData:()=>new Float32Array(length),sampleRate:rate};}
    resume(){this.resumeCalls++;if(behavior.resumeReject)return Promise.reject(new Error('Gesture denied'));if(behavior.resumeHang)return new Promise(()=>{});this.state='running';this.onstatechange?.();return Promise.resolve();}
    suspend(){this.suspendCalls++;if(behavior.suspendReject)return Promise.reject(new Error('Suspend unavailable'));this.state='suspended';this.onstatechange?.();return Promise.resolve();}
    close(){this.state='closed';this.onstatechange?.();return Promise.resolve();}
  }
  const document={hidden:false,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
  const scope={window:{AudioContext:Context},document,Float32Array,Math,Number,Set,Map,Promise,console,setTimeout:later,clearTimeout:cancel};
  const runtime = path.join(__dirname,'../room/room-audio.js');
  vm.runInNewContext(fs.readFileSync(runtime,'utf8'),scope);
  const states=[],audio=scope.window.createRoomAudio({onState:state=>states.push(state)});
  async function flush(){await Promise.resolve();await Promise.resolve();await Promise.resolve();}
  async function advance(ms){
    const end=now+ms;
    while(true){let chosen=null,id=null;for(const [key,item]of timers)if(item.time<=end&&(!chosen||item.time<chosen.time)){chosen=item;id=key;}if(!chosen)break;
      const elapsed=chosen.time-now;contexts.forEach(c=>{if(c.state==='running')c.currentTime+=elapsed/1000;});now=chosen.time;timers.delete(id);chosen.callback();await flush();}
    contexts.forEach(c=>{if(c.state==='running')c.currentTime+=(end-now)/1000;});now=end;await flush();
  }
  return {audio,document,contexts,states,timers,advance,flush,liveNodes,get maxNodes(){return maxNodes;},
    sourceHandlers(){return contexts.reduce((n,c)=>n+c.nodes.filter(node=>typeof node.onended==='function').length,0);},
    visibility(hidden){document.hidden=hidden;listeners.get('visibilitychange')?.();},hasListener(){return listeners.has('visibilitychange');}};
}
(async()=>{
  const result={result:'PASS',scope:'Virtual WebAudio lifecycle/resource tests; this does not render sound or establish audible quality.',checks:[]};
  const e=environment();assert.equal(e.contexts.length,0);assert.equal(e.audio.state.paused,true);assert.equal(e.audio.state.volume,.2);assert.equal(e.audio.state.style,'lofi');
  assert.equal(e.audio.setStyle('other'),false);assert.equal(e.audio.setVolume(NaN),false);e.audio.setVolume(2);assert.equal(e.audio.state.volume,1);e.audio.setVolume(.2);assert.equal(e.contexts.length,0);
  const start=e.audio.play();assert.equal(e.contexts.length,1);assert.equal(e.contexts[0].resumeCalls,1);assert.equal(await start,true);assert.equal(e.audio.state.playing,true);
  await e.advance(180000);assert.ok(e.audio.state.activeVoices<=64);assert.ok(e.maxNodes<180);result.checks.push({test:'180 seconds lo-fi, bounded scheduling and node cleanup',maximumLiveNodes:e.maxNodes,voices:e.audio.state.activeVoices});
  assert.equal(e.sourceHandlers(),e.audio.state.activeVoices);
  e.audio.setStyle('house');await e.advance(180000);assert.equal(e.contexts.length,1);assert.ok(e.audio.state.activeVoices<=64);assert.ok(e.maxNodes<200);result.checks.push({test:'180 seconds house in same context',maximumLiveNodes:e.maxNodes,voices:e.audio.state.activeVoices});
  for(let i=0;i<20;i++)e.audio.setStyle(i%2?'lofi':'house');await e.advance(250);assert.ok(e.liveNodes()<100);result.checks.push({test:'rapid style changes dispose still-silent incoming graphs',liveNodesAfter250ms:e.liveNodes()});
  e.visibility(true);assert.equal(e.audio.state.paused,false);assert.equal(e.audio.state.suspended,true);await e.advance(250);assert.equal(e.audio.state.playing,false);assert.equal(e.contexts[0].state,'suspended');assert.equal(e.liveNodes(),1);
  e.visibility(false);await e.flush();assert.equal(e.audio.state.playing,true);result.checks.push({test:'visibility resumes only prior play intent',result:'PASS'});
  e.visibility(true);e.audio.pause();await e.advance(250);e.visibility(false);await e.flush();assert.equal(e.audio.state.paused,true);assert.equal(e.audio.state.playing,false);assert.equal(e.liveNodes(),1);result.checks.push({test:'explicit pause while hidden prevents resume',result:'PASS'});
  const resumed=e.audio.play();e.audio.pause();await resumed;await e.advance(250);assert.equal(e.audio.state.playing,false);assert.equal(e.audio.state.paused,true);result.checks.push({test:'pause beats pending play',result:'PASS'});
  e.audio.dispose();await e.flush();assert.equal(e.contexts[0].state,'closed');assert.equal(e.liveNodes(),0);assert.equal(e.hasListener(),false);assert.equal(await e.audio.play(),false);result.checks.push({test:'dispose releases graph, listeners and context',result:'PASS'});
  assert.equal(e.sourceHandlers(),0);
  const f=environment({resumeReject:true});assert.equal(await f.audio.play(),false);assert.equal(f.audio.state.status,'error');assert.equal(f.audio.state.paused,true);await f.advance(250);f.audio.dispose();result.checks.push({test:'resume rejection is graceful',result:'PASS'});
  const h=environment({resumeHang:true});const waiting=h.audio.play();await h.advance(4100);assert.equal(await waiting,false);assert.equal(h.audio.state.status,'error');h.audio.dispose();result.checks.push({test:'resume promise bounded to four seconds',result:'PASS'});
  const s=environment({suspendReject:true});await s.audio.play();await s.advance(1000);s.audio.pause();await s.advance(250);assert.equal(s.audio.state.playing,false);assert.equal(s.liveNodes(),1);assert.ok(s.audio.state.error.includes('suspend'));s.audio.dispose();result.checks.push({test:'failed context suspend still disconnects all sound sources',result:'PASS'});
  console.log(JSON.stringify(result,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});

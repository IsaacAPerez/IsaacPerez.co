/* Explicit, one-turn paid integration check. Never runs with the ordinary tests. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const recovery=process.env.VOICE_RECOVERY_FILE?JSON.parse(fs.readFileSync(process.env.VOICE_RECOVERY_FILE,'utf8')):null;
const savedAnswer=process.env.VOICE_ANSWER_WAV?fs.readFileSync(process.env.VOICE_ANSWER_WAV):null;
if(recovery&&savedAnswer)throw new Error('Choose server recovery or a saved WAV replay, not both.');
if(savedAnswer&&(savedAnswer.toString('ascii',0,4)!=='RIFF'||savedAnswer.toString('ascii',8,12)!=='WAVE'))throw new Error('Saved answer must be a WAV file.');
const readOnly=!!(recovery||savedAnswer);
if(recovery&&(!/^[0-9a-f-]{36}$/.test(recovery.requestId)||!/^[A-Za-z0-9_-]{43}$/.test(recovery.requestToken)))throw new Error('Recovery requires a saved private request capability.');
if(!readOnly&&process.env.VOICE_PAID_TEST_APPROVED!=='1')throw new Error('A separate explicit paid-test approval is required. Set VOICE_PAID_TEST_APPROVED=1 only after that approval.');
const origin=new URL(process.env.VOICE_LIVE_ORIGIN||'http://127.0.0.1:8432');
if(!['127.0.0.1','localhost'].includes(origin.hostname)||origin.protocol!=='http:')throw new Error('This harness only targets an explicitly configured loopback preview.');
const fixture=path.resolve(process.env.VOICE_INPUT_WAV||'');
const output=path.resolve(process.env.EVIDENCE_DIR||'');
const root=path.resolve(__dirname,'..'),personal=root.endsWith('/IsaacPerez.co'),site=personal?'personal':'firstunit';
if(!process.env.VOICE_INPUT_WAV||!fs.existsSync(fixture)||!process.env.EVIDENCE_DIR||output.startsWith(root+path.sep))throw new Error('Supply an existing approved WAV and an evidence directory outside the website.');
const wav=fs.readFileSync(fixture);let byteRate=0,dataBytes=0;
assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.toString('ascii',8,12),'WAVE');
for(let at=12;at+8<=wav.length;){const tag=wav.toString('ascii',at,at+4),length=wav.readUInt32LE(at+4);if(tag==='fmt ')byteRate=wav.readUInt32LE(at+16);if(tag==='data')dataBytes=length;at+=8+length+(length%2);}
const seconds=dataBytes/byteRate;
if(!Number.isFinite(seconds)||seconds<.25||seconds>18)throw new Error('Use an approved spoken fixture between .25 and 18 seconds.');
fs.mkdirSync(output,{recursive:true});
let browser,context,page,responseRead,videoStartedAt,result={site,origin:origin.origin,scope:'One actual OpenAI audio request using a synthetic spoken WAV through a fake browser microphone. Browser audio decoding/playback only; not a physical microphone or speaker test.',paidRequests:0},reply=null,capability=null;
result.browserTurnRequests=0;
if(recovery){result.scope='Saved OpenAI answer replay: synthetic browser recording is intercepted and replaced with one read-only recovery request. No new inference. Browser decoding/playback only; not physical microphone or speaker verification.';result.recoveryRequests=0;}
if(savedAnswer){result.scope='Local saved-answer replay: synthetic browser recording and mocked API transport return a previously saved OpenAI WAV. No server recovery or new inference. Browser decoding/playback only; not physical microphone or speaker verification.';result.sourceAudioPath=path.resolve(process.env.VOICE_ANSWER_WAV);result.sourceAudioSha256=require('node:crypto').createHash('sha256').update(savedAnswer).digest('hex');}
(async()=>{
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+fixture]});
  context=await browser.newContext({viewport:{width:390,height:844},permissions:['microphone'],reducedMotion:'reduce',recordVideo:{dir:path.join(output,'browser-video'),size:{width:390,height:844}}});
  await context.addInitScript(()=>{
    window.__voicePlaybackEvidence={playing:[],ended:[]};
    for(const type of ['playing','ended'])document.addEventListener(type,event=>{
      if(!event.target.matches('.voice-audio'))return;
      const audio=event.target;
      window.__voicePlaybackEvidence[type].push({trusted:event.isTrusted,atMs:performance.now(),currentTime:audio.currentTime,duration:audio.duration,ended:audio.ended});
    },true);
  });
  videoStartedAt=Date.now();page=await context.newPage();const errors=[];
  if(savedAnswer)await page.route('**/api/voice',async route=>{
    const request=route.request();
    if(request.method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({available:true,voiceIsCustom:false,maxRecordingSeconds:20,maxTurns:6})});
    assert.equal(request.method(),'POST');const data=request.postDataJSON();assert.equal(data.action,'speak');
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,requestId:process.env.VOICE_SOURCE_REQUEST_ID||data.requestId,audioBase64:savedAnswer.toString('base64'),mimeType:'audio/wav',conversationToken:null})});
  });
  if(recovery)await page.route('**/api/voice',async route=>{
    const request=route.request();
    if(request.method()!=='POST')return route.continue();
    // Never forward a speak request during replay; only the saved capability is sent.
    assert.equal(request.postDataJSON().action,'speak');result.recoveryRequests++;
    const response=await route.fetch({method:'POST',postData:JSON.stringify({action:'recover',...recovery}),maxRedirects:0,maxRetries:0,timeout:65000});
    await route.fulfill({response});
  });
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',request=>{
    if(new URL(request.url()).pathname!=='/api/voice'||request.method()!=='POST')return;
    const data=request.postDataJSON();
    if(data.action==='speak'){
      result.browserTurnRequests++;if(!readOnly)result.paidRequests++;
      capability=recovery||{requestId:data.requestId,requestToken:data.requestToken};result.requestId=capability.requestId;
      if(savedAnswer){capability={requestId:process.env.VOICE_SOURCE_REQUEST_ID||null};result.requestId=capability.requestId;}
      if(!readOnly)fs.writeFileSync(path.join(output,site+'-recovery-private.json'),JSON.stringify(capability),{mode:0o600});
    }
  });
  page.on('response',response=>{
    if(new URL(response.url()).pathname!=='/api/voice'||response.request().method()!=='POST')return;
    result.httpStatus=response.status();
    responseRead=response.json().then(data=>{reply=data;if(typeof data.error==='string'&&/^[a-z_]+$/.test(data.error))result.providerError=data.error;}).catch(()=>{});
  });
  await page.goto(origin.origin+(personal?'/about/':'/'),{waitUntil:'domcontentloaded'});
  await page.locator('.voice-launch').click();
  await page.locator('.voice-speak:not([disabled])').waitFor({timeout:10000});
  assert.equal(await page.locator('.voice-dialog input,.voice-dialog textarea').count(),0);
  await page.screenshot({path:path.join(output,site+'-live-ready.png')});
  await page.locator('.voice-speak').click();await page.locator('[data-state="recording"]').waitFor({state:'attached'});
  await page.waitForTimeout(Math.ceil((seconds+.25)*1000));
  await page.screenshot({path:path.join(output,site+'-live-recording.png')});
  await page.locator('.voice-speak').click();
  await page.waitForFunction(()=>!['recording','processing'].includes(document.querySelector('.voice-assistant').dataset.state),null,{timeout:65000});
  if(responseRead)await responseRead;
  result.uiState=await page.locator('.voice-assistant').getAttribute('data-state');
  assert.equal(result.paidRequests,readOnly?0:1);assert.equal(result.browserTurnRequests,1);assert(reply&&reply.ok&&reply.audioBase64,'The voice response must contain an audio answer');
  if(await page.locator('.voice-play').isVisible())await page.locator('.voice-play').click();
  await page.waitForFunction(()=>{const a=document.querySelector('.voice-audio');return a&&a.currentTime>0;},null,{timeout:10000});
  await page.screenshot({path:path.join(output,site+'-live-speaking.png')});
  assert.deepEqual(errors,[]);
  const audioPath=path.join(output,site+'-live-answer.wav');fs.writeFileSync(audioPath,Buffer.from(reply.audioBase64,'base64'),{mode:0o600});
  result.audioPath=audioPath;result.requestId=capability.requestId;result.browserPlayback=await page.locator('.voice-audio').evaluate(a=>({duration:a.duration,currentTime:a.currentTime,readyState:a.readyState}));
  result.approximatePlaybackStartMs=Math.max(0,Math.round(Date.now()-videoStartedAt-result.browserPlayback.currentTime*1000));
  await page.waitForFunction(()=>window.__voicePlaybackEvidence.ended.length>0,null,{timeout:65000});
  result.browserPlaybackFinished=await page.evaluate(()=>window.__voicePlaybackEvidence.ended[0]);
  assert.equal(result.browserPlaybackFinished.trusted,true);assert.equal(result.browserPlaybackFinished.ended,true);
  assert(result.browserPlaybackFinished.currentTime>=result.browserPlaybackFinished.duration-.05,'Playback must reach the end of the answer');
  await page.waitForFunction(()=>document.querySelector('.voice-assistant').dataset.state==='idle');
  await page.waitForTimeout(750);
  await page.locator('.voice-close').click();assert.equal(await page.locator('.voice-audio').evaluate(a=>a.paused&&!a.getAttribute('src')),true);
  result.passed=true;
})().catch(async error=>{result.passed=false;result.error=error.message;process.exitCode=1;if(page&&!page.isClosed())await page.screenshot({path:path.join(output,site+'-live-failed.png')}).catch(()=>{});}).finally(async()=>{const video=page&&page.video();if(context)await context.close();if(video)await video.saveAs(path.join(output,site+'-live-browser-flow.webm'));if(browser)await browser.close();fs.writeFileSync(path.join(output,site+'-live-browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));});

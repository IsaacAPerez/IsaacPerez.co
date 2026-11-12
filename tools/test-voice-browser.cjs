/* Browser lifecycle test with a fake microphone and synthetic tone response; no API spend. */
'use strict';
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {createServer,root}=require('./voice-ui-preview.cjs');
const personal=root.endsWith('/IsaacPerez.co');
const evidence=process.env.EVIDENCE_DIR || null;
if(evidence) fs.mkdirSync(evidence,{recursive:true});
const wave=Buffer.alloc(44+16000*4);
wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(16000,24);wave.writeUInt32LE(32000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);
for(let i=0;i<32000;i++)wave.writeInt16LE(Math.sin(i/16000*220*Math.PI*2)*1500,44+i*2);
const requests=[]; let mode='normal', pendingResponse, maximumSeconds=20, available=true;
const server=createServer({voiceHandler:async(req,res)=>{
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method==='GET')return res.end(JSON.stringify({available,voiceIsCustom:false,maxRecordingSeconds:maximumSeconds,maxTurns:6}));
  const chunks=[];for await(const chunk of req)chunks.push(chunk);
  const data=JSON.parse(Buffer.concat(chunks));requests.push(data);
  if(mode==='held'&&data.action==='speak'){pendingResponse=res;return;}
  if(mode==='limited'){res.statusCode=429;return res.end(JSON.stringify({error:'rate_limited'}));}
  if(mode==='failed'){res.statusCode=503;return res.end(JSON.stringify({error:'voice_response_unavailable',requestId:data.requestId,final:true}));}
  const result={ok:true,audioBase64:wave.toString('base64'),mimeType:'audio/wav',conversationToken:'synthetic-context',requestId:data.requestId};
  res.end(JSON.stringify(result));
}});
let browser;
(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({channel:process.env.PLAYWRIGHT_CHANNEL||'chrome',headless:true,args:['--use-fake-device-for-media-stream']});
  let checks=0;
  for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
    const context=await browser.newContext({viewport,permissions:['microphone'],reducedMotion:'reduce',...(evidence?{recordVideo:{dir:path.join(evidence,'synthetic-browser-video'),size:viewport}}:{})});
    await context.addInitScript(()=>{window.__voiceTestTracks=[];const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async options=>{const stream=await original(options);window.__voiceTestTracks.push(...stream.getTracks());return stream;};});
    const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+(personal?'/about/':'/'),{waitUntil:'domcontentloaded'});
    await page.locator('.voice-launch').click();
    await page.locator('.voice-speak:not([disabled])').waitFor();
    assert.equal(await page.locator('.voice-dialog input,.voice-dialog textarea').count(),0);checks++;
    assert.equal(await page.locator('.voice-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);checks++;
    assert.equal(await page.locator('.voice-identity').textContent(),'Preview voice');checks++;
    if(evidence)await page.screenshot({path:path.join(evidence,(personal?'personal':'firstunit')+'-'+viewport.width+'-ready.png')});
    if(evidence)await page.waitForTimeout(1200);
    await page.locator('.voice-speak').click();await page.locator('[data-state="recording"]').waitFor({state:'attached'});
    await page.locator('.voice-mute').click();assert.equal(await page.locator('.voice-mute').getAttribute('aria-pressed'),'true');checks++;
    await page.locator('.voice-mute').click();
    await page.waitForTimeout(evidence?1600:700);
    if(evidence)await page.screenshot({path:path.join(evidence,(personal?'personal':'firstunit')+'-'+viewport.width+'-recording.png')});
    await page.locator('.voice-speak').click();await page.locator('[data-state="speaking"]').waitFor({state:'attached'});
    const last=requests.at(-1),wav=Buffer.from(last.audioBase64,'base64');
    assert.equal(last.action,'speak');assert.match(last.requestToken,/^[A-Za-z0-9_-]{43}$/);assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.equal(wav.readUInt16LE(22),1);checks+=5;
    assert.equal(await page.locator('.voice-audio').evaluate(audio=>!!audio.src),true);checks++;
    if(evidence)await page.screenshot({path:path.join(evidence,(personal?'personal':'firstunit')+'-'+viewport.width+'-speaking.png')});
    if(evidence)await page.waitForTimeout(1000);
    await page.locator('.voice-close').click();assert.equal(await page.locator('.voice-dialog').evaluate(dialog=>dialog.open),false);checks++;
    assert.equal(await page.locator('.voice-audio').evaluate(audio=>audio.paused&&!audio.getAttribute('src')),true);checks++;
    assert.equal(await page.locator('.voice-launch').evaluate(el=>el===document.activeElement),true);checks++;
    assert.equal(await page.evaluate(()=>window.__voiceTestTracks.every(track=>track.readyState==='ended')),true);checks++;
    assert.deepEqual(errors,[]);checks++;
    const video=page.video();
    await context.close();
    if(evidence&&video)await video.saveAs(path.join(evidence,(personal?'personal':'firstunit')+'-'+viewport.width+'-synthetic-flow.webm'));
  }
  const ctx=await browser.newContext({permissions:['microphone']});const page=await ctx.newPage();
  await page.goto(origin+(personal?'/about/':'/'));await page.locator('.voice-launch').click();await page.locator('.voice-speak:not([disabled])').waitFor();
  mode='held';await page.locator('.voice-speak').click();await page.locator('[data-state="recording"]').waitFor({state:'attached'});await page.waitForTimeout(700);await page.locator('.voice-speak').click();await page.waitForFunction(()=>document.querySelector('.voice-assistant').dataset.state==='processing');await page.waitForTimeout(200);
  await page.locator('.voice-stop').click();await page.locator('.voice-recover:not([hidden])').waitFor();
  const before=requests.filter(x=>x.action==='speak').length;mode='normal';await page.locator('.voice-recover').click();await page.locator('[data-state="speaking"]').waitFor({state:'attached'});assert.equal(requests.filter(x=>x.action==='speak').length,before);assert.equal(requests.at(-1).action,'recover');checks+=2;
  if(pendingResponse)pendingResponse.end('{}');
  await page.locator('.voice-close').click();
  await ctx.close();
  const denied=await browser.newContext();const p=await denied.newPage();await p.goto(origin+(personal?'/about/':'/'));await p.locator('.voice-launch').click();await p.locator('.voice-speak:not([disabled])').waitFor();await p.locator('.voice-speak').click();await p.getByText('Microphone access is off',{exact:true}).waitFor();checks++;
  await p.locator('.voice-dialog').press('Escape');assert.equal(await p.locator('.voice-dialog').evaluate(d=>d.open),false);checks++;
  await denied.close();
  // A smaller server cap verifies automatic finish without a twenty-second test wait.
  maximumSeconds=1;
  const limited=await browser.newContext({permissions:['microphone']});const q=await limited.newPage();await q.goto(origin+(personal?'/about/':'/'));await q.locator('.voice-launch').click();await q.locator('.voice-speak:not([disabled])').waitFor();await q.locator('.voice-speak').click();await q.locator('[data-state="speaking"]').waitFor({state:'attached'});assert(Buffer.from(requests.at(-1).audioBase64,'base64').length<=44+32000);checks++;
  await q.locator('.voice-close').click();await limited.close();
  mode='failed';
  const failed=await browser.newContext({permissions:['microphone']});const f=await failed.newPage();await f.goto(origin+(personal?'/about/':'/'));await f.locator('.voice-launch').click();await f.locator('.voice-speak:not([disabled])').waitFor();await f.locator('.voice-speak').click();await f.locator('[data-state="failed"]').waitFor({state:'attached'});const failedCount=requests.filter(x=>x.action==='speak').length;assert.equal(await f.locator('.voice-speak').isDisabled(),true);await f.locator('.voice-recover').click();await f.locator('[data-state="failed"]').waitFor({state:'attached'});assert.equal(requests.filter(x=>x.action==='speak').length,failedCount);await f.locator('.voice-close').click();mode='normal';await f.locator('.voice-launch').click();await f.locator('.voice-speak:not([disabled])').waitFor();checks+=3;await failed.close();
  available=false;
  const unavailable=await browser.newContext();const u=await unavailable.newPage();await u.goto(origin+(personal?'/about/':'/'));await u.locator('.voice-launch').click();await u.getByText('Voice is unavailable right now',{exact:true}).waitFor();assert.equal(await u.locator('.voice-speak').isDisabled(),true);checks++;await unavailable.close();
  if(personal){
    available=true;
    const room=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),r=await room.newPage();const roomErrors=[];r.on('pageerror',e=>roomErrors.push(e.message));await r.goto(origin+'/');await r.locator('#enter-room:not([disabled])').waitFor({timeout:45000});await r.locator('.voice-launch').click();await r.locator('.voice-speak:not([disabled])').waitFor();assert.equal(await r.locator('.voice-dialog').evaluate(d=>d.open),true);checks++;
    if(evidence)await r.screenshot({path:path.join(evidence,'personal-room-ready.png')});await r.locator('.voice-close').click();
    await r.locator('#enter-room').click();
    await r.waitForFunction(()=>document.pointerLockElement===document.querySelector('#room-canvas'));
    await r.keyboard.down('w');await r.waitForTimeout(150);
    // Open while the room owns pointer lock and a movement key is still held.
    await r.evaluate(()=>document.querySelector('.voice-launch').click());
    await r.waitForFunction(()=>document.pointerLockElement===null);
    await r.locator('.voice-speak:not([disabled])').waitFor();
    const beforeRoom=await r.evaluate(()=>{window.__roomUses=0;window.addEventListener('room:interact',()=>window.__roomUses++);const s=window.RoomPreview.state;return {position:s.position,yaw:s.yaw,pitch:s.pitch,jumps:s.player.jumps};});
    for(const key of ['a','s','d','ArrowUp','ArrowRight','e'])await r.keyboard.press(key);
    await r.locator('.voice-dialog').dispatchEvent('keydown',{key:' ',bubbles:true});
    await r.mouse.move(700,300);await r.mouse.move(900,400);await r.waitForTimeout(200);
    const afterRoom=await r.evaluate(()=>{const s=window.RoomPreview.state;return {position:s.position,yaw:s.yaw,pitch:s.pitch,jumps:s.player.jumps};});
    assert.deepEqual(afterRoom,beforeRoom);assert.equal(await r.evaluate(()=>window.__roomUses),0);checks+=2;
    await r.locator('.voice-close').click();await r.waitForTimeout(200);
    assert.deepEqual(await r.evaluate(()=>window.RoomPreview.state.position),beforeRoom.position);checks++;
    await r.keyboard.up('w');await r.locator('#ambience-toggle').click();assert.equal(await r.locator('#ambience').isVisible(),true);checks++;
    await r.locator('.voice-launch').click();await r.locator('.voice-speak:not([disabled])').waitFor();await r.keyboard.press('Escape');
    assert.equal(await r.locator('.voice-dialog').evaluate(d=>d.open),false);assert.equal(await r.locator('#ambience').isVisible(),true);checks+=2;
    assert.deepEqual(roomErrors,[]);checks++;await room.close();
    const xml=fs.readFileSync(path.join(root,'sitemap.xml'),'utf8');for(const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)){const response=await fetch(origin+new URL(match[1]).pathname);assert.equal(response.status,200);assert.match(response.headers.get('permissions-policy'),/microphone=\(self\)/);assert.match(response.headers.get('content-security-policy'),/media-src 'self' blob:/);checks+=3;}
  }
  const result={passed:true,checks,scope:'Synthetic browser microphone, mocked voice transport, actual WAV encoder and playback lifecycle. No real API or physical microphone verification.',evidence};
  if(evidence)fs.writeFileSync(path.join(evidence,(personal?'personal':'firstunit')+'-browser-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();server.closeAllConnections();server.close();});

(function () {
  'use strict';

  // Small, local interactions for the existing room. The controller owns every
  // cat movement; this module only chooses a target and supplies optional sound.
  window.createCatPlay = function (options) {
    options = options || {};
    const cats = new Map();
    for (const entry of options.cats || []) {
      const id = entry.id || (entry.state && entry.state.id);
      if (id) cats.set(id, entry.controller || entry);
    }
    const config = options.config || window.ROOM_CONFIG || {};
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const currentRoom = () => {
      const source = typeof options.room === 'function' ? options.room() : options.room;
      return source && source.state ? source.state : source;
    };
    let ball = null, lastAction = null, effectsEnabled = true, context = null, disposed = false;
    let retry = 0, nextBallId = 1;
    const emit = () => { if (typeof options.onState === 'function') options.onState(api.state); };
    const visible = () => !document.hidden && !document.querySelector('dialog[open]') &&
      (!document.getElementById('references') || document.getElementById('references').hidden);
    function audio() {
      if (!effectsEnabled || !visible()) return null;
      try {
        const Constructor = window.AudioContext || window.webkitAudioContext;
        if (!Constructor) return null;
        if (!context || context.state === 'closed') context = new Constructor();
        if (context.state !== 'running' && context.resume) context.resume().catch(() => {});
        return context;
      } catch (_) { return null; }
    }
    function purr() {
      const ctx = audio(); if (!ctx) return;
      const now = ctx.currentTime, duration = 1.65;
      const carrier = ctx.createOscillator(), pulse = ctx.createOscillator();
      const pulseDepth = ctx.createGain(), filter = ctx.createBiquadFilter(), envelope = ctx.createGain();
      carrier.type = 'triangle'; carrier.frequency.value = 89;
      pulse.type = 'sine'; pulse.frequency.value = 23;
      pulseDepth.gain.value = .018;
      filter.type = 'lowpass'; filter.frequency.value = 210;
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.linearRampToValueAtTime(.055, now + .12);
      envelope.gain.setValueAtTime(.055, now + 1.2);
      envelope.gain.linearRampToValueAtTime(0, now + duration);
      pulse.connect(pulseDepth); pulseDepth.connect(envelope.gain);
      carrier.connect(filter); filter.connect(envelope); envelope.connect(ctx.destination);
      carrier.start(now); pulse.start(now);
      carrier.stop(now + duration + .02); pulse.stop(now + duration + .02);
      carrier.onended = () => [carrier,pulse,pulseDepth,filter,envelope].forEach(node => { try { node.disconnect(); } catch (_) {} });
    }
    function softTap() {
      const ctx = audio(); if (!ctx) return;
      const now = ctx.currentTime, tone = ctx.createOscillator(), envelope = ctx.createGain();
      tone.type = 'sine'; tone.frequency.setValueAtTime(390,now);
      tone.frequency.exponentialRampToValueAtTime(235,now+.12);
      envelope.gain.setValueAtTime(.035,now);
      envelope.gain.exponentialRampToValueAtTime(.0001,now+.14);
      tone.connect(envelope); envelope.connect(ctx.destination);
      tone.start(now); tone.stop(now+.15);
      tone.onended = () => { try { tone.disconnect(); envelope.disconnect(); } catch (_) {} };
    }
    function position(source) {
      const p = source || currentRoom() && currentRoom().position;
      return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? p : null;
    }
    function command(id,kind,source) {
      if (disposed) return { accepted:false, reason:'disposed' };
      const cat = cats.get(id), target = position(source);
      if (!cat || !target) return { accepted:false, reason:'unavailable' };
      const response = cat.requestInteraction(kind,target);
      lastAction = { kind,id,accepted:response.accepted,reason:response.reason || null };
      if (response.accepted && kind === 'pet') purr();
      emit();
      return response;
    }
    function safeBallSpot(x,z) {
      const radius=.055;
      for(let i=0;i<16;i++) {
        const px=x+Math.cos(i*Math.PI/8)*radius,pz=z+Math.sin(i*Math.PI/8)*radius;
        if(!(config.bounds || []).some(b=>px>=b.minX && px<=b.maxX && pz>=b.minZ && pz<=b.maxZ))return false;
      }
      for(const b of config.obstacles || []) {
        if((b.minY || 0)>.11 || (b.maxY || 3)<.03)continue;
        const dx=Math.max(b.minX-x,0,x-b.maxX),dz=Math.max(b.minZ-z,0,z-b.maxZ);
        if(Math.hypot(dx,dz)<radius)return false;
      }
      for(const cat of cats.values()) {
        const p=cat.obstacle;
        if(p.loaded && p.y<.16 && Math.hypot(x-p.x,z-p.z)<radius+p.radius+.015)return false;
      }
      return true;
    }
    function offerBall() {
      if(!ball || ball.rolling || ball.catId || ball.wait>12)return false;
      const ranked=[...cats.entries()].filter(([,cat])=>cat.state.loaded)
        .sort((a,b)=>Math.hypot(a[1].state.position.x-ball.x,a[1].state.position.z-ball.z)-
          Math.hypot(b[1].state.position.x-ball.x,b[1].state.position.z-ball.z));
      for(const [id,cat] of ranked) {
        const response=cat.requestInteraction('ball',{x:ball.x,z:ball.z,y:.06});
        if(response.accepted) {
          ball.catId=id;lastAction={kind:'ball',id,accepted:true,reason:null};emit();return true;
        }
      }
      return false;
    }
    function rollBall(source) {
      if(disposed)return {accepted:false,reason:'disposed'};
      if(!visible())return {accepted:false,reason:'paused'};
      const room=currentRoom(), pose=source || room;
      if(!pose || !Number.isFinite(pose.yaw))return {accepted:false,reason:'unavailable'};
      const eye=position(pose.position || pose);
      if(!eye)return {accepted:false,reason:'unavailable'};
      const dx=Math.sin(pose.yaw),dz=-Math.cos(pose.yaw);
      let start=null;
      for(const offset of [.24,.16,.08,0]) {
        const x=eye.x+dx*offset,z=eye.z+dz*offset;
        if(safeBallSpot(x,z)){start={x,z};break;}
      }
      if(!start)return {accepted:false,reason:'out-of-reach'};
      ball={id:nextBallId++,x:start.x,y:.057,z:start.z,vx:dx*2,vz:dz*2,rolling:!preference.matches,visible:true,catId:null,wait:0};
      lastAction={kind:'ball',id:null,accepted:true,reason:null};
      if(preference.matches){ball.vx=0;ball.vz=0;offerBall();}
      softTap();emit();
      return {accepted:true,status:ball.rolling ? 'rolling' : 'settled'};
    }
    function step(dt) {
      if(disposed || !ball || !ball.visible || !visible())return false;
      dt=Math.max(0,Math.min(.05,dt));
      if(preference.matches && ball.rolling){ball.rolling=false;ball.vx=0;ball.vz=0;emit();}
      if(ball.rolling) {
        const nx=ball.x+ball.vx*dt,nz=ball.z+ball.vz*dt;
        if(safeBallSpot(nx,nz)) {ball.x=nx;ball.z=nz;}
        else {ball.vx=0;ball.vz=0;ball.rolling=false;}
        const factor=Math.max(0,1-1.8*dt/Math.max(.05,Math.hypot(ball.vx,ball.vz)));
        ball.vx*=factor;ball.vz*=factor;
        if(Math.hypot(ball.vx,ball.vz)<.07){ball.vx=0;ball.vz=0;ball.rolling=false;}
        if(!ball.rolling){softTap();offerBall();emit();}
        return true;
      }
      if(!ball.catId && ball.wait<12) {
        ball.wait+=dt;retry-=dt;
        if(retry<=0){retry=.5;if(offerBall())return true;}
        if(ball.wait>=12){lastAction={kind:'ball',id:null,accepted:true,reason:'no-cat-available'};emit();}
      }
      return false;
    }
    const api={
      pet(id,source){return command(id,'pet',source);},
      call(id,source){return command(id,'call',source);},
      rollBall,
      step,
      setEffectsEnabled(value){effectsEnabled=!!value;emit();},
      get active(){return !!(ball && ball.visible && visible() && (ball.rolling || (!ball.catId && ball.wait<12)));},
      get state(){return {ball:ball ? {...ball} : null,lastAction:lastAction ? {...lastAction} : null,effectsEnabled};},
      dispose(){disposed=true;ball=null;if(context){context.close().catch(()=>{});context=null;}},
    };
    document.addEventListener('visibilitychange',()=>{if(document.hidden && context && context.state==='running')context.suspend().catch(()=>{});});
    preference.addEventListener('change',()=>{if(preference.matches && ball && ball.rolling){ball.rolling=false;ball.vx=0;ball.vz=0;emit();}});
    return api;
  };
})();

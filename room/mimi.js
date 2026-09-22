(function () {
  'use strict';

  // Each cat moves independently from the room and visitor. Distances are metres.
  // Conservative circles include the tail and gait, protecting props and other cats.
  const reservations = new Map(), waitingForClimb = [];
  window.createCatController = function (options) {
    const emit = options.emit, invalidate = options.invalidate;
    const id = options.id || 'mimi', name = options.name || 'Mimi';
    const peers = options.getPeers || (() => []);
    const behaviors = options.behaviors === false ? null : options.behaviors || window.ROOM_CAT_BEHAVIORS;
    let randomState = ((behaviors && behaviors.seed) || 2435) + [...id].reduce((sum,c)=>sum+c.charCodeAt(0),0);
    const random = () => { randomState = (Math.imul(1664525,randomState)+1013904223) >>> 0; return randomState / 4294967296; };
    const between = range => range[0] + random() * (range[1] - range[0]);
    const nodes = new Map((behaviors && behaviors.nodes || []).map(node => [node.id,{...node,center:node.center.slice()}]));
    let y = 0.026, surfaceId = 'floor', behavior = 'roam', loaf = 0, tuck = 0, pitch = 0;
    let mission = null, yieldPath = null, interaction = null, jump = null, timer = 0, cooldown = 6 + random() * 10, floorStops = 0;
    let modelMin = [-.1,0,-.3], modelMax = [.14,.35,.23], jumps = 0, landings = 0;
    const visits = {}, transitionLog = [], arcCache = new Map();
    const floorY = 0.026;
    const setBehavior = next => {
      if (behavior === next) return;
      behavior = next; transitionLog.push({ behavior, x, y, z, surfaceId });
      if (transitionLog.length > 32) transitionLog.shift();
    };
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const bounds = options.bounds, obstacles = options.obstacles;
    const candidates = options.route || [[2.72, -1.95], [3.15, -1.78], [2.05, -1.55], [1.45, -1.40], [1.65, -1.13], [2.08, -1.59]];
    let loaded = false, userPaused = false, reducedOverride = false, suspended = false, reason = 'loading';
    let x = candidates[0][0], z = candidates[0][1], yaw = 0, radius = 0.43, height = 0.4;
    let points = [], target = 1, rest = 1.1, speed = 0, blend = 0, phase = 0, travelled = 0, stepDelay = 0;
    let lastStatus = '', feet = [], rootHeight = 0.19;
    const paws = [], offsets = [0, 0.5, 0.25, 0.75];
    const anchors = new Float32Array(16), steps = new Float32Array(16);
    const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
    const intentPaused = () => userPaused || (preference.matches && !reducedOverride);
    function blockedReason() {
      if (document.hidden) return 'hidden';
      if (document.querySelector('dialog[open]')) return 'dialog';
      const refs = document.getElementById('references');
      return refs && !refs.hidden ? 'photos' : null;
    }
    function snapshot() {
      return { id, name, loaded, paused: intentPaused(), userPaused, reducedMotion: preference.matches,
        suspended, reason, position: { x, y, z }, yaw, behavior, surfaceId, destination: mission ? mission.goal.id : null,
        loaf, tuck, pitch, airborne: !!jump, jumpProgress: jump ? jump.elapsed / jump.duration : null, jumps, landings, visits: { ...visits }, transitions: transitionLog.slice(), moving: !intentPaused() && !suspended && (speed > 0.005 || blend > 0.05 || !!jump),
        interaction: interaction ? { kind: interaction.kind, status: interaction.status, target: { ...interaction.target }, destination: interaction.destination ? { ...interaction.destination } : null } : null,
        phase, travelled, radius, routeIndex: target, gait: Array.from(steps),
        contacts: paws.map(paw => ({ x: paw.x, z: paw.z, y: (!jump && nodes.get(surfaceId) && nodes.get(surfaceId).kind==='bed' ? supportHeight(paw.x,paw.z) : y) + paw.y, yaw: paw.yaw, planted: !jump && loaf < 0.15 && !paw.flying })) };
    }
    function notify(force) {
      const block = blockedReason(); suspended = !!block;
      if(!mission && (intentPaused() || suspended)) {
        const waiting=waitingForClimb.indexOf(id);if(waiting>=0)waitingForClimb.splice(waiting,1);
      }
      reason = !loaded ? 'loading' : userPaused ? 'user' : intentPaused() ? 'reduced-motion' : block || (behavior === 'roam' ? 'roaming' : behavior);
      const signature = [loaded, intentPaused(), preference.matches, suspended, reason].join('|');
      if (force || signature !== lastStatus) { lastStatus = signature; emit(id + ':state', snapshot()); }
    }
    function canPlace(px, pz) {
      for (let i = 0; i < 24; i++) {
        const bx = px + Math.cos(i * Math.PI / 12) * radius, bz = pz + Math.sin(i * Math.PI / 12) * radius;
        if (!bounds.some(b => bx >= b.minX && bx <= b.maxX && bz >= b.minZ && bz <= b.maxZ)) return false;
      }
      for (const b of obstacles) {
        if ((b.minY || 0) >= height || (b.maxY || 3) < 0.08) continue;
        const dx = Math.max(b.minX - px, 0, px - b.maxX), dz = Math.max(b.minZ - pz, 0, pz - b.maxZ);
        if (Math.hypot(dx, dz) < radius) return false;
      }
      return true;
    }
    function peersClear(px, py, pz, clearance = radius) {
      return peers().every(peer => {
        if (!peer.loaded) return true;
        const overlap = py < (peer.y === undefined ? floorY : peer.y) + (peer.height || .4) && py + height > (peer.y === undefined ? floorY : peer.y);
        if (overlap && Math.hypot(px-peer.x,pz-peer.z) < clearance + peer.radius + .025) return false;
        const landing = peer.reservedLanding;
        if (!landing || Math.abs(py-landing.y)>height) return true;
        const gap=Math.hypot(px-landing.x,pz-landing.z), current=Math.hypot(x-landing.x,z-landing.z), needed=clearance+landing.radius+.025;
        // A cat already inside a newly reserved landing can walk away from it.
        return gap>=needed || (current<needed && gap>=current-.00001);
      });
    }
    function canMove(px, pz) {
      return canPlace(px, pz) && peersClear(px, floorY, pz);
    }
    function clearPath(ax, az, bx, bz) {
      const count = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.035);
      for (let i = 0; i <= count; i++) {
        const f = count ? i / count : 0;
        if (!canMove(ax + (bx - ax) * f, az + (bz - az) * f)) return false;
      }
      return true;
    }
    function nextTarget() {
      for (let i = 1; i <= points.length; i++) {
        const next = (target + i) % points.length, point = points[next];
        if (Math.hypot(point[0] - x, point[1] - z) > 0.15 && clearPath(x, z, point[0], point[1])) {
          target = next; return true;
        }
      }
      return false;
    }
    function supportHeight(px,pz,node=nodes.get(surfaceId)) {
      const grid=behaviors && behaviors.bedHeightGrid;
      if(!node || node.kind!=='bed' || !grid)return node ? node.center[1] : floorY;
      const xs=grid.x_values,zs=grid.z_values;
      const fx=Math.max(0,Math.min(xs.length-1,(px-xs[0])/(xs[1]-xs[0]))),fz=Math.max(0,Math.min(zs.length-1,(pz-zs[0])/(zs[1]-zs[0])));
      const ix=Math.min(xs.length-2,Math.floor(fx)),iz=Math.min(zs.length-2,Math.floor(fz)),a=fx-ix,b=fz-iz,rows=grid.height_rows;
      return (rows[iz][ix]*(1-a)+rows[iz][ix+1]*a)*(1-b)+(rows[iz+1][ix]*(1-a)+rows[iz+1][ix+1]*a)*b;
    }
    function bedRootHeight(px,pz,angle,node) {
      const c=Math.cos(angle),s=Math.sin(angle);
      return Math.min(...feet.map(f=>supportHeight(px+c*f[0]+s*f[2],pz-s*f[0]+c*f[2],node)))-.006;
    }
    function applySupportOffsets() {
      if(jump || !nodes.get(surfaceId) || nodes.get(surfaceId).kind!=='bed')return;
      paws.forEach((paw,i)=>{steps[i*4+1]=supportHeight(paw.x,paw.z)-y+paw.y;});
    }
    function worldFoot(i, px = x, pz = z, angle = yaw) {
      const foot = feet[i], c = Math.cos(angle), s = Math.sin(angle);
      return { x: px + c * foot[0] + s * foot[2], z: pz - s * foot[0] + c * foot[2], yaw: angle };
    }
    function groundNeutral() {
      // Restore the neutral planted stance after a supported landing or rise.
      speed = 0; blend = 0; phase = 0; stepDelay = 0; steps.fill(0); paws.length = 0;
      feet.forEach((_, i) => paws.push({ ...worldFoot(i), y: 0, flying: false, lastPhase: offsets[i] }));
      applySupportOffsets();
    }
    function supportFraction(dx, dz, turn) {
      const supported = fraction => paws.every((paw, i) => {
        if (paw.flying) return true;
        const foot = worldFoot(i, x + dx * fraction, z + dz * fraction, yaw + turn * fraction);
        return Math.hypot(foot.x - paw.x, foot.z - paw.z) <= 0.082;
      });
      if (supported(1)) return 1;
      // Briefly wait for a footfall instead of stretching or dragging a paw.
      let low = 0, high = 1;
      for (let i = 0; i < 7; i++) { const mid = (low + high) / 2; if (supported(mid)) low = mid; else high = mid; }
      return low;
    }
    function updateGait(dt, walking, turnRate) {
      const c = Math.cos(yaw), s = Math.sin(yaw);
      stepDelay = Math.max(0, stepDelay - dt);
      let flying = paws.filter(paw => paw.flying).length;
      let next = -1, priority = -1;
      const phases = paws.map((paw, i) => {
        const p = (phase + offsets[i]) % 1, neutral = worldFoot(i);
        const reach = Math.hypot(neutral.x - paw.x, neutral.z - paw.z);
        paw.requested = walking && !paw.flying && (paw.requested || (paw.lastPhase < 0.64 && p >= 0.64));
        if (walking && !paw.flying && flying < 2 && stepDelay === 0 && (paw.requested || reach > 0.055)) {
          // Give a supporting leg near its reach limit priority over a new beat.
          const score = reach + (paw.requested ? 0.01 : 0);
          if (score > priority) { next = i; priority = score; }
        }
        return p;
      });
      for (let i = 0; i < 4; i++) {
        const paw = paws[i], p = phases[i];
        if (i === next) {
          // Predict one short step; the landing target is then fixed in the room.
          const duration = 0.24, prediction = duration + 0.10, angle = yaw + turnRate * prediction;
          const target = worldFoot(i, x + Math.sin(yaw) * speed * prediction, z + Math.cos(yaw) * speed * prediction, angle);
          paw.from = { x: paw.x, z: paw.z, yaw: paw.yaw }; paw.target = target;
          paw.elapsed = 0; paw.duration = duration; paw.flying = true; paw.requested = false; flying++; stepDelay = 0.13;
        }
        if (paw.flying) {
          // Airborne feet finish landing even when forward motion has stopped.
          paw.elapsed = Math.min(paw.duration, paw.elapsed + dt);
          const t = paw.elapsed / paw.duration, ease = t * t * (3 - 2 * t);
          paw.x = paw.from.x + (paw.target.x - paw.from.x) * ease;
          paw.z = paw.from.z + (paw.target.z - paw.from.z) * ease;
          paw.yaw = paw.from.yaw + wrap(paw.target.yaw - paw.from.yaw) * ease;
          const lift = Math.sin(t * Math.PI);
          paw.y = lift * lift * 0.028;
          if (t === 1) { paw.y = 0; paw.flying = false; flying--; }
        }
        paw.lastPhase = p;
        const dx = paw.x - x, dz = paw.z - z;
        steps[i * 4] = c * dx - s * dz - feet[i][0];
        steps[i * 4 + 1] = paw.y;
        steps[i * 4 + 2] = s * dx + c * dz - feet[i][2];
        steps[i * 4 + 3] = wrap(paw.yaw - yaw);
      }
      applySupportOffsets();
    }
    function nodeFits(node) {
      if(node.allowed && !node.allowed.includes(id))return false;
      if (node.kind === 'floor') return canPlace(node.center[0],node.center[2]);
      const c=Math.cos(node.yaw || 0), s=Math.sin(node.yaw || 0), b=node.bounds;
      if (!b || node.center[1]+height > (node.ceiling || behaviors.ceiling)-.01) return false;
      return feet.every(foot => {
        const px=node.center[0]+c*foot[0]+s*foot[2], pz=node.center[2]-s*foot[0]+c*foot[2];
        return px >= b.minX+.012 && px <= b.maxX-.012 && pz >= b.minZ+.012 && pz <= b.maxZ-.012;
      });
    }
    function volumeClear(px,py,pz,angle,from,to,posture={loaf:0,tuck:0,pitch:0}) {
      // Use the actual model envelope at height, rather than the large floor
      // circle: a tail may overhang a perch, but may not go through a wall.
      const c=Math.cos(angle), s=Math.sin(angle);
      const corners=[];
      for (const lx of [modelMin[0],modelMax[0]]) for (const lz of [modelMin[2],modelMax[2]])
        corners.push([px+c*lx+s*lz,pz-s*lx+c*lz]);
      if (py+height > (behaviors.ceiling || 2.65)-.008 || corners.some(p=>p[0]<.006 || p[0]>3.994 || p[1]<-4.194 || p[1]>-.006)) return false;
      const solids=[...obstacles,...(behaviors.flightObstacles || [])];
      const slices=behaviors.collisionSlices && behaviors.collisionSlices[id] || [{min:modelMin,max:modelMax}];
      for(const slice of slices) {
        const sample=[], localHeights=[];
        const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
        for(const lx of [slice.min[0],slice.max[0]])for(const ly of [slice.min[1],slice.max[1]])for(const lz of [slice.min[2],slice.max[2]]) {
          const leg=1-smooth(.045,.15,ly),fold=Math.max(posture.loaf,posture.tuck);
          const back=Math.min(...feet.map(foot=>foot[2]))-.09,tail=(1-smooth(back-.16,back+.04,lz))*smooth(.10,.22,ly);
          const sx=lx*(1-.35*fold*leg)+posture.loaf*tail*.06,sz=lz*(1-.42*fold*leg);
          const sy=Math.max(.006,ly+Math.max(0,fold-posture.loaf)*.075*leg-posture.loaf*.10*smooth(0,.20,ly));
          const yy=.15+Math.cos(posture.pitch)*(sy-.15)-Math.sin(posture.pitch)*sz;
          const zz=Math.sin(posture.pitch)*(sy-.15)+Math.cos(posture.pitch)*sz;
          sample.push([px+c*sx+s*zz,pz-s*sx+c*zz]);localHeights.push(yy);
        }
        const low=Math.min(...localHeights),high=Math.max(...localHeights);
        const minX=Math.min(...sample.map(p=>p[0])),maxX=Math.max(...sample.map(p=>p[0]));
        const minZ=Math.min(...sample.map(p=>p[1])),maxZ=Math.max(...sample.map(p=>p[1]));
        for (const b of solids) {
          const supporting=[from,to].filter(Boolean).find(node=>node.supportObstacle === b.name && py >= node.center[1]-.014);
          if (supporting || (b.maxY || 3) <= py+low+.002 || (b.minY || 0) >= py+high) continue;
          if (minX < b.maxX && maxX > b.minX && minZ < b.maxZ && maxZ > b.minZ) return false;
        }
      }
      return true;
    }
    function jumpDefinition(from,to) {
      const cacheKey=[from.id,to.id,...from.center].join(',');
      if(arcCache.has(cacheKey)) {const cached=arcCache.get(cacheKey);return cached ? {...cached,elapsed:0} : null;}
      const distance=Math.hypot(to.center[0]-from.center[0],to.center[2]-from.center[2]), rise=to.center[1]-from.center[1];
      if (distance>1.6 || Math.abs(rise)>1.2) return null;
      const startYaw=from.yaw === undefined ? Math.atan2(to.center[0]-from.center[0],to.center[2]-from.center[2]) : from.yaw, endYaw=to.yaw === undefined ? startYaw : to.yaw;
      const edge=behaviors.edges.find(e=>(e.from===from.id && e.to===to.id) || (e.bidirectional!==false && e.to===from.id && e.from===to.id)) || {};
      const reverse=edge.to===from.id;
      const viaTime=edge.viaTime || .5, yawStart=edge.yawStart === undefined ? 0 : edge.yawStart, yawEnd=edge.yawEnd === undefined ? 1 : edge.yawEnd;
      for (const clearance of edge.clearances || [.10,.16,.23,.30]) {
        const h=(Math.abs(rise)+2*clearance+2*Math.sqrt(clearance*(Math.abs(rise)+clearance)))/4;
        const arc={from,to,startYaw,endYaw,h,duration:.52+distance*.22+Math.abs(rise)*.12,elapsed:0,
          waypoints:edge.waypoints ? (reverse ? edge.waypoints.slice().reverse().map(p=>[1-p[0],p[1],p[2]]) : edge.waypoints) : null,
          via:edge.via,viaTime:reverse ? 1-viaTime : viaTime,yawStart:reverse ? 1-yawEnd : yawStart,yawEnd:reverse ? 1-yawStart : yawEnd};
        let valid=true;
        for (let i=0;i<=64;i++) {
          const p=flightPoint(arc,i/64);
          if (!volumeClear(p.x,p.y,p.z,p.yaw,from,to,p)) { valid=false;break; }
        }
        if (valid) {arcCache.set(cacheKey,arc);return {...arc};}
      }
      arcCache.set(cacheKey,null);return null;
    }
    function flightPoint(arc,t) {
      const f=t*t*(3-2*t), a=arc.from.center, b=arc.to.center;
      let px=a[0]+(b[0]-a[0])*f,pz=a[2]+(b[2]-a[2])*f;
      if(arc.waypoints) {
        const points=[[0,a[0],a[2]],...arc.waypoints,[1,b[0],b[2]]];
        const at=Math.max(0,points.findIndex((p,i)=>i<points.length-1 && t<=points[i+1][0]));
        const start=points[at],end=points[at+1],q=(t-start[0])/(end[0]-start[0]),ease=q*q*(3-2*q);
        px=start[1]+(end[1]-start[1])*ease;pz=start[2]+(end[2]-start[2])*ease;
      } else if(arc.via) {
        const before=t<=arc.viaTime,q=before ? t/arc.viaTime : (t-arc.viaTime)/(1-arc.viaTime),ease=q*q*(3-2*q);
        const start=before ? [a[0],a[2]] : arc.via,end=before ? arc.via : [b[0],b[2]];
        px=start[0]+(end[0]-start[0])*ease;pz=start[1]+(end[1]-start[1])*ease;
      }
      const turn=Math.max(0,Math.min(1,(t-arc.yawStart)/Math.max(.001,arc.yawEnd-arc.yawStart))),turnEase=turn*turn*(3-2*turn);
      return {x:px, y:a[1]+(b[1]-a[1])*t+4*arc.h*t*(1-t), z:pz,
        yaw:wrap(arc.startYaw+wrap(arc.endYaw-arc.startYaw)*turnEase),loaf:.65*(1-Math.pow(t,12)),tuck:.22+.62*Math.sin(Math.PI*t),pitch:-Math.sin(Math.PI*t*2)*.06*(1-t)};
    }
    function graphPath(start,goal) {
      const queue=[[start]], seen=new Set([start]);
      while(queue.length) {
        const path=queue.shift(), current=path[path.length-1];
        if(current===goal)return path;
        for(const edge of behaviors.edges || []) {
          const next=edge.from===current ? edge.to : edge.bidirectional!==false && edge.to===current ? edge.from : null;
          if(!next || seen.has(next))continue;
          const a=nodes.get(current),b=nodes.get(next);
          if(!a || !b || !nodeFits(a) || !nodeFits(b))continue;
          // An excursion must have a safe return before reserving its approach.
          if(edge.kind !== 'walk' && (!jumpDefinition(a,b) || !jumpDefinition(b,a)))continue;
          seen.add(next);queue.push([...path,next]);
        }
      }
      return null;
    }
    function floorPath(destination) {
      const vertices=[[x,z],...points,...(behaviors.floorWaypoints || []).filter(p=>canPlace(...p)),destination];
      const costs=vertices.map(()=>Infinity), prior=vertices.map(()=>-1),closed=new Set(); costs[0]=0;
      while(closed.size<vertices.length) {
        let at=-1;
        costs.forEach((cost,i)=>{if(!closed.has(i) && (at<0 || cost<costs[at]))at=i;});
        if(at<0 || !Number.isFinite(costs[at]))return null;
        if(at===vertices.length-1) {
          const path=[];while(at>0){path.unshift(vertices[at]);at=prior[at];}return path;
        }
        closed.add(at);
        for(let i=1;i<vertices.length;i++) {
          if(closed.has(i) || !clearPath(...vertices[at],...vertices[i]))continue;
          const cost=costs[at]+Math.hypot(vertices[i][0]-vertices[at][0],vertices[i][1]-vertices[at][1]);
          if(cost<costs[i]){costs[i]=cost;prior[i]=at;}
        }
      }
      return null;
    }
    function interactionPath(target, kind) {
      // The visitor and ball stay outside the cat's body. Try the near side of
      // each ring first, then use the same obstacle/peer-aware floor graph as roaming.
      const radii=kind==='ball' ? [.29,.42,.58,.75] : [.56,.7,.86,1.02];
      const angle=Math.atan2(x-target.x,z-target.z), choices=[];
      for(const radius of radii)for(let i=0;i<16;i++) {
        const direction=angle+i*Math.PI/8;
        const px=target.x+Math.sin(direction)*radius,pz=target.z+Math.cos(direction)*radius;
        if(!canPlace(px,pz))continue;
        const path=floorPath([px,pz]);if(!path)continue;
        const length=path.reduce((sum,point,index)=>{
          const previous=index ? path[index-1] : [x,z];
          return sum+Math.hypot(point[0]-previous[0],point[1]-previous[1]);
        },0);
        choices.push({path,destination:{x:px,z:pz},score:length+radius*.15});
      }
      choices.sort((a,b)=>a.score-b.score);
      return choices[0] || null;
    }
    function interactionEvent(status) {
      if(!interaction)return;
      interaction.status=status;
      emit(id + ':interaction', snapshot());invalidate();
    }
    function startInteraction() {
      if(!interaction || mission || jump || surfaceId!=='floor' || intentPaused() || suspended)return false;
      const route=interactionPath(interaction.target,interaction.kind);
      if(!route)return false;
      yieldPath=null;
      interaction.path=route.path;
      interaction.destination=route.destination;
      rest=0;loaf=0;speed=0;
      setBehavior(interaction.kind==='ball' ? 'follow-ball' : 'follow-call');
      interactionEvent('approaching');
      return true;
    }
    function finishInteraction() {
      if(!interaction)return;
      interactionEvent('finished');
      interaction=null;
      emit(id + ':interaction', snapshot());invalidate();
      rest=.6;cooldown=Math.max(cooldown,2);
    }
    function startMission() {
      if(!behaviors || !nodes.size)return false;
      const goals=[...nodes.values()].filter(node=>node.kind!=='floor' && node.rest!==false && nodeFits(node));
      const ranked=goals.map(node=>({node,rank:-Math.log(Math.max(random(),.000001))/(node.weights && node.weights[id] || 1)})).sort((a,b)=>a.rank-b.rank);
      for(const {node:goal} of ranked) {
        // The bed is the only approach/return corridor to every narrow perch.
        const group='climbing-route';
        if(reservations.has(group) && reservations.get(group)!==id) {
          if(!waitingForClimb.includes(id))waitingForClimb.push(id);continue;
        }
        if(waitingForClimb.length && waitingForClimb[0]!==id)continue;
        for(const entry of nodes.values()) {
          if(entry.kind!=='floor' || !nodeFits(entry))continue;
          const path=graphPath(entry.id,goal.id), approach=floorPath([entry.center[0],entry.center[2]]);
          if(!path || !approach)continue;
          reservations.set(group,id);
          if(waitingForClimb[0]===id)waitingForClimb.shift();
          mission={goal,group,path,index:0,approach,returning:false,entry,edge:null};
          rest=0;loaf=0;setBehavior('approach');return true;
        }
      }
      // The other cat can pass while this cat waits in the clear side bay.
      if(waitingForClimb[0]===id && !yieldPath) {
        for(const point of behaviors.floorWaypoints || []) {
          if(Math.hypot(x-point[0],z-point[1])<.06)break;
          const path=floorPath(point);if(path){yieldPath=path;rest=0;break;}
        }
      }
      return false;
    }
    function finishMission() {
      if(mission && reservations.get(mission.group)===id)reservations.delete(mission.group);
      mission=null;surfaceId='floor';y=floorY;cooldown=between(behaviors.cooldown || [14,28]);
      rest=1.1;speed=0;setBehavior('roam');nextTarget();
    }
    function beginNextEdge() {
      const nextId=mission.path[mission.index+1];
      if(!nextId) {
        if(mission.returning) { finishMission();return; }
        visits[mission.goal.id]=(visits[mission.goal.id] || 0)+1;
        timer=interaction ? .5 : between(behaviors.surfaceRest || [12,24])*(id==='charlie' && mission.goal.kind==='box' ? 1.4 : 1);
        setBehavior('rest');return;
      }
      const from=nodes.get(mission.path[mission.index]),to=nodes.get(nextId);
      const edge=behaviors.edges.find(e=>(e.from===from.id && e.to===to.id) || (e.bidirectional!==false && e.from===to.id && e.to===from.id));
      mission.edge={from,to,kind:edge.kind || 'jump'};timer=.45;speed=0;setBehavior(edge.kind==='walk' ? 'surface-walk' : 'prepare');
    }
    function arriveNode() {
      mission.index++;const node=nodes.get(mission.path[mission.index]);surfaceId=node.kind==='floor' ? 'floor' : node.id;
      y=node.center[1];timer=.36;setBehavior('settle');groundNeutral();
    }
    function behaviorStep(dt) {
      if(!behaviors)return false;
      cooldown=Math.max(0,cooldown-dt);
      if(interaction && interaction.status==='queued' && !mission && !jump) {
        if(behavior==='floor-rest') {timer=0;setBehavior('rise');return true;}
        if(behavior==='roam' && startInteraction())return true;
        if(behavior==='roam') {
          interaction.wait+=dt;
          if(interaction.wait>15) {interactionEvent('unreachable');interaction=null;emit(id + ':interaction',snapshot());invalidate();}
        }
      }
      if(behavior==='pet') {
        timer-=dt;speed=0;loaf=Math.min(.68,loaf+dt*.7);
        updateGait(dt,false,0);
        if(timer<=0){interactionEvent('settling');setBehavior('rise');}
        return true;
      }
      if(behavior==='greet' || behavior==='investigate') {
        timer-=dt;speed=0;loaf=Math.min(behavior==='greet' ? .65 : .35,loaf+dt*.5);
        updateGait(dt,false,0);
        if(timer<=0){interactionEvent('settling');setBehavior('rise');}
        return true;
      }
      if(behavior==='floor-rest') {
        speed=0;timer-=dt;loaf=Math.min(1,loaf+dt*.8);
        if(timer<=0)setBehavior('rise');return true;
      }
      if(behavior==='rest') {
        timer-=dt;loaf=Math.min(1,loaf+dt*.8);tuck=Math.max(0,tuck-dt*3);pitch=0;
        if(timer<=0)setBehavior('rise');return true;
      }
      if(behavior==='rise') {
        loaf=Math.max(0,loaf-dt*1.1);
        if(loaf===0) {
          groundNeutral();
          if(mission){mission.returning=true;mission.path=mission.path.slice().reverse();mission.index=0;beginNextEdge();}
          else {finishInteraction();setBehavior('roam');rest=.5;}
        }
        return true;
      }
      if(behavior==='settle') {
        tuck=Math.max(0,tuck-dt*2.5);pitch*=Math.max(0,1-dt*10);timer-=dt;
        if(timer<=0)beginNextEdge();return true;
      }
      if(behavior==='prepare') {
        const {from,to}=mission.edge;
        const desired=from.yaw === undefined ? Math.atan2(to.center[0]-x,to.center[2]-z) : from.yaw,delta=wrap(desired-yaw);
        const turn=Math.max(-dt*1.5,Math.min(dt*1.5,delta));
        const fraction=supportFraction(0,0,turn);yaw=wrap(yaw+turn*fraction);
        if(from.kind==='bed')y=bedRootHeight(x,z,yaw,from);
        phase=(phase+Math.abs(turn*fraction)*.14/.16)%1;updateGait(dt,Math.abs(delta)>.025,dt ? turn*fraction/dt : 0);
        if(Math.abs(delta)>.002 || paws.some(p=>p.flying))return true;
        timer-=dt;tuck=Math.max(0,Math.min(.22,(.45-timer)*.8));loaf=Math.max(0,Math.min(.65,(.45-timer)/.45*.65));
        if(timer<=0 && peersClear(to.center[0],to.center[1],to.center[2])) {
          const arc=jumpDefinition({...from,center:[x,y,z],yaw},to);
          if(arc) { jump=arc;jump.startYaw=yaw;jumps++;setBehavior('jump');steps.fill(0);speed=0;blend=0; }
          else { timer=.5; }
        }
        return true;
      }
      if(jump) {
        const before=[x,z];jump.elapsed=Math.min(jump.duration,jump.elapsed+dt);
        const t=jump.elapsed/jump.duration,p=flightPoint(jump,t);
        x=p.x;y=p.y;z=p.z;yaw=p.yaw;travelled+=Math.hypot(x-before[0],z-before[1]);
        tuck=p.tuck;pitch=p.pitch;loaf=p.loaf;
        steps.fill(0);feet.forEach((_,i)=>{paws[i]={...worldFoot(i),y:0,flying:true,lastPhase:offsets[i]};});
        if(t===1){jump=null;landings++;arriveNode();}
        return true;
      }
      if(behavior==='roam' && !mission && !yieldPath && !interaction && waitingForClimb[0]===id &&
        (behaviors.floorWaypoints || []).some(p=>Math.hypot(x-p[0],z-p[1])<.06)) {
        speed=0;updateGait(dt,false,0);
        if(cooldown===0){cooldown=3;startMission();}
        if(!mission)return true;
      }
      if(behavior==='roam' && !interaction && !yieldPath && cooldown===0 && rest>0 && !paws.some(p=>p.flying)) { cooldown=3;startMission(); }
      return false;
    }
    const controller = {
      ready(metadata) {
        if (![metadata.min, metadata.max].every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))) {
          throw new Error(name + '’s mesh bounds are invalid.');
        }
        modelMin = metadata.min.slice(); modelMax = metadata.max.slice();
        height = metadata.max[1] - metadata.min[1];
        // Include the largest horizontal gait/tail deformation in collision tests.
        radius = Math.hypot(Math.max(Math.abs(metadata.min[0]), Math.abs(metadata.max[0])), Math.max(Math.abs(metadata.min[2]), Math.abs(metadata.max[2]))) + 0.09;
        rootHeight = metadata.rootHeight || height * 0.55;
        feet = metadata.feet;
        if (!feet || feet.length !== 4 || !feet.every(v => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite))
          || radius > 0.75 || height < 0.15 || height > 0.8 || Math.abs(metadata.min[1]) > 0.01
          || !Number.isFinite(rootHeight) || rootHeight <= 0.03 || rootHeight > height) {
          throw new Error(name + ' needs a standing cat mesh with four grounded paws at room scale.');
        }
        feet.forEach((foot, i) => {
          const separation = Math.min(...feet.filter((_, j) => i !== j).map(other => Math.hypot(foot[0] - other[0], foot[2] - other[2])));
          if (separation < 0.02) throw new Error(name + '’s four paw anchors need to be distinct.');
          // A planted paw must not inherit the other leg's swing displacement.
          const legRadius = Math.min(metadata.legRadius || 0.075, separation * 0.52);
          anchors.set([foot[0], foot[2], legRadius, rootHeight], i * 4);
        });
        for(const node of nodes.values())if(node.kind==='bed')node.center[1]=bedRootHeight(node.center[0],node.center[2],node.yaw || 0,node);
        points = candidates.filter(point => canPlace(...point));
        if (points.length < 2) throw new Error(name + ' cannot safely fit the clear-floor route.');
        target = points.findIndex(point => canMove(...point));
        if (target < 0) throw new Error(name + ' has no safe starting place.');
        [x, z] = points[target];
        nextTarget();
        loaded = true; groundNeutral(); notify(true); emit(id + ':ready', snapshot()); invalidate();
      },
      toggle() {
        if (!loaded) return;
        if (intentPaused()) { userPaused = false; reducedOverride = preference.matches; }
        else { userPaused = true; }
        notify(true); invalidate();
      },
      requestInteraction(kind,target) {
        if(!loaded)return {accepted:false,reason:'loading'};
        if(intentPaused() || blockedReason())return {accepted:false,reason:'paused'};
        if(interaction)return {accepted:false,reason:'busy'};
        if(!['pet','call','ball'].includes(kind) || !target || !Number.isFinite(target.x) || !Number.isFinite(target.z))
          return {accepted:false,reason:'invalid-target'};
        if(kind==='pet') {
          const proximity=Math.hypot(x-target.x,z-target.z), eye=Number.isFinite(target.y) ? target.y : .3;
          if(proximity>.82 || Math.abs(eye-(y+height*.55))>.68 || jump || !['roam','floor-rest','rest'].includes(behavior))
            return {accepted:false,reason:'come-closer'};
          interaction={kind,target:{x:target.x,z:target.z},status:'petted',destination:null};
          timer=2.3;speed=0;setBehavior('pet');interactionEvent('petted');
          return {accepted:true,status:'petted'};
        }
        // An elevated cat completes its reserved route home before responding.
        // A floor cat only accepts a call with a reachable nearby destination.
        if(!mission && !jump && surfaceId==='floor' && !interactionPath(target,kind))
          return {accepted:false,reason:'out-of-reach'};
        interaction={kind,target:{x:target.x,z:target.z},status:'queued',destination:null,path:null,wait:0};
        if(!mission){
          const waiting=waitingForClimb.indexOf(id);
          if(waiting>=0)waitingForClimb.splice(waiting,1);
          yieldPath=null;
        }
        if(behavior==='rest')timer=Math.min(timer,.5);
        if(behavior==='floor-rest')timer=0;
        interactionEvent('queued');
        return {accepted:true,status:'queued'};
      },
      step(dt) {
        notify(false);
        if (!loaded || intentPaused() || suspended) return false;
        dt = Math.max(0,Math.min(dt, 0.05));
        if(behaviorStep(dt))return true;
        let movement = 0, turn = 0, motionRequested = false;
        if (rest > 0) { rest -= dt; speed = 0; }
        else {
          const activePath=interaction && interaction.path;
          const goal = activePath ? activePath[0] : yieldPath ? yieldPath[0] : mission ? behavior==='approach' ? mission.approach[0] : [mission.edge.to.center[0],mission.edge.to.center[2]] : points[target], dx = goal[0] - x, dz = goal[1] - z, distance = Math.hypot(dx, dz);
          if (distance < (mission || yieldPath || activePath ? 0.004 : 0.035)) {
            if(mission || yieldPath || activePath){
              if(behavior!=='surface-walk' && !canMove(goal[0],goal[1])){speed=0;rest=.2;updateGait(dt,false,0);return true;}
              x=goal[0];z=goal[1];
            }
            speed = 0;
            if(activePath) {
              activePath.shift();
              if(!activePath.length){
                interaction.path=null;timer=interaction.kind==='ball' ? 2.1 : 2.6;
                setBehavior(interaction.kind==='ball' ? 'investigate' : 'greet');
                interactionEvent(interaction.kind==='ball' ? 'investigating' : 'greeting');
              }
            }
            else if(yieldPath) {yieldPath.shift();if(!yieldPath.length){yieldPath=null;rest=1.1;cooldown=0;}}
            else if(mission) {
              if(behavior==='approach') {
                mission.approach.shift();
                if(!mission.approach.length) { surfaceId='floor'; beginNextEdge(); }
              } else if(behavior==='surface-walk') arriveNode();
            } else {
              rest = 1.3 + (target % 3) * 0.55;floorStops++;
              if(behaviors && floorStops%3===0) { timer=between(behaviors.floorRest || [6,13]);setBehavior('floor-rest'); }
              nextTarget();
            }
          } else {
            motionRequested = true;
            const angle = wrap(Math.atan2(dx, dz) - yaw);
            turn = Math.max(-dt * 1.05, Math.min(dt * 1.05, angle));
            const desired = Math.min(0.20, distance * 0.8);
            speed = Math.abs(angle)>.12 ? 0 : speed+(desired-speed)*Math.min(1,dt*6);
            const mx = Math.sin(yaw + turn) * speed * dt, mz = Math.cos(yaw + turn) * speed * dt;
            const fraction = supportFraction(mx, mz, turn), nx = x + mx * fraction, nz = z + mz * fraction;
            turn *= fraction;
            const clear = behavior==='surface-walk' ? volumeClear(nx,y,nz,yaw+turn,mission.edge.from,mission.edge.to) && peersClear(nx,y,nz) : canMove(nx,nz);
            if (clear) { movement = Math.hypot(nx - x, nz - z); x = nx; z = nz; yaw = wrap(yaw + turn);
              if(behavior==='surface-walk') {
                const a=mission.edge.from.center,b=mission.edge.to.center,total=Math.hypot(b[0]-a[0],b[2]-a[2]);
                const progress=total ? Math.max(0,Math.min(1,Math.hypot(x-a[0],z-a[2])/total)) : 1;
                y=bedRootHeight(x,z,yaw,mission.edge.to);
              }
            }
            else {
              speed=0;
              // A blocked forward step must still allow the planted body to turn.
              yaw=wrap(yaw+turn);motionRequested=Math.abs(angle)>.0001;
              if(!motionRequested){
                rest=.4;
                if(activePath || yieldPath || (mission && behavior==='approach')) {
                  const destination=activePath ? [interaction.destination.x,interaction.destination.z] : yieldPath ? yieldPath[yieldPath.length-1] : [mission.entry.center[0],mission.entry.center[2]];
                  const path=floorPath(destination);
                  if(path){if(activePath)interaction.path=path;else if(yieldPath)yieldPath=path;else mission.approach=path;}
                } else if(!mission)nextTarget();
              }
            }
          }
        }
        const walking = motionRequested;
        blend += ((walking ? 1 : 0) - blend) * Math.min(1, dt * 8);
        travelled += movement;
        phase = (phase + (movement + Math.abs(turn) * 0.14) / 0.16) % 1;
        updateGait(dt, walking, dt ? turn / dt : 0);
        return true;
      },
      get state() { notify(false); return snapshot(); },
      get obstacle() { return { loaded, x, y, z, radius, height, surfaceId,
        reservedLanding: jump || behavior==='prepare' ? { x: (jump ? jump.to : mission.edge.to).center[0], y: (jump ? jump.to : mission.edge.to).center[1], z: (jump ? jump.to : mission.edge.to).center[2], radius } : null }; },
      get active() { return loaded && !intentPaused() && !blockedReason(); },
      get pose() { return { x, y, z, yaw, loaf, tuck, pitch, surfaceId, airborne: !!jump, anchors, steps, bob: Math.sin(phase * Math.PI * 4) * 0.0035 * blend,
        tail: Math.sin(phase * Math.PI * 2) * 0.018 * blend, back: Math.min(...feet.map(foot => foot[2])) - 0.09 }; },
      canPlace,
    };
    preference.addEventListener('change', () => { reducedOverride = false; notify(true); invalidate(); });
    document.addEventListener('visibilitychange', () => { notify(true); invalidate(); });
    const observer = new MutationObserver(() => { notify(false); invalidate(); });
    const dialog = document.getElementById('object-dialog'), refs = document.getElementById('references');
    if (dialog) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
    if (refs) observer.observe(refs, { attributes: true, attributeFilter: ['hidden'] });
    return controller;
  };
  window.createMimiController = window.createCatController;
})();

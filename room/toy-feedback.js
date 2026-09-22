(function () {
  'use strict';

  // Quiet, local Web Audio gestures. Room sounds do not load or transmit media.
  const surfaces = {
    floor: { filter: 'bandpass', frequency: 1250, noise: .038, tone: 185, toneGain: .026, duration: .065 },
    rug: { filter: 'lowpass', frequency: 690, noise: .050, tone: 95, toneGain: .007, duration: .105 },
    bed: { filter: 'lowpass', frequency: 470, noise: .048, tone: 105, toneGain: .014, duration: .135 },
    chair: { filter: 'bandpass', frequency: 1950, noise: .027, tone: 270, toneGain: .024, duration: .060 },
    desk: { filter: 'bandpass', frequency: 2200, noise: .030, tone: 310, toneGain: .031, duration: .060 },
  };
  const rug = { minX: 1.015, maxX: 3.385, minZ: -2.22, maxZ: -.72 };
  function surfaceForStep(detail) {
    if (detail && Object.prototype.hasOwnProperty.call(surfaces, detail.support) && detail.support !== 'floor') return detail.support;
    return detail && detail.support === 'floor' && detail.x >= rug.minX && detail.x <= rug.maxX
      && detail.z >= rug.minZ && detail.z <= rug.maxZ ? 'rug' : 'floor';
  }
  function release(node) { try { node.disconnect(); } catch (_) { /* Already released. */ } }

  window.createToyFeedback = function (options) {
    options = options || {};
    const root = options.root || document.getElementById('experience');
    const enter = options.enterButton || document.getElementById('enter-room');
    const motion = options.motionPreference || window.matchMedia('(prefers-reduced-motion: reduce)');
    let context = null, output = null, noise = null, entered = false, muted = false, disposed = false;
    let lastStep = -Infinity, soundCount = 0, lastSurface = null, bounceTimer = null, button = null, row = null;

    function state() {
      return { entered, muted, available: !!(window.AudioContext || window.webkitAudioContext),
        active: !!(entered && !muted && !document.hidden && context && context.state === 'running'),
        contextState: context ? context.state : 'uninitialized', soundCount, lastSurface };
    }
    function updateButton() {
      if (!button) return;
      button.textContent = muted ? 'Off' : 'On';
      button.setAttribute('aria-pressed', String(!muted));
      button.setAttribute('aria-label', muted ? 'Turn room sounds on' : 'Turn room sounds off');
      button.disabled = !(window.AudioContext || window.webkitAudioContext);
    }
    function ensureContext() {
      if (context && context.state !== 'closed') return true;
      const Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) return false;
      try {
        context = new Constructor({ latencyHint: 'interactive' });
        output = context.createGain(); output.gain.value = .34; output.connect(context.destination);
        noise = context.createBuffer(1, Math.ceil(context.sampleRate * .30), context.sampleRate);
        const samples = noise.getChannelData(0); let seed = 70423;
        for (let i = 0; i < samples.length; i++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          samples[i] = seed / 2147483648 - 1;
        }
        return true;
      } catch (_) { context = null; output = null; noise = null; return false; }
    }
    function resume() {
      if (disposed || muted || document.hidden || !entered || !ensureContext()) return;
      if (context.state !== 'running') Promise.resolve(context.resume()).catch(function () { /* User can retry with the room-sounds button. */ });
    }
    function running() { return entered && !disposed && !muted && !document.hidden && context && context.state === 'running'; }
    function envelope(gain, time, duration, level, attack) {
      gain.gain.setValueAtTime(.0001, time);
      gain.gain.linearRampToValueAtTime(level, time + attack);
      gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    }
    function noiseHit(time, duration, level, type, frequency) {
      const source = context.createBufferSource(), filter = context.createBiquadFilter(), gain = context.createGain();
      source.buffer = noise; filter.type = type; filter.frequency.value = frequency; filter.Q.value = .55;
      source.connect(filter); filter.connect(gain); gain.connect(output);
      envelope(gain, time, duration, level, .004);
      source.onended = function () { [source, filter, gain].forEach(release); };
      source.start(time, (soundCount * .031) % .12); source.stop(time + duration + .005);
    }
    function tone(time, duration, level, frequency, type) {
      const source = context.createOscillator(), gain = context.createGain();
      source.type = type || 'sine'; source.frequency.setValueAtTime(frequency, time);
      source.frequency.exponentialRampToValueAtTime(Math.max(30, frequency * .78), time + duration);
      source.connect(gain); gain.connect(output); envelope(gain, time, duration, level, .003);
      source.onended = function () { [source, gain].forEach(release); };
      source.start(time); source.stop(time + duration + .005);
    }
    function step(detail) {
      if (!running()) return false;
      const time = context.currentTime;
      if (time - lastStep < .11) return false;
      const surface = surfaceForStep(detail), spec = surfaces[surface], variation = 1 + Math.sin(soundCount * 2.17) * .06;
      lastStep = time; lastSurface = surface; soundCount++;
      noiseHit(time, spec.duration, spec.noise, spec.filter, spec.frequency * variation);
      if (spec.toneGain) tone(time, spec.duration * .82, spec.toneGain, spec.tone * variation, surface === 'rug' || surface === 'bed' ? 'sine' : 'triangle');
      return true;
    }
    function clearBounce() {
      if (bounceTimer !== null) clearTimeout(bounceTimer);
      bounceTimer = null;
      if (root) root.classList.remove('toy-landing', 'toy-landing-soft');
    }
    function land(detail) {
      if (!entered || disposed || document.hidden) return false;
      clearBounce();
      if (root && !motion.matches) {
        root.classList.add('toy-landing');
        if (detail && (detail.support === 'bed' || detail.support === 'rug')) root.classList.add('toy-landing-soft');
        bounceTimer = setTimeout(clearBounce, 280);
      }
      if (!running()) return true;
      soundCount++;
      const support = surfaceForStep(detail), soft = support === 'bed' || support === 'rug';
      const time = context.currentTime;
      noiseHit(time, soft ? .15 : .09, soft ? .048 : .058, 'lowpass', soft ? 500 : 920);
      tone(time, soft ? .12 : .07, soft ? .018 : .036, soft ? 90 : 145, 'sine');
      return true;
    }
    function jump() {
      if (!running()) return false;
      soundCount++;
      noiseHit(context.currentTime, .10, .025, 'highpass', 1450);
      return true;
    }
    function jingle() {
      if (!running()) return false;
      soundCount++;
      const time = context.currentTime;
      [1190, 1830, 2470].forEach(function (frequency, index) {
        tone(time + index * .048, .23 - index * .025, .012, frequency, 'sine');
      });
      noiseHit(time, .11, .014, 'highpass', 3200);
      return true;
    }
    function setMuted(value) {
      if (disposed) return false;
      muted = !!value; updateButton();
      if (muted) {
        if (output && context && context.state !== 'closed') output.gain.setValueAtTime(0, context.currentTime);
        if (context && context.state === 'running') Promise.resolve(context.suspend()).catch(function () {});
      } else {
        if (output && context && context.state !== 'closed') output.gain.setValueAtTime(.34, context.currentTime);
        resume();
      }
      return true;
    }
    function visibility() {
      if (disposed) return;
      clearBounce();
      if (document.hidden && context && context.state === 'running') Promise.resolve(context.suspend()).catch(function () {});
      else if (!document.hidden && entered && !muted) resume();
    }
    function onEnter() { entered = true; resume(); }
    function onStep(event) { step(event.detail); }
    function onLand(event) { land(event.detail); }
    function onObjectUse(event) { if (event.detail && event.detail.kind === 'keychain') jingle(); }
    if (enter) enter.addEventListener('click', onEnter);
    window.addEventListener('room:footstep', onStep);
    window.addEventListener('room:land', onLand);
    window.addEventListener('room:jump', jump);
    window.addEventListener('room:object-use', onObjectUse);
    document.addEventListener('visibilitychange', visibility);

    const musicSection = options.musicSection || document.querySelector('#ambience section[aria-labelledby="music-title"]');
    if (musicSection) {
      row = document.createElement('div'); row.className = 'toy-sound-row';
      const label = document.createElement('span'); label.textContent = 'Footsteps & objects';
      button = document.createElement('button'); button.type = 'button'; button.className = 'toy-sound-toggle';
      button.addEventListener('click', function () { setMuted(!muted); });
      row.append(label, button); musicSection.append(row); updateButton();
    }
    return { get state() { return state(); }, setMuted, step, land, jingle,
      dispose: function () {
        if (disposed) return;
        disposed = true; clearBounce();
        if (enter) enter.removeEventListener('click', onEnter);
        window.removeEventListener('room:footstep', onStep);
        window.removeEventListener('room:land', onLand);
        window.removeEventListener('room:jump', jump);
        window.removeEventListener('room:object-use', onObjectUse);
        document.removeEventListener('visibilitychange', visibility);
        if (row) row.remove();
        if (context && context.state !== 'closed') Promise.resolve(context.close()).catch(function () {});
        context = null; output = null; noise = null;
      } };
  };
  window.createToyFeedback.surfaceForStep = surfaceForStep;
  if (document.getElementById('experience')) window.roomToyFeedback = window.createToyFeedback();
})();

(function () {
  'use strict';

  // Original instrumental phrases, synthesized locally. Nothing is downloaded.
  var styles = {
    lofi: { bpm: 78, swing: 0.15, tone: 2700, roots: [38, 46, 43, 45],
      chords: [[53, 57, 60, 64], [53, 57, 60, 62], [53, 57, 58, 62], [55, 57, 62, 64]] },
    house: { bpm: 116, swing: 0.025, tone: 4100, roots: [45, 41, 36, 43],
      chords: [[55, 59, 60, 64], [57, 60, 64, 67], [55, 59, 62, 64], [57, 59, 62, 64]] },
  };
  var frequency = function (note) { return 440 * Math.pow(2, (note - 69) / 12); };
  function disconnect(node) { try { node.disconnect(); } catch (_) { /* Already released. */ } }
  function ramp(param, value, now, duration) {
    if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now);
    else { var current = param.value; param.cancelScheduledValues(now); param.setValueAtTime(current, now); }
    param.linearRampToValueAtTime(value, now + duration);
  }
  function makeEngine(context, style, destination, offline) {
    var spec = styles[style], house = style === 'house', voices = new Set(), released = false;
    var mix = context.createGain(), keys = context.createBiquadFilter(), fader = context.createGain();
    var compressor = context.createDynamicsCompressor(), makeup = context.createGain();
    var delay = context.createDelay(2), echoTone = context.createBiquadFilter();
    var feedback = context.createGain(), wet = context.createGain();
    var permanent = [mix, keys, fader, compressor, makeup, delay, echoTone, feedback, wet];
    keys.type = 'lowpass'; keys.frequency.value = spec.tone; keys.Q.value = 0.35;
    compressor.threshold.value = -16; compressor.knee.value = 14; compressor.ratio.value = 3;
    compressor.attack.value = 0.006; compressor.release.value = 0.20;
    makeup.gain.value = 1.25; fader.gain.value = 0;
    delay.delayTime.value = 60 / spec.bpm * 0.75;
    echoTone.type = 'lowpass'; echoTone.frequency.value = 1900;
    feedback.gain.value = 0.19; wet.gain.value = house ? 0.13 : 0.17;
    keys.connect(mix); keys.connect(delay); delay.connect(echoTone); echoTone.connect(feedback);
    feedback.connect(delay); echoTone.connect(wet); wet.connect(mix);
    mix.connect(compressor); compressor.connect(makeup); makeup.connect(fader); fader.connect(destination);

    var noise = context.createBuffer(1, context.sampleRate, context.sampleRate), samples = noise.getChannelData(0), seed = 41723;
    for (var i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      samples[i] = (seed / 4294967296) * 2 - 1;
    }
    function voice(sources, nodes, end) {
      var entry = { sources: sources, nodes: nodes, end: end, released: false };
      function release() {
        if (entry.released) return;
        entry.released = true; nodes.forEach(disconnect); voices.delete(entry);
      }
      sources[0].onended = release;
      sources.forEach(function (source) { source.stop(end); });
      entry.release = release; voices.add(entry);
    }
    function pan(node, value, output) {
      if (!context.createStereoPanner) { node.connect(output); return []; }
      var panner = context.createStereoPanner(); panner.pan.value = value;
      node.connect(panner); panner.connect(output); return [panner];
    }
    function rhodes(note, time, duration, level, position) {
      if (released || (!offline && voices.size >= 64)) return;
      var carrier = context.createOscillator(), modulator = context.createOscillator();
      var modulation = context.createGain(), envelope = context.createGain(), hz = frequency(note);
      carrier.type = 'sine'; carrier.frequency.value = hz;
      modulator.type = 'sine'; modulator.frequency.value = hz * 2;
      modulation.gain.setValueAtTime(hz * 0.85, time);
      modulation.gain.exponentialRampToValueAtTime(hz * 0.035, time + duration * 0.75);
      modulator.connect(modulation); modulation.connect(carrier.frequency); carrier.connect(envelope);
      envelope.gain.setValueAtTime(0, time);
      envelope.gain.linearRampToValueAtTime(level, time + 0.012);
      envelope.gain.exponentialRampToValueAtTime(Math.max(0.0001, level * 0.2), time + duration * 0.65);
      envelope.gain.linearRampToValueAtTime(0, time + duration);
      var extra = pan(envelope, position, keys);
      carrier.start(time); modulator.start(time);
      voice([carrier, modulator], [carrier, modulator, modulation, envelope].concat(extra), time + duration + 0.02);
    }
    function bass(note, time, duration, level) {
      if (released || (!offline && voices.size >= 64)) return;
      var source = context.createOscillator(), filter = context.createBiquadFilter(), envelope = context.createGain();
      source.type = 'triangle'; source.frequency.value = frequency(note);
      filter.type = 'lowpass'; filter.frequency.value = house ? 520 : 350; filter.Q.value = 0.3;
      source.connect(filter); filter.connect(envelope); envelope.connect(mix);
      envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(level, time + 0.018);
      envelope.gain.setValueAtTime(level * 0.72, time + Math.min(0.1, duration * 0.4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.start(time); voice([source], [source, filter, envelope], time + duration + 0.015);
    }
    function kick(time, level) {
      if (released || (!offline && voices.size >= 64)) return;
      var source = context.createOscillator(), envelope = context.createGain();
      source.frequency.setValueAtTime(house ? 145 : 115, time);
      source.frequency.exponentialRampToValueAtTime(house ? 49 : 45, time + 0.10);
      envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(level, time + 0.004);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + (house ? 0.31 : 0.27));
      source.connect(envelope); envelope.connect(mix); source.start(time);
      voice([source], [source, envelope], time + 0.34);
    }
    function noiseHit(time, duration, level, cutoff, kind, position) {
      if (released || (!offline && voices.size >= 64)) return;
      var source = context.createBufferSource(), filter = context.createBiquadFilter(), envelope = context.createGain();
      source.buffer = noise; filter.type = kind; filter.frequency.value = cutoff; filter.Q.value = 0.65;
      source.connect(filter); filter.connect(envelope);
      envelope.gain.setValueAtTime(0, time); envelope.gain.linearRampToValueAtTime(level, time + 0.003);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      var extra = pan(envelope, position, mix);
      source.start(time, (Math.floor(time * 13) % 7) / 10);
      voice([source], [source, filter, envelope].concat(extra), time + duration + 0.015);
    }
    function schedule(index, straightTime) {
      if (released) return;
      var step = index % 16, bar = Math.floor(index / 16), chordIndex = Math.floor(bar / 2) % 4;
      var beat = 60 / spec.bpm, sixteenth = beat / 4;
      var time = straightTime + (step % 2 ? sixteenth * spec.swing : 0);
      var chord = spec.chords[chordIndex], root = spec.roots[chordIndex];
      if (house) {
        if (step % 4 === 0) kick(time, 0.47);
        if (step === 4 || step === 12) noiseHit(time + 0.012, 0.16, 0.085, 1750, 'bandpass', -0.06);
        if (step % 4 === 2) noiseHit(time, step === 14 ? 0.14 : 0.09, 0.028, 6700, 'highpass', 0.28);
        if (step % 4 === 0) noiseHit(time, 0.038, 0.008, 7200, 'highpass', -0.22);
        if (step === 2 || step === 6 || step === 10 || step === 14) bass(root + (step === 14 && bar % 2 ? 7 : 0), time, beat * 0.44, 0.15);
        if (step === 2 || step === 10) chord.forEach(function (note, i) { rhodes(note, time + i * 0.003, beat * 1.1, 0.052, (i - 1.5) * 0.18); });
      } else {
        if (step === 0 || step === 10 || (bar % 4 === 3 && step === 7)) kick(time, step === 7 ? 0.28 : 0.41);
        if (step === 4 || step === 12) noiseHit(time + 0.008, 0.14, 0.082, 1350, 'bandpass', -0.12);
        if (step % 2 === 0 || step === 15) noiseHit(time, 0.05, step % 4 === 0 ? 0.012 : 0.019, 5500, 'highpass', 0.24);
        if (step === 0 || step === 7 || step === 10) bass(root + (step === 7 ? 7 : 0), time, beat * (step === 0 ? 1.4 : 0.7), 0.16);
        if (step === 0 || (bar % 2 === 1 && step === 10)) chord.forEach(function (note, i) { rhodes(note, time + i * 0.009, beat * 2.7, 0.055, (i - 1.5) * 0.16); });
      }
      // A sparse upper voice changes predictably over the eight-bar phrase.
      if ((bar % 2 === 1 && step === 6) || (bar % 4 === 3 && step === 14)) {
        rhodes(chord[(Math.floor(bar / 2) + (step === 14 ? 1 : 3)) % 4] + 12, time, beat * 1.7, house ? 0.019 : 0.025, -0.25);
      }
    }
    return {
      stepDuration: 60 / spec.bpm / 4,
      schedule: schedule,
      fadeIn: function (time) { fader.gain.setValueAtTime(0, time); fader.gain.linearRampToValueAtTime(1, time + 0.35); },
      fadeOut: function (time, duration) { ramp(fader.gain, 0, time, duration); },
      get voiceCount() { return voices.size; },
      dispose: function () {
        if (released) return; released = true;
        Array.from(voices).forEach(function (entry) {
          entry.sources.forEach(function (source) { try { source.stop(); } catch (_) { /* Ended. */ } });
          entry.release();
        });
        permanent.forEach(disconnect);
      },
    };
  }

  window.createRoomAudio = function (options) {
    options = options || {};
    var context = null, output = null, engine = null, timer = null, suspensionTimer = null;
    var desired = false, disposed = false, style = 'lofi', volume = 0.20, status = 'paused', error = null;
    var epoch = 0, stepIndex = 0, nextTime = 0, engineStart = 0, restartAfter = 0, signature = '', retired = new Map();
    function state() {
      return { style: style, volume: volume, paused: !desired, playing: !!(desired && engine && context && context.state === 'running' && !document.hidden),
        suspended: !!(desired && (document.hidden || (context && context.state !== 'running'))), status: status,
        error: error, contextState: context ? context.state : 'uninitialized', activeVoices: engine ? engine.voiceCount : 0 };
    }
    function notify() {
      var snapshot = state(), next = [snapshot.style, snapshot.volume, snapshot.paused, snapshot.playing, snapshot.suspended, snapshot.status, snapshot.error].join('|');
      if (next === signature) return; signature = next;
      if (typeof options.onState === 'function') { try { options.onState(snapshot); } catch (_) { /* UI callbacks must not interrupt audio cleanup. */ } }
    }
    function clearTick() { if (timer !== null) clearTimeout(timer); timer = null; }
    function retire() {
      clearTick();
      if (!engine) return;
      var previous = engine; engine = null;
      var now = context.currentTime;
      // Rapid style changes can replace an incoming, still-silent engine directly.
      if (now < engineStart) { previous.dispose(); return; }
      previous.fadeOut(now, 0.085); restartAfter = Math.max(restartAfter, now + 0.10);
      var cleanup = setTimeout(function () { previous.dispose(); retired.delete(previous); }, 120);
      retired.set(previous, cleanup);
    }
    function tick() {
      timer = null;
      if (!desired || disposed || document.hidden || !engine || context.state !== 'running') return;
      var now = context.currentTime, duration = engine.stepDuration;
      // Never play a burst of missed beats after an expensive render or sleep.
      if (nextTime < now - 0.12) { stepIndex += Math.ceil((now - nextTime) / duration); nextTime = now + 0.035; }
      var count = 0;
      while (nextTime < now + 0.14 && count++ < 8) {
        engine.schedule(stepIndex++, nextTime); nextTime += duration;
      }
      timer = setTimeout(tick, 25);
    }
    function startEngine() {
      if (!desired || disposed || document.hidden || context.state !== 'running') return;
      if (!engine) {
        engine = makeEngine(context, style, output); stepIndex = 0;
        nextTime = Math.max(context.currentTime + 0.04, restartAfter);
        engineStart = nextTime; engine.fadeIn(nextTime);
      }
      status = 'playing'; if (timer === null) tick(); notify();
    }
    function suspendAfterFade() {
      if (suspensionTimer !== null) clearTimeout(suspensionTimer);
      var request = epoch;
      suspensionTimer = setTimeout(function () {
        suspensionTimer = null;
        if (!context || disposed || request !== epoch || (desired && !document.hidden)) return;
        Promise.resolve().then(function () { return context.suspend(); }).catch(function (reason) {
          if (disposed || request !== epoch) return;
          error = 'Audio could not suspend: ' + (reason.message || String(reason)); notify();
        });
      }, 140);
    }
    function ensureContext() {
      if (context && context.state !== 'closed') return;
      if (engine) { engine.dispose(); engine = null; }
      if (output) disconnect(output);
      restartAfter = 0;
      var Constructor = window.AudioContext || window.webkitAudioContext;
      if (!Constructor) throw new Error('This browser does not support room audio.');
      context = new Constructor({ latencyHint: 'playback' });
      output = context.createGain(); output.gain.value = volume; output.connect(context.destination);
      context.onstatechange = function () {
        if (disposed) return;
        if (context.state !== 'running') clearTick();
        else if (!desired || document.hidden) suspendAfterFade();
        if (context.state === 'running' && desired && !document.hidden && engine) {
          status = 'playing'; if (timer === null) tick();
        } else if (desired && context.state !== 'running') status = 'suspended';
        notify();
      };
    }
    function play() {
      if (disposed) return Promise.resolve(false);
      desired = true; error = null; var request = ++epoch;
      if (suspensionTimer !== null) clearTimeout(suspensionTimer); suspensionTimer = null;
      if (document.hidden) { status = 'suspended'; notify(); return Promise.resolve(false); }
      var resumed;
      try {
        ensureContext(); status = 'starting'; notify();
        // Kept synchronous with the caller's click so browser gesture credit is preserved.
        resumed = context.state === 'running' ? Promise.resolve() : context.resume();
      } catch (reason) { resumed = Promise.reject(reason); }
      return new Promise(function (resolve) {
        var settled = false;
        function finish(reason) {
          if (settled) return; settled = true; clearTimeout(deadline);
          if (disposed || request !== epoch || !desired) { resolve(false); return; }
          if (reason) {
            desired = false; error = reason.message || String(reason); status = 'error'; retire(); suspendAfterFade(); notify(); resolve(false);
          } else if (document.hidden) { status = 'suspended'; retire(); suspendAfterFade(); notify(); resolve(false); }
          else {
            try { startEngine(); resolve(true); }
            catch (failure) { desired = false; status = 'error'; error = failure.message || String(failure); retire(); suspendAfterFade(); notify(); resolve(false); }
          }
        }
        var deadline = setTimeout(function () { finish(new Error('Audio did not start. Press Play music to try again.')); }, 4000);
        Promise.resolve(resumed).then(function () { finish(null); }, finish);
      });
    }
    function pause() {
      if (disposed) return;
      desired = false; epoch++; status = 'paused'; error = null; retire(); suspendAfterFade(); notify();
    }
    function visibility() {
      if (!desired || disposed) return;
      if (document.hidden) { epoch++; status = 'suspended'; retire(); suspendAfterFade(); notify(); }
      else play();
    }
    document.addEventListener('visibilitychange', visibility);
    return {
      play: play, pause: pause,
      setStyle: function (value) {
        if (disposed || !Object.prototype.hasOwnProperty.call(styles, value)) return false;
        if (style === value) return true;
        style = value; retire();
        if (desired && context && context.state === 'running' && !document.hidden) startEngine();
        notify(); return true;
      },
      setVolume: function (value) {
        if (disposed || !Number.isFinite(value)) return false;
        volume = Math.max(0, Math.min(1, value));
        if (output && context.state !== 'closed') ramp(output.gain, volume, context.currentTime, 0.075);
        notify(); return true;
      },
      get state() { return state(); },
      dispose: function () {
        if (disposed) return;
        disposed = true; desired = false; epoch++; status = 'disposed'; clearTick();
        if (suspensionTimer !== null) clearTimeout(suspensionTimer);
        document.removeEventListener('visibilitychange', visibility);
        if (engine) { engine.dispose(); engine = null; }
        retired.forEach(function (timeout, previous) { clearTimeout(timeout); previous.dispose(); }); retired.clear();
        if (output) disconnect(output);
        if (context) { context.onstatechange = null; if (context.state !== 'closed') Promise.resolve().then(function () { return context.close(); }).catch(function () {}); }
        notify();
      },
    };
  };

  // Development-only proof uses the exact synthesizer and never plays to speakers.
  window.createRoomAudio.renderOffline = function (options) {
    options = options || {};
    var Constructor = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Constructor) return Promise.reject(new Error('OfflineAudioContext is unavailable.'));
    var style = Object.prototype.hasOwnProperty.call(styles, options.style) ? options.style : 'lofi';
    var seconds = Math.max(4, Math.min(32, Number(options.seconds) || 16));
    var volume = Number.isFinite(options.volume) ? Math.max(0, Math.min(1, options.volume)) : 0.20;
    var context = new Constructor(2, Math.ceil(seconds * 44100), 44100), output = context.createGain();
    output.gain.value = volume; output.connect(context.destination);
    var engine = makeEngine(context, style, output, true); engine.fadeIn(0.03);
    for (var index = 0, time = 0.03; time < seconds - 0.15; index++, time += engine.stepDuration) engine.schedule(index, time);
    engine.fadeOut(seconds - 0.15, 0.14);
    return context.startRendering().then(function (buffer) {
      var peak = 0, square = 0, tailSquare = 0, tailCount = 0, sum = 0, nonFinite = 0, clipped = 0, count = buffer.length * buffer.numberOfChannels;
      for (var channel = 0; channel < buffer.numberOfChannels; channel++) {
        var data = buffer.getChannelData(channel);
        for (var i = 0; i < data.length; i++) {
          var sample = data[i]; if (!Number.isFinite(sample)) { nonFinite++; continue; }
          peak = Math.max(peak, Math.abs(sample)); square += sample * sample; sum += sample;
          if (i >= data.length - 4 * buffer.sampleRate) { tailSquare += sample * sample; tailCount++; }
          if (Math.abs(sample) >= 0.999) clipped++;
        }
      }
      engine.dispose(); disconnect(output);
      return { buffer: buffer, stats: { style: style, seconds: seconds, volume: volume, sampleRate: buffer.sampleRate,
        peak: peak, rms: Math.sqrt(square / count), finalFourSecondsRms: Math.sqrt(tailSquare / tailCount), dc: sum / count, nonFiniteSamples: nonFinite, clippedSamples: clipped } };
    });
  };
})();

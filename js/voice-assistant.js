(function () {
  'use strict';

  var script = document.currentScript;
  var personal = script.dataset.voiceSite === 'personal';
  var workletURL = new URL('./voice-recorder-worklet.js', script.src).href;
  var endpoint = '/api/voice';
  var configuration = null;
  var state = 'idle';
  var generation = 0;
  var recorder = null;
  var requestController = null;
  var conversationToken = null;
  var audioURL = null;
  var durationTimer = null;
  var recordingStarted = 0;
  var muted = false;
  var maximumSeconds = 20;
  var pending = null;

  var microphoneIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/></svg>';
  var root = document.createElement('div');
  root.className = 'voice-assistant ' + (personal ? 'voice-personal' : 'voice-firstunit');
  root.innerHTML = '<button class="voice-launch" type="button" aria-haspopup="dialog">' + microphoneIcon + '<span>' + (personal ? 'Talk about my work' : 'Talk to FIRSTUNIT') + '<small>AI voice guide</small></span></button>' +
    '<dialog class="voice-dialog" aria-labelledby="voice-heading" aria-describedby="voice-description">' +
    '<div class="voice-topline"><span class="voice-eyebrow">' + (personal ? 'Isaac Perez · AI guide' : 'FIRSTUNIT / VOICE') + '</span><button class="voice-close" type="button" aria-label="End conversation and close">×</button></div>' +
    '<div class="voice-intro"><h2 id="voice-heading">' + (personal ? 'Let’s talk.' : 'TALK IT<br>THROUGH.') + '</h2><p id="voice-description">' + (personal ? 'Ask about my experience, work, and the things I make.' : 'Ask about our products, studio work, or a project you have in mind.') + '</p></div>' +
    '<div class="voice-instrument" aria-hidden="true"><div class="voice-wave"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div></div>' +
    '<div class="voice-state"><p class="voice-status" role="status" aria-live="polite">Ready when you are</p><p class="voice-detail">Choose Speak, then allow your microphone.</p></div>' +
    '<div class="voice-controls"><button class="voice-mute" type="button" aria-label="Mute microphone" aria-pressed="false" disabled>' + microphoneIcon + '<span>Mute</span></button><button class="voice-speak" type="button">' + microphoneIcon + '<span>Speak</span></button><button class="voice-stop" type="button" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12"/></svg><span>Stop</span></button></div>' +
    '<button class="voice-play" type="button" hidden>Play answer</button><button class="voice-recover" type="button" hidden>Check for answer</button><p class="voice-disclosure">AI-generated voice · <span class="voice-identity">Preview voice</span></p>' +
    '<p class="voice-privacy">Audio goes to OpenAI when you finish or after 20 seconds. Answers use this website’s public information.</p>' +
    '<a class="voice-contact" href="' + (personal ? 'mailto:iperez2435@gmail.com' : 'mailto:hello@firstunit.io') + '">Contact ' + (personal ? 'Isaac' : 'FIRSTUNIT') + ' <span aria-hidden="true">↗</span></a>' +
    '<audio class="voice-audio" preload="none"></audio></dialog>';
  document.body.appendChild(root);
  var dialog = root.querySelector('dialog');
  var launch = root.querySelector('.voice-launch');
  var speak = root.querySelector('.voice-speak');
  var speakLabel = speak.querySelector('span');
  var mute = root.querySelector('.voice-mute');
  var stop = root.querySelector('.voice-stop');
  var play = root.querySelector('.voice-play');
  var recover = root.querySelector('.voice-recover');
  var audio = root.querySelector('audio');
  var status = root.querySelector('.voice-status');
  var detail = root.querySelector('.voice-detail');

  function setState(next, title, description) {
    state = next;
    root.dataset.state = next;
    status.textContent = title;
    detail.textContent = description || '';
    speakLabel.textContent = next === 'recording' ? 'Finish' : next === 'speaking' ? 'Speak again' : 'Speak';
    speak.disabled = !!pending || ['loading', 'permission', 'processing', 'unavailable', 'failed'].indexOf(next) !== -1;
    recover.hidden = !pending || next === 'processing';
    mute.disabled = next !== 'recording';
    stop.disabled = ['permission', 'recording', 'processing', 'speaking'].indexOf(next) === -1;
    if (next !== 'speaking') play.hidden = true;
  }

  function clearPlayback() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (audioURL) URL.revokeObjectURL(audioURL);
    audioURL = null;
    play.hidden = true;
  }

  function teardownRecorder() {
    clearInterval(durationTimer);
    durationTimer = null;
    if (!recorder) return;
    var old = recorder;
    recorder = null;
    old.stream.getTracks().forEach(function (track) { track.stop(); });
    old.source.disconnect();
    old.node.disconnect();
    old.silent.disconnect();
    old.context.close().catch(function () {});
    muted = false;
    mute.setAttribute('aria-pressed', 'false');
    mute.setAttribute('aria-label', 'Mute microphone');
    mute.querySelector('span').textContent = 'Mute';
  }

  function cancel(title) {
    generation += 1;
    teardownRecorder();
    clearPlayback();
    if (requestController) requestController.abort();
    requestController = null;
    setState('idle', title || 'Conversation ended', 'Choose Speak to start again.');
  }

  async function loadConfiguration() {
    var ticket = generation;
    setState('loading', 'Getting ready', 'Checking voice availability…');
    try {
      var response = await fetch(endpoint, { credentials: 'same-origin', cache: 'no-store' });
      var data = await response.json();
      if (ticket !== generation || !dialog.open) return;
      configuration = data;
      if (!response.ok || !data.available) {
        setState('unavailable', 'Voice is unavailable right now', 'You can still explore the site or get in touch below.');
        return;
      }
      maximumSeconds = Math.min(20, Math.max(1, Number(data.maxRecordingSeconds) || 20));
      root.querySelector('.voice-privacy').textContent = 'Audio goes to OpenAI when you finish or after ' + maximumSeconds + ' seconds. Answers use this website’s public information.';
      root.querySelector('.voice-identity').textContent = data.voiceIsCustom ? 'Isaac’s approved AI voice' : 'Preview voice';
      if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) {
        setState('unavailable', 'This browser can’t use voice here', 'Open this page in a current browser with microphone access.');
        return;
      }
      setState('idle', pending ? 'An answer may be waiting' : 'Ready when you are', pending ? 'Check the previous request before starting another.' : 'Choose Speak, then allow your microphone.');
    } catch (_) {
      if (ticket === generation && dialog.open) setState('unavailable', 'Couldn’t connect to voice', 'Close this window and try again when you’re online.');
    }
  }

  function open() {
    if (dialog.open) return;
    generation += 1;
    conversationToken = null;
    if (document.pointerLockElement) document.exitPointerLock();
    // The room music competes with the microphone. Its existing control owns playback.
    var musicButton = document.querySelector('#music-play[aria-label="Pause music"]');
    if (musicButton) musicButton.click();
    dialog.showModal();
    document.dispatchEvent(new CustomEvent('site-voice-open'));
    loadConfiguration();
  }

  function close() {
    if (state === 'failed') pending = null;
    cancel();
    conversationToken = null;
    dialog.close();
    launch.focus();
  }

  async function beginRecording() {
    if (!configuration || !configuration.available) return;
    clearPlayback();
    var ticket = ++generation;
    setState('permission', 'Getting your microphone', 'You’re in control. Choose Stop to cancel.');
    var stream;
    var context;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (ticket !== generation || !dialog.open) { stream.getTracks().forEach(function (track) { track.stop(); }); return; }
      context = new (window.AudioContext || window.webkitAudioContext)();
      await context.resume();
      if (ticket !== generation || !dialog.open) { stream.getTracks().forEach(function (track) { track.stop(); }); await context.close(); return; }
      var chunks = [];
      var source = context.createMediaStreamSource(stream);
      var silent = context.createGain();
      silent.gain.value = 0;
      var node;
      var flush = function () { return Promise.resolve(); };
      function append(chunk) {
        if (ticket !== generation || state !== 'recording') return;
        chunks.push(chunk);
      }
      if (context.audioWorklet && window.AudioWorkletNode) {
        await context.audioWorklet.addModule(workletURL);
        if (ticket !== generation) { stream.getTracks().forEach(function (track) { track.stop(); }); await context.close(); return; }
        node = new AudioWorkletNode(context, 'site-voice-recorder', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
        var flushed;
        node.port.onmessage = function (event) {
          if (event.data.samples) append(new Float32Array(event.data.samples));
          if (event.data.flushed && flushed) flushed();
        };
        flush = function () { return new Promise(function (resolve) { flushed = resolve; node.port.postMessage({ type: 'flush' }); setTimeout(resolve, 120); }); };
      } else {
        node = context.createScriptProcessor(4096, 1, 1);
        node.onaudioprocess = function (event) { append(new Float32Array(event.inputBuffer.getChannelData(0))); };
      }
      recorder = { stream: stream, context: context, source: source, node: node, silent: silent, chunks: chunks, flush: flush };
      source.connect(node);
      node.connect(silent);
      silent.connect(context.destination);
      recordingStarted = Date.now();
      setState('recording', 'Listening', 'Speak naturally. Choose Finish when you’re done.');
      durationTimer = setInterval(function () {
        var seconds = Math.floor((Date.now() - recordingStarted) / 1000);
        detail.textContent = seconds + 's / ' + maximumSeconds + 's · Choose Finish to send';
        if (seconds >= maximumSeconds) finishRecording();
      }, 200);
      stream.getAudioTracks().forEach(function (track) { track.onended = function () { if (recorder && state === 'recording') cancel('Microphone disconnected'); }; });
    } catch (error) {
      if (stream) stream.getTracks().forEach(function (track) { track.stop(); });
      if (context && context.state !== 'closed') context.close().catch(function () {});
      if (ticket !== generation) return;
      teardownRecorder();
      var denied = error.name === 'NotAllowedError' || error.name === 'SecurityError';
      setState('idle', denied ? 'Microphone access is off' : 'Couldn’t start your microphone', denied ? 'Allow microphone access in your browser, then choose Speak.' : 'Check your microphone and try again.');
    }
  }

  function encodeWav(chunks, rate) {
    var count = chunks.reduce(function (sum, chunk) { return sum + chunk.length; }, 0);
    var source = new Float32Array(count);
    var offset = 0;
    chunks.forEach(function (chunk) { source.set(chunk, offset); offset += chunk.length; });
    var length = Math.min(Math.floor(count * 16000 / rate), maximumSeconds * 16000);
    var buffer = new ArrayBuffer(44 + length * 2);
    var view = new DataView(buffer);
    function word(at, text) { for (var i = 0; i < text.length; i++) view.setUint8(at + i, text.charCodeAt(i)); }
    word(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); word(8, 'WAVE'); word(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 16000, true); view.setUint32(28, 32000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    word(36, 'data'); view.setUint32(40, length * 2, true);
    for (var n = 0; n < length; n++) {
      var position = n * rate / 16000;
      var left = Math.floor(position);
      var fraction = position - left;
      var value = source[left] * (1 - fraction) + (source[left + 1] || 0) * fraction;
      value = Math.max(-1, Math.min(1, value));
      view.setInt16(44 + n * 2, value < 0 ? value * 32768 : value * 32767, true);
    }
    return { buffer: buffer, duration: length / 16000 };
  }

  function base64(buffer) {
    var bytes = new Uint8Array(buffer);
    var value = '';
    for (var i = 0; i < bytes.length; i += 8192) value += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
    return btoa(value);
  }

  async function finishRecording() {
    if (state !== 'recording' || !recorder) return;
    clearInterval(durationTimer);
    var ticket = generation;
    var captured = recorder;
    // Continue receiving the final worklet block until it acknowledges the flush.
    speak.disabled = true;
    await captured.flush();
    if (ticket !== generation || recorder !== captured) return;
    var wav = encodeWav(captured.chunks, captured.context.sampleRate);
    teardownRecorder();
    if (wav.duration < 0.25) { setState('idle', 'That was a little short', 'Choose Speak and try a full question.'); return; }
    await sendRecording(wav.buffer, ticket);
  }

  async function sendRecording(buffer, ticket) {
    var random = crypto.getRandomValues(new Uint8Array(32));
    pending = { requestId: crypto.randomUUID(), requestToken: base64(random.buffer).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
    await submit(Object.assign({ action: 'speak', audioBase64: base64(buffer), conversationToken: conversationToken }, pending), ticket);
  }

  async function submit(body, ticket) {
    setState('processing', body.action === 'recover' ? 'Checking your answer' : 'Thinking it through', 'Your microphone is off. A spoken answer is on its way.');
    var controller = new AbortController();
    requestController = controller;
    var timeout = setTimeout(function () { controller.abort(); }, 60000);
    try {
      var response = await fetch(endpoint, {
        method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      var result = await response.json();
      if (ticket !== generation || !dialog.open) return;
      if (!response.ok || !result.audioBase64) {
        if (result.error === 'voice_response_unavailable') {
          setState('failed', 'The answer couldn’t be played', 'This request finished without playable audio. You can check its status, or close this window to start fresh.');
          return;
        }
        if (result.error === 'request_pending' || result.error === 'outcome_unknown') {
          setState('idle', result.error === 'request_pending' ? 'The answer is still being prepared' : 'The answer’s status is uncertain', 'Check again later. Your question will not be sent twice.');
          return;
        }
        pending = null;
        if (result.error === 'conversation_expired') { conversationToken = null; setState('idle', 'Ready for a fresh conversation', 'Choose Speak and ask your question again.'); }
        else if (result.error === 'voice_allowance_unavailable' || result.error === 'voice_unavailable') setState('unavailable', 'Voice is unavailable right now', 'You can still explore the site or get in touch below.');
        else if (response.status === 429 || response.status === 402) setState('idle', 'Let’s take a short pause', 'Voice has reached its limit for now. Please try later.');
        else setState('idle', 'Couldn’t finish that answer', 'Nothing was sent again automatically. You can try another question.');
        return;
      }
      pending = null;
      conversationToken = result.conversationToken || null;
      var binary = atob(result.audioBase64);
      var bytes = new Uint8Array(binary.length);
      for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      audioURL = URL.createObjectURL(new Blob([bytes], { type: result.mimeType === 'audio/mpeg' ? 'audio/mpeg' : 'audio/wav' }));
      audio.src = audioURL;
      setState('speaking', 'An answer for you', 'You can stop the answer or ask another question.');
      if (document.visibilityState === 'hidden') { play.hidden = false; return; }
      try { await audio.play(); } catch (_) { play.hidden = false; detail.textContent = 'Choose Play answer to enable sound.'; }
    } catch (error) {
      if (ticket === generation && dialog.open) setState('idle', 'The answer didn’t arrive', 'Check for the saved answer. Your question will not be sent twice.');
    } finally {
      clearTimeout(timeout);
      if (requestController === controller) requestController = null;
    }
  }

  launch.addEventListener('click', open);
  root.querySelector('.voice-close').addEventListener('click', close);
  dialog.addEventListener('cancel', function (event) { event.preventDefault(); close(); });
  // Native modal focus does not stop document shortcuts in the room behind it.
  dialog.addEventListener('keydown', function (event) { event.stopPropagation(); });
  dialog.addEventListener('click', function (event) { if (event.target === dialog) { var box = dialog.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) close(); } });
  speak.addEventListener('click', function () { if (state === 'recording') finishRecording(); else beginRecording(); });
  stop.addEventListener('click', function () { cancel('Stopped'); });
  mute.addEventListener('click', function () {
    if (!recorder) return;
    muted = !muted;
    recorder.stream.getAudioTracks().forEach(function (track) { track.enabled = !muted; });
    mute.setAttribute('aria-pressed', String(muted));
    mute.setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
    mute.querySelector('span').textContent = muted ? 'Unmute' : 'Mute';
    status.textContent = muted ? 'Microphone muted' : 'Listening';
  });
  audio.addEventListener('ended', function () { if (state === 'speaking') { clearPlayback(); setState('idle', 'Anything else?', 'Choose Speak to keep the conversation going.'); } });
  audio.addEventListener('error', function () { if (state === 'speaking' && audioURL) { play.hidden = false; detail.textContent = 'Audio could not play. Try Play answer or ask another question.'; } });
  play.addEventListener('click', function () { audio.play().then(function () { play.hidden = true; }).catch(function () { detail.textContent = 'Sound is still blocked. Check this browser’s audio settings.'; }); });
  recover.addEventListener('click', function () { if (pending) submit(Object.assign({ action: 'recover' }, pending), generation); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (state === 'recording' || state === 'permission') cancel('Recording stopped'); else if (state === 'speaking') { audio.pause(); play.hidden = false; } } });
  window.addEventListener('pagehide', function () { cancel(); conversationToken = null; });
}());

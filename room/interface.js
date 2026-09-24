(function () {
  'use strict';
  var main = document.getElementById('experience');
  var enter = document.getElementById('enter-room');
  var status = document.getElementById('loading-status');
  var inspect = document.getElementById('inspect-object');
  var dialog = document.getElementById('object-dialog');
  var ambience = document.getElementById('ambience');
  var ambienceToggle = document.getElementById('ambience-toggle');
  var actionsToggle = document.getElementById('actions-toggle');
  var actionList = document.getElementById('action-list');
  var canvas = document.getElementById('room-canvas');
  var compactQuery = window.matchMedia('(max-width: 760px), (pointer: coarse)');
  var musicPlay = document.getElementById('music-play');
  var musicStatus = document.getElementById('music-status');
  var lightingAvailable = true;
  var lightingStatus = document.createElement('p');
  lightingStatus.id = 'lighting-status';
  lightingStatus.className = 'control-note';
  lightingStatus.setAttribute('role', 'status');
  lightingStatus.hidden = true;
  document.getElementById('lights-title').parentElement.appendChild(lightingStatus);
  var roomAudio = window.createRoomAudio ? window.createRoomAudio({ onState: updateAudio }) : null;
  window.RoomAudio = roomAudio;
  function compactControls() { return compactQuery.matches; }
  function focusLauncher(button) { (compactControls() ? actionsToggle : button).focus({ preventScroll: true }); }
  function setMenuOpen(open, restoreFocus) {
    if (open) releaseMouse();
    main.classList.toggle('menu-open', open);
    actionsToggle.setAttribute('aria-expanded', String(open));
    updateDeskVisibility();
    if (open) {
      var first = actionList.querySelector('button:not([hidden]):not(:disabled)');
      if (first) first.focus({ preventScroll: true });
    } else if (restoreFocus) actionsToggle.focus({ preventScroll: true });
  }
  actionsToggle.addEventListener('click', function () { setMenuOpen(!main.classList.contains('menu-open'), true); });
  compactQuery.addEventListener('change', function () { if (!compactControls()) setMenuOpen(false, false); });
  actionList.addEventListener('click', function (event) { if (event.target.closest('button')) setMenuOpen(false, false); });
  document.addEventListener('pointerdown', function (event) {
    if (main.classList.contains('menu-open') && !event.target.closest('#action-list, #actions-toggle')) setMenuOpen(false, false);
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && main.classList.contains('menu-open')) { event.preventDefault(); setMenuOpen(false, true); }
  });
  window.RoomOverlayUI = { focusLauncher: focusLauncher, closeMenu: function () { setMenuOpen(false, false); }, sync: updateDeskVisibility };
  function updateAudio(state) {
    musicPlay.textContent = state.playing ? 'Pause' : 'Play';
    musicPlay.setAttribute('aria-label', state.playing ? 'Pause music' : 'Play music');
    document.querySelectorAll('[data-music-style]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.musicStyle === state.style)); });
    document.getElementById('music-volume').value = Math.round(state.volume * 100);
    document.getElementById('music-volume-value').textContent = Math.round(state.volume * 100) + '%';
    musicStatus.textContent = state.error ? 'Audio is unavailable. Press Play to try again.' : state.suspended ? 'Music rests while this tab is away.' : state.playing ? 'Original instrumental · ' + (state.style === 'house' ? 'House' : 'Lofi') : 'Music paused.';
  }
  function toggleAmbience(show, restoreFocus) {
    if (show) {
      releaseMouse();
      setMenuOpen(false, false);
    }
    ambience.hidden = !show;
    main.classList.toggle('ambience-open', show);
    ambienceToggle.setAttribute('aria-expanded', String(show));
    updateDeskVisibility();
    if (show) document.getElementById('ambience-close').focus();
    else if (restoreFocus) focusLauncher(ambienceToggle);
  }
  ambienceToggle.addEventListener('click', function () { toggleAmbience(ambience.hidden, true); });
  document.getElementById('ambience-close').addEventListener('click', function () { toggleAmbience(false, true); });
  musicPlay.addEventListener('click', function () { if (roomAudio) { if (roomAudio.state.playing) roomAudio.pause(); else roomAudio.play(); } });
  document.querySelectorAll('[data-music-style]').forEach(function (button) { button.addEventListener('click', function () { if (roomAudio) roomAudio.setStyle(button.dataset.musicStyle); }); });
  document.getElementById('music-volume').addEventListener('input', function (event) { if (roomAudio) roomAudio.setVolume(Number(event.target.value) / 100); });
  function updateLighting(state) {
    document.querySelectorAll('[data-light]').forEach(function (range) {
      var value = Math.round(state[range.dataset.light] * 100); range.value = value;
      document.getElementById(range.id + '-value').textContent = value + '%';
      range.setAttribute('aria-valuetext', value + ' percent');
    });
    document.querySelectorAll('[data-light-preset]').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.lightPreset === state.preset)); });
  }
  function setLightingAvailable(available) {
    lightingAvailable = available;
    document.querySelectorAll('[data-light], [data-light-preset]').forEach(function (control) { control.disabled = !available; });
    lightingStatus.textContent = available ? '' : 'Lighting is unavailable. Reload the page to continue.';
    lightingStatus.hidden = available;
  }
  window.addEventListener('lighting:state', function (event) { updateLighting(event.detail); });
  document.querySelectorAll('[data-light]').forEach(function (range) { range.addEventListener('input', function () {
    if (lightingAvailable && window.RoomPreview) window.RoomPreview.lighting.set({ [range.dataset.light]: Number(range.value) / 100 });
  }); });
  document.querySelectorAll('[data-light-preset]').forEach(function (button) { button.addEventListener('click', function () {
    if (lightingAvailable && window.RoomPreview) window.RoomPreview.lighting.preset(button.dataset.lightPreset);
  }); });
  var nearest = null;
  var deskNear = false;
  var deskState = null;
  var deskControls = document.getElementById('desk-controls');
  var deskRange = document.getElementById('desk-height');
  var deskValue = document.getElementById('desk-height-value');
  var deskStatus = document.getElementById('desk-status');
  var lastFocused = null;
  var storyVersion = 0;
  var portfolioSections = document.getElementById('portfolio-sections');
  var portfolioContact = document.getElementById('portfolio-contact');
  var stories = {
    mimi: { title: 'Meet Mimi.', label: 'Mimi · Resident explorer', body: '<p>Gray and peach markings, a white chest and paws, and a blue collar. Mimi wanders between the rug, bed, and climbing shelves.</p><p>Call her over, or let her settle in for a loaf.</p>' },
    charlie: { title: 'Meet Charlie.', label: 'Charlie · Resident explorer', body: '<p>White and tabby with green eyes and a pink collar. Charlie likes the corner box above the bed.</p><p>Call him over, or watch him explore the cat wall.</p>' },
    film: { title: 'A closer look.', label: 'Higgsfield · Material and motion study', body: '<video class="study-film" controls playsinline muted preload="metadata" poster="/room/media/material-study.jpg" aria-label="Five-second material study of the bedroom"><source src="/room/media/motion-study.mp4" type="video/mp4"><a href="/room/media/motion-study.mp4">Open the film</a></video><p>A short Seedance 2.5 camera study, based on a Higgsfield image of the approved room. It explores texture and lighting; free movement uses the 3D scene behind this panel.</p>' },
    me: { title: 'Me.', label: 'About Isaac', body: '' },
    work: { title: 'Where I’ve been.', label: 'Desk · Experience', body: '' },
    shoes: { title: 'One box, one story.', label: 'Sneaker wall · Collection', body: '<p>Clear cases line the wall in a stepped display, with a color for every mood.</p><p>Wander along the wall to see the collection up close.</p>' },
    hobbies: { title: 'The things around me.', label: 'Window wall · Hobbies', body: '<p>Spider-Man collectibles, puzzles, character figures, and the cats\' climbing shelves.</p><p>Some of the room’s smallest things carry the most personality.</p>' },
    projects: { title: 'The company I founded.', label: 'Workspace · FIRSTUNIT', body: '' },
    bathroom: { title: 'All the way through.', label: 'Bathroom · Connected space', body: '<p>The path continues into the bathroom. Look for the vanity light, mirror, shower curtain, and the hamper kept clear of the entrance.</p>' }
  };
  function releaseMouse() { if (document.pointerLockElement) document.exitPointerLock(); }
  function updateDeskVisibility() {
    var catPanel = document.getElementById('cat-play-panel');
    var photoPanel = document.getElementById('photo-quest');
    var overlayOpen = dialog.open || main.classList.contains('menu-open') || !ambience.hidden
      || (catPanel && !catPanel.hidden) || (photoPanel && !photoPanel.hidden);
    if (canvas.inert !== overlayOpen) canvas.inert = overlayOpen;
    if (canvas.tabIndex !== (overlayOpen ? -1 : 0)) canvas.tabIndex = overlayOpen ? -1 : 0;
    deskControls.hidden = !deskNear || !deskState || !deskState.loaded || !main.classList.contains('entered') || dialog.open || !ambience.hidden
      || main.classList.contains('menu-open') || main.classList.contains('cat-play-open') || main.classList.contains('photo-open');
  }
  function updateDesk(state) {
    if (!state) return;
    deskState = state;
    deskRange.disabled = !state.loaded;
    if (Number.isFinite(state.min)) deskRange.min = state.min;
    if (Number.isFinite(state.max)) deskRange.max = state.max;
    if (Number.isFinite(state.target)) deskRange.value = state.target;
    var cm = Math.round(state.height * 100);
    deskValue.textContent = cm + ' cm';
    deskRange.setAttribute('aria-valuetext', Math.round(state.target * 100) + ' centimetres');
    deskControls.querySelectorAll('[data-desk-height]').forEach(function (button) {
      var value = button.dataset.deskHeight === 'sit' ? state.min : state.max;
      button.disabled = !state.loaded;
      button.setAttribute('aria-pressed', String(Math.abs(state.target - value) < .002));
    });
    var message = state.blocked ? 'Step out from under the desk to lower it.' : state.moving ? 'Adjusting…' : 'Adjust your workspace.';
    if (deskStatus.textContent !== message) deskStatus.textContent = message;
    updateDeskVisibility();
  }
  function setDeskHeight(height) {
    if (!window.RoomPreview || !window.RoomPreview.desk || !Number.isFinite(height)) return;
    window.RoomPreview.desk.setHeight(height);
    updateDesk(window.RoomPreview.desk.state);
  }
  deskRange.addEventListener('input', function () { setDeskHeight(Number(deskRange.value)); });
  deskControls.querySelectorAll('[data-desk-height]').forEach(function (button) {
    button.addEventListener('click', function () { if (deskState) setDeskHeight(button.dataset.deskHeight === 'sit' ? deskState.min : deskState.max); });
  });
  window.addEventListener('desk:state', function (event) { updateDesk(event.detail); });
  window.addEventListener('desk:proximity', function (event) { deskNear = !!event.detail.near; updateDeskVisibility(); });
  function showStory(id) {
    var contactRequested = id === 'contact';
    if (contactRequested) id = 'me';
    var story = stories[id];
    if (!story) return;
    var version = ++storyVersion;
    var portfolio = ['me', 'work', 'projects'].includes(id);
    releaseMouse();
    toggleAmbience(false, false);
    if (!dialog.open) lastFocused = main.classList.contains('menu-open') ? actionsToggle : document.activeElement;
    setMenuOpen(false, false);
    dialog.classList.toggle('film-dialog', id === 'film');
    document.getElementById('object-kicker').textContent = story.label;
    document.getElementById('object-title').textContent = story.title;
    document.getElementById('object-body').innerHTML = story.body;
    portfolioSections.hidden = !portfolio;
    portfolioContact.hidden = true;
    portfolioSections.querySelectorAll('button').forEach(function (button) {
      button.setAttribute('aria-pressed', String(button.dataset.story === id));
    });
    if (!dialog.open) dialog.showModal();
    updateDeskVisibility();
    dialog.scrollTop = 0;
    if (portfolio) {
      var body = document.getElementById('object-body');
      body.textContent = 'Loading…'; body.setAttribute('aria-busy', 'true');
      window.loadRoomPortfolio().then(function (content) {
        if (version !== storyVersion || !dialog.open) return;
        document.getElementById('object-kicker').textContent = content[id].label;
        document.getElementById('object-title').textContent = content[id].title;
        body.replaceChildren(content[id].body.cloneNode(true));
        body.removeAttribute('aria-busy');
        portfolioContact.replaceChildren(content.contact.cloneNode(true));
        portfolioContact.hidden = false;
        if (contactRequested) {
          dialog.scrollTop = dialog.scrollHeight;
          var firstLink = portfolioContact.querySelector('a');
          if (firstLink) firstLink.focus({ preventScroll: true });
        }
      }).catch(function () {
        if (version !== storyVersion || !dialog.open) return;
        body.removeAttribute('aria-busy');
        body.innerHTML = '<p>The details could not load.</p><a href="/about/">Read about Isaac ↗</a>';
      });
    } else document.getElementById('object-body').removeAttribute('aria-busy');
  }
  window.addEventListener('room:ready', function () {
    enter.disabled = false; status.textContent = 'Ready. Your first visit starts at toy height.';
    setLightingAvailable(true);
    if (window.RoomPreview && window.RoomPreview.lighting) updateLighting(window.RoomPreview.lighting.state);
    if (window.RoomPreview && window.RoomPreview.desk) updateDesk(window.RoomPreview.desk.state);
  });
  window.addEventListener('room:error', function (event) {
    status.textContent = event.detail.message; enter.disabled = true;
    setLightingAvailable(false);
    deskNear = false;
    if (deskState) updateDesk(Object.assign({}, deskState, { loaded: false, moving: false }));
    else updateDeskVisibility();
  });
  [{ id: 'mimi', name: 'Mimi' }, { id: 'charlie', name: 'Charlie' }].forEach(function (cat) {
    var toggle = document.getElementById(cat.id + '-toggle');
    var notice = document.getElementById(cat.id + '-notice');
    function update(event) {
      var state = event.detail;
      if (!state || !state.loaded) return;
      toggle.hidden = false;
      toggle.textContent = state.paused ? 'Let ' + cat.name + ' roam' : 'Pause ' + cat.name;
      notice.hidden = true;
    }
    window.addEventListener(cat.id + ':ready', update);
    window.addEventListener(cat.id + ':state', update);
    window.addEventListener(cat.id + ':pending', function () { toggle.hidden = true; notice.hidden = true; });
    window.addEventListener(cat.id + ':error', function () {
      toggle.hidden = true; notice.textContent = cat.name + ' could not load. Reload to try again.'; notice.hidden = false;
    });
    toggle.addEventListener('click', function () {
      if (window.RoomPreview && window.RoomPreview[cat.id]) window.RoomPreview[cat.id].toggle();
    });
  });
  window.addEventListener('room:proximity', function (event) {
    nearest = event.detail.id;
    inspect.hidden = !nearest || !main.classList.contains('entered');
    if (nearest && stories[nearest]) inspect.querySelector('span').textContent = stories[nearest].label.split(' · ')[0];
  });
  window.addEventListener('room:interact', function (event) { if (main.classList.contains('entered') && !dialog.open) showStory(event.detail.id); });
  enter.addEventListener('click', function () { main.classList.add('entered'); if (roomAudio) roomAudio.play(); updateDeskVisibility(); document.getElementById('room-canvas').focus(); });
  document.getElementById('about-isaac').addEventListener('click', function () { showStory('me'); });
  portfolioSections.querySelectorAll('button').forEach(function (button) {
    button.addEventListener('click', function () { showStory(button.dataset.story); });
  });
  inspect.addEventListener('click', function () { showStory(nearest); });
  document.getElementById('object-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('close', function () {
    var video = dialog.querySelector('video');
    if (video) video.pause();
    updateDeskVisibility();
    if (lastFocused) lastFocused.focus();
  });
  document.getElementById('film-toggle').addEventListener('click', function () { showStory('film'); });
  document.addEventListener('keydown', function (event) { if (event.key === 'Escape' && !ambience.hidden) toggleAmbience(false, true); });
  document.querySelectorAll('[data-camera]').forEach(function (button) {
    button.addEventListener('click', function () {
      document.querySelectorAll('[data-camera]').forEach(function (item) { item.setAttribute('aria-pressed', String(item === button)); });
    });
  });
  document.getElementById('reset-view').addEventListener('click', function () {
    document.querySelectorAll('[data-camera]').forEach(function (item) { item.setAttribute('aria-pressed', String(item.dataset.camera === 'toy')); });
  });
  function openLinkedSection() {
    var section = {
      '#about': 'me',
      '#experience': 'work',
      '#work': 'work',
      '#firstunit': 'projects',
      '#contact': 'contact'
    }[location.hash.toLowerCase()];
    if (section) showStory(section);
  }
  window.addEventListener('hashchange', openLinkedSection);
  openLinkedSection();
}());

(function (root) {
  'use strict';

  const SUBJECTS = [
    { id: 'charlie', title: 'Charlie in his corner', short: 'Charlie loafing in his box', hint: 'Wait for Charlie to curl up in his corner box.' },
    { id: 'sneakers', title: 'The sneaker wall', short: 'The sneaker collection', hint: 'Stand near the sneaker cases and face the shoes.' },
    { id: 'desk', title: 'Your desk, your mood', short: 'The workspace', hint: 'Choose a lighting mood, then photograph the desk.' }
  ];

  const staticPoints = {
    charlie: [0.31, 2.24, -3.75],
    sneakers: [1.72, 1.12, -0.48],
    desk: [3.02, 1.34, -3.60]
  };

  function subjectPoint(id, state) {
    if (id === 'charlie') {
      const cat = state && state.charlie;
      return cat && cat.position ? [cat.position.x, cat.position.y + 0.16, cat.position.z] : null;
    }
    return staticPoints[id] ? staticPoints[id].slice() : null;
  }

  function framingAccess(id, state) {
    if (!state || !state.loaded) return { ok: false, reason: 'The room is still loading.' };
    if (state.mode === 'overview') return { ok: false, reason: 'Choose Toy height or Eye level first.' };
    // The framing aid points to Charlie's box even before he arrives there.
    const point = staticPoints[id] ? staticPoints[id].slice() : subjectPoint(id, state);
    if (!point) return { ok: false, reason: 'The subject is not in the room yet.' };
    const position = state.position || {};
    if (![position.x, position.y, position.z].every(Number.isFinite)) return { ok: false, reason: 'The camera is not ready.' };
    // All three moments are inside the bedroom. This also keeps the assist
    // from turning a bathroom view into an impossible through-wall picture.
    if (position.x > 4.72) return { ok: false, reason: 'Step back into the bedroom to frame this shot.' };
    const distance = Math.hypot(position.x - point[0], position.z - point[2]);
    if (distance > (id === 'charlie' ? 3.7 : 3.25)) return { ok: false, reason: 'Move closer to the subject first.' };
    return { ok: true, point, distance };
  }

  function assessShot(id, state, options) {
    options = options || {};
    const access = framingAccess(id, state);
    if (!access.ok) return access;
    if (id === 'charlie') {
      const cat = state.charlie;
      if (!cat || !cat.loaded) return { ok: false, reason: 'Charlie is still loading.' };
      if (cat.surfaceId !== 'corner-box' || cat.behavior !== 'rest' || cat.airborne || cat.loaf < 0.8) {
        return { ok: false, reason: cat.reducedMotion && cat.paused
          ? 'Charlie is resting with reduced motion. Choose “Let Charlie roam” if you want this live shot.'
          : 'Wait for Charlie to loaf in his corner box.' };
      }
    }
    if (id === 'desk' && !options.moodChosen) return { ok: false, reason: 'Choose Day, Warm, Night, or adjust a light first.' };
    if (typeof options.visible !== 'function') return { ok: false, reason: 'Photo visibility is unavailable.' };
    const photoPoint = id === 'charlie' ? subjectPoint(id, state) : access.point;
    let result;
    try { result = options.visible({ id, point: photoPoint, radius: id === 'charlie' ? 0.16 : 0.27 }); }
    catch (error) { return { ok: false, reason: 'The subject could not be checked. Try again.' }; }
    if (!result || result.visible !== true) return { ok: false, reason: result && result.reason || 'Turn toward the subject so it appears in the photo.' };
    return { ok: true, point: photoPoint, distance: access.distance,
      mood: id === 'desk' ? moodName(state.lighting) : null };
  }

  function moodName(lighting) {
    const preset = lighting && lighting.preset;
    return preset === 'day' ? 'Day' : preset === 'warm' ? 'Warm' : preset === 'night' ? 'Night' : 'Custom light';
  }

  function photoCanvas(source, documentRef, options) {
    options = options || {};
    if (!source || !Number.isFinite(source.width) || !Number.isFinite(source.height) || source.width < 2 || source.height < 2) {
      throw new Error('The room did not return a frame. Try again.');
    }
    const output = documentRef.createElement('canvas');
    output.width = 960; output.height = 540;
    const context = output.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the photo.');
    context.fillStyle = '#e9e3d8'; context.fillRect(0, 0, output.width, output.height);
    const scale = Math.min(output.width / source.width, output.height / source.height);
    const width = source.width * scale, height = source.height * scale;
    const x = (output.width - width) / 2, y = (output.height - height) / 2;
    const zoom = Number.isFinite(options.zoom) ? Math.max(1, Math.min(2, options.zoom)) : 1;
    if (zoom > 1) {
      const cropWidth = source.width / zoom, cropHeight = source.height / zoom;
      context.drawImage(source, (source.width - cropWidth) / 2, (source.height - cropHeight) / 2,
        cropWidth, cropHeight, x, y, width, height);
    } else context.drawImage(source, x, y, width, height);
    return output;
  }

  function imageFromData(url, ImageType) {
    return new Promise(function (resolve, reject) {
      const image = new ImageType();
      image.onload = function () { resolve(image); };
      image.onerror = function () { reject(new Error('One photo could not be opened for the postcard.')); };
      image.src = url;
    });
  }

  async function postcardCanvas(shots, documentRef, ImageType) {
    for (const subject of SUBJECTS) {
      if (!shots[subject.id] || !shots[subject.id].dataUrl) throw new Error('Take all three photos before making the postcard.');
    }
    const images = await Promise.all(SUBJECTS.map(subject => imageFromData(shots[subject.id].dataUrl, ImageType)));
    const card = documentRef.createElement('canvas'); card.width = 1600; card.height = 900;
    const context = card.getContext('2d');
    if (!context) throw new Error('The browser could not draw the postcard.');
    context.fillStyle = '#f7f4ee'; context.fillRect(0, 0, 1600, 900);
    context.fillStyle = '#16191b'; context.font = '600 26px system-ui, sans-serif';
    context.fillText('ISAAC’S ROOM', 55, 70);
    context.font = '600 64px system-ui, sans-serif'; context.fillText('A tiny visit.', 55, 150);
    context.fillStyle = '#62615e'; context.font = '24px system-ui, sans-serif';
    context.fillText('Three little moments from a very real room.', 57, 192);
    SUBJECTS.forEach(function (subject, index) {
      const x = 55 + index * 512, y = 235;
      context.fillStyle = '#e6dfd3'; context.fillRect(x, y, 480, 345);
      context.drawImage(images[index], x, y, 480, 270);
      context.fillStyle = '#16191b'; context.font = '600 25px system-ui, sans-serif';
      context.fillText(String(index + 1).padStart(2, '0') + '  ' + subject.title, x + 18, y + 312);
    });
    context.fillStyle = '#16191b'; context.font = '600 30px system-ui, sans-serif';
    context.fillText('I visited Isaac’s room.', 57, 705);
    context.fillStyle = '#62615e'; context.font = '23px system-ui, sans-serif';
    context.fillText('Workspace light: ' + (shots.desk.mood || 'Custom light'), 57, 750);
    context.fillText('isaacperez.co', 57, 844);
    context.textAlign = 'right'; context.fillText('Mimi & Charlie live here  ✳', 1543, 844);
    return card;
  }

  function createRoomPhotoSafari(options) {
    options = options || {};
    const doc = options.document || root.document;
    if (!doc) return null;
    const main = doc.getElementById('experience');
    if (!main) return null;
    const getRoom = options.getRoom || function () { return root.RoomPreview; };
    const shots = Object.create(null);
    let moodChosen = false, open = false, graphicsAvailable = true, timer = 0, downloadableUrl = null;

    const toggle = doc.createElement('button');
    toggle.id = 'photo-quest-toggle'; toggle.className = 'round-button photo-quest-toggle';
    toggle.textContent = 'Photo adventure'; toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'photo-quest'); toggle.hidden = true;
    (doc.getElementById('action-list') || main).appendChild(toggle);

    const panel = doc.createElement('aside'); panel.id = 'photo-quest'; panel.className = 'photo-quest';
    panel.setAttribute('aria-labelledby', 'photo-quest-title'); panel.hidden = true;
    panel.innerHTML = '<div class="panel-heading"><div><p class="eyebrow">Optional little adventure</p><h2 id="photo-quest-title">Three room photos.</h2></div><button id="photo-quest-close" aria-label="Close photo adventure">×</button></div>'
      + '<p class="photo-quest-intro">Find three moments in Isaac’s room. Each photo uses the live 3D view.</p>'
      + '<p class="photo-progress" id="photo-progress">0 of 3 photos taken</p>'
      + '<ol class="photo-missions">' + SUBJECTS.map(function (subject) {
        return '<li data-photo-mission="' + subject.id + '"><div class="photo-mission-heading"><h3>' + subject.title + '</h3><span class="photo-check" aria-hidden="true"></span></div>'
          + '<p class="photo-hint">' + subject.hint + '</p><p class="photo-readiness"></p>'
          + '<div class="photo-mission-actions"><button type="button" data-photo-frame="' + subject.id + '">Frame subject</button><button type="button" data-photo-take="' + subject.id + '">Take photo</button></div>'
          + '<img class="photo-thumb" alt="" hidden></li>';
      }).join('') + '</ol>'
      + '<p class="photo-feedback" id="photo-feedback" role="status" aria-live="polite"></p>'
      + '<button class="photo-postcard-button" id="photo-postcard-button" type="button" disabled>Make my postcard</button>'
      + '<a class="photo-download" id="photo-download" download="isaacs-room-postcard.jpg" hidden>Save postcard image</a>'
      + '<p class="photo-footnote">You can explore freely and read <a href="/about/">more about Isaac</a> at any time.</p>';
    main.appendChild(panel);

    const progress = panel.querySelector('#photo-progress');
    const feedback = panel.querySelector('#photo-feedback');
    const postcardButton = panel.querySelector('#photo-postcard-button');
    const downloadLink = panel.querySelector('#photo-download');

    function roomState() { const room = getRoom(); return room && room.state; }
    function visible(target) { const room = getRoom(); return room && room.photoVisible && room.photoVisible(target); }
    function getAssessment(id) {
      if (!graphicsAvailable) return { ok: false, reason: 'The room graphics stopped. Reload the page to take photos.' };
      return assessShot(id, roomState(), { moodChosen, visible });
    }
    function refresh() {
      const count = SUBJECTS.filter(subject => shots[subject.id]).length;
      progress.textContent = count + ' of 3 photos taken';
      postcardButton.disabled = count !== SUBJECTS.length;
      SUBJECTS.forEach(function (subject) {
        const item = panel.querySelector('[data-photo-mission="' + subject.id + '"]');
        const ready = getAssessment(subject.id);
        item.querySelector('.photo-check').textContent = shots[subject.id] ? '✓' : '';
        item.querySelector('.photo-readiness').textContent = shots[subject.id] ? 'Captured. You can retake it.' : ready.ok ? 'Ready to photograph.' : ready.reason;
        item.querySelector('[data-photo-take]').textContent = shots[subject.id] ? 'Retake photo' : 'Take photo';
        item.querySelector('[data-photo-frame]').disabled = !graphicsAvailable || !framingAccess(subject.id, roomState()).ok;
      });
    }
    function setOpen(value, restoreFocus) {
      if (value && !main.classList.contains('entered')) return;
      if (value) {
        if (doc.pointerLockElement && doc.exitPointerLock) doc.exitPointerLock();
        for (const id of ['ambience-toggle', 'cat-play-toggle']) {
          const control = doc.getElementById(id);
          if (control && control.getAttribute('aria-expanded') === 'true') control.click();
        }
        const dialog = doc.getElementById('object-dialog');
        if (dialog && dialog.open) dialog.close();
      }
      open = value; panel.hidden = !value; main.classList.toggle('photo-open', value);
      toggle.setAttribute('aria-expanded', String(value));
      if (root.RoomOverlayUI) root.RoomOverlayUI.sync();
      if (timer) { root.clearInterval(timer); timer = 0; }
      if (value) { refresh(); timer = root.setInterval(refresh, 900); panel.querySelector('#photo-quest-close').focus(); }
      else if (restoreFocus) {
        if (root.RoomOverlayUI) root.RoomOverlayUI.focusLauncher(toggle);
        else toggle.focus();
      }
    }
    function capture(id) {
      const check = getAssessment(id);
      if (!check.ok) { feedback.textContent = check.reason; refresh(); return false; }
      const room = getRoom();
      if (!room || typeof room.captureFrame !== 'function') {
        feedback.textContent = 'The camera is unavailable. Reload the page to try again.'; return false;
      }
      try {
        const canvas = photoCanvas(room.captureFrame(), doc, { zoom: id === 'charlie' ? 1.5 : 1 });
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (!dataUrl || dataUrl.length < 1000) throw new Error('The photo was empty. Try again.');
        shots[id] = { dataUrl, mood: check.mood, description: SUBJECTS.find(subject => subject.id === id).short };
        const image = panel.querySelector('[data-photo-mission="' + id + '"] .photo-thumb');
        image.src = dataUrl; image.alt = shots[id].description + ' in Isaac’s 3D room'; image.hidden = false;
        feedback.textContent = 'Captured ' + shots[id].description + '.';
        if (downloadableUrl) { root.URL.revokeObjectURL(downloadableUrl); downloadableUrl = null; downloadLink.hidden = true; }
        refresh(); return true;
      } catch (error) { feedback.textContent = error.message || 'The photo could not be saved. Try again.'; return false; }
    }
    function frame(id) {
      if (!graphicsAvailable) { feedback.textContent = 'Reload the page to use the camera.'; return false; }
      const access = framingAccess(id, roomState());
      if (!access.ok) { feedback.textContent = access.reason; return false; }
      const room = getRoom();
      if (!room || typeof room.photoAim !== 'function' || !room.photoAim(access.point)) {
        feedback.textContent = 'Assisted framing is unavailable. You can still drag to look.'; return false;
      }
      const check = getAssessment(id);
      feedback.textContent = check.ok ? 'Subject framed. Take the photo when you’re ready.'
        : check.reason;
      refresh(); return check.ok;
    }
    async function downloadPostcard() {
      postcardButton.disabled = true; feedback.textContent = 'Making your postcard…';
      try {
        const canvas = await postcardCanvas(shots, doc, root.Image);
        const blob = await new Promise(function (resolve) { canvas.toBlob(resolve, 'image/jpeg', 0.9); });
        if (!blob) throw new Error('The postcard could not be saved. Try again.');
        if (downloadableUrl) root.URL.revokeObjectURL(downloadableUrl);
        downloadableUrl = root.URL.createObjectURL(blob);
        downloadLink.href = downloadableUrl; downloadLink.hidden = false;
        feedback.textContent = 'Your postcard is ready. Choose Save postcard image.';
        downloadLink.focus();
      } catch (error) { feedback.textContent = error.message || 'The postcard could not be saved. Try again.'; }
      refresh();
    }

    toggle.addEventListener('click', function () { setOpen(!open, true); });
    panel.querySelector('#photo-quest-close').addEventListener('click', function () { setOpen(false, true); });
    panel.querySelectorAll('[data-photo-frame]').forEach(function (button) {
      button.addEventListener('click', function () { frame(button.dataset.photoFrame); });
    });
    panel.querySelectorAll('[data-photo-take]').forEach(function (button) {
      button.addEventListener('click', function () { capture(button.dataset.photoTake); });
    });
    postcardButton.addEventListener('click', downloadPostcard);
    doc.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && open) { setOpen(false, true); event.preventDefault(); }
    });
    doc.addEventListener('click', function (event) {
      if (!open) return;
      if (event.target.closest('#ambience-toggle, #cat-play-toggle, #film-toggle, #about-isaac, #inspect-object')) setOpen(false, false);
    }, true);
    root.addEventListener('room:interact', function () { if (open) setOpen(false, false); });
    root.addEventListener('room:ready', function () { graphicsAvailable = true; if (open) refresh(); });
    root.addEventListener('room:error', function () { graphicsAvailable = false; if (open) refresh(); });
    root.addEventListener('lighting:state', function () { moodChosen = true; if (open) refresh(); });
    doc.getElementById('enter-room').addEventListener('click', function () { toggle.hidden = false; });
    if (main.classList.contains('entered')) toggle.hidden = false;
    root.addEventListener('beforeunload', function () { if (downloadableUrl) root.URL.revokeObjectURL(downloadableUrl); });

    return { get state() { return { count: SUBJECTS.filter(subject => shots[subject.id]).length,
      completed: SUBJECTS.map(subject => ({ id: subject.id, done: !!shots[subject.id] })), moodChosen, open }; },
    frame, capture, assess: getAssessment, open: function () { setOpen(true, true); }, close: function () { setOpen(false, true); } };
  }

  const exported = { SUBJECTS, subjectPoint, framingAccess, assessShot, moodName, photoCanvas, postcardCanvas, createRoomPhotoSafari };
  if (typeof module !== 'undefined' && module.exports) module.exports = exported;
  if (root) {
    root.createRoomPhotoSafari = createRoomPhotoSafari;
    if (root.document && root.document.getElementById('experience')) root.RoomPhotoSafari = createRoomPhotoSafari();
  }
})(typeof window !== 'undefined' ? window : null);

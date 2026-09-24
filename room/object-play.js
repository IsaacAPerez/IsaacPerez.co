(function () {
  'use strict';

  // The mesh builder batches repeated props by material. These small interaction
  // volumes follow its authored coordinates; sceneObjects gates their existence.
  var REACH = 2.5;
  // Bottom-up case colors from the authored scene palette. These describe the
  // rendered pairs, not authenticated product names or a physical inventory.
  var SHOE_COLORS = [
    ['Silver-grey', 'Orange', 'Ivory', 'Black', 'Blue', 'Ivory', 'Yellow', 'Ivory'],
    ['Ivory', 'Silver-grey', 'Navy', 'Ivory', 'Black', 'Silver-grey', 'Pink', 'Ivory'],
    ['Red', 'Black', 'Cream', 'Silver-grey', 'Red', 'Ivory', 'Silver-grey', 'Ivory'],
    ['Ivory', 'Pink', 'Turquoise', 'Black', 'Blue', 'Silver-grey', 'Cream', 'Ivory'],
    ['Turquoise', 'Ivory', 'Navy', 'Orange', 'Yellow', 'Black', 'Silver-grey', 'Red'],
    ['Orange', 'Purple', 'Navy', 'Silver-grey', 'Purple', 'Lime', 'Ivory', 'Turquoise'],
    ['Blue', 'Red', 'Navy', 'Pink', 'Orange'],
    ['Cream', 'Pink', 'Pink', 'Ivory', 'Black'],
    ['Ivory', 'Red', 'Cream', 'Black', 'Black']
  ];
  var SHOE_TITLES = {
    '6:8': 'Turquoise ribbed sneakers',
    '6:7': 'Cream sculpted sneakers',
    '6:6': 'Lime patterned sneakers',
    '6:5': 'Purple slotted sneakers',
    '6:4': 'Silver slotted sneakers',
    '7:5': 'Red-orange sculpted sneakers',
    '7:4': 'Pink sculpted sneakers',
    '7:3': 'Navy sculpted sneakers',
    '5:7': 'Silver-grey basketball sneakers',
    '5:6': 'Black basketball sneakers',
    '5:5': 'Yellow basketball sneakers',
    '4:5': 'Blue basketball sneakers'
  };
  function point(value) { return Array.isArray(value) ? value : [value.x, value.y, value.z]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function forward(state) {
    return [Math.sin(state.yaw) * Math.cos(state.pitch), Math.sin(state.pitch), -Math.cos(state.yaw) * Math.cos(state.pitch)];
  }
  function rayBox(origin, direction, bounds) {
    var near = -Infinity, far = Infinity;
    for (var axis = 0; axis < 3; axis++) {
      if (Math.abs(direction[axis]) < 1e-8) {
        if (origin[axis] < bounds.min[axis] || origin[axis] > bounds.max[axis]) return null;
      } else {
        var a = (bounds.min[axis] - origin[axis]) / direction[axis];
        var b = (bounds.max[axis] - origin[axis]) / direction[axis];
        near = Math.max(near, Math.min(a, b)); far = Math.min(far, Math.max(a, b));
        if (near > far) return null;
      }
    }
    if (far < 0 || !Number.isFinite(far)) return null;
    // A camera inside a prop cannot interact through its back face.
    return near >= 0 ? near : null;
  }
  function selectTarget(state, targets, visible) {
    if (!state || !state.loaded || state.mode === 'overview') return null;
    var origin = point(state.position), direction = forward(state), best = null;
    targets.forEach(function (target) {
      if (target.normal && dot(direction, target.normal) >= -.04) return;
      var distance = rayBox(origin, direction, target.bounds);
      if (distance === null || distance > (target.reach || REACH) || (best && distance >= best.distance)) return;
      var hit = origin.map(function (v, i) { return v + direction[i] * distance; });
      if (visible && !visible(hit, target)) return;
      best = Object.assign({}, target, { distance: distance, hitPoint: hit });
    });
    return best;
  }
  function target(id, kind, title, min, max, normal, extra) {
    return Object.assign({ id: id, kind: kind, title: title, bounds: { min: min, max: max },
      point: min.map(function (v, i) { return (v + max[i]) / 2; }), normal: normal }, extra || {});
  }
  function buildTargets(objects) {
    var result = [], names = objects.map(function (o) { return o.name; }).join('\n');
    var detailIgnoreNames = objects.filter(function (o) { return /^Detail \| Material batch \|/.test(o.name); }).map(function (o) { return o.name; });
    if (/Sneaker clear doors/.test(names)) {
      for (var col = 0; col < 9; col++) {
        for (var row = 0; row < (col < 6 ? 8 : 5); row++) {
          var x = .26 + col * .37, y = .075 + row * .248 + .12;
          var title = SHOE_TITLES[(col + 1) + ':' + (row + 1)] || SHOE_COLORS[col][row] + ' sneakers';
          result.push(target('shoe-' + (col + 1) + '-' + (row + 1), 'shoe', title,
            [x - .1745, y - .1145, -.3665], [x + .1745, y + .1145, -.3635], [0, 0, -1],
            { case: { column: col + 1, row: row + 1 },
              ignoreNames: ['Sneaker clear doors', 'Sneaker case frame'] }));
        }
      }
    }
    if (/Desk collectible shelf/.test(names)) {
      result.push(target('shelf-spider-man', 'collectible', 'Spider-Man bust', [2.3765, 2.11, -4.086], [2.5235, 2.358, -3.96], [0, 0, 1],
        { description: 'The brick-built Spider-Man bust on the shelf above the workstation.' }));
      result.push(target('shelf-gengar', 'collectible', 'Gengar', [2.656, 2.109, -4.1], [2.904, 2.334, -3.964], [0, 0, 1],
        { description: 'The purple Gengar plush beside the lucky cat.' }));
      result.push(target('shelf-lucky-cat', 'collectible', 'Lucky cat', [2.923, 2.112, -4.077], [3.071, 2.344, -3.96], [0, 0, 1],
        { description: 'The waving lucky cat, next to the wooden hand and puzzle cubes.' }));
      result.push(target('shelf-puzzle-cubes', 'collectible', 'Puzzle cubes', [3.033, 2.11, -4.155], [3.216, 2.506, -3.94], [0, 0, 1],
        { description: 'The wooden hand holds a cube above a larger puzzle on the shelf.' }));
    }
    if (/Passage collector pegboard/.test(names)) {
      [[1.76, 9], [1.555, 7], [1.345, 7]].forEach(function (spec, row) {
        for (var i = 0; i < spec[1]; i++) {
          var spacing = .402 / (spec[1] - 1);
          var x = 4.057 + i * spacing, y = spec[0] - .09, halfWidth = Math.min(.0322, spacing * .48);
          result.push(target('keychain-' + (row + 1) + '-' + (i + 1), 'keychain', 'Keychain figure',
            [x - halfWidth, y, -4.145], [x + halfWidth, y + .0882, -4.104], [0, 0, 1],
            { row: row + 1, figure: i + 1,
              description: 'One of the hanging figures on the pegboard beside the bathroom.' }));
        }
      });
    }
    objects.filter(function (o) { return /Runtime \| Monitor screen/.test(o.name); }).forEach(function (o) {
      result.push(target('desk-monitor', 'monitor', 'Isaac’s workstation', point(o.min).slice(), point(o.max).slice(), [0, 0, 1],
        { ignoreNames: [o.name, 'Ultrawide monitor display'] }));
    });
    result.forEach(function (item) {
      if (item.kind === 'collectible' || item.kind === 'keychain') {
        item.ignoreNames = detailIgnoreNames;
      }
    });
    return result;
  }
  function node(tag, text, className) {
    var element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function init(options) {
    options = options || {};
    var room = options.room, host = options.host || document.getElementById('experience');
    if (!room || !host) return null;
    var disposed = false, aimed = null, opened = null, revision = 0, returnFocus = null;
    var targets = null, monitorTarget = null, monitorBaseY = null, deskOffset = 0, lastCameraKey = null;
    var cue = node('button', '', 'object-use'); cue.id = 'object-use'; cue.type = 'button'; cue.hidden = true;
    cue.setAttribute('aria-haspopup', 'dialog'); cue.setAttribute('aria-controls', 'object-play-dialog');
    var cueKey = node('kbd', 'E'), cueLabel = node('span'); cueKey.setAttribute('aria-hidden', 'true'); cue.append(cueKey, cueLabel);
    var dialog = node('dialog', '', 'object-play-dialog'); dialog.id = 'object-play-dialog'; dialog.setAttribute('aria-labelledby', 'object-play-title');
    var heading = node('div', '', 'panel-heading'), headingCopy = node('div'), eyebrow = node('p', '', 'eyebrow');
    var title = node('h2'); title.id = 'object-play-title';
    var close = node('button', '×'); close.type = 'button'; close.setAttribute('aria-label', 'Close object');
    headingCopy.append(eyebrow, title); heading.append(headingCopy, close);
    var body = node('div', '', 'object-play-body'); dialog.append(heading, body); host.append(cue, dialog);

    function ensureTargets(state) {
      if (targets || !state || !state.loaded) return;
      var deskState = room.desk && room.desk.state;
      if (deskState && Number.isFinite(deskState.offset)) deskOffset = deskState.offset;
      targets = buildTargets(room.sceneObjects || []);
      monitorTarget = targets.find(function (item) { return item.kind === 'monitor'; }) || null;
      if (monitorTarget) monitorBaseY = {
        min: monitorTarget.bounds.min[1] - deskOffset,
        max: monitorTarget.bounds.max[1] - deskOffset,
        point: monitorTarget.point[1] - deskOffset
      };
    }

    function onDeskState(event) {
      var offset = event.detail && event.detail.offset;
      if (!Number.isFinite(offset) || offset === deskOffset) return;
      deskOffset = offset;
      if (monitorTarget) {
        monitorTarget.bounds.min[1] = monitorBaseY.min + offset;
        monitorTarget.bounds.max[1] = monitorBaseY.max + offset;
        monitorTarget.point[1] = monitorBaseY.point + offset;
      }
      update();
    }

    function blocked() {
      return document.hidden || !host.classList.contains('entered') || !!document.querySelector('dialog[open]') ||
        host.classList.contains('menu-open') || ['references', 'ambience', 'cat-play-panel', 'photo-quest'].some(function (id) {
          var panel = document.getElementById(id); return panel && !panel.hidden;
        });
    }
    function visibility(hit, item) {
      if (typeof room.visibility !== 'function') return false;
      var response = room.visibility(hit, { ignoreNames: item.ignoreNames || [], tolerance: .018 });
      return typeof response === 'boolean' ? response : !!(response && response.visible);
    }
    function update(force) {
      if (disposed) return null;
      var isBlocked = blocked();
      var state = isBlocked ? null : (room.cameraState || room.state);
      if (state) ensureTargets(state);
      var position = state && state.position;
      var cameraKey = isBlocked ? 'blocked' : [
        state && state.loaded, state && state.mode,
        position && position.x, position && position.y, position && position.z,
        state && state.yaw, state && state.pitch, deskOffset
      ].join('|');
      if (!force && cameraKey === lastCameraKey) return aimed;
      lastCameraKey = cameraKey;
      var previousId = aimed && aimed.id;
      aimed = isBlocked ? null : selectTarget(state, targets || [], visibility);
      var hasAim = !!aimed;
      if (cue.hidden !== !hasAim) cue.hidden = !hasAim;
      if (host.classList.contains('object-aimed') !== hasAim) host.classList.toggle('object-aimed', hasAim);
      if (aimed && aimed.id !== previousId) {
        cueLabel.textContent = 'Use · ' + aimed.title;
        cue.setAttribute('aria-label', 'Use ' + aimed.title + (aimed.case ? ', column ' + aimed.case.column + ', row ' + aimed.case.row : ''));
      }
      return aimed;
    }
    function monitor(token) {
      var status = node('p', 'Loading Isaac’s site…'); status.setAttribute('role', 'status'); body.append(status);
      var loader = options.loadPortfolio || window.loadRoomPortfolio;
      Promise.resolve().then(function () {
        if (typeof loader !== 'function') throw new Error('Portfolio loader unavailable');
        return loader();
      }).then(function (content) {
        if (disposed || revision !== token || !dialog.open) return;
        body.replaceChildren();
        var controls = node('div', '', 'portfolio-sections'); controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', 'Isaac’s site sections');
        var section = node('section'); section.id = 'object-portfolio-section'; section.setAttribute('aria-live', 'polite');
        [['me', 'Me'], ['work', 'Experience'], ['projects', 'My company']].forEach(function (entry) {
          var button = node('button', entry[1]); button.type = 'button'; button.dataset.section = entry[0]; button.setAttribute('aria-controls', section.id);
          button.addEventListener('click', function () { show(entry[0]); }); controls.append(button);
        });
        function show(key) {
          var item = content[key]; section.replaceChildren(node('h3', item.title), item.body.cloneNode(true));
          controls.querySelectorAll('button').forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.section === key)); });
        }
        body.append(controls, section, content.contact.cloneNode(true)); show('me');
      }).catch(function () {
        if (disposed || revision !== token || !dialog.open) return;
        status.textContent = 'The site content could not be loaded.';
        var link = node('a', 'Read about Isaac'); link.href = '/about/'; body.append(link);
      });
    }
    function use() {
      var item = update(true);
      if (!item) return false;
      var token = ++revision; opened = item; returnFocus = document.activeElement;
      if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
      try { if (options.onUse) options.onUse(item); } catch (_) { /* Inspection remains usable if a prop animation is unavailable. */ }
      title.textContent = item.title;
      eyebrow.textContent = item.kind === 'shoe' ? 'Collection · Column ' + item.case.column + ' / Row ' + item.case.row :
        item.kind === 'keychain' ? 'Pegboard · Row ' + item.row + ' / Figure ' + item.figure : item.kind === 'monitor' ? 'At the workstation' : 'On the shelf';
      body.replaceChildren(); dialog.showModal();
      if (item.kind === 'monitor') monitor(token);
      else {
        body.append(node('p', item.kind === 'shoe'
          ? 'A pair from Isaac’s clear-box sneaker collection.'
          : item.description));
        body.append(node('p', 'Close this card and move around the object to see it in the 3D room.'));
      }
      window.dispatchEvent(new CustomEvent('room:object-use', { detail: { type: item.kind, kind: item.kind, id: item.id, target: item } }));
      update(); close.focus({ preventScroll: true }); return true;
    }
    function onClose() {
      revision++; var previous = opened; opened = null;
      if (options.onClose && previous) options.onClose(previous);
      var canvas = document.getElementById('room-canvas');
      var focus = returnFocus && returnFocus.isConnected && returnFocus !== cue ? returnFocus : canvas;
      if (focus && focus.focus) focus.focus({ preventScroll: true }); update();
    }
    close.addEventListener('click', function () { dialog.close(); }); dialog.addEventListener('close', onClose);
    cue.addEventListener('click', use);
    function onVisibility() { update(); }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('room:error', onVisibility);
    window.addEventListener('desk:state', onDeskState);
    window.addEventListener('room:ready', update);
    var timer = setInterval(update, 100); update();
    return { update: update, use: use, get target() { return aimed; }, get state() { return { target: aimed && aimed.id, open: opened && opened.id }; },
      dispose: function () {
        if (disposed) return; disposed = true; clearInterval(timer); revision++;
        if (dialog.open) dialog.close(); cue.remove(); dialog.remove(); host.classList.remove('object-aimed');
        document.removeEventListener('visibilitychange', onVisibility); window.removeEventListener('room:error', onVisibility);
        window.removeEventListener('desk:state', onDeskState); window.removeEventListener('room:ready', update);
      } };
  }
  var api = { init: init, selectTarget: selectTarget, rayBox: rayBox, buildTargets: buildTargets };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof window !== 'undefined') window.RoomObjectPlay = api;
  if (typeof document !== 'undefined' && typeof window !== 'undefined') {
    function boot() {
      if (!window.roomObjectPlay && window.RoomPreview) window.roomObjectPlay = init({ room: window.RoomPreview,
        onUse: function (item) { return window.RoomPreview.useObject && window.RoomPreview.useObject(item); },
        onClose: function (item) { if (window.RoomPreview.closeObject) window.RoomPreview.closeObject(item); } });
    }
    boot(); window.addEventListener('room:ready', boot);
  }
}());

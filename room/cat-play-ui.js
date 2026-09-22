(function () {
  'use strict';
  const main = document.getElementById('experience');
  const toggle = document.getElementById('cat-play-toggle');
  const panel = document.getElementById('cat-play-panel');
  const close = document.getElementById('cat-play-close');
  const status = document.getElementById('cat-play-status');
  if (!main || !toggle || !panel || !close || !status) return;
  function setOpen(open, restoreFocus) {
    if (open && (!main.classList.contains('entered') || !window.RoomPreview || !window.RoomPreview.catPlay)) return;
    if (open) {
      if (document.pointerLockElement) document.exitPointerLock();
      for (const id of ['ambience-toggle', 'photo-quest-toggle']) {
        const button = document.getElementById(id);
        if (button && button.getAttribute('aria-expanded') === 'true') button.click();
      }
      const dialog = document.querySelector('dialog[open]');
      if (dialog) dialog.close();
    }
    panel.hidden = !open;
    main.classList.toggle('cat-play-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open) close.focus({ preventScroll: true });
    else if (restoreFocus) toggle.focus({ preventScroll: true });
  }
  function explain(name, kind, response) {
    if (response.accepted) {
      if (kind === 'pet') return name + ' settles in for a pet.';
      if (kind === 'ball') return 'The ball rolls across the floor. See who investigates.';
      return 'Calling ' + name + '. Give ' + name + ' a moment to find a clear path.';
    }
    return ({ loading: name + ' is still joining the room.', paused: name + ' is resting. Let ' + name + ' roam first.',
      busy: name + ' is in the middle of something. Try again soon.', 'come-closer': 'Move closer to ' + name + ' for a pet.',
      'out-of-reach': 'Move to a clearer spot and call ' + name + ' again.',
      'unavailable': 'The cats are not ready yet.', 'invalid-target': 'Step into the room first.' })[response.reason]
      || 'Try again from a clear spot in the room.';
  }
  toggle.addEventListener('click', () => setOpen(panel.hidden, true));
  close.addEventListener('click', () => setOpen(false, true));
  document.querySelectorAll('[data-cat-action]').forEach(button => button.addEventListener('click', () => {
    const play = window.RoomPreview && window.RoomPreview.catPlay;
    if (!play) return;
    const name = button.dataset.catId === 'mimi' ? 'Mimi' : 'Charlie';
    const response = button.dataset.catAction === 'pet' ? play.pet(button.dataset.catId) : play.call(button.dataset.catId);
    status.textContent = explain(name, button.dataset.catAction, response);
  }));
  document.getElementById('cat-roll-ball').addEventListener('click', () => {
    const play = window.RoomPreview && window.RoomPreview.catPlay;
    if (play) status.textContent = explain('the cats', 'ball', play.rollBall());
  });
  document.getElementById('enter-room').addEventListener('click', () => { toggle.hidden = false; });
  if (main.classList.contains('entered')) toggle.hidden = false;
  window.addEventListener('room:error', () => { toggle.disabled = true; setOpen(false, false); });
  for (const name of ['mimi', 'charlie']) window.addEventListener(name + ':interaction', event => {
    if (!panel.hidden && event.detail && event.detail.interaction) {
      const action = event.detail.interaction;
      if (action.status === 'greeting') status.textContent = (name === 'mimi' ? 'Mimi' : 'Charlie') + ' came to say hello.';
      if (action.status === 'investigating') status.textContent = (name === 'mimi' ? 'Mimi' : 'Charlie') + ' found the ball.';
    }
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !panel.hidden) { event.preventDefault(); setOpen(false, true); }
  });
  window.RoomCatPlayUI = { open: () => setOpen(true, true), close: () => setOpen(false, true), get openState() { return !panel.hidden; } };
})();

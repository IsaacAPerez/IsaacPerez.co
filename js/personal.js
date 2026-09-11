/* The personal homepage needs only a theme switch. Content is visible without JS. */
(function () {
  'use strict';
  var root = document.documentElement;
  var button = document.getElementById('themeToggle');
  var preference = window.matchMedia('(prefers-color-scheme: dark)');
  if (!button) return;
  button.hidden = false;
  function isDark() {
    var selected = root.getAttribute('data-theme');
    return selected === 'dark' || (!selected && preference.matches);
  }
  function label() {
    button.setAttribute('aria-label', 'Switch to ' + (isDark() ? 'light' : 'dark') + ' theme');
  }
  button.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (e) {}
    label();
  });
  if (preference.addEventListener) preference.addEventListener('change', label);
  else if (preference.addListener) preference.addListener(label);
  label();
})();

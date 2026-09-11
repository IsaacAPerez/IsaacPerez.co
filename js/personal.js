(function () {
  'use strict';

  var root = document.documentElement;
  var button = document.getElementById('themeToggle');
  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    var selected = root.getAttribute('data-theme');
    return selected === 'dark' || (selected !== 'light' && systemTheme.matches);
  }

  function updateButton() {
    button.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    button.setAttribute('title', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }

  if (!button) return;

  updateButton();
  button.hidden = false;
  button.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch (error) { /* Theme still works when storage is unavailable. */ }
    updateButton();
  });

  if (systemTheme.addEventListener) {
    systemTheme.addEventListener('change', updateButton);
  } else if (systemTheme.addListener) {
    systemTheme.addListener(updateButton);
  }
})();

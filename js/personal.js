(function () {
  'use strict';

  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');
  var year = document.getElementById('year');
  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    var theme = root.getAttribute('data-theme');
    return theme === 'dark' || (theme !== 'light' && systemTheme.matches);
  }

  function updateToggle() {
    if (toggle) {
      toggle.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    }
  }

  if (toggle) {
    toggle.hidden = false;
    updateToggle();
    toggle.addEventListener('click', function () {
      var theme = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', theme);
      try { localStorage.setItem('theme', theme); } catch (error) { /* Storage can be unavailable. */ }
      updateToggle();
    });
  }

  if (systemTheme.addEventListener) {
    systemTheme.addEventListener('change', updateToggle);
  } else if (systemTheme.addListener) {
    systemTheme.addListener(updateToggle);
  }

  if (year) year.textContent = new Date().getFullYear();
})();

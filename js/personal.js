(function () {
  'use strict';

  var root = document.documentElement;
  var button = document.getElementById('themeToggle');
  var systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
  var motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  var REDUCED = motionPreference.matches;
  var revealElements = [].slice.call(document.querySelectorAll('[data-reveal]'));
  var animations = [];
  var observer;

  function isDark() {
    var selected = root.getAttribute('data-theme');
    return selected === 'dark' || (selected !== 'light' && systemTheme.matches);
  }

  function updateButton() {
    button.setAttribute('aria-label', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
    button.setAttribute('title', isDark() ? 'Switch to light theme' : 'Switch to dark theme');
  }

  if (button) {
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
  }

  /* Animate on entry instead of hiding content in CSS: no-JS and unsupported
     browsers always have a complete, readable page. Reveals play only once. */
  function revealNow(element) {
    element.setAttribute('data-revealed', 'true');
    if (observer) observer.unobserve(element);
    animations.slice().forEach(function (item) {
      if (item.element === element) item.animation.cancel();
    });
  }

  function reveal(element) {
    if (element.hasAttribute('data-revealed')) return;
    revealNow(element);
    if (REDUCED || element.contains(document.activeElement)) return;
    var animation = element.animate([
      { opacity: 0, transform: 'translateY(18px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], {
      duration: 720,
      delay: Number(element.getAttribute('data-reveal-delay')) || 0,
      easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
      fill: 'backwards'
    });
    var item = { element: element, animation: animation };
    animations.push(item);
    function finished() {
      var index = animations.indexOf(item);
      if (index !== -1) animations.splice(index, 1);
    }
    animation.onfinish = finished;
    animation.oncancel = finished;
  }

  function revealDestination(hash) {
    if (!hash || hash === '#top') return;
    var id;
    try { id = decodeURIComponent(hash.slice(1)); } catch (error) { return; }
    var target = document.getElementById(id === 'work' ? 'experience' : id);
    if (!target) return;
    revealElements.forEach(function (element) {
      if (target.contains(element) || element.contains(target)) revealNow(element);
    });
  }

  document.addEventListener('focusin', function (event) {
    revealElements.forEach(function (element) {
      if (element.contains(event.target)) revealNow(element);
    });
  });
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function () {
      revealDestination(link.getAttribute('href'));
    });
  });
  window.addEventListener('hashchange', function () { revealDestination(window.location.hash); });
  revealDestination(window.location.hash);

  function updateMotion() {
    REDUCED = motionPreference.matches;
    if (observer) observer.disconnect();
    if (REDUCED || !('IntersectionObserver' in window) || !Element.prototype.animate) {
      revealElements.forEach(revealNow);
      return;
    }
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) reveal(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px 48px 0px' });
    revealElements.forEach(function (element) {
      if (!element.hasAttribute('data-revealed')) observer.observe(element);
    });
  }

  updateMotion();
  if (motionPreference.addEventListener) {
    motionPreference.addEventListener('change', updateMotion);
  } else if (motionPreference.addListener) {
    motionPreference.addListener(updateMotion);
  }
})();

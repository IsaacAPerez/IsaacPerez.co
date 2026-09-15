/* ============================================================
   ISAACPEREZ.CO — site motion
   Scroll-driven reveals, hero parallax, word-fill, nav, theme.
   ============================================================ */
(function () {
  'use strict';
  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  /* ---------- Theme toggle ---------- */
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
    /* Same result as the old inline expression: with no data-theme set the
       next theme is the opposite of what the system is showing. */
    var isDark = function () {
      var selected = root.getAttribute('data-theme');
      return selected === 'dark' || (selected !== 'light' && systemDark.matches);
    };
    /* The icon swaps, but nothing said so: the label read "Toggle theme"
       identically before and after, so a screen reader was never told which
       theme is now active. js/personal.js:18-21 does exactly this. */
    var updateThemeBtn = function () {
      var label = isDark() ? 'Switch to light theme' : 'Switch to dark theme';
      themeBtn.setAttribute('aria-label', label);
      themeBtn.setAttribute('title', label);
    };
    updateThemeBtn();
    themeBtn.addEventListener('click', function () {
      root.setAttribute('data-theme', isDark() ? 'light' : 'dark');
      try { localStorage.setItem('theme', root.getAttribute('data-theme')); } catch (e) {}
      updateThemeBtn();
    });
    if (systemDark.addEventListener) systemDark.addEventListener('change', updateThemeBtn);
    else if (systemDark.addListener) systemDark.addListener(updateThemeBtn);
  }

  /* ---------- Mobile menu ---------- */
  /* Below 640px the four section links collapse into a panel under the bar.
     closeMenu stays a no-op when the markup has no toggle, so the scroll
     handler below can call it unconditionally. */
  var closeMenu = function () {};
  var navToggle = document.getElementById('navToggle');
  var navLinks = document.getElementById('navLinks');
  var navBar = document.getElementById('nav');
  if (navToggle && navLinks && navBar) {
    var setMenu = function (open) {
      navBar.classList.toggle('menu-open', open);
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    };
    closeMenu = function () {
      if (navToggle.getAttribute('aria-expanded') === 'true') setMenu(false);
    };
    navToggle.addEventListener('click', function () {
      setMenu(navToggle.getAttribute('aria-expanded') !== 'true');
    });
    navLinks.addEventListener('click', function (e) {
      if (e.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && navToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        navToggle.focus();
      }
    });
    /* Past the breakpoint the button is gone, so an open panel would strand
       .menu-open on a bar that can no longer close it. */
    window.addEventListener('resize', function () {
      if (window.innerWidth > 640) closeMenu();
    });
  }

  /* ---------- Reveal on scroll ---------- */
  var revealEls = [].slice.call(document.querySelectorAll('[data-reveal]'));
  if (REDUCED) {
    revealEls.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach(function (el) {
      /* Anything that starts above the viewport has already been scrolled
         past, so show it outright. Whether this file runs before or after the
         browser restores a scroll position is a race: lose it and everything
         above the restored position stays blank until the visitor scrolls back
         up through it. At the top of the page nothing qualifies, so a normal
         load still animates the first screen in. */
      if (el.getBoundingClientRect().top < 0) el.classList.add('in');
      else io.observe(el);
    });
  }

  /* ---------- Hero title word stagger ---------- */
  var heroTitle = document.getElementById('heroTitle');
  if (heroTitle && !REDUCED) {
    var ws = heroTitle.querySelectorAll('.w');
    for (var i = 0; i < ws.length; i++) ws[i].style.animationDelay = (140 + i * 110) + 'ms';
    requestAnimationFrame(function () { heroTitle.classList.add('go'); });
  } else if (heroTitle) {
    heroTitle.classList.add('go');
  }

  /* Everything the .js hiding depends on is now wired. Tells the watchdog in
     each page's head to leave .js in place; if this file never gets here the
     watchdog un-hides the page. */
  root.classList.add('site-ready');

  /* ---------- Statement: wrap words for scroll fill ---------- */
  var stWords = [];
  var stEl = document.getElementById('statementText');
  if (stEl) {
    (function wrap(node) {
      var kids = [].slice.call(node.childNodes);
      kids.forEach(function (n) {
        if (n.nodeType === 3) { // text
          var parts = n.textContent.split(/(\s+)/);
          var frag = document.createDocumentFragment();
          parts.forEach(function (p) {
            if (/^\s+$/.test(p) || p === '') { frag.appendChild(document.createTextNode(p)); }
            else { var s = document.createElement('span'); s.className = 'word'; s.textContent = p; frag.appendChild(s); stWords.push(s); }
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1) { wrap(n); }
      });
    })(stEl);
    if (REDUCED) stWords.forEach(function (w) { w.style.opacity = 1; });
  }

  /* ---------- Scroll-linked effects (rAF) ---------- */
  var heroInner = document.getElementById('heroInner');
  var aboutPhoto = document.getElementById('aboutPhoto');
  var nav = document.getElementById('nav');
  var hero = document.querySelector('.hero');
  var lastY = window.scrollY, navHidden = false, ticking = false;

  /* The nav hides on scroll-down, but only once the visitor has really
     scrolled. The browser's scroll restoration on a reload or a Back arrives as
     several scroll events nobody made, and each one after the first reads as a
     scroll down, so without this the bar is already off-screen on arrival.
     lastY keeps tracking through them, so the first real gesture is measured
     from where the page actually is. */
  var userScrolled = false;
  ['wheel', 'touchmove', 'keydown', 'mousedown'].forEach(function (evt) {
    window.addEventListener(evt, function () { userScrolled = true; }, { passive: true, once: true });
  });

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function frame() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    // nav: solid after scroll, hide on scroll-down past hero, show on scroll-up
    if (nav) {
      nav.classList.toggle('scrolled', y > 8);
      if (!REDUCED && userScrolled) {
        var goingDown = y > lastY;
        if (goingDown && y > 240 && !navHidden) { nav.classList.add('hide'); navHidden = true; closeMenu(); }
        else if ((!goingDown || y < 120) && navHidden) { nav.classList.remove('hide'); navHidden = false; }
      }
    }

    if (!REDUCED) {
      // hero parallax: content drifts up, scales down, fades + blurs as you leave
      if (heroInner && hero) {
        var hp = clamp(y / (hero.offsetHeight * 0.85), 0, 1);
        heroInner.style.transform = 'translateY(' + (hp * -60) + 'px) scale(' + (1 - hp * 0.06) + ')';
        heroInner.style.opacity = String(1 - hp * 1.1);
        heroInner.style.filter = hp > 0.02 ? 'blur(' + (hp * 6) + 'px)' : 'none';
      }
      // about photo subtle parallax
      if (aboutPhoto) {
        var r = aboutPhoto.getBoundingClientRect();
        if (r.bottom > 0 && r.top < vh) {
          var ap = (r.top + r.height / 2 - vh / 2) / vh; // -0.5..0.5-ish
          aboutPhoto.style.transform = 'scale(1.08) translateY(' + clamp(ap * -22, -22, 22) + 'px)';
        }
      }
      // statement word fill
      if (stWords.length && stEl) {
        var sr = stEl.getBoundingClientRect();
        var p = clamp((vh * 0.82 - sr.top) / (sr.height + vh * 0.35), 0, 1);
        var lit = p * stWords.length;
        for (var i = 0; i < stWords.length; i++) {
          stWords[i].style.opacity = String(clamp(lit - i, 0.16, 1));
        }
      }
    }
    lastY = y;
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  /* A Back served from the bfcache restores the DOM exactly as it was left,
     nav.hide and a stale lastY included, so the bar would still be off-screen
     on arrival with no scroll event coming to correct it. */
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    lastY = window.scrollY;
    navHidden = false;
    if (nav) nav.classList.remove('hide');
  });
  frame();

  /* ---------- Smooth anchor scroll (offset for fixed nav) ---------- */
  /* The skip link is excluded: this handler calls preventDefault, which stops
     the browser performing the fragment navigation that moves focus to
     <main tabindex="-1">. Scrolling alone would leave focus on <body> and the
     next Tab back at the top of the nav -- exactly what the link exists to
     skip. html { scroll-behavior: smooth } keeps the native jump smooth. */
  document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id === '#top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
      var t = document.querySelector(id);
      if (t) { e.preventDefault(); var top = t.getBoundingClientRect().top + window.scrollY - 56; window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' }); }
    });
  });
})();

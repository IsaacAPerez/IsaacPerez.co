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
    themeBtn.addEventListener('click', function () {
      var cur = root.getAttribute('data-theme');
      var sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next = cur === 'dark' ? 'light' : cur === 'light' ? 'dark' : (sysDark ? 'light' : 'dark');
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
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
    revealEls.forEach(function (el) { io.observe(el); });
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

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function frame() {
    ticking = false;
    var y = window.scrollY;
    var vh = window.innerHeight;

    // nav: solid after scroll, hide on scroll-down past hero, show on scroll-up
    if (nav) {
      nav.classList.toggle('scrolled', y > 8);
      if (!REDUCED) {
        var goingDown = y > lastY;
        if (goingDown && y > 240 && !navHidden) { nav.classList.add('hide'); navHidden = true; }
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
  frame();

  /* ---------- Smooth anchor scroll (offset for fixed nav) ---------- */
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#' || id === '#top') { e.preventDefault(); window.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); return; }
      var t = document.querySelector(id);
      if (t) { e.preventDefault(); var top = t.getBoundingClientRect().top + window.scrollY - 56; window.scrollTo({ top: top, behavior: REDUCED ? 'auto' : 'smooth' }); }
    });
  });
})();

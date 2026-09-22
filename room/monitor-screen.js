(function () {
  'use strict';

  // A static view of the canonical about page for the ultrawide display. This is
  // a canvas texture, not a second biography or an independently animated UI.
  window.createMonitorScreen = function (options) {
    options = options || {};
    var canvas = document.createElement('canvas');
    canvas.width = 2048; canvas.height = 622;
    var ctx = canvas.getContext('2d');
    var font = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", system-ui, sans-serif';
    var content = { title: 'Isaac Perez.', label: '', intro: '', portraitURL: null };
    var portrait = null, disposed = false, revision = 0, phase = 'loading', error = null;
    var cancelWaits = [], abort = new AbortController();
    var started = Date.now(), timeout = 8000;

    function state() {
      return { status: phase, source: '/about/', title: content.title, portraitLoaded: !!portrait,
        width: canvas.width, height: canvas.height, revision: revision, error: error };
    }
    function rounded(x, y, width, height, radius) {
      ctx.beginPath();
      ctx.moveTo(x + radius, y); ctx.lineTo(x + width - radius, y);
      ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
      ctx.lineTo(x + width, y + height - radius);
      ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
      ctx.lineTo(x + radius, y + height);
      ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
      ctx.lineTo(x, y + radius); ctx.quadraticCurveTo(x, y, x + radius, y);
      ctx.closePath();
    }
    function text(value, x, y, size, weight, color) {
      ctx.font = weight + ' ' + size + 'px ' + font;
      ctx.fillStyle = color || '#1d1d1f'; ctx.fillText(value, x, y);
    }
    function paragraph(value, x, y, width, size, lineHeight, maxLines) {
      ctx.font = '400 ' + size + 'px ' + font;
      var words = value.split(/\s+/), lines = [], line = '';
      words.forEach(function (word) {
        var next = line ? line + ' ' + word : word;
        if (line && ctx.measureText(next).width > width) { lines.push(line); line = word; }
        else line = next;
      });
      if (line) lines.push(line);
      lines.slice(0, maxLines).forEach(function (value, index) {
        if (index === maxLines - 1 && lines.length > maxLines) {
          while (value && ctx.measureText(value + '…').width > width) value = value.slice(0, -1);
          value += '…';
        }
        text(value, x, y + index * lineHeight, size, 400);
      });
    }
    function repaint(notify) {
      if (disposed || !ctx) return;
      ctx.save(); ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillStyle = '#fbfbfd'; ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Restrained desktop chrome keeps the page distinct from the monitor bezel.
      ctx.fillStyle = '#e9e9ed'; ctx.fillRect(0, 0, 2048, 55);
      ['#e36a65', '#d5b04e', '#70ad73'].forEach(function (color, index) {
        ctx.beginPath(); ctx.arc(29 + index * 26, 27, 7, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
      });
      rounded(593, 10, 862, 35, 8); ctx.fillStyle = '#f9f9fb'; ctx.fill();
      ctx.textAlign = 'center'; text('isaacperez.co', 1024, 35, 21, 500, '#515157'); ctx.textAlign = 'left';
      ctx.strokeStyle = '#d2d2d7'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, 55); ctx.lineTo(2048, 55); ctx.stroke();

      var name = content.title.replace(/\.$/, '');
      text(name, 286, 111, 25, 650);
      text('Me', 1238, 111, 22, 500);
      text('Experience', 1355, 111, 22, 400, '#6e6e73');
      text('My company', 1554, 111, 22, 400, '#6e6e73');
      ctx.beginPath(); ctx.moveTo(286, 136); ctx.lineTo(1762, 136); ctx.stroke();

      var parts = name.split(/\s+/), first = parts.shift(), last = parts.join(' ');
      if (content.label) text(content.label.toUpperCase(), 286, 195, 22, 550, '#6e6e73');
      text(first, 277, 314, 126, 550);
      text((last || '') + '.', 277, 428, 126, 550);
      if (content.intro) paragraph(content.intro, 286, 483, 840, 26, 35, 3);

      if (portrait) {
        ctx.save(); rounded(1296, 163, 348, 396, 28); ctx.clip();
        var scale = Math.max(348 / portrait.naturalWidth, 396 / portrait.naturalHeight);
        var width = portrait.naturalWidth * scale, height = portrait.naturalHeight * scale;
        ctx.drawImage(portrait, 1296 + (348 - width) / 2, 163 + (396 - height) / 2, width, height);
        ctx.restore();
      }
      ctx.restore(); revision++;
      if (notify && typeof options.onChange === 'function') {
        // A renderer may still be loading its geometry when the content arrives.
        try { options.onChange(canvas); } catch (_) { /* The initial canvas remains usable. */ }
      }
    }
    function bounded(promise, duration, label) {
      return new Promise(function (resolve, reject) {
        var finished = false;
        function settle(callback, value) {
          if (finished) return;
          finished = true; clearTimeout(timer);
          cancelWaits = cancelWaits.filter(function (entry) { return entry !== cancel; });
          callback(value);
        }
        function cancel() { settle(reject, new Error('Monitor disposed.')); }
        var timer = setTimeout(function () { settle(reject, new Error(label)); }, Math.max(1, duration));
        cancelWaits.push(cancel);
        Promise.resolve(promise).then(function (value) { settle(resolve, value); }, function (reason) { settle(reject, reason); });
      });
    }
    function clean(node) { return node ? node.textContent.replace(/\s+/g, ' ').trim() : ''; }
    function parseHomepage(html) {
      var source = new DOMParser().parseFromString(html, 'text/html');
      var image = source.querySelector('#about .portrait img');
      return { title: clean(source.querySelector('.personal-name')) + '.', label: clean(source.querySelector('#about .eyebrow')),
        intro: clean(source.querySelector('#about .intro-copy > p')), portraitURL: image && image.getAttribute('src') };
    }
    function fromPortfolio(portfolio) {
      var about = portfolio.me;
      var image = about.body.querySelector('img');
      return { title: about.title, label: about.label, intro: clean(about.body.querySelector('p')),
        portraitURL: image && image.getAttribute('src') };
    }
    function loadPortrait(url) {
      return new Promise(function (resolve, reject) {
        var image = new Image();
        image.onload = function () { image.onload = image.onerror = null; resolve(image); };
        image.onerror = function () { image.onload = image.onerror = null; reject(new Error('The about-page portrait could not load.')); };
        image.src = url;
      });
    }
    repaint(false);
    var ready = Promise.resolve().then(function () {
      if (!ctx) throw new Error('Canvas 2D is unavailable.');
      if (disposed) throw new Error('Monitor disposed.');
      var source = typeof window.loadRoomPortfolio === 'function'
        ? Promise.resolve().then(window.loadRoomPortfolio).then(fromPortfolio)
        : fetch('/about/', { cache: 'no-cache', signal: abort.signal }).then(function (response) {
          if (!response.ok) throw new Error('The about page could not load.');
          return response.text();
        }).then(parseHomepage);
      return bounded(source, timeout, 'The about page load timed out.');
    }).then(function (value) {
      if (disposed) return;
      if (!value.title || value.title === '.' || !value.intro) throw new Error('The about-page content could not be read.');
      content = value; repaint(true);
      if (!value.portraitURL) throw new Error('The about-page portrait is unavailable.');
      var url = new URL(value.portraitURL, location.origin + '/');
      if (url.origin !== location.origin) throw new Error('The monitor portrait must be a local about-page asset.');
      return bounded(loadPortrait(url.href), timeout - (Date.now() - started), 'The about-page portrait load timed out.').then(function (image) {
        if (disposed) return;
        portrait = image; phase = 'ready'; repaint(true);
      });
    }).catch(function (reason) {
      if (!disposed) { phase = 'degraded'; error = reason.message || String(reason); abort.abort(); repaint(true); }
    }).then(state);
    return {
      canvas: canvas, ready: ready,
      get state() { return state(); },
      dispose: function () {
        if (disposed) return;
        disposed = true; phase = 'disposed'; abort.abort(); cancelWaits.slice().forEach(function (cancel) { cancel(); });
      },
    };
  };
})();

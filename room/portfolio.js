(function () {
  'use strict';

  // The about page remains the source of truth. Read its public content instead
  // of maintaining another biography, employment history or project catalogue.
  var pending;
  function textOf(root, selector) {
    var node = root.querySelector(selector);
    if (!node) throw new Error('The about page content could not be read.');
    var copy = node.cloneNode(true);
    copy.querySelectorAll('br').forEach(function (br) { br.replaceWith(' '); });
    return copy.textContent.replace(/\s+/g, ' ').trim();
  }
  function element(tag, text, className) {
    var node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function link(text, href) {
    var node = element('a', text);
    var url = new URL(href, location.origin);
    if (!['https:', 'http:', 'mailto:'].includes(url.protocol)) throw new Error('Unsupported about-page link.');
    node.href = url.href;
    if (url.protocol !== 'mailto:') { node.target = '_blank'; node.rel = 'noopener noreferrer'; }
    return node;
  }
  window.loadRoomPortfolio = function () {
    if (pending) return pending;
    pending = fetch('/about/', { cache: 'no-cache' }).then(function (response) {
      if (!response.ok) throw new Error('The about page could not be loaded.');
      return response.text();
    }).then(function (html) {
      var source = new DOMParser().parseFromString(html, 'text/html');
      var about = element('div');
      var original = source.querySelector('#about .portrait img');
      if (!original) throw new Error('The about-page portrait could not be read.');
      var portrait = element('picture', '', 'site-portrait');
      var originalAvif = source.querySelector('#about picture source[type="image/avif"]');
      if (originalAvif) {
        var avif = element('source'); avif.type = 'image/avif';
        avif.srcset = new URL(originalAvif.getAttribute('srcset'), location.origin + '/').href;
        portrait.append(avif);
      }
      var photo = element('img'); photo.src = new URL(original.getAttribute('src'), location.origin + '/').href;
      photo.alt = original.alt; photo.width = original.width; photo.height = original.height;
      portrait.append(photo);
      about.append(portrait, element('p', textOf(source, '#about .intro-copy > p')));

      var experience = element('div');
      var rows = source.querySelectorAll('#experience .experience-row');
      if (!rows.length) throw new Error('The about-page experience could not be read.');
      rows.forEach(function (row) {
        var item = element('article', '', 'item');
        item.append(element('p', textOf(row, '.experience-date'), 'story-date'),
          element('h3', textOf(row, 'h3')), element('p', textOf(row, '.experience-role p'), 'story-role'),
          element('p', textOf(row, '.experience-copy')));
        experience.append(item);
      });

      var company = element('div');
      var companyLink = source.querySelector('#firstunit .company-link');
      if (!companyLink) throw new Error('The about-page company link could not be read.');
      company.append(element('p', textOf(source, '#firstunit .company-role'), 'story-role'),
        element('p', textOf(source, '#firstunit .company-content p')),
        link(companyLink.textContent.replace(/\s+/g, ' ').trim(), companyLink.getAttribute('href')));

      var contact = element('nav', '', 'story-contact'); contact.setAttribute('aria-label', 'Contact and social links');
      source.querySelectorAll('.site-footer nav a').forEach(function (item) {
        contact.append(link(item.textContent.trim(), item.getAttribute('href')));
      });
      return {
        me: { title: textOf(source, '.personal-name') + '.', label: textOf(source, '#about .eyebrow'), body: about },
        work: { title: textOf(source, '#experience-heading'), label: 'Desk · Experience', body: experience },
        projects: { title: textOf(source, '#company-heading'), label: 'Workspace · FIRSTUNIT', body: company },
        contact: contact,
      };
    }).catch(function (error) { pending = null; throw error; });
    return pending;
  };
}());

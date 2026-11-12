'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function text(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|svg)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}
function publicKnowledge(root, site) {
  let facts;
  if (site === 'personal') {
    const html = fs.readFileSync(path.join(root, 'about/index.html'), 'utf8');
    const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i);
    if (!main || !footer) throw new Error('Public about source unavailable');
    facts = {source:'https://isaacperez.co/about/', description:text(main[1]), contact:'iperez2435@gmail.com', footer:text(footer[1])};
  } else if (site === 'firstunit') {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const match = html.match(/<script[^>]+id="data"[^>]*>([\s\S]*?)<\/script>/);
    const exported = JSON.parse(match ? match[1] : '{}');
    if (!Array.isArray(exported.projects)) throw new Error('Public project export unavailable');
    const experience = JSON.parse(fs.readFileSync(path.join(root, 'experience-data.json'), 'utf8'));
    const projects = exported.projects.filter(p => p.index !== false).map(p => ({title:p.title, description:p.line,
      availability:p.where, url:p.url, page:'https://firstunit.io/' + p.slug}));
    const codes = new Set(exported.projects.filter(p => p.index !== false).map(p => p.code.replace('—','-')));
    const cases = (experience.caseStudies || []).filter(c => codes.has(c.projectCode)).map(c => ({title:c.title,
      summary:c.summary, role:c.role, deliverables:c.deliverables, page:'https://firstunit.io/case-studies/' + c.slug}));
    facts = {source:'https://firstunit.io', contact:'hello@firstunit.io', services:experience.services, projects, cases};
  } else throw new Error('Unknown voice site');
  const content = JSON.stringify(facts);
  if (content.length > 18000) throw new Error('Approved knowledge exceeds bound');
  return {content, version:crypto.createHash('sha256').update(content).digest('hex').slice(0,16)};
}
module.exports = {publicKnowledge};

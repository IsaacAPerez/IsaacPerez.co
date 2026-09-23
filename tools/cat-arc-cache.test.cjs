'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('live cat takeoffs recheck clearance without growing the route cache', () => {
  const preference = { matches: false, addEventListener() {} };
  const document = { hidden: false, querySelector() { return null; }, getElementById() { return null; }, addEventListener() {} };
  const window = { matchMedia() { return preference; } };
  const context = vm.createContext({ window, document, MutationObserver: class { observe() {} } });
  const source = fs.readFileSync(path.join(__dirname, '../room/mimi.js'), 'utf8');
  const needle = '      canPlace,\n';
  assert.ok(source.includes(needle), 'cat controller audit hook changed');
  vm.runInContext(source.replace(needle, '      canPlace, audit: { nodes, arcCache, jumpDefinition },\n'), context);

  const behaviors = {
    ceiling: 2.65,
    nodes: [
      { id: 'start', kind: 'floor', center: [1, .026, -1], yaw: 0 },
      { id: 'landing', kind: 'floor', center: [1.5, .026, -1], yaw: 0 },
    ],
    edges: [],
  };
  const actor = window.createCatController({ id: 'mimi', name: 'Mimi', behaviors,
    bounds: [{ minX: 0, maxX: 4, minZ: -4.2, maxZ: 0 }], obstacles: [],
    emit() {}, invalidate() {}, getPeers() { return []; } });
  actor.ready({ min: [-.1, 0, -.2], max: [.1, .3, .2], rootHeight: .15,
    feet: [[-.07, 0, -.12], [.07, 0, -.12], [-.07, 0, .12], [.07, 0, .12]] });

  const { nodes, arcCache, jumpDefinition } = actor.audit;
  const start = nodes.get('start'), landing = nodes.get('landing');
  assert.ok(jumpDefinition(start, landing), 'authored route should be clear');
  assert.equal(arcCache.size, 1);
  for (let index = 0; index < 200; index++) {
    const live = { ...start, center: [start.center[0] + index * .0001, start.center[1], start.center[2]], yaw: .001 * index };
    assert.ok(jumpDefinition(live, landing), 'live takeoff should remain clear');
  }
  assert.equal(arcCache.size, 1, 'unique live positions must not be retained');

  const unsafe = { ...start, center: [.01, start.center[1], start.center[2]] };
  assert.equal(jumpDefinition(unsafe, landing), null, 'live clearance must still reject a wall crossing');
  assert.equal(arcCache.size, 1);
});

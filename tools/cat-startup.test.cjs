const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('both cats can start around the corrected door while their peer occupies the floor route', () => {
  const window = { matchMedia() { return { matches: false, addEventListener() {} }; } };
  const document = { hidden: false, querySelector() { return null; }, getElementById() { return null; }, addEventListener() {} };
  const context = vm.createContext({ window, document, MutationObserver: class { observe() {} } });
  for (const file of ['room-config.js', 'mimi.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../room', file), 'utf8'), context);
  }
  const config = window.ROOM_CONFIG;
  const metadata = { min: [-.11, 0, -.3], max: [.11, .35, .3], rootHeight: .19,
    feet: [[-.07, 0, -.12], [.07, 0, -.12], [-.07, 0, .12], [.07, 0, .12]] };
  const peerRadius = Math.hypot(.11, .3) + .09;
  // Cover the aisle between route points as well as the authored stops: either
  // model may finish importing after the first cat has already walked there.
  for (const id of ['mimi', 'charlie']) {
    for (let x = 1; x <= 3.4; x += .1) for (let z = -2.6; z <= -1; z += .1) {
      const actor = window.createCatController({ id, name: id, behaviors: false,
        bounds: config.bounds, obstacles: config.obstacles, route: config.catRoutes[id],
        emit() {}, invalidate() {}, getPeers() { return [{ loaded: true, x, z, y: .026, radius: peerRadius, height: .35 }]; } });
      if (!actor.canPlace(x, z)) continue;
      assert.doesNotThrow(() => actor.ready(metadata), `${id} with peer at ${x}, ${z}`);
      assert.equal(actor.state.loaded, true);
    }
  }
});

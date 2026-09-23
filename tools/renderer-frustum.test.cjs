const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../room/renderer-math.js'), 'utf8'), context);
const math = context.window.RoomRendererMath;
const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const box = (x, y, z, half = 0.1) => ({
  min: [x - half, y - half, z - half], max: [x + half, y + half, z + half],
});

test('frustum culls only objects beyond a clip plane', () => {
  const planes = math.frustumPlanes(identity);
  assert.equal(math.sphereVisible(box(0, 0, 0), planes), true);
  for (const point of [[2, 0, 0], [-2, 0, 0], [0, 2, 0], [0, -2, 0], [0, 0, 2], [0, 0, -2]]) {
    assert.equal(math.sphereVisible(box(...point), planes), false, `${point} should be outside`);
  }
  assert.equal(math.sphereVisible(box(1, 0, 0), planes), true, 'an object crossing the plane remains visible');
  assert.equal(math.sphereVisible(box(2, 0, 0, 2), planes), true, 'large room surfaces remain visible');
});

test('reflected frustum tests the world on the other side of the mirror', () => {
  const reflected = math.reflection([0, 0, 0], [1, 0, 0]).matrix;
  const planes = math.frustumPlanes(reflected);
  assert.equal(math.sphereVisible(box(-0.8, 0, 0), planes), true);
  assert.equal(math.sphereVisible(box(-2, 0, 0), planes), false);
});

test('an in-frustum box corner is never incorrectly rejected', () => {
  const planes = math.frustumPlanes(identity);
  for (let index = 0; index < 1000; index++) {
    const center = [Math.sin(index * 17), Math.sin(index * 31), Math.sin(index * 47)].map(value => value * 2);
    const bounds = box(...center, (index % 10 + 1) / 20);
    const corners = [bounds.min[0], bounds.max[0]].flatMap(x =>
      [bounds.min[1], bounds.max[1]].flatMap(y =>
        [bounds.min[2], bounds.max[2]].map(z => [x, y, z])));
    if (corners.some(corner => corner.every(value => Math.abs(value) <= 1))) {
      assert.equal(math.sphereVisible(bounds, planes), true, `box ${index} was visible`);
    }
  }
});

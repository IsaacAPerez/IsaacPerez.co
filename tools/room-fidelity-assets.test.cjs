const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root, 'room/room-config.js'), 'utf8'), context);
const config = context.window.ROOM_CONFIG;
const local = url => {
  assert.match(url, /^\/room\/[a-z0-9/.-]+$/i);
  return path.join(root, url);
};
const bytes = fs.readFileSync(local(config.modelUrl));
assert.equal(bytes.readUInt32LE(0), 0x46546c67);
assert.equal(bytes.readUInt32LE(4), 2);
assert.equal(bytes.readUInt32LE(8), bytes.length);
const jsonLength = bytes.readUInt32LE(12);
const model = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString());
const binaryOffset = 28 + jsonLength;
const manifest = JSON.parse(fs.readFileSync(local(config.lightingUrl)));

test('every baked surface has valid UV or HDR transport with finite data', () => {
  let atlasSurfaces = 0, vertexSurfaces = 0;
  for (const mesh of model.meshes) for (const primitive of mesh.primitives) {
    const material = model.materials[primitive.material];
    const extras = material.extras || {};
    const position = model.accessors[primitive.attributes.POSITION];
    if (extras.r4LightGroup) {
      assert.ok(manifest.groups[extras.r4LightGroup], mesh.name);
      const uv = model.accessors[primitive.attributes.TEXCOORD_1];
      assert.equal(uv.type, 'VEC2');
      assert.equal(uv.count, position.count);
      atlasSurfaces++;
    }
    if (extras.r5VertexLight) {
      assert.equal(extras.r4LightGroup, undefined, 'lighting must not be counted twice');
      const a = model.accessors[primitive.attributes._R5_IRRADIANCE];
      assert.equal(a.type, 'VEC3');
      assert.equal(a.componentType, 5126, 'HDR must not be clamped to normalized color');
      assert.equal(a.count, position.count);
      const view = model.bufferViews[a.bufferView];
      const offset = binaryOffset + (view.byteOffset || 0) + (a.byteOffset || 0);
      const stride = view.byteStride || 12;
      assert.ok(offset + (a.count - 1) * stride + 12 <= bytes.length);
      let peak = 0;
      for (let i = 0; i < a.count; i++) for (let c = 0; c < 3; c++) {
        const value = bytes.readFloatLE(offset + i * stride + c * 4);
        assert.ok(Number.isFinite(value) && value >= 0, mesh.name);
        peak = Math.max(peak, value);
      }
      if ((material.pbrMetallicRoughness?.metallicFactor ?? 1) < 1) {
        assert.ok(peak > 0, 'diffuse mesh must not lose its illumination: ' + mesh.name);
      }
      vertexSurfaces++;
    }
  }
  assert.ok(atlasSurfaces > 50 && vertexSurfaces > 50);
});

test('curated room retains its reviewed geometry and bounded runtime payload', () => {
  const triangles = model.nodes.filter(n => n.mesh !== undefined).reduce((sum, node) =>
    sum + model.meshes[node.mesh].primitives.reduce((n, primitive) =>
      n + model.accessors[primitive.indices ?? primitive.attributes.POSITION].count / 3, 0), 0);
  assert.equal(triangles, 1171155);
  let payload = bytes.length;
  assert.equal(Object.keys(manifest.groups).length, 4);
  for (const group of Object.values(manifest.groups)) {
    assert.ok(group.rgbmRange > 1);
    const atlas = fs.readFileSync(local(group.url));
    assert.equal(atlas.toString('ascii', 8, 12), 'WEBP');
    payload += atlas.length;
  }
  assert.ok(payload < 90 * 1024 * 1024, 'review increases beyond the 90 MiB room budget');
});

test('public model embeds curated textures and omits private authoring metadata', () => {
  for (const image of model.images) {
    assert.ok(image.bufferView !== undefined);
    assert.equal(image.uri, undefined);
    assert.equal(image.extras, undefined);
  }
  for (const node of model.nodes) assert.equal(node.extras, undefined);
  for (const material of model.materials) for (const key of Object.keys(material.extras || {})) {
    assert.ok(['r4LightGroup', 'r5VertexLight'].includes(key));
  }
  assert.doesNotMatch(JSON.stringify(model), /\/Users\/|\/tmp\/|codex-remote-attachments|r5-private-references/);
});

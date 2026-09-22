(function () {
  'use strict';

  // Static GLB renderer: material maps, punctual lights, and a cached window-light
  // shadow cube. Geometry/navigation remain independent of these lighting passes.
  const canvas = document.getElementById('room-canvas');
  const status = document.getElementById('loading-status');
  if (!canvas) return;
  const config = window.ROOM_CONFIG || {};
  const runtimeMath = window.RoomRendererMath;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
  function fail(error) {
    const message = error instanceof Error ? error.message : String(error);
    const experience = document.getElementById('experience');
    if (experience) experience.classList.remove('entered');
    if (status) { status.hidden = false; status.textContent = 'The room could not load: ' + message; }
    emit('room:error', { message });
    console.error('Room:', error);
  }
  if (!gl) { fail(new Error('This browser does not support WebGL 2.')); return; }
  if (!runtimeMath) { fail(new Error('The room renderer helpers are unavailable.')); return; }

  const identity = () => new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  function multiply(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
    }
    return out;
  }
  function nodeMatrix(node) {
    if (node.matrix) return new Float32Array(node.matrix);
    const [x, y, z, w] = node.rotation || [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale || [1, 1, 1];
    const [tx, ty, tz] = node.translation || [0, 0, 0];
    return new Float32Array([
      (1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0,
      2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0,
      tx, ty, tz, 1,
    ]);
  }
  function normalMatrix(m) {
    // Cofactor matrix / determinant is inverse-transpose, including nonuniform scale.
    const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9];
    const g = m[2], h = m[6], i = m[10];
    const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
    const determinant = a * A + b * B + c * C;
    if (Math.abs(determinant) < 1e-10) throw new Error('A room mesh has a zero scale.');
    return new Float32Array([A, c * h - b * i, b * f - c * e,
      B, a * i - c * g, c * d - a * f, C, b * g - a * h, a * e - b * d].map(v => v / determinant));
  }
  function transformPoint(m, p) {
    return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
      m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
      m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14]];
  }
  function projection(aspect) {
    const f = 1 / Math.tan(72 * Math.PI / 360), near = 0.025, far = 60;
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0,
      (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]);
  }
  function lookAt(eye, target, up) {
    const normalize = v => { const l = Math.hypot(...v) || 1; return v.map(n => n / l); };
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const z = normalize(eye.map((n, i) => n - target[i])), x = normalize(cross(up, z)), y = cross(z, x);
    const dot = v => v.reduce((sum, n, i) => sum + n * eye[i], 0);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x), -dot(y), -dot(z), 1]);
  }

  const spawn = { x: 3.74, z: -0.7, yaw: -0.435, ...(config.spawn || {}) };
  const camera = { x: spawn.x, y: 0.3, z: spawn.z, yaw: spawn.yaw, pitch: -0.04 };
  let mode = 'toy', loaded = false, meshes = [], triangleCount = 0, nearId = null;
  const player = { feetY: 0, velocityY: 0, grounded: true, support: 'floor', jumps: 0, landings: 0,
    distance: 0, lastFootstep: 0 };
  let dirty = true, frameId = 0, lastTime = 0, destroyed = false;
  let lights = [], shadow = null, contactTexture = null;
  let catMeshes = [], mirrors = [], shadowDirty = false, lastShadowUpdate = 0, shadowBuilds = 0;
  let sceneRevision = 0, lastDeskEvent = 0, deskNear = null;
  const lightingPresets = { day: { daylight: 1, lamps: 1, bathroom: 1, warmth: .35 },
    warm: { daylight: .22, lamps: .75, bathroom: .7, warmth: .9 },
    night: { daylight: .015, lamps: .15, bathroom: .08, warmth: 1 } };
  const lighting = { ...lightingPresets.day, preset: 'day' };
  function setLighting(values, preset = null) {
    for (const key of ['daylight', 'lamps', 'bathroom', 'warmth']) {
      if (Number.isFinite(values[key])) lighting[key] = Math.max(0, Math.min(1, values[key]));
    }
    lighting.preset = preset;
    sceneRevision++; emit('lighting:state', { ...lighting }); invalidate();
  }
  function lightGroup(name) { return /bathroom|vanity/i.test(name) ? 'bathroom' : /window|daylight key/i.test(name) ? 'daylight' : 'lamps'; }
  function lampTint(color) {
    const t = lighting.warmth;
    return color.map((value, i) => value * ([1, 1 - .25 * t, 1 - .58 * t][i] / [1, .9125, .797][i]));
  }
  const monitor = { source: null, texture: null, pendingCanvas: null, uploads: 0, version: 0, loaded: false };
  const deskNames = ['70 inch oak standing desk', 'Desk large mat', 'Keyboard base', 'Keyboard keys', 'Mouse',
    'Closed laptop', 'Desk catchall', 'Fabric in desk catchall', 'Desk small speaker', 'Desk small speaker.001',
    'Ultrawide monitor body', 'Ultrawide monitor display', 'Runtime | Monitor screen',
    'Runtime | Desk monitor arm', 'Monitor top light bar', 'Runtime | Desk upper legs', 'Runtime | Desk crossbeam', 'Runtime | Desk controller', 'Runtime | Desk cable tray', 'Runtime | Desk suspended cables'];
  const deskOptions = config.desk || {};
  const desk = { loaded: false, height: 0.998, initial: 0.998, target: 0.998,
    min: Number.isFinite(deskOptions.min) ? deskOptions.min : 0.748,
    max: Number.isFinite(deskOptions.max) ? deskOptions.max : 0.998,
    moving: false, blocked: false, message: '', meshes: [], topCollider: null, colliders: [] };
  const mirrorDefinitions = [
    { id: 'closet', name: 'Runtime | Closet mirror surface', normal: [-1, 0, 0] },
    { id: 'bathroom', name: 'Runtime | Bathroom mirror surface', normal: [-1, 0, 0] },
  ];
  const cats = window.createCatController ? [{ id: 'mimi', name: 'Mimi',
    route: [[2.05,-1.55], [1.45,-1.40], [1.65,-1.13], [2.08,-1.59], [2.72,-1.95], [3.15,-1.78]] }, { id: 'charlie', name: 'Charlie',
    route: [[1.45,-1.40], [1.65,-1.13], [2.08,-1.59], [3.15,-1.78], [2.72,-1.95], [2.05,-1.55]] }] : [];
  let catPlay = null, ballMesh = null;
  const MAX_LIGHTS = 8, SHADOW_NEAR = 0.06, SHADOW_FAR = 16;
  const keys = new Set(), touchMoves = new Map();
  const bounds = config.bounds || [{ minX: 0.08, maxX: 3.94, minZ: -4.12, maxZ: -0.08 }];
  const obstacles = config.obstacles || [], hotspots = config.hotspots || [];
  for (const cat of cats) cat.controller = window.createCatController({ id: cat.id, name: cat.name, route: cat.route,
    bounds, obstacles, emit, invalidate, getPeers: () => cats.filter(peer => peer !== cat && peer.controller).map(peer => peer.controller.obstacle) });
  if (window.createCatPlay && cats.length) catPlay = window.createCatPlay({ cats, config,
    room: () => ({ position: { x: camera.x, y: camera.y, z: camera.z }, yaw: camera.yaw }),
    onState(state) { emit('cat-play:state', state); invalidate(); } });
  function viewMatrix() {
    const sy = Math.sin(camera.yaw), cy = Math.cos(camera.yaw);
    const sp = Math.sin(camera.pitch), cp = Math.cos(camera.pitch);
    const right = [cy, 0, sy], up = [-sy * sp, cp, cy * sp], forward = [sy * cp, sp, -cy * cp];
    const dotEye = v => v[0] * camera.x + v[1] * camera.y + v[2] * camera.z;
    return new Float32Array([right[0], up[0], -forward[0], 0, right[1], up[1], -forward[1], 0,
      right[2], up[2], -forward[2], 0, -dotEye(right), -dotEye(up), dotEye(forward), 1]);
  }
  function shader(type, source) {
    const result = gl.createShader(type);
    gl.shaderSource(result, source); gl.compileShader(result);
    if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(result));
    return result;
  }
  let program, uniforms, depthProgram, depthUniforms;
  try {
    program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, `#version 300 es
      layout(location=0) in vec3 aPosition;
      layout(location=1) in vec3 aNormal;
      layout(location=2) in vec2 aUV;
      layout(location=3) in vec4 aColor;
      layout(location=4) in vec4 aTangent;
      layout(location=5) in vec2 aUV1;
      uniform mat4 uModel, uViewProjection, uActor;
      uniform mat3 uNormal;
      uniform float uHandedness;
      uniform bool uCat;
      uniform vec4 uCatFeet[4], uCatSteps[4];
      uniform vec3 uCatMotion, uCatPose;
      out vec3 vNormal, vWorld;
      out vec2 vUV, vUV1;
      out vec4 vTangent;
      out vec4 vColor;
      vec3 pawMovement(vec3 p, int i) {
        vec2 offset = p.xz - uCatFeet[i].xy;
        float c = cos(uCatSteps[i].w), s = sin(uCatSteps[i].w);
        vec2 rotated = vec2(c * offset.x + s * offset.y, -s * offset.x + c * offset.y);
        return uCatSteps[i].xyz + vec3(rotated.x - offset.x, 0.0, rotated.y - offset.y);
      }
      vec3 deformCat(vec3 p) {
        vec3 movement = vec3(0.0); float weight = 0.0, nearestDistance = 100.0; int nearest = 0;
        // Blend adjoining leg regions continuously: a nearest-paw switch makes
        // a visible crease where the legs join a single generated body mesh.
        for (int i = 0; i < 4; i++) {
          vec4 foot = uCatFeet[i];
          float distance = length(p.xz - foot.xy);
          if (distance < nearestDistance) { nearestDistance = distance; nearest = i; }
          float influence = (1.0 - smoothstep(foot.w * 0.45, foot.w, p.y))
            * (1.0 - smoothstep(foot.z * 0.55, foot.z * 1.8, distance));
          movement += pawMovement(p, i) * influence; weight += influence;
        }
        // The actual model has four disconnected lower legs. Keep each entire
        // paw rigid during contact, then blend into the soft knee/body region.
        float paw = 1.0 - smoothstep(0.025, 0.065, p.y);
        p += mix(movement / max(weight, 1.0), pawMovement(p, nearest), paw);
        p.y += uCatMotion.x * (1.0 - max(min(weight, 1.0), paw));
        float tail = (1.0 - smoothstep(uCatMotion.z - 0.16, uCatMotion.z + 0.04, p.z)) * smoothstep(0.10, 0.22, p.y);
        p.x += uCatMotion.y * tail;
        // Fold the lower legs into the chest while lowering the intact torso.
        // An anchored sole and smooth knee blend keep the loaf on its support.
        float loaf = uCatPose.x, tuck = max(loaf, uCatPose.y);
        float leg = 1.0 - smoothstep(0.045, 0.15, p.y);
        p.x = mix(p.x, p.x * 0.65, tuck * leg);
        p.z = mix(p.z, p.z * 0.58, tuck * leg);
        p.y += max(0.0, tuck - loaf) * 0.075 * leg - loaf * 0.10 * smoothstep(0.0, 0.20, p.y);
        // Curled paws sit beneath the lowered chest; the head keeps its shape.
        p.y = max(p.y, 0.006);
        p.x += loaf * tail * 0.06;
        float pitch = uCatPose.z, py = p.y - 0.15;
        p.y = 0.15 + cos(pitch) * py - sin(pitch) * p.z;
        p.z = sin(pitch) * py + cos(pitch) * p.z;
        return p;
      }
      void main() {
        vec3 point = (uModel * vec4(aPosition, 1.0)).xyz;
        vec3 normal = normalize(uNormal * aNormal), tangent = normalize(mat3(uModel) * aTangent.xyz);
        if (uCat) {
          vec3 moved = deformCat(point);
          vec3 t = normalize(cross(normal, abs(normal.y) < 0.9 ? vec3(0,1,0) : vec3(1,0,0)));
          vec3 b = cross(normal, t);
          normal = normalize(cross(deformCat(point + t * 0.002) - moved, deformCat(point + b * 0.002) - moved));
          tangent = normalize(deformCat(point + tangent * 0.002) - moved);
          point = (uActor * vec4(moved, 1.0)).xyz;
          normal = mat3(uActor) * normal; tangent = mat3(uActor) * tangent;
        }
        vNormal = normal;
        vUV = aUV; vUV1 = aUV1; vColor = aColor;
        vWorld = point;
        vTangent = vec4(tangent, aTangent.w * uHandedness);
        gl_Position = uViewProjection * vec4(vWorld, 1.0);
      }`));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      in vec3 vNormal, vWorld;
      in vec2 vUV, vUV1;
      in vec4 vColor, vTangent;
      uniform vec4 uBase;
      uniform vec4 uCatShadow[2], uCatPaws[8];
      uniform vec2 uCatSupport;
      uniform vec4 uRoomLight;
      uniform vec3 uEmissive, uCamera;
      uniform bool uUnlit, uHasTangent;
      uniform float uAlphaCutoff, uRoughness, uMetallic, uNormalScale, uOcclusionStrength;
      uniform int uMapMask, uUVSets[5], uLightCount, uShadowIndex;
      uniform mat3 uUVTransforms[5];
      uniform vec4 uLightPosition[8], uLightColor[8], uLightDirection[8];
      uniform vec2 uLightCones[8];
      uniform sampler2D uTexture, uNormalTexture, uMRTexture, uEmissiveTexture, uOcclusionTexture, uContactTexture;
      uniform samplerCube uShadowCube;
      uniform bool uClipEnabled;
      uniform vec4 uClipPlane, uDisplayBounds;
      uniform int uSurfaceMode;
      uniform sampler2D uSurfaceTexture;
      uniform mat4 uSurfaceProjection;
      uniform vec2 uShadowPlanes;
      out vec4 outColor;
      const float PI = 3.14159265;
      vec2 uv(int slot) { return (uUVTransforms[slot] * vec3(uUVSets[slot] == 1 ? vUV1 : vUV, 1.0)).xy; }
      vec3 linearColor(vec3 color) { return pow(max(color, vec3(0.0)), vec3(2.2)); }
      vec3 fresnel(float cosine, vec3 f0) { return f0 + (1.0 - f0) * pow(1.0 - cosine, 5.0); }
      float shadowVisibility(vec3 direction, float nDotL) {
        float major = max(max(abs(direction.x), abs(direction.y)), abs(direction.z));
        float near = uShadowPlanes.x, far = uShadowPlanes.y;
        float reference = far / (far - near) - far * near / ((far - near) * max(major, near));
        if (major >= far || major <= near) return 1.0;
        float bias = 0.00008 + 0.00010 * (1.0 - nDotL);
        float radius = 0.007 * length(direction);
        vec3 offsets[5] = vec3[5](vec3(0), vec3(1,0,0), vec3(-1,0,0), vec3(0,1,0), vec3(0,-1,0));
        float visibility = 0.0;
        for (int i = 0; i < 5; i++) visibility += step(reference - bias, texture(uShadowCube, direction + offsets[i] * radius).r);
        return visibility / 5.0;
      }
      vec3 mappedNormal(vec3 n) {
        if ((uMapMask & 2) == 0) return n;
        vec2 coords = uv(1);
        vec3 map = texture(uNormalTexture, coords).xyz * 2.0 - 1.0;
        map.xy *= uNormalScale;
        vec3 t, b;
        if (uHasTangent) {
          t = normalize(vTangent.xyz - n * dot(n, vTangent.xyz));
          b = cross(n, t) * vTangent.w;
        } else {
          vec3 dx = dFdx(vWorld), dy = dFdy(vWorld);
          vec2 tx = dFdx(coords), ty = dFdy(coords);
          vec3 p = cross(dy, n), q = cross(n, dx);
          t = p * tx.x + q * ty.x; b = p * tx.y + q * ty.y;
          float scale = inversesqrt(max(max(dot(t,t), dot(b,b)), 0.0000001));
          t *= scale; b *= scale;
        }
        return normalize(mat3(t, b, n) * map);
      }
      void main() {
        if (uClipEnabled && dot(uClipPlane, vec4(vWorld, 1.0)) < 0.002) discard;
        // Capture textures already contain the display-referred room result.
        // Return them directly, avoiding a second lighting/exposure/gamma pass.
        if (uSurfaceMode == 1) {
          vec4 projected = uSurfaceProjection * vec4(vWorld, 1.0);
          vec2 coords = projected.xy / max(projected.w, 0.00001) * 0.5 + 0.5;
          outColor = vec4(texture(uSurfaceTexture, clamp(coords, 0.0, 1.0)).rgb * vec3(0.975, 0.982, 0.985), 1.0);
          return;
        }
        if (uSurfaceMode == 2) {
          vec2 coords = (vWorld.xy - uDisplayBounds.xy) / uDisplayBounds.zw;
          outColor = vec4(texture(uSurfaceTexture, clamp(coords, 0.0, 1.0)).rgb, 1.0);
          return;
        }
        vec4 base = uBase * vColor;
        if ((uMapMask & 1) != 0) {
          vec4 texel = texture(uTexture, uv(0));
          base *= vec4(linearColor(texel.rgb), texel.a);
        }
        if (base.a < uAlphaCutoff) discard;
        vec3 n = mappedNormal(normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0));
        vec3 v = normalize(uCamera - vWorld), emission = uEmissive;
        if ((uMapMask & 8) != 0) emission *= linearColor(texture(uEmissiveTexture, uv(3)).rgb);
        float roughness = uRoughness, metallic = uMetallic;
        if ((uMapMask & 4) != 0) { vec4 mr = texture(uMRTexture, uv(2)); roughness *= mr.g; metallic *= mr.b; }
        roughness = clamp(roughness, 0.075, 1.0); metallic = clamp(metallic, 0.0, 1.0);
        float ao = (uMapMask & 16) != 0 ? mix(1.0, texture(uOcclusionTexture, uv(4)).r, uOcclusionStrength) : 1.0;
        vec2 floorUV = (vWorld.xz - vec2(-0.2, -5.0)) / vec2(7.6, 5.4);
        float contact = mix(1.0, texture(uContactTexture, floorUV).r,
          exp(-max(vWorld.y, 0.0) * 12.0) * smoothstep(0.3, 0.95, n.y));
        for (int actor = 0; actor < 2; actor++) {
          vec2 catDelta = vWorld.xz - uCatShadow[actor].xy;
          float catCos = cos(uCatShadow[actor].z), catSin = sin(uCatShadow[actor].z);
          vec2 catLocal = vec2(catCos * catDelta.x - catSin * catDelta.y, catSin * catDelta.x + catCos * catDelta.y) / vec2(0.15, 0.27);
          float catContact = exp(-dot(catLocal, catLocal)) * exp(-abs(vWorld.y - uCatSupport[actor]) * 24.0) * smoothstep(0.3, 0.95, n.y);
          contact *= 1.0 - 0.42 * catContact * uCatShadow[actor].w;
        }
        float pawContact = 0.0;
        for (int i = 0; i < 8; i++) {
          vec2 offset = (vWorld.xz - uCatPaws[i].xz) / 0.026;
          pawContact += exp(-dot(offset, offset)) * exp(-abs(vWorld.y - uCatPaws[i].y) * 40.0) * uCatPaws[i].w;
        }
        contact *= 1.0 - 0.48 * min(pawContact, 1.0) * smoothstep(0.3, 0.95, n.y);
        vec3 f0 = mix(vec3(0.04), base.rgb, metallic), color = vec3(0.0);
        float nv = max(dot(n, v), 0.001), alpha = roughness * roughness;
        for (int i = 0; i < 8; i++) {
          if (i >= uLightCount) break;
          bool directional = uLightDirection[i].w > 0.5 && uLightDirection[i].w < 1.5;
          vec3 delta = uLightPosition[i].xyz - vWorld;
          float distance2 = dot(delta, delta);
          vec3 l = directional ? -uLightDirection[i].xyz : delta / max(sqrt(distance2), 0.001);
          float attenuation = directional ? 1.0 : 1.0 / max(distance2, 0.08);
          float range = uLightPosition[i].w;
          if (!directional && range > 0.0) attenuation *= max(0.0, 1.0 - pow(sqrt(distance2) / range, 4.0));
          if (uLightDirection[i].w > 1.5) attenuation *= smoothstep(uLightCones[i].y, uLightCones[i].x, dot(-l, uLightDirection[i].xyz));
          float nl = max(dot(n, l), 0.0);
          if (nl <= 0.0) continue;
          vec3 h = normalize(v + l), f = fresnel(max(dot(h, v), 0.0), f0);
          float nh = max(dot(n, h), 0.0), a2 = alpha * alpha;
          float d = a2 / max(PI * pow(nh * nh * (a2 - 1.0) + 1.0, 2.0), 0.00001);
          float k = pow(roughness + 1.0, 2.0) / 8.0;
          float g = nv / (nv * (1.0 - k) + k) * nl / (nl * (1.0 - k) + k);
          vec3 specular = d * g * f / max(4.0 * nv * nl, 0.001);
          float visibility = i == uShadowIndex ? shadowVisibility(-delta, nl) : 1.0;
          vec3 radiance = uLightColor[i].rgb * uLightColor[i].a * attenuation;
          color += ((1.0 - f) * (1.0 - metallic) * base.rgb / PI + specular) * radiance * nl * visibility;
        }
        vec3 reflected = reflect(-v, n);
        vec3 environment = mix(vec3(0.13,0.115,0.095), vec3(0.36,0.40,0.44), reflected.y * 0.5 + 0.5);
        vec3 ambient = base.rgb * (1.0 - metallic) * mix(0.18, 0.28, n.y * 0.5 + 0.5)
          + environment * fresnel(nv, f0) * (1.0 - roughness * 0.55);
        float bathroom = smoothstep(4.8, 5.6, vWorld.x);
        float ambientLevel = 0.008 + uRoomLight.x * 0.72 + mix(uRoomLight.y, uRoomLight.z, bathroom) * 0.272;
        vec3 ambientTint = mix(vec3(1), vec3(1.04,0.92,0.76), uRoomLight.w * (1.0 - uRoomLight.x));
        color = color * mix(0.60 + 0.40 * contact, 1.0, metallic) + ambient * ambientLevel * ambientTint * ao * contact + emission;
        if (uUnlit) color = base.rgb + emission;
        // Fixed filmic exposure: protect luminous fixtures without dimming the room.
        color *= 0.9;
        color = clamp((color * (2.51 * color + 0.03)) / (color * (2.43 * color + 0.59) + 0.14), 0.0, 1.0);
        outColor = vec4(pow(color, vec3(1.0 / 2.2)), base.a);
      }`));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    uniforms = Object.fromEntries(['Model', 'ViewProjection', 'Normal', 'Base', 'Emissive', 'Camera', 'Handedness', 'HasTangent',
      'Unlit', 'AlphaCutoff', 'Texture', 'NormalTexture', 'MRTexture', 'EmissiveTexture', 'OcclusionTexture', 'ContactTexture',
      'Roughness', 'Metallic', 'NormalScale', 'OcclusionStrength', 'MapMask', 'UVSets', 'UVTransforms', 'LightCount',
      'LightPosition', 'LightColor', 'LightDirection', 'LightCones', 'ShadowIndex', 'ShadowCube', 'ShadowPlanes',
      'Actor', 'Cat', 'CatFeet', 'CatSteps', 'CatMotion', 'CatPose', 'CatShadow', 'CatPaws', 'CatSupport', 'RoomLight',
      'ClipEnabled', 'ClipPlane', 'DisplayBounds', 'SurfaceMode', 'SurfaceTexture', 'SurfaceProjection']
      .map(name => [name, gl.getUniformLocation(program, 'u' + name)]));
    depthProgram = gl.createProgram();
    gl.attachShader(depthProgram, shader(gl.VERTEX_SHADER, `#version 300 es
      layout(location=0) in vec3 aPosition;
      uniform mat4 uModel, uViewProjection;
      void main() { gl_Position = uViewProjection * uModel * vec4(aPosition, 1.0); }`));
    gl.attachShader(depthProgram, shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision highp float;
      void main() { }`));
    gl.linkProgram(depthProgram);
    if (!gl.getProgramParameter(depthProgram, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(depthProgram));
    depthUniforms = { model: gl.getUniformLocation(depthProgram, 'uModel'), view: gl.getUniformLocation(depthProgram, 'uViewProjection') };
  } catch (error) { fail(error); return; }

  function parseGLB(buffer) {
    const view = new DataView(buffer);
    if (buffer.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67) throw new Error('The room file is not a GLB.');
    if (view.getUint32(4, true) !== 2) throw new Error('The room needs glTF version 2.');
    const length = view.getUint32(8, true);
    if (length > buffer.byteLength) throw new Error('The room download is incomplete.');
    let json, binary;
    for (let offset = 12; offset + 8 <= length;) {
      const size = view.getUint32(offset, true), type = view.getUint32(offset + 4, true);
      offset += 8;
      if (offset + size > length) throw new Error('The GLB contains an incomplete chunk.');
      if (type === 0x4e4f534a) json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, offset, size)).replace(/\0+$/, ''));
      if (type === 0x004e4942) binary = buffer.slice(offset, offset + size);
      offset += size;
    }
    if (!json || !binary) throw new Error('The room GLB needs embedded geometry.');
    if ((json.extensionsRequired || []).some(name => ['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(name))) {
      throw new Error('Export the layout as an uncompressed GLB.');
    }
    return { json, binary };
  }
  const componentInfo = {
    5120: { bytes: 1, read: 'getInt8', max: 127 }, 5121: { bytes: 1, read: 'getUint8', max: 255 },
    5122: { bytes: 2, read: 'getInt16', max: 32767 }, 5123: { bytes: 2, read: 'getUint16', max: 65535 },
    5125: { bytes: 4, read: 'getUint32', max: 4294967295 }, 5126: { bytes: 4, read: 'getFloat32' },
  };
  const componentCount = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };
  function accessor(json, binary, index) {
    const a = json.accessors[index], info = componentInfo[a.componentType], count = componentCount[a.type];
    if (!info || !count) throw new Error('Unsupported room vertex format.');
    const result = new Float64Array(a.count * count), data = new DataView(binary);
    const read = offset => {
      const value = data[info.read](offset, true);
      return a.normalized && info.max ? Math.max(-1, value / info.max) : value;
    };
    if (a.bufferView !== undefined) {
      const bv = json.bufferViews[a.bufferView];
      if (bv.buffer !== 0) throw new Error('Room geometry must be embedded in its GLB.');
      const stride = bv.byteStride || count * info.bytes, offset = (bv.byteOffset || 0) + (a.byteOffset || 0);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < count; c++) result[i * count + c] = read(offset + i * stride + c * info.bytes);
    }
    if (a.sparse) {
      const sparse = a.sparse, indices = sparse.indices, values = sparse.values;
      const ib = json.bufferViews[indices.bufferView], vb = json.bufferViews[values.bufferView];
      const ii = componentInfo[indices.componentType];
      for (let i = 0; i < sparse.count; i++) {
        const target = data[ii.read]((ib.byteOffset || 0) + (indices.byteOffset || 0) + i * ii.bytes, true);
        for (let c = 0; c < count; c++) result[target * count + c] = read((vb.byteOffset || 0) + (values.byteOffset || 0) + (i * count + c) * info.bytes);
      }
    }
    return { data: result, count: a.count, components: count, componentType: a.componentType };
  }
  function generatedNormals(positions, indices) {
    const normals = new Float32Array(positions.length), length = indices ? indices.length : positions.length / 3;
    for (let i = 0; i + 2 < length; i += 3) {
      const a = (indices ? indices[i] : i) * 3, b = (indices ? indices[i + 1] : i + 1) * 3;
      const c = (indices ? indices[i + 2] : i + 2) * 3;
      const u = [positions[b] - positions[a], positions[b + 1] - positions[a + 1], positions[b + 2] - positions[a + 2]];
      const v = [positions[c] - positions[a], positions[c + 1] - positions[a + 1], positions[c + 2] - positions[a + 2]];
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      for (const base of [a, b, c]) for (let k = 0; k < 3; k++) normals[base + k] += n[k];
    }
    for (let i = 0; i < normals.length; i += 3) {
      const length = Math.hypot(normals[i], normals[i + 1], normals[i + 2]) || 1;
      for (let k = 0; k < 3; k++) normals[i + k] /= length;
    }
    return normals;
  }
  async function textureFromImage(json, binary, textureIndex) {
    const definition = json.textures[textureIndex], image = json.images[definition.source];
    let blob;
    if (image.bufferView !== undefined) {
      const bv = json.bufferViews[image.bufferView];
      blob = new Blob([binary.slice(bv.byteOffset || 0, (bv.byteOffset || 0) + bv.byteLength)], { type: image.mimeType });
    } else if (image.uri && image.uri.startsWith('data:')) {
      blob = await (await fetch(image.uri)).blob();
    } else throw new Error('Room textures must be embedded in the GLB.');
    let bitmap, objectURL;
    if (window.createImageBitmap) bitmap = await createImageBitmap(blob, { colorSpaceConversion: 'none' });
    else {
      objectURL = URL.createObjectURL(blob);
      bitmap = await new Promise((resolve, reject) => {
        const img = new Image(); img.onload = () => resolve(img); img.onerror = () => reject(new Error('A room texture could not be decoded.')); img.src = objectURL;
      });
    }
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    const sampler = (json.samplers || [])[definition.sampler] || {};
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, sampler.wrapS || gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, sampler.wrapT || gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, sampler.magFilter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, sampler.minFilter || gl.LINEAR_MIPMAP_LINEAR);
    gl.generateMipmap(gl.TEXTURE_2D);
    if (bitmap.close) bitmap.close();
    if (objectURL) URL.revokeObjectURL(objectURL);
    return texture;
  }
  async function importModel(url, anatomy = false) {
    const imported = [], importedLights = [], samples = [];
    let triangles = 0;
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Room model returned HTTP ' + response.status + '.');
    const { json, binary } = parseGLB(await response.arrayBuffer());
    const materialDefinitions = json.materials || [];
    const textures = new Map();
    const mapInfos = m => [m.pbrMetallicRoughness && m.pbrMetallicRoughness.baseColorTexture, m.normalTexture,
      m.pbrMetallicRoughness && m.pbrMetallicRoughness.metallicRoughnessTexture, m.emissiveTexture, m.occlusionTexture];
    for (const m of materialDefinitions) {
      for (const texture of mapInfos(m)) if (texture && !textures.has(texture.index)) {
        textures.set(texture.index, await textureFromImage(json, binary, texture.index));
      }
    }
    const materials = materialDefinitions.map(m => {
      const pbr = m.pbrMetallicRoughness || {}, infos = mapInfos(m);
      const strength = m.extensions && m.extensions.KHR_materials_emissive_strength;
      const transforms = infos.map(info => {
        const t = info && info.extensions && info.extensions.KHR_texture_transform || {};
        const [sx, sy] = t.scale || [1, 1], [x, y] = t.offset || [0, 0], c = Math.cos(t.rotation || 0), s = Math.sin(t.rotation || 0);
        return [c * sx, s * sx, 0, -s * sy, c * sy, 0, x, y, 1];
      });
      return { base: pbr.baseColorFactor || [1, 1, 1, 1], maps: infos.map(info => info ? textures.get(info.index) : null),
        mapMask: infos.reduce((mask, info, i) => mask | (info ? 1 << i : 0), 0), transforms: new Float32Array(transforms.flat()),
        uvSets: new Int32Array(infos.map(info => { const t = info && info.extensions && info.extensions.KHR_texture_transform;
          return t && t.texCoord !== undefined ? t.texCoord : info && info.texCoord || 0; })),
        roughness: pbr.roughnessFactor === undefined ? 1 : pbr.roughnessFactor,
        metallic: pbr.metallicFactor === undefined ? 1 : pbr.metallicFactor,
        normalScale: m.normalTexture && m.normalTexture.scale !== undefined ? m.normalTexture.scale : 1,
        occlusionStrength: m.occlusionTexture && m.occlusionTexture.strength !== undefined ? m.occlusionTexture.strength : 1,
        emissive: (m.emissiveFactor || [0, 0, 0]).map(v => v * (strength ? strength.emissiveStrength : 1)),
        blend: m.alphaMode === 'BLEND', cutoff: m.alphaMode === 'MASK' ? (m.alphaCutoff === undefined ? 0.5 : m.alphaCutoff) : -1,
        unlit: !!(m.extensions && m.extensions.KHR_materials_unlit), doubleSided: !!m.doubleSided };
    });
    const fallback = { base: [0.7, 0.7, 0.7, 1], emissive: [0, 0, 0], cutoff: -1, maps: [], mapMask: 0, roughness: 0.8, metallic: 0,
      normalScale: 1, occlusionStrength: 1, uvSets: new Int32Array(5), transforms: new Float32Array(Array(5).fill([1,0,0,0,1,0,0,0,1]).flat()) };
    function addPrimitive(primitive, model, ceiling, name) {
      if (primitive.mode !== undefined && primitive.mode !== 4) throw new Error('The layout exporter must use triangle meshes.');
      const attrs = primitive.attributes, material = materials[primitive.material] || fallback;
      const position = accessor(json, binary, attrs.POSITION);
      const index = primitive.indices === undefined ? null : accessor(json, binary, primitive.indices);
      const normal = attrs.NORMAL === undefined ? generatedNormals(position.data, index && index.data) : accessor(json, binary, attrs.NORMAL).data;
      const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
      function attribute(location, data, components) {
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(location); gl.vertexAttribPointer(location, components, gl.FLOAT, false, 0, 0);
      }
      attribute(0, position.data, 3); attribute(1, normal, 3);
      for (const [set, location] of [[0, 2], [1, 5]]) {
        const index = attrs['TEXCOORD_' + set];
        if (index !== undefined) attribute(location, accessor(json, binary, index).data, 2);
        else { gl.disableVertexAttribArray(location); gl.vertexAttrib2f(location, 0, 0); }
      }
      if (attrs.TANGENT !== undefined) attribute(4, accessor(json, binary, attrs.TANGENT).data, 4);
      else { gl.disableVertexAttribArray(4); gl.vertexAttrib4f(4, 1, 0, 0, 1); }
      if (attrs.COLOR_0 !== undefined) { const color = accessor(json, binary, attrs.COLOR_0); attribute(3, color.data, color.components); }
      else { gl.disableVertexAttribArray(3); gl.vertexAttrib4f(3, 1, 1, 1, 1); }
      let indexType;
      if (index) {
        const constructors = { 5121: Uint8Array, 5123: Uint16Array, 5125: Uint32Array };
        if (!constructors[index.componentType]) throw new Error('Unsupported triangle index format.');
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new constructors[index.componentType](index.data), gl.STATIC_DRAW);
        indexType = index.componentType;
      }
      const center = [0, 0, 0];
      for (let i = 0; i < position.data.length; i++) center[i % 3] += position.data[i] / position.count;
      const count = index ? index.count : position.count;
      const worldBounds = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
      for (let i = 0; i < position.data.length; i += 3) {
        const p = transformPoint(model, position.data.subarray(i, i + 3));
        p.forEach((v, axis) => { worldBounds.min[axis] = Math.min(worldBounds.min[axis], v); worldBounds.max[axis] = Math.max(worldBounds.max[axis], v); });
      }
      imported.push({ name, bounds: worldBounds, originalBounds: { min: worldBounds.min.slice(), max: worldBounds.max.slice() },
        originalModel: new Float32Array(model), vao, material, model, normal: normalMatrix(model), indexType, count, ceiling, hasTangent: attrs.TANGENT !== undefined, center: transformPoint(model, center),
        mirrored: model[0] * (model[5] * model[10] - model[6] * model[9]) - model[4] * (model[1] * model[10] - model[2] * model[9]) + model[8] * (model[1] * model[6] - model[2] * model[5]) < 0 });
      triangles += Math.floor(count / 3);
      if (anatomy) for (let i = 0; i < position.data.length; i += 3) samples.push(transformPoint(model, position.data.subarray(i, i + 3)));
    }
    const visit = (index, parent, parentCeiling = false) => {
      const node = json.nodes[index], model = multiply(parent, nodeMatrix(node));
      // Overview is a cutaway; first-person modes retain the enclosing geometry.
      const ceiling = parentCeiling || /ceiling|soffit/i.test(node.name || '') || /^(South wall|Bathroom South wall)$/.test(node.name || '');
      if (node.mesh !== undefined) for (const primitive of json.meshes[node.mesh].primitives) addPrimitive(primitive, model, ceiling, node.name || '');
      const reference = node.extensions && node.extensions.KHR_lights_punctual;
      if (reference && json.extensions && json.extensions.KHR_lights_punctual) {
        const light = json.extensions.KHR_lights_punctual.lights[reference.light];
        const direction = [-model[8], -model[9], -model[10]], length = Math.hypot(...direction) || 1;
        importedLights.push({ name: light.name || node.name || '', position: transformPoint(model, [0, 0, 0]),
          direction: direction.map(v => v / length), type: light.type === 'directional' ? 1 : light.type === 'spot' ? 2 : 0,
          intensity: light.intensity === undefined ? 1 : light.intensity, color: light.color || [1, 1, 1], range: light.range || 0,
          cones: [Math.cos(light.spot && light.spot.innerConeAngle || 0), Math.cos(light.spot && light.spot.outerConeAngle || Math.PI / 4)] });
      }
      for (const child of node.children || []) visit(child, model, ceiling);
    };
    const scene = json.scenes && json.scenes[json.scene || 0];
    if (!scene) throw new Error('The room GLB has no scene.');
    for (const root of scene.nodes || []) visit(root, identity());
    if (!imported.length) throw new Error('The GLB contains no visible meshes.');
    return { meshes: imported, lights: importedLights, triangles, samples };
  }
  function makeBallMesh() {
    const radius = .057, vertices = [], normals = [];
    const rings = 8, slices = 12;
    const spherePoint = (latitude, longitude) => {
      const phi = latitude * Math.PI / rings, theta = longitude * 2 * Math.PI / slices;
      return [Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)];
    };
    function vertex(point) { vertices.push(...point.map(value => value * radius)); normals.push(...point); }
    for (let latitude = 0; latitude < rings; latitude++) for (let longitude = 0; longitude < slices; longitude++) {
      const a = spherePoint(latitude, longitude), b = spherePoint(latitude + 1, longitude),
        c = spherePoint(latitude + 1, longitude + 1), d = spherePoint(latitude, longitude + 1);
      vertex(a); vertex(b); vertex(c); vertex(a); vertex(c); vertex(d);
    }
    const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
    for (const [slot, values] of [[0, vertices], [1, normals]]) {
      const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(values), gl.STATIC_DRAW);
      gl.enableVertexAttribArray(slot); gl.vertexAttribPointer(slot, 3, gl.FLOAT, false, 0, 0);
    }
    for (const slot of [2, 3, 4, 5]) gl.disableVertexAttribArray(slot);
    gl.vertexAttrib2f(2, 0, 0); gl.vertexAttrib4f(3, 1, 1, 1, 1);
    gl.vertexAttrib4f(4, 1, 0, 0, 1); gl.vertexAttrib2f(5, 0, 0);
    gl.bindVertexArray(null);
    return { name: 'Runtime | Cat play ball', vao, model: identity(), normal: new Float32Array([1,0,0,0,1,0,0,0,1]),
      center: [0,0,0], bounds: { min: [-radius,-radius,-radius], max: [radius,radius,radius] },
      material: { base: [.93,.31,.19,1], emissive: [0,0,0], cutoff: -1, maps: [], mapMask: 0,
        roughness: .62, metallic: 0, normalScale: 1, occlusionStrength: 1, unlit: false,
        blend: false, doubleSided: false, uvSets: new Int32Array(5),
        transforms: new Float32Array(Array(5).fill([1,0,0,0,1,0,0,0,1]).flat()) },
      indexType: null, count: vertices.length / 3, hasTangent: false, mirrored: false, ceiling: false };
  }
  async function loadModel() {
    const model = await importModel(config.modelUrl || '/room/room-cat-furniture.glb');
    meshes = model.meshes; lights = model.lights; triangleCount = model.triangles;
    if (!lights.length) lights = [{ name: 'Window fallback', position: [0.2, 1.75, -1.3], direction: [0, -1, 0], type: 0,
      intensity: 9, color: [0.84, 0.91, 1], range: 0, cones: [1, 0] }];
    lights = lights.slice(0, MAX_LIGHTS);
    initializeRuntimeSurfaces();
    if (catPlay) ballMesh = makeBallMesh();
    buildContactTexture(); buildShadowCube();
    gl.bindVertexArray(null);
    loaded = true;
    if (status) { status.textContent = 'Room ready'; status.hidden = false; }
    emit('room:ready', { meshes: meshes.length, triangles: triangleCount });
    notifyDesk(true);
    updateProximity(true); invalidate();
    await Promise.all(cats.map(cat => loadCat(cat).catch(error => {
      emit(cat.id + ':error', { message: error.message }); console.warn(cat.name + ':', error.message);
    })));
  }
  async function loadCat(cat) {
    const response = await fetch('/room/' + cat.id + '/asset.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(cat.name + '’s 3D model is not ready yet.');
    const manifest = await response.json();
    if (manifest.status === 'pending') { emit(cat.id + ':pending', { message: manifest.message || cat.name + '’s 3D model is being prepared.' }); return; }
    if (manifest.status !== 'ready') throw new Error(manifest.message || cat.name + '’s model is unavailable.');
    const model = await importModel(manifest.modelUrl || '/room/' + cat.id + '/' + cat.id + '.glb', true);
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    model.samples.forEach(p => p.forEach((v, i) => { min[i] = Math.min(min[i], v); max[i] = Math.max(max[i], v); }));
    const height = max[1] - min[1], low = model.samples.filter(p => p[1] < min[1] + height * 0.10);
    let feet = manifest.feet;
    if (!feet) {
      const xs = low.map(p => p[0]).sort((a, b) => a - b), zs = low.map(p => p[2]).sort((a, b) => a - b);
      const quantile = (a, f) => a[Math.min(a.length - 1, Math.floor(a.length * f))];
      feet = [[quantile(xs,.2),0,quantile(zs,.8)], [quantile(xs,.8),0,quantile(zs,.8)],
        [quantile(xs,.2),0,quantile(zs,.2)], [quantile(xs,.8),0,quantile(zs,.2)]];
      for (let pass = 0; pass < 12; pass++) {
        const totals = feet.map(() => [0, 0, 0]);
        for (const p of low) {
          let nearest = 0, distance = Infinity;
          feet.forEach((foot, i) => { const d = Math.hypot(p[0] - foot[0], p[2] - foot[2]); if (d < distance) { distance = d; nearest = i; } });
          totals[nearest][0] += p[0]; totals[nearest][1] += p[2]; totals[nearest][2]++;
        }
        feet = totals.map((sum, i) => sum[2] ? [sum[0] / sum[2], 0, sum[1] / sum[2]] : feet[i]);
      }
      feet.sort((a, b) => b[2] - a[2]);
      feet = [...feet.slice(0, 2).sort((a, b) => a[0] - b[0]), ...feet.slice(2).sort((a, b) => a[0] - b[0])];
    }
    cat.controller.ready({ min, max, feet, rootHeight: manifest.rootHeight, legRadius: manifest.legRadius });
    cat.triangles = model.triangles;
    catMeshes.push(...model.meshes.map(mesh => ({ ...mesh, cat })));
    updateProximity(true); invalidate();
  }

  function sceneSuspended() {
    const refs = document.getElementById('references');
    return document.hidden || !!document.querySelector('dialog[open]') || !!(refs && !refs.hidden);
  }
  function deskState() {
    return { loaded: desk.loaded, height: desk.height, target: desk.target, min: desk.min, max: desk.max,
      moving: desk.moving, blocked: desk.blocked, message: desk.message, offset: desk.height - desk.initial,
      movingMeshes: [...new Set(desk.meshes.map(mesh => mesh.name))],
      bounds: desk.meshes.map(mesh => ({ name: mesh.name, min: mesh.bounds.min.slice(), max: mesh.bounds.max.slice() })) };
  }
  function notifyDesk(force = false) {
    const now = performance.now();
    if (force || now - lastDeskEvent > 100) { lastDeskEvent = now; emit('desk:state', deskState()); }
  }
  function initializeRuntimeSurfaces() {
    for (const definition of mirrorDefinitions) {
      const surfaces = meshes.filter(mesh => mesh.name === definition.name);
      if (!surfaces.length) continue;
      const min = [0, 1, 2].map(i => Math.min(...surfaces.map(mesh => mesh.bounds.min[i])));
      const max = [0, 1, 2].map(i => Math.max(...surfaces.map(mesh => mesh.bounds.max[i])));
      const point = min.map((v, i) => (v + max[i]) / 2);
      const mirror = { ...definition, ...runtimeMath.reflection(point, definition.normal), point, min, max,
        corners: [[point[0],min[1],min[2]], [point[0],min[1],max[2]], [point[0],max[1],min[2]], [point[0],max[1],max[2]]],
        captures: 0, lastTime: 0, width: 0, height: 0, target: null, visible: false, reason: 'not rendered', signature: '' };
      mirrors.push(mirror); surfaces.forEach(mesh => { mesh.mirror = mirror; });
    }
    meshes.filter(mesh => mesh.name === 'Runtime | Monitor screen').forEach(mesh => { mesh.screen = true; });
    const desktop = meshes.find(mesh => mesh.name === '70 inch oak standing desk');
    desk.loaded = !!desktop && meshes.some(mesh => mesh.name === 'Runtime | Desk upper legs');
    if (desk.loaded) {
      desk.initial = Math.round(desktop.bounds.max[1] * 1000) / 1000;
      desk.height = desk.target = desk.initial;
      desk.meshes = meshes.filter(mesh => deskNames.includes(mesh.name));
      desk.meshes.forEach(mesh => { mesh.originalCenter = mesh.center.slice(); });
      for (const box of obstacles) if (/^Desk (top|left leg|right leg)$/i.test(box.name || '')) {
        desk.colliders.push({ box, minY: box.minY || 0, maxY: box.maxY });
        if (box.name === 'Desk top') desk.topCollider = { ...box };
      }
    }
    if (window.createMonitorScreen && meshes.some(mesh => mesh.screen)) {
      monitor.source = window.createMonitorScreen({ onChange(painted) { monitor.pendingCanvas = painted; invalidate(); } });
      monitor.pendingCanvas = monitor.source.canvas;
      monitor.source.ready.then(() => { monitor.pendingCanvas = monitor.source.canvas; invalidate(); });
    }
  }
  function uploadMonitor() {
    if (!monitor.pendingCanvas) return;
    if (!monitor.texture) {
      monitor.texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, monitor.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, monitor.texture); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, monitor.pendingCanvas);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    monitor.pendingCanvas = null; monitor.uploads++; monitor.version++; monitor.loaded = true; sceneRevision++;
  }
  function deskClear(height) {
    if (mode === 'toy' && player.grounded && player.support === 'desk')
      // The rider moves with the top. Testing the proposed height against the
      // *old* top collider would mistake the desk itself for a ceiling.
      return height + .3 < 2.35 && canOccupy(camera.x, camera.z, player.feetY, 'desk');
    return mode === 'overview' || !desk.topCollider || runtimeMath.deskClearance(desk.topCollider, height - desk.initial, camera);
  }
  function applyDeskHeight(height) {
    const previous = desk.height;
    desk.height = height;
    const offset = height - desk.initial;
    for (const mesh of desk.meshes) {
      mesh.model[13] = mesh.originalModel[13] + offset;
      mesh.center[1] = mesh.originalCenter[1] + offset;
      mesh.bounds.min[1] = mesh.originalBounds.min[1] + offset; mesh.bounds.max[1] = mesh.originalBounds.max[1] + offset;
    }
    for (const { box, minY, maxY } of desk.colliders) {
      box.minY = box.name === 'Desk top' ? minY + offset : minY;
      box.maxY = maxY + offset;
    }
    if (mode === 'toy' && player.grounded && player.support === 'desk') {
      player.feetY += height - previous;
      camera.y = player.feetY + .3;
      emit('room:platform', { support: 'desk', height: player.feetY });
    }
    sceneRevision++; shadowDirty = true; dirty = true;
  }
  function setDeskHeight(value) {
    const height = runtimeMath.deskHeight(value, desk.min, desk.max);
    if (!desk.loaded || height === null) return false;
    desk.blocked = height < desk.height && !deskClear(height);
    if (desk.blocked) {
      desk.target = desk.height; desk.moving = false; desk.message = 'Move out from under the desk before lowering it.';
      notifyDesk(true); return false;
    }
    desk.message = ''; desk.target = height; desk.moving = Math.abs(height - desk.height) > 0.00001;
    notifyDesk(true); invalidate(); return true;
  }
  function stepDesk(dt) {
    if (!desk.moving || sceneSuspended()) return;
    const height = runtimeMath.deskStep(desk.height, desk.target, dt, motionPreference.matches);
    if (height < desk.height && !deskClear(height)) {
      desk.target = desk.height; desk.moving = false; desk.blocked = true;
      desk.message = 'Move out from under the desk before lowering it.'; notifyDesk(true); return;
    }
    applyDeskHeight(height);
    desk.moving = Math.abs(desk.target - height) > 0.00001;
    notifyDesk(!desk.moving);
  }
  function mirrorState() {
    return mirrors.map(mirror => ({ name: mirror.name, plane: Array.from(mirror.plane), min: mirror.min.slice(), max: mirror.max.slice(),
      captures: mirror.captures, width: mirror.width, height: mirror.height, visible: mirror.visible, reason: mirror.reason,
      lastCaptureCamera: mirror.lastCaptureCamera, reflectedEye: mirror.reflectedEye, sceneRevision: mirror.sceneRevision }));
  }
  function mirrorTarget(mirror, width, height) {
    const scale = Math.min(512 / width, 512 / height, 1), w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    if (mirror.target && mirror.width === w && mirror.height === h) return;
    if (mirror.target) { gl.deleteTexture(mirror.target.texture); gl.deleteRenderbuffer(mirror.target.depth); gl.deleteFramebuffer(mirror.target.framebuffer); }
    const texture = gl.createTexture(), depth = gl.createRenderbuffer(), framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindRenderbuffer(gl.RENDERBUFFER, depth); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, depth);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0); gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
    if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('The browser could not allocate a mirror capture.');
    mirror.target = { texture, depth, framebuffer }; mirror.width = w; mirror.height = h; mirror.signature = '';
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  function buildContactTexture() {
    // A small static floor-occlusion field adds contact at furniture feet without
    // a screen-space pass. It affects only upward surfaces near floor height.
    const size = 256, data = new Uint8Array(size * size);
    const feet = obstacles.filter(b => (b.minY || 0) < 0.07 && (b.maxY || 3) > 0.15);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const px = -0.2 + (x + 0.5) / size * 7.6, pz = -5 + (y + 0.5) / size * 5.4;
      let occlusion = 1;
      for (const b of feet) {
        const dx = Math.max(b.minX - px, 0, px - b.maxX), dz = Math.max(b.minZ - pz, 0, pz - b.maxZ);
        occlusion = Math.min(occlusion, 1 - 0.52 * Math.exp(-(dx * dx + dz * dz) / 0.022));
      }
      data[y * size + x] = Math.round(occlusion * 255);
    }
    contactTexture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, contactTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, size, size, 0, gl.RED, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }
  function buildShadowCube() {
    let lightIndex = lights.findIndex(light => /window|daylight/i.test(light.name) && light.type !== 1);
    if (lightIndex < 0) lightIndex = lights.findIndex(light => light.type !== 1);
    if (lightIndex < 0) return;
    const size = shadow ? shadow.size : canvas.clientWidth < 700 ? 512 : 1024;
    const texture = shadow ? shadow.texture : gl.createTexture(), framebuffer = shadow ? shadow.framebuffer : gl.createFramebuffer();
    if (!shadow) {
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, texture);
      for (let face = 0; face < 6; face++) gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, 0, gl.DEPTH_COMPONENT24, size, size, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
      for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T, gl.TEXTURE_WRAP_R]) gl.texParameteri(gl.TEXTURE_CUBE_MAP, parameter, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
    const near = SHADOW_NEAR, far = SHADOW_FAR;
    const perspective = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,-(far+near)/(far-near),-1, 0,0,-2*far*near/(far-near),0]);
    const faces = [[1,0,0, 0,-1,0], [-1,0,0, 0,-1,0], [0,1,0, 0,0,1], [0,-1,0, 0,0,-1], [0,0,1, 0,-1,0], [0,0,-1, 0,-1,0]];
    const eye = lights[lightIndex].position;
    gl.useProgram(depthProgram); gl.viewport(0, 0, size, size); gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
    gl.disable(gl.BLEND); gl.disable(gl.CULL_FACE); gl.colorMask(false, false, false, false);
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1, 2);
    for (let face = 0; face < 6; face++) {
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_CUBE_MAP_POSITIVE_X + face, texture, 0);
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('The browser could not allocate the room shadow map.');
      gl.clear(gl.DEPTH_BUFFER_BIT);
      const axis = faces[face], view = lookAt(eye, eye.map((v, i) => v + axis[i]), axis.slice(3));
      gl.uniformMatrix4fv(depthUniforms.view, false, multiply(perspective, view));
      for (const mesh of meshes) {
        // Transparent display cases and luminous bulbs must not become opaque occluders.
        if (mesh.mirror || mesh.screen || mesh.material.blend || mesh.material.unlit || mesh.material.base[3] < 0.5) continue;
        gl.bindVertexArray(mesh.vao); gl.uniformMatrix4fv(depthUniforms.model, false, mesh.model);
        if (mesh.indexType) gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0); else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      }
    }
    gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true, true, true, true);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    shadow = { texture, lightIndex, size, framebuffer }; shadowDirty = false; lastShadowUpdate = performance.now(); shadowBuilds++;
  }

  function bedHeight(x, z) {
    const grid = window.ROOM_CAT_BEHAVIORS && window.ROOM_CAT_BEHAVIORS.bedHeightGrid;
    if (!grid) return .77;
    const xs = grid.x_values, zs = grid.z_values;
    const segment = (values, value) => {
      let i = 0;
      while (i < values.length - 2 && values[i + 1] < value) i++;
      const t = Math.max(0, Math.min(1, (value - values[i]) / (values[i + 1] - values[i])));
      return [i, t];
    };
    const [ix, tx] = segment(xs, x), [iz, tz] = segment(zs, z), rows = grid.height_rows;
    const a = rows[iz][ix] * (1 - tx) + rows[iz][ix + 1] * tx;
    const b = rows[iz + 1][ix] * (1 - tx) + rows[iz + 1][ix + 1] * tx;
    return a * (1 - tz) + b * tz;
  }
  function supportAt(x, z, desired = Infinity) {
    const surfaces = [{ id: 'floor', height: 0 }];
    if (mode === 'toy') {
      // Match the horizontal collision extents. A smaller landing footprint
      // lets the toy cross a visible top and then fall through its outer rim.
      if (x >= .05 && x <= 1.74 && z >= -4.10 && z <= -2.04)
        surfaces.push({ id: 'bed', height: bedHeight(x, z) });
      if (x >= 2.58 && x <= 3.35 && z >= -3.45 && z <= -2.69)
        surfaces.push({ id: 'chair', height: .56 });
      if (desk.loaded && x >= 2.111 && x <= 3.889 && z >= -4.13 && z <= -3.45)
        surfaces.push({ id: 'desk', height: desk.height + .008 });
    }
    return surfaces.filter(surface => surface.height <= desired + .025)
      .sort((a, b) => b.height - a.height)[0] || { id: 'floor', height: 0 };
  }
  function canOccupy(x, z, feetY, support = null) {
    const eyeHeight = mode === 'toy' ? .3 : mode === 'human' ? 1.55 : .3;
    const height = feetY + eyeHeight;
    const radius = 0.10;
    // The union lets the bedroom and corridor share a threshold without an
    // invisible seam. Perimeter samples keep the player's body inside it.
    for (let i = 0; i < 16; i++) {
      const px = x + Math.cos(i * Math.PI / 8) * radius, pz = z + Math.sin(i * Math.PI / 8) * radius;
      if (!bounds.some(b => px >= b.minX && px <= b.maxX && pz >= b.minZ && pz <= b.maxZ)) return false;
    }
    for (const b of obstacles) {
      if ((b.minY === undefined ? 0 : b.minY) >= height + 0.10 || (b.maxY === undefined ? 3 : b.maxY) <= feetY + 0.04) continue;
      // Clear each furniture edge as soon as the toy's feet reach its top.
      // Waiting for the center to enter the smaller landing area creates an
      // invisible rim around the bed, chair, and desk.
      if (mode === 'toy' &&
          ((b.name === 'Bed' && feetY >= bedHeight(x, z) - .018) ||
           (b.name === 'Chair' && feetY >= .56 - .018) ||
           (b.name === 'Desk top' && feetY >= desk.height + .008 - .018))) continue;
      const nearestX = Math.max(b.minX, Math.min(x, b.maxX)), nearestZ = Math.max(b.minZ, Math.min(z, b.maxZ));
      if (Math.hypot(x - nearestX, z - nearestZ) < radius) return false;
    }
    return true;
  }
  function canStand(x, z, height = camera.y) {
    return canOccupy(x, z, Math.max(0, height - (mode === 'human' ? 1.55 : .3)));
  }
  function move(dx, dz) {
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.035));
    for (let i = 0; i < steps; i++) {
      if (canOccupy(camera.x + dx / steps, camera.z, player.feetY)) camera.x += dx / steps;
      if (canOccupy(camera.x, camera.z + dz / steps, player.feetY)) camera.z += dz / steps;
    }
  }
  function jumpPlayer() {
    if (mode !== 'toy' || !loaded || inputBlocked() || !player.grounded) return false;
    player.grounded = false; player.support = null; player.velocityY = 4.5; player.jumps++;
    emit('room:jump', { x: camera.x, z: camera.z, feetY: player.feetY }); invalidate(); return true;
  }
  function stepPlayer(dt) {
    if (mode !== 'toy' || dt <= 0) return;
    if (player.grounded) {
      const under = supportAt(camera.x, camera.z, player.feetY + .05);
      if (under.id === player.support && Math.abs(under.height - player.feetY) < .08) player.feetY = under.height;
      else if (under.height < player.feetY - .08) {
        player.grounded = false; player.support = null; player.velocityY = 0;
      }
    }
    if (!player.grounded) {
      const previous = player.feetY;
      const next = Math.min(2.32, Math.max(0, previous + player.velocityY * dt - 5.2 * dt * dt));
      player.velocityY = next >= 2.32 ? Math.min(0, player.velocityY) : player.velocityY - 10.4 * dt;
      const below = supportAt(camera.x, camera.z, previous + .02);
      if (player.velocityY <= 0 && next <= below.height + .006 && previous >= below.height - .015 &&
          canOccupy(camera.x, camera.z, below.height, below.id)) {
        player.feetY = below.height; player.velocityY = 0; player.grounded = true;
        player.support = below.id; player.landings++;
        emit('room:land', { support: below.id, x: camera.x, z: camera.z, feetY: player.feetY });
      } else player.feetY = next;
    }
    camera.y = player.feetY + .3;
    dirty = true;
  }
  function rayBox(origin, target, min, max) {
    const vector = target.map((value, i) => value - origin[i]);
    let entry = 0, exit = 1;
    for (let i = 0; i < 3; i++) {
      if (Math.abs(vector[i]) < 1e-8) {
        if (origin[i] < min[i] || origin[i] > max[i]) return null;
      } else {
        const a = (min[i] - origin[i]) / vector[i], b = (max[i] - origin[i]) / vector[i];
        entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
        if (entry > exit) return null;
      }
    }
    return entry;
  }
  function visibility(point, options = {}) {
    if (!loaded || !Array.isArray(point) || point.length !== 3 || !point.every(Number.isFinite))
      return { visible: false, reason: 'The view is not ready.' };
    const origin = [camera.x, camera.y, camera.z], delta = point.map((value, i) => value - origin[i]);
    const distance = Math.hypot(...delta);
    if (distance < .05 || distance > (options.maxDistance || 5.5)) return { visible: false, reason: 'Move closer to the subject.' };
    const targetYaw = Math.atan2(delta[0], -delta[2]);
    const yawDifference = Math.atan2(Math.sin(targetYaw - camera.yaw), Math.cos(targetYaw - camera.yaw));
    const targetPitch = Math.atan2(delta[1], Math.hypot(delta[0], delta[2]));
    if (Math.abs(yawDifference) > (options.horizontalAngle || .76) || Math.abs(targetPitch - camera.pitch) > (options.verticalAngle || .72))
      return { visible: false, reason: 'Turn toward the subject so it appears in the view.' };
    const ignored = new Set(options.ignoreNames || []);
    // AABBs are conservative: use only structural opaque meshes so a batched
    // shelf of tiny figures never hides its own target.
    const blocker = /^(north wall|south wall|bathroom .*wall|bathroom open door|east closet .*return|closet side wall|closet back wall|closet mirror panel|bed black platform|queen mattress.*|olive duvet.*|grey quilt.*|70 inch oak standing desk|desk collectible shelf|bedroom ceiling)$/i;
    for (const mesh of meshes) {
      if (ignored.has(mesh.name) || !blocker.test(mesh.name) || mesh.material.blend) continue;
      if (point.every((value, i) => value >= mesh.bounds.min[i] - .01 && value <= mesh.bounds.max[i] + .01)) continue;
      const hit = rayBox(origin, point, mesh.bounds.min, mesh.bounds.max);
      if (hit !== null && hit > .002 && hit < .965) return { visible: false, reason: 'An object is between you and the subject.' };
    }
    return { visible: true, distance };
  }
  function photoAim(point) {
    if (!loaded || mode === 'overview' || !Array.isArray(point) || point.length !== 3) return false;
    const dx = point[0] - camera.x, dy = point[1] - camera.y, dz = point[2] - camera.z;
    if (Math.hypot(dx, dz) < .05) return false;
    camera.yaw = Math.atan2(dx, -dz); camera.pitch = Math.max(-1.4, Math.min(1.4, Math.atan2(dy, Math.hypot(dx, dz))));
    invalidate(); return true;
  }
  function photoVisible(target) {
    if (!target || !target.point) return { visible: false, reason: 'Choose a subject first.' };
    const ignored = target.id === 'sneakers' ? ['Sneaker case frame', 'Sneaker clear doors', 'Sneaker shelves']
      : target.id === 'desk' ? deskNames : [];
    const aspect = Math.max(.1, canvas.width / Math.max(1, canvas.height));
    const horizontal = Math.max(.12, Math.atan(Math.tan(36 * Math.PI / 180) * aspect) - .035);
    return visibility(target.point, { ignoreNames: ignored, horizontalAngle: horizontal,
      verticalAngle: 36 * Math.PI / 180 - .035, maxDistance: 3.7 });
  }
  function captureFrame() {
    if (!loaded || destroyed) throw new Error('The room camera is unavailable.');
    render();
    const width = canvas.width, height = canvas.height;
    const raw = new Uint8Array(width * height * 4), upright = new Uint8ClampedArray(raw.length);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, raw);
    if (gl.getError() !== gl.NO_ERROR) throw new Error('The room image could not be read.');
    for (let y = 0; y < height; y++)
      upright.set(raw.subarray((height - y - 1) * width * 4, (height - y) * width * 4), y * width * 4);
    const result = document.createElement('canvas'); result.width = width; result.height = height;
    const context = result.getContext('2d');
    if (!context) throw new Error('The browser could not prepare the room image.');
    context.putImageData(new ImageData(upright, width, height), 0, 0);
    return result;
  }
  function updateProximity(force = false) {
    const experience = document.getElementById('experience');
    const near = desk.loaded && mode !== 'overview' && !!(experience && experience.classList.contains('entered'))
      && Math.hypot(camera.x - 3, camera.z + 3.65) < 1.8;
    if (force || near !== deskNear) { deskNear = near; emit('desk:proximity', { near }); }
    let nearest = null, distance = Infinity;
    if (mode !== 'overview') for (const spot of hotspots) {
      const d = Math.hypot(camera.x - spot.x, camera.z - spot.z);
      if (d <= (spot.radius || 1.1) && d < distance) { nearest = spot.id; distance = d; }
    }
    if (mode !== 'overview') for (const cat of cats) {
      const p = cat.controller.obstacle;
      if (!p.loaded) continue;
      const d = Math.hypot(camera.x - p.x, camera.z - p.z);
      if (d < 1.05 && d < distance) { nearest = cat.id; distance = d; }
    }
    if (force || nearest !== nearId) { nearId = nearest; emit('room:proximity', { id: nearId }); }
  }
  function syncCameraButtons() {
    document.querySelectorAll('[data-camera]').forEach(button => {
      button.setAttribute('aria-pressed', String(button.dataset.camera === mode));
    });
  }
  function reset() {
    mode = 'toy'; Object.assign(camera, { x: spawn.x, z: spawn.z, y: 0.3, yaw: spawn.yaw, pitch: -0.04 });
    Object.assign(player, { feetY: 0, velocityY: 0, grounded: true, support: 'floor', distance: 0, lastFootstep: 0 });
    keys.clear(); touchMoves.clear(); syncCameraButtons(); updateProximity(); invalidate();
  }
  function setCamera(next) {
    if (!['toy', 'human', 'overview'].includes(next)) return;
    const wasOverview = mode === 'overview', wasElevated = player.feetY > .05; mode = next;
    keys.clear(); touchMoves.clear();
    Object.assign(player, { feetY: 0, velocityY: 0, grounded: true, support: 'floor' });
    if (next === 'overview') Object.assign(camera, { x: 3.5, y: 6.2, z: 2.4, yaw: 0, pitch: -0.95 });
    else {
      camera.y = next === 'toy' ? 0.3 : 1.55;
      if (wasOverview || wasElevated || !canStand(camera.x, camera.z)) Object.assign(camera, { x: spawn.x, z: spawn.z, yaw: spawn.yaw, pitch: -0.04 });
    }
    syncCameraButtons(); updateProximity(); invalidate();
  }
  function inputBlocked(forMovement = false) {
    const active = document.activeElement;
    const refs = document.getElementById('references'), experience = document.getElementById('experience');
    const panelOpen = document.querySelector('#ambience:not([hidden]), #photo-quest:not([hidden]), #cat-play-panel:not([hidden])');
    const typing = active && active.closest('input, textarea, select, [contenteditable="true"]');
    const focusedControl = active && active.closest('button, a');
    return !!((experience && !experience.classList.contains('entered')) || (refs && !refs.hidden)
      || document.querySelector('dialog[open]') || panelOpen || typing || (!forMovement && focusedControl));
  }
  function movement(dt) {
    if (mode === 'overview' || inputBlocked(true)) return;
    const held = new Set([...keys, ...touchMoves.values()]);
    let forward = Number(held.has('w') || held.has('arrowup') || held.has('forward')) - Number(held.has('s') || held.has('arrowdown') || held.has('back'));
    let right = Number(held.has('d') || held.has('arrowright') || held.has('right')) - Number(held.has('a') || held.has('arrowleft') || held.has('left'));
    const length = Math.hypot(forward, right);
    if (!length) return;
    const distance = dt * (mode === 'toy' ? 1.05 : 1.5) / length;
    forward *= distance; right *= distance;
    const beforeX = camera.x, beforeZ = camera.z;
    move(Math.sin(camera.yaw) * forward + Math.cos(camera.yaw) * right,
      -Math.cos(camera.yaw) * forward + Math.sin(camera.yaw) * right);
    const travelled = Math.hypot(camera.x - beforeX, camera.z - beforeZ);
    player.distance += travelled;
    if (player.grounded && travelled > 0 && player.distance - player.lastFootstep > .24) {
      player.lastFootstep = player.distance;
      emit('room:footstep', { support: player.support, x: camera.x, z: camera.z });
    }
    dirty = true; updateProximity();
  }
  let pendingMirror = false;
  function prepareCats() {
    const shadows = new Float32Array(8), paws = new Float32Array(32), support = new Float32Array(2);
    cats.forEach((cat, actorIndex) => {
      if (!cat.controller.obstacle.loaded) return;
      const pose = cat.controller.pose, c = Math.cos(pose.yaw), s = Math.sin(pose.yaw);
      cat.pose = pose;
      const y = Number.isFinite(pose.y) ? pose.y : 0.026;
      cat.actor = nodeMatrix({ translation: [pose.x, y, pose.z], rotation: [0, Math.sin(pose.yaw / 2), 0, Math.cos(pose.yaw / 2)] });
      support[actorIndex] = y;
      shadows.set([pose.x, pose.z, pose.yaw, pose.airborne ? 0 : 1], actorIndex * 4);
      for (let i = 0; i < 4; i++) {
        const x = pose.anchors[i * 4] + pose.steps[i * 4], z = pose.anchors[i * 4 + 1] + pose.steps[i * 4 + 2];
        paws.set([pose.x + c * x + s * z, y + pose.steps[i * 4 + 1], pose.z - s * x + c * z, pose.airborne || pose.loaf > .1 ? 0 : 1], (actorIndex * 4 + i) * 4);
      }
    });
    return { shadows, paws, support };
  }
  function drawPass(viewProjection, eye, catData, reflected = false, clipPlane = null, capture = false) {
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.useProgram(program);
    gl.uniformMatrix4fv(uniforms.ViewProjection, false, viewProjection); gl.uniform3fv(uniforms.Camera, eye);
    gl.uniform1i(uniforms.ClipEnabled, !!clipPlane);
    if (clipPlane) gl.uniform4fv(uniforms.ClipPlane, clipPlane);
    gl.uniform1i(uniforms.LightCount, lights.length);
    gl.uniform4fv(uniforms.LightPosition, new Float32Array(lights.flatMap(light => [...light.position, light.range])));
    gl.uniform4fv(uniforms.LightColor, new Float32Array(lights.flatMap(light => {
      const group = lightGroup(light.name);
      return [...(group === 'daylight' ? light.color : lampTint(light.color)), light.intensity * lighting[group]];
    })));
    gl.uniform4f(uniforms.RoomLight, lighting.daylight, lighting.lamps, lighting.bathroom, lighting.warmth);
    gl.uniform4fv(uniforms.LightDirection, new Float32Array(lights.flatMap(light => [...light.direction, light.type])));
    gl.uniform2fv(uniforms.LightCones, new Float32Array(lights.flatMap(light => light.cones)));
    ['Texture', 'NormalTexture', 'MRTexture', 'EmissiveTexture', 'OcclusionTexture', 'ContactTexture', 'ShadowCube', 'SurfaceTexture']
      .forEach((name, unit) => gl.uniform1i(uniforms[name], unit));
    gl.activeTexture(gl.TEXTURE5); gl.bindTexture(gl.TEXTURE_2D, contactTexture);
    gl.activeTexture(gl.TEXTURE6); gl.bindTexture(gl.TEXTURE_CUBE_MAP, shadow ? shadow.texture : null);
    gl.uniform1i(uniforms.ShadowIndex, shadow ? shadow.lightIndex : -1); gl.uniform2f(uniforms.ShadowPlanes, SHADOW_NEAR, SHADOW_FAR);
    gl.uniform4fv(uniforms.CatShadow, catData.shadows); gl.uniform4fv(uniforms.CatPaws, catData.paws);
    gl.uniform2fv(uniforms.CatSupport, catData.support);
    const distance = mesh => mesh.cat ? Math.hypot(mesh.cat.pose.x - eye[0], mesh.cat.pose.z - eye[2])
      : Math.hypot(mesh.center[0] - eye[0], mesh.center[1] - eye[1], mesh.center[2] - eye[2]);
    const visible = meshes.filter(mesh => !(mode === 'overview' && mesh.ceiling) && !(capture && mesh.mirror)).concat(catMeshes);
    if (ballMesh && catPlay && catPlay.state.ball && catPlay.state.ball.visible) {
      const ball = catPlay.state.ball;
      ballMesh.model[12] = ball.x; ballMesh.model[13] = ball.y; ballMesh.model[14] = ball.z;
      ballMesh.center[0] = ball.x; ballMesh.center[1] = ball.y; ballMesh.center[2] = ball.z;
      visible.push(ballMesh);
    }
    const transparent = visible.filter(mesh => mesh.material.blend).sort((a, b) => distance(b) - distance(a));
    function draw(mesh) {
      const m = mesh.material;
      gl.uniform1i(uniforms.Cat, !!mesh.cat);
      if (mesh.cat) {
        const pose = mesh.cat.pose;
        gl.uniformMatrix4fv(uniforms.Actor, false, mesh.cat.actor);
        gl.uniform4fv(uniforms.CatFeet, pose.anchors); gl.uniform4fv(uniforms.CatSteps, pose.steps);
        gl.uniform3f(uniforms.CatMotion, pose.bob, pose.tail, pose.back);
        gl.uniform3f(uniforms.CatPose, pose.loaf || 0, pose.tuck || 0, pose.pitch || 0);
      }
      if (m.doubleSided) gl.disable(gl.CULL_FACE); else gl.enable(gl.CULL_FACE);
      gl.frontFace(!!mesh.mirrored !== !!reflected ? gl.CW : gl.CCW);
      gl.bindVertexArray(mesh.vao);
      gl.uniformMatrix4fv(uniforms.Model, false, mesh.model); gl.uniformMatrix3fv(uniforms.Normal, false, mesh.normal);
      gl.uniform4fv(uniforms.Base, m.base);
      gl.uniform3fv(uniforms.Emissive, lampTint(m.emissive).map(value => value * lighting[lightGroup(mesh.name)]));
      gl.uniform1i(uniforms.Unlit, !!m.unlit); gl.uniform1f(uniforms.AlphaCutoff, m.cutoff);
      gl.uniform1f(uniforms.Handedness, mesh.mirrored ? -1 : 1); gl.uniform1i(uniforms.HasTangent, mesh.hasTangent);
      gl.uniform1f(uniforms.Roughness, m.roughness); gl.uniform1f(uniforms.Metallic, m.metallic);
      gl.uniform1f(uniforms.NormalScale, m.normalScale); gl.uniform1f(uniforms.OcclusionStrength, m.occlusionStrength);
      gl.uniform1i(uniforms.MapMask, m.mapMask); gl.uniform1iv(uniforms.UVSets, m.uvSets); gl.uniformMatrix3fv(uniforms.UVTransforms, false, m.transforms);
      for (let unit = 0; unit < 5; unit++) { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, m.maps[unit] || null); }
      const mirror = !capture && mesh.mirror && mesh.mirror.captures ? mesh.mirror : null;
      const screen = mesh.screen && monitor.loaded;
      gl.uniform1i(uniforms.SurfaceMode, mirror ? 1 : screen ? 2 : 0);
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, mirror ? mirror.target.texture : screen ? monitor.texture : null);
      if (mirror) gl.uniformMatrix4fv(uniforms.SurfaceProjection, false, mirror.viewProjection);
      if (screen) gl.uniform4f(uniforms.DisplayBounds, mesh.bounds.min[0], mesh.bounds.min[1],
        mesh.bounds.max[0] - mesh.bounds.min[0], mesh.bounds.max[1] - mesh.bounds.min[1]);
      if (mesh.indexType) gl.drawElements(gl.TRIANGLES, mesh.count, mesh.indexType, 0);
      else gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
    }
    gl.disable(gl.BLEND); gl.depthMask(true);
    for (const mesh of visible) if (!mesh.material.blend) draw(mesh);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    for (const mesh of transparent) draw(mesh);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
  }
  function render() {
    const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.round(rect.width * ratio)), height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    if (!loaded) { gl.viewport(0, 0, width, height); gl.clearColor(0.075, 0.081, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); return; }
    uploadMonitor();
    if (shadowDirty && (!desk.moving || performance.now() - lastShadowUpdate > 200)) buildShadowCube();
    const view = viewMatrix(), perspective = projection(width / height), mainVP = multiply(perspective, view);
    const eye = [camera.x, camera.y, camera.z], catData = prepareCats(), now = performance.now();
    const signature = [...eye, camera.yaw, camera.pitch, width, height, sceneRevision].join(',');
    pendingMirror = false;
    for (const mirror of mirrors) {
      // The approved east wall only opens onto the bathroom corridor at
      // z=-4.2..-3.25. Test that aperture instead of capturing through the closet.
      const throughDoorway = mirror.id !== 'bathroom' || runtimeMath.portalVisibleX(eye, mirror.corners, 4, -4.2, -3.25);
      mirror.visible = throughDoorway && mode !== 'overview' && Math.hypot(...eye.map((v, i) => v - mirror.point[i])) < 12
        && runtimeMath.visible(mirror.corners, mainVP, mirror.plane, eye);
      mirror.reason = sceneSuspended() ? 'suspended' : mirror.visible ? 'visible' : !throughDoorway ? 'occluded by bedroom wall' : 'outside visible front face';
      if (!mirror.visible || sceneSuspended()) continue;
      mirrorTarget(mirror, width, height);
      if (mirror.signature === signature) continue;
      if (mirror.captures && now - mirror.lastTime < 50) { pendingMirror = true; continue; }
      const reflectedEye = transformPoint(mirror.matrix, eye), reflectedVP = multiply(mainVP, mirror.matrix);
      // A reflected view reverses handedness. Front-face winding is reversed in
      // drawPass; world clipping removes the geometry behind the silvered plane.
      // No mirror texture is sampled while a capture framebuffer is bound.
      gl.activeTexture(gl.TEXTURE7); gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, mirror.target.framebuffer); gl.viewport(0, 0, mirror.width, mirror.height);
      gl.depthMask(true); gl.clearColor(0.075, 0.081, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      drawPass(reflectedVP, reflectedEye, catData, true, mirror.plane, true);
      mirror.viewProjection = reflectedVP; mirror.lastTime = now; mirror.signature = signature; mirror.captures++;
      mirror.lastCaptureCamera = eye.slice(); mirror.reflectedEye = reflectedEye; mirror.sceneRevision = sceneRevision;
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, width, height);
    gl.depthMask(true); gl.clearColor(0.075, 0.081, 0.09, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    drawPass(mainVP, eye, catData);
  }
  function frame(time) {
    frameId = 0;
    if (document.hidden || destroyed) { lastTime = 0; return; }
    const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 0;
    lastTime = time;
    if (loaded) { movement(dt); stepDesk(dt); stepPlayer(dt); }
    for (const cat of cats) if (cat.controller.step(dt)) { dirty = true; sceneRevision++; updateProximity(); }
    if (catPlay && catPlay.step(dt)) { dirty = true; sceneRevision++; }
    if (dirty || pendingMirror) { render(); dirty = false; }
    if (keys.size || touchMoves.size || !player.grounded || (catPlay && catPlay.active) || cats.some(cat => cat.controller.active) || (!sceneSuspended() && (desk.moving || pendingMirror))) frameId = requestAnimationFrame(frame);
    else lastTime = 0;
  }
  function invalidate() {
    dirty = true;
    if (!frameId && !document.hidden && !destroyed) frameId = requestAnimationFrame(frame);
  }
  function look(dx, dy) {
    if (inputBlocked()) return;
    camera.yaw += dx * 0.003; camera.pitch = Math.max(-1.4, Math.min(1.4, camera.pitch - dy * 0.003));
    invalidate();
  }
  let dragging = null;
  canvas.style.touchAction = 'none';
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || document.pointerLockElement === canvas) return;
    canvas.focus({ preventScroll: true }); canvas.setPointerCapture(event.pointerId);
    dragging = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  canvas.addEventListener('pointermove', event => {
    if (!dragging || dragging.id !== event.pointerId || document.pointerLockElement === canvas) return;
    look(event.clientX - dragging.x, event.clientY - dragging.y);
    dragging.x = event.clientX; dragging.y = event.clientY;
  });
  const endDrag = event => { if (dragging && dragging.id === event.pointerId) dragging = null; };
  canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);
  document.addEventListener('mousemove', event => { if (document.pointerLockElement === canvas) look(event.movementX, event.movementY); });
  const moveKeys = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
  document.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (key === 'escape' && document.pointerLockElement === canvas) document.exitPointerLock();
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (moveKeys.includes(key)) {
      if (inputBlocked(true)) return;
      event.preventDefault(); keys.add(key); invalidate(); return;
    }
    if (inputBlocked()) return;
    if ((key === ' ' || key === 'spacebar') && !event.repeat) { event.preventDefault(); jumpPlayer(); }
    if (key === 'e' && !event.repeat) {
      const handled = window.roomObjectPlay && window.roomObjectPlay.use && window.roomObjectPlay.use();
      if (handled || nearId) { event.preventDefault(); if (!handled) emit('room:interact', { id: nearId }); }
    }
  });
  document.addEventListener('keyup', event => { keys.delete(event.key.toLowerCase()); });
  document.querySelectorAll('[data-move]').forEach(button => {
    button.style.touchAction = 'none';
    button.addEventListener('pointerdown', event => {
      event.preventDefault(); canvas.focus({ preventScroll: true }); button.setPointerCapture(event.pointerId);
      touchMoves.set(event.pointerId, button.dataset.move); invalidate();
    });
    const release = event => touchMoves.delete(event.pointerId);
    button.addEventListener('pointerup', release); button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
  const jumpButton = document.getElementById('jump-button');
  if (jumpButton) jumpButton.addEventListener('click', () => { canvas.focus({ preventScroll: true }); jumpPlayer(); });
  document.querySelectorAll('[data-camera]').forEach(button => button.addEventListener('click', () => {
    setCamera(button.dataset.camera); canvas.focus({ preventScroll: true });
  }));
  const resetButton = document.getElementById('reset-view');
  if (resetButton) resetButton.addEventListener('click', () => { reset(); canvas.focus({ preventScroll: true }); });
  const enterButton = document.getElementById('enter-room');
  if (enterButton) enterButton.addEventListener('click', () => {
    canvas.focus({ preventScroll: true });
    updateProximity(true);
    if (canvas.requestPointerLock && window.matchMedia('(pointer: fine)').matches) {
      try { const request = canvas.requestPointerLock(); if (request && request.catch) request.catch(() => {}); } catch (_) { /* Drag-to-look remains available. */ }
    }
  });
  window.addEventListener('blur', () => { keys.clear(); touchMoves.clear(); dragging = null; });
  document.addEventListener('visibilitychange', () => {
    keys.clear(); touchMoves.clear(); dragging = null; lastTime = 0;
    if (document.hidden) { cancelAnimationFrame(frameId); frameId = 0; }
    else invalidate();
  });
  motionPreference.addEventListener('change', invalidate);
  const runtimeObserver = new MutationObserver(() => { updateProximity(); invalidate(); });
  for (const element of [document.getElementById('references'), document.getElementById('experience'), ...document.querySelectorAll('dialog')]) {
    if (element) runtimeObserver.observe(element, { attributes: true, attributeFilter: ['hidden', 'open', 'class'] });
  }
  window.addEventListener('resize', invalidate);
  if (window.ResizeObserver) new ResizeObserver(invalidate).observe(canvas);
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); destroyed = true; cancelAnimationFrame(frameId);
    fail(new Error('The graphics context was interrupted. Reload the page to continue.'));
  });
  // The visitor controls the camera; each cat owns its pause and motion preference.
  window.RoomPreview = {
    get state() { return { position: { x: camera.x, y: camera.y, z: camera.z }, yaw: camera.yaw, pitch: camera.pitch,
      height: camera.y, mode, loaded, meshes: meshes.length, triangles: triangleCount, lights: lights.length,
      shadowMapSize: shadow ? shadow.size : 0, shadowBuilds, mirrors: mirrorState(), desk: deskState(),
      lighting: { ...lighting },
      monitor: { loaded: monitor.loaded, uploads: monitor.uploads, source: monitor.source ? monitor.source.state : null },
      player: { ...player }, catPlay: catPlay ? catPlay.state : null,
      mimi: cats[0] ? cats[0].controller.state : null, charlie: cats[1] ? cats[1].controller.state : null,
      cats: cats.map(cat => ({ ...cat.controller.state, triangles: cat.triangles || 0 })) }; },
    reset, canStand, jump: jumpPlayer, visibility, photoVisible, photoAim, captureFrame,
    get sceneObjects() { return meshes.map(mesh => ({ name: mesh.name, min: mesh.bounds.min.slice(), max: mesh.bounds.max.slice() })); },
    get catPlay() { return catPlay; },
    desk: { setHeight: setDeskHeight, get state() { return deskState(); } },
    lighting: { set: setLighting, preset(name) { if (lightingPresets[name]) setLighting(lightingPresets[name], name); }, get state() { return { ...lighting }; } },
    get mirrors() { return mirrorState(); },
    ...Object.fromEntries(cats.map(cat => [cat.id, { toggle() { cat.controller.toggle(); }, get state() { return cat.controller.state; } }])),
  };
  reset();
  loadModel().catch(fail);
})();

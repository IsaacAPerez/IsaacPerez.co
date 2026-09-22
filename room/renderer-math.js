(function () {
  'use strict';

  // Column-major OpenGL matrices. Reflection is an involution with determinant
  // -1, so the capture pass must reverse front-face winding. The world-space
  // clipping half-space keeps the viewer's side of the mirror only.
  const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
  function reflection(point, normal) {
    const length = Math.hypot(...normal);
    if (!Number.isFinite(length) || length < 1e-8) throw new Error('Invalid mirror normal.');
    const n = normal.map(v => v / length), d = -dot(n, point);
    const m = new Float32Array(16);
    for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) m[c * 4 + r] = (r === c ? 1 : 0) - 2 * n[r] * n[c];
    for (let i = 0; i < 3; i++) m[12 + i] = -2 * d * n[i];
    m[15] = 1;
    return { matrix: m, plane: new Float32Array([...n, d]) };
  }
  function homogeneous(m, p) {
    const v = [...p, 1], result = [0, 0, 0, 0];
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) result[r] += m[c * 4 + r] * v[c];
    return result;
  }
  function visible(corners, viewProjection, plane, eye) {
    if (dot(plane.slice(0, 3), eye) + plane[3] <= 0.012) return false;
    const clip = corners.map(p => homogeneous(viewProjection, p));
    if (clip.every(p => p[3] <= 0.001)) return false;
    for (let axis = 0; axis < 3; axis++) {
      if (clip.every(p => p[axis] < -p[3]) || clip.every(p => p[axis] > p[3])) return false;
    }
    return true;
  }
  function portalVisibleX(eye, corners, x, minZ, maxZ) {
    if (eye[0] >= x) return true;
    const crossings = corners.filter(p => p[0] > x).map(p => eye[2] + (p[2] - eye[2]) * (x - eye[0]) / (p[0] - eye[0]));
    return crossings.length > 0 && Math.min(...crossings) <= maxZ && Math.max(...crossings) >= minZ;
  }
  function deskHeight(value, min, max) {
    if (!Number.isFinite(value)) return null;
    return Math.max(min, Math.min(max, value));
  }
  function deskStep(height, target, dt, reduced) {
    if (reduced) return target;
    const distance = Math.min(Math.abs(target - height), Math.max(0, Math.min(dt, 0.05)) * 0.22);
    return height + Math.sign(target - height) * distance;
  }
  function deskClearance(box, offset, eye, radius = 0.10) {
    const dx = Math.max(box.minX - eye.x, 0, eye.x - box.maxX);
    const dz = Math.max(box.minZ - eye.z, 0, eye.z - box.maxZ);
    return Math.hypot(dx, dz) >= radius || box.minY + offset >= eye.y + 0.10;
  }
  window.RoomRendererMath = Object.freeze({ reflection, homogeneous, visible, portalVisibleX, deskHeight, deskStep, deskClearance });
}());

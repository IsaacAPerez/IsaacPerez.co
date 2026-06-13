/* ============================================================
   ISAAC'S STUDIO — playable portfolio
   A sleek home office you walk around. World is a single room
   baked once to an offscreen canvas, re-baked only on theme change.
   ============================================================ */
(function () {
  'use strict';

  const root = document.getElementById('gameRoot');
  const canvas = document.getElementById('gameCanvas');
  if (!root || !canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');

  // ---------------- Constants ----------------
  const TILE = 16;
  const MAPW = 40, MAPH = 26;
  const STEP = 1 / 60;
  const PLAYER_SPEED = 4.4 * TILE; // logical px/sec
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tile ids
  const T = { VOID: 0, FLOOR: 1, RUG: 2, MAT: 3, WALL: 10, WINDOW: 11, DOOR: 12 };

  // Single open studio. Interior is walkable; the surrounding ring is wall.
  const ROOM = { x1: 2, y1: 3, x2: 37, y2: 22 };
  const WINDOWS = [[6, 12], [22, 28]]; // x ranges set into the top wall row
  const DOORX = [19, 20];              // door tiles in the bottom wall
  const RUG = { x1: 3, y1: 15, x2: 13, y2: 21 }; // work-nook rug

  // Named zones for the HUD "you are here" label (anchor tile)
  const ZONES = [
    { name: 'The Desk', x: 19, y: 7 },
    { name: 'Shipped Apps', x: 30, y: 7 },
    { name: 'Camera Corner', x: 34, y: 12 },
    { name: 'Wall of Work', x: 4, y: 7 },
    { name: 'The Shelf', x: 8, y: 17 },
    { name: 'Comms', x: 7, y: 20 },
  ];

  // Warm light sources (desk lamp, floor lamp) in tile coords
  const LIGHTS = [[15, 4], [33, 18]];

  // ---------------- Persistence ----------------
  const GS_KEY = 'ip-game-state';
  function loadState() {
    try { return Object.assign({ visited: [], vaultOpen: false, vaultFound: false, chestOpened: false, drone: false, muted: false, confetti: false }, JSON.parse(localStorage.getItem(GS_KEY) || '{}')); }
    catch (e) { return { visited: [], vaultOpen: false, vaultFound: false, chestOpened: false, drone: false, muted: false, confetti: false }; }
  }
  const state = loadState();
  function saveState() { try { localStorage.setItem(GS_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ } }
  const visited = new Set(state.visited);

  // ---------------- Theme palette ----------------
  let PAL = {};
  function readPalette() {
    const light = document.documentElement.getAttribute('data-theme') === 'light' ||
      (!document.documentElement.getAttribute('data-theme') && window.matchMedia('(prefers-color-scheme: light)').matches);
    // Sleek studio: whites & blacks, a red accent, plant greens.
    PAL = {
      light,
      // red accent (the lone pop of color) — kept under the gold* names the engine uses
      gold: '#e5484d', goldBright: '#ff6369', goldDeep: '#b42a30',
      goldGlow: 'rgba(229,72,77,0.30)',
      text: light ? '#1c1c1e' : '#f0f0f2',
      white: light ? '#fbfbf9' : '#e9e9ec',
      black: light ? '#1c1c1e' : '#0d0d0f',
      bg: light ? '#f1efe9' : '#0c0c0e',
      // floor (warm-neutral plank)
      floor: light ? '#e7e3da' : '#1c1d20',
      floorB: light ? '#ddd8cd' : '#191a1d',
      floorLine: light ? '#d2ccbe' : '#141518',
      // rug
      rug: light ? '#d8d4ca' : '#202126',
      rugRed: '#c0353a',
      // walls
      wall: light ? '#f4f2ee' : '#161619',
      wallTop: light ? '#ffffff' : '#202024',
      wallBase: light ? '#cfcabf' : '#0e0e10',
      // window view
      sky: light ? '#bfe3f2' : '#0e1422',
      skyLow: light ? '#e7f3e9' : '#161d2e',
      cityGlow: light ? '#d8c9a8' : '#3a4258',
      // materials
      metal: light ? '#c7c9cc' : '#3a3c42',
      metalDark: light ? '#9a9ca1' : '#222428',
      screen: light ? '#2a2c31' : '#10131a',
      screenLit: light ? '#cfe6ef' : '#1d2b3a',
      plant: light ? '#4f9d6b' : '#3d7d56',
      plantDark: light ? '#3a7a50' : '#2c5f40',
      plantMid: light ? '#6fbf86' : '#4d9d6b',
      pot: light ? '#d8d4cb' : '#2a2b30',
      soil: light ? '#5a4a38' : '#241c12',
      wood: light ? '#cbb390' : '#3a3024',
      voidc: light ? '#d9d6cf' : '#070708',
      // realism pass
      lightWarm: light ? '#fff7e1' : '#b59a52',
      spillCool: light ? '#96c8e1' : '#4678aa',
      bodyTop: light ? '#33343a' : '#2a2a2e',
      matFelt: light ? '#2b2c30' : '#161719',
      keycap: light ? '#e9e7e1' : '#cfd0d4',
      glassSheen: light ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.12)',
      aoInk: light ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.32)',
    };
  }

  // ---------------- Map ----------------
  let grid = new Uint8Array(MAPW * MAPH);
  function gAt(x, y) { return (x < 0 || y < 0 || x >= MAPW || y >= MAPH) ? T.VOID : grid[y * MAPW + x]; }
  function gSet(x, y, v) { if (x >= 0 && y >= 0 && x < MAPW && y < MAPH) grid[y * MAPW + x] = v; }
  function isFloorId(id) { return id >= T.FLOOR && id <= T.MAT; }

  function hash2(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >> 13)) * 1274126177; return ((h ^ (h >> 16)) >>> 0) / 4294967295; }

  function buildMap() {
    grid = new Uint8Array(MAPW * MAPH);
    // floor
    for (let y = ROOM.y1; y <= ROOM.y2; y++) for (let x = ROOM.x1; x <= ROOM.x2; x++) gSet(x, y, T.FLOOR);
    // central area rug (anchors the open floor) + work-nook rug
    for (let y = 9; y <= 16; y++) for (let x = 15; x <= 27; x++) gSet(x, y, T.RUG);
    for (let y = RUG.y1; y <= RUG.y2; y++) for (let x = RUG.x1; x <= RUG.x2; x++) gSet(x, y, T.RUG);
    // wall ring around the interior
    for (let x = ROOM.x1 - 1; x <= ROOM.x2 + 1; x++) { gSet(x, ROOM.y1 - 1, T.WALL); gSet(x, ROOM.y2 + 1, T.WALL); }
    for (let y = ROOM.y1 - 1; y <= ROOM.y2 + 1; y++) { gSet(ROOM.x1 - 1, y, T.WALL); gSet(ROOM.x2 + 1, y, T.WALL); }
    // windows along the top wall
    for (const [a, b] of WINDOWS) for (let x = a; x <= b; x++) gSet(x, ROOM.y1 - 1, T.WINDOW);
    // door in the bottom wall + doormat
    for (const x of DOORX) { gSet(x, ROOM.y2 + 1, T.DOOR); gSet(x, ROOM.y2, T.MAT); }
  }

  // ---------------- Tile atlas + world bake ----------------
  function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  let atlas = {};
  function bakeAtlas() {
    atlas = {};
    const variants = { [T.FLOOR]: 3, [T.RUG]: 2, [T.MAT]: 1, [T.WALL]: 1, [T.WINDOW]: 1, [T.DOOR]: 1, [T.VOID]: 1 };
    for (const idStr of Object.keys(variants)) {
      const id = +idStr; const n = variants[id]; atlas[id] = [];
      for (let v = 0; v < n; v++) {
        const c = mk(TILE, TILE); const g = c.getContext('2d');
        drawTile(g, id, v); atlas[id].push(c);
      }
    }
  }
  function speckle(g, base, dotA, dotB, seed) {
    g.fillStyle = base; g.fillRect(0, 0, TILE, TILE);
    for (let i = 0; i < 10; i++) {
      const r = hash2(seed * 31 + i, i * 7);
      g.fillStyle = r > 0.5 ? dotA : dotB;
      g.fillRect((r * 97 | 0) % TILE, ((r * 41 + i * 3) | 0) % TILE, 1, 1);
    }
  }
  function drawTile(g, id, v) {
    switch (id) {
      case T.VOID: g.fillStyle = PAL.voidc; g.fillRect(0, 0, TILE, TILE); break;
      case T.FLOOR: {
        // engineered wood planks — seam rows IDENTICAL across variants so they tile
        g.fillStyle = v === 2 ? PAL.floorB : PAL.floor; g.fillRect(0, 0, TILE, TILE);
        if (v === 1) { g.fillStyle = PAL.floorB; g.fillRect(0, 5, TILE, 7); }   // mid-band tone shift
        if (v === 2) { g.fillStyle = PAL.floor; g.fillRect(0, 5, TILE, 8); }
        // plank seams (dark) with a bevel highlight directly beneath
        g.fillStyle = PAL.floorLine; g.fillRect(0, 4, TILE, 1); g.fillRect(0, 12, TILE, 1);
        g.fillStyle = PAL.light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.05)';
        g.fillRect(0, 5, TILE, 1); g.fillRect(0, 13, TILE, 1);
        // faint grain streaks
        g.fillStyle = PAL.light ? 'rgba(110,88,54,0.10)' : 'rgba(0,0,0,0.18)';
        for (const row of [2, 8, 10]) { const gx = (hash2(v + 1, row) * 6) | 0; g.fillRect(gx, row, 4 + ((hash2(row, v) * 6) | 0), 1); }
        if (v === 2) { g.fillStyle = PAL.floorLine; g.fillRect(11, 0, 1, 5); g.fillStyle = PAL.light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.05)'; g.fillRect(12, 0, 1, 5); }
        if (v === 0) { g.globalAlpha = 0.06; g.fillStyle = '#ffffff'; g.fillRect(0, 0, TILE, 2); g.globalAlpha = 1; }
        break;
      }
      case T.RUG: {
        // woven textile — matte cross-hatch, no specular (contrast vs the glossy floor)
        g.fillStyle = PAL.rug; g.fillRect(0, 0, TILE, TILE);
        const wv = PAL.light ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
        g.fillStyle = wv; for (let i = 1; i < TILE; i += 2) g.fillRect(0, i, TILE, 1);
        g.fillStyle = PAL.light ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.02)'; for (let j = 2; j < TILE; j += 4) g.fillRect(j, 0, 1, TILE);
        if (v) { g.globalAlpha = 0.04; g.fillStyle = '#ffffff'; g.fillRect(0, 0, TILE, 8); g.globalAlpha = 1; }
        break;
      }
      case T.MAT: {
        g.fillStyle = PAL.metalDark; g.fillRect(1, 2, TILE - 2, TILE - 4);
        g.fillStyle = PAL.metal; g.fillRect(2, 3, TILE - 4, TILE - 6);
        g.fillStyle = PAL.metalDark; for (let i = 4; i < TILE - 3; i += 3) g.fillRect(3, i, TILE - 6, 1);
        break;
      }
      case T.WALL: {
        g.fillStyle = PAL.wall; g.fillRect(0, 0, TILE, TILE);
        g.fillStyle = PAL.wallTop; g.fillRect(0, 0, TILE, 1);                 // crown
        g.fillStyle = PAL.light ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.06)'; g.fillRect(0, 1, TILE, 1);
        g.fillStyle = PAL.wallTop; g.fillRect(0, 4, TILE, 1);                 // picture rail
        g.fillStyle = PAL.wallBase; g.fillRect(0, 6, TILE, 1);
        g.fillStyle = PAL.wallBase; g.fillRect(0, 12, TILE, 4);              // baseboard
        g.fillStyle = PAL.light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)'; g.fillRect(0, 12, TILE, 1);
        g.fillStyle = PAL.light ? 'rgba(0,0,0,0.18)' : 'rgba(0,0,0,0.5)'; g.fillRect(0, 15, TILE, 1); // floor contact
        break;
      }
      case T.WINDOW: { g.fillStyle = PAL.wall; g.fillRect(0, 0, TILE, TILE); break; } // view overlaid in bakeWorld
      case T.DOOR: {
        g.fillStyle = PAL.metalDark; g.fillRect(2, 0, TILE - 4, TILE);
        g.fillStyle = PAL.metal; g.fillRect(3, 1, TILE - 6, TILE - 2);
        g.fillStyle = PAL.gold; g.fillRect(TILE - 6, 7, 2, 3); // red handle
        break;
      }
    }
  }

  let world = mk(MAPW * TILE, MAPH * TILE);
  // soft baked ambient-occlusion blob (light from top → shadow falls down-right)
  function aoBlob(g, cx, cy, rx, ry, color) {
    g.save();
    g.translate(cx + 2, cy + 3);
    g.scale(1, ry / rx);
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    grad.addColorStop(0, color); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath(); g.arc(0, 0, rx, 0, 7); g.fill();
    g.restore();
  }
  function bakeAO(g) {
    const ink = PAL.aoInk;
    const halo = PAL.light ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.22)';
    // furniture footprints (world px)
    aoBlob(g, 312, 100, 96, 18, ink);  // desk
    aoBlob(g, 488, 96, 80, 16, ink);   // app console
    aoBlob(g, 136, 288, 92, 17, ink);  // credenza
    aoBlob(g, 120, 336, 92, 16, ink);  // comms console
    aoBlob(g, 560, 160, 36, 12, ink);  // gear shelf
    aoBlob(g, 576, 304, 22, 34, ink);  // tall bookshelf
    // floor halos under standalones
    for (const [tx, ty] of [[33, 18], [35, 21], [2, 3], [2, 21], [24, 3], [33, 21], [36, 12]]) aoBlob(g, tx * TILE + 8, ty * TILE + 12, 12, 6, halo);
    // wall→floor contact shadow along the top, thinner down the sides
    g.fillStyle = PAL.light ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.30)';
    g.fillRect(ROOM.x1 * TILE, ROOM.y1 * TILE, (ROOM.x2 - ROOM.x1 + 1) * TILE, 3);
    g.globalAlpha = 0.5;
    g.fillRect(ROOM.x1 * TILE, ROOM.y1 * TILE, 3, (ROOM.y2 - ROOM.y1 + 1) * TILE);
    g.fillRect((ROOM.x2 + 1) * TILE - 3, ROOM.y1 * TILE, 3, (ROOM.y2 - ROOM.y1 + 1) * TILE);
    g.globalAlpha = 1;
  }
  function bakeLight(g) {
    for (const [a, b] of WINDOWS) {
      const x0 = a * TILE, w = (b - a + 1) * TILE, top = ROOM.y1 * TILE;
      if (PAL.light) {
        const depth = 7 * TILE;
        const grad = g.createLinearGradient(0, top, 0, top + depth);
        grad.addColorStop(0, 'rgba(255,247,225,0.22)'); grad.addColorStop(0.5, 'rgba(255,247,225,0.10)'); grad.addColorStop(1, 'rgba(255,247,225,0)');
        g.fillStyle = grad;
        g.beginPath(); g.moveTo(x0, top); g.lineTo(x0 + w, top); g.lineTo(x0 + w + 18, top + depth); g.lineTo(x0 - 18, top + depth); g.closePath(); g.fill();
      } else {
        const depth = 3 * TILE;
        const grad = g.createLinearGradient(0, top, 0, top + depth);
        grad.addColorStop(0, 'rgba(150,180,230,0.06)'); grad.addColorStop(1, 'rgba(150,180,230,0)');
        g.fillStyle = grad; g.fillRect(x0, top, w, depth);
      }
    }
  }
  function bakeWorld() {
    const g = world.getContext('2d');
    g.imageSmoothingEnabled = false;
    for (let y = 0; y < MAPH; y++) for (let x = 0; x < MAPW; x++) {
      const id = gAt(x, y);
      const set = atlas[id] || atlas[T.VOID];
      const v = set.length > 1 ? Math.floor(hash2(x, y) * set.length) : 0;
      g.drawImage(set[v], x * TILE, y * TILE);
    }
    bakeAO(g);
    // central area rug: beveled neutral border
    g.strokeStyle = PAL.light ? 'rgba(0,0,0,0.10)' : 'rgba(255,255,255,0.07)'; g.lineWidth = 2;
    g.strokeRect(15 * TILE + 4, 9 * TILE + 4, 13 * TILE - 8, 8 * TILE - 8);
    g.strokeStyle = PAL.light ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.05)'; g.lineWidth = 1;
    g.strokeRect(15 * TILE + 5, 9 * TILE + 5, 13 * TILE - 10, 8 * TILE - 10);
    // work-nook rug: double red border
    g.strokeStyle = PAL.rugRed; g.lineWidth = 2;
    g.strokeRect(RUG.x1 * TILE + 3, RUG.y1 * TILE + 3, (RUG.x2 - RUG.x1 + 1) * TILE - 6, (RUG.y2 - RUG.y1 + 1) * TILE - 6);
    g.lineWidth = 1;
    g.strokeRect(RUG.x1 * TILE + 6, RUG.y1 * TILE + 6, (RUG.x2 - RUG.x1 + 1) * TILE - 12, (RUG.y2 - RUG.y1 + 1) * TILE - 12);
    // window views
    for (const [a, b] of WINDOWS) drawWindowView(g, a * TILE, (ROOM.y1 - 1) * TILE, (b - a + 1) * TILE);
    // window sills (ledge + floor shadow under each opening)
    for (const [a, b] of WINDOWS) {
      const x0 = a * TILE, w = (b - a + 1) * TILE, sy = (ROOM.y1 - 1) * TILE + 14;
      g.fillStyle = PAL.wallTop; g.fillRect(x0 - 1, sy, w + 2, 2);
      g.fillStyle = PAL.light ? 'rgba(0,0,0,0.12)' : 'rgba(0,0,0,0.4)'; g.fillRect(x0, sy + 2, w, 1);
    }
    bakeLight(g);
  }
  function drawWindowView(g, px, py, w) {
    const h = TILE;
    const sky = g.createLinearGradient(0, py, 0, py + h);
    sky.addColorStop(0, PAL.sky); sky.addColorStop(1, PAL.skyLow);
    g.fillStyle = sky; g.fillRect(px, py, w, h);
    if (PAL.light) {
      g.fillStyle = 'rgba(255,240,200,0.8)'; g.beginPath(); g.arc(px + w * 0.78, py + 5, 3, 0, 7); g.fill();
      g.fillStyle = PAL.cityGlow;
      for (let i = 0; i < w; i += 7) { const bh = 4 + (hash2(px + i, 3) * 6 | 0); g.fillRect(px + i, py + h - bh, 5, bh); }
    } else {
      g.fillStyle = '#0a0e18';
      for (let i = 0; i < w; i += 6) { const bh = 5 + (hash2(px + i, 5) * 7 | 0); g.fillRect(px + i, py + h - bh, 5, bh); }
      g.fillStyle = PAL.gold;
      for (let i = 0; i < w; i += 3) if (hash2(px + i, 9) > 0.7) g.fillRect(px + i + 1, py + h - 3 - (hash2(px + i, 2) * 6 | 0), 1, 1);
    }
    // glass sheen
    g.fillStyle = 'rgba(255,255,255,0.10)';
    g.fillRect(px + 2, py + 2, w * 0.4, 1); g.fillRect(px + 2, py + 5, w * 0.25, 1);
    // frame (all four sides) + mullions
    g.fillStyle = PAL.wallTop;
    g.fillRect(px, py, w, 2); g.fillRect(px, py + h - 2, w, 2); g.fillRect(px, py, 2, h); g.fillRect(px + w - 2, py, 2, h);
    for (let mx = 8; mx < w - 2; mx += 8) { g.fillStyle = PAL.wallTop; g.fillRect(px + mx, py, 1, h); g.fillStyle = PAL.wallBase; g.fillRect(px + mx + 1, py, 1, h); }
    g.fillStyle = PAL.wallBase; g.fillRect(px, py + (h / 2 | 0), w, 1);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(px, py + 2, w, 1);
  }

  // ---------------- Emoji rasters (with tofu fallback) ----------------
  const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  const emojiCache = {};
  function rasterEmoji(ch, px) {
    const key = ch + px;
    if (emojiCache[key]) return emojiCache[key];
    const c = mk(px, px); const g = c.getContext('2d');
    g.font = (px - 4) + 'px ' + EMOJI_FONT;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(ch, px / 2, px / 2 + 1);
    // tofu check
    const data = g.getImageData(0, 0, px, px).data;
    let drawn = false;
    for (let i = 3; i < data.length; i += 16) if (data[i] > 8) { drawn = true; break; }
    if (!drawn) { g.fillStyle = PAL.metalDark; g.fillRect(px * 0.25, px * 0.25, px * 0.5, px * 0.5); }
    // Only cache a real glyph — on a cold load the emoji font may not be ready
    // yet, so a later frame re-rasterizes instead of caching gold squares forever.
    if (drawn) emojiCache[key] = c;
    return c;
  }

  // ---------------- Character sprites ----------------
  function makeRig(opts) {
    // 16x24, dirs: down/up/side, 2 frames each
    const frames = {};
    for (const dir of ['down', 'up', 'side']) {
      frames[dir] = [];
      for (let f = 0; f < 2; f++) {
        const c = mk(16, 24); const g = c.getContext('2d');
        // legs: frame 0 = standing, frame 1 = stride (left short, right long)
        const lH = f === 0 ? 4 : 3, rH = f === 0 ? 4 : 5;
        g.fillStyle = opts.pants;
        g.fillRect(4, 18, 3, lH); g.fillRect(9, 18, 3, rH);
        g.fillStyle = opts.shoes;
        g.fillRect(4, 18 + lH, 3, 2); g.fillRect(9, 18 + rH, 3, 2);
        // torso (hoodie / robe)
        g.fillStyle = opts.body; g.fillRect(3, 10, 10, 9);
        if (opts.robe) { g.fillRect(3, 10, 10, 13); }
        // arms
        g.fillStyle = opts.body;
        const sw = f === 1 ? 1 : 0;
        g.fillRect(1, 11 + sw, 2, 6); g.fillRect(13, 11 - sw, 2, 6);
        // zipper / trim
        if (dir !== 'up') { g.fillStyle = opts.trim; g.fillRect(7, 10, 1, 8); }
        // head
        g.fillStyle = opts.skin; g.fillRect(4, 2, 8, 8);
        // hair / hood
        g.fillStyle = opts.hair;
        g.fillRect(3, 1, 10, 3);
        g.fillRect(3, 1, 1, 5); g.fillRect(12, 1, 1, 5);
        if (dir === 'up') { g.fillRect(4, 2, 8, 7); }
        // face
        if (dir === 'down') {
          g.fillStyle = '#1a1205'; g.fillRect(6, 6, 1, 2); g.fillRect(9, 6, 1, 2);
        } else if (dir === 'side') {
          g.fillStyle = '#1a1205'; g.fillRect(9, 6, 1, 2);
        }
        if (opts.beard && dir !== 'up') { g.fillStyle = opts.beard; g.fillRect(dir === 'side' ? 7 : 5, 8, dir === 'side' ? 5 : 6, 2); }
        frames[dir].push(c);
      }
    }
    return frames;
  }
  let heroRig;
  function bakeRigs() {
    heroRig = makeRig({ body: PAL.light ? '#34363c' : '#3d4047', trim: PAL.gold, pants: PAL.light ? '#3a3f4a' : '#2a2e36', shoes: '#ededf0', skin: '#c98e5a', hair: '#241a10' });
  }

  // ---------------- Entities ----------------
  // kind: drawing recipe. core: counts toward completion. group: achievement group.
  // decor: non-interactable furniture. IDs/groups are kept from the old build so
  // the achievement wiring and persistence keep working unchanged.
  const ENTITIES = [
    // --- The Desk (hub) ---
    { id: 'desk_main', x: 14, y: 4, w: 11, h: 2, kind: 'furniture', tone: 'desk', decor: true, flat: true },
    { id: 'chair_main', x: 18, y: 6, w: 3, h: 2, kind: 'chair', decor: true, solid: false },
    { id: 'sign_welcome', x: 18, y: 4, w: 2, h: 1, kind: 'monitors', core: true, solid: false, kicker: 'Welcome', title: "Isaac's Home Office", body: "Hey — I'm Isaac Perez, iOS engineer & founder in LA. This is my office. Walk around with WASD, press E next to anything that interests you. The monitors, the shelf, the camera gear — it's all real. Make yourself at home." },
    { id: 'npc_sage', x: 23, y: 12, w: 1, h: 1, kind: 'roomba', core: true, solid: false, kicker: 'The Roomba', title: 'Dusty (the Roomba)', body: "Beep. I keep the place tidy and I know its secrets. Two of them: the mini-fridge in the corner is worth a look... and if your thumbs remember the old arcade cheat — the one every 90s kid knows — this office still answers to it." },
    { id: 'dungeon_cat', x: 22, y: 16, w: 1, h: 1, kind: 'emoji', emoji: '🐈‍⬛', core: false, solid: false, kicker: 'Office Cat', title: 'Pixel (the Office Cat)', body: 'Mrow. (Pixel has reviewed the codebase from the warm spot on the desk and finds it acceptable. This is the highest rating Pixel gives.)' },
    { id: 'stairs_exit', x: 19, y: 22, w: 2, h: 1, kind: 'door', core: false, solid: false, kicker: 'The Door', title: 'Out to the Site', body: 'Step out to the classic site — same story, fewer pixels. Anything you unlocked comes with you.' },

    // --- Shipped Apps: phones on a console ---
    { id: 'console_apps', x: 26, y: 4, w: 9, h: 2, kind: 'furniture', tone: 'console', decor: true, flat: true },
    { id: 'cab_curbside', x: 27, y: 4, w: 1, h: 1, kind: 'phone', emoji: '🚚', accent: '#e8590c', core: true, group: 'project', kicker: 'Building Now', title: 'CurbSide', body: 'A street-food discovery iOS app for finding the taco truck before the line forms. Currently cooking, launching soon. Built in SwiftUI on a Supabase backend.', link: 'https://thecurbside.app', linkLabel: 'Visit thecurbside.app' },
    { id: 'cab_runsbyip', x: 29, y: 4, w: 1, h: 1, kind: 'phone', emoji: '🏀', accent: '#b86cff', core: true, group: 'project', kicker: 'Live', title: 'Runs by IP', body: "Weekly pickup basketball in LA with RSVPs and payments built in — no flaky group chats, no 'who's got cash.' Founded, built, and occasionally crossed-over-at by Isaac. SwiftUI, Supabase, Stripe, with waitlists and a team randomizer under the hood.", link: 'https://runsbyip.com', linkLabel: 'Join at runsbyip.com' },
    { id: 'cab_kangs', x: 31, y: 4, w: 1, h: 1, kind: 'phone', emoji: '🍜', accent: '#4aa8ff', core: true, group: 'project', kicker: 'Live', title: "Kang's Kuisine", body: 'Online ordering for a Korean pop-up kitchen: menu drops, pre-orders, instant sellouts. Next.js + Supabase + Stripe, with real-time inventory and an admin dashboard. (The tteokbokki handles marketing.)', link: 'https://kangskuisine.food', linkLabel: 'Order at kangskuisine.food' },
    { id: 'cab_teamup', x: 33, y: 4, w: 1, h: 1, kind: 'phone', emoji: '⚽', accent: '#4ade80', core: true, group: 'project', kicker: 'On the App Store', title: 'TeamUp', body: 'Find a pickup game for any sport and join in two taps. Shipped in SwiftUI on Firebase and live on the App Store right now — the one you can download without leaving your seat.', link: 'https://theteamup.app', linkLabel: 'Visit theteamup.app' },

    // --- Camera Corner ---
    { id: 'gear_shelf', x: 33, y: 9, w: 4, h: 1, kind: 'furniture', tone: 'shelf', decor: true, flat: true },
    { id: 'pad_captured', x: 34, y: 10, w: 2, h: 2, kind: 'camera', core: true, group: 'project', solid: false, kicker: 'CapturedByIP', title: 'CapturedByIP', body: "My photography and drone brand: portraits, aerials, and golden-hour LA from angles the freeway will never know. Power up the drone and it'll follow you around the office.", link: 'https://capturedbyip.com', linkLabel: 'View capturedbyip.com' },

    // --- Wall of Work: framed roles (left wall) ---
    { id: 'statue_tinder', x: 2, y: 5, w: 1, h: 1, kind: 'frame', wall: 'left', accent: '#fd5564', core: true, group: 'statue', kicker: 'Now — Tinder', title: 'iOS Engineer · Tinder', body: 'iOS Engineer, 2026–present. Building features for one of the world’s most-used dating apps — millions of users, where a dropped frame is a matter of the heart. Focus: launch performance and Xcode tooling.' },
    { id: 'statue_nextdoor', x: 2, y: 8, w: 1, h: 1, kind: 'frame', wall: 'left', accent: '#8ed500', core: true, group: 'statue', kicker: '2021–2025 — Nextdoor', title: 'iOS Engineer · Nextdoor', body: 'iOS Engineer, 2021–2025. Four and a half years scaling the iOS app for millions of neighbors — core features in Swift, SwiftUI, TCA & Combine, and the experiments that decided what stayed.' },
    { id: 'frame_instagram', x: 2, y: 12, w: 1, h: 1, kind: 'frame', wall: 'left', core: true, group: 'contact', kicker: 'Instagram', title: 'On Instagram', body: 'Drone aerials, street food, and golden hour over LA. The visual proof the camera gear earns its shelf space.', link: 'https://instagram.com/isaacabelperez', linkLabel: 'Open Instagram' },

    // --- The Shelf: skills as gadgets on a credenza ---
    { id: 'credenza_skills', x: 3, y: 16, w: 11, h: 2, kind: 'furniture', tone: 'credenza', decor: true, flat: true },
    { id: 'crystal_ios', x: 3, y: 16, w: 1, h: 1, kind: 'shelfitem', icon: 'swift', accent: '#e5484d', stat: 96, core: true, group: 'crystal', kicker: 'Skill', title: 'iOS Development — 96', body: 'Forged in Swift, tempered across 5+ years of production iOS. The main weapon, fully upgraded.' },
    { id: 'crystal_mobile', x: 5, y: 16, w: 1, h: 1, kind: 'shelfitem', icon: 'phone', accent: '#cfd2d6', stat: 92, core: true, group: 'crystal', kicker: 'Skill', title: 'Mobile Apps — 92', body: "Five apps from prototype to App Store and counting. Here, shipping isn't a milestone — it's a habit." },
    { id: 'crystal_ai', x: 7, y: 16, w: 1, h: 1, kind: 'shelfitem', icon: 'chip', accent: '#cfd2d6', stat: 90, core: true, group: 'crystal', kicker: 'Skill', title: 'AI Tools — 90', body: 'Fights alongside the machines, not against them. A big part of why this whole office got built in a few sittings.' },
    { id: 'crystal_startups', x: 9, y: 16, w: 1, h: 1, kind: 'shelfitem', icon: 'rocket', accent: '#e5484d', stat: 88, core: true, group: 'crystal', kicker: 'Skill', title: 'Startups — 88', body: 'Founder-class stat: four products shipped solo. See the gap, build the thing, ship the thing, learn in public. Repeat.' },
    { id: 'crystal_photo', x: 11, y: 16, w: 1, h: 1, kind: 'shelfitem', icon: 'camera', accent: '#cfd2d6', stat: 85, core: true, group: 'crystal', kicker: 'Skill', title: 'Photography — 85', body: 'An off-hours specialization that went pro. The framed prints and the drone on the shelf are the receipts.' },
    { id: 'crystal_drones', x: 13, y: 16, w: 1, h: 1, kind: 'shelfitem', icon: 'drone', accent: '#cfd2d6', stat: 83, core: true, group: 'crystal', kicker: 'Skill', title: 'Drones — 83', body: 'Licensed pilot, steady hands, cinematic instincts. The sky is just another viewfinder.' },

    // --- Lore: framed prints + bookshelf ---
    { id: 'map_la', x: 17, y: 2, w: 1, h: 1, kind: 'frame', wall: 'top', core: true, group: 'study', kicker: 'Home Base', title: 'Los Angeles', body: 'Home turf and test market. Street vendors, pickup runs, neighborhoods — every app on the console was playtested on these streets.' },
    { id: 'bookshelf_lore', x: 35, y: 15, w: 2, h: 4, kind: 'bookshelf', decor: true, flat: true },
    { id: 'tome_about', x: 35, y: 15, w: 1, h: 1, kind: 'books', core: true, group: 'study', kicker: 'About', title: 'About Isaac', body: 'I build for real-world community — food trucks, pickup runs, neighborhoods that actually talk. Doctrine: ship fast, learn in public, repeat.' },
    { id: 'tablet_stats', x: 36, y: 6, w: 1, h: 1, kind: 'frame', wall: 'right', core: true, group: 'study', kicker: 'House Rules', title: 'House Rules', body: 'Pinned above the desk: Ship beats perfect. Build in public. Talk to users. Touch grass (and a basketball). Keep one good taco within reach.' },

    // --- Comms: contact console ---
    { id: 'comms_console', x: 3, y: 19, w: 9, h: 2, kind: 'furniture', tone: 'console', decor: true, flat: true },
    { id: 'mailbox_email', x: 3, y: 19, w: 1, h: 1, kind: 'deskitem', icon: 'mail', core: true, group: 'contact', kicker: 'Email', title: 'Drop a Line', body: 'Projects, roles, collabs, good ideas: iperez2435@gmail.com. I actually reply.', link: 'mailto:iperez2435@gmail.com', linkLabel: 'Email me' },
    { id: 'statue_github', x: 5, y: 19, w: 1, h: 1, kind: 'deskitem', icon: 'github', core: true, group: 'contact', kicker: 'GitHub', title: 'On GitHub', body: 'A thousand green squares and the occasional heroic 2 a.m. commit. The public log is open for inspection.', link: 'https://github.com/IsaacAPerez', linkLabel: 'Open GitHub' },
    { id: 'portal_linkedin', x: 7, y: 19, w: 1, h: 1, kind: 'deskitem', icon: 'linkedin', core: true, group: 'contact', kicker: 'LinkedIn', title: 'On LinkedIn', body: 'The official record of titles, dates, and endorsements. Recruiters, this is your shortcut.', link: 'https://linkedin.com/in/isaacabelperez', linkLabel: 'Open LinkedIn' },
    { id: 'chest_resume', x: 10, y: 19, w: 1, h: 1, kind: 'printer', core: true, group: 'contact', kicker: 'Résumé', title: 'The Résumé', body: 'The printer hums and hands you a fresh page — one page, zero fluff. Take a copy.', link: 'Resume.pdf', linkLabel: 'Take the résumé' },

    // --- Secret ---
    { id: 'wall_cracked', x: 35, y: 21, w: 1, h: 1, kind: 'fridge', core: false, kicker: 'Mini-Fridge', title: 'The Mini-Fridge', body: "It hums a little louder than the rest. You open it — and there, on the middle shelf, glowing faintly: one perfect golden taco. Isaac's documented weakness, kept on ice. Curiosity: maxed." },

    // --- Desk cluster (a real battlestation) ---
    { id: 'desk_plant', x: 15, y: 5, w: 1, h: 1, kind: 'deskplant', decor: true, solid: false, lift: 3 },
    { id: 'desk_keyboard', x: 17, y: 5, w: 3, h: 1, kind: 'keyboard', decor: true, solid: false, lift: 3 },
    { id: 'desk_mouse', x: 20, y: 5, w: 1, h: 1, kind: 'mouse', decor: true, solid: false, lift: 3 },
    { id: 'desk_mug', x: 22, y: 5, w: 1, h: 1, kind: 'mug', decor: true, solid: false, lift: 3 },
    { id: 'desk_streamdeck', x: 23, y: 4, w: 1, h: 1, kind: 'streamdeck', decor: true, solid: false },
    { id: 'desk_headphones', x: 24, y: 4, w: 1, h: 1, kind: 'headphones', decor: true, solid: false },

    // --- Decor / life ---
    { id: 'plant_1', x: 2, y: 21, w: 1, h: 1, kind: 'plant', decor: true },
    { id: 'plant_2', x: 24, y: 3, w: 1, h: 1, kind: 'plant', decor: true },
    { id: 'plant_3', x: 33, y: 21, w: 1, h: 1, kind: 'plant', decor: true, solid: false },
    { id: 'lamp_floor', x: 33, y: 18, w: 1, h: 1, kind: 'lamp', decor: true },
    { id: 'coffee_machine', x: 2, y: 3, w: 1, h: 1, kind: 'coffee', decor: true },
    { id: 'espresso_kit', x: 4, y: 3, w: 1, h: 1, kind: 'espresso', decor: true, solid: false },
    { id: 'nas_tower', x: 36, y: 12, w: 1, h: 1, kind: 'nas', decor: true, solid: true },
    { id: 'door_sneakers', x: 22, y: 21, w: 1, h: 1, kind: 'sneakers', decor: true, solid: false },
    { id: 'basketball', x: 36, y: 21, w: 1, h: 1, kind: 'ball', decor: true, solid: false },
    { id: 'wall_print', x: 16, y: 2, w: 1, h: 1, kind: 'frame', wall: 'top', decor: true, solid: false },
    // desk mat is flat so it bakes over the desk surface (must come after desk_main)
    { id: 'desk_mat', x: 16, y: 5, w: 5, h: 1, kind: 'deskmat', decor: true, solid: false, flat: true, lift: 3 },
  ];
  const CORE_TOTAL = ENTITIES.filter(e => e.core).length;
  for (const e of ENTITIES) { e.px = e.x * TILE; e.py = e.y * TILE; if (e.solid === undefined) e.solid = true; }
  // precomputed draw lists (avoid per-frame allocation in render)
  const flatEnts = ENTITIES.filter(e => e.flat);
  const sortEnts = ENTITIES.filter(e => !e.flat);
  const PLAYER_SENT = { _sy: 0 }, DRONE_SENT = { _sy: 0 };
  const drawList = [...sortEnts, PLAYER_SENT, DRONE_SENT];

  // ---------------- Player & NPC state ----------------
  const player = { x: 20 * TILE, y: 13 * TILE, dir: 'up', moving: false, frame: 0, ft: 0, dist: 0 };
  // 'sage' is the roaming Roomba (kept name to reuse the wander code & glue)
  const sage = { x: 23 * TILE, y: 12.5 * TILE, tx: 23 * TILE, ty: 12.5 * TILE, t: 0, dir: 'down', frame: 0, taps: [] };
  const cat = { x: 22 * TILE, y: 16 * TILE, tx: 24 * TILE, ty: 16 * TILE, t: 1, follow: 0, fx: 0 };
  const drone = { x: 35.5 * TILE, y: 13 * TILE, active: !!state.drone, roll: 0, idleT: 0 };
  let particles = [];
  let tacoRain = [];
  let gameActive = false, playing = false, raf = 0, acc = 0, last = 0, time = 0;
  let hintUsed = false;
  let camX = 0, camY = 0, SCALE = 3, viewW = 0, viewH = 0, dpr = 1, cvW = 0, cvH = 0;
  let currentRoom = null, zoneFade = 0;

  // ---------------- Achievements glue ----------------
  function achStore() { try { return JSON.parse(localStorage.getItem('ip-achievements') || '[]'); } catch (e) { return []; } }
  function gUnlock(id) {
    if (typeof window.unlock === 'function') window.unlock(id);
    syncAchCount();
  }
  function syncAchCount() {
    const n = achStore().filter(a => a !== 'konami').length;
    const el = document.getElementById('gameAchCount');
    if (el) el.textContent = n + '/8';
  }

  function coreVisited() { return ENTITIES.filter(e => e.core && visited.has(e.id)).length; }
  function refreshProgress() {
    const fill = document.getElementById('gameProgressFill');
    if (fill) fill.style.width = (coreVisited() / CORE_TOTAL * 100) + '%';
    const star = document.getElementById('gameProgressStar');
    if (star) star.hidden = !state.vaultFound;
  }

  function markVisited(e) {
    if (visited.has(e.id)) return;
    visited.add(e.id);
    state.visited = [...visited];
    saveState();
    if (e.group === 'project') gUnlock('quests');
    if (e.group === 'crystal') gUnlock('statcheck');
    if (e.group === 'study') gUnlock('lorekeeper');
    if (e.group === 'contact') gUnlock('raven');
    if (e.group === 'statue' && visited.has('statue_tinder') && visited.has('statue_nextdoor')) gUnlock('historian');
    refreshProgress();
    if (e.core && coreVisited() === CORE_TOTAL) {
      gUnlock('completionist');
      if (!state.confetti) {
        state.confetti = true; saveState();
        burst(player.x, player.y - 10, 60, [PAL.gold, PAL.goldBright, PAL.goldDeep, '#fff'], 2.2);
        sfx('fanfare');
      }
    }
  }

  // ---------------- Audio (tiny synth, gesture-gated) ----------------
  let ac = null;
  function ensureAudio() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } }
  function tone(freq, t0, dur, type, gain) {
    if (!ac) return;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, ac.currentTime + t0);
    g.gain.linearRampToValueAtTime(gain || 0.05, ac.currentTime + t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + t0 + dur);
    o.connect(g); g.connect(ac.destination);
    o.start(ac.currentTime + t0); o.stop(ac.currentTime + t0 + dur + 0.05);
  }
  function sfx(name) {
    if (state.muted || !ac) return;
    if (name === 'blip') tone(620, 0, 0.07, 'square', 0.025);
    else if (name === 'close') tone(420, 0, 0.06, 'square', 0.02);
    else if (name === 'chime') { tone(740, 0, 0.25, 'sine', 0.04); tone(1108, 0.08, 0.3, 'sine', 0.03); }
    else if (name === 'fanfare') { tone(523, 0, 0.16, 'triangle', 0.05); tone(659, 0.14, 0.16, 'triangle', 0.05); tone(784, 0.28, 0.34, 'triangle', 0.06); }
    else if (name === 'meow') { tone(880, 0, 0.09, 'sine', 0.03); tone(660, 0.07, 0.12, 'sine', 0.025); }
    else if (name === 'step') tone(118 + hash2(player.dist | 0, 3) * 42, 0, 0.045, 'triangle', 0.016);
    else if (name === 'near') tone(880, 0, 0.05, 'sine', 0.018);
  }

  // ---------------- Particles ----------------
  function burst(x, y, n, colors, life) {
    for (let i = 0; i < n; i++) {
      if (particles.length >= 80) break;
      const a = (i / n) * Math.PI * 2 + hash2(i, n);
      const sp = 30 + hash2(i, 3) * 60;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, g: 90, life: life || 1, t: 0, color: colors[i % colors.length], size: 2 });
    }
  }
  function hearts(x, y) {
    for (let i = 0; i < 4; i++) particles.push({ x: x + (hash2(i, 9) - 0.5) * 12, y, vx: 0, vy: -18, g: 0, life: 0.9, t: 0, color: '#ef6461', size: 2, heart: true });
  }
  function dust(x, y) {
    if (REDUCED || particles.length >= 40) return;
    particles.push({ x: x + (hash2(time * 60 | 0, 5) - 0.5) * 8, y, vx: 0, vy: -6, g: 0, life: 0.5, t: 0, color: PAL.light ? 'rgba(120,100,60,0.5)' : 'rgba(220,220,255,0.25)', size: 1.5 });
  }
  function startTacoRain() {
    tacoRain = [];
    for (let i = 0; i < 20; i++) tacoRain.push({ x: hash2(i, 1) , y: -hash2(i, 2) * 0.8, v: 0.35 + hash2(i, 3) * 0.5, r: hash2(i, 4) * 6 });
    gUnlock('konami');
    sfx('fanfare');
  }

  // ---------------- Collision & movement ----------------
  function solidAt(px, py) {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    const id = gAt(tx, ty);
    if (!isFloorId(id)) return true;
    return false;
  }
  function entityBlocks(px, py, hw, hh) {
    for (const e of ENTITIES) {
      if (!e.solid) continue;
      if (e.id === 'wall_cracked') continue; // baked into the wall grid
      if (e.id === 'shrine_taco' && !state.vaultOpen) continue;
      const ex1 = e.px, ey1 = e.py, ex2 = e.px + e.w * TILE, ey2 = e.py + e.h * TILE;
      if (px + hw > ex1 && px - hw < ex2 && py + hh > ey1 && py - hh < ey2) return true;
    }
    return false;
  }
  function canStand(px, py) {
    const hw = 6, hh = 5; // feet box 12x10
    if (solidAt(px - hw, py - hh) || solidAt(px + hw, py - hh) || solidAt(px - hw, py + hh) || solidAt(px + hw, py + hh)) return false;
    if (entityBlocks(px, py, hw, hh)) return false;
    return true;
  }
  function moveActor(a, dx, dy, dt, speed) {
    if (dx || dy) {
      const len = Math.hypot(dx, dy); dx /= len; dy /= len;
      const nx = a.x + dx * speed * dt, ny = a.y + dy * speed * dt;
      if (canStand(nx, a.y)) a.x = nx;
      if (canStand(a.x, ny)) a.y = ny;
    }
  }

  // ---------------- Input ----------------
  const keys = {};
  const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
  let kIdx = 0;
  window.addEventListener('keydown', (ev) => {
    if (!gameActive) return;
    const k = ev.key.toLowerCase();
    if (dialogOpen) {
      // Let Enter/Space activate a focused link/button inside the dialog
      const onAction = document.activeElement && document.activeElement.closest &&
        document.activeElement.closest('.game-dialog-actions');
      if ((k === 'enter' || k === ' ') && onAction) return;
      if (k === 'e' || k === 'escape' || k === 'enter' || k === ' ') {
        if (typing) finishType(); else closeDialog();
        ev.preventDefault();
      }
      if (k === 'tab') trapFocus(ev);
      return;
    }
    if (!playing) return;
    // game-side konami (parallel to the site's — unlock() dedupes); gated so it
    // can't advance while a dialog is open or the game is paused
    kIdx = (k === KONAMI[kIdx]) ? kIdx + 1 : (k === KONAMI[0] ? 1 : 0);
    if (kIdx === KONAMI.length) { kIdx = 0; startTacoRain(); }
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd', ' ', 'e', 'enter'].includes(k)) ev.preventDefault();
    keys[k] = true;
    if (k === 'e' || k === ' ' || k === 'enter') tryInteract();
    if (k === 'escape') exitGame();
  });
  window.addEventListener('keyup', (ev) => { keys[ev.key.toLowerCase()] = false; });

  // Touch
  const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const joy = { active: false, id: null, dx: 0, dy: 0, ox: 0, oy: 0 };
  if (isTouch) root.classList.add('touch');
  const joyEl = document.getElementById('gameJoystick');
  const stickEl = document.getElementById('gameJoystickStick');
  // Movement is relative to where the thumb first landed, so touching the pad's
  // edge doesn't start the hero pre-walking.
  function joyFrom(t) {
    let dx = t.clientX - joy.ox, dy = t.clientY - joy.oy;
    const len = Math.hypot(dx, dy), max = 40;
    if (len > max) { dx = dx / len * max; dy = dy / len * max; }
    stickEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    joy.dx = Math.abs(dx) / max > 0.12 ? dx / max : 0;
    joy.dy = Math.abs(dy) / max > 0.12 ? dy / max : 0;
  }
  function joyReset() { joy.active = false; joy.id = null; joy.dx = 0; joy.dy = 0; stickEl.style.transform = 'translate(-50%,-50%)'; }
  function nearJoystick(t) {
    const r = joyEl.getBoundingClientRect(), m = 30;
    return t.clientX >= r.left - m && t.clientX <= r.right + m && t.clientY >= r.top - m && t.clientY <= r.bottom + m;
  }
  root.addEventListener('touchstart', (ev) => {
    if (!playing) return;
    for (const t of ev.changedTouches) {
      if (!joy.active && nearJoystick(t)) {
        joy.active = true; joy.id = t.identifier; joy.ox = t.clientX; joy.oy = t.clientY; joyFrom(t); ev.preventDefault();
      } else if (ev.target === canvas) {
        // tap-to-interact: tap an entity near the player
        tapInteract(t.clientX, t.clientY);
      }
    }
  }, { passive: false });
  root.addEventListener('touchmove', (ev) => {
    for (const t of ev.changedTouches) if (joy.active && t.identifier === joy.id) { joyFrom(t); ev.preventDefault(); }
  }, { passive: false });
  function endTouch(ev) {
    for (const t of ev.changedTouches) if (joy.active && t.identifier === joy.id) joyReset();
  }
  root.addEventListener('touchend', endTouch);
  root.addEventListener('touchcancel', endTouch);
  const actionBtn = document.getElementById('gameActionBtn');
  actionBtn.addEventListener('touchstart', (ev) => { ev.preventDefault(); ev.stopPropagation(); if (dialogOpen) { typing ? finishType() : closeDialog(); } else tryInteract(); }, { passive: false });
  actionBtn.addEventListener('click', (ev) => { ev.stopPropagation(); if (dialogOpen) { typing ? finishType() : closeDialog(); } else tryInteract(); });

  function screenToWorld(sx, sy) {
    const r = canvas.getBoundingClientRect();
    return [camX + (sx - r.left) / SCALE, camY + (sy - r.top) / SCALE];
  }
  function tapInteract(sx, sy) {
    if (dialogOpen) { typing ? finishType() : closeDialog(); return; }
    const [wx, wy] = screenToWorld(sx, sy);
    for (const e of ENTITIES) {
      if (e.decor) continue;
      if (e.id === 'wall_cracked' && state.vaultOpen) continue;
      if (e.id === 'shrine_taco' && !state.vaultOpen) continue;
      const cx = e.px + e.w * TILE / 2, cy = e.py + e.h * TILE / 2;
      if (Math.abs(wx - cx) < TILE && Math.abs(wy - cy) < TILE &&
          Math.hypot(player.x - cx, player.y - cy) < 2.2 * TILE) {
        // mobile konami: 5 taps on the sage within 2s
        if (e.id === 'npc_sage') {
          sage.taps.push(time);
          sage.taps = sage.taps.filter(t => time - t < 2);
          if (sage.taps.length >= 5) { sage.taps = []; startTacoRain(); return; }
        }
        interact(e);
        return;
      }
    }
  }

  // ---------------- Interaction ----------------
  function interactTarget() {
    let best = null, bd = 1.6 * TILE;
    for (const e of ENTITIES) {
      if (e.decor) continue;
      if (e.id === 'wall_cracked' && state.vaultOpen) continue;
      if (e.id === 'shrine_taco' && !state.vaultOpen) continue;
      const cx = e.px + e.w * TILE / 2, cy = e.py + e.h * TILE / 2;
      let d = Math.hypot(player.x - cx, player.y - (cy + (e.h > 1 ? e.h * TILE / 4 : 0)));
      if (e.w > 1 || e.h > 1) d -= TILE * 0.4;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  function tryInteract() { const e = interactTarget(); if (e) interact(e); }

  function interact(e) {
    ensureAudio();
    hintUsed = true;
    if (e.id === 'wall_cracked') { // the mini-fridge secret
      if (!state.vaultFound) { state.vaultOpen = true; state.vaultFound = true; saveState(); refreshProgress(); sfx('chime'); }
      else sfx('blip');
      openDialog(e);
      return;
    }
    if (e.id === 'dungeon_cat') { hearts(cat.x, cat.y - 14); cat.follow = 5 * TILE; sfx('meow'); }
    else if (e.id === 'pad_captured' && !state.drone) { state.drone = true; drone.active = true; drone.roll = REDUCED ? 0 : Math.PI * 2; saveState(); sfx('chime'); }
    else if (e.id === 'chest_resume' && !state.chestOpened) {
      state.chestOpened = true; saveState();
      burst(e.px + 8, e.py, 12, [PAL.gold, PAL.goldBright, '#fff'], 1.4);
      sfx('fanfare');
    } else sfx('blip');
    openDialog(e);
    if (e.core) markVisited(e);
  }

  // ---------------- Dialog ----------------
  const dlg = document.getElementById('gameDialog');
  const dlgEmoji = document.getElementById('gameDialogEmoji');
  const dlgKicker = document.getElementById('gameDialogKicker');
  const dlgTitle = document.getElementById('gameDialogTitle');
  const dlgBody = document.getElementById('gameDialogBody');
  const dlgActions = document.getElementById('gameDialogActions');
  const dlgClose = document.getElementById('gameDialogClose');
  let dialogOpen = false, typing = false, typeTimer = 0, fullText = '';

  function sageBody() {
    return coreVisited() === CORE_TOTAL
      ? "You read EVERYTHING? Hired. Wait — no, that's my line."
      : ENTITIES.find(x => x.id === 'npc_sage').body;
  }

  function openDialog(e) {
    dialogOpen = true;
    const ID_EMOJI = { map_la: '🗺️', tablet_stats: '📋', frame_instagram: '📷', tome_about: '📚', wall_cracked: '🌮' };
    const ICON_EMOJI = { mail: '✉️', github: '🐙', linkedin: '💼', swift: '📱', phone: '📱', chip: '🧠', rocket: '🚀', camera: '📷', drone: '🚁' };
    const KIND_EMOJI = { monitors: '🖥️', roomba: '🤖', door: '🚪', phone: e.emoji, camera: '📷', frame: '🖼️', books: '📚', printer: '🖨️', fridge: '🧊', shelfitem: '🛠️', deskitem: '✉️', emoji: e.emoji };
    dlgEmoji.textContent = ID_EMOJI[e.id] || e.emoji || ICON_EMOJI[e.icon] || KIND_EMOJI[e.kind] || '📄';
    dlgKicker.textContent = e.kicker || '';
    dlgTitle.textContent = e.title;
    fullText = e.id === 'npc_sage' ? sageBody() : e.body;
    dlgBody.textContent = '';
    dlgActions.innerHTML = '';
    // stat bar for skill items
    if (e.stat != null) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;align-items:center;gap:10px;margin-top:4px;width:100%;';
      wrap.innerHTML = `<div class="stat-track" style="flex:1"><div class="stat-fill"></div></div><span class="stat-num">${e.stat}</span>`;
      dlgActions.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => { wrap.querySelector('.stat-fill').style.width = e.stat + '%'; }));
    }
    if (e.link) {
      const a = document.createElement('a');
      a.className = 'btn btn-gold';
      a.href = e.link;
      if (!e.link.startsWith('mailto:')) { a.target = '_blank'; a.rel = 'noopener'; }
      a.textContent = e.linkLabel || 'Open';
      a.addEventListener('click', () => { if (e.group === 'contact') gUnlock('raven'); });
      dlgActions.appendChild(a);
    }
    if (e.id === 'stairs_exit') {
      const b = document.createElement('button');
      b.className = 'btn btn-gold'; b.textContent = 'Step Through';
      b.addEventListener('click', () => { closeDialog(); exitGame(); });
      dlgActions.appendChild(b);
      const k = document.createElement('button');
      k.className = 'btn btn-ghost'; k.textContent = 'Keep Exploring';
      k.addEventListener('click', closeDialog);
      dlgActions.appendChild(k);
    }
    dlg.classList.add('open');
    dlg.setAttribute('aria-modal', 'true');
    // typewriter
    if (REDUCED) { dlgBody.textContent = fullText; typing = false; }
    else { typing = true; typeTimer = 0; }
    const focusable = dlgActions.querySelector('a,button') || dlgClose;
    setTimeout(() => focusable.focus({ preventScroll: true }), 60);
  }
  function finishType() { dlgBody.textContent = fullText; typing = false; }
  function closeDialog() {
    dialogOpen = false; typing = false;
    dlg.classList.remove('open');
    dlg.setAttribute('aria-modal', 'false');
    sfx('close');
    canvas.focus({ preventScroll: true });
  }
  dlgClose.addEventListener('click', closeDialog);
  function trapFocus(ev) {
    const els = [...dlg.querySelectorAll('a,button')].filter(el => el.offsetParent !== null);
    if (!els.length) return;
    const first = els[0], lastEl = els[els.length - 1];
    if (ev.shiftKey && document.activeElement === first) { lastEl.focus(); ev.preventDefault(); }
    else if (!ev.shiftKey && document.activeElement === lastEl) { first.focus(); ev.preventDefault(); }
  }

  // ---------------- Zone label ("you are here") ----------------
  function nearestZone() {
    let best = 'Home Office', bd = 5.5 * TILE;
    for (const z of ZONES) {
      const d = Math.hypot(player.x - z.x * TILE, player.y - z.y * TILE);
      if (d < bd) { bd = d; best = z.name; }
    }
    return best;
  }
  function updateZone() {
    const name = nearestZone();
    if (name !== currentRoom) {
      currentRoom = name;
      const label = document.getElementById('gameZoneLabel');
      if (label) {
        label.textContent = name;
        label.style.transition = 'none';
        label.style.opacity = '0'; label.style.transform = 'translateY(-4px)';
        void label.offsetWidth; // flush so the next transition runs
        label.style.transition = 'opacity 0.4s, transform 0.4s';
        label.style.opacity = '1'; label.style.transform = 'translateY(0)';
      }
    }
  }

  // ---------------- Update ----------------
  function update(dt) {
    time += dt;
    // player input
    let dx = (keys['arrowright'] || keys['d'] ? 1 : 0) - (keys['arrowleft'] || keys['a'] ? 1 : 0) + joy.dx;
    let dy = (keys['arrowdown'] || keys['s'] ? 1 : 0) - (keys['arrowup'] || keys['w'] ? 1 : 0) + joy.dy;
    if (dialogOpen) { dx = 0; dy = 0; }
    player.moving = !!(dx || dy);
    if (player.moving) {
      if (Math.abs(dx) >= Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
      else player.dir = dy > 0 ? 'down' : 'up';
      const ox = player.x, oy = player.y;
      moveActor(player, dx, dy, dt, PLAYER_SPEED * Math.min(1, Math.hypot(dx, dy)));
      const moved = Math.hypot(player.x - ox, player.y - oy);
      player.dist += moved;
      player.ft += dt;
      if (player.ft > 0.14) { player.ft = 0; player.frame = 1 - player.frame; if (player.frame) { dust(player.x, player.y + 10); sfx('step'); } }
      if (cat.follow > 0) cat.follow -= moved;
      drone.idleT = 0;
    } else { player.frame = 0; drone.idleT += dt; }

    // typewriter
    if (typing) {
      typeTimer += dt * 45;
      const n = Math.min(fullText.length, typeTimer | 0);
      dlgBody.textContent = fullText.slice(0, n);
      if (n >= fullText.length) typing = false;
    }

    // roomba wander (roams the open center floor)
    sage.t -= dt;
    if (sage.t <= 0) {
      sage.t = 2 + hash2(time * 13 | 0, 7) * 3;
      sage.tx = (16 + hash2(time * 7 | 0, 3) * 12) * TILE;
      sage.ty = (10 + hash2(time * 11 | 0, 5) * 8) * TILE;
    }
    if (!dialogOpen) {
      const sdx = sage.tx - sage.x, sdy = sage.ty - sage.y;
      if (Math.hypot(sdx, sdy) > 2) {
        sage.x += sdx * dt * 0.8; sage.y += sdy * dt * 0.8;
        sage.dir = Math.abs(sdx) > Math.abs(sdy) ? (sdx > 0 ? 'right' : 'left') : (sdy > 0 ? 'down' : 'up');
        sage.frame = (time * 4 | 0) % 2;
      } else sage.frame = 0;
    } else {
      sage.dir = player.x < sage.x ? 'left' : 'right';
    }
    ENTITIES.find(e => e.id === 'npc_sage').px = sage.x - 8;
    ENTITIES.find(e => e.id === 'npc_sage').py = sage.y - 8;

    // cat
    if (cat.follow > 0) {
      const cdx = player.x - cat.x, cdy = player.y - cat.y, d = Math.hypot(cdx, cdy);
      if (d > TILE * 1.2) { cat.x += cdx / d * 60 * dt; cat.y += cdy / d * 60 * dt; }
      if (cdx > 1) cat.fx = 1; else if (cdx < -1) cat.fx = -1;
    } else {
      cat.t -= dt;
      if (cat.t <= 0) { cat.t = 2.5 + hash2(time * 17 | 0, 2) * 3; cat.tx = (17 + hash2(time * 5 | 0, 8) * 11) * TILE; cat.ty = (11 + hash2(time * 3 | 0, 4) * 7) * TILE; }
      const cdx = cat.tx - cat.x, cdy = cat.ty - cat.y;
      if (Math.hypot(cdx, cdy) > 2) { cat.x += cdx * dt * 0.7; cat.y += cdy * dt * 0.7; if (cdx > 1) cat.fx = 1; else if (cdx < -1) cat.fx = -1; }
    }
    const catEnt = ENTITIES.find(e => e.id === 'dungeon_cat');
    catEnt.px = cat.x - 8; catEnt.py = cat.y - 8;

    // drone companion
    if (state.drone) {
      const behind = { up: [0, 24], down: [0, -24], left: [24, 0], right: [-24, 0] }[player.dir];
      const k2 = Math.min(1, dt * (REDUCED ? 60 : 4.8));
      drone.x += (player.x + behind[0] - drone.x) * k2;
      drone.y += (player.y + behind[1] - 14 - drone.y) * k2;
      if (drone.roll > 0) drone.roll = Math.max(0, drone.roll - dt * 7);
      if (!REDUCED && drone.idleT > 5 && drone.roll <= 0) { drone.roll = Math.PI * 2; drone.idleT = 0; }
    }

    // particles
    for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += (p.g || 0) * dt; }
    particles = particles.filter(p => p.t < p.life);
    for (const t of tacoRain) t.y += t.v * dt;
    tacoRain = tacoRain.filter(t => t.y < 1.2);

    // camera
    const targetX = player.x - viewW / 2, targetY = player.y - viewH / 2;
    const k = REDUCED ? 1 : Math.min(1, dt * 7);
    camX += (targetX - camX) * k; camY += (targetY - camY) * k;
    camX = Math.max(0, Math.min(MAPW * TILE - viewW, camX));
    camY = Math.max(0, Math.min(MAPH * TILE - viewH, camY));

    updateZone();

    // interaction target: chirp + glyph pop the moment a new target comes in range
    const tgt = dialogOpen ? null : interactTarget();
    curTarget = tgt; // render reads this instead of recomputing
    const tgtId = tgt ? tgt.id : null;
    if (tgtId && tgtId !== lastTargetId) { sfx('near'); promptPop = REDUCED ? 0 : 0.18; }
    lastTargetId = tgtId;
    if (promptPop > 0) promptPop = Math.max(0, promptPop - dt);
    if (isTouch) actionBtn.classList.toggle('ready', !!tgt);
  }
  let lastTargetId = null, promptPop = 0, curTarget = null;

  // ---------------- Render ----------------
  function drawShadow(x, y, w) {
    const cx = sx(x), cy = sy(y);
    // soft penumbra + tighter core so live actors ground like the baked AO
    ctx.fillStyle = PAL.light ? 'rgba(0,0,0,0.10)' : 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * SCALE * 0.62, 3.0 * SCALE, 0, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.light ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.ellipse(cx, cy, w * SCALE * 0.42, 1.9 * SCALE, 0, 0, 7); ctx.fill();
  }
  function sx(wx) { return Math.round((wx - camX) * SCALE); }
  function sy(wy) { return Math.round((wy - camY) * SCALE); }

  function drawRig(rig, x, y, dir, frame, bob) {
    const side = dir === 'left' || dir === 'right';
    const img = rig[side ? 'side' : dir][frame];
    const w = 16 * SCALE, h = 24 * SCALE;
    drawShadow(x, y + 10, 12);
    ctx.save();
    if (dir === 'left') { ctx.translate(sx(x), 0); ctx.scale(-1, 1); ctx.translate(-sx(x), 0); }
    ctx.drawImage(img, sx(x) - w / 2, sy(y) - h + 10 * SCALE + (bob || 0) * SCALE, w, h);
    ctx.restore();
  }

  // rect helper in tile-pixel units relative to an entity origin (X,Y) at scale S
  function R(X, Y, S, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(X + x * S, Y + y * S, w * S, h * S); }
  // hex (#rrggbb) -> rgba() string with explicit alpha (for gradient stops)
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  function drawEntity(e) {
    const px = e.px, py = e.py;
    const X = sx(px), Y = sy(py) - (e.lift || 0) * SCALE; // lift seats props onto a surface
    const S = SCALE;
    const WP = e.w * 16, HP = e.h * 16;
    // offscreen cull (generous margin for tripods, glows, the floating prompt/pip)
    const M = 40 * S;
    if (X + (WP + 8) * S < -M || Y + (HP + 24) * S < -M || X > cvW + M || Y - 24 * S > cvH + M) return;
    const red = PAL.gold, white = PAL.white, black = PAL.black, metal = PAL.metal, metalD = PAL.metalDark, screen = PAL.screen;
    const pulse = REDUCED ? 0.5 : (Math.sin(time * Math.PI + (px + py) * 0.05) + 1) / 2;
    switch (e.kind) {
      case 'furniture': {
        const tops = { desk: white, console: black, credenza: white, shelf: metal };
        const bodies = { desk: metalD, console: metalD, credenza: black, shelf: metalD };
        const top = tops[e.tone] || white, body = bodies[e.tone] || metalD;
        R(X, Y, S, 0, HP - 5, WP, 5, body);                                   // front / legs
        R(X, Y, S, 0, HP - 7, WP, 2, PAL.light ? '#d9d4c8' : '#2a2b30');      // laminate edge band (thickness)
        R(X, Y, S, 0, 0, WP, HP - 6, top);                                    // surface
        if (e.tone === 'credenza') { // warm wood under the white top
          R(X, Y, S, 0, 3, WP, 1, PAL.light ? 'rgba(120,90,50,0.12)' : 'rgba(120,90,50,0.18)');
          R(X, Y, S, 0, 0, WP, 1, 'rgba(255,220,170,0.3)');
        }
        if (e.tone === 'console') { // matte black: drawer seams + handles + kickplate
          for (let i = 1; i < e.w; i += 2) { R(X, Y, S, i * 16, HP - 5, 1, 5, 'rgba(0,0,0,0.45)'); R(X, Y, S, i * 16 - 4, HP - 3, 3, 1, metal); }
          R(X, Y, S, 0, 0, WP, 2, 'rgba(255,255,255,0.06)');
          R(X, Y, S, 1, HP - 1, WP - 2, 1, 'rgba(0,0,0,0.35)');
        } else { // gloss surfaces: crisp highlight
          R(X, Y, S, 0, 0, WP, 1, PAL.light ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.12)');
        }
        R(X, Y, S, 0, HP, WP, 1, 'rgba(0,0,0,0.18)');                         // hard contact line
        if (e.id === 'desk_main') { // cable grommets on the back third
          R(X, Y, S, 2.5, 1, 3, 3, black); R(X, Y, S, 3, 1.5, 2, 2, metalD);
          R(X, Y, S, WP - 5.5, 1, 3, 3, black); R(X, Y, S, WP - 5, 1.5, 2, 2, metalD);
        }
        return; // decor: no pip
      }
      case 'bookshelf': {
        R(X, Y, S, 0, 0, WP, HP, black);
        R(X, Y, S, 1, 1, WP - 2, HP - 2, PAL.light ? '#e7e3da' : '#202126');
        R(X, Y, S, 1, 1, 1, HP - 2, 'rgba(0,0,0,0.18)');                    // interior left AO
        const spineCols = [white, PAL.bodyTop, red, metal, PAL.bodyTop, white];
        for (let s = 0; s < e.h; s++) {
          R(X, Y, S, 1, s * 16 + 12, WP - 2, 2, black);                     // shelf board
          R(X, Y, S, 1, s * 16 + 12, WP - 2, 1, 'rgba(0,0,0,0.22)');        // under-shelf AO
          if (s === 1) { // trophy + a couple of books
            R(X, Y, S, 2, s * 16 + 3, 2, 9, white); R(X, Y, S, 4, s * 16 + 4, 2, 8, red);
            ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(X + 9 * S, Y + (s * 16 + 4) * S); ctx.lineTo(X + 12 * S, Y + (s * 16 + 4) * S); ctx.lineTo(X + 11 * S, Y + (s * 16 + 8) * S); ctx.lineTo(X + 10 * S, Y + (s * 16 + 8) * S); ctx.closePath(); ctx.fill();
            R(X, Y, S, 10, s * 16 + 8, 1, 2, metalD); R(X, Y, S, 9, s * 16 + 10, 3, 1, metalD); R(X, Y, S, 9.5, s * 16 + 9, 2, 1, red);
          } else if (s === 2) { // horizontal stack + leaning framed photo
            R(X, Y, S, 2, s * 16 + 9, 6, 1.5, white); R(X, Y, S, 2, s * 16 + 7, 5, 1.5, PAL.bodyTop); R(X, Y, S, 2, s * 16 + 5, 6, 1.5, red);
            R(X, Y, S, 9, s * 16 + 4, 4, 7, black); R(X, Y, S, 9.5, s * 16 + 4.5, 3, 6, PAL.screenLit);
          } else if (s === 3) { // chunky refs + a small succulent
            for (let i = 0; i < 4; i++) R(X, Y, S, 2 + i * 1.6, s * 16 + 2, 1.4, 10, spineCols[i % 6]);
            R(X, Y, S, 9, s * 16 + 8, 3, 3, PAL.pot); R(X, Y, S, 9.5, s * 16 + 5, 2, 3, PAL.plant);
          } else { // tilted books (lore/about lives here, keep readable)
            for (let i = 0; i < 6; i++) R(X, Y, S, 2 + i * 2, s * 16 + 3, 1.7, 9, spineCols[i % 6]);
          }
        }
        return;
      }
      case 'chair': {
        drawShadow(px + WP / 2, py + HP - 3, 11);
        // 5-star base
        ctx.strokeStyle = metalD; ctx.lineWidth = Math.max(1, S);
        const bcx = X + 8 * S, bcy = Y + 15 * S;
        for (const a of [-90, -25, 40, 140, 215]) { const rad = a * Math.PI / 180; ctx.beginPath(); ctx.moveTo(bcx, bcy); const ex = bcx + Math.cos(rad) * 5 * S, ey = bcy + Math.sin(rad) * 5 * S; ctx.lineTo(ex, ey); ctx.stroke(); ctx.fillStyle = black; ctx.fillRect(ex - S * 0.5, ey - S * 0.5, S, S); }
        R(X, Y, S, 7, 12, 2, 3, metalD); R(X, Y, S, 7, 12, 1, 3, metal);   // gas post
        R(X, Y, S, 3, 6, 10, 7, black);                                    // seat
        R(X, Y, S, 4, 6, 8, 1, 'rgba(255,255,255,0.08)');                  // cushion sheen
        R(X, Y, S, 3, 12, 10, 1, 'rgba(0,0,0,0.4)');                       // front lip shadow
        R(X, Y, S, 4, 1, 8, 4, metalD);                                    // mesh back frame
        R(X, Y, S, 5, 2, 6, 2, PAL.light ? '#46484e' : '#2c2e34');         // mesh
        R(X, Y, S, 4, 1, 8, 1, red);                                       // brand piping
        R(X, Y, S, 2, 7, 1, 4, black); R(X, Y, S, 13, 7, 1, 4, black);     // armrests
        return;
      }
      case 'plant': {
        drawShadow(px + 8, py + 15, 8);
        R(X, Y, S, 4, 11, 8, 5, PAL.pot);
        R(X, Y, S, 4, 11, 8, 1, PAL.light ? '#fff' : '#3a3b40');
        R(X, Y, S, 5, 11.5, 6, 1.5, PAL.soil);
        R(X, Y, S, 5, 15, 6, 1, 'rgba(0,0,0,0.25)');
        const sway = REDUCED ? 0 : Math.sin(time * 1.25 + px * 0.05); // sub-1px breeze on foliage only
        if (e.id === 'plant_3') { // snake plant — stiff blades
          for (let i = 0; i < 5; i++) {
            const bx = 4 + i * 1.6 + sway * 0.4 * (i - 2), hgt = 9 + (i % 2) * 2;
            ctx.fillStyle = PAL.plant; ctx.fillRect(X + (bx) * S, Y + (12 - hgt) * S, 1.4 * S, hgt * S);
            ctx.fillStyle = PAL.plantDark; ctx.fillRect(X + (bx + 0.5) * S, Y + (12 - hgt) * S, 0.4 * S, hgt * S);
            ctx.fillStyle = PAL.plantMid; ctx.fillRect(X + (bx) * S, Y + (12 - hgt) * S, 0.3 * S, hgt * S);
          }
        } else { // monstera — leafy fans
          const leaf = (tx, ty, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(X + 8 * S, Y + 12 * S); ctx.lineTo(X + (tx + sway * 0.6) * S, Y + ty * S); ctx.lineTo(X + (tx + 2.5 + sway * 0.6) * S, Y + (ty + 2.5) * S); ctx.closePath(); ctx.fill(); };
          leaf(2, 3, PAL.plantDark); leaf(14, 3, PAL.plantDark);
          leaf(4, 1, PAL.plant); leaf(12, 1, PAL.plant); leaf(8, -2, PAL.plant);
          R(X, Y, S, 6, 2, 1, 3, PAL.plantMid); // rim light
        }
        return;
      }
      case 'lamp': {
        R(X, Y, S, 7, 6, 2, 9, metalD);              // pole
        R(X, Y, S, 5, 14, 6, 2, metalD);             // base
        R(X, Y, S, 4, 1, 8, 5, PAL.light ? '#fff7e0' : '#3a352a'); // shade
        R(X, Y, S, 4, 5, 8, 1, PAL.lightWarm);       // hot lip (light origin)
        if (!REDUCED) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = PAL.light ? 0.25 : 0.55; ctx.drawImage(glowSpriteWarm(), X + 2 * S, Y + 2 * S, 12 * S, 12 * S); ctx.restore(); ctx.globalAlpha = 1; }
        return;
      }
      case 'coffee': {
        drawShadow(px + 8, py + 15, 8);
        R(X, Y, S, 3, 3, 10, 12, black);
        R(X, Y, S, 4, 4, 8, 4, metalD);              // top
        R(X, Y, S, 6, 9, 4, 4, white);               // cup
        R(X, Y, S, 6, 8, 4, 1, red);                 // button
        return;
      }
      case 'ball': {
        drawShadow(px + 8, py + 14, 6);
        ctx.fillStyle = '#d2691e'; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 9 * S, 5 * S, 0, 7); ctx.fill();
        ctx.strokeStyle = '#1c1c1e'; ctx.lineWidth = Math.max(1, S * 0.5);
        ctx.beginPath(); ctx.moveTo(X + 3 * S, Y + 9 * S); ctx.lineTo(X + 13 * S, Y + 9 * S);
        ctx.moveTo(X + 8 * S, Y + 4 * S); ctx.lineTo(X + 8 * S, Y + 14 * S); ctx.stroke();
        return;
      }
      case 'monitors': {
        // directional cool wash onto desk + floor (cached strip; static, so reduced-motion keeps it)
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        ctx.drawImage(monitorWash(), X - 6 * S, Y - 3 * S, (WP + 12) * S, 20 * S); ctx.restore();
        // monitor arm
        R(X, Y, S, 12, 11, 8, 3, black); R(X, Y, S, 15, 4, 2, 8, metalD); R(X, Y, S, 15, 4, 1, 8, metal);
        // asymmetric dual: main (landscape) + side (portrait)
        // main — code editor
        R(X, Y, S, 1, -1, 15, 11, black); R(X, Y, S, 2, 0, 13, 8, screen);
        R(X, Y, S, 2, 0, 2, 8, '#0e1117'); // gutter
        const codeCols = ['rgba(120,200,255,0.65)', 'rgba(255,255,255,0.30)', 'rgba(120,255,170,0.55)', 'rgba(255,255,255,0.28)', 'rgba(255,200,120,0.5)'];
        const cw5 = [5, 7, 3, 6, 4];
        for (let i = 0; i < 5; i++) R(X, Y, S, 4, 1 + i * 1.4, cw5[i], 1, codeCols[i]);
        const car = REDUCED ? 1 : 0.2 + 0.8 * (0.5 + 0.5 * Math.sin(time * 3.5));
        ctx.globalAlpha = car; R(X, Y, S, 10, 6, 1, 1, red); ctx.globalAlpha = 1;
        R(X, Y, S, 2, 7, 13, 1, metalD); // chin
        // side — terminal + tiny chart
        R(X, Y, S, 17, 0, 9, 11, black); R(X, Y, S, 18, 1, 7, 8, screen);
        R(X, Y, S, 19, 2, 1, 1, red); R(X, Y, S, 21, 2, 3, 1, 'rgba(120,255,170,0.5)');
        R(X, Y, S, 19, 4, 1, 3, white); R(X, Y, S, 21, 5, 1, 2, red); R(X, Y, S, 23, 3, 1, 4, 'rgba(120,200,255,0.6)');
        R(X, Y, S, 18, 8, 7, 1, metalD);
        // glass glare (triangles, top-left of each panel)
        ctx.save(); ctx.globalAlpha = PAL.light ? 0.18 : 0.10; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(X + 2 * S, Y); ctx.lineTo(X + 7 * S, Y); ctx.lineTo(X + 2 * S, Y + 5 * S); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(X + 18 * S, Y + S); ctx.lineTo(X + 22 * S, Y + S); ctx.lineTo(X + 18 * S, Y + 5 * S); ctx.closePath(); ctx.fill();
        ctx.restore(); ctx.globalAlpha = 1;
        // desk reflection streaks
        ctx.globalAlpha = PAL.light ? 0.12 : 0.20; R(X, Y, S, 3, 12, 12, 3, PAL.screenLit); R(X, Y, S, 18, 12, 7, 3, PAL.screenLit); ctx.globalAlpha = 1;
        break;
      }
      case 'roomba': {
        const rx = sage.x, ry = sage.y, RX = sx(rx), RY = sy(ry);
        drawShadow(rx, ry + 4, 9);
        const disc = (r, c) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(RX, RY, r * S, 0, 7); ctx.fill(); };
        disc(6.5, metalD);                                  // bumper
        disc(5.5, black);                                   // body
        disc(4, PAL.light ? '#26282e' : '#1a1c20');         // top plate
        disc(2, metalD);                                    // lidar puck
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(RX - 0.6 * S, RY - 0.6 * S, 1 * S, Math.PI, Math.PI * 1.6); ctx.fill();
        const blink = REDUCED ? 1 : 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(time * 3));
        ctx.globalAlpha = blink; ctx.strokeStyle = red; ctx.lineWidth = Math.max(1, S); ctx.beginPath(); ctx.arc(RX, RY, 3 * S, 0.2, 1.2); ctx.stroke(); ctx.globalAlpha = 1;
        return;
      }
      case 'emoji': { // office cat (mirror when walking right)
        drawShadow(cat.x, cat.y + 7, 10);
        const cX = sx(cat.x), cimg = rasterEmoji(e.emoji, 32);
        if (cat.fx > 0) { ctx.save(); ctx.translate(cX, 0); ctx.scale(-1, 1); ctx.drawImage(cimg, -7 * S, sy(cat.y) - 11 * S, 14 * S, 14 * S); ctx.restore(); }
        else ctx.drawImage(cimg, cX - 7 * S, sy(cat.y) - 11 * S, 14 * S, 14 * S);
        return;
      }
      case 'phone': {
        drawShadow(px + 8, py + 14, 7);
        R(X, Y, S, 6, 13, 4, 2, metalD);             // stand
        R(X, Y, S, 4, 0, 8, 14, black);              // body
        R(X, Y, S, 5, 1, 6, 11, screen);             // screen
        ctx.drawImage(rasterEmoji(e.emoji, 32), X + 5 * S, Y + 2 * S, 6 * S, 6 * S);
        R(X, Y, S, 6, 10, 4, 1, 'rgba(255,255,255,0.4)'); // home indicator
        if (e.id === 'cab_teamup') R(X, Y, S, 10, 0, 2, 2, red); // "live" dot
        break;
      }
      case 'camera': {
        drawShadow(px + WP / 2, py + HP - 2, 12);
        // cool lens glow
        if (!REDUCED) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = PAL.light ? 0.06 : 0.18; ctx.fillStyle = PAL.screenLit; ctx.beginPath(); ctx.arc(X + 16 * S, Y + 11 * S, 5 * S, 0, 7); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; }
        // tapered tripod legs (rects, not strokes) + rubber feet
        const leg = (fx) => { ctx.fillStyle = metalD; ctx.beginPath(); ctx.moveTo(X + 15.5 * S, Y + 15 * S); ctx.lineTo(X + 16.5 * S, Y + 15 * S); ctx.lineTo(X + (fx + 1) * S, Y + 30 * S); ctx.lineTo(X + fx * S, Y + 30 * S); ctx.closePath(); ctx.fill(); R(X, Y, S, fx - 0.5, 29.5, 2, 1, black); };
        leg(7); leg(16); leg(24.5);
        R(X, Y, S, 14.5, 14, 3, 2, metalD); R(X, Y, S, 16.5, 14.5, 1, 1, red); // pan head + pip
        // body
        R(X, Y, S, 9, 5, 14, 9, black);
        R(X, Y, S, 9, 5, 14, 2, PAL.bodyTop);        // lit top plate
        R(X, Y, S, 12, 2.5, 4, 3, black);            // EVF hump
        ctx.fillStyle = metalD; ctx.beginPath(); ctx.arc(X + 21 * S, Y + 5 * S, 1.6 * S, 0, 7); ctx.fill(); // mode dial
        R(X, Y, S, 20.5, 4, 1, 1, '#cfd2d6');        // shutter
        R(X, Y, S, 8.5, 6, 1.5, 7, '#26262a');       // grip
        // fat lens (concentric)
        ctx.fillStyle = metalD; ctx.beginPath(); ctx.arc(X + 16 * S, Y + 11 * S, 4.5 * S, 0, 7); ctx.fill();
        ctx.fillStyle = black; ctx.beginPath(); ctx.arc(X + 16 * S, Y + 11 * S, 3.2 * S, 0, 7); ctx.fill();
        R(X, Y, S, 12.5, 8.5, 1, 0.6, metal); R(X, Y, S, 19, 8.5, 1, 0.6, metal); // focus ticks
        ctx.fillStyle = '#1a2730'; ctx.beginPath(); ctx.arc(X + 16 * S, Y + 11 * S, 2.2 * S, 0, 7); ctx.fill();
        ctx.fillStyle = PAL.screenLit; ctx.beginPath(); ctx.arc(X + 15 * S, Y + 10 * S, 0.9 * S, 0, 7); ctx.fill(); // glint
        R(X, Y, S, 17, 12, 0.6, 0.6, 'rgba(255,255,255,0.7)');
        const rec = REDUCED ? 1 : (Math.sin(time * 3) > 0 ? 1 : 0.3);
        ctx.globalAlpha = rec; R(X, Y, S, 21, 7, 1.5, 1.5, red); ctx.globalAlpha = 1; // rec tally
        break;
      }
      case 'frame': {
        // wall-mounted picture; nudge toward its wall
        const off = e.wall === 'left' ? -2 : e.wall === 'right' ? 2 : 0;
        const oy = e.wall === 'top' ? -2 : 0;
        R(X, Y, S, 2 + off, 1 + oy, 12, 13, e.accent || metalD);   // frame / mat
        R(X, Y, S, 3 + off, 2 + oy, 10, 11, PAL.light ? '#f4f1ea' : '#0f1622'); // picture
        if (e.id === 'map_la') {
          R(X, Y, S, 4 + off, 4 + oy, 8, 7, PAL.light ? '#dfe9d8' : '#16243a');
          ctx.fillStyle = red; ctx.beginPath(); ctx.arc(X + (8 + off) * S, Y + (7 + oy) * S, 1.4 * S, 0, 7); ctx.fill();
        } else if (e.id === 'frame_instagram') {
          R(X, Y, S, 4 + off, 4 + oy, 8, 4, PAL.plant);
          R(X, Y, S, 4 + off, 8 + oy, 8, 3, '#d2691e');
        } else if (e.id === 'tablet_stats') {
          for (let i = 0; i < 4; i++) R(X, Y, S, 4 + off, 4 + oy + i * 2, 8 - (i % 2 ? 2 : 0), 1, 'rgba(255,255,255,0.5)');
        } else if (e.id === 'wall_print') { // monochrome LA print, single red horizon
          R(X, Y, S, 4 + off, 4 + oy, 8, 3, PAL.metal);
          R(X, Y, S, 4 + off, 6 + oy, 8, 1, 'rgba(229,72,77,0.5)');
          R(X, Y, S, 4 + off, 7 + oy, 8, 3, black);
          R(X, Y, S, 10 + off, 10 + oy, 1, 1, red);
        } else { // experience: a monogram bar in the accent
          R(X, Y, S, 4 + off, 5 + oy, 8, 2, e.accent || white);
          R(X, Y, S, 4 + off, 9 + oy, 5, 1, 'rgba(255,255,255,0.5)');
        }
        break;
      }
      case 'shelfitem': {
        const a = 0.6 + pulse * 0.4;
        R(X, Y, S, 3, 12, 10, 2, black);             // 2-tone plinth
        R(X, Y, S, 3, 12, 10, 0.6, metal);
        R(X, Y, S, 3, 14, 10, 0.6, 'rgba(0,0,0,0.3)');
        // device icon
        const ic = e.icon, acc = e.accent || white;
        if (ic === 'swift' || ic === 'phone') { R(X, Y, S, 5, 1, 6, 11, ic === 'swift' ? red : black); R(X, Y, S, 6, 2, 4, 8, screen); }
        else if (ic === 'chip') { R(X, Y, S, 4, 3, 8, 8, black); R(X, Y, S, 6, 5, 4, 4, PAL.screenLit); for (let i = 0; i < 4; i++) { R(X, Y, S, 4 + i * 2, 1, 1, 2, metal); R(X, Y, S, 4 + i * 2, 11, 1, 2, metal); } }
        else if (ic === 'rocket') { ctx.fillStyle = red; ctx.beginPath(); ctx.moveTo(X + 8 * S, Y + 1 * S); ctx.lineTo(X + 11 * S, Y + 9 * S); ctx.lineTo(X + 5 * S, Y + 9 * S); ctx.closePath(); ctx.fill(); R(X, Y, S, 7, 9, 2, 3, white); }
        else if (ic === 'camera') { R(X, Y, S, 4, 4, 8, 7, black); ctx.fillStyle = PAL.screenLit; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 7 * S, 2 * S, 0, 7); ctx.fill(); }
        else if (ic === 'drone') { R(X, Y, S, 6, 6, 4, 3, black); for (const dx of [3, 11]) for (const dy of [4, 10]) { ctx.fillStyle = metalD; ctx.beginPath(); ctx.arc(X + dx * S, Y + dy * S, 1.6 * S, 0, 7); ctx.fill(); } }
        // soft accent glow (subtle — not neon)
        if (!REDUCED) { ctx.globalAlpha = a * 0.18; ctx.fillStyle = acc; ctx.fillRect(X + 3 * S, Y, 10 * S, 12 * S); ctx.globalAlpha = 1; }
        break;
      }
      case 'books': { // lore on the bookshelf
        const cols = [red, white, black, metal];
        for (let i = 0; i < 5; i++) R(X, Y, S, 3 + i * 2, 2 + (i % 2), 2, 12 - (i % 2), cols[i % 4]);
        break;
      }
      case 'deskitem': {
        R(X, Y, S, 4, 12, 8, 2, metalD);             // base
        if (e.icon === 'mail') { R(X, Y, S, 4, 4, 8, 7, white); ctx.strokeStyle = red; ctx.lineWidth = Math.max(1, S * 0.6); ctx.beginPath(); ctx.moveTo(X + 4 * S, Y + 4 * S); ctx.lineTo(X + 8 * S, Y + 8 * S); ctx.lineTo(X + 12 * S, Y + 4 * S); ctx.stroke(); }
        else if (e.icon === 'github') { ctx.fillStyle = black; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 7 * S, 4.5 * S, 0, 7); ctx.fill(); R(X, Y, S, 6, 6, 1.5, 2, white); R(X, Y, S, 9, 6, 1.5, 2, white); R(X, Y, S, 7, 10, 2, 1, white); }
        else if (e.icon === 'linkedin') { R(X, Y, S, 4, 3, 8, 8, white); ctx.fillStyle = red; ctx.font = `bold ${6 * S}px "JetBrains Mono",monospace`; ctx.textAlign = 'center'; ctx.fillText('in', X + 8 * S, Y + 9 * S); }
        break;
      }
      case 'printer': {
        drawShadow(px + 8, py + 15, 10);
        const done = state.chestOpened;
        R(X, Y, S, 2, 6, 12, 8, black);              // body
        R(X, Y, S, 3, 7, 10, 2, metalD);             // slot
        if (done) { R(X, Y, S, 4, 1, 8, 6, white); R(X, Y, S, 5, 3, 6, 1, metalD); R(X, Y, S, 5, 5, 4, 1, metalD); } // ejected page
        R(X, Y, S, 11, 11, 2, 1, red);               // status light
        if (done && !REDUCED && hash2(time * 6 | 0, 13) > 0.6) { ctx.globalAlpha = 0.7; R(X, Y, S, 4 + (hash2(time * 6 | 0, 17) * 8 | 0), -1 - (hash2(time * 6 | 0, 5) * 4 | 0), 1, 1, white); ctx.globalAlpha = 1; }
        break;
      }
      case 'door': {
        // glowing doormat highlight + an "out" hint over the door
        const a = 0.4 + pulse * 0.5;
        ctx.globalAlpha = a; ctx.strokeStyle = red; ctx.lineWidth = Math.max(1, S);
        ctx.strokeRect(X + 2 * S, Y + 2 * S, WP * S - 4 * S, 12 * S);
        ctx.globalAlpha = 1;
        return;
      }
      case 'fridge': {
        drawShadow(px + 8, py + 15, 9);
        if (state.vaultFound && !REDUCED) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = PAL.light ? 0.18 : 0.45; ctx.drawImage(glowSpriteWarm(), X - 2 * S, Y + 10 * S, 18 * S, 14 * S); ctx.restore(); ctx.globalAlpha = 1; }
        R(X, Y, S, 3, 1, 10, 14, white);             // body
        R(X, Y, S, 3, 1, 1, 14, 'rgba(0,0,0,0.08)'); // side shade
        R(X, Y, S, 3, 7, 10, 1, state.vaultFound ? PAL.lightWarm : metalD); // door split (lit on reveal)
        R(X, Y, S, 11, 3, 1, 3, red);                // handle (upper)
        R(X, Y, S, 11, 9, 1, 3, red);                // handle (lower)
        if (state.vaultFound) {
          const bob = REDUCED ? 0 : Math.sin(time * 2) * 1;
          ctx.drawImage(rasterEmoji('🌮', 32), X + 4 * S, Y + (-6 + bob) * S, 8 * S, 8 * S);
        }
        break;
      }
      case 'deskmat': { // matte felt under keyboard/mouse (flat layer, on the desk)
        R(X, Y, S, 0, 2, WP, 11, PAL.matFelt);
        R(X, Y, S, 0, 2, WP, 1, 'rgba(255,255,255,0.06)'); R(X, Y, S, 0, 12, WP, 1, 'rgba(0,0,0,0.35)');
        R(X, Y, S, 1, 3, WP - 2, 1, 'rgba(255,255,255,0.04)'); R(X, Y, S, 1, 11, WP - 2, 1, 'rgba(0,0,0,0.25)');
        R(X, Y, S, WP - 5, 11, 3, 1, red);            // brand tag
        return;
      }
      case 'keyboard': {
        drawShadow(px + e.w * 8, py + 15, e.w * 16 - 4);
        R(X, Y, S, 1, 4, WP - 2, 9, black); R(X, Y, S, 2, 5, WP - 4, 6, PAL.matFelt);
        for (let r = 0; r < 3; r++) for (let c = 0; c < 11; c++) {
          const kx = 3 + c * 2.2, ky = 5 + r * 2;
          R(X, Y, S, kx, ky, 2, 1.6, PAL.keycap); R(X, Y, S, kx, ky, 2, 0.5, '#ffffff'); R(X, Y, S, kx, ky + 1.5, 2, 0.4, 'rgba(0,0,0,0.25)');
        }
        R(X, Y, S, 8, 11, 12, 1.6, PAL.keycap);
        R(X, Y, S, 3, 5, 2, 1.6, red); R(X, Y, S, WP - 5, 9, 2, 1.6, red); // ESC + ENTER
        R(X, Y, S, 2, 12, WP - 4, 1, PAL.goldGlow);                       // static underglow
        return;
      }
      case 'mouse': {
        drawShadow(px + 8, py + 13, 6);
        ctx.fillStyle = black; ctx.beginPath(); ctx.ellipse(X + 8 * S, Y + 9 * S, 4 * S, 5.5 * S, 0, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.beginPath(); ctx.ellipse(X + 7 * S, Y + 6 * S, 2 * S, 2.5 * S, 0, 0, 7); ctx.fill();
        R(X, Y, S, 7.5, 4, 1, 4, '#2a2b30'); R(X, Y, S, 7.5, 5, 1, 1.5, red);
        ctx.strokeStyle = metalD; ctx.lineWidth = Math.max(1, S * 0.6); ctx.beginPath(); ctx.moveTo(X + 8 * S, Y + 4 * S); ctx.quadraticCurveTo(X + 6 * S, Y - 2 * S, X + 2 * S, Y - 4 * S); ctx.stroke();
        return;
      }
      case 'mug': {
        drawShadow(px + 8, py + 13, 6);
        ctx.fillStyle = black; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 8 * S, 4.5 * S, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(1, S * 0.5); ctx.beginPath(); ctx.arc(X + 8 * S, Y + 8 * S, 4.5 * S, 0, 7); ctx.stroke();
        ctx.fillStyle = PAL.light ? '#3a2418' : '#241712'; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 8 * S, 3 * S, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(180,120,70,0.5)'; ctx.beginPath(); ctx.arc(X + 7 * S, Y + 7 * S, 1 * S, 0, 7); ctx.fill();
        R(X, Y, S, 12, 7, 2, 3, black); R(X, Y, S, 4, 7, 1, 1, red);
        if (!REDUCED) { // two wisps rise + fade out of phase
          ctx.fillStyle = '#fff';
          for (let w0 = 0; w0 < 2; w0++) {
            const p = (time * 0.9 + w0 * 0.5) % 1;
            ctx.globalAlpha = 0.16 * (1 - p) * Math.min(1, p * 4);
            R(X, Y, S, 7 + w0 * 2 + Math.sin(time * 2.3 + w0 * 6) * 0.5, 2 - p * 5, 1, 2);
          }
          ctx.globalAlpha = 1;
        }
        return;
      }
      case 'deskplant': {
        drawShadow(px + 8, py + 13, 6);
        R(X, Y, S, 5, 9, 6, 5, white); R(X, Y, S, 5, 9, 6, 1, 'rgba(255,255,255,0.5)'); R(X, Y, S, 5, 13, 6, 1, 'rgba(0,0,0,0.18)');
        R(X, Y, S, 6, 9, 4, 1.5, PAL.soil);
        const dpsw = REDUCED ? 0 : Math.sin(time * 1.4) * 0.04;
        ctx.fillStyle = PAL.plant; for (const an of [0, 1, 2, 3, 4, 5]) { const a2 = an * Math.PI / 3 + dpsw; ctx.beginPath(); ctx.ellipse(X + (8 + Math.cos(a2) * 2) * S, Y + (7 + Math.sin(a2) * 2) * S, 1.4 * S, 2.2 * S, a2, 0, 7); ctx.fill(); }
        ctx.fillStyle = PAL.plantDark; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 7 * S, 1.3 * S, 0, 7); ctx.fill();
        return;
      }
      case 'headphones': {
        drawShadow(px + 8, py + 12, 5);
        R(X, Y, S, 7, 7, 2, 6, metal); R(X, Y, S, 5, 12, 6, 2, metalD);
        ctx.strokeStyle = black; ctx.lineWidth = S * 1.2; ctx.beginPath(); ctx.arc(X + 8 * S, Y + 5 * S, 3.5 * S, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = black; ctx.beginPath(); ctx.arc(X + 5 * S, Y + 5 * S, 2 * S, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(X + 11 * S, Y + 5 * S, 2 * S, 0, 7); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = Math.max(1, S * 0.5); ctx.beginPath(); ctx.arc(X + 11 * S, Y + 5 * S, 1 * S, 0, 7); ctx.stroke();
        R(X, Y, S, 4, 4.5, 1, 1, red);
        return;
      }
      case 'streamdeck': {
        drawShadow(px + 8, py + 11, 7);
        R(X, Y, S, 3, 5, 10, 7, black); R(X, Y, S, 3, 5, 10, 1, 'rgba(255,255,255,0.10)');
        for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { R(X, Y, S, 4 + c * 3, 6 + r * 3, 2, 2, '#222428'); R(X, Y, S, 4 + c * 3, 6 + r * 3, 1, 0.5, 'rgba(255,255,255,0.15)'); }
        R(X, Y, S, 4, 6, 2, 2, red); R(X, Y, S, 10, 9, 2, 2, PAL.screenLit);
        return;
      }
      case 'nas': {
        drawShadow(px + 8, py + HP - 1, 7);
        R(X, Y, S, 4, 2, 8, 13, PAL.bodyTop); R(X, Y, S, 4, 2, 1, 13, metalD);
        for (let i = 0; i < 4; i++) { R(X, Y, S, 5, 4 + i * 3, 6, 2, '#0a0a0c'); R(X, Y, S, 5, 4 + i * 3, 6, 0.6, metalD); }
        R(X, Y, S, 4, 2, 8, 1, 'rgba(255,255,255,0.08)');                 // vent
        const act = (REDUCED || (time * 3 | 0) % 2) ? red : PAL.goldBright;
        R(X, Y, S, 11, 5, 1, 1, act); R(X, Y, S, 11, 8, 1, 1, white);
        return;
      }
      case 'sneakers': {
        drawShadow(px + 8, py + 13, 8);
        for (const sxo of [2, 8]) {
          R(X, Y, S, sxo, 11, 6, 2, white);            // sole
          R(X, Y, S, sxo, 8, 6, 3, black);             // upper
          R(X, Y, S, sxo, 8, 2, 3, white);             // toe cap
          R(X, Y, S, sxo + 3, 9, 1, 2, red);           // swoosh/lace
          R(X, Y, S, sxo, 8, 6, 0.5, 'rgba(255,255,255,0.5)');
        }
        return;
      }
      case 'espresso': {
        drawShadow(px + 8, py + 13, 6);
        R(X, Y, S, 3, 3, 10, 11, black);
        R(X, Y, S, 4, 4, 8, 4, metal); R(X, Y, S, 4, 4, 8, 1, 'rgba(255,255,255,0.4)');
        R(X, Y, S, 6, 8, 4, 2, metalD);                // group head
        R(X, Y, S, 9, 9, 4, 1, black); R(X, Y, S, 12, 9, 1, 1, metal);    // portafilter
        R(X, Y, S, 5, 11, 2, 2, white); R(X, Y, S, 8, 11, 2, 2, white);
        R(X, Y, S, 5.5, 11.5, 1, 1, 'rgba(180,120,60,0.6)'); R(X, Y, S, 8.5, 11.5, 1, 1, 'rgba(180,120,60,0.6)');
        R(X, Y, S, 11, 4, 1, 1, red);
        return;
      }
    }
    // visited check pip
    if (e.core && visited.has(e.id)) {
      ctx.fillStyle = red;
      ctx.font = `${7 * S}px "JetBrains Mono",monospace`;
      ctx.textAlign = 'center';
      ctx.fillText('✓', X + WP / 2 * S, Y - (e.h > 1 ? e.h * 16 - 12 : 4) * S);
    }
  }

  function render() {
    const cw = cvW = canvas.width / dpr, ch = cvH = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.voidc;
    ctx.fillRect(0, 0, cw, ch);
    // world
    const icx = Math.round(camX), icy = Math.round(camY);
    ctx.drawImage(world, icx, icy, viewW, viewH, 0, 0, viewW * SCALE, viewH * SCALE);

    // layered warm light pools from the lamps (cozy at night, faint by day)
    for (const [tx, ty] of LIGHTS) {
      const X = sx(tx * TILE + 8), Y = sy(ty * TILE + 4);
      if (X < -120 || Y < -120 || X > cw + 120 || Y > ch + 120) continue;
      const flick = (PAL.light || REDUCED) ? 1 : (0.92 + 0.08 * Math.sin(time * 7 + tx));
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (PAL.light ? 0.08 : 0.34) * flick;
      ctx.drawImage(glowSprite(), X - 28 * SCALE, Y - 24 * SCALE, 56 * SCALE, 56 * SCALE);       // wide pool
      ctx.globalAlpha = (PAL.light ? 0.06 : 0.22) * flick;
      ctx.drawImage(glowSprite(), X - 20 * SCALE, Y - 8 * SCALE, 40 * SCALE, 60 * SCALE);         // downward floor spill
      ctx.globalAlpha = (PAL.light ? 0.10 : 0.30) * flick;
      ctx.drawImage(glowSpriteWarm(), X - 12 * SCALE, Y - 12 * SCALE, 24 * SCALE, 24 * SCALE);    // hot core
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    // big furniture against the walls draws as a flat layer first, so items resting
    // on it (monitors, phones, gadgets) and the player always paint on top.
    for (const e of flatEnts) drawEntity(e);
    // everything else y-sorts with the player; persistent list keyed in place (no per-frame alloc)
    const idleBob = (!player.moving && !REDUCED) ? Math.sin(time * 2.2) * 0.6 : 0;
    for (const e of sortEnts) e._sy = e.py + e.h * TILE;
    PLAYER_SENT._sy = player.y + 10; DRONE_SENT._sy = drone.y + 8;
    drawList.sort((a, b) => a._sy - b._sy);
    for (const e of drawList) {
      if (e === PLAYER_SENT) drawRig(heroRig, player.x, player.y, player.dir, player.moving ? player.frame : 0, idleBob);
      else if (e === DRONE_SENT) drawDrone();
      else drawEntity(e);
    }

    // prompt '!' above nearest target (computed once in update)
    if (!dialogOpen) {
      const t = curTarget;
      if (t) {
        const bob = REDUCED ? 0 : Math.sin(time * 5) * 2;
        const X = sx(t.px + t.w * TILE / 2), Y = sy(t.py) - (t.h > 1 ? 16 : 8) * SCALE + bob * SCALE / 2;
        // springy pop when it first appears
        const popScale = 1 + (promptPop > 0 ? (promptPop / 0.18) * 0.9 : 0);
        ctx.fillStyle = PAL.gold;
        ctx.font = `bold ${Math.round(9 * SCALE * popScale)}px "JetBrains Mono",monospace`;
        ctx.textAlign = 'center';
        ctx.fillText('!', X, Y);
        // teach the actual key/tap until the player interacts once (this session)
        if (!hintUsed) {
          ctx.font = `${5 * SCALE}px "JetBrains Mono",monospace`;
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          const label = isTouch ? 'Tap ●' : 'Press E';
          const lw = ctx.measureText(label).width;
          ctx.fillRect(X - lw / 2 - 3 * SCALE, Y + 4 * SCALE, lw + 6 * SCALE, 8 * SCALE);
          ctx.fillStyle = PAL.gold;
          ctx.fillText(label, X, Y + 10 * SCALE);
        }
      }
    }

    // particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      if (p.heart) {
        const X = sx(p.x), Y = sy(p.y);
        ctx.fillRect(X - SCALE, Y, SCALE, SCALE); ctx.fillRect(X + SCALE * 0, Y, SCALE, SCALE);
        ctx.fillRect(X - SCALE, Y - SCALE, SCALE, SCALE); ctx.fillRect(X + SCALE, Y - SCALE, SCALE, SCALE);
        ctx.fillRect(X, Y + SCALE, SCALE, SCALE);
      } else {
        ctx.fillRect(sx(p.x), sy(p.y), p.size * SCALE, p.size * SCALE);
      }
    }
    ctx.globalAlpha = 1;

    // taco rain (screen space)
    for (const t of tacoRain) {
      ctx.save();
      ctx.translate(t.x * cw, t.y * ch);
      ctx.rotate(t.r);
      ctx.drawImage(rasterEmoji('🌮', 32), -16, -16, 32, 32);
      ctx.restore();
    }

    // vignette for depth (biased up toward the low-anchored player)
    if (cw > 0 && ch > 0) ctx.drawImage(vignette(cw, ch), 0, 0);
  }
  let _vig = null, _vigW = 0, _vigH = 0;
  function vignette(w, h) {
    w = Math.max(1, w | 0); h = Math.max(1, h | 0);
    if (_vig && _vigW === w && _vigH === h) return _vig;
    _vig = mk(w, h); _vigW = w; _vigH = h;
    const g = _vig.getContext('2d');
    const gr = g.createRadialGradient(w / 2, h * 0.46, Math.min(w, h) * 0.30, w / 2, h * 0.46, Math.max(w, h) * 0.72);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, PAL.light ? 'rgba(20,16,10,0.16)' : 'rgba(0,0,0,0.40)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    return _vig;
  }
  let _mw = null;
  function monitorWash() {
    if (_mw) return _mw;
    _mw = mk(44, 20);
    const g = _mw.getContext('2d');
    const grad = g.createLinearGradient(0, 1, 0, 17);
    const wa = PAL.light ? 0.16 : 0.40;
    grad.addColorStop(0, hexA(PAL.spillCool, wa)); grad.addColorStop(1, hexA(PAL.spillCool, 0));
    g.fillStyle = grad; g.fillRect(0, 0, 44, 20);
    return _mw;
  }
  let _glowW = null;
  function glowSpriteWarm() {
    if (_glowW) return _glowW;
    _glowW = mk(48, 48);
    const g = _glowW.getContext('2d');
    const gr = g.createRadialGradient(24, 24, 1, 24, 24, 22);
    gr.addColorStop(0, 'rgba(255,210,130,0.5)'); gr.addColorStop(0.5, 'rgba(255,180,90,0.18)'); gr.addColorStop(1, 'rgba(255,180,90,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 48, 48);
    return _glowW;
  }
  let _glow = null;
  function glowSprite() {
    if (_glow) return _glow;
    _glow = mk(64, 64);
    const g = _glow.getContext('2d');
    const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    gr.addColorStop(0, 'rgba(255,170,60,0.32)');
    gr.addColorStop(1, 'rgba(255,170,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return _glow;
  }
  function drawDrone() {
    const X = sx(drone.x), Y = sy(drone.y);
    drawShadow(drone.x, drone.y + 14, 9);
    ctx.save();
    ctx.translate(X, Y);
    if (drone.roll > 0) ctx.rotate(Math.PI * 2 - drone.roll);
    const bob = (REDUCED || !state.drone) ? 0 : Math.sin(time * 3) * 1.5 * SCALE;
    ctx.drawImage(rasterEmoji('🚁', 32), -8 * SCALE, -8 * SCALE + bob, 16 * SCALE, 16 * SCALE);
    ctx.restore();
  }

  // ---------------- Loop ----------------
  function frame(ts) {
    if (!playing) return;
    raf = requestAnimationFrame(frame);
    if (!last) last = ts;
    let dt = (ts - last) / 1000; last = ts;
    if (dt > 0.25) dt = 0.25;
    acc += dt;
    while (acc >= STEP) { update(STEP); acc -= STEP; }
    render();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(raf); last = 0;
      Object.keys(keys).forEach(k => keys[k] = false); joyReset();
    } else if (playing) { last = 0; acc = 0; raf = requestAnimationFrame(frame); }
  });

  // ---------------- Sizing / theme ----------------
  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = root.clientWidth, h = root.clientHeight;
    SCALE = w >= 700 ? 3 : 2;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    viewW = Math.ceil(w / SCALE); viewH = Math.ceil(h / SCALE);
    camX = Math.max(0, Math.min(MAPW * TILE - viewW, player.x - viewW / 2));
    camY = Math.max(0, Math.min(MAPH * TILE - viewH, player.y - viewH / 2));
    _vig = null; // viewport changed — rebuild the vignette
    if (playing) render();
  }
  window.addEventListener('resize', resize);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);

  function rebuildArt() { readPalette(); bakeAtlas(); bakeRigs(); bakeWorld(); _vig = null; _mw = null; }
  new MutationObserver((muts) => {
    for (const m of muts) if (m.attributeName === 'data-theme') { rebuildArt(); if (playing) render(); }
  }).observe(document.documentElement, { attributes: true });

  // ---------------- Boot / start / exit ----------------
  const startScreen = document.getElementById('gameStart');
  const hud = document.getElementById('gameHud');
  const progress = document.getElementById('gameProgress');
  const muteBtn = document.getElementById('gameMuteBtn');

  // Touch devices get touch-appropriate control hints on the start screen.
  // The joystick isn't visible until play starts, so name its corner explicitly.
  if (isTouch) {
    const ctrls = document.getElementById('gameStartControls');
    if (ctrls) ctrls.innerHTML = '<span><b>Drag&nbsp;(left)</b>move</span><span><b>Tap&nbsp;●</b>interact</span><span><b>✕</b>exit</span>';
  }

  function openOverlay() {
    gameActive = true;
    root.classList.add('active');
    document.body.classList.add('game-active');
    startScreen.classList.remove('hidden');
    if (REDUCED) startScreen.classList.add('rm');
    hud.hidden = true; progress.hidden = true;
    resize();
    syncAchCount();
  }
  function startGame() {
    ensureAudio();
    startScreen.classList.add('hidden');
    hud.hidden = false; progress.hidden = false;
    refreshProgress(); syncAchCount();
    playing = true; last = 0; acc = 0;
    resize();
    canvas.focus({ preventScroll: true });
    raf = requestAnimationFrame(frame);
  }
  function exitGame() {
    gameActive = false;
    playing = false;
    cancelAnimationFrame(raf);
    Object.keys(keys).forEach(k => keys[k] = false); acc = 0; joyReset();
    if (dialogOpen) closeDialog();
    root.classList.remove('active');
    document.body.classList.remove('game-active');
    try { sessionStorage.setItem('ip-game-skip', '1'); } catch (e) {}
  }

  document.getElementById('gameStartBtn').addEventListener('click', startGame);
  document.getElementById('gameSkipBtn').addEventListener('click', () => { exitGame(); window.scrollTo(0, 0); });
  document.getElementById('gameExitBtn').addEventListener('click', exitGame);
  document.getElementById('gameAchBtn').addEventListener('click', () => {
    exitGame();
    const t = document.getElementById('achievements');
    if (t) t.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
    else window.scrollTo(0, 0);
  });
  function syncMute() { muteBtn.textContent = state.muted ? '🔇' : '🔊'; }
  muteBtn.addEventListener('click', () => { state.muted = !state.muted; saveState(); syncMute(); ensureAudio(); });
  syncMute();

  // Re-entry from the classic site
  const playBtn = document.getElementById('playGameBtn');
  if (playBtn) playBtn.addEventListener('click', () => {
    try { sessionStorage.removeItem('ip-game-skip'); } catch (e) {}
    openOverlay();
  });

  // Debug/QA handle (also handy in devtools)
  window.__ipGame = {
    step(n) { for (let i = 0; i < (n || 1); i++) update(STEP); render(); },
    key(k, down) { keys[k] = down !== false; },
    tp(tx, ty) { player.x = tx * TILE; player.y = ty * TILE; updateZone(); },
    interact: tryInteract,
    inspect(id) { const e = ENTITIES.find(x => x.id === id); if (e) interact(e); },
    get snapshot() {
      return { playing, gameActive, dialogOpen, x: player.x / TILE, y: player.y / TILE, dir: player.dir, room: currentRoom, coreVisited: coreVisited(), coreTotal: CORE_TOTAL, vaultFound: state.vaultFound, drone: state.drone };
    },
  };

  // ---------------- Init ----------------
  buildMap();
  rebuildArt();
  refreshProgress();

  let skipped = false;
  try { skipped = sessionStorage.getItem('ip-game-skip') === '1'; } catch (e) {}
  if (!location.hash && !skipped) openOverlay();
})();

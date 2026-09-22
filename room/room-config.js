(function () {
  'use strict';
  // Blender x/east, y/north, z/up becomes glTF x/east, y/up, z/south.
  // Photo-inferred enclosure approved by Isaac on 2026-09-21; desk/mattress are scale anchors.
  window.ROOM_CONFIG = {
    // Local revision-22 derivative: open the existing corner cat box for Charlie.
    modelUrl: '/room/room-cat-furniture.glb',
    // Modelled travel; preserves the approved 0.998 m startup position and
    // clearance beneath the fixed pegboard tray above the desk-mounted screen.
    desk: { min: .748, max: .998 },
    spawn: { x: 2.96, z: -1.33, yaw: 0 },
    bounds: [
      { minX: 0, maxX: 4, minZ: -4.2, maxZ: 0 },
      { minX: 3.75, maxX: 4.95, minZ: -4.2, maxZ: -3.25 },
      { minX: 4.72, maxX: 5.1, minZ: -4.14, maxZ: -3.32 },
      { minX: 4.85, maxX: 7.05, minZ: -4.75, maxZ: -2.55 }
    ],
    obstacles: [
      { name: 'Bed', minX: .05, maxX: 1.74, minZ: -4.1, maxZ: -2.04, minY: 0, maxY: .84 },
      { name: 'Bedside cabinet', minX: 1.73, maxX: 2.14, minZ: -4.11, maxZ: -3.49, minY: 0, maxY: .82 },
      { name: 'Desk top', minX: 2.111, maxX: 3.889, minZ: -4.13, maxZ: -3.45, minY: .93, maxY: 1.05 },
      // Uprights only; the 6.5 cm T-feet are low enough to step over.
      { name: 'Desk left leg', minX: 2.18, maxX: 2.28, minZ: -3.84, maxZ: -3.74, minY: 0, maxY: 1 },
      { name: 'Desk right leg', minX: 3.72, maxX: 3.82, minZ: -3.84, maxZ: -3.74, minY: 0, maxY: 1 },
      { name: 'Chair', minX: 2.58, maxX: 3.35, minZ: -3.45, maxZ: -2.69, minY: 0, maxY: 1.21 },
      { name: 'Shoe collection', minX: .08, maxX: 3.41, minZ: -.4, maxZ: 0, minY: 0, maxY: 2.1 },
      { name: 'Window cabinet', minX: .06, maxX: .44, minZ: -1.59, maxZ: -.97, minY: 0, maxY: .74 },
      { name: 'Fan', minX: .77, maxX: 1.03, minZ: -1.04, maxZ: -.78, minY: 0, maxY: .93 },
      { name: 'Bags', minX: 2.52, maxX: 3.35, minZ: -1.14, maxZ: -.6, minY: 0, maxY: .48 },
      { name: 'Open entrance door', minX: 3.13, maxX: 3.99, minZ: -1.052, maxZ: -1.007, minY: 0, maxY: 2.1 },
      { name: 'Closet', minX: 3.96, maxX: 4.6, minZ: -3.22, maxZ: -1.18, minY: 0, maxY: 2.25 },
      { name: 'Vanity', minX: 6.45, maxX: 7.04, minZ: -4.68, maxZ: -3.78, minY: 0, maxY: .89 },
      { name: 'Toilet', minX: 6.2, maxX: 7.04, minZ: -3.65, maxZ: -3.09, minY: 0, maxY: .9 },
      { name: 'Hamper', minX: 5.485, maxX: 6.075, minZ: -3.745, maxZ: -3.255, minY: 0, maxY: .885 },
      { name: 'Open bathroom door', minX: 4.795, maxX: 5.645, minZ: -4.154, maxZ: -4.106, minY: 0, maxY: 2.11 },
      { name: 'Shower', minX: 5.05, maxX: 7.04, minZ: -3.2, maxZ: -2.55, minY: 0, maxY: 2.2 },
      { name: 'Bathroom left wall north of door', minX: 4.81, maxX: 4.92, minZ: -4.75, maxZ: -4.14, minY: 0, maxY: 2.65 },
      { name: 'Bathroom left wall south of door', minX: 4.81, maxX: 4.92, minZ: -3.32, maxZ: -2.55, minY: 0, maxY: 2.65 }
    ],
    hotspots: [
      { id: 'work', x: 3.02, y: 1, z: -3.55, radius: 1.6 },
      { id: 'shoes', x: 1.7, y: 1, z: -.3, radius: 1.5 },
      { id: 'hobbies', x: .3, y: 1.3, z: -1.7, radius: 1.4 },
      { id: 'projects', x: 3.65, y: 1.2, z: -3.65, radius: 1.4 },
      { id: 'bathroom', x: 6.1, y: .6, z: -3.8, radius: 1.5 }
    ]
  };
}());

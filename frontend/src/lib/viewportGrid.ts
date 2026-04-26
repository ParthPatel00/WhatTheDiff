import * as THREE from "three";

/**
 * Creates a Blender-style viewport grid.
 *
 * Matches Blender's solid viewport: medium-gray background (#3a3a3a),
 * dark grid lines slightly darker than the background, red X-axis,
 * green Z-axis (Blender's Y maps to Three.js Z on the horizontal plane).
 *
 * The grid sits at world Y=0 (the horizontal reference plane) regardless of
 * where the model sits — same as Blender's default viewport behavior.
 *
 * Returns a THREE.Group. Add to scene, remove + call disposeViewportGrid on cleanup.
 *
 * @param size  Half-extent of each grid level in world units
 */
export function createViewportGrid(size = 50): THREE.Group {
  const group = new THREE.Group();

  // ── grid lines ──
  // Blender's grid: dark lines (#2e2e2e-ish) on medium gray (#3a3a3a) background.
  // GridHelper(totalSize, divisions, centerLineColor, gridLineColor)
  // We suppress the built-in center coloring by overwriting the vertex color buffer,
  // then draw the axis lines ourselves in the correct Blender colors.
  const divisions = 20;
  const grid = new THREE.GridHelper(size * 2, divisions, 0x2e2e2e, 0x2e2e2e);

  // GridHelper uses vertex colors — flatten everything to one gray so
  // our separate axis lines are the sole source of color on the axes.
  const colAttr = grid.geometry.attributes.color;
  if (colAttr) {
    const r = 0x2e / 255, g = 0x2e / 255, b = 0x2e / 255;
    for (let i = 0; i < colAttr.count; i++) {
      colAttr.setXYZ(i, r, g, b);
    }
    colAttr.needsUpdate = true;
  }

  const gridMat = grid.material as THREE.LineBasicMaterial;
  gridMat.transparent = true;
  gridMat.opacity = 1.0;
  gridMat.vertexColors = true;
  group.add(grid);

  // ── axis lines ──
  // Blender: X = red (#ac2020-ish), Z (forward/back) = green (#20ac20-ish).
  // Extended slightly beyond the grid edge so they're clearly visible.
  const axisLen = size + size * 0.1;
  const positions = new Float32Array([
    -axisLen, 0, 0,   axisLen, 0, 0,   // X axis
     0, 0, -axisLen,  0, 0,  axisLen,  // Z axis
  ]);
  const axisColors = new Float32Array([
    // X — red (Blender: #ac2020)
    0xac / 255, 0x20 / 255, 0x20 / 255,
    0xac / 255, 0x20 / 255, 0x20 / 255,
    // Z — green (Blender: #20ac20)
    0x20 / 255, 0xac / 255, 0x20 / 255,
    0x20 / 255, 0xac / 255, 0x20 / 255,
  ]);
  const axisGeo = new THREE.BufferGeometry();
  axisGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  axisGeo.setAttribute("color", new THREE.BufferAttribute(axisColors, 3));
  const axisMat = new THREE.LineBasicMaterial({ vertexColors: true });
  group.add(new THREE.LineSegments(axisGeo, axisMat));

  return group;
}

/**
 * Disposes all geometries and materials in a grid group.
 */
export function disposeViewportGrid(group: THREE.Group) {
  group.traverse((obj) => {
    const o = obj as THREE.Mesh;
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

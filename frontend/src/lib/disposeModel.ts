import * as THREE from "three";

export function disposeModel(scene: THREE.Object3D): void {
  scene.traverse((obj) => {
    // Handle all geometry-bearing subtypes: Mesh, SkinnedMesh, InstancedMesh, Line, Points, etc.
    const geo = (obj as unknown as { geometry?: { dispose: () => void } }).geometry;
    if (geo && typeof geo.dispose === "function") {
      geo.dispose();
    }

    const mat = (obj as unknown as { material?: unknown }).material;
    if (mat) {
      const mats = Array.isArray(mat) ? mat : [mat];
      mats.forEach((m: unknown) => {
        const material = m as Record<string, unknown>;
        if (material && typeof material.dispose === "function") {
          Object.values(material).forEach((v) => {
            if (v instanceof THREE.Texture) v.dispose();
          });
          (material.dispose as () => void)();
        }
      });
    }
  });
}

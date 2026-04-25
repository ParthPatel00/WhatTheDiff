import type { Document, Mesh, Material, Node, Animation } from "@gltf-transform/core";
import * as THREE from "three";

export function getMeshes(doc: Document): Mesh[] {
  return doc.getRoot().listMeshes();
}

export function getMaterials(doc: Document): Material[] {
  return doc.getRoot().listMaterials();
}

export function getNodes(doc: Document): Node[] {
  return doc.getRoot().listNodes();
}

export function getAnimations(doc: Document): Animation[] {
  return doc.getRoot().listAnimations();
}

/**
 * Returns a bounding box computed from raw POSITION accessor data across all
 * mesh primitives. Positions are in local mesh space — node transforms are NOT
 * evaluated. This is accurate enough for structural stats display. For camera
 * framing in viewers, use `new THREE.Box3().setFromObject(scene)` instead,
 * which evaluates the full scene graph.
 */
export function getBoundingBox(doc: Document): THREE.Box3 {
  const box = new THREE.Box3();
  box.makeEmpty();

  for (const mesh of getMeshes(doc)) {
    for (const prim of mesh.listPrimitives()) {
      const accessor = prim.getAttribute("POSITION");
      if (!accessor) continue;

      // getArray() returns the internal TypedArray — read-only, do not mutate.
      const arr = accessor.getArray();
      if (!arr) continue;

      // arr is a flat Float32Array: [x0, y0, z0, x1, y1, z1, ...]
      for (let i = 0; i < arr.length; i += 3) {
        box.expandByPoint(new THREE.Vector3(arr[i], arr[i + 1], arr[i + 2]));
      }
    }
  }

  return box;
}

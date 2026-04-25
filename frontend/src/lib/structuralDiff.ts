import type { Material } from "@gltf-transform/core";
import * as THREE from "three";
import { getMaterials, getBoundingBox } from "./gltfParser";
import type { StructuralData, StructuralDiffResult, MaterialDiff } from "./types";

const EPS = 0.001;

function arraysEqualEps(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => Math.abs(v - b[i]) <= EPS);
}

function compareMaterials(matA: Material, matB: Material): MaterialDiff["changes"] {
  const changes: MaterialDiff["changes"] = [];

  // getBaseColorFactor() allocates a new array each call — cache both.
  const bcfA = matA.getBaseColorFactor();
  const bcfB = matB.getBaseColorFactor();
  if (!arraysEqualEps(bcfA, bcfB)) {
    changes.push({ property: "baseColorFactor", before: bcfA, after: bcfB });
  }

  const roughA = matA.getRoughnessFactor();
  const roughB = matB.getRoughnessFactor();
  if (Math.abs(roughA - roughB) > EPS) {
    changes.push({ property: "roughness", before: roughA, after: roughB });
  }

  // gltf-transform uses getMetallicFactor(); types.ts property name is "metalness"
  const metalA = matA.getMetallicFactor();
  const metalB = matB.getMetallicFactor();
  if (Math.abs(metalA - metalB) > EPS) {
    changes.push({ property: "metalness", before: metalA, after: metalB });
  }

  return changes;
}

export function computeStructuralDiff(
  a: StructuralData,
  b: StructuralData
): StructuralDiffResult {
  // --- Scalar deltas (precomputed by modelLoader) ---
  const vertexDelta = b.vertexCount - a.vertexCount;
  const triangleDelta = b.triangleCount - a.triangleCount;
  const nodeCountDelta = b.nodeCount - a.nodeCount;
  const animationCountDelta = b.animationCount - a.animationCount;

  // --- Bounding box (local-space, from gltf-transform accessors) ---
  const boxA = getBoundingBox(a.document);
  const boxB = getBoundingBox(b.document);
  const sizeA = boxA.isEmpty() ? new THREE.Vector3() : boxA.getSize(new THREE.Vector3());
  const sizeB = boxB.isEmpty() ? new THREE.Vector3() : boxB.getSize(new THREE.Vector3());
  const boundingBox = {
    a: boxA,
    b: boxB,
    delta: {
      x: sizeB.x - sizeA.x,
      y: sizeB.y - sizeA.y,
      z: sizeB.z - sizeA.z,
    },
  };

  // --- Material diff ---
  const materialsAdded: string[] = [];
  const materialsRemoved: string[] = [];
  const materialsModified: MaterialDiff[] = [];

  const matsA = getMaterials(a.document);
  const matsB = getMaterials(b.document);

  if (matsA.length === 0 && matsB.length === 0) {
    // Nothing to compare.
  } else {
    // Build name-keyed maps for named materials.
    // Unnamed materials (getName() === "") fall through to index-based matching.
    const namedA = new Map<string, Material>();
    const unnamedA: Material[] = [];
    for (const m of matsA) {
      const name = m.getName();
      if (name) namedA.set(name, m);
      else unnamedA.push(m);
    }

    const namedB = new Map<string, Material>();
    const unnamedB: Material[] = [];
    for (const m of matsB) {
      const name = m.getName();
      if (name) namedB.set(name, m);
      else unnamedB.push(m);
    }

    // Named materials: match by name.
    namedA.forEach((matA, name) => {
      const matB = namedB.get(name);
      if (!matB) {
        materialsRemoved.push(name);
      } else {
        const changes = compareMaterials(matA, matB);
        if (changes.length > 0) materialsModified.push({ name, changes });
      }
    });
    namedB.forEach((_matB, name) => {
      if (!namedA.has(name)) materialsAdded.push(name);
    });

    // Unnamed materials: match by index within the unnamed subset.
    const unnamedCount = Math.max(unnamedA.length, unnamedB.length);
    for (let i = 0; i < unnamedCount; i++) {
      const matA = unnamedA[i];
      const matB = unnamedB[i];
      const label = `(unnamed #${i})`;
      if (matA && !matB) {
        materialsRemoved.push(label);
      } else if (!matA && matB) {
        materialsAdded.push(label);
      } else if (matA && matB) {
        const changes = compareMaterials(matA, matB);
        if (changes.length > 0) materialsModified.push({ name: label, changes });
      }
    }
  }

  return {
    vertexDelta,
    triangleDelta,
    boundingBox,
    materialsAdded,
    materialsRemoved,
    materialsModified,
    nodeCountDelta,
    animationCountDelta,
  };
}

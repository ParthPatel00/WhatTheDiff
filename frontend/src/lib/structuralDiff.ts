import type { Material } from "@gltf-transform/core";
import * as THREE from "three";
import { getMaterials, getBoundingBox } from "./gltfParser";
import type { StructuralData, StructuralDiffResult, MaterialDiff } from "./types";

const EPS = 0.001;

function arraysEqualEps(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((v, i) => Math.abs(v - b[i]) <= EPS);
}

function texPresence(mat: Material, key: "baseColorTexture" | "normalTexture" | "emissiveTexture" | "occlusionTexture" | "metallicRoughnessTexture"): string {
  const getters: Record<typeof key, () => unknown> = {
    baseColorTexture: () => mat.getBaseColorTexture(),
    normalTexture: () => mat.getNormalTextureInfo(),
    emissiveTexture: () => mat.getEmissiveTextureInfo(),
    occlusionTexture: () => mat.getOcclusionTextureInfo(),
    metallicRoughnessTexture: () => mat.getMetallicRoughnessTextureInfo(),
  };
  const tex = getters[key]();
  if (!tex) return "none";
  return (tex as { getName?: () => string }).getName?.() || "present";
}

function compareMaterials(matA: Material, matB: Material): MaterialDiff["changes"] {
  const changes: MaterialDiff["changes"] = [];

  // Base color
  const bcfA = matA.getBaseColorFactor();
  const bcfB = matB.getBaseColorFactor();
  if (!arraysEqualEps(bcfA, bcfB)) {
    changes.push({ property: "baseColorFactor", before: bcfA, after: bcfB });
  }

  // PBR scalars
  const roughA = matA.getRoughnessFactor();
  const roughB = matB.getRoughnessFactor();
  if (Math.abs(roughA - roughB) > EPS) {
    changes.push({ property: "roughness", before: roughA, after: roughB });
  }

  const metalA = matA.getMetallicFactor();
  const metalB = matB.getMetallicFactor();
  if (Math.abs(metalA - metalB) > EPS) {
    changes.push({ property: "metalness", before: metalA, after: metalB });
  }

  // Emissive
  const emA = matA.getEmissiveFactor();
  const emB = matB.getEmissiveFactor();
  if (!arraysEqualEps(emA, emB)) {
    changes.push({ property: "emissiveFactor", before: emA, after: emB });
  }

  // Flags
  if (matA.getDoubleSided() !== matB.getDoubleSided()) {
    changes.push({ property: "doubleSided", before: matA.getDoubleSided(), after: matB.getDoubleSided() });
  }

  if (matA.getAlphaMode() !== matB.getAlphaMode()) {
    changes.push({ property: "alphaMode", before: matA.getAlphaMode(), after: matB.getAlphaMode() });
  }

  if (matA.getAlphaMode() === "MASK" && matB.getAlphaMode() === "MASK") {
    const cutA = matA.getAlphaCutoff();
    const cutB = matB.getAlphaCutoff();
    if (Math.abs(cutA - cutB) > EPS) {
      changes.push({ property: "alphaCutoff", before: cutA, after: cutB });
    }
  }

  // Texture presence
  for (const key of ["baseColorTexture", "normalTexture", "emissiveTexture", "occlusionTexture", "metallicRoughnessTexture"] as const) {
    const tA = texPresence(matA, key);
    const tB = texPresence(matB, key);
    if (tA !== tB) {
      changes.push({ property: key, before: tA, after: tB });
    }
  }

  return changes;
}

export function computeStructuralDiff(
  a: StructuralData,
  b: StructuralData
): StructuralDiffResult {
  const vertexDelta = b.vertexCount - a.vertexCount;
  const triangleDelta = b.triangleCount - a.triangleCount;
  const meshCountDelta = b.meshCount - a.meshCount;
  const nodeCountDelta = b.nodeCount - a.nodeCount;
  const animationCountDelta = b.animationCount - a.animationCount;

  // Bounding box (local-space from accessor data)
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

  // Material diff
  const materialsAdded: string[] = [];
  const materialsRemoved: string[] = [];
  const materialsModified: MaterialDiff[] = [];

  const matsA = getMaterials(a.document);
  const matsB = getMaterials(b.document);

  if (matsA.length > 0 || matsB.length > 0) {
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

    const unnamedCount = Math.max(unnamedA.length, unnamedB.length);
    for (let i = 0; i < unnamedCount; i++) {
      const matA = unnamedA[i];
      const matB = unnamedB[i];
      const label = `(unnamed #${i})`;
      if (matA && !matB) materialsRemoved.push(label);
      else if (!matA && matB) materialsAdded.push(label);
      else if (matA && matB) {
        const changes = compareMaterials(matA, matB);
        if (changes.length > 0) materialsModified.push({ name: label, changes });
      }
    }
  }

  return {
    vertexDelta,
    triangleDelta,
    meshCountDelta,
    boundingBox,
    materialsAdded,
    materialsRemoved,
    materialsModified,
    nodeCountDelta,
    animationCountDelta,
  };
}

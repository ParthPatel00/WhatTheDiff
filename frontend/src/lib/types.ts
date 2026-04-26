import * as THREE from "three";

export type ViewMode =
  | "side-by-side"
  | "ghost"
  | "pixel-diff"
  | "turntable"
  | "all-angles";

export enum CameraAngle {
  Front = "front",
  Back = "back",
  Left = "left",
  Right = "right",
  Top = "top",
  Bottom = "bottom",
}

export interface StructuralData {
  // Raw gltf-transform Document is stored here; helpers in gltfParser.ts operate on it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  document: any;
  vertexCount: number;
  triangleCount: number;
  meshCount: number;
  materialCount: number;
  nodeCount: number;
  animationCount: number;
}

export interface LoadedModel {
  scene: THREE.Group;
  structuralData: StructuralData;
}

export interface MaterialDiff {
  name: string;
  changes: {
    property:
      | "baseColorFactor"
      | "roughness"
      | "metalness"
      | "emissiveFactor"
      | "doubleSided"
      | "alphaMode"
      | "alphaCutoff"
      | "baseColorTexture"
      | "normalTexture"
      | "emissiveTexture"
      | "occlusionTexture"
      | "metallicRoughnessTexture";
    before: unknown;
    after: unknown;
  }[];
}

export interface DiffResult {
  angle: CameraAngle;
  diff: Uint8ClampedArray;
  pct: number;
  renderedA: ImageData;
}

export interface StructuralDiffResult {
  vertexDelta: number;
  triangleDelta: number;
  meshCountDelta: number;
  boundingBox: {
    a: THREE.Box3;
    b: THREE.Box3;
    delta: { x: number; y: number; z: number };
  };
  materialsAdded: string[];
  materialsRemoved: string[];
  materialsModified: MaterialDiff[];
  nodeCountDelta: number;
  animationCountDelta: number;
}

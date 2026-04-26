import * as THREE from "three";
import { CameraAngle } from "./types";

export interface CameraPreset {
  direction: THREE.Vector3; // unit vector from origin; renderer scales by camera distance
  target: THREE.Vector3;
}

// All presets point toward the world origin. Renderer scales `direction` by
// the bounding-sphere camera distance to place the camera.
export const CAMERA_PRESETS: Record<CameraAngle, CameraPreset> = {
  [CameraAngle.Front]: {
    direction: new THREE.Vector3(0, 0, 1),
    target: new THREE.Vector3(0, 0, 0),
  },
  [CameraAngle.Back]: {
    direction: new THREE.Vector3(0, 0, -1),
    target: new THREE.Vector3(0, 0, 0),
  },
  [CameraAngle.Left]: {
    direction: new THREE.Vector3(-1, 0, 0),
    target: new THREE.Vector3(0, 0, 0),
  },
  [CameraAngle.Right]: {
    direction: new THREE.Vector3(1, 0, 0),
    target: new THREE.Vector3(0, 0, 0),
  },
  [CameraAngle.Top]: {
    direction: new THREE.Vector3(0, 1, 0),
    target: new THREE.Vector3(0, 0, 0),
  },
  [CameraAngle.Bottom]: {
    direction: new THREE.Vector3(0, -1, 0),
    target: new THREE.Vector3(0, 0, 0),
  },
};

export const CAMERA_ANGLE_ORDER: CameraAngle[] = [
  CameraAngle.Front,
  CameraAngle.Back,
  CameraAngle.Left,
  CameraAngle.Right,
  CameraAngle.Top,
  CameraAngle.Bottom,
];

import * as THREE from "three";

// Single 1×1 offscreen renderer shared across model loaders.
// KTX2Loader binds to this context once; reusing it avoids re-transcoding.
let _renderer: THREE.WebGLRenderer | null = null;

export function getSharedRenderer(): THREE.WebGLRenderer {
  if (!_renderer) {
    _renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    _renderer.setSize(1, 1);
  }
  return _renderer;
}

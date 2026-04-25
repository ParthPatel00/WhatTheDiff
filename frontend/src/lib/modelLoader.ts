import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/addons/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { WebIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import type { LoadedModel, StructuralData } from "./types";

// Shared DRACOLoader instance — decoder version must stay in sync with Three.js
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath(
  "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
);

let ktx2Loader: KTX2Loader | null = null;

function getKTX2Loader(renderer: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2Loader) {
    ktx2Loader = new KTX2Loader();
    ktx2Loader.setTranscoderPath(
      "https://cdn.jsdelivr.net/npm/three/examples/jsm/libs/basis/"
    );
    ktx2Loader.detectSupport(renderer);
  }
  return ktx2Loader;
}

async function loadWithThree(
  buffer: ArrayBuffer,
  renderer: THREE.WebGLRenderer
): Promise<THREE.Group> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    loader.setKTX2Loader(getKTX2Loader(renderer));
    loader.parse(buffer, "", (gltf) => resolve(gltf.scene), reject);
  });
}

async function parseWithGltfTransform(buffer: ArrayBuffer): Promise<StructuralData> {
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.readBinary(new Uint8Array(buffer));
  const root = doc.getRoot();

  const meshes = root.listMeshes();
  let vertexCount = 0;
  let triangleCount = 0;
  meshes.forEach((mesh) => {
    mesh.listPrimitives().forEach((prim) => {
      const pos = prim.getAttribute("POSITION");
      if (pos) vertexCount += pos.getCount();
      const indices = prim.getIndices();
      if (indices) triangleCount += indices.getCount() / 3;
      else if (pos) triangleCount += pos.getCount() / 3;
    });
  });

  return {
    document: doc,
    vertexCount: Math.round(vertexCount),
    triangleCount: Math.round(triangleCount),
    meshCount: meshes.length,
    materialCount: root.listMaterials().length,
    nodeCount: root.listNodes().length,
    animationCount: root.listAnimations().length,
  };
}

export async function loadModel(
  buffer: ArrayBuffer,
  renderer: THREE.WebGLRenderer
): Promise<LoadedModel> {
  // Clone so both parsers have their own copy — gltf-transform's WebIO may consume the buffer
  const bufferForThree = buffer;
  const bufferForGltf = buffer.slice(0);

  const [scene, structuralData] = await Promise.all([
    loadWithThree(bufferForThree, renderer),
    parseWithGltfTransform(bufferForGltf),
  ]);

  return { scene, structuralData };
}

import type { DiffResult } from "./types";
import { CameraAngle } from "./types";
import { CAMERA_ANGLE_ORDER } from "./cameraPresets";

// Types mirrored from the worker to avoid importing across the worker boundary
interface WorkerOutput {
  diff: Uint8ClampedArray;
  pct: number;
  angle: string;
}

// One persistent worker per angle — created lazily, reused across runs to
// avoid the spawn overhead on every tolerance change
let _workerPool: Worker[] | null = null;

function getWorkerPool(): Worker[] {
  if (!_workerPool) {
    _workerPool = CAMERA_ANGLE_ORDER.map(
      () => new Worker(new URL("./pixelDiff.worker.ts", import.meta.url)),
    );
  }
  return _workerPool;
}

function runWorker(
  worker: Worker,
  dataA: Uint8ClampedArray,
  dataB: Uint8ClampedArray,
  tolerance: number,
  angle: CameraAngle,
): Promise<DiffResult> {
  return new Promise((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<WorkerOutput>) => {
      resolve({ angle, diff: e.data.diff, pct: e.data.pct });
    };
    worker.onerror = reject;
    // Do NOT transfer dataA/dataB — they live in the render cache and must
    // remain valid for subsequent tolerance-only re-runs
    worker.postMessage({ dataA, dataB, tolerance, angle });
  });
}

/**
 * Runs all 6 angle diffs in parallel. Pass the cached ImageData arrays from
 * renderer.ts; when only tolerance changes, call this again with the same
 * arrays — no re-render needed.
 */
export async function computeDiff(
  imageDataA: ImageData[],
  imageDataB: ImageData[],
  tolerance: number,
): Promise<DiffResult[]> {
  const workers = getWorkerPool();

  return Promise.all(
    CAMERA_ANGLE_ORDER.map((angle, i) =>
      runWorker(workers[i], imageDataA[i].data, imageDataB[i].data, tolerance, angle),
    ),
  );
}

/** Terminate all pooled workers. Call on app teardown if needed. */
export function disposeWorkerPool(): void {
  _workerPool?.forEach((w) => w.terminate());
  _workerPool = null;
}

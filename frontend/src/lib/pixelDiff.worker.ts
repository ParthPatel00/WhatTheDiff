/// <reference lib="webworker" />
export {};

export interface WorkerInput {
  dataA: Uint8ClampedArray;
  dataB: Uint8ClampedArray;
  tolerance: number;
  angle: string;
}

export interface WorkerOutput {
  diff: Uint8ClampedArray;
  pct: number;
  angle: string;
}

self.onmessage = (e: MessageEvent<WorkerInput>) => {
  const { dataA, dataB, tolerance, angle } = e.data;

  const len = dataA.length;
  // Fresh allocation every invocation — the transferred buffer is neutered
  // after postMessage so we must never reuse it
  const diff = new Uint8ClampedArray(len);

  let changed = 0;
  const total = len / 4;

  for (let i = 0; i < len; i += 4) {
    const rDiff = Math.abs(dataA[i] - dataB[i]);
    const gDiff = Math.abs(dataA[i + 1] - dataB[i + 1]);
    const bDiff = Math.abs(dataA[i + 2] - dataB[i + 2]);

    if (Math.max(rDiff, gDiff, bDiff) > tolerance) {
      // Changed pixel: red highlight
      diff[i] = 255;
      diff[i + 1] = 0;
      diff[i + 2] = 0;
      diff[i + 3] = 200;
      changed++;
    } else {
      // Unchanged pixel: show model A dimmed
      diff[i] = dataA[i];
      diff[i + 1] = dataA[i + 1];
      diff[i + 2] = dataA[i + 2];
      diff[i + 3] = 80;
    }
  }

  const pct = (changed / total) * 100;

  // Transfer the buffer — zero-copy handoff to the main thread
  const output: WorkerOutput = { diff, pct, angle };
  (self as unknown as Worker).postMessage(output, [diff.buffer]);
};

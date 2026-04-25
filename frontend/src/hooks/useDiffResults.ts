import { useEffect, useRef } from "react";
import type { Group } from "three";
import { useDiffStore } from "@/stores/diffStore";
import { renderBothModels, invalidateRenderCache } from "@/lib/renderer";
import { computeDiff } from "@/lib/pixelDiff";

/**
 * Wires the diff pipeline to the store. Drop this hook into any component
 * that should trigger diffs (typically the top-level page).
 *
 * - Model change  → re-renders offscreen, then re-diffs
 * - Tolerance change → skips re-render (cache hit), only re-diffs
 */
export function useDiffResults() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const tolerance = useDiffStore((s) => s.tolerance);
  const setDiffResults = useDiffStore((s) => s.setDiffResults);

  // Track previous scenes so we can invalidate the render cache on replacement
  const prevSceneA = useRef<Group | null>(null);
  const prevSceneB = useRef<Group | null>(null);

  // Monotonically-increasing run id — lets us discard results from stale runs
  const runId = useRef(0);

  useEffect(() => {
    if (modelA && prevSceneA.current && prevSceneA.current !== modelA.scene) {
      invalidateRenderCache(prevSceneA.current);
    }
    prevSceneA.current = modelA?.scene ?? null;
  }, [modelA]);

  useEffect(() => {
    if (modelB && prevSceneB.current && prevSceneB.current !== modelB.scene) {
      invalidateRenderCache(prevSceneB.current);
    }
    prevSceneB.current = modelB?.scene ?? null;
  }, [modelB]);

  useEffect(() => {
    if (!modelA || !modelB) return;

    const id = ++runId.current;

    // renderBothModels is synchronous and cache-aware:
    //   - new scene objects  → renders all 6 angles and caches
    //   - same scene objects → returns cached ImageData (no GPU work)
    const { imageDataA, imageDataB } = renderBothModels(modelA.scene, modelB.scene);

    computeDiff(imageDataA, imageDataB, tolerance).then((results) => {
      // Discard if a newer run already started (rapid model/tolerance changes)
      if (id !== runId.current) return;
      setDiffResults(results);
    });
  }, [modelA, modelB, tolerance, setDiffResults]);
}

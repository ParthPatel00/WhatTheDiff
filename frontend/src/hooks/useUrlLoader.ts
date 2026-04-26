"use client";

import { useEffect, useRef } from "react";
import { loadModel } from "@/lib/modelLoader";
import { getSharedRenderer } from "@/lib/sharedRenderer";
import { disposeModel } from "@/lib/disposeModel";
import { useDiffStore } from "@/stores/diffStore";

/**
 * Reads ?a=<url>&b=<url> from the query string and auto-loads both models.
 * The CLI sets these params after starting its local file server so the user
 * lands on the diff view immediately without having to drag-and-drop.
 *
 * - Uses the shared renderer (never disposes it — KTX2Loader is bound to it)
 * - Loads A and B independently so one slow file doesn't block the other
 * - Tracks the loaded URL pair via a ref so re-renders don't re-fetch
 * - Safe to call unconditionally — does nothing when params are absent
 */
export function useUrlLoader() {
  const loadedRef = useRef<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlA = params.get("a");
    const urlB = params.get("b");

    if (!urlA && !urlB) return;

    const key = `${urlA ?? ""}|${urlB ?? ""}`;
    if (loadedRef.current === key) return;
    loadedRef.current = key;

    const nameA = params.get("nameA") ?? urlA?.split("/").pop() ?? "model_a.glb";
    const nameB = params.get("nameB") ?? urlB?.split("/").pop() ?? "model_b.glb";

    async function load(url: string, side: "A" | "B") {
      const store = useDiffStore.getState();
      const isA = side === "A";

      const setLoading  = isA ? store.setLoadingA  : store.setLoadingB;
      const setError    = isA ? store.setErrorA    : store.setErrorB;
      const setModel    = isA ? store.setModelA    : store.setModelB;
      const setBuffer   = isA ? store.setBufferA   : store.setBufferB;
      const setFileName = isA ? store.setFileNameA : store.setFileNameB;
      const prevModel   = isA ? store.modelA       : store.modelB;

      setLoading(true);
      setError(null);
      setFileName(isA ? nameA : nameB);

      try {
        // Route through the Next.js proxy so COEP: require-corp doesn't block
        // cross-origin fetches from Supabase signed URLs in the browser.
        const proxied = `/api/proxy?url=${encodeURIComponent(url)}`;
        const res = await fetch(proxied);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);

        const buffer = await res.arrayBuffer();

        if (prevModel) disposeModel(prevModel.scene);

        // Reuse the shared renderer — never dispose it (KTX2Loader stays bound)
        const model = await loadModel(buffer, getSharedRenderer());
        setBuffer(buffer);
        setModel(model);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to load from ${url}`);
      } finally {
        useDiffStore.getState()[isA ? "setLoadingA" : "setLoadingB"](false);
      }
    }

    if (urlA) load(urlA, "A");
    if (urlB) load(urlB, "B");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

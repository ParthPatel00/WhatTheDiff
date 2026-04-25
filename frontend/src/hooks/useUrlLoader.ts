"use client";

import { useEffect } from "react";
import * as THREE from "three";
import { loadModel } from "@/lib/modelLoader";
import { useDiffStore } from "@/stores/diffStore";

// Reads ?a=<url>&b=<url> query params on mount and loads both GLBs into the store.
// Used when the CLI opens the viewer after a git commit.
export function useUrlLoader() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlA = params.get("a");
    const urlB = params.get("b");

    if (!urlA || !urlB) return;

    const renderer = new THREE.WebGLRenderer({ antialias: false });
    renderer.setSize(1, 1);

    const store = useDiffStore.getState();
    const nameA = params.get("nameA") ?? urlA.split("/").pop() ?? "model_a.glb";
    const nameB = params.get("nameB") ?? urlB.split("/").pop() ?? "model_b.glb";

    store.setLoadingA(true);
    store.setLoadingB(true);
    store.setFileNameA(nameA);
    store.setFileNameB(nameB);

    const proxied = (url: string) =>
      `/api/proxy?url=${encodeURIComponent(url)}`;

    Promise.all([
      fetch(proxied(urlA)).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch model A (${r.status})`);
        return r.arrayBuffer();
      }),
      fetch(proxied(urlB)).then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch model B (${r.status})`);
        return r.arrayBuffer();
      }),
    ])
      .then(([bufA, bufB]) =>
        Promise.all([
          loadModel(bufA, renderer).then((m) => ({ model: m, buf: bufA })),
          loadModel(bufB, renderer).then((m) => ({ model: m, buf: bufB })),
        ])
      )
      .then(([a, b]) => {
        const s = useDiffStore.getState();
        s.setBufferA(a.buf);
        s.setModelA(a.model);
        s.setBufferB(b.buf);
        s.setModelB(b.model);
      })
      .catch((err) => {
        const s = useDiffStore.getState();
        s.setErrorA(err instanceof Error ? err.message : "Failed to load from URL.");
      })
      .finally(() => {
        const s = useDiffStore.getState();
        s.setLoadingA(false);
        s.setLoadingB(false);
        renderer.dispose();
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}

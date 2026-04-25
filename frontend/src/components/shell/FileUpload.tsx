"use client";

import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import * as THREE from "three";
import { loadModel } from "@/lib/modelLoader";
import { disposeModel } from "@/lib/disposeModel";
import { useDiffStore } from "@/stores/diffStore";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;
const WARN_SIZE_BYTES = 50 * 1024 * 1024;

let sharedRenderer: THREE.WebGLRenderer | null = null;

function getSharedRenderer(): THREE.WebGLRenderer {
  if (!sharedRenderer) {
    sharedRenderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true });
    sharedRenderer.setSize(1, 1);
  }
  return sharedRenderer;
}

interface DropZoneProps {
  side: "A" | "B";
}

function DropZone({ side }: DropZoneProps) {
  const isA = side === "A";
  const store = useDiffStore();
  const loading = isA ? store.loadingA : store.loadingB;
  const error = isA ? store.errorA : store.errorB;
  const model = isA ? store.modelA : store.modelB;
  const pendingFile = useRef<{ name: string; size: number } | null>(null);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (!file) return;

      if (!file.name.toLowerCase().endsWith(".glb")) {
        const setError = isA ? store.setErrorA : store.setErrorB;
        setError("Only .glb files are supported.");
        return;
      }
      if (file.size > MAX_SIZE_BYTES) {
        const setError = isA ? store.setErrorA : store.setErrorB;
        setError("File exceeds 200 MB limit.");
        return;
      }
      if (file.size > WARN_SIZE_BYTES) {
        console.warn(`[WhatTheDiff] ${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — parsing may be slow.`);
      }

      const prevModel = isA ? store.modelA : store.modelB;
      if (prevModel) disposeModel(prevModel.scene);

      const setLoading = isA ? store.setLoadingA : store.setLoadingB;
      const setError = isA ? store.setErrorA : store.setErrorB;
      const setModel = isA ? store.setModelA : store.setModelB;
      const setBuffer = isA ? store.setBufferA : store.setBufferB;
      const setFileName = isA ? store.setFileNameA : store.setFileNameB;

      setError(null);
      setLoading(true);
      setFileName(file.name);
      pendingFile.current = { name: file.name, size: file.size };

      try {
        const buffer = await file.arrayBuffer();
        const renderer = getSharedRenderer();
        const loaded = await loadModel(buffer, renderer);
        setBuffer(buffer);
        setModel(loaded);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load model.");
      } finally {
        setLoading(false);
        pendingFile.current = null;
      }
    },
    [isA, store]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "model/gltf-binary": [".glb"] },
    multiple: false,
    maxSize: MAX_SIZE_BYTES,
  });

  const label = isA ? "drop original .glb" : "drop modified .glb";
  const isActive = isDragActive || loading;

  return (
    <div style={{ flex: 1 }}>
      <div
        {...getRootProps()}
        aria-label={`Upload ${isA ? "original" : "modified"} model`}
        style={{
          flex: 1,
          border: `2px dashed ${isActive ? "var(--accent)" : model ? "var(--border-focus)" : "var(--border)"}`,
          borderRadius: 8,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          padding: 32,
          cursor: "pointer",
          background: isActive ? "rgba(80, 220, 100, 0.05)" : model ? "rgba(80, 220, 100, 0.03)" : "transparent",
          transition: "all 0.2s ease",
          minHeight: 280,
          position: "relative",
        }}
      >
        <input {...getInputProps()} />

        {loading ? (
          <LoadingState name={pendingFile.current?.name ?? ""} size={pendingFile.current?.size ?? 0} />
        ) : model ? (
          <LoadedState isA={isA} />
        ) : (
          <EmptyState label={label} isActive={isDragActive} />
        )}
      </div>

      {error && (
        <p style={{
          marginTop: 8,
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--red)",
          textAlign: "center",
        }}>
          {error}
        </p>
      )}
    </div>
  );
}

function EmptyState({ label, isActive }: { label: string; isActive: boolean }) {
  return (
    <>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke={isActive ? "var(--accent)" : "var(--text-dim)"} strokeWidth="1.5">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 13,
        color: isActive ? "var(--accent)" : "var(--text-muted)",
        letterSpacing: 0.3,
      }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
        .glb only · max 200 MB
      </div>
    </>
  );
}

function LoadingState({ name, size }: { name: string; size: number }) {
  const sizeMB = size ? `${(size / 1024 / 1024).toFixed(1)} MB` : "";
  return (
    <>
      <div style={{
        width: 24,
        height: 24,
        border: "2px solid var(--text-dim)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", textAlign: "center" }}>
        {name}
      </div>
      {sizeMB && (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
          {sizeMB} · parsing geometry...
        </div>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  );
}

function LoadedState({ isA }: { isA: boolean }) {
  const store = useDiffStore();
  const model = isA ? store.modelA : store.modelB;
  const { vertexCount, triangleCount } = model?.structuralData ?? {};

  return (
    <>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        background: "rgba(80, 220, 100, 0.1)",
        border: "2px solid rgba(80, 220, 100, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>
        parsed
      </div>
      {vertexCount !== undefined && (
        <div style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-dim)",
          display: "flex",
          gap: 12,
        }}>
          <span>{vertexCount.toLocaleString()} verts</span>
          <span>{triangleCount?.toLocaleString()} tris</span>
        </div>
      )}
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)", marginTop: 4 }}>
        drop to replace
      </div>
    </>
  );
}

export function FileUpload() {
  return (
    <div style={{ display: "flex", gap: 20, width: "100%" }}>
      <DropZone side="A" />
      <div style={{
        display: "flex",
        alignItems: "center",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-dim)",
        flexShrink: 0,
      }}>
        vs
      </div>
      <DropZone side="B" />
    </div>
  );
}

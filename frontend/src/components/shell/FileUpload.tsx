"use client";

import { useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { loadModel } from "@/lib/modelLoader";
import { disposeModel } from "@/lib/disposeModel";
import { getSharedRenderer } from "@/lib/sharedRenderer";
import { useDiffStore } from "@/stores/diffStore";

const MAX_SIZE_BYTES = 200 * 1024 * 1024;
const WARN_SIZE_BYTES = 50 * 1024 * 1024;

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

  const tag = isA ? "Version A" : "Version B";
  const isActive = isDragActive || loading;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>

      {/* UE5-style panel header */}
      <div style={{
        height: 26,
        background: "var(--bg-elevated)",
        borderRadius: "2px 2px 0 0",
        border: "1px solid var(--border)",
        borderBottom: "none",
        display: "flex",
        alignItems: "center",
        padding: "0 10px",
        gap: 6,
        flexShrink: 0,
      }}>
        <div style={{
          width: 8, height: 8, borderRadius: 1,
          background: isA ? "var(--accent)" : "var(--orange)",
          flexShrink: 0,
        }} />
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--text-muted)",
          letterSpacing: 0.3,
          textTransform: "uppercase",
          userSelect: "none",
        }}>
          {tag}
        </span>
        {model && (
          <span style={{
            marginLeft: "auto",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--text-dim)",
          }}>
            {isA ? store.fileNameA : store.fileNameB}
          </span>
        )}
      </div>

      {/* Drop area */}
      <div
        {...getRootProps()}
        aria-label={`Upload ${isA ? "original" : "modified"} model`}
        style={{
          flex: 1,
          border: `1px solid ${isActive ? "var(--accent)" : model ? "var(--border-focus)" : "var(--border)"}`,
          borderRadius: "0 0 2px 2px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: 28,
          cursor: "pointer",
          background: isActive
            ? "var(--accent-dim)"
            : model
            ? "rgba(24,120,204,0.04)"
            : "var(--bg-canvas)",
          transition: "border-color 0.15s, background 0.15s",
          minHeight: 240,
          position: "relative",
        }}
      >
        <input {...getInputProps()} />

        {loading ? (
          <LoadingState name={pendingFile.current?.name ?? ""} size={pendingFile.current?.size ?? 0} />
        ) : model ? (
          <LoadedState isA={isA} />
        ) : (
          <EmptyState isActive={isDragActive} />
        )}
      </div>

      {error && (
        <p style={{
          marginTop: 6,
          fontFamily: "var(--font-sans)",
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

function EmptyState({ isActive }: { isActive: boolean }) {
  return (
    <>
      {/* UE5-style import icon — simplified cube/mesh shape */}
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
        stroke={isActive ? "var(--accent)" : "var(--text-dim)"} strokeWidth="1.2"
        style={{ opacity: isActive ? 1 : 0.6 }}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
      </svg>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 12,
          fontWeight: 500,
          color: isActive ? "var(--accent)" : "var(--text-muted)",
          marginBottom: 4,
        }}>
          {isActive ? "Release to load" : "Drop .glb file here"}
        </div>
        <div style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          color: "var(--text-dim)",
        }}>
          or click to browse · max 200 MB
        </div>
      </div>
    </>
  );
}

function LoadingState({ name, size }: { name: string; size: number }) {
  const sizeMB = size ? `${(size / 1024 / 1024).toFixed(1)} MB` : "";
  return (
    <>
      <div style={{
        width: 20,
        height: 20,
        border: "2px solid var(--border)",
        borderTopColor: "var(--accent)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text)", marginBottom: 3 }}>
          {name}
        </div>
        {sizeMB && (
          <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--text-dim)" }}>
            {sizeMB} · parsing…
          </div>
        )}
      </div>
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
      {/* Check icon — UE5 style tick in a square */}
      <div style={{
        width: 32, height: 32, borderRadius: 2,
        background: "var(--accent-dim)",
        border: "1px solid var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, fontWeight: 600, color: "var(--accent)", marginBottom: 4 }}>
          Loaded
        </div>
        {vertexCount !== undefined && (
          <div style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--text-dim)",
            display: "flex",
            gap: 10,
            justifyContent: "center",
          }}>
            <span>{vertexCount.toLocaleString()} verts</span>
            <span>{triangleCount?.toLocaleString()} tris</span>
          </div>
        )}
        <div style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--text-dim)", marginTop: 6 }}>
          Drop to replace
        </div>
      </div>
    </>
  );
}

export function FileUpload() {
  return (
    <div style={{ display: "flex", gap: 16, width: "100%" }}>
      <DropZone side="A" />
      {/* VS separator */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ width: 1, flex: 1, background: "var(--border)" }} />
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: 9,
          fontWeight: 700,
          color: "var(--text-dim)",
          letterSpacing: 1.5,
          textTransform: "uppercase",
          padding: "4px 0",
        }}>
          vs
        </span>
        <div style={{ width: 1, flex: 1, background: "var(--border)" }} />
      </div>
      <DropZone side="B" />
    </div>
  );
}

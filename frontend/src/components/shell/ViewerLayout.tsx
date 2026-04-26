"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useDiffStore } from "@/stores/diffStore";
import { ErrorBoundary } from "../viewer/ErrorBoundary";
import { StatsPanel } from "../ghost/StatsPanel";
import type { ViewMode } from "@/lib/types";

// Three.js / canvas components must be client-only
const SideBySideView = dynamic(
  () => import("../viewer/SideBySideView").then((m) => m.SideBySideView),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);
const TurntableView = dynamic(
  () => import("../viewer/TurntableView").then((m) => m.TurntableView),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);
const GhostOverlayView = dynamic(
  () => import("../ghost/GhostOverlayView").then((m) => m.GhostOverlayView),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);
const AllAnglesView = dynamic(
  () => import("../diff/AllAnglesView"),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);
const FreeformPixelDiffView = dynamic(
  () => import("../diff/FreeformPixelDiffView"),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);

const MODES: { id: ViewMode; label: string; key: string }[] = [
  { id: "side-by-side", label: "Side By Side", key: "1" },
  { id: "ghost",        label: "Ghost Overlay", key: "2" },
  { id: "pixel-diff",  label: "Pixel Diff",    key: "3" },
  { id: "turntable",   label: "Turntable",     key: "4" },
  { id: "all-angles",  label: "All Angles",    key: "5" },
];

export function ViewerLayout() {
  const viewMode           = useDiffStore((s) => s.viewMode);
  const setViewMode        = useDiffStore((s) => s.setViewMode);
  const diffResults        = useDiffStore((s) => s.diffResults);
  const structuralDiffResult = useDiffStore((s) => s.structuralDiffResult);
  const modelA             = useDiffStore((s) => s.modelA);
  const modelB             = useDiffStore((s) => s.modelB);
  const triggerCameraReset = useDiffStore((s) => s.triggerCameraReset);

  // ── keyboard shortcuts: 1-5 switch modes, S toggles camera sync ──────────
  useEffect(() => {
    const modeMap: Record<string, ViewMode> = {
      "1": "side-by-side", "2": "ghost", "3": "pixel-diff",
      "4": "turntable",    "5": "all-angles",
    };
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement;
      if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
      if (modeMap[e.key]) {
        useDiffStore.getState().setViewMode(modeMap[e.key]);
      } else if (e.key === "s" || e.key === "S") {
        const { cameraSynced, setCameraSynced } = useDiffStore.getState();
        setCameraSynced(!cameraSynced);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // ── identical-file detection ──────────────────────────────────────────────
  const isIdentical = useMemo(() => {
    if (diffResults.length < 6 || !structuralDiffResult) return false;
    const visualClear = diffResults.every((r) => r.pct < 0.1);
    const { vertexDelta, triangleDelta, meshCountDelta, nodeCountDelta,
            animationCountDelta, materialsAdded, materialsRemoved,
            materialsModified, boundingBox } = structuralDiffResult;
    const structClear =
      vertexDelta === 0 && triangleDelta === 0 && meshCountDelta === 0 &&
      nodeCountDelta === 0 && animationCountDelta === 0 &&
      materialsAdded.length === 0 && materialsRemoved.length === 0 &&
      materialsModified.length === 0 &&
      Math.abs(boundingBox.delta.x) < 0.001 &&
      Math.abs(boundingBox.delta.y) < 0.001 &&
      Math.abs(boundingBox.delta.z) < 0.001;
    return visualClear && structClear;
  }, [diffResults, structuralDiffResult]);

  // ── >95% changed toast ────────────────────────────────────────────────────
  const [showToast, setShowToast] = useState(false);
  const toastShownForRef = useRef<string | null>(null);

  const isEntirelyDifferent = useMemo(
    () => diffResults.length === 6 && diffResults.every((r) => r.pct > 95),
    [diffResults]
  );

  useEffect(() => {
    if (!isEntirelyDifferent || !modelA || !modelB) return;
    const key = `${modelA.scene.uuid}__${modelB.scene.uuid}`;
    if (toastShownForRef.current === key) return;
    toastShownForRef.current = key;
    setShowToast(true);
    const t = setTimeout(() => setShowToast(false), 8000);
    return () => clearTimeout(t);
  }, [isEntirelyDifferent, modelA, modelB]);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minHeight: 0 }}>
      {/* ── Mode tab bar — UE5 docked-panel tab style ───────────────────── */}
      {/*   Active tab: top accent line, bg matches content, NO bottom border  */}
      {/*   Inactive: transparent, bottom border shows through                 */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
        height: 32,
      }}>
        {MODES.map((m) => {
          const active = viewMode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              aria-label={`Switch to ${m.label} mode (${m.key})`}
              title={`${m.label} [${m.key}]`}
              style={{
                position: "relative",
                padding: "0 16px",
                border: "none",
                borderRight: "1px solid var(--border)",
                /* Top accent line on active; invisible placeholder on inactive */
                borderTop: active ? "2px solid var(--accent)" : "2px solid transparent",
                /* Active tab bg matches the content area below so it "opens into" it */
                background: active ? "var(--bg-surface)" : "transparent",
                /* Active tab removes its OWN bottom border so it merges with content */
                boxShadow: active ? "0 1px 0 var(--bg-surface)" : "none",
                color: active ? "var(--text)" : "var(--text-muted)",
                fontFamily: "var(--font-sans)",
                fontSize: 11,
                fontWeight: active ? 600 : 400,
                cursor: "pointer",
                letterSpacing: 0.15,
                transition: "background 0.1s, color 0.1s",
                whiteSpace: "nowrap",
                zIndex: active ? 1 : 0,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "var(--text)";
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = "var(--text-muted)";
                }
              }}
            >
              {m.label}
            </button>
          );
        })}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Reset camera */}
        {viewMode !== "all-angles" && (
          <button
            onClick={triggerCameraReset}
            aria-label="Reset camera"
            title="Reset camera"
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "0 14px",
              border: "none",
              borderLeft: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text-muted)",
              fontFamily: "var(--font-sans)",
              fontSize: 11,
              cursor: "pointer",
              transition: "background 0.1s, color 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(255,255,255,0.04)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-muted)";
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            Reset Camera
          </button>
        )}
      </div>

      {/* Main area: viewer + stats sidebar */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        {/* Viewer area — flex column so child view components' flex:1 resolves correctly */}
        <div style={{ flex: 1, position: "relative", minWidth: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ErrorBoundary>
            <ActiveView mode={viewMode} />
          </ErrorBoundary>
          {isIdentical && <IdenticalOverlay />}
        </div>

        <StatsPanel />
      </div>

      {/* Toast — fixed to viewport bottom-right */}
      {showToast && <DifferentModelsToast onDismiss={() => setShowToast(false)} />}
    </div>
  );
}

function ActiveView({ mode }: { mode: ViewMode }) {
  switch (mode) {
    case "side-by-side": return <SideBySideView />;
    case "turntable":    return <TurntableView />;
    case "ghost":        return <GhostOverlayView />;
    case "pixel-diff":   return <FreeformPixelDiffView />;
    case "all-angles":   return <AllAnglesView />;
  }
}

function IdenticalOverlay() {
  return (
    <div style={{
      position: "absolute", inset: 0,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: 12, pointerEvents: "none",
      background: "rgba(20, 20, 20, 0.72)",
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 4,
        background: "var(--accent-dim)",
        border: "1px solid var(--accent)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 14, fontWeight: 700, color: "var(--text)", letterSpacing: 0.2 }}>
        No Differences Found
      </div>
      <div style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-muted)" }}>
        v1 and v2 are identical
      </div>
    </div>
  );
}

function DifferentModelsToast({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 100,
      background: "var(--bg-elevated)", border: "1px solid var(--border)",
      borderRadius: 6, padding: "12px 16px", maxWidth: 340,
      display: "flex", gap: 12, alignItems: "flex-start",
      boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
    }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="var(--yellow)" strokeWidth="2" style={{ flexShrink: 0, marginTop: 1 }}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Models appear entirely different
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>
          This tool is designed to compare two versions of the same asset. These models share very little in common.
        </div>
      </div>
      <button
        onClick={onDismiss}
        aria-label="Dismiss warning"
        style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", padding: 2, flexShrink: 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

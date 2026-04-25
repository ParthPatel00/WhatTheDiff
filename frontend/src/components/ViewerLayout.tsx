"use client";

/**
 * Minimal viewer shell used during Phase 1 testing.
 * Phase 4 replaces this with the full DiffControls + Header + StatsPanel layout.
 *
 * Integration notes for Phase 2 / Phase 3:
 *  - Add PixelDiffView, AllAnglesView imports and cases below (Phase 2)
 *  - Replace <StatsPanelPlaceholder> with <StatsPanel /> import (Phase 3)
 *  - GhostOverlayView case is already wired up as a stub (Phase 3)
 */

import dynamic from "next/dynamic";
import { useDiffStore } from "@/stores/diffStore";
import { ErrorBoundary } from "./ErrorBoundary";
import type { ViewMode } from "@/lib/types";

// Three.js components must be client-only (access window at runtime)
const SideBySideView = dynamic(
  () => import("./SideBySideView").then((m) => m.SideBySideView),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);
const TurntableView = dynamic(
  () => import("./TurntableView").then((m) => m.TurntableView),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);

const MODES: { id: ViewMode; label: string }[] = [
  { id: "side-by-side", label: "side by side" },
  { id: "ghost", label: "ghost overlay" },
  { id: "pixel-diff", label: "pixel diff" },
  { id: "turntable", label: "turntable" },
  { id: "all-angles", label: "all angles" },
];

export function ViewerLayout() {
  const viewMode = useDiffStore((s) => s.viewMode);
  const setViewMode = useDiffStore((s) => s.setViewMode);

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, height: "100%", minHeight: 0 }}>
      {/* Mode bar */}
      <div style={{
        display: "flex",
        gap: 2,
        background: "var(--bg)",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        {MODES.map((m) => (
          <button
            key={m.id}
            onClick={() => setViewMode(m.id)}
            aria-label={`Switch to ${m.label} mode`}
            style={{
              padding: "7px 18px",
              borderRadius: 4,
              border: `1px solid ${viewMode === m.id ? "var(--border-focus)" : "var(--border)"}`,
              background: viewMode === m.id ? "var(--bg-elevated)" : "transparent",
              color: viewMode === m.id ? "var(--text)" : "var(--text-muted)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              cursor: "pointer",
              letterSpacing: 0.3,
              transition: "all 0.15s ease",
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Main area: viewer + stats sidebar */}
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <ErrorBoundary>
          <ActiveView mode={viewMode} />
        </ErrorBoundary>

        {/* Stats panel placeholder — Phase 3 replaces this with <StatsPanel /> */}
        <StatsPanelPlaceholder />
      </div>
    </div>
  );
}

function ActiveView({ mode }: { mode: ViewMode }) {
  switch (mode) {
    case "side-by-side":
      return <SideBySideView />;
    case "turntable":
      return <TurntableView />;
    // Phase 3 will fill these in:
    case "ghost":
      return <ComingSoonView label="ghost overlay" phase={3} />;
    // Phase 2 will fill these in:
    case "pixel-diff":
      return <ComingSoonView label="pixel diff" phase={2} />;
    case "all-angles":
      return <ComingSoonView label="all angles" phase={2} />;
  }
}

function ComingSoonView({ label, phase }: { label: string; phase: number }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      background: "var(--bg-canvas)",
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>
        {label}
      </span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
        implemented in Phase {phase}
      </span>
    </div>
  );
}

function StatsPanelPlaceholder() {
  return (
    <div style={{
      width: 260,
      background: "var(--bg-surface)",
      borderLeft: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
        stats panel · Phase 3
      </span>
    </div>
  );
}

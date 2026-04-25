"use client";

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
const PixelDiffView = dynamic(
  () => import("../diff/PixelDiffView"),
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

        <StatsPanel />
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
    case "ghost":
      return <GhostOverlayView />;
    case "pixel-diff":
      return <PixelDiffView />;
    case "all-angles":
      return <AllAnglesView />;
  }
}

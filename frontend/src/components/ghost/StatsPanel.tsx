"use client";

import { useEffect, useState } from "react";
import { PanelRight } from "lucide-react";
import { useDiffStore } from "@/stores/diffStore";
import { computeStructuralDiff } from "@/lib/structuralDiff";
import type { StructuralDiffResult, MaterialDiff } from "@/lib/types";

// ─── helpers ────────────────────────────────────────────────────────────────

function sign(n: number): string {
  return n > 0 ? `+${n.toLocaleString()}` : n.toLocaleString();
}

function signFloat(n: number, decimals = 3): string {
  const s = Math.abs(n).toFixed(decimals);
  return n > 0 ? `+${s}` : n < 0 ? `-${s}` : s;
}

function deltaColor(delta: number, colorblindMode: boolean): string {
  if (delta > 0) return colorblindMode ? "var(--blue)" : "var(--green)";
  if (delta < 0) return colorblindMode ? "var(--orange)" : "var(--red)";
  return "var(--text-muted)";
}

// ─── sub-components ──────────────────────────────────────────────────────────

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <>
      <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {label}
      </span>
      <span style={{
        color: color ?? "var(--text-muted)",
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        textAlign: "right",
      }}>
        {value}
      </span>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      gridColumn: "1 / -1",
      color: "var(--text-dim)",
      fontFamily: "var(--font-mono)",
      fontSize: 9,
      letterSpacing: 1,
      textTransform: "uppercase",
      marginTop: 10,
      paddingTop: 8,
      borderTop: "1px solid var(--border)",
    }}>
      {children}
    </span>
  );
}

function MaterialTag({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span style={{
      gridColumn: "1 / -1",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      color,
      paddingLeft: 8,
    }}>
      {label}
    </span>
  );
}

function MaterialModifiedDetail({ mat }: { mat: MaterialDiff }) {
  return (
    <span style={{
      gridColumn: "1 / -1",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      color: "var(--yellow)",
      paddingLeft: 8,
    }}>
      {mat.name} ({mat.changes.map(c => c.property).join(", ")})
    </span>
  );
}

// ─── main panel ──────────────────────────────────────────────────────────────

function PanelContent({
  result,
  colorblindMode,
}: {
  result: StructuralDiffResult;
  colorblindMode: boolean;
}) {
  const addedColor = colorblindMode ? "var(--blue)" : "var(--green)";
  const removedColor = colorblindMode ? "var(--orange)" : "var(--red)";

  const bboxEmpty =
    result.boundingBox.a.isEmpty() && result.boundingBox.b.isEmpty();

  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        gap: "3px 12px",
        padding: "12px 16px",
      }}
    >
      {/* Geometry */}
      <SectionLabel>geometry</SectionLabel>
      <Row
        label="vertices"
        value={sign(result.vertexDelta)}
        color={deltaColor(result.vertexDelta, colorblindMode)}
      />
      <Row
        label="triangles"
        value={sign(result.triangleDelta)}
        color={deltaColor(result.triangleDelta, colorblindMode)}
      />

      {/* Scene */}
      <SectionLabel>scene</SectionLabel>
      <Row
        label="nodes"
        value={sign(result.nodeCountDelta)}
        color={deltaColor(result.nodeCountDelta, colorblindMode)}
      />
      <Row
        label="animations"
        value={sign(result.animationCountDelta)}
        color={deltaColor(result.animationCountDelta, colorblindMode)}
      />

      {/* Bounding box */}
      <SectionLabel>bounding box Δ</SectionLabel>
      {bboxEmpty ? (
        <Row label="n/a" value="—" />
      ) : (
        <>
          <Row
            label="width (x)"
            value={signFloat(result.boundingBox.delta.x)}
            color={deltaColor(result.boundingBox.delta.x, colorblindMode)}
          />
          <Row
            label="height (y)"
            value={signFloat(result.boundingBox.delta.y)}
            color={deltaColor(result.boundingBox.delta.y, colorblindMode)}
          />
          <Row
            label="depth (z)"
            value={signFloat(result.boundingBox.delta.z)}
            color={deltaColor(result.boundingBox.delta.z, colorblindMode)}
          />
        </>
      )}

      {/* Materials */}
      <SectionLabel>materials</SectionLabel>
      {result.materialsAdded.length === 0 &&
        result.materialsRemoved.length === 0 &&
        result.materialsModified.length === 0 ? (
          <Row label="no changes" value="—" />
        ) : (
          <>
            {result.materialsAdded.map((name) => (
              <MaterialTag key={`add-${name}`} label={`+ ${name}`} color={addedColor} />
            ))}
            {result.materialsRemoved.map((name) => (
              <MaterialTag key={`rem-${name}`} label={`− ${name}`} color={removedColor} />
            ))}
            {result.materialsModified.map((mat) => (
              <MaterialModifiedDetail key={`mod-${mat.name}`} mat={mat} />
            ))}
          </>
        )}
    </div>
  );
}

// ─── export ───────────────────────────────────────────────────────────────────

export function StatsPanel() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const result = useDiffStore((s) => s.structuralDiffResult);
  const setResult = useDiffStore((s) => s.setStructuralDiffResult);
  const colorblindMode = useDiffStore((s) => s.colorblindMode);

  const [userCollapsed, setUserCollapsed] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  // Run structural diff whenever both models are present.
  useEffect(() => {
    if (modelA && modelB) {
      setResult(computeStructuralDiff(modelA.structuralData, modelB.structuralData));
    } else {
      setResult(null);
    }
  }, [modelA, modelB, setResult]);

  // Auto-collapse below 900px.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e: MediaQueryListEvent) => setAutoCollapsed(e.matches);
    setAutoCollapsed(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isCollapsed = autoCollapsed || userCollapsed;

  // ── collapsed state ──
  if (isCollapsed) {
    return (
      <aside
        role="complementary"
        aria-label="Structural diff stats"
        style={{
          width: 48,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 12,
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => {
            setUserCollapsed(false);
            setAutoCollapsed(false);
          }}
          aria-label="Expand stats panel"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            padding: 8,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PanelRight size={16} />
        </button>
      </aside>
    );
  }

  // ── expanded state ──
  return (
    <aside
      role="complementary"
      aria-label="Structural diff stats"
      style={{
        width: 280,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderBottom: "1px solid var(--border)",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
          color: "var(--text-muted)",
        }}>
          diff stats
        </span>
        <button
          onClick={() => setUserCollapsed(true)}
          aria-label="Collapse stats panel"
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-dim)",
            padding: 4,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
          }}
        >
          <PanelRight size={14} />
        </button>
      </div>

      {/* Body */}
      {!result ? (
        <p style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-dim)",
          padding: 16,
          lineHeight: 1.6,
        }}>
          {modelA || modelB
            ? "Upload both models to see structural differences."
            : "Upload two models to see structural differences."}
        </p>
      ) : (
        <PanelContent result={result} colorblindMode={colorblindMode} />
      )}
    </aside>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Vector3 } from "three";
import { PanelRight } from "lucide-react";
import { useDiffStore } from "@/stores/diffStore";
import { computeStructuralDiff } from "@/lib/structuralDiff";
import type { StructuralDiffResult, MaterialDiff, StructuralData } from "@/lib/types";

// ─── formatting helpers ──────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString(); }
function fmtF(n: number, d = 2) { return n.toFixed(d); }

function signColor(delta: number, colorblind: boolean): string {
  if (delta > 0) return colorblind ? "var(--blue)" : "var(--green)";
  if (delta < 0) return colorblind ? "var(--orange)" : "var(--red)";
  return "var(--text-muted)";
}

function signStr(n: number): string {
  return n > 0 ? `+${fmt(n)}` : fmt(n);
}

function fmtPropValue(prop: string, val: unknown): string {
  if (Array.isArray(val)) {
    if (prop === "baseColorFactor") {
      const [r, g, b, a] = val as number[];
      return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${fmtF(a ?? 1, 2)})`;
    }
    if (prop === "emissiveFactor") {
      const [r, g, b] = val as number[];
      return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
    }
    return (val as number[]).map((v) => fmtF(v, 3)).join(", ");
  }
  if (typeof val === "number") return fmtF(val, 3);
  if (typeof val === "boolean") return val ? "yes" : "no";
  return String(val);
}

// ─── layout primitives ───────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      gridColumn: "1 / -1",
      color: "var(--text-dim)",
      fontFamily: "var(--font-mono)",
      fontSize: 10,
      letterSpacing: 1.5,
      textTransform: "uppercase",
      marginTop: 10,
      paddingTop: 8,
      borderTop: "1px solid var(--border)",
    }}>
      {children}
    </span>
  );
}

function Row({ label, value, sub, color, labelColor }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  labelColor?: string;
}) {
  return (
    <>
      <span style={{ color: labelColor ?? "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
        {label}
      </span>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: color ?? "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
          {value}
        </div>
        {sub && (
          <div style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 9, marginTop: 1 }}>
            {sub}
          </div>
        )}
      </div>
    </>
  );
}

// Geometry row: shows "from → to" when changed, just "n" when not
function CountRow({ label, a, b, colorblind }: {
  label: string;
  a: number;
  b: number;
  colorblind: boolean;
}) {
  const delta = b - a;
  const isChanged = delta !== 0;
  const value = isChanged ? `${fmt(a)} → ${fmt(b)}` : fmt(a);
  const sub = isChanged ? signStr(delta) : undefined;
  const labelColor = isChanged ? "var(--text-muted)" : "var(--text-dim)";
  const valueColor = isChanged ? signColor(delta, colorblind) : "var(--text-dim)";
  return <Row label={label} value={value} sub={sub} color={valueColor} labelColor={labelColor} />;
}

// ─── sections ────────────────────────────────────────────────────────────────

function GeometrySection({ a, b, result, colorblind }: {
  a: StructuralData;
  b: StructuralData;
  result: StructuralDiffResult;
  colorblind: boolean;
}) {
  void result; // deltas re-derived from a/b for display consistency
  return (
    <>
      <SectionLabel>geometry</SectionLabel>
      <CountRow label="vertices"  a={a.vertexCount}   b={b.vertexCount}   colorblind={colorblind} />
      <CountRow label="triangles" a={a.triangleCount} b={b.triangleCount} colorblind={colorblind} />
      <CountRow label="meshes"    a={a.meshCount}     b={b.meshCount}     colorblind={colorblind} />
    </>
  );
}

function SceneSection({ a, b, colorblind }: {
  a: StructuralData;
  b: StructuralData;
  colorblind: boolean;
}) {
  return (
    <>
      <SectionLabel>scene</SectionLabel>
      <CountRow label="nodes"      a={a.nodeCount}      b={b.nodeCount}      colorblind={colorblind} />
      <CountRow label="animations" a={a.animationCount} b={b.animationCount} colorblind={colorblind} />
      <CountRow label="materials"  a={a.materialCount}  b={b.materialCount}  colorblind={colorblind} />
    </>
  );
}

function BBoxSection({ result, colorblind }: {
  result: StructuralDiffResult;
  colorblind: boolean;
}) {
  const { a, b, delta } = result.boundingBox;

  if (a.isEmpty() && b.isEmpty()) {
    return (
      <>
        <SectionLabel>bounding box</SectionLabel>
        <Row label="n/a" value="—" />
      </>
    );
  }

  const sA = a.isEmpty() ? null : a.getSize(new (Vector3)());
  const sB = b.isEmpty() ? null : b.getSize(new (Vector3)());

  function dim(label: string, vA: number | null, vB: number | null, d: number) {
    if (vA === null || vB === null) return null;
    const changed = Math.abs(d) > 0.0005;
    const color = changed ? signColor(d, colorblind) : "var(--text-muted)";
    const value = changed ? `${fmtF(vA)} → ${fmtF(vB)}` : fmtF(vA);
    const sub = changed ? (d > 0 ? `+${fmtF(d)}` : fmtF(d)) : undefined;
    return <Row key={label} label={label} value={value} sub={sub} color={color} />;
  }

  return (
    <>
      <SectionLabel>bounding box (units)</SectionLabel>
      {dim("width (x)",  sA?.x ?? null, sB?.x ?? null, delta.x)}
      {dim("height (y)", sA?.y ?? null, sB?.y ?? null, delta.y)}
      {dim("depth (z)",  sA?.z ?? null, sB?.z ?? null, delta.z)}
    </>
  );
}

function MaterialsSection({ result, colorblind }: {
  result: StructuralDiffResult;
  colorblind: boolean;
}) {
  const addColor = colorblind ? "var(--blue)"   : "var(--green)";
  const remColor = colorblind ? "var(--orange)" : "var(--red)";
  const noChanges =
    result.materialsAdded.length === 0 &&
    result.materialsRemoved.length === 0 &&
    result.materialsModified.length === 0;

  return (
    <>
      <SectionLabel>materials</SectionLabel>
      {noChanges ? (
        <Row label="no changes" value="—" />
      ) : (
        <>
          {result.materialsAdded.map((name) => (
            <span key={`a-${name}`} style={{
              gridColumn: "1 / -1",
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: addColor, paddingLeft: 4,
            }}>
              + {name}
            </span>
          ))}
          {result.materialsRemoved.map((name) => (
            <span key={`r-${name}`} style={{
              gridColumn: "1 / -1",
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: remColor, paddingLeft: 4,
            }}>
              − {name}
            </span>
          ))}
          {result.materialsModified.map((mat) => (
            <MaterialDetail key={`m-${mat.name}`} mat={mat} />
          ))}
        </>
      )}
    </>
  );
}

function MaterialDetail({ mat }: { mat: MaterialDiff }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <span
        onClick={() => setOpen((v) => !v)}
        style={{
          gridColumn: "1 / -1",
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--yellow)", paddingLeft: 4,
          cursor: "pointer", userSelect: "none",
        }}
      >
        {open ? "▾" : "▸"} ~ {mat.name}
        <span style={{ color: "var(--text-dim)", marginLeft: 6 }}>
          ({mat.changes.length} change{mat.changes.length !== 1 ? "s" : ""})
        </span>
      </span>
      {open && mat.changes.map((c, i) => (
        <span key={i} style={{
          gridColumn: "1 / -1",
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: "var(--text-muted)", paddingLeft: 16,
          lineHeight: 1.6,
        }}>
          {c.property}: {fmtPropValue(c.property, c.before)} → {fmtPropValue(c.property, c.after)}
        </span>
      ))}
    </>
  );
}

function VisualDiffSection({ colorblind }: { colorblind: boolean }) {
  const diffResults = useDiffStore((s) => s.diffResults);
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);

  if (!modelA || !modelB) return null;

  if (diffResults.length === 0) {
    return (
      <>
        <SectionLabel>visual diff (6 angles)</SectionLabel>
        <Row label="computing…" value="—" />
      </>
    );
  }

  const max = diffResults.reduce((best, r) => r.pct > best.pct ? r : best, diffResults[0]);
  const avg = diffResults.reduce((s, r) => s + r.pct, 0) / diffResults.length;
  const allZero = max.pct < 0.01;

  const pctColor = (pct: number) => {
    if (pct < 1) return "var(--text-muted)";
    if (pct < 10) return colorblind ? "var(--blue)" : "var(--yellow)";
    return colorblind ? "var(--orange)" : "var(--red)";
  };

  return (
    <>
      <SectionLabel>visual diff (6 angles)</SectionLabel>
      {allZero ? (
        <Row label="no visual changes" value="—" color="var(--text-muted)" />
      ) : (
        <>
          <Row label="avg change" value={`${avg.toFixed(1)}%`} color={pctColor(avg)} />
          <Row label={`max (${max.angle})`} value={`${max.pct.toFixed(1)}%`} color={pctColor(max.pct)} />
        </>
      )}
    </>
  );
}

// ─── panel shell ─────────────────────────────────────────────────────────────

function PanelContent({
  result,
  dataA,
  dataB,
  colorblind,
}: {
  result: StructuralDiffResult;
  dataA: StructuralData;
  dataB: StructuralData;
  colorblind: boolean;
}) {
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
      <VisualDiffSection colorblind={colorblind} />
      <GeometrySection a={dataA} b={dataB} result={result} colorblind={colorblind} />
      <SceneSection a={dataA} b={dataB} colorblind={colorblind} />
      <BBoxSection result={result} colorblind={colorblind} />
      <MaterialsSection result={result} colorblind={colorblind} />
    </div>
  );
}

export function StatsPanel() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const result = useDiffStore((s) => s.structuralDiffResult);
  const setResult = useDiffStore((s) => s.setStructuralDiffResult);
  const colorblindMode = useDiffStore((s) => s.colorblindMode);
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);

  useEffect(() => {
    if (modelA && modelB) {
      setResult(computeStructuralDiff(modelA.structuralData, modelB.structuralData));
    } else {
      setResult(null);
    }
  }, [modelA, modelB, setResult]);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 900px)");
    const handler = (e: MediaQueryListEvent) => setAutoCollapsed(e.matches);
    setAutoCollapsed(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const isCollapsed = autoCollapsed || userCollapsed;

  if (isCollapsed) {
    return (
      <aside
        role="complementary"
        aria-label="Structural diff stats"
        style={{
          width: 48, display: "flex", flexDirection: "column",
          alignItems: "center", paddingTop: 12,
          background: "var(--bg-surface)", borderLeft: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => { setUserCollapsed(false); setAutoCollapsed(false); }}
          aria-label="Expand stats panel"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 8, borderRadius: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <PanelRight size={16} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label="Structural diff stats"
      style={{
        width: 280, background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex", flexDirection: "column",
        flexShrink: 0, overflowY: "auto",
      }}
    >
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 16px", borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, background: "var(--bg-surface)", zIndex: 1,
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)",
        }}>
          diff stats
        </span>
        <button
          onClick={() => setUserCollapsed(true)}
          aria-label="Collapse stats panel"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-dim)", padding: 4, borderRadius: 4,
            display: "flex", alignItems: "center",
          }}
        >
          <PanelRight size={14} />
        </button>
      </div>

      {!result || !modelA || !modelB ? (
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)",
          padding: 16, lineHeight: 1.6,
        }}>
          {modelA || modelB
            ? "Upload both models to see structural differences."
            : "Upload two models to see structural differences."}
        </p>
      ) : (
        <PanelContent
          result={result}
          dataA={modelA.structuralData}
          dataB={modelB.structuralData}
          colorblind={colorblindMode}
        />
      )}
    </aside>
  );
}

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

// ─── UE5-style collapsible section header ────────────────────────────────────

function Section({ title, children, defaultOpen = true }: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ gridColumn: "1 / -1" }}>
      {/* Section header — matches UE5 Details panel section bars */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          width: "100%",
          padding: "0 10px",
          height: 24,
          background: "var(--bg-elevated)",
          border: "none",
          borderTop: "1px solid var(--border)",
          borderBottom: open ? "1px solid var(--border)" : "none",
          cursor: "pointer",
          textAlign: "left",
          marginTop: 4,
        }}
      >
        {/* UE5-style collapse chevron */}
        <svg
          width="8" height="8" viewBox="0 0 8 8" fill="none"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(0deg)" : "rotate(-90deg)", flexShrink: 0 }}
        >
          <path d="M1 2.5L4 5.5L7 2.5" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: 0.6,
          textTransform: "uppercase",
          userSelect: "none",
        }}>
          {title}
        </span>
      </button>

      {/* Section content */}
      {open && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "2px 10px",
          padding: "6px 10px 8px",
        }}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Property row — label left, value right ───────────────────────────────────

function Row({ label, value, sub, color, labelColor }: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  labelColor?: string;
}) {
  return (
    <>
      <span style={{
        color: labelColor ?? "var(--text-muted)",
        fontFamily: "var(--font-sans)",
        fontSize: 11,
        lineHeight: "22px",
        paddingLeft: 8,
      }}>
        {label}
      </span>
      <div style={{ textAlign: "right" }}>
        <div style={{
          color: color ?? "var(--text)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          lineHeight: "22px",
        }}>
          {value}
        </div>
        {sub && (
          <div style={{
            color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            marginTop: 1,
          }}>
            {sub}
          </div>
        )}
      </div>
    </>
  );
}

function CountRow({ label, a, b, colorblind }: {
  label: string; a: number; b: number; colorblind: boolean;
}) {
  const delta = b - a;
  const isChanged = delta !== 0;
  const value = isChanged ? `${fmt(a)} → ${fmt(b)}` : fmt(a);
  const sub = isChanged ? signStr(delta) : undefined;
  const labelColor = isChanged ? "var(--text)" : "var(--text-muted)";
  const valueColor = isChanged ? signColor(delta, colorblind) : "var(--text-muted)";
  return <Row label={label} value={value} sub={sub} color={valueColor} labelColor={labelColor} />;
}

// ─── sections ────────────────────────────────────────────────────────────────

function GeometrySection({ a, b, colorblind }: { a: StructuralData; b: StructuralData; colorblind: boolean }) {
  return (
    <Section title="Geometry">
      <CountRow label="Vertices"  a={a.vertexCount}   b={b.vertexCount}   colorblind={colorblind} />
      <CountRow label="Triangles" a={a.triangleCount} b={b.triangleCount} colorblind={colorblind} />
      <CountRow label="Meshes"    a={a.meshCount}     b={b.meshCount}     colorblind={colorblind} />
    </Section>
  );
}

function SceneSection({ a, b, colorblind }: { a: StructuralData; b: StructuralData; colorblind: boolean }) {
  return (
    <Section title="Scene">
      <CountRow label="Nodes"      a={a.nodeCount}      b={b.nodeCount}      colorblind={colorblind} />
      <CountRow label="Animations" a={a.animationCount} b={b.animationCount} colorblind={colorblind} />
      <CountRow label="Materials"  a={a.materialCount}  b={b.materialCount}  colorblind={colorblind} />
    </Section>
  );
}

function BBoxSection({ result, colorblind }: { result: StructuralDiffResult; colorblind: boolean }) {
  const { a, b, delta } = result.boundingBox;

  if (a.isEmpty() && b.isEmpty()) {
    return (
      <Section title="Bounding Box">
        <Row label="n/a" value="—" />
      </Section>
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
    <Section title="Bounding Box">
      {dim("Width (X)",  sA?.x ?? null, sB?.x ?? null, delta.x)}
      {dim("Height (Y)", sA?.y ?? null, sB?.y ?? null, delta.y)}
      {dim("Depth (Z)",  sA?.z ?? null, sB?.z ?? null, delta.z)}
    </Section>
  );
}

function MaterialsSection({ result, colorblind }: { result: StructuralDiffResult; colorblind: boolean }) {
  const addColor = colorblind ? "var(--blue)"   : "var(--green)";
  const remColor = colorblind ? "var(--orange)" : "var(--red)";
  const noChanges =
    result.materialsAdded.length === 0 &&
    result.materialsRemoved.length === 0 &&
    result.materialsModified.length === 0;

  return (
    <Section title="Materials">
      {noChanges ? (
        <Row label="No changes" value="—" />
      ) : (
        <>
          {result.materialsAdded.map((name) => (
            <span key={`a-${name}`} style={{
              gridColumn: "1 / -1",
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: addColor, paddingLeft: 8,
            }}>
              + {name}
            </span>
          ))}
          {result.materialsRemoved.map((name) => (
            <span key={`r-${name}`} style={{
              gridColumn: "1 / -1",
              fontFamily: "var(--font-mono)", fontSize: 10,
              color: remColor, paddingLeft: 8,
            }}>
              − {name}
            </span>
          ))}
          {result.materialsModified.map((mat) => (
            <MaterialDetail key={`m-${mat.name}`} mat={mat} />
          ))}
        </>
      )}
    </Section>
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
          fontFamily: "var(--font-sans)", fontSize: 11,
          color: "var(--yellow)", paddingLeft: 8,
          cursor: "pointer", userSelect: "none",
          display: "flex", alignItems: "center", gap: 5,
        }}
      >
        <svg width="7" height="7" viewBox="0 0 8 8" fill="none"
          style={{ transform: open ? "rotate(0)" : "rotate(-90deg)", flexShrink: 0 }}>
          <path d="M1 2.5L4 5.5L7 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        ~ {mat.name}
        <span style={{ color: "var(--text-dim)", marginLeft: 4, fontSize: 10 }}>
          ({mat.changes.length})
        </span>
      </span>
      {open && mat.changes.map((c, i) => (
        <span key={i} style={{
          gridColumn: "1 / -1",
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: "var(--text-muted)", paddingLeft: 20,
          lineHeight: 1.7,
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
      <Section title="Visual Diff">
        <Row label="Computing…" value="—" />
      </Section>
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
    <Section title="Visual Diff">
      {allZero ? (
        <Row label="No visual changes" value="—" color="var(--text-muted)" />
      ) : (
        <>
          <Row label="Avg change" value={`${avg.toFixed(1)}%`} color={pctColor(avg)} />
          <Row label={`Max (${max.angle})`} value={`${max.pct.toFixed(1)}%`} color={pctColor(max.pct)} />
        </>
      )}
    </Section>
  );
}

// ─── panel shell ─────────────────────────────────────────────────────────────

function PanelContent({
  result, dataA, dataB, colorblind,
}: {
  result: StructuralDiffResult;
  dataA: StructuralData;
  dataB: StructuralData;
  colorblind: boolean;
}) {
  return (
    <div aria-live="polite" aria-atomic="false">
      <VisualDiffSection colorblind={colorblind} />
      <GeometrySection a={dataA} b={dataB} colorblind={colorblind} />
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
          width: 36,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 6,
          background: "var(--bg-surface)",
          borderLeft: "1px solid var(--border)",
          flexShrink: 0,
        }}
      >
        <button
          onClick={() => { setUserCollapsed(false); setAutoCollapsed(false); }}
          aria-label="Expand stats panel"
          title="Expand Details"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: 8, borderRadius: 2,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <PanelRight size={14} />
        </button>
      </aside>
    );
  }

  return (
    <aside
      role="complementary"
      aria-label="Structural diff stats"
      style={{
        width: 260,
        background: "var(--bg-surface)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      {/* Panel title bar — UE5 Details panel style */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 10px 0 12px",
        height: 30,
        borderBottom: "1px solid var(--border)",
        position: "sticky",
        top: 0,
        background: "var(--bg-elevated)",
        zIndex: 1,
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: "uppercase",
          color: "var(--text-muted)",
          userSelect: "none",
        }}>
          Details
        </span>
        <button
          onClick={() => setUserCollapsed(true)}
          aria-label="Collapse stats panel"
          title="Collapse"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-dim)", padding: 4, borderRadius: 2,
            display: "flex", alignItems: "center",
            transition: "color 0.1s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
        >
          <PanelRight size={13} />
        </button>
      </div>

      {!result || !modelA || !modelB ? (
        <p style={{
          fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--text-dim)",
          padding: "16px 12px", lineHeight: 1.6,
        }}>
          {modelA || modelB
            ? "Upload both models to see diff."
            : "Upload two models to compare."}
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

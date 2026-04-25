"use client";

import { useEffect, useRef, useState } from "react";
import { useDiffStore } from "@/stores/diffStore";
import { CAMERA_ANGLE_ORDER } from "@/lib/cameraPresets";
import { CameraAngle, type DiffResult } from "@/lib/types";
import PixelDiffView from "./PixelDiffView";

const RENDER_SIZE = 1024;

const ANGLE_LABELS: Record<CameraAngle, string> = {
  [CameraAngle.Front]: "Front",
  [CameraAngle.Back]: "Back",
  [CameraAngle.Left]: "Left",
  [CameraAngle.Right]: "Right",
  [CameraAngle.Top]: "Top",
  [CameraAngle.ThreeQuarter]: "3/4",
};

// ─── Single cell ────────────────────────────────────────────────────────────

interface CellProps {
  angle: CameraAngle;
  result: DiffResult | undefined;
  onClick: () => void;
}

function AngleCell({ angle, result, onClick }: CellProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = RENDER_SIZE;
    canvas.height = RENDER_SIZE;
    const imageData = new ImageData(RENDER_SIZE, RENDER_SIZE);
    imageData.data.set(result.diff);
    ctx.putImageData(imageData, 0, 0);
  }, [result]);

  const pct = result?.pct ?? null;
  const badgeColor = pct === null ? "var(--text-dim)"
    : pct < 1 ? "var(--green)"
    : pct > 50 ? "var(--red)"
    : "var(--yellow)";

  return (
    <button
      aria-label={`${ANGLE_LABELS[angle]}: ${pct !== null ? pct.toFixed(1) + "% changed" : "loading"}`}
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column",
        background: "var(--bg-surface)", border: "1px solid var(--border)",
        borderRadius: 6, overflow: "hidden", cursor: "pointer",
        transition: "border-color 0.15s ease", padding: 0,
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-focus)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
    >
      {/* Cell header */}
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "6px 10px", borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          {ANGLE_LABELS[angle]}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: badgeColor, fontWeight: 600,
        }}>
          {pct !== null ? `${pct.toFixed(1)}%` : "—"}
        </span>
      </div>

      {/* Canvas */}
      <div style={{
        flex: 1, background: "var(--bg-canvas)",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {result ? (
          <canvas
            ref={canvasRef}
            style={{ width: "100%", height: "auto", display: "block" }}
          />
        ) : (
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-dim)",
          }}>
            computing…
          </span>
        )}
      </div>
    </button>
  );
}

// ─── Grid view ───────────────────────────────────────────────────────────────

export default function AllAnglesView() {
  const diffResults = useDiffStore((s) => s.diffResults);
  const [expandedAngle, setExpandedAngle] = useState<CameraAngle | null>(null);

  if (!diffResults.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", fontFamily: "var(--font-mono)", fontSize: 13,
        color: "var(--text-dim)",
      }}>
        Load two models to compare all angles.
      </div>
    );
  }

  if (expandedAngle !== null) {
    return (
      <PixelDiffView
        initialAngle={expandedAngle}
        onClose={() => setExpandedAngle(null)}
      />
    );
  }

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gridTemplateRows: "repeat(2, 1fr)",
      gap: 8, padding: 12,
      width: "100%", height: "100%",
      boxSizing: "border-box",
    }}>
      {CAMERA_ANGLE_ORDER.map((angle) => (
        <AngleCell
          key={angle}
          angle={angle}
          result={diffResults.find((r) => r.angle === angle)}
          onClick={() => setExpandedAngle(angle)}
        />
      ))}
    </div>
  );
}

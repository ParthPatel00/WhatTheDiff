"use client";

import { useEffect, useRef, useState } from "react";
import { useDiffStore } from "@/stores/diffStore";
import { CAMERA_ANGLE_ORDER } from "@/lib/cameraPresets";
import { CameraAngle } from "@/lib/types";

const RENDER_SIZE = 1024;

const ANGLE_LABELS: Record<CameraAngle, string> = {
  [CameraAngle.Front]: "Front",
  [CameraAngle.Back]: "Back",
  [CameraAngle.Left]: "Left",
  [CameraAngle.Right]: "Right",
  [CameraAngle.Top]: "Top",
  [CameraAngle.ThreeQuarter]: "3/4",
};

interface Props {
  /** When set (e.g. from AllAnglesView), keeps the view on this angle. */
  initialAngle?: CameraAngle;
  onClose?: () => void;
}

export default function PixelDiffView({ initialAngle, onClose }: Props) {
  const diffResults = useDiffStore((s) => s.diffResults);

  const [angleIndex, setAngleIndex] = useState(() => {
    if (initialAngle !== undefined) return CAMERA_ANGLE_ORDER.indexOf(initialAngle);
    return 0;
  });

  // Sync if parent changes initialAngle (AllAnglesView cell selection)
  useEffect(() => {
    if (initialAngle !== undefined) {
      const idx = CAMERA_ANGLE_ORDER.indexOf(initialAngle);
      if (idx !== -1) setAngleIndex(idx);
    }
  }, [initialAngle]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentAngle = CAMERA_ANGLE_ORDER[angleIndex];
  const result = diffResults.find((r) => r.angle === currentAngle);

  // Draw diff onto canvas whenever the active result changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = RENDER_SIZE;
    canvas.height = RENDER_SIZE;

    // Avoid the Uint8ClampedArray generic TS issue by using ImageData.data.set
    const imageData = new ImageData(RENDER_SIZE, RENDER_SIZE);
    imageData.data.set(result.diff);
    ctx.putImageData(imageData, 0, 0);
  }, [result]);

  // Arrow key navigation — document-level so the user doesn't need to click first
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        setAngleIndex((i) => (i - 1 + CAMERA_ANGLE_ORDER.length) % CAMERA_ANGLE_ORDER.length);
      } else if (e.key === "ArrowRight") {
        setAngleIndex((i) => (i + 1) % CAMERA_ANGLE_ORDER.length);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  if (!diffResults.length) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100%", fontFamily: "var(--font-mono)", fontSize: 13,
        color: "var(--text-dim)",
      }}>
        Load two models to see the pixel diff.
      </div>
    );
  }

  const pct = result?.pct ?? 0;
  const badgeColor = pct < 1 ? "var(--green)" : pct > 50 ? "var(--red)" : "var(--yellow)";

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", background: "var(--bg-surface)",
        borderBottom: "1px solid var(--border)", flexShrink: 0,
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text)" }}>
          {ANGLE_LABELS[currentAngle]}
        </span>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 12,
            color: badgeColor, fontWeight: 600,
          }}>
            {pct.toFixed(1)}% changed
          </span>
          {onClose && (
            <button
              aria-label="Close expanded view"
              onClick={onClose}
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: "var(--text-muted)", fontSize: 18, lineHeight: 1,
                padding: "0 2px",
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Canvas area */}
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", position: "relative",
        background: "var(--bg-elevated)",
      }}>
        <canvas
          ref={canvasRef}
          aria-label={`Pixel diff for ${ANGLE_LABELS[currentAngle]} angle`}
          style={{ maxWidth: "100%", height: "auto", display: "block" }}
        />
        <span style={{
          position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)",
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)",
          pointerEvents: "none",
        }}>
          ← → to cycle angles
        </span>
      </div>

      {/* Dot navigation */}
      <div style={{
        display: "flex", justifyContent: "center", alignItems: "center",
        gap: 8, padding: "10px 16px", background: "var(--bg-surface)",
        borderTop: "1px solid var(--border)", flexShrink: 0,
      }}>
        {CAMERA_ANGLE_ORDER.map((angle, i) => {
          const r = diffResults.find((d) => d.angle === angle);
          const dotColor = !r ? "var(--border)"
            : r.pct < 1 ? "var(--green)"
            : r.pct > 50 ? "var(--red)"
            : "var(--yellow)";
          return (
            <button
              key={angle}
              aria-label={`${ANGLE_LABELS[angle]}: ${r?.pct.toFixed(1) ?? "—"}% changed`}
              onClick={() => setAngleIndex(i)}
              title={`${ANGLE_LABELS[angle]} — ${r?.pct.toFixed(1) ?? "—"}%`}
              style={{
                width: i === angleIndex ? 10 : 8,
                height: i === angleIndex ? 10 : 8,
                borderRadius: "50%",
                background: i === angleIndex ? dotColor : "var(--bg-elevated)",
                border: `2px solid ${dotColor}`,
                cursor: "pointer",
                padding: 0,
                transition: "all 0.15s ease",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

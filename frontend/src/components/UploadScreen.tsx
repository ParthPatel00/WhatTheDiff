"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useDiffStore } from "@/stores/diffStore";
import { useDiffResults } from "@/hooks/useDiffResults";
import { Header } from "./Header";
import { FileUpload } from "./FileUpload";

const AllAnglesView = dynamic(() => import("@/components/AllAnglesView"), { ssr: false });
const PixelDiffView = dynamic(() => import("@/components/PixelDiffView"), { ssr: false });

export function UploadScreen() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const bothLoaded = !!modelA && !!modelB;

  // Kick off renders + diffs whenever models or tolerance change
  useDiffResults();

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Header />

      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
      }}>
        {bothLoaded ? (
          <DiffTestArea />
        ) : (
          <>
            {/* Title */}
            <div style={{ textAlign: "center", marginBottom: 40 }}>
              <h1 style={{
                fontFamily: "var(--font-mono)",
                fontSize: 22,
                fontWeight: 700,
                color: "var(--text)",
                margin: 0,
                letterSpacing: -0.3,
              }}>
                Visual diff for 3D models
              </h1>
              <p style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-muted)",
                marginTop: 8,
              }}>
                Upload two GLB files to see what changed. Fully client-side, nothing leaves your browser.
              </p>
            </div>

            {/* Drop zones */}
            <div style={{ width: "100%", maxWidth: 720 }}>
              <FileUpload />
            </div>

            {/* Keyboard shortcuts hint */}
            <div style={{
              marginTop: 40,
              padding: "12px 20px",
              background: "var(--bg-surface)",
              borderRadius: 6,
              border: "1px solid var(--border)",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text-dim)",
              display: "flex",
              gap: 20,
            }}>
              <span>
                <kbd style={{
                  padding: "1px 5px",
                  background: "var(--bg-elevated)",
                  borderRadius: 3,
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}>1-5</kbd>
                {" "}switch modes
              </span>
              <span>
                <kbd style={{
                  padding: "1px 5px",
                  background: "var(--bg-elevated)",
                  borderRadius: 3,
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}>S</kbd>
                {" "}toggle sync
              </span>
              <span>
                <kbd style={{
                  padding: "1px 5px",
                  background: "var(--bg-elevated)",
                  borderRadius: 3,
                  border: "1px solid var(--border)",
                  color: "var(--text-muted)",
                }}>← →</kbd>
                {" "}step angles
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Temporary test area (Phase 4 will replace this with the real layout) ───

type TestView = "all-angles" | "pixel-diff";

function DiffTestArea() {
  const tolerance = useDiffStore((s) => s.tolerance);
  const setTolerance = useDiffStore((s) => s.setTolerance);
  const diffResults = useDiffStore((s) => s.diffResults);
  const [view, setView] = useState<TestView>("all-angles");

  return (
    <div style={{ width: "100%", maxWidth: 960, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Controls strip */}
      <div style={{
        display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap",
        padding: "10px 16px", background: "var(--bg-surface)",
        border: "1px solid var(--border)", borderRadius: 6,
      }}>
        {/* View toggle */}
        <div style={{ display: "flex", gap: 6 }}>
          {(["all-angles", "pixel-diff"] as TestView[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, padding: "4px 10px",
                borderRadius: 4, cursor: "pointer", border: "1px solid var(--border)",
                background: view === v ? "var(--bg-elevated)" : "transparent",
                color: view === v ? "var(--text)" : "var(--text-muted)",
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Tolerance slider */}
        <label style={{ display: "flex", alignItems: "center", gap: 8,
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
          tolerance
          <input
            type="range" min={0} max={100} value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            aria-label="Pixel diff tolerance"
            style={{ width: 120, accentColor: "var(--accent)" }}
          />
          <span style={{ color: "var(--text)", minWidth: 24 }}>{tolerance}</span>
        </label>

        {/* Status */}
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11,
          color: diffResults.length ? "var(--green)" : "var(--text-dim)",
          marginLeft: "auto" }}>
          {diffResults.length ? `${diffResults.length}/6 angles computed` : "computing…"}
        </span>
      </div>

      {/* View area */}
      <div style={{
        width: "100%", height: 600,
        background: "var(--bg-canvas)", border: "1px solid var(--border)", borderRadius: 6,
        overflow: "hidden",
      }}>
        {view === "all-angles" ? <AllAnglesView /> : <PixelDiffView />}
      </div>
    </div>
  );
}

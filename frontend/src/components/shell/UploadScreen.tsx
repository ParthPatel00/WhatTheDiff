"use client";

import dynamic from "next/dynamic";
import { useDiffStore } from "@/stores/diffStore";
import { useDiffResults } from "@/hooks/useDiffResults";
import { Header } from "./Header";
import { FileUpload } from "./FileUpload";

const ViewerLayout = dynamic(
  () => import("./ViewerLayout").then((m) => m.ViewerLayout),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);

export function UploadScreen() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const bothLoaded = !!modelA && !!modelB;

  // Kick off offscreen renders + diffs whenever models or tolerance change
  useDiffResults();

  if (bothLoaded) {
    return (
      <div style={{ background: "var(--bg)", height: "100vh", display: "flex", flexDirection: "column" }}>
        <Header />
        <ViewerLayout />
      </div>
    );
  }

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
          {[
            { key: "1-5", desc: "switch modes" },
            { key: "S", desc: "toggle sync" },
            { key: "← →", desc: "step angles" },
          ].map(({ key, desc }) => (
            <span key={key}>
              <kbd style={{
                padding: "1px 5px",
                background: "var(--bg-elevated)",
                borderRadius: 3,
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}>{key}</kbd>
              {" "}{desc}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

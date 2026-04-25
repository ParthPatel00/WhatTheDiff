"use client";

import { useDiffStore } from "@/stores/diffStore";
import { Header } from "./Header";
import { FileUpload } from "./FileUpload";

export function UploadScreen() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const bothLoaded = !!modelA && !!modelB;

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
          <BothLoadedPlaceholder />
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

function BothLoadedPlaceholder() {
  return (
    <div style={{
      width: "100%",
      maxWidth: 720,
      padding: "32px",
      background: "var(--bg-surface)",
      border: "1px solid var(--border)",
      borderRadius: 8,
      textAlign: "center",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 12,
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        background: "rgba(80, 220, 100, 0.1)",
        border: "2px solid rgba(80, 220, 100, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        Both models loaded
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-muted)" }}>
        View modes and diff controls will appear here in Phase 4.
      </p>
    </div>
  );
}

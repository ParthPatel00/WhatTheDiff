"use client";

import { useEffect } from "react";
import { useDiffStore } from "@/stores/diffStore";

// Detect Electron at runtime via the user-agent string Electron injects.
// Browsers ignore -webkit-app-region entirely, so it's safe to include in
// web builds — but we only want the extra padding in the desktop app.
const isElectron =
  typeof navigator !== "undefined" && /Electron/.test(navigator.userAgent);

export function Header() {
  const colorblindMode    = useDiffStore((s) => s.colorblindMode);
  const setColorblindMode = useDiffStore((s) => s.setColorblindMode);

  // Restore persisted colorblind preference on first mount
  useEffect(() => {
    if (localStorage.getItem("colorblindMode") === "true") {
      setColorblindMode(true);
    }
  }, [setColorblindMode]);

  function toggleColorblind() {
    const next = !colorblindMode;
    setColorblindMode(next);
    localStorage.setItem("colorblindMode", String(next));
  }

  return (
    <div style={{
      padding: "12px 24px",
      // In Electron: push content right so the logo clears the traffic lights
      paddingLeft: isElectron ? 88 : 24,
      borderBottom: "1px solid var(--border)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      background: "var(--bg)", flexShrink: 0,
      // Make the header bar draggable in Electron — browsers ignore this
      ...( isElectron && { WebkitAppRegion: "drag" } as React.CSSProperties ),
    }}>
      {/* Left: logo + name + version */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2">
          <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
        </svg>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 15,
          fontWeight: 700, color: "var(--text)", letterSpacing: 0.5,
        }}>
          WhatTheDiff
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--text-dim)", marginLeft: 4,
        }}>
          v0.1.0
        </span>
      </div>

      {/* Right: colorblind toggle, docs, github */}
      <div style={{
        display: "flex", alignItems: "center", gap: 16,
        // Ensure buttons/links stay clickable inside the drag region
        ...( isElectron && { WebkitAppRegion: "no-drag" } as React.CSSProperties ),
      }}>
        <button
          onClick={toggleColorblind}
          aria-label={colorblindMode ? "Disable colorblind mode" : "Enable colorblind mode"}
          title="Toggle colorblind-safe palette"
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: colorblindMode ? "var(--accent)" : "var(--text-muted)",
            background: colorblindMode ? "rgba(80, 220, 100, 0.08)" : "none",
            border: `1px solid ${colorblindMode ? "rgba(80, 220, 100, 0.3)" : "transparent"}`,
            cursor: "pointer", display: "flex", alignItems: "center", gap: 5,
            padding: "4px 10px", borderRadius: 4,
            transition: "all 0.15s ease",
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          colorblind
        </button>

        <a href="#" style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-muted)", textDecoration: "none",
        }}>
          docs
        </a>
        <a
          href="https://github.com/ParthPatel00/WhatTheDiff"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-muted)", textDecoration: "none",
          }}
        >
          github
        </a>
      </div>
    </div>
  );
}

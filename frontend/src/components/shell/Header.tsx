"use client";

import { useGitHubStore } from "@/stores/githubStore";

const isElectron =
  typeof navigator !== "undefined" && /Electron/.test(navigator.userAgent);

export function Header() {
  const panelOpen    = useGitHubStore((s) => s.panelOpen);
  const togglePanel  = useGitHubStore((s) => s.togglePanel);

  return (
    <div
      style={{
        height: 36,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "stretch",
        flexShrink: 0,
        paddingLeft: isElectron ? 80 : 0,
        ...(isElectron && { WebkitAppRegion: "drag" } as React.CSSProperties),
      }}
    >
      {/* ── App identity ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "0 14px",
        borderRight: "1px solid var(--border)",
        flexShrink: 0,
        ...(isElectron && { WebkitAppRegion: "no-drag" } as React.CSSProperties),
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round">
          <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
        </svg>
        <span style={{
          fontFamily: "var(--font-sans)",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: 0.2,
          userSelect: "none",
        }}>
          WhatTheDiff
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-dim)",
          userSelect: "none",
          marginTop: 1,
        }}>
          v0.1.0
        </span>
      </div>

      {/* ── Spacer ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1 }} />

      {/* ── Right toolbar group ──────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "stretch",
        ...(isElectron && { WebkitAppRegion: "no-drag" } as React.CSSProperties),
      }}>

        <ToolbarLink href="#" title="Documentation">Docs</ToolbarLink>
        <ToolbarLink
          href="https://github.com/ParthPatel00/WhatTheDiff"
          target="_blank"
          rel="noopener noreferrer"
          title="View on GitHub"
        >
          GitHub
        </ToolbarLink>

        <VSep />

        {/* GitHub Repos panel toggle */}
        <ToolbarBtn
          onClick={togglePanel}
          active={panelOpen}
          title={panelOpen ? "Close GitHub Repos panel" : "Open GitHub Repos panel"}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span>Repos</span>
        </ToolbarBtn>
      </div>
    </div>
  );
}

// ── Toolbar primitives ───────────────────────────────────────────────────────

function ToolbarBtn({
  children, onClick, active = false, title, "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
  title?: string;
  "aria-label"?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      style={{
        display: "flex", alignItems: "center", gap: 5,
        padding: "0 12px",
        fontFamily: "var(--font-sans)", fontSize: 11,
        color: active ? "var(--accent)" : "var(--text-muted)",
        background: active ? "rgba(24,120,204,0.15)" : "transparent",
        border: "none",
        borderLeft: active ? "2px solid var(--accent)" : "2px solid transparent",
        cursor: "pointer",
        transition: "background 0.1s, color 0.1s",
        height: "100%",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.05)";
          e.currentTarget.style.color = "var(--text)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = active ? "rgba(24,120,204,0.15)" : "transparent";
        e.currentTarget.style.color = active ? "var(--accent)" : "var(--text-muted)";
      }}
    >
      {children}
    </button>
  );
}

function ToolbarLink({
  href, target, rel, title, children,
}: {
  href: string; target?: string; rel?: string; title?: string; children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      title={title}
      style={{
        display: "flex", alignItems: "center",
        padding: "0 12px",
        fontFamily: "var(--font-sans)", fontSize: 11,
        color: "var(--text-muted)",
        textDecoration: "none",
        height: "100%",
        transition: "background 0.1s, color 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--text-muted)";
      }}
    >
      {children}
    </a>
  );
}

function VSep() {
  return (
    <div style={{
      width: 1,
      background: "var(--border)",
      margin: "6px 2px",
      flexShrink: 0,
    }} />
  );
}

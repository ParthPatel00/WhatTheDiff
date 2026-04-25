"use client";

export function Header() {
  return (
    <div style={{
      padding: "20px 24px",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      background: "var(--bg)",
    }}>
      {/* Left: logo + name + version */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2">
          <path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z" />
        </svg>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--text)",
          letterSpacing: 0.5,
        }}>
          diffglb
        </span>
        <span style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text-dim)",
          marginLeft: 4,
        }}>
          v0.1.0
        </span>
      </div>

      {/* Right: accessibility, docs, github */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <button style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
          background: "none",
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
          </svg>
          accessibility
        </button>
        <a href="#" style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text-muted)",
          textDecoration: "none",
        }}>
          docs
        </a>
        <a
          href="https://github.com/parthpatel/WhatTheDiff"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-muted)",
            textDecoration: "none",
          }}
        >
          github
        </a>
      </div>
    </div>
  );
}

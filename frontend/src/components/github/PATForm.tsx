"use client";

import { useState } from "react";
import { validatePat } from "@/lib/github";
import { useGitHubStore } from "@/stores/githubStore";

export function PATForm() {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setPat = useGitHubStore((s) => s.setPat);

  async function connect() {
    const pat = value.trim();
    if (!pat) return;
    setLoading(true);
    setError(null);
    try {
      const { login } = await validatePat(pat);
      setPat(pat, login);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-dim)", margin: "0 0 10px", lineHeight: 1.6,
        }}>
          Create a{" "}
          <a
            href="https://github.com/settings/tokens/new?scopes=repo&description=WhatTheDiff"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--blue)", textDecoration: "none" }}
          >
            personal access token
          </a>
          {" "}with <code style={{ color: "var(--accent)" }}>repo</code> scope
          (or <code style={{ color: "var(--accent)" }}>public_repo</code> for public repos only).
        </p>
        <input
          type="password"
          value={value}
          onChange={(e) => { setValue(e.target.value); setError(null); }}
          onKeyDown={(e) => e.key === "Enter" && connect()}
          placeholder="ghp_..."
          autoComplete="off"
          style={{
            width: "100%",
            background: "var(--bg-elevated)",
            border: `1px solid ${error ? "var(--red)" : "var(--border)"}`,
            borderRadius: 4,
            padding: "8px 10px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text)",
            outline: "none",
            boxSizing: "border-box",
          }}
        />
        {error && (
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--red)", margin: "6px 0 0",
          }}>
            {error}
          </p>
        )}
      </div>

      <button
        onClick={connect}
        disabled={!value.trim() || loading}
        style={{
          alignSelf: "flex-start",
          background: "var(--accent)",
          color: "#000",
          border: "none",
          borderRadius: 4,
          padding: "6px 14px",
          fontFamily: "var(--font-mono)",
          fontSize: 12,
          fontWeight: 600,
          cursor: loading || !value.trim() ? "not-allowed" : "pointer",
          opacity: loading || !value.trim() ? 0.5 : 1,
        }}
      >
        {loading ? "Connecting..." : "Connect"}
      </button>
    </div>
  );
}

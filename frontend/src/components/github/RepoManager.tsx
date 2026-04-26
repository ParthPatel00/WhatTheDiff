"use client";

import { useState } from "react";
import { useGitHubStore } from "@/stores/githubStore";

export function RepoManager() {
  const { username, savedRepos, addRepo, removeRepo, selectRepo, setPat } =
    useGitHubStore();
  const [showForm, setShowForm] = useState(savedRepos.length === 0);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  function handleAdd() {
    const trimmed = input.trim();
    if (!trimmed) return;
    const parts = trimmed.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      setError("Enter as owner/repo");
      return;
    }
    setError(null);
    addRepo({ owner: parts[0], repo: parts[1] });
    const key = `${parts[0]}/${parts[1]}`;
    setJustAdded(key);
    setTimeout(() => setJustAdded(null), 2000);
    setInput("");
    setShowForm(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Connected account pill */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 12px",
        background: "var(--bg-elevated)",
        borderRadius: 5,
        border: "1px solid var(--border)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--accent)", flexShrink: 0,
          }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>
            @{username}
          </span>
        </div>
        <button
          onClick={() => setPat(null, null)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-dim)", padding: "2px 4px",
          }}
        >
          Disconnect
        </button>
      </div>

      {/* Saved repos */}
      {savedRepos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {savedRepos.map((r) => {
            const key = `${r.owner}/${r.repo}`;
            const isNew = justAdded === key;
            return (
              <div
                key={key}
                onClick={() => selectRepo(r)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "9px 12px",
                  background: isNew ? "rgba(80,220,100,0.08)" : "var(--bg-surface)",
                  borderRadius: 4,
                  border: `1px solid ${isNew ? "rgba(80,220,100,0.35)" : "var(--border)"}`,
                  cursor: "pointer",
                  transition: "background 0.3s, border-color 0.3s",
                }}
              >
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text)" }}>
                  {key}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {isNew && (
                    <span style={{
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color: "var(--accent)",
                    }}>
                      added
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeRepo(r.owner, r.repo); }}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontFamily: "var(--font-mono)", fontSize: 10,
                      color: "var(--text-dim)", padding: "1px 4px",
                    }}
                  >
                    remove
                  </button>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--accent)" }}>
                    →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form — toggles on button click */}
      {showForm ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setError(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
                if (e.key === "Escape") { setShowForm(false); setInput(""); setError(null); }
              }}
              placeholder="owner/repo"
              autoFocus
              style={{
                flex: 1,
                background: "var(--bg-elevated)",
                border: `1px solid ${error ? "var(--red)" : "var(--border)"}`,
                borderRadius: 4,
                padding: "7px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text)",
                outline: "none",
                minWidth: 0,
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!input.trim()}
              style={{
                background: "var(--accent)",
                border: "none",
                borderRadius: 4,
                padding: "6px 12px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                fontWeight: 600,
                color: "#000",
                cursor: !input.trim() ? "not-allowed" : "pointer",
                opacity: !input.trim() ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              Add
            </button>
            <button
              onClick={() => { setShowForm(false); setInput(""); setError(null); }}
              style={{
                background: "none",
                border: "1px solid var(--border)",
                borderRadius: 4,
                padding: "6px 10px",
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--text-dim)",
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              ✕
            </button>
          </div>
          {error && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--red)" }}>
              {error}
            </span>
          )}
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "none",
            border: "1px dashed var(--border)",
            borderRadius: 4,
            padding: "8px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--text-dim)",
            cursor: "pointer",
            width: "100%",
          }}
        >
          <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
          Add repository
        </button>
      )}
    </div>
  );
}

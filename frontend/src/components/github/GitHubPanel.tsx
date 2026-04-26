"use client";

import { useGitHubStore } from "@/stores/githubStore";
import { PATForm } from "./PATForm";
import { RepoManager } from "./RepoManager";
import { RepoViewer } from "./RepoViewer";

// Right sidebar panel, 340px wide, sits alongside the main content.
export function GitHubPanel() {
  const { pat, selectedRepo, setPanelOpen } = useGitHubStore();

  const view = !pat ? "auth" : !selectedRepo ? "repos" : "viewer";

  return (
    <div style={{
      width: 340,
      flexShrink: 0,
      borderLeft: "1px solid var(--border)",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      height: "100%",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* GitHub mark */}
          <svg width="15" height="15" viewBox="0 0 24 24" fill="var(--text-muted)">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 12,
            fontWeight: 600, color: "var(--text)",
          }}>
            GitHub
          </span>
        </div>
        <button
          onClick={() => setPanelOpen(false)}
          aria-label="Close GitHub panel"
          style={{
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-dim)", padding: "2px 4px",
            fontFamily: "var(--font-mono)", fontSize: 14,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: 0,
      }}>
        {view === "auth" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{
              fontFamily: "var(--font-mono)", fontSize: 11,
              color: "var(--text-muted)", margin: 0, lineHeight: 1.5,
            }}>
              Connect to a GitHub repository to browse commits and pull requests
              that changed .glb models.
            </p>
            <PATForm />
          </div>
        )}

        {view === "repos" && <RepoManager />}

        {view === "viewer" && <RepoViewer />}
      </div>
    </div>
  );
}

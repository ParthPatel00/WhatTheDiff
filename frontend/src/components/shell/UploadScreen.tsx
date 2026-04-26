"use client";

import dynamic from "next/dynamic";
import { useDiffStore } from "@/stores/diffStore";
import { useGitHubStore } from "@/stores/githubStore";
import { useDiffResults } from "@/hooks/useDiffResults";
import { useUrlLoader } from "@/hooks/useUrlLoader";
import { Header } from "./Header";
import { FileUpload } from "./FileUpload";
import { GitHubPanel } from "@/components/github/GitHubPanel";

const ViewerLayout = dynamic(
  () => import("./ViewerLayout").then((m) => m.ViewerLayout),
  { ssr: false, loading: () => <div style={{ flex: 1, background: "#1e1e1e" }} /> }
);

// Shared outer shell — keeps Header + GitHub panel mounted regardless of view state.
function Shell({ children }: { children: React.ReactNode }) {
  const panelOpen = useGitHubStore((s) => s.panelOpen);

  return (
    <div style={{
      background: "var(--bg)",
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      <Header />
      {/*
        Row flex: ViewerLayout (or upload content) + GitHub panel sit side by side.
        ViewerLayout is a DIRECT child of this row so its flex:1 / height:100% chain
        resolves against the row's definite height (100vh - header), same as before.
      */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {children}
        {panelOpen && <GitHubPanel />}
      </div>
    </div>
  );
}

export function UploadScreen() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);
  const bothLoaded = !!modelA && !!modelB;

  // Kick off offscreen renders + diffs whenever models or tolerance change
  useDiffResults();
  // Load models from ?a=&b= URL params (set by the local CLI file server)
  useUrlLoader();

  if (bothLoaded) {
    return (
      <Shell>
        {/* ViewerLayout is a direct row-flex child — height chain is unbroken */}
        <ViewerLayout />
      </Shell>
    );
  }

  return (
    <Shell>
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 32px",
        overflow: "auto",
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
            Drop two GLB files below, or browse commits via the GitHub panel.
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
    </Shell>
  );
}

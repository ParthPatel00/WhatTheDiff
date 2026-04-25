"use client";

import React from "react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[diffglb] Render error:", error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <RenderErrorOverlay
            message={this.state.error?.message ?? "Unknown error"}
            onRetry={() => this.setState({ hasError: false, error: null })}
          />
        )
      );
    }
    return this.props.children;
  }
}

// Shown when a React render error is caught
function RenderErrorOverlay({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      background: "var(--bg-canvas)",
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "rgba(232, 85, 69, 0.1)",
        border: "2px solid rgba(232, 85, 69, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
        Something went wrong
      </div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        color: "var(--text-muted)",
        textAlign: "center",
        maxWidth: 320,
      }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          padding: "8px 20px",
          borderRadius: 4,
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        retry
      </button>
    </div>
  );
}

// Shown as an overlay on the canvas when WebGL context is lost.
// The parent viewer component manages `visible` state and the `onRestore` handler.
export function WebGLContextLostOverlay({ onRestore }: { onRestore: () => void }) {
  return (
    <div style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      background: "rgba(30, 30, 30, 0.92)",
      zIndex: 10,
    }}>
      <div style={{
        width: 64,
        height: 64,
        borderRadius: "50%",
        background: "rgba(232, 85, 69, 0.1)",
        border: "2px solid rgba(232, 85, 69, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
        WebGL context lost
      </div>
      <div style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        color: "var(--text-muted)",
        textAlign: "center",
        maxWidth: 320,
      }}>
        The GPU context was interrupted. This can happen from memory pressure, tab backgrounding, or driver resets.
      </div>
      <button
        onClick={onRestore}
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text)",
          background: "var(--bg-elevated)",
          border: "1px solid var(--border)",
          padding: "8px 20px",
          borderRadius: 4,
          cursor: "pointer",
          marginTop: 4,
        }}
      >
        click to restore
      </button>
    </div>
  );
}

"use client";

interface LoadingOverlayProps {
  fileName: string;
  fileSize: number;
  progress?: number;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LoadingOverlay({ fileName, fileSize, progress }: LoadingOverlayProps) {
  return (
    <div style={{
      width: 200,
      padding: 20,
      background: "var(--bg-surface)",
      borderRadius: 8,
      border: "1px solid var(--border)",
      textAlign: "center",
    }}>
      {/* Spinner */}
      <div style={{
        width: 80,
        height: 80,
        margin: "0 auto 12px",
        background: "var(--bg-canvas)",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: 24,
          height: 24,
          border: "2px solid var(--text-dim)",
          borderTopColor: "var(--accent)",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)", marginBottom: 4 }}>
        {fileName}
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
        {formatBytes(fileSize)}
      </div>

      {progress !== undefined ? (
        <div style={{ marginTop: 10 }}>
          <div style={{ height: 3, background: "var(--bg-canvas)", borderRadius: 2, overflow: "hidden" }}>
            <div style={{
              width: `${progress}%`,
              height: "100%",
              background: "var(--accent)",
              borderRadius: 2,
              transition: "width 0.1s linear",
            }} />
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-dim)", marginTop: 4 }}>
            parsing geometry...
          </div>
        </div>
      ) : (
        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", marginTop: 8 }}>
          parsed
        </div>
      )}
    </div>
  );
}

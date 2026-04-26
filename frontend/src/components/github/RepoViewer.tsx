"use client";

import { useEffect, useState, useCallback } from "react";
import { useGitHubStore } from "@/stores/githubStore";
import { useDiffStore } from "@/stores/diffStore";
import {
  listCommitsWithGlb,
  listPRsWithGlb,
  fetchGlbAtRef,
  CommitEntry,
  PREntry,
  GlbFile,
  GlbFileStatus,
} from "@/lib/github";
import { loadModel } from "@/lib/modelLoader";
import { disposeModel } from "@/lib/disposeModel";
import { getSharedRenderer } from "@/lib/sharedRenderer";

// ── helpers ───────────────────────────────────────────────────────────────────

function isLoadable(status: GlbFileStatus) {
  return status === "modified" || status === "renamed" || status === "copied";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_COLOR: Record<GlbFileStatus, string> = {
  added: "var(--green)",
  modified: "var(--text-muted)",
  removed: "var(--red)",
  renamed: "var(--blue)",
  copied: "var(--blue)",
  changed: "var(--text-muted)",
  unchanged: "var(--text-dim)",
};

const STATUS_LABEL: Record<GlbFileStatus, string> = {
  added: "added",
  modified: "modified",
  removed: "removed",
  renamed: "renamed",
  copied: "copied",
  changed: "changed",
  unchanged: "unchanged",
};

// ── model loader ──────────────────────────────────────────────────────────────

async function loadGlbPair(
  pat: string,
  owner: string,
  repo: string,
  filePath: string,
  beforeRef: string | null,
  afterRef: string
) {
  const store = useDiffStore.getState();
  store.setLoadingA(true);
  store.setLoadingB(true);
  store.setErrorA(null);
  store.setErrorB(null);

  const name = filePath.split("/").pop() ?? filePath;

  try {
    const [beforeBuf, afterBuf] = await Promise.all([
      beforeRef ? fetchGlbAtRef(pat, owner, repo, filePath, beforeRef) : Promise.resolve(null),
      fetchGlbAtRef(pat, owner, repo, filePath, afterRef),
    ]);

    const renderer = getSharedRenderer();

    const [modelBefore, modelAfter] = await Promise.all([
      beforeBuf ? loadModel(beforeBuf, renderer) : Promise.resolve(null),
      afterBuf ? loadModel(afterBuf, renderer) : Promise.resolve(null),
    ]);

    // Dispose old scenes before swapping
    const prev = useDiffStore.getState();
    if (prev.modelA) disposeModel(prev.modelA.scene);
    if (prev.modelB) disposeModel(prev.modelB.scene);

    store.setFileNameA(`${name} (before)`);
    store.setFileNameB(`${name} (after)`);
    store.setBufferA(beforeBuf);
    store.setBufferB(afterBuf);
    store.setModelA(modelBefore);
    store.setModelB(modelAfter);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Load failed.";
    store.setErrorA(msg);
    store.setErrorB(msg);
  } finally {
    const s = useDiffStore.getState();
    s.setLoadingA(false);
    s.setLoadingB(false);
  }
}

// ── sub-components ────────────────────────────────────────────────────────────

function GlbFileRow({
  file,
  onLoad,
  loadingKey,
  thisKey,
}: {
  file: GlbFile;
  onLoad: (file: GlbFile) => void;
  loadingKey: string | null;
  thisKey: string;
}) {
  const [hovered, setHovered] = useState(false);
  const loadable = isLoadable(file.status);
  const isLoading = loadingKey === thisKey;
  const blocked = !!loadingKey && !isLoading;
  const shortName = file.filename.split("/").pop() ?? file.filename;

  const notLoadableReason =
    file.status === "added" ? "new file — no previous version"
    : file.status === "removed" ? "deleted — no current version"
    : null;

  return (
    <div
      onClick={() => loadable && !loadingKey && onLoad(file)}
      onMouseEnter={() => loadable && !loadingKey && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={notLoadableReason ?? file.filename}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px",
        borderRadius: 3,
        cursor: loadable && !blocked ? "pointer" : "default",
        background: isLoading
          ? "rgba(80,220,100,0.08)"
          : hovered
          ? "var(--bg-elevated)"
          : "transparent",
        transition: "background 0.1s",
      }}
    >
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 9,
        color: STATUS_COLOR[file.status],
        textTransform: "uppercase", letterSpacing: 0.4,
        flexShrink: 0, minWidth: 52,
      }}>
        {STATUS_LABEL[file.status]}
      </span>
      <span style={{
        fontFamily: "var(--font-mono)", fontSize: 11,
        color: loadable ? "var(--text)" : "var(--text-dim)",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        flex: 1,
      }}>
        {shortName}
      </span>
      {isLoading && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: "var(--accent)", flexShrink: 0,
        }}>
          loading…
        </span>
      )}
      {loadable && !isLoading && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10,
          color: hovered ? "var(--accent)" : "var(--text-dim)",
          flexShrink: 0,
          transition: "color 0.1s",
        }}>
          Load diff →
        </span>
      )}
      {!loadable && notLoadableReason && (
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 9,
          color: "var(--text-dim)", flexShrink: 0, fontStyle: "italic",
        }}>
          {notLoadableReason}
        </span>
      )}
    </div>
  );
}

function CommitCard({
  entry,
  loadingKey,
  onLoadFile,
}: {
  entry: CommitEntry;
  loadingKey: string | null;
  onLoadFile: (file: GlbFile, beforeRef: string | null, afterRef: string) => void;
}) {
  return (
    <div style={{
      borderRadius: 5,
      border: "1px solid var(--border)",
      background: "var(--bg-surface)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
          <code style={{
            fontFamily: "var(--font-mono)", fontSize: 10,
            color: "var(--text-dim)", flexShrink: 0, marginTop: 1,
          }}>
            {entry.shortSha}
          </code>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)",
            lineHeight: 1.4, wordBreak: "break-word",
          }}>
            {entry.message}
          </span>
        </div>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
          paddingLeft: 38,
        }}>
          {entry.author} · {relativeTime(entry.date)}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", padding: "4px 2px" }}>
        {entry.glbFiles.map((f) => {
          const key = `${entry.sha}:${f.filename}`;
          return (
            <GlbFileRow
              key={f.filename}
              file={f}
              thisKey={key}
              loadingKey={loadingKey}
              onLoad={() =>
                onLoadFile(f, entry.parentSha, entry.sha)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function PRCard({
  entry,
  loadingKey,
  onLoadFile,
}: {
  entry: PREntry;
  loadingKey: string | null;
  onLoadFile: (file: GlbFile, beforeRef: string | null, afterRef: string) => void;
}) {
  const stateColor =
    entry.state === "open"
      ? "var(--green)"
      : entry.state === "merged"
      ? "var(--blue)"
      : "var(--text-dim)";

  return (
    <div style={{
      borderRadius: 5,
      border: "1px solid var(--border)",
      background: "var(--bg-surface)",
      overflow: "hidden",
    }}>
      <div style={{ padding: "8px 10px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
          <span style={{
            fontFamily: "var(--font-mono)", fontSize: 9,
            color: stateColor, flexShrink: 0, marginTop: 2,
            textTransform: "uppercase", letterSpacing: 0.3,
          }}>
            #{entry.number} {entry.state}
          </span>
        </div>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)",
          lineHeight: 1.4, display: "block", wordBreak: "break-word",
        }}>
          {entry.title}
        </span>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)",
          marginTop: 2,
        }}>
          @{entry.author} · {relativeTime(entry.date)}
        </div>
      </div>
      <div style={{ borderTop: "1px solid var(--border)", padding: "4px 2px" }}>
        {entry.glbFiles.map((f) => {
          const key = `pr${entry.number}:${f.filename}`;
          return (
            <GlbFileRow
              key={f.filename}
              file={f}
              thisKey={key}
              loadingKey={loadingKey}
              onLoad={() =>
                onLoadFile(f, entry.baseSha, entry.headSha)
              }
            />
          );
        })}
      </div>
    </div>
  );
}

// ── main component ────────────────────────────────────────────────────────────

export function RepoViewer() {
  const { pat, selectedRepo, activeTab, setActiveTab, selectRepo } =
    useGitHubStore();
  const [commits, setCommits] = useState<CommitEntry[]>([]);
  const [prs, setPRs] = useState<PREntry[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);

  const repo = selectedRepo!;

  const fetchList = useCallback(async () => {
    if (!pat || !repo) return;
    setListLoading(true);
    setListError(null);
    try {
      if (activeTab === "commits") {
        const data = await listCommitsWithGlb(pat, repo.owner, repo.repo);
        setCommits(data);
      } else {
        const data = await listPRsWithGlb(pat, repo.owner, repo.repo);
        setPRs(data);
      }
    } catch (e) {
      setListError(e instanceof Error ? e.message : "Failed to load.");
    } finally {
      setListLoading(false);
    }
  }, [pat, repo, activeTab]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  async function handleLoadFile(
    file: GlbFile,
    beforeRef: string | null,
    afterRef: string,
    cardKey: string
  ) {
    if (!pat || !isLoadable(file.status) || loadingKey) return;
    setLoadingKey(cardKey);
    try {
      await loadGlbPair(pat, repo.owner, repo.repo, file.filename, beforeRef, afterRef);
    } finally {
      setLoadingKey(null);
    }
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    fontFamily: "var(--font-mono)",
    fontSize: 11,
    color: active ? "var(--text)" : "var(--text-dim)",
    background: "none",
    border: "none",
    borderBottom: `2px solid ${active ? "var(--accent)" : "transparent"}`,
    padding: "6px 0",
    cursor: "pointer",
    transition: "color 0.15s, border-color 0.15s",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Repo header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => selectRepo(null)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-dim)", padding: "2px 0",
          }}
        >
          ←
        </button>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 12,
          color: "var(--text)", fontWeight: 600,
        }}>
          {repo.owner}/{repo.repo}
        </span>
        <button
          onClick={fetchList}
          disabled={listLoading}
          title="Refresh"
          style={{
            background: "none", border: "none", cursor: listLoading ? "default" : "pointer",
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-dim)", padding: "2px 4px",
            marginLeft: "auto", opacity: listLoading ? 0.4 : 1,
          }}
        >
          ↻
        </button>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 16, borderBottom: "1px solid var(--border)" }}>
        <button
          style={tabStyle(activeTab === "commits")}
          onClick={() => setActiveTab("commits")}
        >
          Commits
        </button>
        <button
          style={tabStyle(activeTab === "prs")}
          onClick={() => setActiveTab("prs")}
        >
          Pull Requests
        </button>
      </div>

      {/* Content */}
      {listLoading && (
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--text-dim)", margin: 0,
        }}>
          Loading…
        </p>
      )}

      {listError && (
        <p style={{
          fontFamily: "var(--font-mono)", fontSize: 11,
          color: "var(--red)", margin: 0,
        }}>
          {listError}
        </p>
      )}

      {!listLoading && !listError && activeTab === "commits" && (
        commits.length === 0 ? (
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-dim)", margin: 0,
          }}>
            No commits with .glb changes found.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {commits.map((c) => (
              <CommitCard
                key={c.sha}
                entry={c}
                loadingKey={loadingKey}
                onLoadFile={(f, before, after) =>
                  handleLoadFile(f, before, after, `${c.sha}:${f.filename}`)
                }
              />
            ))}
          </div>
        )
      )}

      {!listLoading && !listError && activeTab === "prs" && (
        prs.length === 0 ? (
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 11,
            color: "var(--text-dim)", margin: 0,
          }}>
            No pull requests with .glb changes found.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {prs.map((pr) => (
              <PRCard
                key={pr.number}
                entry={pr}
                loadingKey={loadingKey}
                onLoadFile={(f, before, after) =>
                  handleLoadFile(f, before, after, `pr${pr.number}:${f.filename}`)
                }
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

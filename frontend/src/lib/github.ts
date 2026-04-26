"use client";

const BASE = "https://api.github.com";

function ghHeaders(pat: string): HeadersInit {
  return {
    Authorization: `Bearer ${pat}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export type GlbFileStatus =
  | "added"
  | "modified"
  | "removed"
  | "renamed"
  | "copied"
  | "changed"
  | "unchanged";

export interface GlbFile {
  filename: string;
  status: GlbFileStatus;
  sha: string;
}

export interface CommitEntry {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  parentSha: string | null;
  glbFiles: GlbFile[];
}

export interface PREntry {
  number: number;
  title: string;
  author: string;
  state: "open" | "closed" | "merged";
  date: string;
  baseSha: string;
  headSha: string;
  glbFiles: GlbFile[];
}

async function ghFetch<T>(url: string, pat: string, accept?: string): Promise<T> {
  const res = await fetch(url, {
    headers: { ...ghHeaders(pat), ...(accept ? { Accept: accept } : {}) },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${msg || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function validatePat(pat: string): Promise<{ login: string }> {
  const res = await fetch(`${BASE}/user`, { headers: ghHeaders(pat) });
  if (res.status === 401) throw new Error("Invalid token — check your PAT and try again.");
  if (!res.ok) throw new Error(`GitHub returned ${res.status}`);
  const data = (await res.json()) as { login: string };
  return { login: data.login };
}

function extractGlbFiles(files: Record<string, unknown>[]): GlbFile[] {
  return files
    .filter((f) => (f.filename as string).toLowerCase().endsWith(".glb"))
    .map((f) => ({
      filename: f.filename as string,
      status: f.status as GlbFileStatus,
      sha: f.sha as string,
    }));
}

export async function listCommitsWithGlb(
  pat: string,
  owner: string,
  repo: string
): Promise<CommitEntry[]> {
  type RawListItem = { sha: string };
  const list = await ghFetch<RawListItem[]>(
    `${BASE}/repos/${owner}/${repo}/commits?per_page=50`,
    pat
  );

  const results: CommitEntry[] = [];
  const BATCH = 8;

  for (let i = 0; i < list.length && results.length < 20; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const details = await Promise.all(
      batch.map((c) =>
        ghFetch<Record<string, unknown>>(
          `${BASE}/repos/${owner}/${repo}/commits/${c.sha}`,
          pat
        )
      )
    );

    for (const d of details) {
      const files = (d.files as Record<string, unknown>[] | undefined) ?? [];
      const glbFiles = extractGlbFiles(files);
      if (glbFiles.length === 0) continue;

      const commit = d.commit as Record<string, unknown>;
      const author = commit.author as Record<string, unknown>;
      const parents = (d.parents as { sha: string }[]) ?? [];

      results.push({
        sha: d.sha as string,
        shortSha: (d.sha as string).slice(0, 7),
        message: (commit.message as string).split("\n")[0],
        author: (author?.name as string) ?? "Unknown",
        date: (author?.date as string) ?? "",
        parentSha: parents[0]?.sha ?? null,
        glbFiles,
      });
    }
  }

  return results;
}

export async function listPRsWithGlb(
  pat: string,
  owner: string,
  repo: string
): Promise<PREntry[]> {
  type RawPR = {
    number: number;
    title: string;
    state: string;
    merged_at: string | null;
    updated_at: string;
    user: { login: string };
    base: { sha: string };
    head: { sha: string };
  };

  const list = await ghFetch<RawPR[]>(
    `${BASE}/repos/${owner}/${repo}/pulls?state=all&per_page=30&sort=updated`,
    pat
  );

  const results: PREntry[] = [];
  const BATCH = 8;

  for (let i = 0; i < list.length && results.length < 20; i += BATCH) {
    const batch = list.slice(i, i + BATCH);
    const fileDetails = await Promise.all(
      batch.map((pr) =>
        ghFetch<Record<string, unknown>[]>(
          `${BASE}/repos/${owner}/${repo}/pulls/${pr.number}/files?per_page=100`,
          pat
        ).then((files) => ({ pr, files }))
      )
    );

    for (const { pr, files } of fileDetails) {
      const glbFiles = extractGlbFiles(files);
      if (glbFiles.length === 0) continue;

      results.push({
        number: pr.number,
        title: pr.title,
        author: pr.user?.login ?? "Unknown",
        state: pr.merged_at ? "merged" : (pr.state as "open" | "closed"),
        date: pr.updated_at,
        baseSha: pr.base.sha,
        headSha: pr.head.sha,
        glbFiles,
      });
    }
  }

  return results;
}

// Returns raw bytes of a file at a specific ref, or null if the file doesn't exist there.
export async function fetchGlbAtRef(
  pat: string,
  owner: string,
  repo: string,
  filePath: string,
  ref: string
): Promise<ArrayBuffer | null> {
  const encoded = filePath.split("/").map(encodeURIComponent).join("/");
  const url = `${BASE}/repos/${owner}/${repo}/contents/${encoded}?ref=${ref}`;

  const res = await fetch(url, {
    headers: {
      ...ghHeaders(pat),
      Accept: "application/vnd.github.raw",
    },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Fetch ${filePath}@${ref.slice(0, 7)} failed: ${res.status}`);
  }
  return res.arrayBuffer();
}

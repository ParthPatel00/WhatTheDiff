#!/usr/bin/env node
"use strict";

const path = require("path");
const fs = require("fs");

// Load .env from the WhatTheDiff repo root (two dirs up from bin/)
const envPath = path.join(__dirname, "..", "..", ".env");
if (fs.existsSync(envPath)) {
  require("dotenv").config({ path: envPath });
}

const args = process.argv.slice(2);
const command = args[0];
const MAX_FILES_DEFAULT = 3;

const FILE_SERVER_PORT = 4243;
const DEFAULT_VIEWER_URL = "http://localhost:3000";

// When true, print the URL but don't auto-launch the browser.
function isNoOpen() {
  return args.includes("--no-open");
}

// Local mode: no Supabase upload. Serves GLBs from a tiny HTTP server instead.
// Auto-enabled when Supabase env vars are absent, or when --local flag is passed.
function isLocalMode() {
  return (
    args.includes("--local") ||
    !process.env.SUPABASE_PROJECT_ID ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

async function main() {
  if (command === "install-hook") {
    await installHook({ silent: args.includes("--silent") });
  } else if (command === "uninstall-hook") {
    await uninstallHook();
  } else if (command === "--hook") {
    await runHook();
  } else if (args.includes("--a") && args.includes("--b")) {
    const fileA = args[args.indexOf("--a") + 1];
    const fileB = args[args.indexOf("--b") + 1];
    await openDiff(fileA, fileB);
  } else {
    console.log([
      "Usage:",
      "  whathediff --a <file> --b <file>          Compare two local GLBs",
      "  whathediff install-hook                   Install git post-commit hook",
      "  whathediff uninstall-hook                 Remove the hook",
      "",
      "Flags:",
      "  --local           Serve files locally instead of uploading to Supabase",
      "                    (auto-enabled when Supabase env vars are not set)",
      "  --no-open         Print the diff URL instead of launching the browser",
      "  --max-files <n>   Max diffs to open per commit without prompting (default: 3)",
      "  --no-prompt       Skip the batch prompt and open all changed files",
      "",
      "Local mode needs the dev server running: cd frontend && npm run dev",
      "Set WHATHEDIFF_VIEWER_URL in .env to point to a different viewer URL.",
    ].join("\n"));
  }
}

// ── install / uninstall ──────────────────────────────────────────────────────

async function installHook({ silent = false } = {}) {
  const { execSync } = require("child_process");
  let gitRoot;
  try {
    gitRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    if (!silent) console.error("[WhatTheDiff] Not in a git repository.");
    process.exit(1);
  }

  const hooksDir = path.join(gitRoot, ".git", "hooks");
  const hookPath = path.join(hooksDir, "post-commit");
  const cliPath = path.resolve(__filename);
  const envFilePath = path.resolve(path.join(__dirname, "..", "..", ".env"));

  const noOpen = args.includes("--no-open") ? " --no-open" : "";
  const hookBlock = [
    "# >>> WhatTheDiff",
    `[ -f "${envFilePath}" ] && set -a && . "${envFilePath}" && set +a`,
    `node "${cliPath}" --hook${noOpen}`,
    "# <<< WhatTheDiff",
  ].join("\n");

  fs.mkdirSync(hooksDir, { recursive: true });

  if (fs.existsSync(hookPath)) {
    const existing = fs.readFileSync(hookPath, "utf8");
    if (existing.includes("# >>> WhatTheDiff")) {
      if (!silent) console.log("[WhatTheDiff] Hook already installed.");
      return;
    }
    fs.appendFileSync(hookPath, `\n${hookBlock}\n`);
  } else {
    fs.writeFileSync(hookPath, `#!/bin/sh\n${hookBlock}\n`);
  }

  fs.chmodSync(hookPath, 0o755);
  if (!silent) console.log(`[WhatTheDiff] Hook installed at ${hookPath}`);
}

async function uninstallHook() {
  const { execSync } = require("child_process");
  let gitRoot;
  try {
    gitRoot = execSync("git rev-parse --show-toplevel", { encoding: "utf8" }).trim();
  } catch {
    console.error("[WhatTheDiff] Not in a git repository.");
    process.exit(1);
  }

  const hookPath = path.join(gitRoot, ".git", "hooks", "post-commit");
  if (!fs.existsSync(hookPath)) {
    console.log("[WhatTheDiff] No post-commit hook found.");
    return;
  }

  const content = fs.readFileSync(hookPath, "utf8");
  if (!content.includes("# >>> WhatTheDiff")) {
    console.log("[WhatTheDiff] WhatTheDiff is not installed in this hook.");
    return;
  }

  // Remove the WhatTheDiff block (everything between >>> and <<< markers, inclusive)
  const cleaned = content
    .replace(/\n# >>> WhatTheDiff[\s\S]*?# <<< WhatTheDiff\n?/g, "")
    .trimEnd();

  if (!cleaned || cleaned === "#!/bin/sh") {
    fs.unlinkSync(hookPath);
    console.log("[WhatTheDiff] Hook file removed.");
  } else {
    fs.writeFileSync(hookPath, cleaned + "\n");
    console.log("[WhatTheDiff] WhatTheDiff removed from existing post-commit hook.");
  }
}

// ── post-commit hook entry ────────────────────────────────────────────────────

async function runHook() {
  const { getChangedGlbFiles, extractFromGit } = require("../src/git.js");

  const changed = getChangedGlbFiles();
  if (changed.length === 0) return;

  const maxFiles = parseInt(
    args[args.indexOf("--max-files") + 1] || String(MAX_FILES_DEFAULT)
  );
  const noPrompt = args.includes("--no-prompt");

  let toProcess = changed;

  if (changed.length > maxFiles && !noPrompt) {
    toProcess = await batchPrompt(changed, maxFiles);
    if (toProcess.length === 0) {
      console.log("[WhatTheDiff] Skipped.");
      return;
    }
  } else if (changed.length > maxFiles && noPrompt) {
    toProcess = changed; // --no-prompt opens all
    console.log(
      `[WhatTheDiff] ${changed.length} GLB files changed — opening all (--no-prompt).`
    );
  }

  for (const file of toProcess) {
    if (file.status === "A") {
      console.log(
        `[WhatTheDiff] Skipping ${file.path} (new file — no previous version to diff)`
      );
      continue;
    }
    if (file.status === "D") {
      console.log(`[WhatTheDiff] Skipping ${file.path} (deleted)`);
      continue;
    }

    console.log(`[WhatTheDiff] Diffing ${file.path}...`);
    try {
      const { oldBuf, newBuf } = extractFromGit(file.path);
      const base = path.basename(file.path, ".glb");
      const nameA = `${base}_before.glb`;
      const nameB = `${base}_after.glb`;

      if (isLocalMode()) {
        await serveAndOpen(
          { data: Buffer.from(oldBuf), name: nameA },
          { data: Buffer.from(newBuf), name: nameB },
        );
      } else {
        const { uploadGlb } = require("../src/supabase.js");
        const { urlA, urlB } = await uploadGlb(file.path, oldBuf, newBuf);
        const viewerUrl = buildViewerUrl(urlA, urlB, nameA, nameB);
        console.log(`[WhatTheDiff] Diff ready: ${viewerUrl}`);
        if (!isNoOpen()) openBrowser(viewerUrl);
      }
    } catch (err) {
      console.error(`[WhatTheDiff] Error processing ${file.path}: ${err.message}`);
    }
  }
}

// ── direct --a / --b usage ────────────────────────────────────────────────────

async function openDiff(fileA, fileB) {
  if (!fs.existsSync(fileA)) { console.error(`[WhatTheDiff] File not found: ${fileA}`); process.exit(1); }
  if (!fs.existsSync(fileB)) { console.error(`[WhatTheDiff] File not found: ${fileB}`); process.exit(1); }

  if (isLocalMode()) {
    const nameA = path.basename(fileA);
    const nameB = path.basename(fileB);
    await serveAndOpen(
      { data: fs.readFileSync(fileA), name: nameA },
      { data: fs.readFileSync(fileB), name: nameB },
    );
    return;
  }

  const { uploadGlb } = require("../src/supabase.js");
  console.log("[WhatTheDiff] Uploading...");
  const rawA = fs.readFileSync(fileA);
  const rawB = fs.readFileSync(fileB);
  const bufA = rawA.buffer.slice(rawA.byteOffset, rawA.byteOffset + rawA.byteLength);
  const bufB = rawB.buffer.slice(rawB.byteOffset, rawB.byteOffset + rawB.byteLength);
  const { urlA, urlB, nameA, nameB } = await uploadGlb(path.basename(fileA), bufA, bufB);
  const viewerUrl = buildViewerUrl(urlA, urlB, nameA, nameB);
  console.log(`[WhatTheDiff] Diff ready: ${viewerUrl}`);
  if (!isNoOpen()) openBrowser(viewerUrl);
}

// ── helpers ───────────────────────────────────────────────────────────────────

/**
 * Prompts the user when more than --max-files GLBs changed in one commit.
 * Returns the subset of files to process.
 *   y    → open all
 *   N/'' → open none
 *   pick → ask yes/no per file
 */
async function batchPrompt(files, maxFiles) {
  const readline = require("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((res) => rl.question(q, res));

  console.log(`[WhatTheDiff] ${files.length} GLB files changed (limit: ${maxFiles}).`);
  files.forEach((f, i) => console.log(`  ${i + 1}. ${f.path}`));

  const answer = (await ask("[WhatTheDiff] Open diffs? [y/N/pick] ")).trim().toLowerCase();

  let chosen = [];
  if (answer === "y") {
    chosen = files;
  } else if (answer === "pick") {
    for (const file of files) {
      const a = (await ask(`  Diff ${file.path}? [y/N] `)).trim().toLowerCase();
      if (a === "y") chosen.push(file);
    }
  }
  // N or empty → chosen stays []

  rl.close();
  return chosen;
}

/**
 * Starts a local HTTP server serving two GLB buffers, opens the local viewer,
 * and keeps the process alive until the user presses Ctrl+C.
 */
async function serveAndOpen(fileA, fileB) {
  const http = require("http");

  const routes = {
    "/a.glb": fileA.data,
    "/b.glb": fileB.data,
  };

  const server = http.createServer((req, res) => {
    const data = routes[req.url];
    if (!data) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      "Content-Type": "model/gltf-binary",
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Content-Length": data.length,
    });
    res.end(data);
  });

  await new Promise((resolve, reject) =>
    server.listen(FILE_SERVER_PORT, resolve).on("error", reject)
  );

  const viewerBase = process.env.WHATHEDIFF_VIEWER_URL ?? DEFAULT_VIEWER_URL;
  const params = new URLSearchParams({
    a: `http://localhost:${FILE_SERVER_PORT}/a.glb`,
    b: `http://localhost:${FILE_SERVER_PORT}/b.glb`,
    nameA: fileA.name,
    nameB: fileB.name,
  });
  const viewerUrl = `${viewerBase}?${params}`;

  console.log(`[WhatTheDiff] Diff ready: ${viewerUrl}`);
  if (isNoOpen()) {
    console.log(`[WhatTheDiff] Open the URL above in your browser when ready.`);
  } else {
    openBrowser(viewerUrl);
  }
  console.log(`[WhatTheDiff] File server running on port ${FILE_SERVER_PORT} — press Ctrl+C to stop.`);

  // Keep alive until killed
  await new Promise(() => {});
}

function buildViewerUrl(urlA, urlB, nameA, nameB) {
  const base =
    process.env.WHATHEDIFF_VIEWER_URL ?? "https://what-the-diff.vercel.app";
  const params = new URLSearchParams({ a: urlA, b: urlB, nameA, nameB });
  return `${base}?${params.toString()}`;
}

function openBrowser(url) {
  const { spawn } = require("child_process");
  const cmds = {
    darwin: ["open", [url]],
    win32: ["cmd", ["/c", "start", "", url]],
    linux: ["xdg-open", [url]],
  };
  const [cmd, cmdArgs] = cmds[process.platform] ?? cmds.linux;
  spawn(cmd, cmdArgs, { detached: true, stdio: "ignore" }).unref();
}

main().catch((err) => {
  console.error("[WhatTheDiff]", err.message);
  process.exit(1);
});

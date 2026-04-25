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
      "  whathediff --a <file> --b <file>    Open viewer comparing two local GLBs",
      "  whathediff install-hook             Install git post-commit hook in CWD repo",
      "  whathediff uninstall-hook           Remove the hook",
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

  const hookBlock = [
    "# >>> WhatTheDiff",
    `set -a; . "${envFilePath}"; set +a`,
    `node "${cliPath}" --hook`,
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
  const { uploadGlb } = require("../src/supabase.js");

  const changed = getChangedGlbFiles();
  if (changed.length === 0) return;

  const maxFiles = parseInt(
    args[args.indexOf("--max-files") + 1] || String(MAX_FILES_DEFAULT)
  );
  const toProcess = changed.slice(0, maxFiles);

  if (changed.length > maxFiles) {
    console.log(
      `[WhatTheDiff] ${changed.length} GLB files changed — opening first ${maxFiles}.`
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
      const { urlA, urlB, nameA, nameB } = await uploadGlb(file.path, oldBuf, newBuf);
      const viewerUrl = buildViewerUrl(urlA, urlB, nameA, nameB);
      openBrowser(viewerUrl);
      console.log(`[WhatTheDiff] Opened: ${viewerUrl}`);
    } catch (err) {
      console.error(`[WhatTheDiff] Error processing ${file.path}: ${err.message}`);
    }
  }
}

// ── direct --a / --b usage ────────────────────────────────────────────────────

async function openDiff(fileA, fileB) {
  const { uploadGlb } = require("../src/supabase.js");

  if (!fs.existsSync(fileA)) {
    console.error(`[WhatTheDiff] File not found: ${fileA}`);
    process.exit(1);
  }
  if (!fs.existsSync(fileB)) {
    console.error(`[WhatTheDiff] File not found: ${fileB}`);
    process.exit(1);
  }

  console.log("[WhatTheDiff] Uploading...");
  const rawA = fs.readFileSync(fileA);
  const rawB = fs.readFileSync(fileB);
  const bufA = rawA.buffer.slice(rawA.byteOffset, rawA.byteOffset + rawA.byteLength);
  const bufB = rawB.buffer.slice(rawB.byteOffset, rawB.byteOffset + rawB.byteLength);

  const { urlA, urlB, nameA, nameB } = await uploadGlb(
    path.basename(fileA),
    bufA,
    bufB
  );
  const viewerUrl = buildViewerUrl(urlA, urlB, nameA, nameB);
  openBrowser(viewerUrl);
  console.log(`[WhatTheDiff] Opened: ${viewerUrl}`);
}

// ── helpers ───────────────────────────────────────────────────────────────────

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

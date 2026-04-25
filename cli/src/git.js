"use strict";

const { execSync } = require("child_process");

// Returns list of changed .glb files in the last commit.
// Each entry: { status: "M"|"A"|"D"|"R", path: string }
function getChangedGlbFiles() {
  let output;
  try {
    output = execSync("git diff --name-status HEAD~1 HEAD", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch {
    // First commit — HEAD~1 doesn't exist
    return [];
  }

  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const parts = line.split("\t");
      return { status: parts[0].charAt(0), path: parts[parts.length - 1] };
    })
    .filter((f) => f.path.toLowerCase().endsWith(".glb"));
}

// Extracts both the previous (HEAD~1) and current (HEAD) version of a file as ArrayBuffers.
function extractFromGit(filePath) {
  const oldRaw = execSync(`git show "HEAD~1:${filePath}"`, {
    maxBuffer: 500 * 1024 * 1024,
  });
  const newRaw = execSync(`git show "HEAD:${filePath}"`, {
    maxBuffer: 500 * 1024 * 1024,
  });

  // Buffer.buffer is the underlying ArrayBuffer but may be offset; slice to get a clean copy
  const toArrayBuffer = (buf) =>
    buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);

  return {
    oldBuf: toArrayBuffer(oldRaw),
    newBuf: toArrayBuffer(newRaw),
  };
}

module.exports = { getChangedGlbFiles, extractFromGit };

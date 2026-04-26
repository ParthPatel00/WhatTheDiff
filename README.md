# WhatTheDiff

**Repo:** https://github.com/ParthPatel00/WhatTheDiff

Drag-drop two 3D model files and instantly see what changed — visually and structurally. No 3D software needed. Built for game and design teams.

Native macOS desktop app. Supports `.glb` files. Runs entirely on-device — no server, no auth, no uploads.

Built at SJHacks 2026.

---

## For AI coding agents and contributors: start here

This repo has three reference documents. Read them in this order before writing code:

1. **[`SPEC.md`](./SPEC.md)** — single source of truth for what to build. Tech stack, architecture, MVP feature specs with inline code patterns, and a critical gotchas section (15 items) documenting silent-failure traps. Every implementation decision that deviates from the obvious default is justified inline.
2. **[`PHASES.md`](./PHASES.md)** — how the work is divided into independent phases. Each phase lists deliverables, dependencies, and a "done when" checklist.
3. **[`DEMO.md`](./DEMO.md)** — 2-3 minute demo script. Only relevant at the end of the build.

**If you are an AI agent implementing a phase:** read `SPEC.md` in full first, then read only the phase you are assigned in `PHASES.md`. Do not skim the gotchas section.

**If you are a human picking up work:** read `PHASES.md` first to see what's free, then consult `SPEC.md` for technical detail.

---

## Stack

Next.js 14 App Router, TypeScript, Tailwind, Three.js, gltf-transform, Zustand. See `SPEC.md` § Tech stack for version pins and rationale.

---

## Running locally (web)

The app lives under `frontend/`. All commands must be run from there.

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:3000` and drop two `.glb` files.

---

## Desktop app (Electron)

Build the Next.js app first, then run Electron against it:

```bash
cd frontend
npm run build

cd ../electron
npx electron .
```

To package a distributable macOS app:

```bash
cd electron
npm run build:mac
```

---

## CLI (local git hook)

After a `git commit` that touches `.glb` files, the hook automatically opens both versions in the local diff viewer.

**Install the hook** in any repo containing `.glb` files:

```bash
cd cli
npm install
node bin/whathediff.js install-hook
```

**Compare two files directly** (no git required):

```bash
node bin/whathediff.js --a old.glb --b new.glb
```

**Remove the hook:**

```bash
node bin/whathediff.js uninstall-hook
```

Set `WHATHEDIFF_VIEWER_URL` in `.env` to override the default viewer URL (`http://localhost:3000`).

---

## Test assets

Use [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets). DamagedHelmet is the canonical test model. See `SPEC.md` § Test models for required test cases.

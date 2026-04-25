# WhatTheDiff

**Repo:** https://github.com/ParthPatel00/WhatTheDiff

Browser-based visual diff tool for `.glb` 3D model files. Upload two versions, see what changed across five comparison modes (side-by-side, ghost overlay, pixel diff, turntable, all angles) plus a persistent structural-diff sidebar. Runs entirely client-side — no server, no auth, no uploads.

Built at SJHacks 2026.

---

## For AI coding agents and contributors: start here

This repo has three reference documents. Read them in this order before writing code:

1. **[`SPEC.md`](./SPEC.md)** — single source of truth for what to build. Tech stack, architecture, MVP feature specs with inline code patterns, and a critical gotchas section (15 items) documenting silent-failure traps. Every implementation decision that deviates from the obvious default is justified inline.
2. **[`PHASES.md`](./PHASES.md)** — how the work is divided into independent phases. Phases 0-4 are webapp MVP; Phases 5-7 are post-MVP stretch (Git integration tiers). Each phase lists deliverables, dependencies, and a "done when" checklist.
3. **[`DEMO.md`](./DEMO.md)** — 2-3 minute demo script. Only relevant at the end of the build.

**If you are an AI agent implementing a phase:** read `SPEC.md` in full first, then read only the phase you are assigned in `PHASES.md`. Do not skim the gotchas section — it exists specifically to prevent the silent-failure bugs an agent will otherwise introduce.

**If you are a human picking up work:** read `PHASES.md` first to see what's free, then consult `SPEC.md` for the technical detail of your phase.

---

## Scope

The webapp is the focus. A separate Blender plugin track is owned elsewhere and is not covered by these docs. Phases 5-7 in `PHASES.md` (`npx whathediff` CLI, GitHub Actions workflow, GitHub App inline viewer) are stretch goals past the webapp MVP.

## Stack

Next.js 14 App Router, TypeScript, Tailwind, Three.js, gltf-transform, Zustand, shadcn/ui. See `SPEC.md` § Tech stack for version pins and rationale.

## Running locally

The app lives under `frontend/`. All commands must be run from there.

```bash
cd frontend
npm install
npm run dev
```

Then open `http://localhost:3000` and drop two `.glb` files.

## CLI — local git hook (Phase 5)

After a `git commit` that touches `.glb` files, the hook automatically uploads both versions to Supabase and opens the diff viewer in your browser.

**Install the hook** in any repo that contains `.glb` files:

```bash
node /path/to/WhatTheDiff/cli/bin/whathediff.js install-hook
```

**Compare two files directly** (no git required):

```bash
node /path/to/WhatTheDiff/cli/bin/whathediff.js --a old.glb --b new.glb
```

**Remove the hook:**

```bash
node /path/to/WhatTheDiff/cli/bin/whathediff.js uninstall-hook
```

The CLI reads credentials from `.env` at the repo root (`SUPABASE_PROJECT_ID`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET_NAME`). Set `DIFFGLB_VIEWER_URL` to override the default viewer URL.

To install CLI dependencies:

```bash
cd cli
npm install
```

## Test assets

Use Khronos glTF Sample Assets (https://github.com/KhronosGroup/glTF-Sample-Assets). DamagedHelmet is the canonical test model. See `SPEC.md` § Test models for required test cases.

## Deploy

Vercel, zero config for the webapp (`vercel.json` is already configured with the required COEP/COOP headers for SharedArrayBuffer). Run `vercel` from the `frontend/` directory.

GitHub App (Phase 7) needs its own server deploy; see `SPEC.md` § Deploy.

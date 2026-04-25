# WhatTheDiff

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

The webapp is the focus. A separate Blender plugin track is owned elsewhere and is not covered by these docs. Phases 5-7 in `PHASES.md` (`npx diffglb` CLI, GitHub Actions workflow, GitHub App inline viewer) are stretch goals past the webapp MVP.

## Stack

Next.js 14 App Router, TypeScript, Tailwind, Three.js, gltf-transform, Zustand, shadcn/ui. See `SPEC.md` § Tech stack for version pins and rationale.

## Running locally

Setup commands land as part of Phase 0 (see `PHASES.md`). Once Phase 0 is in:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` and drop two `.glb` files.

## Test assets

Use Khronos glTF Sample Assets (`https://github.com/KhronosGroup/glTF-Sample-Assets`). A `scripts/` generator for modified-pair test fixtures is part of Phase 0 / early Phase 2 work. See `SPEC.md` § Test models for required test cases.

## Deploy

Vercel, zero config for the webapp. GitHub App (Phase 7) needs its own server deploy; see `SPEC.md` § Deploy.

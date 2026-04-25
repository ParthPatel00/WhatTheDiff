"use client";

import { useDiffStore } from "@/stores/diffStore";

export function BothLoadedBanner() {
  const modelA = useDiffStore((s) => s.modelA);
  const modelB = useDiffStore((s) => s.modelB);

  if (!modelA || !modelB) return null;

  return (
    <div className="rounded-xl border border-green-700 bg-green-950/40 p-4 text-center">
      <p className="text-green-400 font-medium">Both models loaded</p>
      <p className="text-zinc-400 text-sm mt-1">
        View modes and diff controls will appear here in Phase 4.
      </p>
    </div>
  );
}

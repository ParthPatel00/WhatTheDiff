import { create } from "zustand";
import type { LoadedModel, ViewMode, DiffResult, StructuralDiffResult } from "@/lib/types";

interface DiffState {
  modelA: LoadedModel | null;
  modelB: LoadedModel | null;
  bufferA: ArrayBuffer | null;
  bufferB: ArrayBuffer | null;
  loadingA: boolean;
  loadingB: boolean;
  errorA: string | null;
  errorB: string | null;
  viewMode: ViewMode;
  tolerance: number;
  opacity: number;
  cameraSynced: boolean;
  colorblindMode: boolean;
  diffResults: DiffResult[];
  structuralDiffResult: StructuralDiffResult | null;

  setModelA: (model: LoadedModel | null) => void;
  setModelB: (model: LoadedModel | null) => void;
  setBufferA: (buffer: ArrayBuffer | null) => void;
  setBufferB: (buffer: ArrayBuffer | null) => void;
  setLoadingA: (loading: boolean) => void;
  setLoadingB: (loading: boolean) => void;
  setErrorA: (error: string | null) => void;
  setErrorB: (error: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setTolerance: (tolerance: number) => void;
  setOpacity: (opacity: number) => void;
  setCameraSynced: (synced: boolean) => void;
  setColorblindMode: (enabled: boolean) => void;
  setDiffResults: (results: DiffResult[]) => void;
  setStructuralDiffResult: (result: StructuralDiffResult | null) => void;
}

export const useDiffStore = create<DiffState>((set) => ({
  modelA: null,
  modelB: null,
  bufferA: null,
  bufferB: null,
  loadingA: false,
  loadingB: false,
  errorA: null,
  errorB: null,
  viewMode: "side-by-side",
  tolerance: 10,
  opacity: 0.5,
  cameraSynced: true,
  colorblindMode: false,
  diffResults: [],
  structuralDiffResult: null,

  setModelA: (model) => set({ modelA: model }),
  setModelB: (model) => set({ modelB: model }),
  setBufferA: (buffer) => set({ bufferA: buffer }),
  setBufferB: (buffer) => set({ bufferB: buffer }),
  setLoadingA: (loading) => set({ loadingA: loading }),
  setLoadingB: (loading) => set({ loadingB: loading }),
  setErrorA: (error) => set({ errorA: error }),
  setErrorB: (error) => set({ errorB: error }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setTolerance: (tolerance) => set({ tolerance }),
  setOpacity: (opacity) => set({ opacity }),
  setCameraSynced: (synced) => set({ cameraSynced: synced }),
  setColorblindMode: (enabled) => set({ colorblindMode: enabled }),
  setDiffResults: (results) => set({ diffResults: results }),
  setStructuralDiffResult: (result) => set({ structuralDiffResult: result }),
}));

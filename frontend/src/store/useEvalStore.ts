import { create } from "zustand";
import type { KPI, EvaluationResult, ProcessingStatus, UploadedFile } from "../types";

export type Step = 1 | 2 | 3;

interface EvalStore {
  sessionId: string | null;
  currentStep: Step;
  jdText: string;
  uploadedFiles: UploadedFile[];
  batchName: string;
  suiteName: string;
  loadedSuiteId: string | null;
  loadedSuiteName: string | null;
  kpis: KPI[];
  results: EvaluationResult[];
  processingStatus: ProcessingStatus;
  selectionThreshold: number;
  setupComplete: boolean;

  setSessionId: (id: string) => void;
  setJDText: (text: string) => void;
  setUploadedFiles: (files: UploadedFile[]) => void;
  setBatchName: (name: string) => void;
  setSuiteName: (name: string) => void;
  loadSuite: (id: string, name: string) => void;
  clearLoadedSuite: () => void;
  setKPIs: (kpis: KPI[]) => void;
  updateKPIWeight: (name: string, weight: number) => void;
  updateKPI: (oldName: string, updated: KPI) => void;
  deleteKPI: (name: string) => void;
  addKPI: (kpi: KPI) => void;
  addResult: (result: EvaluationResult) => void;
  setProcessingStatus: (status: Partial<ProcessingStatus>) => void;
  setSelectionThreshold: (threshold: number) => void;
  setSetupComplete: (complete: boolean) => void;
  resetBatchState: () => void;
  goToStep: (step: Step) => void;
  reset: () => void;
}

const initialProcessing: ProcessingStatus = {
  status: "idle",
  processed: 0,
  total: 0,
  percent: 0,
};

export const useEvalStore = create<EvalStore>((set) => ({
  sessionId: null,
  currentStep: 1,
  jdText: "",
  uploadedFiles: [],
  batchName: "",
  suiteName: "",
  loadedSuiteId: null,
  loadedSuiteName: null,
  kpis: [],
  results: [],
  processingStatus: initialProcessing,
  selectionThreshold: 70,
  setupComplete: false,

  setSessionId: (id) => set({ sessionId: id }),
  setJDText: (text) => set({ jdText: text }),
  setUploadedFiles: (files) => set({ uploadedFiles: files }),
  setBatchName: (name) => set({ batchName: name }),
  setSuiteName: (name) => set({ suiteName: name }),
  loadSuite: (id, name) => set({ loadedSuiteId: id, loadedSuiteName: name, suiteName: name }),
  clearLoadedSuite: () => set({ loadedSuiteId: null, loadedSuiteName: null }),
  setKPIs: (kpis) => set({ kpis }),
  updateKPIWeight: (name, weight) =>
    set((s) => ({
      kpis: s.kpis.map((k) => (k.name === name ? { ...k, weight } : k)),
    })),
  updateKPI: (oldName, updated) =>
    set((s) => ({
      kpis: s.kpis.map((k) => (k.name === oldName ? updated : k)),
    })),
  deleteKPI: (name) =>
    set((s) => ({ kpis: s.kpis.filter((k) => k.name !== name) })),
  addKPI: (kpi) =>
    set((s) => ({ kpis: [...s.kpis, kpi] })),
  addResult: (result) => set((s) => ({ results: [...s.results, result] })),
  setProcessingStatus: (partial) =>
    set((s) => ({ processingStatus: { ...s.processingStatus, ...partial } })),
  setSelectionThreshold: (threshold) => set({ selectionThreshold: threshold }),
  setSetupComplete: (complete) => set({ setupComplete: complete }),
  resetBatchState: () =>
    set({
      uploadedFiles: [],
      batchName: "",
      results: [],
      processingStatus: initialProcessing,
    }),
  goToStep: (step) => set({ currentStep: step }),
  reset: () =>
    set({
      sessionId: null,
      currentStep: 1,
      jdText: "",
      uploadedFiles: [],
      batchName: "",
      suiteName: "",
      loadedSuiteId: null,
      loadedSuiteName: null,
      kpis: [],
      results: [],
      processingStatus: initialProcessing,
      selectionThreshold: 70,
      setupComplete: false,
    }),
}));

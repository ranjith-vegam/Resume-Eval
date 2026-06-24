import { create } from "zustand";

export type Provider = "openai" | "vllm";

export interface SettingsState {
  provider: Provider;
  openaiApiKey: string;
  openaiModel: string;
  vllmBaseUrl: string;
  vllmModel: string;
  isOpen: boolean;

  setProvider: (p: Provider) => void;
  setField: (field: keyof Omit<SettingsState, "isOpen" | "setProvider" | "setField" | "openModal" | "closeModal">, value: string) => void;
  openModal: () => void;
  closeModal: () => void;
}

export const useSettingsStore = create<SettingsState>((set) => ({
  provider: "openai",
  openaiApiKey: "",
  openaiModel: "gpt-4o",
  vllmBaseUrl: "http://localhost:8080/v1",
  vllmModel: "",
  isOpen: false,

  setProvider: (p) => set({ provider: p }),
  setField: (field, value) => set({ [field]: value }),
  openModal: () => set({ isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}));

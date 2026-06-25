import type { KPI, EvaluationResult, ResultsStats, BatchSummary } from "../types";

const BASE = "/api";

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || "Request failed");
  }
  return res.json();
}

export interface SuiteSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  jd_preview: string;
  kpi_count: number;
}

export interface Suite {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  jd_text: string;
  kpis: KPI[];
}

export const api = {
  createSession: () => req<{ session_id: string }>("/sessions", { method: "POST" }),

  uploadJD: (sessionId: string, text: string) => {
    const fd = new FormData();
    fd.append("text", text);
    return req<{ char_count: number; preview: string }>(
      `/sessions/${sessionId}/upload/jd`,
      { method: "POST", body: fd }
    );
  },

  uploadJDFile: (sessionId: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return req<{ char_count: number; preview: string }>(
      `/sessions/${sessionId}/upload/jd`,
      { method: "POST", body: fd }
    );
  },

  uploadResumes: (sessionId: string, batchName: string, files: File[]) => {
    const fd = new FormData();
    fd.append("batch_name", batchName);
    files.forEach((f) => fd.append("files", f));
    return req<{ count: number; failed: string[]; filenames: string[] }>(
      `/sessions/${sessionId}/upload/resumes`,
      { method: "POST", body: fd }
    );
  },

  checkBatchName: (name: string) =>
    req<{ valid: boolean; available: boolean }>(`/batches/check?name=${encodeURIComponent(name)}`),

  listBatches: () => req<{ batches: BatchSummary[] }>("/batches"),

  getBatch: (name: string) =>
    req<{ name: string; results: EvaluationResult[] }>(`/batches/${encodeURIComponent(name)}`),

  deleteBatch: (name: string) =>
    req<{ ok: boolean }>(`/batches/${encodeURIComponent(name)}`, { method: "DELETE" }),

  setSelection: (batchName: string, resumeId: string, selected: boolean | null) =>
    req<{ ok: boolean }>(`/batches/${encodeURIComponent(batchName)}/${resumeId}/selection`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selected }),
    }),

  exportBatchCSV: (name: string, threshold?: number) =>
    `${BASE}/batches/${encodeURIComponent(name)}/export/csv${threshold != null ? `?threshold=${threshold}` : ""}`,

  saveKPIs: (sessionId: string, kpis: KPI[], suiteName: string) =>
    req<{ ok: boolean; kpis: KPI[] }>(`/sessions/${sessionId}/kpi`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kpis, suite_name: suiteName }),
    }),

  startEvaluation: (sessionId: string) =>
    req<{ status: string; total: number }>(
      `/sessions/${sessionId}/evaluate/start`,
      { method: "POST" }
    ),

  resetBatch: (sessionId: string) =>
    req<{ ok: boolean }>(`/sessions/${sessionId}/reset-batch`, { method: "POST" }),

  getResults: (
    sessionId: string,
    sort: "score" | "name" = "score",
    order: "asc" | "desc" = "desc"
  ) =>
    req<{ results: EvaluationResult[]; stats: ResultsStats }>(
      `/sessions/${sessionId}/results?sort=${sort}&order=${order}`
    ),

  exportCSV: (sessionId: string, threshold?: number) =>
    `${BASE}/sessions/${sessionId}/export/csv${threshold != null ? `?threshold=${threshold}` : ""}`,

  getSettings: () => req<Record<string, string>>("/settings"),

  saveSettings: (body: Record<string, string>) =>
    req<{ ok: boolean }>("/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  testConnection: () =>
    req<{ ok: boolean; response: string }>("/settings/test", { method: "POST" }),

  listSuites: () => req<{ suites: SuiteSummary[] }>("/suites"),

  checkSuiteName: (name: string, excludeId?: string) =>
    req<{ available: boolean }>(
      `/suites/check?name=${encodeURIComponent(name)}${excludeId ? `&exclude_id=${excludeId}` : ""}`
    ),

  getSuite: (id: string) => req<Suite>(`/suites/${id}`),

  createSuite: (body: { name: string; jd_text: string; kpis: KPI[] }) =>
    req<Suite>("/suites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  updateSuite: (id: string, body: { name: string; jd_text: string; kpis: KPI[] }) =>
    req<Suite>(`/suites/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),

  deleteSuite: (id: string) =>
    req<{ ok: boolean }>(`/suites/${id}`, { method: "DELETE" }),
};

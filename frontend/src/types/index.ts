export interface KPI {
  name: string;
  description: string;
  weight: number;
}

export interface UploadedFile {
  name: string;
  size: number;
}

export interface EvaluationResult {
  resume_id: string;
  filename: string;
  candidate_name: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  kpi_scores: Record<string, number>;
  weighted_score: number;
  manual_selected?: boolean | null;
}

export interface ResultsStats {
  total: number;
  avg_score: number;
}

export interface BatchSummary {
  name: string;
  count: number;
  avg_score: number;
  created_at: string;
  suite_name: string;
}

export interface ProcessingStatus {
  status: "idle" | "processing" | "done" | "error";
  processed: number;
  total: number;
  percent: number;
  error?: string;
}

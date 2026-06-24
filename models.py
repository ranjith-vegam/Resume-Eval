from __future__ import annotations
from typing import Literal
from pydantic import BaseModel, Field


class KPI(BaseModel):
    name: str
    description: str
    weight: float = 0.0


class ResumeFile(BaseModel):
    id: str
    filename: str
    raw_text: str
    raw_bytes: bytes = b""
    content_type: str = "application/octet-stream"
    candidate_name: str | None = None
    candidate_email: str | None = None
    candidate_phone: str | None = None


class EvaluationResult(BaseModel):
    resume_id: str
    filename: str
    candidate_name: str | None = None
    candidate_email: str | None = None
    candidate_phone: str | None = None
    kpi_scores: dict[str, float] = Field(default_factory=dict)
    weighted_score: float = 0.0


class SessionState(BaseModel):
    session_id: str
    jd_text: str = ""
    resumes: list[ResumeFile] = Field(default_factory=list)
    batch_name: str = ""
    suite_name: str = ""
    kpis: list[KPI] = Field(default_factory=list)
    results: list[EvaluationResult] = Field(default_factory=list)
    status: Literal["idle", "processing", "done", "error"] = "idle"
    processed_count: int = 0
    total_count: int = 0
    error: str | None = None

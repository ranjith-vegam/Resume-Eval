from __future__ import annotations
import json
import openai as openai_sdk
import settings_store
from models import KPI

def _build_eval_schema(kpis: list[KPI]) -> dict:
    # OpenAI's strict structured-output mode does not reliably honor a purely
    # dynamic `additionalProperties` map — it needs every key spelled out in
    # `properties`, or the model drifts to placeholder keys (e.g. "A", "B", "C").
    # Building the schema per-call with the actual KPI names keeps the model
    # locked to exactly those keys.
    kpi_props = {k.name: {"type": "number"} for k in kpis}
    return {
        "type": "object",
        "properties": {
            "kpi_scores": {
                "type": "object",
                "properties": kpi_props,
                "required": list(kpi_props.keys()),
                "additionalProperties": False,
            },
            "candidate_name": {"type": ["string", "null"]},
            "candidate_email": {"type": ["string", "null"]},
            "candidate_phone": {"type": ["string", "null"]},
        },
        "required": ["kpi_scores", "candidate_name", "candidate_email", "candidate_phone"],
        "additionalProperties": False,
    }


def _openai_client() -> openai_sdk.AsyncOpenAI:
    cfg = settings_store.get_settings()
    if cfg.provider == "vllm":
        return openai_sdk.AsyncOpenAI(
            api_key=cfg.openai_api_key or "not-needed",
            base_url=cfg.vllm_base_url.rstrip("/"),
        )
    return openai_sdk.AsyncOpenAI(api_key=cfg.openai_api_key)


def _active_model() -> str:
    cfg = settings_store.get_settings()
    if cfg.provider == "openai":
        return cfg.openai_model or "gpt-4o"
    return cfg.vllm_model or "default"


# ── OpenAI / vLLM helpers ────────────────────────────────────────────────────

async def _openai_json_call(system: str, user: str, schema: dict) -> dict:
    client = _openai_client()
    model = _active_model()
    # Use json_schema response_format when supported (OpenAI >=1.30 / vLLM 0.5+)
    try:
        resp = await client.chat.completions.create(
            model=model,
            max_tokens=2048,
            response_format={
                "type": "json_schema",
                "json_schema": {"name": "output", "strict": True, "schema": schema},
            },
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception:
        # Fallback: plain JSON mode for vLLM that doesn't support json_schema
        resp = await client.chat.completions.create(
            model=model,
            max_tokens=2048,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system + "\n\nRespond with valid JSON only."},
                {"role": "user", "content": user},
            ],
        )
        return json.loads(resp.choices[0].message.content or "{}")


# ── Public API ────────────────────────────────────────────────────────────────

async def test_connection() -> str:
    client = _openai_client()
    model = _active_model()
    resp = await client.chat.completions.create(
        model=model,
        max_tokens=64,
        messages=[{"role": "user", "content": "Hi"}],
    )
    return resp.choices[0].message.content or ""


async def evaluate_resume(
    resume_text: str,
    jd_text: str,
    kpis: list[KPI],
) -> dict:
    kpi_list_str = "\n".join(f"- {k.name}: {k.description}" for k in kpis)

    system = (
        "You are a rigorous technical recruiter scoring resumes against a fixed set of KPIs. "
        "Score strictly based on evidence present in the resume; use the job description only as context.\n\n"
        f"**Job Description (context):**\n{jd_text}\n\n"
        f"**KPIs to Score (0-100 each):**\n{kpi_list_str}"
    )
    user = (
        "Score the following resume on each KPI listed above, from 0 to 100, "
        "based strictly on resume content. Return a 'kpi_scores' object with exactly "
        f"these keys: {', '.join(k.name for k in kpis)}.\n\n"
        "Also extract the candidate's full name, email address, and phone number exactly "
        "as they appear in the resume. Use null for any of these that are not present.\n\n"
        f"**Resume:**\n{resume_text}"
    )

    return await _openai_json_call(system, user, _build_eval_schema(kpis))

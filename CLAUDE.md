# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Backend (Python — run from project root)
```bash
uv run uvicorn main:app --reload --port 8000   # development server
uv run python -c "from main import app; print('OK')"  # smoke test imports
uv add <package>                                # add a dependency
```

### Frontend (run from `frontend/`)
```bash
npm run dev      # Vite dev server on :5173, proxies /api → :8000
npm run build    # TypeScript check + Vite build → outputs to ../static/
npm run lint     # ESLint
```

### Production (single process, run from project root)
```bash
cd frontend && npm run build && cd ..
uv run uvicorn main:app --port 8000   # serves API + built React bundle
```

### Environment
Copy `.env.example` to `.env` and set `ANTHROPIC_API_KEY`. The LLM provider can also be changed at runtime via the Settings modal; that uses `settings_store.py` and does not require a restart.

## Architecture

### Monolith layout
The project root is both the `uv` Python project and the deployment unit. FastAPI handles all `/api/*` routes, then mounts `static/` (built React) as a fallback for the SPA. During development, Vite runs on `:5173` and proxies `/api` to FastAPI on `:8000`.

```
main.py              ← FastAPI app; mounts routers then StaticFiles("static/")
config.py            ← env vars (ANTHROPIC_API_KEY, MODEL, limits)
models.py            ← all Pydantic models (KPI, ResumeFile, EvaluationResult, SessionState)
session_store.py     ← in-process dict + asyncio.Queue per session (no DB)
settings_store.py    ← global singleton LLMSettings (provider, keys, model, vLLM URL)
routers/             ← one file per resource group
services/            ← business logic, no FastAPI coupling
frontend/src/        ← React source; builds to ../static/
static/              ← built bundle (git-ignored, recreated by npm run build)
```

### Session lifecycle
Each browser session calls `POST /api/sessions` on load (via `App.tsx` useEffect), receiving a UUID. All subsequent API calls carry this `session_id` in the URL path. `session_store.py` holds all state in a module-level dict protected by an `asyncio.Lock`. Sessions are in-memory only — a server restart loses all data.

### Evaluation flow
1. Upload JD + resumes → parsed to plain text by `services/file_parser.py` (PyMuPDF for PDF, python-docx for DOCX)
2. `POST /kpi/extract` → `llm_service.extract_kpis()` → returns 3–7 KPIs as structured JSON
3. User sets KPI weights (must sum to 1.0); stored in `SessionState.kpis[].weight`
4. `POST /evaluate/start` → launches `evaluation_engine.run_batch()` as a FastAPI `BackgroundTask`
5. `run_batch` spawns one coroutine per resume, gated by `asyncio.Semaphore(5)`, calling `llm_service.evaluate_resume()` for each
6. Each result is appended to session state and pushed to a per-session `asyncio.Queue`
7. Frontend streams results via `GET /evaluate/stream` (SSE, `EventSource`), updating the Zustand store live

### LLM provider abstraction (`services/llm_service.py`)
The module reads `settings_store.get_settings()` on every call — no restart needed when the user changes provider in the Settings modal. Three providers:
- **anthropic** — uses `anthropic.AsyncAnthropic`; structured output via `output_config` + JSON schema; prompt caching (`cache_control: ephemeral`) on the stable JD+criteria system block
- **openai** — uses `openai.AsyncOpenAI`; structured output via `response_format: json_schema`; falls back to `json_object` mode if the model doesn't support `json_schema`
- **vllm** — same `openai.AsyncOpenAI` client, pointed at the configured `vllm_base_url`; uses the same JSON fallback path

The LLM makes the **classification** decision (Shortlisted/Rejected) independently. KPI scores (0–100 per KPI) are returned in the same call but used only for computing `weighted_score = Σ(weight_i × kpi_score_i)`, which ranks candidates within each classification bucket.

### Frontend state
Two Zustand stores:
- `useEvalStore` — wizard step (1–6), session ID, JD text, uploaded file list, eval prompt, KPIs with weights, all evaluation results, processing status
- `useSettingsStore` — active provider, credentials, modal open/close state

`App.tsx` is a simple switch on `currentStep`; steps 1–5 are wizard screens, step 6 is the Dashboard. There is no React Router — navigation is driven entirely by `goToStep()`.

### API shape
All routes under `/api`. Path pattern: `/api/sessions/{session_id}/<resource>`. Settings routes are session-less: `/api/settings` (GET/PUT) and `/api/settings/test` (POST). The SSE stream lives at `/api/sessions/{id}/evaluate/stream` and emits `progress`, `result`, `done`, and `error` event types.

from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import settings_store
from config import PORT
from routers import sessions, upload, kpi, evaluation, results, settings, suites, batches

app = FastAPI(title="Resume Evaluator")


@app.on_event("startup")
async def _load_settings_on_startup() -> None:
    await settings_store.load_settings()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sessions.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(kpi.router, prefix="/api")
app.include_router(evaluation.router, prefix="/api")
app.include_router(results.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(suites.router, prefix="/api")
app.include_router(batches.router, prefix="/api")

static_dir = Path(__file__).parent / "static"
if static_dir.exists() and any(static_dir.iterdir()):
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

if __name__ == "__main__":
    import subprocess
    import uvicorn

    frontend_dir = Path(__file__).parent / "frontend"
    if not static_dir.exists() or not any(static_dir.iterdir()):
        print("Building frontend...")
        subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

    uvicorn.run("main:app", host="0.0.0.0", port=PORT, reload=True)

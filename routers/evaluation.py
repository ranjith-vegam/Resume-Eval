import asyncio
import json
from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
import session_store
from services.evaluation_engine import run_batch

router = APIRouter(prefix="/sessions", tags=["evaluation"])


@router.post("/{session_id}/evaluate/start")
async def evaluate_start(session_id: str, background_tasks: BackgroundTasks):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    if not state.resumes:
        raise HTTPException(status_code=400, detail="No resumes uploaded")
    if not state.jd_text:
        raise HTTPException(status_code=400, detail="No job description provided")
    if not state.kpis:
        raise HTTPException(status_code=400, detail="No KPIs defined")

    background_tasks.add_task(run_batch, session_id)
    return {"status": "processing", "total": len(state.resumes)}


@router.get("/{session_id}/evaluate/stream")
async def evaluate_stream(session_id: str):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    async def event_generator():
        q = session_store.get_queue(session_id)
        if q is None:
            return
        while True:
            try:
                event = await asyncio.wait_for(q.get(), timeout=30.0)
                yield f"data: {json.dumps(event)}\n\n"
                if event.get("type") in ("done", "error"):
                    break
            except asyncio.TimeoutError:
                yield ": keepalive\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{session_id}/evaluate/status")
async def evaluate_status(session_id: str):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    total = state.total_count or 1
    return {
        "status": state.status,
        "processed": state.processed_count,
        "total": state.total_count,
        "percent": round(state.processed_count / total * 100),
    }

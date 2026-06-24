import uuid
from fastapi import APIRouter, HTTPException
import session_store

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.post("")
async def create_session():
    session_id = str(uuid.uuid4())
    state = await session_store.create_session(session_id)
    return {"session_id": state.session_id}


@router.get("/{session_id}")
async def get_session(session_id: str):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return state.model_dump(exclude={"resumes"})


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    await session_store.delete_session(session_id)
    return {"ok": True}


@router.post("/{session_id}/reset-batch")
async def reset_batch(session_id: str):
    state = await session_store.update_session(
        session_id,
        resumes=[],
        batch_name="",
        results=[],
        status="idle",
        processed_count=0,
        total_count=0,
        error=None,
    )
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"ok": True}

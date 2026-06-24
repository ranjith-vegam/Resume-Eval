import uuid
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional
import session_store
from models import ResumeFile
from services import batch_store
from services.file_parser import extract_text, extract_candidate_info

router = APIRouter(prefix="/sessions", tags=["upload"])


class JDTextBody(BaseModel):
    text: str


@router.post("/{session_id}/upload/jd")
async def upload_jd(
    session_id: str,
    file: Optional[UploadFile] = File(default=None),
    text: Optional[str] = Form(default=None),
):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    if file is not None:
        data = await file.read()
        jd_text = extract_text(file.filename or "jd.txt", data)
    elif text:
        jd_text = text
    else:
        raise HTTPException(status_code=400, detail="Provide either a file or text")

    await session_store.update_session(session_id, jd_text=jd_text)
    return {"char_count": len(jd_text), "preview": jd_text[:300]}


@router.post("/{session_id}/upload/resumes")
async def upload_resumes(
    session_id: str,
    batch_name: str = Form(...),
    files: list[UploadFile] = File(...),
):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    batch_name = batch_name.strip()
    if not batch_store.is_valid_batch_name(batch_name):
        raise HTTPException(
            status_code=400,
            detail="Batch name must be 1-80 characters: letters, numbers, spaces, hyphens, underscores only.",
        )
    if await batch_store.batch_exists(batch_name):
        raise HTTPException(status_code=409, detail=f"Batch name '{batch_name}' is already taken.")

    parsed: list[ResumeFile] = []
    failed: list[str] = []

    for f in files:
        try:
            data = await f.read()
            text = extract_text(f.filename or "resume.pdf", data)
            name, email, phone = extract_candidate_info(text)
            parsed.append(
                ResumeFile(
                    id=str(uuid.uuid4()),
                    filename=f.filename or "unknown",
                    raw_text=text,
                    raw_bytes=data,
                    content_type=f.content_type or "application/octet-stream",
                    candidate_name=name,
                    candidate_email=email,
                    candidate_phone=phone,
                )
            )
        except Exception as e:
            failed.append(f"{f.filename}: {e}")

    await session_store.update_session(
        session_id,
        resumes=parsed,
        total_count=len(parsed),
        batch_name=batch_name,
    )
    return {
        "count": len(parsed),
        "failed": failed,
        "filenames": [r.filename for r in parsed],
    }

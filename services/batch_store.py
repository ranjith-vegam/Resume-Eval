from __future__ import annotations
import re
from datetime import datetime, timezone
from bson import ObjectId
from bson.binary import Binary
from pymongo import AsyncMongoClient
from config import MONGO_URI, MONGO_DB_NAME

_MAX_FILE_BYTES = 15_000_000
_NAME_RE = re.compile(r"^[A-Za-z0-9 _-]{1,80}$")

_client = AsyncMongoClient(MONGO_URI)
_resumes = _client[MONGO_DB_NAME]["resumes"]


def is_valid_batch_name(name: str) -> bool:
    return bool(_NAME_RE.match(name.strip()))


async def batch_exists(name: str) -> bool:
    return await _resumes.find_one({"batch_name": name}) is not None


async def list_batches() -> list[dict]:
    names = await _resumes.distinct("batch_name")
    batches = []
    for name in names:
        docs = await _resumes.find(
            {"batch_name": name}, {"weighted_score": 1, "created_at": 1, "suite_name": 1}
        ).to_list(length=None)
        if not docs:
            continue
        count = len(docs)
        avg_score = round(sum(d.get("weighted_score", 0) for d in docs) / count, 1)
        created_at = min(d.get("created_at", "") for d in docs)
        suite_name = next((d.get("suite_name", "") for d in docs if d.get("suite_name")), "")
        batches.append({
            "name": name, "count": count, "avg_score": avg_score,
            "created_at": created_at, "suite_name": suite_name,
        })
    batches.sort(key=lambda b: b["created_at"], reverse=True)
    return batches


async def save_batch(name: str, suite_name: str, candidates: list[dict]) -> None:
    now = datetime.now(timezone.utc).isoformat()
    docs = []
    for c in candidates:
        doc = {
            "batch_name": name,
            "suite_name": suite_name,
            "filename": c["filename"],
            "candidate_name": c.get("candidate_name"),
            "candidate_email": c.get("candidate_email"),
            "candidate_phone": c.get("candidate_phone"),
            "kpi_scores": c.get("kpi_scores", {}),
            "weighted_score": c.get("weighted_score", 0.0),
            "created_at": now,
        }
        raw_bytes = c.get("raw_bytes") or b""
        if raw_bytes and len(raw_bytes) <= _MAX_FILE_BYTES:
            doc["original_file"] = Binary(raw_bytes)
            doc["content_type"] = c.get("content_type", "application/octet-stream")
        docs.append(doc)
    if docs:
        await _resumes.insert_many(docs)


async def get_batch(name: str) -> list[dict]:
    docs = await _resumes.find({"batch_name": name}, {"original_file": 0}).to_list(length=None)
    for d in docs:
        d["resume_id"] = str(d.pop("_id"))
    return docs


async def delete_batch(name: str) -> bool:
    res = await _resumes.delete_many({"batch_name": name})
    return res.deleted_count > 0


async def set_manual_selection(name: str, resume_id: str, selected: bool | None) -> bool:
    try:
        oid = ObjectId(resume_id)
    except Exception:
        return False
    update = {"$set": {"manual_selected": selected}} if selected is not None else {"$unset": {"manual_selected": ""}}
    res = await _resumes.update_one({"_id": oid, "batch_name": name}, update)
    return res.matched_count > 0


async def get_candidate_file(name: str, document_id: str) -> tuple[bytes, str, str] | None:
    try:
        oid = ObjectId(document_id)
    except Exception:
        return None
    doc = await _resumes.find_one(
        {"_id": oid, "batch_name": name}, {"original_file": 1, "content_type": 1, "filename": 1}
    )
    if doc is None or "original_file" not in doc:
        return None
    return bytes(doc["original_file"]), doc.get("content_type", "application/octet-stream"), doc.get("filename", "resume")

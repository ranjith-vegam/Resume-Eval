from __future__ import annotations
from datetime import datetime, timezone
from bson import ObjectId
from pymongo import AsyncMongoClient, ReturnDocument
from config import MONGO_URI, MONGO_DB_NAME

_client = AsyncMongoClient(MONGO_URI)
_col = _client[MONGO_DB_NAME]["suites"]


def _to_summary(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "jd_preview": doc.get("jd_text", "")[:120],
        "kpi_count": len(doc.get("kpis", [])),
    }


def _to_full(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "created_at": doc.get("created_at", ""),
        "updated_at": doc.get("updated_at", ""),
        "jd_text": doc.get("jd_text", ""),
        "kpis": doc.get("kpis", []),
    }


async def name_exists(name: str, exclude_id: str | None = None) -> bool:
    query: dict = {"name": name}
    if exclude_id:
        try:
            query["_id"] = {"$ne": ObjectId(exclude_id)}
        except Exception:
            pass
    return await _col.find_one(query) is not None


async def list_suites() -> list[dict]:
    docs = await _col.find({}).sort("updated_at", -1).to_list(length=None)
    return [_to_summary(d) for d in docs]


async def create_suite(name: str, jd_text: str, kpis: list[dict]) -> dict:
    now = datetime.now(timezone.utc).isoformat()
    doc = {"name": name, "jd_text": jd_text, "kpis": kpis, "created_at": now, "updated_at": now}
    res = await _col.insert_one(doc)
    doc["_id"] = res.inserted_id
    return _to_full(doc)


async def get_suite(suite_id: str) -> dict | None:
    try:
        oid = ObjectId(suite_id)
    except Exception:
        return None
    doc = await _col.find_one({"_id": oid})
    return _to_full(doc) if doc else None


async def update_suite(suite_id: str, name: str, jd_text: str, kpis: list[dict]) -> dict | None:
    try:
        oid = ObjectId(suite_id)
    except Exception:
        return None
    now = datetime.now(timezone.utc).isoformat()
    doc = await _col.find_one_and_update(
        {"_id": oid},
        {"$set": {"name": name, "jd_text": jd_text, "kpis": kpis, "updated_at": now}},
        return_document=ReturnDocument.AFTER,
    )
    return _to_full(doc) if doc else None


async def delete_suite(suite_id: str) -> bool:
    try:
        oid = ObjectId(suite_id)
    except Exception:
        return False
    res = await _col.delete_one({"_id": oid})
    return res.deleted_count > 0

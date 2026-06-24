from __future__ import annotations
import asyncio
from typing import Literal
from pydantic import BaseModel
from pymongo import AsyncMongoClient
from config import MONGO_URI, MONGO_DB_NAME

_DOC_ID = "llm_settings"

_client = AsyncMongoClient(MONGO_URI)
_settings_col = _client[MONGO_DB_NAME]["settings"]


class LLMSettings(BaseModel):
    provider: Literal["openai", "vllm"] = "openai"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    vllm_base_url: str = "http://localhost:8080/v1"
    vllm_model: str = ""


_settings: LLMSettings = LLMSettings()
_lock = asyncio.Lock()


async def load_settings() -> None:
    """Populate the in-memory cache from MongoDB. Call once at app startup."""
    global _settings
    doc = await _settings_col.find_one({"_id": _DOC_ID})
    if doc:
        doc.pop("_id", None)
        try:
            _settings = LLMSettings(**doc)
        except Exception:
            pass


def get_settings() -> LLMSettings:
    return _settings


async def update_settings(**kwargs) -> LLMSettings:
    global _settings
    async with _lock:
        _settings = _settings.model_copy(update=kwargs)
        await _settings_col.replace_one(
            {"_id": _DOC_ID}, {"_id": _DOC_ID, **_settings.model_dump()}, upsert=True
        )
        return _settings

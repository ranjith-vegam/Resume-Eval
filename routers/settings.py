from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Literal
import settings_store
from services.llm_service import test_connection

router = APIRouter(prefix="/settings", tags=["settings"])


class SettingsBody(BaseModel):
    provider: Literal["openai", "vllm"]
    openai_api_key: str = ""
    openai_model: str = "gpt-4o"
    vllm_base_url: str = "http://localhost:8080/v1"
    vllm_model: str = ""


@router.get("")
async def get_settings():
    s = settings_store.get_settings()
    return {
        "provider": s.provider,
        "openai_api_key": s.openai_api_key,
        "openai_model": s.openai_model,
        "vllm_base_url": s.vllm_base_url,
        "vllm_model": s.vllm_model,
    }


@router.put("")
async def save_settings(body: SettingsBody):
    await settings_store.update_settings(**body.model_dump())
    return {"ok": True}


@router.post("/test")
async def test_llm_connection():
    try:
        reply = await test_connection()
        return {"ok": True, "response": reply}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



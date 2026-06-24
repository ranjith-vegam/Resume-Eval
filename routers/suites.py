from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from models import KPI
from services import suite_store

router = APIRouter(prefix="/suites", tags=["suites"])


class SuiteBody(BaseModel):
    name: str
    jd_text: str = ""
    kpis: list[KPI] = []


@router.get("")
async def list_suites():
    return {"suites": await suite_store.list_suites()}


@router.get("/check")
async def check_suite_name(name: str, exclude_id: str | None = None):
    name = name.strip()
    if not name:
        return {"available": False}
    taken = await suite_store.name_exists(name, exclude_id)
    return {"available": not taken}


@router.post("")
async def create_suite(body: SuiteBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Suite name is required.")
    if await suite_store.name_exists(name):
        raise HTTPException(status_code=409, detail=f"Suite name '{name}' is already taken.")
    return await suite_store.create_suite(name, body.jd_text, [k.model_dump() for k in body.kpis])


@router.get("/{suite_id}")
async def get_suite(suite_id: str):
    suite = await suite_store.get_suite(suite_id)
    if suite is None:
        raise HTTPException(status_code=404, detail="Suite not found")
    return suite


@router.put("/{suite_id}")
async def update_suite(suite_id: str, body: SuiteBody):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Suite name is required.")
    if await suite_store.name_exists(name, exclude_id=suite_id):
        raise HTTPException(status_code=409, detail=f"Suite name '{name}' is already taken.")
    suite = await suite_store.update_suite(suite_id, name, body.jd_text, [k.model_dump() for k in body.kpis])
    if suite is None:
        raise HTTPException(status_code=404, detail="Suite not found")
    return suite


@router.delete("/{suite_id}")
async def delete_suite(suite_id: str):
    deleted = await suite_store.delete_suite(suite_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Suite not found")
    return {"ok": True}

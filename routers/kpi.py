from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import session_store
from models import KPI

router = APIRouter(prefix="/sessions", tags=["kpi"])


class KPIBody(BaseModel):
    kpis: list[KPI]
    suite_name: str = ""


@router.put("/{session_id}/kpi")
async def save_kpis(session_id: str, body: KPIBody):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    total = round(sum(k.weight for k in body.kpis), 4)
    if abs(total - 1.0) > 0.01:
        raise HTTPException(status_code=400, detail=f"Weights must sum to 1.0, got {total}")

    await session_store.update_session(session_id, kpis=body.kpis, suite_name=body.suite_name.strip())
    return {"ok": True, "kpis": [k.model_dump() for k in body.kpis]}

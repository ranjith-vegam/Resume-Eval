import csv
import io
from fastapi import APIRouter, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from services import batch_store
from services.csv_utils import excel_safe

router = APIRouter(prefix="/batches", tags=["batches"])


def _is_selected(doc: dict, threshold: float) -> bool:
    manual = doc.get("manual_selected")
    if manual is not None:
        return manual
    return doc.get("weighted_score", 0.0) >= threshold


class SelectionBody(BaseModel):
    selected: bool | None = None


@router.get("")
async def list_batches():
    return {"batches": await batch_store.list_batches()}


@router.get("/check")
async def check_batch_name(name: str):
    name = name.strip()
    if not batch_store.is_valid_batch_name(name):
        return {"valid": False, "available": False}
    taken = await batch_store.batch_exists(name)
    return {"valid": True, "available": not taken}


@router.get("/{name}")
async def get_batch(name: str):
    docs = await batch_store.get_batch(name)
    if not docs:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"name": name, "results": docs}


@router.get("/{name}/export/csv")
async def export_batch_csv(name: str, threshold: float | None = Query(None)):
    docs = await batch_store.get_batch(name)
    if not docs:
        raise HTTPException(status_code=404, detail="Batch not found")

    kpi_names: list[str] = []
    for d in docs:
        for kn in d.get("kpi_scores", {}):
            if kn not in kpi_names:
                kpi_names.append(kn)

    buf = io.StringIO()
    fieldnames = [
        "filename", "candidate_name", "candidate_email", "candidate_phone", "weighted_score",
    ] + kpi_names
    if threshold is not None:
        fieldnames.append("selected")

    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for d in docs:
        row = {
            "filename": d.get("filename", ""),
            "candidate_name": d.get("candidate_name") or "",
            "candidate_email": d.get("candidate_email") or "",
            "candidate_phone": excel_safe(d.get("candidate_phone") or ""),
            "weighted_score": d.get("weighted_score", 0.0),
        }
        kpi_scores = d.get("kpi_scores", {})
        for kn in kpi_names:
            row[kn] = kpi_scores.get(kn, "")
        if threshold is not None:
            row["selected"] = "Yes" if _is_selected(d, threshold) else "No"
        writer.writerow(row)

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{name}.csv"'},
    )


@router.patch("/{name}/{resume_id}/selection")
async def set_selection(name: str, resume_id: str, body: SelectionBody):
    ok = await batch_store.set_manual_selection(name, resume_id, body.selected)
    if not ok:
        raise HTTPException(status_code=404, detail="Candidate not found")
    return {"ok": True}


@router.delete("/{name}")
async def delete_batch(name: str):
    deleted = await batch_store.delete_batch(name)
    if not deleted:
        raise HTTPException(status_code=404, detail="Batch not found")
    return {"ok": True}


@router.get("/{name}/{document_id}/file")
async def download_candidate_file(name: str, document_id: str):
    found = await batch_store.get_candidate_file(name, document_id)
    if found is None:
        raise HTTPException(status_code=404, detail="File not found")
    data, content_type, filename = found
    return Response(
        content=data,
        media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

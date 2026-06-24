import csv
import io
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import session_store
from services.csv_utils import excel_safe

router = APIRouter(prefix="/sessions", tags=["results"])


@router.get("/{session_id}/results")
async def get_results(
    session_id: str,
    sort: str = Query("score", pattern="^(score|name)$"),
    order: str = Query("desc", pattern="^(asc|desc)$"),
):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    results = list(state.results)

    reverse = order == "desc"
    if sort == "score":
        results.sort(key=lambda r: r.weighted_score, reverse=reverse)
    elif sort == "name":
        results.sort(key=lambda r: (r.candidate_name or r.filename).lower(), reverse=reverse)

    total = len(state.results)
    avg_score = (
        round(sum(r.weighted_score for r in state.results) / total, 1) if total else 0
    )

    return {
        "results": [r.model_dump() for r in results],
        "stats": {"total": total, "avg_score": avg_score},
    }


@router.get("/{session_id}/export/csv")
async def export_csv(session_id: str, threshold: float | None = Query(None)):
    state = await session_store.get_session(session_id)
    if state is None:
        raise HTTPException(status_code=404, detail="Session not found")

    buf = io.StringIO()
    kpi_names = [k.name for k in state.kpis]
    fieldnames = [
        "filename", "candidate_name", "candidate_email", "candidate_phone", "weighted_score",
    ] + kpi_names
    if threshold is not None:
        fieldnames.append("selected")

    writer = csv.DictWriter(buf, fieldnames=fieldnames)
    writer.writeheader()
    for r in state.results:
        row = {
            "filename": r.filename,
            "candidate_name": r.candidate_name or "",
            "candidate_email": r.candidate_email or "",
            "candidate_phone": excel_safe(r.candidate_phone or ""),
            "weighted_score": r.weighted_score,
        }
        for kn in kpi_names:
            row[kn] = r.kpi_scores.get(kn, "")
        if threshold is not None:
            row["selected"] = "Yes" if r.weighted_score >= threshold else "No"
        writer.writerow(row)

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=results.csv"},
    )

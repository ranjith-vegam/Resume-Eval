import asyncio
import session_store
from models import EvaluationResult
from services import batch_store, llm_service
from services.scoring import compute_weighted_score


def _merge_field(llm_value, regex_value):
    """Prefer the LLM's extraction (it reads the whole resume, not just a fixed
    window) over the regex-based one from upload time; fall back to regex if the
    LLM didn't find anything."""
    if isinstance(llm_value, str) and llm_value.strip():
        return llm_value.strip()
    return regex_value


async def run_batch(session_id: str) -> None:
    state = await session_store.get_session(session_id)
    if state is None:
        return

    await session_store.update_session(session_id, status="processing", processed_count=0, results=[])
    await session_store.push_event(session_id, {"type": "status", "status": "processing"})

    semaphore = asyncio.Semaphore(5)
    total = len(state.resumes)

    async def process_one(resume):
        async with semaphore:
            try:
                raw = await llm_service.evaluate_resume(
                    resume_text=resume.raw_text,
                    jd_text=state.jd_text,
                    kpis=state.kpis,
                )
            except Exception as e:
                print(f"[evaluation_engine] failed to evaluate {resume.filename}: {e}")
                raw = {"kpi_scores": {}}

            kpi_scores = {k: float(v) for k, v in raw.get("kpi_scores", {}).items()}
            weighted_score = compute_weighted_score(kpi_scores, state.kpis)

            result = EvaluationResult(
                resume_id=resume.id,
                filename=resume.filename,
                candidate_name=_merge_field(raw.get("candidate_name"), resume.candidate_name),
                candidate_email=_merge_field(raw.get("candidate_email"), resume.candidate_email),
                candidate_phone=_merge_field(raw.get("candidate_phone"), resume.candidate_phone),
                kpi_scores=kpi_scores,
                weighted_score=weighted_score,
            )

            current = await session_store.get_session(session_id)
            new_results = list(current.results) + [result]
            new_count = current.processed_count + 1
            await session_store.update_session(
                session_id,
                results=new_results,
                processed_count=new_count,
            )

            await session_store.push_event(
                session_id,
                {
                    "type": "result",
                    "processed": new_count,
                    "total": total,
                    "percent": round(new_count / total * 100),
                    "result": result.model_dump(),
                },
            )

    tasks = [process_one(r) for r in state.resumes]
    await asyncio.gather(*tasks, return_exceptions=True)

    final = await session_store.get_session(session_id)
    if final and final.batch_name:
        resumes_by_id = {r.id: r for r in final.resumes}
        candidates = []
        for result in final.results:
            resume = resumes_by_id.get(result.resume_id)
            candidates.append({
                "filename": result.filename,
                "candidate_name": result.candidate_name,
                "candidate_email": result.candidate_email,
                "candidate_phone": result.candidate_phone,
                "kpi_scores": result.kpi_scores,
                "weighted_score": result.weighted_score,
                "raw_bytes": resume.raw_bytes if resume else b"",
                "content_type": resume.content_type if resume else "application/octet-stream",
            })
        try:
            await batch_store.save_batch(final.batch_name, final.suite_name, candidates)
        except Exception as e:
            print(f"[evaluation_engine] failed to save batch '{final.batch_name}' to MongoDB: {e}")

    await session_store.update_session(session_id, status="done")
    await session_store.push_event(session_id, {"type": "done"})

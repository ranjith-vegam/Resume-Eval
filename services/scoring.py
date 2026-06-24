from models import KPI


def compute_weighted_score(kpi_scores: dict[str, float], kpis: list[KPI]) -> float:
    total = 0.0
    for kpi in kpis:
        score = kpi_scores.get(kpi.name, 0.0)
        total += kpi.weight * score
    return round(total, 2)

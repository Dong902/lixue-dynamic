"""六维学业韧性计分（与前端 data.js 保持一致的移植）"""
import json

DIMS = ["motivation", "time", "attention", "resilience", "revision", "exam"]

# 与 data.js LX.ITEMS 一致：(id, dim)；反向题为 id ∈ REVERSE_IDS
ITEMS = [
    (1, "motivation"), (2, "motivation"), (3, "motivation"), (4, "motivation"),
    (5, "time"), (6, "time"), (7, "time"), (8, "time"),
    (9, "attention"), (10, "attention"), (11, "attention"), (12, "attention"),
    (13, "resilience"), (14, "resilience"), (15, "resilience"), (16, "resilience"),
    (17, "revision"), (18, "revision"), (19, "revision"), (20, "revision"),
    (21, "exam"), (22, "exam"), (23, "exam"), (24, "exam"),
]
REVERSE_IDS = {7, 11, 15, 20, 21}


def compute_scores(answers: dict) -> dict:
    """answers: {item_id(int): value(1-5)} -> {dim: 均值(1-5, 保留3位)}"""
    sums = {d: 0 for d in DIMS}
    counts = {d: 0 for d in DIMS}
    for it_id, dim in ITEMS:
        v = answers.get(it_id)
        if v is None:
            continue
        score = (6 - v) if it_id in REVERSE_IDS else v
        sums[dim] += score
        counts[dim] += 1
    scores = {}
    for d in DIMS:
        scores[d] = round(sums[d] / counts[d], 3) if counts[d] else None
    return scores


def band_of(score):
    if score is None:
        return "na"
    if score < 2.6:
        return "low"
    if score < 3.6:
        return "mid"
    return "high"


def band_of_scores(scores: dict) -> dict:
    return {d: band_of(scores.get(d)) for d in DIMS}


def engagement_band(scores: dict) -> str:
    vals = [scores[d] for d in DIMS if scores.get(d) is not None]
    if not vals:
        return "na"
    return band_of(sum(vals) / len(vals))


def weak_dims(scores: dict, n: int = 2):
    valid = [(d, scores[d]) for d in DIMS if scores.get(d) is not None]
    valid.sort(key=lambda x: x[1])
    return [d for d, _ in valid[:n]]

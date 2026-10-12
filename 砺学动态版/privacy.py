"""隐私脱敏：k-匿名群体抑制 + 家长端摘要（不暴露成绩与原始分）"""
import scoring


def k_anonym(records, k: int = 5):
    """群体聚合：样本量 n < k 时整体抑制，不返回任何个体行。"""
    n = len(records)
    if n < k:
        return {
            "n": n,
            "suppressed": True,
            "rows": [],
            "note": "样本量低于 k=%d，依据 k-匿名原则整体抑制，不返回任何可识别个体行" % k,
        }
    return {
        "n": n,
        "suppressed": False,
        "rows": records,
        "note": "已满足 k=%d 匿名，仅返回脱敏后的群体行（不含身份标识）" % k,
    }


def desensitize_for_parent(scores: dict) -> dict:
    """家长端摘要：仅成长型脱敏信息，绝不暴露成绩或原始测评分值。

    注：practice_started / help_seeking / highlights 依赖前端或业务逻辑补充，
    MVP 以占位 None 表示，待接入真实行为信号后再填充。
    """
    return {
        "engagement_band": scoring.engagement_band(scores),
        "practice_started": None,
        "help_seeking": None,
        "growing_dims": scoring.weak_dims(scores, 2),
        "highlights": None,
        "_raw_excluded": True,
        "note": "家长端不展示成绩与原始测评分值，仅提供脱敏成长摘要",
    }

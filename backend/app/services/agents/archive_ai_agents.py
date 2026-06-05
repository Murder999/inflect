"""
Archive AI Agents — Archive üzerinde kategori, trend, sınıflandırma ve temizlik işleri.
Gerçek veri kullanır, fake metrik üretmez.
"""
from __future__ import annotations
from typing import Any
from app.services.agents.base_agent import BaseAgent, AgentResult


# ─── Archive Category Agent ───────────────────────────────────────────────────

class ArchiveCategoryAgent(BaseAgent):
    """Profil bio ve username'den kategori önerisi üretir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("archive_categorize", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["bio_analysis", "category_mapping", "confidence_scoring"], "estimated_latency_ms": 180}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        profiles = data.get("profiles", [])  # list of {username, bio, category, platform}

        KEYWORD_MAP = {
            "Fashion / Moda": ["moda", "fashion", "style", "kiyafet", "outfit", "ootd", "giyim"],
            "Beauty / Güzellik": ["makyaj", "beauty", "makeup", "cilt", "skincare", "kozmetik"],
            "Food / Yemek": ["yemek", "food", "tarif", "recipe", "mutfak", "lezzet", "gurme"],
            "Tech / Teknoloji": ["tech", "teknoloji", "yazilim", "kod", "programlama", "developer", "ai"],
            "Travel / Seyahat": ["seyahat", "travel", "gezi", "tatil", "gezgin", "dunyagezgini"],
            "Fitness / Spor": ["spor", "fitness", "gym", "antrenman", "saglik", "health"],
            "Gaming / Oyun": ["oyun", "gaming", "gamer", "twitch", "stream", "esport"],
            "Business / İş": ["girisimci", "startup", "business", "ceo", "yatırım", "fintech"],
            "Lifestyle": ["lifestyle", "yasam", "gunluk", "daily", "vlog"],
        }

        suggestions = []
        for p in profiles[:50]:  # Max 50 profil işle
            bio      = (p.get("bio") or "").lower()
            username = (p.get("username") or "").lower()
            current  = p.get("category") or ""
            text     = bio + " " + username

            best_cat, best_score = current or "Belirtilmemiş", 0
            for cat, keywords in KEYWORD_MAP.items():
                score = sum(1 for kw in keywords if kw in text)
                if score > best_score:
                    best_score, best_cat = score, cat

            confidence = min(95, best_score * 20) if best_score > 0 else 10
            if best_cat != current:
                suggestions.append({
                    "profile_id":       p.get("id"),
                    "username":         p.get("username"),
                    "current_category": current or "Yok",
                    "suggested_category": best_cat,
                    "confidence":       confidence,
                    "signal_count":     best_score,
                })

        summary = (
            f"{len(profiles)} profil tarandı. "
            f"{len(suggestions)} profil için kategori değişikliği öneriliyor."
        )
        return AgentResult(
            success=True,
            output={"suggestions": suggestions, "scanned": len(profiles), "changed": len(suggestions)},
            summary=summary, risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Archive Trend Agent ──────────────────────────────────────────────────────

class ArchiveTrendAgent(BaseAgent):
    """Snapshot geçmişini analiz ederek büyüme trendlerini tespit eder."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("archive_trend", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["snapshot_comparison", "growth_rate", "trend_classification"], "estimated_latency_ms": 220}

    async def execute(self, task) -> AgentResult:
        data      = task.input_data or {}
        snapshots = data.get("snapshots", [])  # list of {profile_id, followers, captured_at}

        # Profil bazında grupla ve trendi hesapla
        from collections import defaultdict
        groups: dict[int, list] = defaultdict(list)
        for s in snapshots:
            groups[s["profile_id"]].append(s)

        rising    = []
        declining = []
        stable    = []

        for pid, snaps in groups.items():
            if len(snaps) < 2:
                continue
            snaps.sort(key=lambda x: x.get("captured_at", ""))
            first_f = snaps[0].get("followers", 0) or 0
            last_f  = snaps[-1].get("followers", 0) or 0
            if first_f == 0:
                continue
            growth_pct = ((last_f - first_f) / first_f) * 100
            entry = {
                "profile_id":  pid,
                "username":    snaps[-1].get("username", ""),
                "followers_start": first_f,
                "followers_end":   last_f,
                "growth_pct":  round(growth_pct, 1),
                "snapshots":   len(snaps),
            }
            if growth_pct > 10:
                rising.append(entry)
            elif growth_pct < -5:
                declining.append(entry)
            else:
                stable.append(entry)

        rising.sort(key=lambda x: x["growth_pct"], reverse=True)
        declining.sort(key=lambda x: x["growth_pct"])

        summary = (
            f"Trend analizi: {len(rising)} yükselen, {len(declining)} düşen, {len(stable)} stabil profil. "
            f"En hızlı büyüyen: {rising[0]['username'] if rising else 'yok'}"
        )
        return AgentResult(
            success=True,
            output={
                "rising":    rising[:20],
                "declining": declining[:10],
                "stable_count": len(stable),
                "total_analyzed": len(groups),
            },
            summary=summary, risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Influencer Classifier Agent ──────────────────────────────────────────────

class InfluencerClassifierAgent(BaseAgent):
    """Takipçi sayısına göre influencer'ları tier'lara sınıflandırır."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("archive_classify", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["follower_tier", "engagement_tier", "combined_score"], "estimated_latency_ms": 120}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        profiles = data.get("profiles", [])  # list of {id, username, followers, engagement_rate}

        TIERS = [
            ("Mega",    1_000_000, float("inf")),
            ("Macro",   500_000,   1_000_000),
            ("Mid",     100_000,   500_000),
            ("Micro",   10_000,    100_000),
            ("Nano",    1_000,     10_000),
            ("Pico",    0,         1_000),
        ]

        classified = {"Mega": [], "Macro": [], "Mid": [], "Micro": [], "Nano": [], "Pico": []}
        for p in profiles:
            followers = p.get("followers", 0) or 0
            for tier, low, high in TIERS:
                if low <= followers < high:
                    classified[tier].append({
                        "id":       p.get("id"),
                        "username": p.get("username"),
                        "followers": followers,
                        "engagement_rate": p.get("engagement_rate", 0),
                    })
                    break

        distribution = {tier: len(items) for tier, items in classified.items()}
        total = sum(distribution.values())

        summary = (
            f"{total} profil sınıflandırıldı: "
            + " · ".join(f"{tier}: {cnt}" for tier, cnt in distribution.items() if cnt > 0)
        )
        return AgentResult(
            success=True,
            output={"distribution": distribution, "classified": classified, "total": total},
            summary=summary, risk_level="low",
            conversation_messages=[self.create_conversation_message(summary, "result")],
        )


# ─── Archive Cleaner Agent ────────────────────────────────────────────────────

class ArchiveCleanerAgent(BaseAgent):
    """Eski/çakışan/geçersiz profilleri tespit eder. Silme için APPROVAL gerektirir."""

    async def can_handle(self, task_type: str) -> bool:
        return task_type in ("archive_clean", "general", "sub_task")

    async def plan(self, task) -> dict[str, Any]:
        return {"steps": ["stale_detection", "duplicate_check", "null_data_check", "approval_request"], "estimated_latency_ms": 250}

    async def execute(self, task) -> AgentResult:
        data     = task.input_data or {}
        profiles = data.get("profiles", [])

        stale      = []  # Son 90 gün sync yok
        no_snapshot = []  # Hiç snapshot yok
        low_quality = []  # Bio yok + avatar yok

        from datetime import datetime, timezone, timedelta
        cutoff = datetime.now(timezone.utc) - timedelta(days=90)

        for p in profiles:
            last_sync = p.get("last_synced_at")
            has_snap  = p.get("has_snapshot", False)
            bio       = (p.get("bio") or "").strip()
            avatar    = (p.get("profile_image_url") or "").strip()

            if last_sync:
                try:
                    ls = datetime.fromisoformat(last_sync.replace("Z", "+00:00"))
                    if ls < cutoff:
                        stale.append({"id": p.get("id"), "username": p.get("username"), "reason": "90+ gün sync edilmedi"})
                except Exception:
                    pass

            if not has_snap:
                no_snapshot.append({"id": p.get("id"), "username": p.get("username"), "reason": "Snapshot yok"})

            if not bio and not avatar:
                low_quality.append({"id": p.get("id"), "username": p.get("username"), "reason": "Bio ve avatar eksik"})

        flagged = stale + no_snapshot + low_quality
        summary = (
            f"Archive temizlik analizi: {len(flagged)} profil işaretlendi "
            f"({len(stale)} eski, {len(no_snapshot)} snapshot-sız, {len(low_quality)} düşük kaliteli). "
            "⚠ SİLME İŞLEMİ HUMAN APPROVAL GEREKTİRİR."
        )

        return AgentResult(
            success=True,
            output={
                "stale":        stale[:50],
                "no_snapshot":  no_snapshot[:50],
                "low_quality":  low_quality[:50],
                "total_flagged": len(flagged),
                "status": "ANALYSIS_ONLY — Deletion requires admin approval",
            },
            summary=summary,
            risk_level="high",
            requires_approval=True,
            conversation_messages=[self.create_conversation_message(summary, "warning")],
        )

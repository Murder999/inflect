"""
Alert Center — watchlist + analiz geçmişine dayalı uyarılar.
Gerçek veri: sahte risk sinyali üretilmez.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone, timedelta

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.watchlist import WatchlistItem
from app.models.analysis import Analysis

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def get_alerts(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alerts = []

    # 1. Kredi uyarısı
    if user.credits_remaining == 0:
        alerts.append({
            "type": "critical",
            "title": "Kredi Tükendi",
            "message": "Analiz yapabilmek için plan yükseltmeniz gerekiyor.",
            "action": "/pricing",
            "action_label": "Plan Yükselt",
        })
    elif user.credits_remaining <= 2:
        alerts.append({
            "type": "warning",
            "title": "Düşük Kredi",
            "message": f"Yalnızca {user.credits_remaining} krediniz kaldı.",
            "action": "/pricing",
            "action_label": "Kredi Ekle",
        })

    # 2. İzleme listesindeki yüksek riskli profiller
    wl_result = await db.execute(
        select(WatchlistItem).where(WatchlistItem.user_id == user.id)
    )
    watchlist = wl_result.scalars().all()

    for item in watchlist:
        if item.fraud_score >= 60:
            alerts.append({
                "type": "danger",
                "title": f"Yüksek Fraud Riski: @{item.username}",
                "message": f"İzleme listenizdeki @{item.username} adlı profil fraud riski yüksek (skor: {item.fraud_score}).",
                "action": "/lists",
                "action_label": "Listeye Git",
                "username": item.username,
                "platform": item.platform,
            })
        elif item.fraud_score >= 40:
            alerts.append({
                "type": "warning",
                "title": f"Orta Risk: @{item.username}",
                "message": f"@{item.username} fraud riski orta seviyede ({item.fraud_score}). İzlemeye devam edin.",
                "action": "/lists",
                "action_label": "Listeye Git",
                "username": item.username,
                "platform": item.platform,
            })

    # 3. Son 7 günde analiz yapılmadıysa hatırlatma
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_q = await db.execute(
        select(Analysis).where(
            Analysis.user_id == user.id,
            Analysis.created_at >= week_ago,
        )
    )
    recent = recent_q.scalars().all()
    if not recent and user.credits_remaining > 0:
        alerts.append({
            "type": "info",
            "title": "7 Gündür Analiz Yapılmadı",
            "message": "Influencer risk profilleri değişebilir. Düzenli analiz önerilir.",
            "action": "/search",
            "action_label": "Analiz Başlat",
        })

    # 4. İzleme listesindeki profiller son analizden sonra değerlendirme
    for item in watchlist:
        if item.analysis_id:
            a_result = await db.execute(
                select(Analysis).where(Analysis.id == item.analysis_id)
            )
            analysis = a_result.scalar_one_or_none()
            if analysis and analysis.created_at:
                days_since = (datetime.now(timezone.utc) - analysis.created_at).days
                if days_since >= 30:
                    alerts.append({
                        "type": "info",
                        "title": f"30 Gün Güncelleme: @{item.username}",
                        "message": f"@{item.username} için son analiz {days_since} gün önce yapıldı. Yenilemeniz önerilir.",
                        "action": "/search",
                        "action_label": "Yeniden Analiz Et",
                        "username": item.username,
                        "platform": item.platform,
                    })

    # Sort: critical > danger > warning > info
    priority = {"critical": 0, "danger": 1, "warning": 2, "info": 3}
    alerts.sort(key=lambda x: priority.get(x["type"], 99))

    return {
        "alerts": alerts,
        "total": len(alerts),
        "has_critical": any(a["type"] == "critical" for a in alerts),
        "has_warning": any(a["type"] in ("warning", "danger") for a in alerts),
    }

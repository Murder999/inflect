"""
Avatar Resolver — Influencer profil görseli URL'sini platform provider'dan çeker.

Kurallar:
- Yalnızca provider'dan gelen gerçek URL'ler kaydedilir.
- Fake / placeholder URL yazılmaz.
- Provider key yoksa ok=False döner, profil güncellenmez.

Platform priority (data_provider.py tarafından uygulanır):
  instagram: profilePicUrlHD → profilePicUrl → hdProfilePicVersions[0].url → avatar
  tiktok:    avatarLarger → avatarMedium → avatarThumb → avatar
  youtube:   thumbnails.high.url → thumbnails.medium.url → thumbnails.default.url
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import HTTPException

logger = logging.getLogger(__name__)


async def resolve_profile_image(
    platform: str,
    username: str,
    cfg: Optional[dict] = None,
) -> dict:
    """
    Platform provider'dan avatar URL'sini çeker.

    Mevcut data_provider.get_profile() kullanılır — platform-specific alan
    önceliği data_provider içinde zaten uygulanmış durumdadır.

    Returns:
        {
            "profile_image_url": str | None,   # Başarılıysa gerçek URL
            "source":            str,           # Hangi provider/actor kullanıldı
            "ok":                bool,
            "error":             str | None,
        }
    """
    cfg = cfg or {}

    try:
        from app.services.data_provider import get_profile
        data = await asyncio.to_thread(get_profile, username, platform, cfg)
    except HTTPException as e:
        return {
            "profile_image_url": None,
            "source":            "provider_error",
            "ok":                False,
            "error":             str(e.detail)[:300],
        }
    except Exception as e:
        logger.warning("Avatar resolve hata: %s/%s — %s", platform, username, e)
        return {
            "profile_image_url": None,
            "source":            "unexpected_error",
            "ok":                False,
            "error":             str(e)[:300],
        }

    # data_provider zaten platform'a özel öncelik sırası ile avatar seçiyor.
    url = data.get("profile_image_url") or data.get("avatar") or ""

    # Geçerli bir HTTP URL olmalı — placeholder/boş kabul edilmez
    if not url or not url.startswith("http"):
        return {
            "profile_image_url": None,
            "source":            data.get("source", "unknown"),
            "ok":                False,
            "error":             "Provider avatar URL döndürmedi.",
        }

    return {
        "profile_image_url": url,
        "source":            data.get("source", "unknown"),
        "ok":                True,
        "error":             None,
    }

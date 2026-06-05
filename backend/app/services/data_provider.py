"""
Data Provider — fetches real influencer data from YouTube, Instagram, TikTok.
Never fabricates data. Raises HTTP 503 with clear message if provider unavailable.
"""
import os
import re
from datetime import datetime, timezone
from typing import Any, Optional

import httpx
from fastapi import HTTPException


# ─────────────────────────── Helpers ────────────────────────────

def normalize_username(username: str) -> str:
    raw = username.strip()
    for prefix in [
        "https://www.youtube.com/", "https://youtube.com/",
        "https://www.instagram.com/", "https://instagram.com/",
        "https://www.tiktok.com/@", "https://tiktok.com/@",
        "https://www.tiktok.com/", "https://tiktok.com/",
    ]:
        raw = raw.replace(prefix, "")
    return raw.strip("/").replace("@", "").strip()


def _env(name: str, cfg: dict | None, cfg_key: str) -> str:
    cfg = cfg or {}
    return (os.getenv(name) or cfg.get("api_keys", {}).get(cfg_key) or "").strip()


def _client() -> httpx.Client:
    return httpx.Client(timeout=httpx.Timeout(50.0, connect=15.0))


def _pick(d: dict, *keys: str, default: Any = None) -> Any:
    for k in keys:
        if k in d and d[k] not in (None, ""):
            return d[k]
    return default


def _parse_iso_duration(duration: str) -> int:
    m = re.fullmatch(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or "")
    if not m:
        return 0
    h, mi, s = [int(x or 0) for x in m.groups()]
    return h * 3600 + mi * 60 + s


def _days_ago(iso: str) -> str:
    if not iso:
        return ""
    try:
        iso_clean = str(iso).replace("Z", "+00:00")
        dt = datetime.fromisoformat(iso_clean)
        days = max(0, (datetime.now(timezone.utc) - dt).days)
        if days == 0:
            return "Bugün"
        if days == 1:
            return "1 gün önce"
        if days < 7:
            return f"{days} gün önce"
        if days < 30:
            return f"{days // 7} hafta önce"
        return f"{days // 30} ay önce"
    except Exception:
        return str(iso)[:10]


# ─────────────────────────── YouTube ────────────────────────────

def _yt_get(client: httpx.Client, path: str, key: str, **params: Any) -> dict:
    params["key"] = key
    r = client.get(f"https://www.googleapis.com/youtube/v3/{path}", params=params)
    if r.status_code == 403:
        raise HTTPException(status_code=503, detail=(
            "YouTube API key hatası (403). Google Cloud Console'da "
            "YouTube Data API v3 etkin ve kota açık olmalı."
        ))
    if r.status_code >= 400:
        raise HTTPException(status_code=503, detail=f"YouTube API hatası {r.status_code}: {r.text[:300]}")
    return r.json()


def _youtube_profile(username: str, cfg: dict) -> dict:
    key = _env("YOUTUBE_API_KEY", cfg, "youtube_api_key")
    if not key:
        raise HTTPException(status_code=503, detail=(
            "YouTube verisi için YOUTUBE_API_KEY gerekli. "
            "Admin > Ayarlar sayfasından ekleyebilirsiniz."
        ))
    handle = normalize_username(username)

    with _client() as client:
        # Resolve channel ID
        channel_id = None
        if handle.startswith("UC") and len(handle) > 20:
            channel_id = handle
        else:
            search = _yt_get(client, "search", key, part="snippet", q=handle, type="channel", maxResults=1)
            items = search.get("items", [])
            if not items:
                raise HTTPException(status_code=404, detail=f"YouTube kanalı bulunamadı: @{username}")
            channel_id = items[0]["id"]["channelId"]

        # Channel details
        ch_data = _yt_get(client, "channels", key,
                          part="snippet,statistics,contentDetails,brandingSettings,topicDetails",
                          id=channel_id, maxResults=1)
        ch_items = ch_data.get("items", [])
        if not ch_items:
            raise HTTPException(status_code=404, detail=f"YouTube kanalı bulunamadı: @{username}")

        ch = ch_items[0]
        snippet = ch.get("snippet", {})
        stats = ch.get("statistics", {})
        content_details = ch.get("contentDetails", {})
        uploads_playlist = content_details.get("relatedPlaylists", {}).get("uploads")

        # Get last 6 videos
        playlist_items = []
        video_ids = []
        if uploads_playlist:
            pl = _yt_get(client, "playlistItems", key,
                         part="snippet,contentDetails",
                         playlistId=uploads_playlist, maxResults=6)
            playlist_items = pl.get("items", [])
            video_ids = [
                x.get("contentDetails", {}).get("videoId")
                for x in playlist_items
                if x.get("contentDetails", {}).get("videoId")
            ]

        video_map = {}
        if video_ids:
            videos = _yt_get(client, "videos", key,
                             part="snippet,statistics,contentDetails",
                             id=",".join(video_ids), maxResults=6)
            for v in videos.get("items", []):
                video_map[v["id"]] = v

        # Build content list
        content = []
        views_sum = likes_sum = comments_sum = 0
        for i, item in enumerate(playlist_items):
            vid = item.get("contentDetails", {}).get("videoId")
            v = video_map.get(vid, {})
            vs = v.get("statistics", {})
            sn = v.get("snippet", item.get("snippet", {}))
            thumbs = sn.get("thumbnails", {})
            thumb = (
                thumbs.get("maxres") or thumbs.get("standard") or
                thumbs.get("high") or thumbs.get("medium") or
                thumbs.get("default") or {}
            ).get("url", "")
            views = int(vs.get("viewCount", 0) or 0)
            likes = int(vs.get("likeCount", 0) or 0)
            comments = int(vs.get("commentCount", 0) or 0)
            views_sum += views
            likes_sum += likes
            comments_sum += comments
            content.append({
                "id": vid or f"yt-{channel_id}-{i}",
                "title": sn.get("title", "YouTube video")[:120],
                "thumbnail": thumb,
                "views": views,
                "likes": likes,
                "comments": comments,
                "published": _days_ago(sn.get("publishedAt", "")),
                "url": f"https://www.youtube.com/watch?v={vid}" if vid else "",
                "duration_seconds": _parse_iso_duration(v.get("contentDetails", {}).get("duration", "")),
            })

        n = max(len(content), 1)
        followers = int(stats.get("subscriberCount", 0) or 0)
        avg_views = int(views_sum / n)
        avg_likes = int(likes_sum / n)
        avg_comments = int(comments_sum / n)
        er = round((avg_likes + avg_comments) / max(followers, 1) * 100, 2)

        topics = ch.get("topicDetails", {}).get("topicCategories", [])
        category = " / ".join([
            t.rstrip("/").split("/")[-1].replace("_", " ") for t in topics[:2]
        ]) or "YouTube Creator"

        thumbs = snippet.get("thumbnails", {})
        # En yüksek kaliteli kanal avatarını seç; URL'deki boyut parametresini yükselt
        _avatar_obj = (
            thumbs.get("high") or thumbs.get("medium") or thumbs.get("default") or {}
        )
        avatar = _avatar_obj.get("url", "")
        # yt3.ggpht.com URL'lerinde boyutu s240'a yükselt (varsa)
        if avatar and "=s" in avatar:
            avatar = avatar.split("=s")[0] + "=s240-c-k-c0x00ffffff-no-rj"
        banner = ch.get("brandingSettings", {}).get("image", {}).get("bannerExternalUrl") or avatar

        suspicious = max(5, min(55, int(35 - min(er, 10) * 2)))

        return {
            "source": "youtube_data_api_v3",
            "is_real_data": True,
            "missing_real_fields": ["audience_demographics", "fraud_follower_sampling", "roi_sales_data"],
            "username": (snippet.get("customUrl") or handle).replace("@", ""),
            "display_name": snippet.get("title") or handle,
            "platform": "youtube",
            "platform_label": "YouTube",
            "avatar": avatar,
            "profile_image_url": avatar,
            "banner": banner,
            "bio": snippet.get("description", "")[:500],
            "category": category,
            "country": snippet.get("country") or "Bilinmiyor",
            "followers": followers,
            "following": 0,
            "avg_views": avg_views,
            "avg_likes": avg_likes,
            "avg_comments": avg_comments,
            "engagement_rate": er,
            "growth_30d": 0,
            "suspicious_audience": suspicious,
            "content": content,
            "audience": {
                "gender": {}, "age": {},
                "countries": {snippet.get("country", "TR"): 100} if snippet.get("country") else {},
                "cities": {}, "interests": [category],
            },
            "timeline": [],
            "raw_url": f"https://www.youtube.com/channel/{channel_id}",
        }


# ─────────────────────────── Apify ────────────────────────────

def _apify_sync(actor: str, token: str, payload: dict) -> list:
    if not actor:
        raise HTTPException(status_code=503, detail="Apify actor adı boş.")
    actor_id = actor.replace("/", "~")
    url = f"https://api.apify.com/v2/acts/{actor_id}/run-sync-get-dataset-items"
    with _client() as client:
        r = client.post(url, params={"token": token}, json=payload)
        if r.status_code >= 400:
            raise HTTPException(
                status_code=503,
                detail=f"Apify hatası ({actor}): {r.text[:500]}"
            )
        data = r.json()
        if isinstance(data, list):
            return data
        return data.get("items", []) if isinstance(data, dict) else []


def _apify_try(actors: list, token: str, payloads: list) -> tuple[list, str]:
    errors = []
    for actor in actors:
        if not actor:
            continue
        for payload in payloads:
            try:
                items = _apify_sync(actor, token, payload)
                if items:
                    return items, actor
                errors.append(f"{actor}: boş sonuç")
            except HTTPException as e:
                errors.append(f"{actor}: {str(e.detail)[:200]}")
    raise HTTPException(
        status_code=503,
        detail="Veri sağlayıcılar sonuç döndürmedi. " + " | ".join(errors[-3:])
    )


# ─────────────────────────── Instagram ────────────────────────────

def _instagram_profile(username: str, cfg: dict) -> dict:
    token = _env("APIFY_TOKEN", cfg, "apify_token")
    if not token:
        raise HTTPException(status_code=503, detail=(
            "Instagram verisi için APIFY_TOKEN gerekli. "
            "Admin > Ayarlar sayfasından ekleyebilirsiniz."
        ))
    handle = normalize_username(username)
    configured_actor = _env("INSTAGRAM_ACTOR", cfg, "instagram_actor") or "apify/instagram-profile-scraper"

    actors = list(dict.fromkeys([
        configured_actor,
        "apify/instagram-profile-scraper",
        "instagram-scraper/instagram-profile-scraper",
    ]))
    payloads = [
        {"usernames": [handle], "resultsLimit": 6},
        {"startUrls": [f"https://www.instagram.com/{handle}/"], "resultsLimit": 6},
        {"usernames": [handle]},
    ]
    items, used_actor = _apify_try(actors, token, payloads)
    it = items[0]

    posts = _pick(it, "latestPosts", "latest_posts", "posts", default=[]) or []
    if isinstance(posts, dict):
        posts = posts.get("edges", []) or posts.get("items", []) or []

    content = []
    for i, p in enumerate(posts[:6]):
        node = p.get("node", p) if isinstance(p, dict) else {}
        images = _pick(node, "images", default=[]) or []
        thumb = _pick(node, "displayUrl", "display_url", "imageUrl", "thumbnailUrl", default="")
        if not thumb and isinstance(images, list) and images:
            thumb = images[0]
        views = int(_pick(node, "videoViewCount", "video_view_count", "videoPlayCount", "views", default=0) or 0)
        likes = int(_pick(node, "likesCount", "like_count", "likeCount", "likes", default=0) or 0)
        comments = int(_pick(node, "commentsCount", "comment_count", "commentCount", "comments", default=0) or 0)
        shortcode = _pick(node, "shortCode", "shortcode", default="")
        content.append({
            "id": str(_pick(node, "id", "shortCode", "shortcode", default=f"ig-{handle}-{i}")),
            "title": (_pick(node, "caption", "text", "title", default="Instagram içeriği") or "")[:120],
            "thumbnail": thumb,
            "views": views, "likes": likes, "comments": comments,
            "published": _days_ago(str(_pick(node, "timestamp", "taken_at", "takenAtTimestamp", default=""))),
            "url": _pick(node, "url", default=f"https://www.instagram.com/p/{shortcode}/" if shortcode else f"https://www.instagram.com/{handle}/"),
        })

    followers = int(_pick(it, "followersCount", "followers", "followerCount", default=0) or 0)
    following = int(_pick(it, "followsCount", "following", "followingCount", default=0) or 0)
    avg_likes = int(sum(x["likes"] for x in content) / max(len(content), 1))
    avg_comments = int(sum(x["comments"] for x in content) / max(len(content), 1))
    avg_views = int(sum(x["views"] for x in content) / max(len(content), 1))
    er = round((avg_likes + avg_comments) / max(followers, 1) * 100, 2)
    suspicious = max(5, min(60, int(40 - min(er, 8) * 2)))
    avatar = _pick(it, "profilePicUrlHD", "profilePicUrl",
                    "profile_pic_url_hd", "profile_pic_url",
                    "hdProfilePicVersions", "avatar", default="")
    # Bazen hdProfilePicVersions bir liste döndürür; ilk elemanı al
    if isinstance(avatar, list) and avatar:
        avatar = avatar[0].get("url", "") if isinstance(avatar[0], dict) else str(avatar[0])

    return {
        "source": f"apify:{used_actor}",
        "is_real_data": True,
        "missing_real_fields": ["private_audience_demographics", "verified_fraud_sampling", "roi_sales_data"],
        "username": _pick(it, "username", default=handle),
        "display_name": _pick(it, "fullName", "full_name", "name", default=handle),
        "platform": "instagram", "platform_label": "Instagram",
        "avatar": avatar, "banner": avatar,
        "profile_image_url": avatar,
        "bio": _pick(it, "biography", "bio", default=""),
        "category": _pick(it, "businessCategoryName", "business_category_name", "category", default="Instagram Creator"),
        "country": _pick(it, "location", "country", default="Bilinmiyor"),
        "followers": followers, "following": following,
        "avg_views": avg_views, "avg_likes": avg_likes, "avg_comments": avg_comments,
        "engagement_rate": er, "growth_30d": 0, "suspicious_audience": suspicious,
        "content": content,
        "audience": {"gender": {}, "age": {}, "countries": {}, "cities": {}, "interests": []},
        "timeline": [],
        "raw_url": _pick(it, "url", default=f"https://www.instagram.com/{handle}/"),
    }


# ─────────────────────────── TikTok ────────────────────────────

def _tiktok_profile(username: str, cfg: dict) -> dict:
    token = _env("APIFY_TOKEN", cfg, "apify_token")
    if not token:
        raise HTTPException(status_code=503, detail=(
            "TikTok verisi için APIFY_TOKEN gerekli. "
            "Admin > Ayarlar sayfasından ekleyebilirsiniz."
        ))
    handle = normalize_username(username)
    configured_actor = _env("TIKTOK_ACTOR", cfg, "tiktok_actor") or "clockworks/tiktok-scraper"

    actors = list(dict.fromkeys([
        configured_actor,
        "clockworks/tiktok-scraper",
        "clockworks/tiktok-profile-scraper",
    ]))
    payloads = [
        {"profiles": [handle], "resultsPerPage": 6, "profileScrapeSections": ["videos"], "profileSorting": "latest"},
        {"profiles": [f"https://www.tiktok.com/@{handle}"], "resultsPerPage": 6},
        {"urls": [f"https://www.tiktok.com/@{handle}"], "maxItems": 6},
    ]
    items, used_actor = _apify_try(actors, token, payloads)
    first = items[0]
    profile = (
        first.get("authorMeta") or first.get("author") or
        first.get("user") or first.get("profile") or first
    )
    videos = items[:6]

    followers = int(_pick(profile, "fans", "followers", "followerCount",
                          default=_pick(first, "followers", default=0)) or 0)
    following = int(_pick(profile, "following", "followingCount", default=0) or 0)

    content = []
    for i, v in enumerate(videos):
        stats = v.get("statistics") or v.get("stats") or v
        views = int(_pick(stats, "playCount", "views", "viewCount", "play_count", default=0) or 0)
        likes = int(_pick(stats, "diggCount", "likeCount", "likes", "digg_count", default=0) or 0)
        comments = int(_pick(stats, "commentCount", "comments", "comment_count", default=0) or 0)
        content.append({
            "id": str(_pick(v, "id", "videoId", default=f"tt-{handle}-{i}")),
            "title": (_pick(v, "text", "desc", "description", default="TikTok video") or "")[:120],
            "thumbnail": _pick(v, "cover", "coverUrl", "thumbnail", default=""),
            "views": views, "likes": likes, "comments": comments,
            "published": _days_ago(str(_pick(v, "createTimeISO", "createTime", "date", default=""))),
            "url": _pick(v, "webVideoUrl", "url", default=f"https://www.tiktok.com/@{handle}"),
        })

    avg_views = int(sum(x["views"] for x in content) / max(len(content), 1))
    avg_likes = int(sum(x["likes"] for x in content) / max(len(content), 1))
    avg_comments = int(sum(x["comments"] for x in content) / max(len(content), 1))
    er = round((avg_likes + avg_comments) / max(followers, 1) * 100, 2)
    suspicious = max(5, min(60, int(42 - min(er, 9) * 2)))
    avatar = _pick(profile, "avatarLarger", "avatarMedium", "avatar",
                    "avatarThumb", "headPictureUrl", default="")

    return {
        "source": f"apify:{used_actor}",
        "is_real_data": True,
        "missing_real_fields": ["private_audience_demographics", "verified_fraud_sampling", "roi_sales_data"],
        "username": _pick(profile, "name", "uniqueId", "username", default=handle),
        "display_name": _pick(profile, "nickName", "nickname", "displayName", default=handle),
        "platform": "tiktok", "platform_label": "TikTok",
        "avatar": avatar, "banner": avatar,
        "profile_image_url": avatar,
        "bio": _pick(profile, "signature", "bio", default=""),
        "category": "TikTok Creator", "country": "Bilinmiyor",
        "followers": followers, "following": following,
        "avg_views": avg_views, "avg_likes": avg_likes, "avg_comments": avg_comments,
        "engagement_rate": er, "growth_30d": 0, "suspicious_audience": suspicious,
        "content": content,
        "audience": {"gender": {}, "age": {}, "countries": {}, "cities": {}, "interests": []},
        "timeline": [],
        "raw_url": f"https://www.tiktok.com/@{handle}",
    }


# ─────────────────────────── Public API ────────────────────────────

def get_profile(username: str, platform: str, cfg: Optional[dict] = None) -> dict:
    cfg = cfg or {}
    platform = platform.lower().strip()
    if platform == "youtube":
        return _youtube_profile(username, cfg)
    if platform == "instagram":
        return _instagram_profile(username, cfg)
    if platform == "tiktok":
        return _tiktok_profile(username, cfg)
    raise HTTPException(status_code=400, detail=f"Geçersiz platform: {platform}")


def discovery_profiles(
    platform: Optional[str] = None,
    category: Optional[str] = None,
    country: str = "Türkiye",
    count: int = 20,
    cfg: Optional[dict] = None,
) -> list:
    """
    Discovery requires a search/listing provider.
    Currently returns empty list — to be implemented with
    Apify search actors or a curated seed database.
    """
    return []

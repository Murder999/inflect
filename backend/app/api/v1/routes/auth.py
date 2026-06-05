from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.core.database import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, decode_token
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest,
    UserResponse, UpdateProfileRequest, UpdatePasswordRequest, UpdateApiKeysRequest,
)
from app.services.audit import log_action

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(req: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Bu e-posta zaten kayıtlı.")
    user = User(
        email=req.email, hashed_password=hash_password(req.password),
        full_name=req.full_name, company=req.company, phone=req.phone,
        credits_remaining=5, credits_total=5,
    )
    db.add(user)
    await db.flush()
    await log_action(db, "user_registered", user_id=user.id,
                     details={"email": user.email},
                     ip_address=request.client.host if request.client else None)
    return TokenResponse(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="E-posta veya şifre hatalı.")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Hesap deaktif.")
    user.last_login_at = datetime.now(timezone.utc)
    await log_action(db, "user_login", user_id=user.id,
                     ip_address=request.client.host if request.client else None)
    return TokenResponse(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(req: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(req.refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Geçersiz refresh token.")
    result = await db.execute(select(User).where(User.id == int(payload["sub"]), User.is_active == True))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı.")
    return TokenResponse(access_token=create_access_token(user.id), refresh_token=create_refresh_token(user.id))


@router.get("/me", response_model=UserResponse)
async def me(user: User = Depends(get_current_user)):
    return _user_response(user)


@router.patch("/me", response_model=UserResponse)
async def update_profile(req: UpdateProfileRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if req.full_name is not None:  user.full_name = req.full_name
    if req.company is not None:    user.company   = req.company
    if req.phone is not None:      user.phone     = req.phone
    if req.website is not None:    user.website   = req.website
    await db.flush()
    return _user_response(user)


@router.post("/password")
async def change_password(req: UpdatePasswordRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    if not verify_password(req.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Mevcut şifre hatalı.")
    user.hashed_password = hash_password(req.new_password)
    await log_action(db, "password_changed", user_id=user.id)
    await db.flush()
    return {"success": True, "message": "Şifre başarıyla güncellendi."}


@router.patch("/api-keys")
async def update_api_keys(req: UpdateApiKeysRequest, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    existing = dict(user.api_keys_data or {})
    if req.youtube_api_key is not None: existing["youtube_api_key"] = req.youtube_api_key
    if req.apify_token is not None:     existing["apify_token"]     = req.apify_token
    if req.openai_api_key is not None:  existing["openai_api_key"]  = req.openai_api_key
    user.api_keys_data = existing
    await db.flush()
    return {"success": True, "keys": _mask_keys(existing)}


@router.get("/api-keys")
async def get_api_keys(user: User = Depends(get_current_user)):
    return {"keys": _mask_keys(user.api_keys_data or {})}


def _mask_keys(keys: dict) -> dict:
    masked = {}
    for k, v in keys.items():
        if v and len(str(v)) > 8: masked[k] = str(v)[:4] + "••••••••" + str(v)[-4:]
        elif v: masked[k] = "••••••••"
        else:   masked[k] = ""
    return masked


def _user_response(user: User) -> dict:
    return {
        "id": user.id, "email": user.email,
        "full_name": user.full_name, "company": user.company,
        "phone": user.phone, "website": user.website, "avatar_url": user.avatar_url,
        "plan": user.plan.value if hasattr(user.plan, "value") else str(user.plan),
        "credits_remaining": user.credits_remaining, "credits_total": user.credits_total,
        "is_admin": user.is_admin, "is_verified": user.is_verified,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }

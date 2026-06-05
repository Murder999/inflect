"""
Provider Client — Claude / OpenAI / DeepSeek / Mock abstraction.
API key varsa gerçek çağrı yapar. Yoksa structured mock döndürür.
"""
from __future__ import annotations

import json
import logging
import os
import random
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ProviderResponse:
    content: str
    provider: str
    model: str
    input_tokens: int
    output_tokens: int
    cost_usd: float
    is_mock: bool


def _get_key(env_var: str) -> Optional[str]:
    val = os.environ.get(env_var, "").strip()
    return val if val and not val.startswith("change") else None


def _mock_response(prompt: str, system: str) -> ProviderResponse:
    """Structured mock — provider yoksa veya AGENTS_MODE=mock iken kullanılır."""
    return ProviderResponse(
        content="__MOCK__",       # Caller kendi structured output üretir
        provider="mock",
        model="mock-v1",
        input_tokens=max(10, len(prompt.split()) * 4 // 3),
        output_tokens=random.randint(100, 400),
        cost_usd=0.0,
        is_mock=True,
    )


def _real_mode() -> bool:
    """AGENTS_MODE=real veya live → True. Mock fallback yapılmamalı."""
    from app.core.config import settings
    return settings.AGENTS_MODE in ("real", "live")


async def call_claude(
    prompt: str,
    system: str = "",
    model: str = "claude-3-haiku-20240307",
    max_tokens: int = 1024,
) -> ProviderResponse:
    """Anthropic Claude API çağrısı."""
    api_key = _get_key("ANTHROPIC_API_KEY")
    if not api_key:
        if _real_mode():
            raise ValueError("ANTHROPIC_API_KEY eksik — AGENTS_MODE=real modunda mock'a düşülmez.")
        logger.debug("ANTHROPIC_API_KEY yok — mock döndürülüyor.")
        return _mock_response(prompt, system)

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "system": system,
                    "messages": [{"role": "user", "content": prompt}],
                },
            )
            r.raise_for_status()
            data = r.json()
            text = data["content"][0]["text"]
            usage = data.get("usage", {})
            return ProviderResponse(
                content=text,
                provider="claude",
                model=model,
                input_tokens=usage.get("input_tokens", 0),
                output_tokens=usage.get("output_tokens", 0),
                cost_usd=_claude_cost(usage, model),
                is_mock=False,
            )
    except Exception as exc:
        if _real_mode():
            raise RuntimeError(f"Claude API hatası: {exc}") from exc
        logger.warning("Claude API hatası: %s — mock döndürülüyor.", exc)
        return _mock_response(prompt, system)


async def call_openai(
    prompt: str,
    system: str = "",
    model: str = "gpt-4o-mini",
    max_tokens: int = 1024,
) -> ProviderResponse:
    """OpenAI API çağrısı."""
    api_key = _get_key("OPENAI_API_KEY")
    if not api_key:
        if _real_mode():
            raise ValueError("OPENAI_API_KEY eksik — AGENTS_MODE=real modunda mock'a düşülmez.")
        logger.debug("OPENAI_API_KEY yok — mock döndürülüyor.")
        return _mock_response(prompt, system)

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": prompt},
                    ],
                },
            )
            r.raise_for_status()
            data = r.json()
            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return ProviderResponse(
                content=text,
                provider="openai",
                model=model,
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
                cost_usd=_openai_cost(usage, model),
                is_mock=False,
            )
    except Exception as exc:
        if _real_mode():
            raise RuntimeError(f"OpenAI API hatası: {exc}") from exc
        logger.warning("OpenAI API hatası: %s — mock döndürülüyor.", exc)
        return _mock_response(prompt, system)


async def call_deepseek(
    prompt: str,
    system: str = "",
    model: str = "deepseek-chat",
    max_tokens: int = 1024,
) -> ProviderResponse:
    """DeepSeek API çağrısı (OpenAI uyumlu API)."""
    api_key = _get_key("DEEPSEEK_API_KEY")
    if not api_key:
        if _real_mode():
            raise ValueError("DEEPSEEK_API_KEY eksik — AGENTS_MODE=real modunda mock'a düşülmez.")
        logger.debug("DEEPSEEK_API_KEY yok — mock döndürülüyor.")
        return _mock_response(prompt, system)

    try:
        import httpx
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                "https://api.deepseek.com/v1/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json={
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": system},
                        {"role": "user",   "content": prompt},
                    ],
                },
            )
            r.raise_for_status()
            data = r.json()
            text = data["choices"][0]["message"]["content"]
            usage = data.get("usage", {})
            return ProviderResponse(
                content=text,
                provider="deepseek",
                model=model,
                input_tokens=usage.get("prompt_tokens", 0),
                output_tokens=usage.get("completion_tokens", 0),
                cost_usd=_deepseek_cost(usage, model),
                is_mock=False,
            )
    except Exception as exc:
        if _real_mode():
            raise RuntimeError(f"DeepSeek API hatası: {exc}") from exc
        logger.warning("DeepSeek API hatası: %s — mock döndürülüyor.", exc)
        return _mock_response(prompt, system)


def _claude_cost(usage: dict, model: str) -> float:
    rates = {
        "claude-3-haiku-20240307":  (0.25 / 1e6, 1.25 / 1e6),
        "claude-3-5-sonnet-20241022": (3.0 / 1e6, 15.0 / 1e6),
    }
    ri, ro = rates.get(model, (0.25 / 1e6, 1.25 / 1e6))
    return round(usage.get("input_tokens", 0) * ri + usage.get("output_tokens", 0) * ro, 6)


def _openai_cost(usage: dict, model: str) -> float:
    rates = {
        "gpt-4o-mini": (0.15 / 1e6, 0.6 / 1e6),
        "gpt-4o":      (5.0 / 1e6, 15.0 / 1e6),
    }
    ri, ro = rates.get(model, (0.15 / 1e6, 0.6 / 1e6))
    return round(usage.get("prompt_tokens", 0) * ri + usage.get("completion_tokens", 0) * ro, 6)


def _deepseek_cost(usage: dict, model: str) -> float:
    ri, ro = 0.14 / 1e6, 0.28 / 1e6
    return round(usage.get("prompt_tokens", 0) * ri + usage.get("completion_tokens", 0) * ro, 6)


async def call_gemini(
    prompt: str,
    system: str = "",
    model: str = "gemini-1.5-flash",
    max_tokens: int = 1024,
) -> ProviderResponse:
    """Google Gemini API çağrısı (v1beta REST)."""
    api_key = _get_key("GEMINI_API_KEY")
    if not api_key:
        if _real_mode():
            raise ValueError("GEMINI_API_KEY eksik — AGENTS_MODE=real modunda mock'a düşülmez.")
        logger.debug("GEMINI_API_KEY yok — mock döndürülüyor.")
        return _mock_response(prompt, system)

    try:
        import httpx
        contents = []
        if system:
            contents.append({"role": "user", "parts": [{"text": system}]})
            contents.append({"role": "model", "parts": [{"text": "Anladim, devam ediyorum."}]})
        contents.append({"role": "user", "parts": [{"text": prompt}]})

        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                params={"key": api_key},
                json={"contents": contents, "generationConfig": {"maxOutputTokens": max_tokens}},
            )
            r.raise_for_status()
            data = r.json()
            text = data["candidates"][0]["content"]["parts"][0]["text"]
            usage = data.get("usageMetadata", {})
            in_tok  = usage.get("promptTokenCount", 0)
            out_tok = usage.get("candidatesTokenCount", 0)
            # Gemini 1.5 Flash: ~$0.075/1M in, ~$0.30/1M out
            cost = round(in_tok * 0.075 / 1e6 + out_tok * 0.30 / 1e6, 6)
            return ProviderResponse(
                content=text, provider="gemini", model=model,
                input_tokens=in_tok, output_tokens=out_tok,
                cost_usd=cost, is_mock=False,
            )
    except Exception as exc:
        if _real_mode():
            raise RuntimeError(f"Gemini API hatası: {exc}") from exc
        logger.warning("Gemini API hatası: %s — mock döndürülüyor.", exc)
        return _mock_response(prompt, system)


async def call_with_fallback(
    primary: str,
    fallback: str,
    prompt: str,
    system: str = "",
    max_tokens: int = 1024,
) -> ProviderResponse:
    """
    Primary provider çağırır; başarısız olursa fallback'e geçer.
    primary/fallback: 'claude'|'openai'|'deepseek'|'gemini'|'mock'
    """
    DISPATCH = {
        "claude":   call_claude,
        "openai":   call_openai,
        "deepseek": call_deepseek,
        "gemini":   call_gemini,
        "mock":     lambda p, s="", max_tokens=1024: _mock_response(p, s),
    }
    primary_fn  = DISPATCH.get(primary,  call_claude)
    fallback_fn = DISPATCH.get(fallback, call_openai)

    result = await primary_fn(prompt, system, max_tokens=max_tokens)
    if result.is_mock and fallback != "mock" and not is_mock_mode():
        logger.info("Primary '%s' başarısız — fallback '%s' deneniyor.", primary, fallback)
        result = await fallback_fn(prompt, system, max_tokens=max_tokens)
    return result


def is_mock_mode() -> bool:
    from app.core.config import settings
    # "real" ve "live" her ikisi de gerçek mod anlamına gelir
    if settings.AGENTS_MODE in ("real", "live"):
        return False
    # mock modda ise veya hiçbir API key yoksa mock
    return not (
        _get_key("ANTHROPIC_API_KEY")
        or _get_key("OPENAI_API_KEY")
        or _get_key("DEEPSEEK_API_KEY")
        or _get_key("GEMINI_API_KEY")
    )

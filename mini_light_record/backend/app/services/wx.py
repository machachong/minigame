"""微信 code2session / access_token / 手机号"""

from __future__ import annotations

import time

import httpx

from app.core.config import get_settings

_token_cache: dict[str, object] = {"token": "", "expires_at": 0.0}


async def code2session(code: str) -> str:
    """返回 openid。若配置了 MOCK_OPENID 则直接返回 mock。"""
    settings = get_settings()
    if settings.MOCK_OPENID:
        return settings.MOCK_OPENID

    if not settings.WX_APPID or not settings.WX_SECRET:
        raise ValueError("未配置 WX_APPID/WX_SECRET，且未设置 MOCK_OPENID")

    url = "https://api.weixin.qq.com/sns/jscode2session"
    params = {
        "appid": settings.WX_APPID,
        "secret": settings.WX_SECRET,
        "js_code": code,
        "grant_type": "authorization_code",
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    if "openid" not in data:
        raise ValueError(data.get("errmsg", "微信登录失败"))
    return data["openid"]


async def get_access_token() -> str:
    """获取小程序全局 access_token（带简易内存缓存）。"""
    settings = get_settings()
    if settings.MOCK_OPENID:
        return "mock_access_token"

    if not settings.WX_APPID or not settings.WX_SECRET:
        raise ValueError("未配置 WX_APPID/WX_SECRET")

    now = time.time()
    if _token_cache["token"] and float(_token_cache["expires_at"]) > now + 60:
        return str(_token_cache["token"])

    url = "https://api.weixin.qq.com/cgi-bin/token"
    params = {
        "grant_type": "client_credential",
        "appid": settings.WX_APPID,
        "secret": settings.WX_SECRET,
    }
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        data = resp.json()
    token = data.get("access_token")
    if not token:
        raise ValueError(data.get("errmsg", "获取 access_token 失败"))
    _token_cache["token"] = token
    _token_cache["expires_at"] = now + int(data.get("expires_in", 7200))
    return token


async def get_phone_number(phone_code: str) -> str:
    """用 getPhoneNumber 返回的 code 换取手机号。MOCK 时返回 MOCK_PHONE。"""
    settings = get_settings()
    if settings.MOCK_OPENID or not settings.WX_APPID or not settings.WX_SECRET:
        # 开发：无密钥或开启 MOCK 时写死手机号（仍要求前端传了 code）
        if not phone_code:
            raise ValueError("缺少 phone code")
        return settings.MOCK_PHONE or "13800138000"

    token = await get_access_token()
    url = f"https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token={token}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(url, json={"code": phone_code})
        data = resp.json()
    if data.get("errcode", 0) != 0:
        raise ValueError(data.get("errmsg", "获取手机号失败"))
    info = data.get("phone_info") or {}
    phone = info.get("purePhoneNumber") or info.get("phoneNumber")
    if not phone:
        raise ValueError("微信未返回手机号")
    return str(phone)

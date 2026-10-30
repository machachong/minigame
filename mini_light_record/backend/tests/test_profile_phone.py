"""昵称自定义、登录附带资料、微信 phone_code / 明文绑手机"""


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_login_with_nickname_avatar_and_last_login(client):
    r = client.post(
        "/api/auth/login",
        json={
            "code": "any",
            "nickname": "小橘子",
            "avatar_url": "https://example.com/a.png",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    user = data["user"]
    assert user["openid"] == "test_user"
    assert user["nickname"] == "小橘子"
    assert user["avatar_url"] == "https://example.com/a.png"
    assert user["last_login_at"] is not None

    # 再次登录可改昵称（自定义，不强制微信）
    r2 = client.post(
        "/api/auth/login",
        json={"code": "any", "nickname": "轻记阿橙"},
    )
    assert r2.status_code == 200
    assert r2.json()["user"]["nickname"] == "轻记阿橙"


def test_patch_me_nickname(client):
    login = client.post("/api/auth/login", json={"code": "any"}).json()
    token = login["token"]
    r = client.patch(
        "/api/me",
        headers=_auth(token),
        json={"nickname": "自定义昵称"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["nickname"] == "自定义昵称"
    assert r.json()["openid"] == "test_user"

    me = client.get("/api/me", headers=_auth(token))
    assert me.json()["nickname"] == "自定义昵称"


def test_auth_phone_mock_code(client):
    login = client.post("/api/auth/login", json={"code": "any"}).json()
    token = login["token"]
    r = client.post(
        "/api/auth/phone",
        headers=_auth(token),
        json={"code": "mock_phone_code"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["phone"] == "13800138000"


def test_me_phone_via_phone_code_or_plain(client):
    login = client.post("/api/auth/login", json={"code": "any"}).json()
    token = login["token"]

    # phone_code 路径
    r = client.post(
        "/api/me/phone",
        headers=_auth(token),
        json={"phone_code": "wx_code_x"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["phone"] == "13800138000"

    # 换号：明文开发绑定
    r2 = client.post(
        "/api/me/phone",
        headers=_auth(token),
        json={"phone": "13912345678"},
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["phone"] == "13912345678"

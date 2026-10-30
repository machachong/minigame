"""家庭账本、分享/手机号邀请、个人账本隔离"""

from app.core.database import SessionLocal
from app.core.security import create_access_token
from app.models.user import User
from app.services.seed import seed_user_defaults


def _make_user(openid: str, nickname: str | None = None) -> tuple[str, dict]:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.openid == openid).first()
        if not user:
            user = User(openid=openid, nickname=nickname or openid)
            db.add(user)
            db.commit()
            db.refresh(user)
            seed_user_defaults(db, user)
            db.refresh(user)
        token = create_access_token(user.id, user.openid)
        return token, {
            "id": user.id,
            "openid": user.openid,
            "nickname": user.nickname,
            "phone": user.phone,
        }
    finally:
        db.close()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def test_family_share_invite_and_records(client):
    token_a, user_a = _make_user("owner_a", "主人甲")
    r = client.post(
        "/api/books",
        headers=_auth(token_a),
        json={"name": "我家账本", "kind": "family"},
    )
    assert r.status_code == 200, r.text
    family = r.json()
    assert family["kind"] == "family"
    assert family["role"] == "owner"
    assert family["member_count"] == 1
    book_id = family["id"]

    inv = client.post(
        f"/api/books/{book_id}/invites",
        headers=_auth(token_a),
        json={"channel": "share"},
    )
    assert inv.status_code == 200, inv.text
    invite = inv.json()
    assert len(invite["code"]) == 8
    assert invite["path"].startswith("pages/invite/accept?code=")
    code = invite["code"]

    prev = client.get(f"/api/invites/{code}")
    assert prev.status_code == 200
    assert prev.json()["book_name"] == "我家账本"
    assert prev.json()["status"] == "pending"

    token_b, user_b = _make_user("member_b", "成员乙")
    acc = client.post(f"/api/invites/{code}/accept", headers=_auth(token_b))
    assert acc.status_code == 200, acc.text
    assert acc.json()["book_id"] == book_id

    books_b = client.get("/api/books", headers=_auth(token_b)).json()
    assert any(b["id"] == book_id for b in books_b)
    fam_b = next(b for b in books_b if b["id"] == book_id)
    assert fam_b["role"] == "member"

    cats = client.get(f"/api/categories?book_id={book_id}&type=expense", headers=_auth(token_a)).json()
    accs = client.get(f"/api/accounts?book_id={book_id}", headers=_auth(token_a)).json()
    # 记账只能用二级小类
    expense_cat = next(c for root in cats for c in root.get("children", []))
    account = accs[0]
    rec = client.post(
        "/api/records",
        headers=_auth(token_a),
        json={
            "book_id": book_id,
            "account_id": account["id"],
            "category_id": expense_cat["id"],
            "type": "expense",
            "amount_cents": 1280,
            "note": "午饭",
        },
    )
    assert rec.status_code == 200, rec.text

    records = client.get(f"/api/records?book_id={book_id}", headers=_auth(token_b))
    assert records.status_code == 200
    items = records.json()
    assert len(items) >= 1
    assert items[0]["amount_cents"] == 1280
    assert items[0]["user_nickname"] == "主人甲"


def test_phone_invite_requires_matching_phone(client):
    token_a, _ = _make_user("owner_phone", "邀请人")
    book = client.post(
        "/api/books",
        headers=_auth(token_a),
        json={"name": "电话家庭", "kind": "family"},
    ).json()
    book_id = book["id"]

    inv = client.post(
        f"/api/books/{book_id}/invites",
        headers=_auth(token_a),
        json={"channel": "phone", "phone": "13800138000"},
    )
    assert inv.status_code == 200, inv.text
    code = inv.json()["code"]

    token_b, _ = _make_user("invitee_wrong", "错号")
    r = client.post(f"/api/invites/{code}/accept", headers=_auth(token_b))
    assert r.status_code == 400

    client.post("/api/me/phone", headers=_auth(token_b), json={"phone": "13900139000"})
    r = client.post(f"/api/invites/{code}/accept", headers=_auth(token_b))
    assert r.status_code == 403

    token_c, _ = _make_user("invitee_ok", "对号")
    bind = client.post(
        "/api/me/phone",
        headers=_auth(token_c),
        json={"phone": "+86 138-0013-8000"},
    )
    assert bind.status_code == 200
    assert bind.json()["phone"] == "13800138000"
    r = client.post(f"/api/invites/{code}/accept", headers=_auth(token_c))
    assert r.status_code == 200, r.text
    books = client.get("/api/books", headers=_auth(token_c)).json()
    assert any(b["id"] == book_id for b in books)


def test_personal_book_not_visible_to_others(client):
    token_a, _ = _make_user("personal_a")
    books_a = client.get("/api/books", headers=_auth(token_a)).json()
    personal = next(b for b in books_a if b["kind"] == "personal")
    book_id = personal["id"]

    token_b, _ = _make_user("personal_b")
    books_b = client.get("/api/books", headers=_auth(token_b)).json()
    assert all(b["id"] != book_id for b in books_b)

    r = client.get(f"/api/books/{book_id}", headers=_auth(token_b))
    assert r.status_code == 404

    r = client.get(f"/api/records?book_id={book_id}", headers=_auth(token_b))
    assert r.status_code == 404

    r = client.post(
        f"/api/books/{book_id}/invites",
        headers=_auth(token_a),
        json={"channel": "share"},
    )
    assert r.status_code == 400

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert data["app"] == "轻记"


def test_login_mock(client):
    r = client.post("/api/auth/login", json={"code": "any"})
    assert r.status_code == 200
    data = r.json()
    assert "token" in data
    assert data["user"]["openid"] == "test_user"
    assert data["user"]["nickname"] == "轻记用户"

    # 种子：默认账本
    headers = {"Authorization": f"Bearer {data['token']}"}
    books = client.get("/api/books", headers=headers)
    assert books.status_code == 200
    blist = books.json()
    assert len(blist) >= 1
    assert blist[0]["name"] == "日常账本"

    book_id = blist[0]["id"]
    cats = client.get(f"/api/categories?book_id={book_id}", headers=headers)
    assert cats.status_code == 200
    roots = cats.json()
    assert len(roots) >= 10  # 支出+收入一级大类
    assert any(r.get("children") for r in roots)

    accs = client.get(f"/api/accounts?book_id={book_id}", headers=headers)
    assert accs.status_code == 200
    assert len(accs.json()) >= 3

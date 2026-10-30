"""一级/二级分类：树结构、创建校验、只能记二级、seed"""


def _login(client, code="tree_user"):
    r = client.post("/api/auth/login", json={"code": code, "nickname": "分类测"})
    assert r.status_code == 200
    token = r.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    books = client.get("/api/books", headers=headers).json()
    book_id = books[0]["id"]
    return headers, book_id


def test_seed_has_l1_and_l2(client):
    headers, book_id = _login(client, "seed_tree")
    tree = client.get(f"/api/categories?book_id={book_id}&type=expense", headers=headers)
    assert tree.status_code == 200
    roots = tree.json()
    assert len(roots) >= 5
    assert all(r.get("parent_id") is None for r in roots)
    assert any(r.get("children") for r in roots)
    shopping = next(r for r in roots if r["name"] == "购物")
    child_names = {c["name"] for c in shopping["children"]}
    assert "服饰" in child_names
    assert all(c["parent_id"] == shopping["id"] for c in shopping["children"])

    income = client.get(f"/api/categories?book_id={book_id}&type=income", headers=headers).json()
    assert any(r["name"] == "工资" and r["children"] for r in income)


def test_list_flat_and_parent_filter(client):
    headers, book_id = _login(client, "flat_filter")
    flat = client.get(
        f"/api/categories?book_id={book_id}&type=expense&flat=true", headers=headers
    ).json()
    assert any(c["parent_id"] is None for c in flat)
    assert any(c["parent_id"] is not None for c in flat)
    assert all(c.get("children") == [] for c in flat)

    roots = [c for c in flat if c["parent_id"] is None]
    pid = roots[0]["id"]
    kids = client.get(
        f"/api/categories?book_id={book_id}&parent_id={pid}", headers=headers
    ).json()
    assert kids
    assert all(c["parent_id"] == pid for c in kids)


def test_create_l1_and_l2_validation(client):
    headers, book_id = _login(client, "create_cat")
    r = client.post(
        "/api/categories",
        headers=headers,
        json={"book_id": book_id, "name": "自定义大类", "type": "expense", "icon": "other"},
    )
    assert r.status_code == 200, r.text
    parent = r.json()
    assert parent["parent_id"] is None

    r2 = client.post(
        "/api/categories",
        headers=headers,
        json={
            "book_id": book_id,
            "name": "自定义小类",
            "type": "expense",
            "icon": "other",
            "parent_id": parent["id"],
        },
    )
    assert r2.status_code == 200, r2.text
    assert r2.json()["parent_id"] == parent["id"]

    # 同名一级
    dup = client.post(
        "/api/categories",
        headers=headers,
        json={"book_id": book_id, "name": "自定义大类", "type": "expense"},
    )
    assert dup.status_code == 400

    # 不能挂在二级下
    bad = client.post(
        "/api/categories",
        headers=headers,
        json={
            "book_id": book_id,
            "name": "三级",
            "type": "expense",
            "parent_id": r2.json()["id"],
        },
    )
    assert bad.status_code == 400

    # type 不一致
    mismatch = client.post(
        "/api/categories",
        headers=headers,
        json={
            "book_id": book_id,
            "name": "错类型",
            "type": "income",
            "parent_id": parent["id"],
        },
    )
    assert mismatch.status_code == 400


def test_record_only_on_l2(client):
    headers, book_id = _login(client, "rec_leaf")
    tree = client.get(f"/api/categories?book_id={book_id}&type=expense", headers=headers).json()
    parent = tree[0]
    leaf = parent["children"][0]
    accs = client.get(f"/api/accounts?book_id={book_id}", headers=headers).json()
    account_id = accs[0]["id"]

    bad = client.post(
        "/api/records",
        headers=headers,
        json={
            "book_id": book_id,
            "account_id": account_id,
            "category_id": parent["id"],
            "type": "expense",
            "amount_cents": 100,
        },
    )
    assert bad.status_code == 400
    assert "二级" in bad.json()["detail"]

    ok = client.post(
        "/api/records",
        headers=headers,
        json={
            "book_id": book_id,
            "account_id": account_id,
            "category_id": leaf["id"],
            "type": "expense",
            "amount_cents": 100,
            "note": "二级记账",
        },
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["category_id"] == leaf["id"]

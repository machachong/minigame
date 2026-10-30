# 后端说明

根目录：`/workspace/qingji/backend/`  
栈：Python 3.11+ · FastAPI · SQLAlchemy 2 · python-jose · httpx · pydantic-settings。

## 目录

```
backend/
  app/
    main.py              # FastAPI app、CORS、路由挂载、create_all
    api/
      auth.py            # /api/auth
      me.py              # /api/me
      books.py           # /api/books + 邀请创建/成员
      invites.py         # /api/invites
      accounts.py
      categories.py
      records.py
      budgets.py
      stats.py
      deps.py            # 再导出 get_current_user
    core/
      config.py          # Settings
      database.py        # engine、Session、Base、SQLite FK
      security.py        # JWT 签发与校验
    models/              # ORM
    schemas/             # Pydantic 入参/出参
    services/
      seed.py            # 默认账本/分类/账户
      membership.py      # 成员校验、手机规范化、邀请过期
      wx.py              # code2session、access_token、getPhoneNumber
  tests/
    conftest.py          # MOCK_OPENID=test_user + 独立 sqlite
    test_health_login.py
    test_profile_phone.py
    test_family_invite.py
    test_categories_tree.py
  scripts/smoke.sh       # 需已启动 uvicorn
  scripts/migrate_categories_tree.py  # 旧扁平库加 parent_id 并包成两级
  requirements.txt
  .env.example
  pytest.ini             # pythonpath=.
```

## 依赖安装与启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env

MOCK_OPENID=dev_user uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- 健康：`GET http://127.0.0.1:8000/health`
- OpenAPI：`http://127.0.0.1:8000/docs`

## MOCK_OPENID / MOCK_PHONE

| 场景 | 行为 |
|------|------|
| `MOCK_OPENID` 非空 | `code2session` 直接返回该字符串；`get_access_token` 返回 mock |
| 无 MOCK 且无 WX 密钥 | 登录 / 真手机号失败 ValueError → 400 |
| `get_phone_number` | MOCK 或无密钥时：校验 code 非空后返回 `MOCK_PHONE`（默认 13800138000） |

测试 `conftest.py` 强制：

```
MOCK_OPENID=test_user
DATABASE_URL=sqlite:///./test_qingji.db
JWT_SECRET=test-secret
```

## 数据库切换

默认：`DATABASE_URL=sqlite:///./qingji.db`（相对 backend 工作目录）。

Postgres 示例：

```
DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/qingji
```

需自行安装驱动（如 `psycopg2-binary`，**未**写入当前 requirements.txt）。  
SQLAlchemy URL 换掉即可；`create_all` 仍只建表不迁移。

SQLite 开启 `PRAGMA foreign_keys=ON`；`check_same_thread=False`。

## 测试

```bash
cd backend
source .venv/bin/activate
pytest -q
```

覆盖：健康与登录种子、资料与手机绑定、家庭邀请与个人账本隔离、分类树与二级记账校验等（见 `tests/`）。

冒烟（服务已起）：

```bash
./scripts/smoke.sh
# 或 BASE=http://127.0.0.1:8000 ./scripts/smoke.sh
```

## CORS

开发：`allow_origins=["*"]`，credentials/methods/headers 全开。生产应收紧。

## 应用生命周期

`lifespan`：启动时 `Base.metadata.create_all(bind=engine)`。  
`create_all` **不会**给已有表加列。`categories.parent_id` 变更后：

- **新库 / 测试库**：直接 `create_all` + seed（树形）。
- **开发旧库**：可删 `qingji.db` 重建（**勿随意删生产库**）。
- **保留数据**：运行 `python scripts/migrate_categories_tree.py`（加列并把旧扁平分类包成「一级 + 二级其他」）。详见 [data-model.md](./data-model.md)。

## 安全注意

1. 生产更换 `JWT_SECRET`，清空 `MOCK_OPENID`。
2. 明文 `POST /api/me/phone {phone}` 仅便于开发；正式应依赖微信 phone code。
3. 成员校验对非成员返回 404，避免探测账本 id。
4. 金额校验在 schema（`ge=1` 等）与业务双重约束。

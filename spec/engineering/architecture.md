# 整体架构

## 部署形态（目标）

```
┌─────────────────────┐     HTTPS      ┌──────────────────────────────┐
│  微信小程序客户端    │ ─────────────► │  阿里云单机                   │
│  miniprogram/       │   request      │  Nginx/Caddy（TLS + 反代）    │
│  WXML/WXSS/JS       │                │       │                      │
└─────────────────────┘                │       ▼                      │
         │ wx.login                    │  uvicorn · FastAPI           │
         │ getPhoneNumber              │  backend/app                 │
         ▼                             │       │                      │
┌─────────────────────┐                │       ▼                      │
│  微信开放平台 API    │◄── code2session│  SQLite / Postgres / MySQL   │
│  jscode2session 等   │   getuserphonenumber（本机文件或同机服务）     │
└─────────────────────┘                └──────────────────────────────┘
```

- **一台云主机即可**；数据库优先本机，不必另购 RDS。
- 开发期可直连 `http://127.0.0.1:8000`（见下文「不校验合法域名」）。

## 逻辑分层

| 层 | 位置 | 职责 |
|----|------|------|
| 表现 | `miniprogram/pages/*` | Tab 页、二级页、交互 |
| 请求 | `miniprogram/utils/request.js` | 拼 baseURL、Bearer、login |
| API | `backend/app/api/*` | 路由、参数校验、HTTP 错误 |
| 领域服务 | `backend/app/services/*` | 种子、成员校验、微信 HTTP |
| 模型 | `backend/app/models/*` | SQLAlchemy ORM |
| 配置 / 安全 | `backend/app/core/*` | Settings、JWT、Engine |

## 鉴权流

1. 客户端 `POST /api/auth/login` 获 JWT（payload：`sub=user_id`、`openid`、`exp`）。
2. 业务请求头：`Authorization: Bearer <token>`。
3. `get_current_user`（`HTTPBearer`）解码 → 查 `users`；失败 401。
4. 账本相关接口再经 `require_book_member`：非成员统一 **404「账本不存在」**（防枚举）。

## 环境变量

来源：`backend/.env`（模板 `.env.example`），由 `pydantic-settings` 加载。

| 变量 | 默认 / 示例 | 说明 |
|------|-------------|------|
| `WX_APPID` | 空 | 正式小程序 AppID |
| `WX_SECRET` | 空 | 正式密钥 |
| `JWT_SECRET` | `qingji-dev-secret-change-me` | **生产必须更换** |
| `JWT_ALGORITHM` | `HS256` | |
| `JWT_EXPIRE_DAYS` | `30` | |
| `DATABASE_URL` | `sqlite:///./qingji.db` | 可换 Postgres 等 |
| `MOCK_OPENID` | 开发常用 `dev_user` | 非空则跳过真实 code2session |
| `MOCK_PHONE` | `13800138000` | MOCK 下手机号接口返回值 |

## 微信域名与开发不校验

### 开发

1. 微信开发者工具 → 详情 → 本地设置 → **勾选「不校验合法域名…」**。
2. `utils/config.js` 的 `baseURL`：
   - 模拟器：`http://127.0.0.1:8000`
   - 真机调试：电脑局域网 IP，如 `http://192.168.x.x:8000`；后端 `--host 0.0.0.0`。
3. `project.config.json` 中 `urlCheck: false`；AppID 可用 `touristappid` / 测试号。

### 正式版

1. API 必须 **HTTPS** + 合法证书。
2. 微信公众平台 → 开发设置 → 服务器域名 → **request 合法域名** 加入 API 域名。
3. 清空 `MOCK_OPENID`；配置真实 `WX_APPID` / `WX_SECRET`。
4. CORS：当前 `allow_origins=["*"]`，生产建议收紧。

## 金额与删除约定

- 全站金额：**整数「分」**（`amount_cents` / `balance_cents` / `budget_*`）。
- 流水、账户：**软删除** `deleted_at`；列表默认过滤已删。
- 统计只在服务端聚合，客户端不信任自报汇总。

## Schema 变更注意（SQLite）

启动时 `Base.metadata.create_all`，**不会 ALTER 已有表**。本地开发改字段后常需：

```bash
rm -f backend/qingji.db
# 再启动 uvicorn
```

生产换库或迁移方案见 [backend.md](./backend.md) / [roadmap.md](./roadmap.md)。

## 健康检查与文档

| URL | 说明 |
|-----|------|
| `GET /health` | `{ "status": "ok", "app": "轻记" }` |
| `/docs` | Swagger UI（FastAPI 自带） |
| `/redoc` | ReDoc |

## 版本

`FastAPI(title="轻记", version="1.1.0")`。

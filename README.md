# 轻记

轻量记账全栈：FastAPI 后端 + 微信小程序原生前端。产品名「轻记」，与「随手记」无关。

## 目录

```
qingji/
  README.md
  spec/             # 产品与开发文档（详见 spec/README.md）
  backend/          # Python FastAPI
  miniprogram/      # 微信小程序
```

## 产品与开发文档（spec）

完整产品说明与工程契约见 **[spec/](./spec/)**（入口 [spec/README.md](./spec/README.md)）。

| 分区 | 内容 |
|------|------|
| [spec/product/](./spec/product/) | 定位、功能清单与状态、用户流程、信息架构、非目标 |
| [spec/engineering/](./spec/engineering/) | 架构、数据模型、HTTP API、小程序/后端说明、规约、路线图 |

后续迭代请以 spec 为对照；实现以代码为准，规划中能力勿当作已上线。


## 环境要求

- Python 3.11+
- 微信开发者工具（打开小程序）

## 后端启动

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # 可按需修改

# 开发：MOCK_OPENID 开启后，登录不走真实微信 code2session
MOCK_OPENID=dev_user uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

启动后：

- 健康检查：`GET http://127.0.0.1:8000/health`
- API 文档：`http://127.0.0.1:8000/docs`

### 环境变量（见 `.env.example`）

| 变量 | 说明 |
|------|------|
| `WX_APPID` / `WX_SECRET` | 微信小程序凭据；正式环境必填 |
| `JWT_SECRET` | JWT 签名密钥，生产务必更换 |
| `DATABASE_URL` | 默认 `sqlite:///./qingji.db`；可改为 Postgres，如 `postgresql+psycopg2://user:pass@host:5432/qingji` |
| `MOCK_OPENID` | 非空时，登录直接用此 openid（开发推荐） |
| `MOCK_PHONE` | MOCK 下 `getPhoneNumber`/`phone_code` 写死手机号，默认 `13800138000` |

### curl 示例

```bash
# 登录（mock，可附带昵称/头像）
curl -s -X POST http://127.0.0.1:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"code":"dev","nickname":"小橘子","avatar_url":"https://example.com/a.png"}'

# 带 token 拉账本
TOKEN=你的token
curl -s http://127.0.0.1:8000/api/books -H "Authorization: Bearer $TOKEN"

# 冒烟脚本
./scripts/smoke.sh
```

### 测试

```bash
cd backend
source .venv/bin/activate
pytest -q
```

## 小程序：用微信开发者工具打开

1. 安装并打开 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 选择「导入项目」→ 目录选本仓库的 `miniprogram/`
3. AppID 可用测试号 / `touristappid`（`project.config.json` 已写）
4. **详情 → 本地设置**：勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」（开发期访问本机 HTTP 必需）
5. 确认 `utils/config.js` 里 `baseURL`：
   - 模拟器：`http://127.0.0.1:8000`
   - 真机调试：改为电脑局域网 IP，如 `http://192.168.1.8:8000`，并保证手机与电脑同网、后端 `--host 0.0.0.0`
6. 后端需已用 `MOCK_OPENID=dev_user` 启动；小程序 `wx.login` 后把 code 发给后端，mock 模式下忽略真实 code

### 功能页

| Tab | 路径 | 说明 |
|-----|------|------|
| 首页 | `pages/home` | 月支出/收入/预算、最近流水 |
| 流水 | `pages/ledger` | 按日分组 |
| 记一笔 | `pages/record` | 收支切换、大类→小类两级选择、数字键盘 |
| 图表 | `pages/charts` | 分类列表 + 占比条 |
| 我的 | `pages/mine` | 一键登录、自定义昵称/头像、微信手机号、账本管理、预算 |
| （子页） | `pages/books` / `pages/family` / `pages/invite/accept` | 账本列表、家庭成员与邀请、接受邀请 |

主题色：`#FF7A45`（橙），白卡片 + 浅灰底。

## 自有服务器部署要点

1. **后端**：用 systemd / Docker 跑 uvicorn 或 gunicorn+uvicorn workers；设置强 `JWT_SECRET`、真实 `WX_APPID`/`WX_SECRET`，**清空 `MOCK_OPENID`**。
2. **数据库**：生产建议 Postgres；把 `DATABASE_URL` 改掉即可（需自行安装驱动，如 `psycopg2-binary`）。SQLite 适合单机试用，注意文件路径与备份。
3. **HTTPS**：小程序正式版要求 HTTPS；在 Nginx/Caddy 反代到 uvicorn，配置合法证书与域名。
4. **域名白名单**：微信公众平台 → 开发管理 → 开发设置 → 服务器域名，把 API 域名加入 request 合法域名。
5. **CORS**：当前开发期 `allow_origins=["*"]`；生产可收紧为小程序业务域名。
6. **金额**：全站金额以「分」为整数存储，避免浮点误差；接口字段为 `*_cents`。
7. **软删除**：`Record`、`Account` 有 `deleted_at`，列表默认过滤已删。

## 首次登录种子数据

新用户首次 `/api/auth/login` 会自动创建：

- 默认账本「日常账本」
- 常用支出/收入分类（一级大类 + 二级小类）
- 现金 / 微信 / 支付宝 三个账户



## 用户资料与微信登录

用户字段：`openid`、`nickname`（可自定义，不强制等于微信昵称）、`avatar_url`、`phone`、可选 `last_login_at`。

| 接口 | 说明 |
|------|------|
| `POST /api/auth/login` | `code` 换 openid；可附带 `nickname` / `avatar_url`；更新 `last_login_at` |
| `POST /api/auth/phone` | body `{ "code" }`：微信 `getPhoneNumber` 动态令牌 → 后端调 `getuserphonenumber` 写入 `phone`（MOCK 返回 `MOCK_PHONE`） |
| `GET /api/me` | 当前用户 |
| `PATCH /api/me` | `{ "nickname"?, "avatar_url"? }` 自定义资料 |
| `POST /api/me/phone` | `{ "phone_code" }` 或开发明文 `{ "phone" }` |

```bash
TOKEN=你的token

# 改昵称
curl -s -X PATCH http://127.0.0.1:8000/api/me \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"nickname":"自定义昵称"}'

# 微信手机号（MOCK 下任意 code → MOCK_PHONE）
curl -s -X POST http://127.0.0.1:8000/api/auth/phone \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"code":"mock_phone_code"}'
```

小程序「我的」：`chooseAvatar` + `type=nickname` 填写组件、保存资料、`open-type=getPhoneNumber` 授权手机号、微信一键登录（`wx.login` + 可选昵称头像）。

## 个人与家庭

账本 `kind`：`personal`（个人）| `family`（家庭）。新用户默认「日常账本」为个人账本；可另建家庭账本。

| 类型 | 可见性 | 成员 |
|------|--------|------|
| 个人 | 仅 owner | 创建时写入 `book_members`，角色 `owner` |
| 家庭 | `book_members` 共享 | 角色 `owner` / `admin` / `member` |

权限简述：owner 可邀请与移除；admin 可邀请；member 可记账与查看流水/统计。列表 `GET /api/books` 返回当前用户作为成员可见的全部账本（含 `kind`、`role`、`member_count`）。记流水、读流水、统计均校验成员身份。

**开发库 schema 变更**：SQLite 启动时 `create_all`，不自动 ALTER。若本地已有旧 `qingji.db`，请删除后重启：

```bash
rm -f backend/qingji.db
```

## 邀请

家庭账本支持两种邀请：

1. **微信分享**：`POST /api/books/{id}/invites` `{ "channel": "share" }` → 返回 8 位 `code` 与小程序 path `pages/invite/accept?code=XXX`；分享卡片带该 path。
2. **手机号**：`{ "channel": "phone", "phone": "13800138000" }`；被邀请人先 `POST /api/me/phone` 绑定手机号，接受时校验规范化号码一致。

邀请状态：`pending` → `accepted`；过期（默认 7 天）自动视为 `expired`；可扩展撤销为 `revoked`。

### 邀请相关 curl

```bash
TOKEN=你的token

# 创建家庭账本
curl -s -X POST http://127.0.0.1:8000/api/books \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"我家账本","kind":"family"}'

# 分享邀请
curl -s -X POST http://127.0.0.1:8000/api/books/2/invites \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"channel":"share"}'

# 预览邀请（可匿名）
curl -s http://127.0.0.1:8000/api/invites/ABCD1234

# 绑定手机号并接受
curl -s -X POST http://127.0.0.1:8000/api/me/phone \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"phone":"13800138000"}'
curl -s -X POST http://127.0.0.1:8000/api/invites/ABCD1234/accept \
  -H "Authorization: Bearer $TOKEN"

# 成员列表 / 移除
curl -s http://127.0.0.1:8000/api/books/2/members -H "Authorization: Bearer $TOKEN"
curl -s -X DELETE http://127.0.0.1:8000/api/books/2/members/3 -H "Authorization: Bearer $TOKEN"
```

小程序：`我的` → 账本管理（个人/家庭标签、创建家庭）；家庭详情可生成口令/分享/手机号邀请；`pages/invite/accept` 一键加入；`app.js` onLaunch 若带 invite code 会跳转接受页。家庭流水可显示记账人昵称。

## 已知限制

- 图表为分类占比条，非 canvas 饼图
- 预算仅按账本+月份总额，无分类预算
- 转账/多币种未实现
- 小程序记一笔键盘为简化版；`showModal` 设预算依赖基础库对 editable 的支持
- Postgres 需自行加驱动依赖；默认仅测 SQLite

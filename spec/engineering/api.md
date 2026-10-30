# HTTP API 参考

基址：开发默认 `http://127.0.0.1:8000`。  
除特别声明外，业务接口需请求头：

```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

错误体一般为 FastAPI 风格：`{ "detail": "…" }`（字符串或校验数组）。  
鉴权失败：**401**；无权限：**403**；资源对当前用户不可见常返回 **404**（账本）。

以下字段均从 `backend/app/api/*` 与 `schemas/*` 摘录，**未列出的路径视为不存在**。

---

## 约定

| 约定 | 说明 |
|------|------|
| 金额 | `*_cents` 整数，单位分 |
| 日期 | `record_date` 为 `YYYY-MM-DD`；`year_month` 为 `YYYY-MM` |
| 账本权限 | 先 `require_book_member`；非成员 → 404 |
| 可匿名 | 仅 `GET /health`、`GET /api/invites/{code}`、`POST /api/auth/login` |

---

## 健康检查

### `GET /health`

**鉴权**：无。

**响应 200**

```json
{ "status": "ok", "app": "轻记" }
```

---

## 认证 ` /api/auth`

### `POST /api/auth/login`

**鉴权**：无。

**请求体 `LoginRequest`**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| code | string | 建议有 | 微信 login code；MOCK 下可任意 |
| nickname | string\|null | 否 | ≤64；新用户作初始昵称；老用户非空则更新 |
| avatar_url | string\|null | 否 | ≤512 |

**响应 200 `LoginResponse`**

| 字段 | 类型 |
|------|------|
| token | string JWT |
| user | UserOut |

**UserOut**

| 字段 | 类型 |
|------|------|
| id | int |
| openid | string |
| nickname | string |
| avatar_url | string |
| phone | string\|null |
| last_login_at | datetime\|null |

**错误**：400（微信失败 / 未配置密钥且无 MOCK）。

**副作用**：新用户 `seed_user_defaults`；更新 `last_login_at`。

---

### `POST /api/auth/phone`

**鉴权**：需要。

用微信 `getPhoneNumber` 动态令牌换号并绑定。

**请求体 `PhoneCodeRequest`**

| 字段 | 类型 | 必填 |
|------|------|------|
| code | string | 是（1～256） |

**响应 200**：`UserOut`。

**错误**：400 手机号无效 / 已被绑定 / 微信失败。

MOCK：`MOCK_OPENID` 或无密钥时，任意非空 code → `MOCK_PHONE`。

---

## 当前用户 `/api/me`

### `GET /api/me`

**响应 200**：`UserOut`。

### `PATCH /api/me`

**请求体 `MeUpdate`**（至少提供一个字段）

| 字段 | 类型 | 说明 |
|------|------|------|
| nickname | string\|null | 非空，1～64 |
| avatar_url | string\|null | ≤512 |

**错误**：400 未提供字段 / 昵称为空。

### `POST /api/me/phone`

**请求体 `PhoneBind`**（二选一）

| 字段 | 类型 | 说明 |
|------|------|------|
| phone | string\|null | 开发明文；规范化大陆号 |
| phone_code | string\|null | 同微信 phone code |

**响应 200**：`UserOut`。

**错误**：400 未提供 / 格式错 / 已被绑定。

---

## 账本 `/api/books`

### `GET /api/books`

当前用户作为成员可见的全部账本。

**响应 200**：`BookOut[]`

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | |
| name | string | |
| kind | string | personal \| family |
| is_default | bool | |
| role | string\|null | 当前用户在该账本角色 |
| member_count | int\|null | |
| created_at | datetime\|null | |

### `POST /api/books`

**请求体 `BookCreate`**

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| name | string | | 1～64 |
| kind | `"personal"`\|`"family"` | personal | |
| is_default | bool | false | true 时清除自己作为 owner 的其他默认标记 |

**响应 200**：`BookOut`（role=owner, member_count=1）。  
副作用：owner 成员 + 分类/账户种子。

### `GET /api/books/{book_id}`

**响应 200**：`BookOut`。非成员 404。

### `POST /api/books/{book_id}/invites`

仅 `kind=family` 且角色 ∈ {owner, admin}。

**请求体 `InviteCreate`**

| 字段 | 类型 | 说明 |
|------|------|------|
| channel | `"share"`\|`"phone"` | |
| phone | string\|null | channel=phone 时必填 |

**响应 200 `InviteOut`**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | |
| code | string | 8 位 |
| channel | string | |
| phone | string\|null | |
| status | string | pending |
| expires_at | datetime | +7 天 |
| path | string | `pages/invite/accept?code=…` |
| created_at | datetime\|null | |

**错误**：400 非家庭 / channel 非法 / 缺 phone；403 无邀请权；404 非成员。

### `GET /api/books/{book_id}/members`

**响应 200**：`MemberOut[]`

| 字段 | 类型 |
|------|------|
| user_id | int |
| nickname | string |
| phone | string\|null |
| role | string |
| created_at | datetime\|null |

### `DELETE /api/books/{book_id}/members/{user_id}`

**响应 200**：`{ "ok": true }`。

**错误**：403 无管理权 / admin 移 admin；400 移 owner；404 成员不存在。

---

## 邀请 `/api/invites`

### `GET /api/invites/{code}`

**鉴权**：无。code 大小写不敏感（会尝试 upper）。

**响应 200 `InvitePreview`**

| 字段 | 类型 |
|------|------|
| code | string |
| book_name | string |
| book_kind | string |
| inviter_nickname | string |
| status | string |
| expires_at | datetime |

可能把过期 pending 持久化为 expired。

### `POST /api/invites/{code}/accept`

**鉴权**：需要。

**响应 200**

```json
{ "ok": true, "book_id": 1, "already_member": false }
```

**规则摘要**

- status 须为 pending（否则 400：过期/撤销/已用/不可用）
- 账本须存在且 family
- channel=phone：用户须已绑手机且号码一致（否则 400/403）
- 已是成员：标记 accepted，`already_member: true`

---

## 账户 `/api/accounts`

### `GET /api/accounts?book_id=`

**查询**：`book_id` 必填。  
**响应**：`AccountOut[]`（未软删）

| 字段 | 类型 |
|------|------|
| id | int |
| book_id | int |
| name | string |
| balance_cents | int |
| icon | string |
| created_at | datetime\|null |

### `POST /api/accounts`

**请求体 `AccountCreate`**

| 字段 | 类型 | 默认 |
|------|------|------|
| book_id | int | |
| name | string | 1～64 |
| balance_cents | int | 0（≥0） |
| icon | string | cash |

### `DELETE /api/accounts/{account_id}`

软删。**响应** `{ "ok": true }`。404 若不存在或已删。

---

## 分类 `/api/categories`

### `GET /api/categories?book_id=&type=&parent_id=&flat=`

| 查询 | 说明 |
|------|------|
| book_id | 必填 |
| type | 可选 expense \| income |
| parent_id | 可选；传则只返回该父下的直属子类（扁平，无嵌套 children） |
| flat | 可选 bool，默认 false；`true` 时返回扁平列表（含 `parent_id`，`children` 为空） |

**默认（无 parent_id 且 flat=false）**：返回**树**——一级节点带 `children`（二级列表）。

**响应 `CategoryOut[]`**：id, book_id, parent_id, name, type, icon, created_at, children。

### `POST /api/categories`

**请求体 `CategoryCreate`**：book_id, name, type(`expense` | `income`), icon 默认 `default`，**parent_id** 可选。

| parent_id | 含义 |
|-----------|------|
| 省略 / null | 建一级大类 |
| 一级 id | 建二级小类 |

**校验**：父须同账本；父须为一级；父子 type 一致；同级重名 → 400。

**无** 更新 / 删除接口（规划中：有子或有流水时禁止或级联策略待定）。

## 流水 `/api/records`

### `GET /api/records`

| 查询 | 必填 | 说明 |
|------|------|------|
| book_id | 是 | |
| year_month | 否 | YYYY-MM 过滤 |
| type | 否 | expense \| income |
| limit | 否 | 默认 200，1～500 |

**响应 `RecordOut[]`**（未软删，按日期、id 降序）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | |
| book_id / account_id / category_id | int | |
| type | string | |
| amount_cents | int | |
| note | string | |
| record_date | date | |
| created_at | datetime\|null | |
| category_name / category_icon | string\|null | 联表 |
| account_name | string\|null | |
| user_id | int\|null | 记账人 |
| user_nickname | string\|null | |

### `POST /api/records`

**请求体 `RecordCreate`**

| 字段 | 类型 | 说明 |
|------|------|------|
| book_id | int | |
| account_id | int | |
| category_id | int | **须为二级小类**（`parent_id` 非空） |
| type | expense\|income | 须与分类一致 |
| amount_cents | int | ≥1，上限约 1e10 |
| note | string | 默认 "" |
| record_date | date\|null | 默认今天 |

副作用：更新账户余额。  
额外校验：分类须属本账本、type 一致、**且为二级**（记在大类上 → 400）。  
**响应**：`RecordOut`。

### `DELETE /api/records/{record_id}`

软删并回滚余额。本人或 owner/admin。  
**响应** `{ "ok": true }`。

**无** PATCH / 详情专用接口。

---

## 预算 `/api/budgets`

### `GET /api/budgets?book_id=&year_month=`

`book_id` 必填；`year_month` 可选过滤。  
**响应 `BudgetOut[]`**：id, book_id, year_month, amount_cents。

### `POST /api/budgets`

Upsert。

**请求体 `BudgetCreate`**

| 字段 | 类型 |
|------|------|
| book_id | int |
| year_month | YYYY-MM |
| amount_cents | int ≥0 |

---

## 统计 `/api/stats`

### `GET /api/stats/summary?book_id=&year_month=`

二者均必填。

**响应 `SummaryOut`**

| 字段 | 类型 |
|------|------|
| year_month | string |
| expense_cents | int |
| income_cents | int |
| budget_cents | int |
| budget_used_ratio | float | expense/budget，无预算为 0；四舍五入 4 位 |

### `GET /api/stats/by-category?book_id=&year_month=&type=`

| 查询 | 默认 |
|------|------|
| type | expense |

**响应 `CategoryStatsOut`**

| 字段 | 类型 |
|------|------|
| year_month | string |
| type | string |
| total_cents | int |
| items | CategoryStatItem[] |

**CategoryStatItem**：category_id, category_name, category_icon, type, amount_cents, ratio。

---

## 错误码速查

| HTTP | 典型场景 |
|------|----------|
| 400 | 参数非法、邀请状态不可用、分类类型不符、手机号格式 |
| 401 | 未登录 / token 无效 / 用户不存在 |
| 403 | 角色不足、手机号与邀请不匹配、admin 移 admin |
| 404 | 账本对你不可见、邀请不存在、记录/账户不存在 |
| 500 | 邀请码生成极端失败 |

---

## 接口清单总表

| 方法 | 路径 | 鉴权 |
|------|------|------|
| GET | /health | 无 |
| POST | /api/auth/login | 无 |
| POST | /api/auth/phone | 是 |
| GET | /api/me | 是 |
| PATCH | /api/me | 是 |
| POST | /api/me/phone | 是 |
| GET | /api/books | 是 |
| POST | /api/books | 是 |
| GET | /api/books/{id} | 是 |
| POST | /api/books/{id}/invites | 是 |
| GET | /api/books/{id}/members | 是 |
| DELETE | /api/books/{id}/members/{uid} | 是 |
| GET | /api/invites/{code} | 无 |
| POST | /api/invites/{code}/accept | 是 |
| GET | /api/accounts | 是 |
| POST | /api/accounts | 是 |
| DELETE | /api/accounts/{id} | 是 |
| GET | /api/categories | 是 |
| POST | /api/categories | 是 |
| GET | /api/records | 是 |
| POST | /api/records | 是 |
| DELETE | /api/records/{id} | 是 |
| GET | /api/budgets | 是 |
| POST | /api/budgets | 是 |
| GET | /api/stats/summary | 是 |
| GET | /api/stats/by-category | 是 |

**不存在（规划中示例）**：记录 PATCH、分类 PATCH/DELETE、账本 PATCH/DELETE、邀请 revoke、转账、导出、上传。

# 关键用户流程

以下流程与当前小程序 + API 行为一致。步骤中的接口见 [api.md](../engineering/api.md)。

---

## 1. 首次打开 / 冷启动登录

```
用户打开小程序
  → App.onLaunch
      → 读 storage: token / user / bookId
      → 解析启动参数中的邀请 code（若有）→ pendingInviteCode
      → ensureLogin()
           ├─ 已有 token 且 bookId → 直接继续
           └─ 否则 login()
                 → wx.login 取 code
                 → POST /api/auth/login { code [, nickname, avatar_url] }
                 → 存 token、user
                 → GET /api/books → 选 is_default 或首本 → 存 bookId/bookName
      → 若有 pendingInviteCode → navigateTo 接受邀请页
```

**新用户服务端副作用**（`seed_user_defaults`）：

1. 创建用户（默认昵称「轻记用户」或请求中的 nickname）
2. 个人账本「日常账本」`kind=personal`、`is_default=true`
3. `book_members` 写入 owner
4. 默认支出/收入一二级分类树 + 现金/微信/支付宝账户

**验收点**

- 健康：`GET /health` → `ok`
- 登录返回 `token` + `user`
- `GET /api/books` 至少 1 本

---

## 2. 记一笔（支出或收入）

```
用户点 Tab「记一笔」
  → onShow → ensureLogin → loadMeta
       → GET /api/categories?book_id=&type=   （树：一级 + children）
       → GET /api/accounts?book_id=
  → 切换「支出/收入」→ 重新拉分类树
  → 点选「大类」宫格 → 下方展示该大类下「小类」
  → 点选「小类」（须选二级；不能只选大类提交）
  → （可选）ActionSheet 选账户
  → 数字键盘输入金额（元，最多两位小数）
  → （可选）填备注
  → 点完成
       → POST /api/records
            { book_id, account_id, category_id(/* 二级 */), type, amount_cents, note }
       → 成功 toast「已记一笔」→ switchTab 首页
```

**服务端规则**

- 校验当前用户是账本成员
- 分类属于该账本且 `category.type == body.type`
- **分类必须是二级小类**（`parent_id` 非空）；记在大类上 → 400
- 账户未软删
- 支出：`account.balance_cents -= amount`；收入：`+=`
- `record_date` 省略则为当天（UTC 日期对象按服务端 `date.today()`）

**失败常见原因**：金额 ≤ 0、未选小类/账户、误传一级分类、未登录、非成员。

---

## 3. 查看流水与首页复盘

### 3.1 首页

```
Tab「首页」onShow
  → GET /api/stats/summary?book_id=&year_month=YYYY-MM
  → GET /api/records?book_id=&year_month=&limit=8
  → 展示支出/收入/预算/占用条 + 最近流水
```

### 3.2 流水 Tab

```
Tab「流水」onShow
  → summary + records limit=200（当月）
  → 前端按 record_date 分组，日维度展示支出/收入小计
  → 家庭账本条目可显示 user_nickname
```

**未实现**：点进详情、左滑删除、月份切换、类型筛选 UI。

---

## 4. 创建个人 / 家庭账本

```
我的 → 账本管理（pages/books）
  → GET /api/books
  → Tab 筛选：全部 / 个人 / 家庭
  → 「新建个人」或「创建家庭」
       → showModal 输入名称
       → POST /api/books { name, kind }
       → 家庭创建成功可跳转 pages/family?id=
  → 点账本 → 设为当前 bookId（本地）
  → 家庭账本可进「家庭详情」
```

**服务端**：创建时写入 owner 成员 + `seed_book_defaults`（分类与账户）。

---

## 5. 邀请家人（分享）

### 邀请人

```
家庭详情 pages/family
  → 点「分享邀请」
       → POST /api/books/{id}/invites { channel: "share" }
       → 得到 code + path；复制口令到剪贴板
  → （可选）系统分享：onShareAppMessage 使用 lastInvite.path
```

### 被邀请人

```
打开小程序 path: pages/invite/accept?code=XXX
  （或冷启动带 query.code → App 跳转接受页）
  → ensureLogin
  → GET /api/invites/{code}（可匿名预览）
  → 点「加入」
       → POST /api/invites/{code}/accept（需登录）
       → 写入 book_members role=member
       → 切换当前 bookId → 回首页
```

**边界**

| 情况 | 行为 |
|------|------|
| 已过期 | status=expired，接受 400 |
| 已接受 | 400「邀请已被使用」 |
| 已是成员 | 仍标记 accepted，返回 `already_member: true` |
| 非 family 账本 | 不可创建邀请 / 不可加入 |

---

## 6. 手机号邀请

### 邀请人

```
家庭详情 → 「手机号邀请」
  → 输入对方手机号
  → POST …/invites { channel: "phone", phone }
```

### 被邀请人

```
接受页
  → 若无 phone：先「绑定手机号」→ POST /api/me/phone { phone }
     或「我的」里微信授权 → POST /api/auth/phone { code }
  → 再 accept
  → 服务端比对 normalize(user.phone) == invite.phone
```

**不匹配** → 403「手机号与邀请不匹配」。

---

## 7. 修改昵称 / 头像 / 绑手机

```
我的页
  → chooseAvatar → 本地预览 pendingAvatar
  → type=nickname 输入框改昵称
  → 「保存昵称/头像」→ PATCH /api/me { nickname, avatar_url? }
  → 「微信授权手机号」→ POST /api/auth/phone { code }
  → 「手动绑定」（开发）→ POST /api/me/phone { phone }
  → 「微信一键登录」→ login(profile) 刷新 token 与资料
```

**注意**：`chooseAvatar` 返回的多为微信临时文件路径；未配置上传时，正式环境头像 URL 可能无法跨端访问——属已知「部分」能力。

---

## 8. 设置本月预算

```
我的 → 本月预算
  → showModal 输入元（如 3000）
  → POST /api/budgets { book_id, year_month, amount_cents }
  → 首页 summary 反映 budget_cents 与 budget_used_ratio
```

同一 `book_id + year_month` 再次提交为更新（upsert）。

---

## 9. 移除家庭成员

```
家庭详情 → 成员列表 → 移除
  → DELETE /api/books/{id}/members/{user_id}
  → 仅 owner/admin；不能移除 owner；admin 不能移除 admin
```

---

## 10. 图表查看分类占比

```
Tab「图表」
  → 切换支出/收入
  → GET /api/stats/by-category?book_id=&year_month=&type=
  → 列表 + 宽度条表示占比
```

无饼图、无跨月趋势（规划中）。

---

## 流程与页面对照

| 流程 | 主页面 |
|------|--------|
| 登录 | App + 各页 ensureLogin |
| 记一笔 | `pages/record/record` |
| 流水 / 首页 | `pages/ledger` / `pages/home` |
| 账本 | `pages/books` |
| 家庭 / 邀请 | `pages/family`、`pages/invite/accept` |
| 资料 / 预算 | `pages/mine` |
| 图表 | `pages/charts` |

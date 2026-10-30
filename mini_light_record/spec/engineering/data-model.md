# 数据模型

以 `backend/app/models/*` 为准。金额单位：**分（整数）**。

## ER 关系（简图）

```
users 1──* books（user_id = 创建者）
users 1──* book_members *──1 books
users 1──* invites（inviter / accepted_by）
books 1──* invites
books 1──* accounts / categories / records / budgets
users 1──* records / accounts / categories / budgets（创建者冗余）
```

## 表：users

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK int | |
| openid | str(64) unique index | 微信 openid；MOCK 时为配置值 |
| nickname | str(64) default `轻记用户` | 可自定义 |
| avatar_url | str(512) default `""` | |
| phone | str(20) unique nullable index | 规范化大陆手机号 |
| created_at | datetime tz | server_default now |
| last_login_at | datetime tz nullable | 登录时更新 |

## 表：books

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| user_id | FK users | 创建者 / 名义 owner |
| name | str(64) | |
| kind | str(16) default `personal` | **`personal` \| `family`** |
| is_default | bool | 用户维度「默认账本」标记 |
| created_at | datetime tz | |

**未实现字段（Canvas 有、代码无）**：`currency`、`archived`。

## 表：book_members

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| book_id | FK books | |
| user_id | FK users | |
| role | str(16) default `member` | **`owner` \| `admin` \| `member`** |
| created_at | datetime tz | |

唯一约束：`(book_id, user_id)`。

**权限（代码）**

| 动作 | 允许角色 |
|------|----------|
| 读账本 / 记账 / 看流水统计 | 任意成员 |
| 创建邀请 | owner, admin（`INVITE_ROLES`） |
| 移除成员 | owner, admin（`MANAGE_ROLES`）；不可移 owner；admin 不可移 admin |
| 删他人流水 | owner, admin；否则仅本人 |

## 表：invites

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| book_id | FK books | |
| inviter_id | FK users | |
| code | str(16) unique | 默认 8 位 A-Z0-9 |
| channel | str(16) | **`share` \| `phone`** |
| phone | str(20) nullable | phone 渠道时的目标号 |
| status | str(16) default `pending` | **`pending` \| `accepted` \| `revoked` \| `expired`** |
| expires_at | datetime tz | 创建时 +7 天 |
| accepted_by | FK users nullable | |
| created_at | datetime tz | |

`refresh_invite_status`：pending 且过期 → 写 `expired`。  
**无**撤销邀请的 HTTP API（`revoked` 预留）。

## 表：accounts

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| user_id | FK | 创建者 |
| book_id | FK | |
| name | str(64) | |
| balance_cents | int default 0 | |
| icon | str(32) default `cash` | 如 cash/wechat/alipay |
| deleted_at | datetime nullable | 软删 |
| created_at | | |

## 表：categories

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| user_id | FK | |
| book_id | FK | |
| parent_id | FK categories.id nullable | **`NULL` = 一级大类**；指向一级 = **二级小类** |
| name | str(64) | |
| type | str(16) | **`expense` \| `income`**（注意：字段名是 `type`，不是 Canvas 的 `kind`） |
| icon | str(32) default `default` | |
| created_at | | |

无软删、无 system 标记（种子与用户自建结构相同）。

### 层级与唯一性规则

- 最多两级：二级的 `parent_id` 必须指向**一级**（其 `parent_id IS NULL`）；不可再挂三级。
- 一级与二级的 `type` 必须一致。
- 同账本同 `type` 下，一级 `name` 唯一；同一 `parent_id` 下二级 `name` 唯一。
- **记账 `records.category_id` 只能指向二级小类**（`parent_id IS NOT NULL`）；API 创建流水时校验。

### 迁移（SQLite）

- **新库**：`create_all` 直接含 `parent_id`，再由 seed 写入树。
- **已有扁平库**：勿随意 wipe 生产数据。开发可删 `qingji.db` 重建；保留数据时运行 `backend/scripts/migrate_categories_tree.py`：
  1. `ALTER TABLE` 增加 `parent_id`（若不存在）；
  2. 每个旧扁平分类：新建同名一级，原行改为挂在其下的二级「其他」（`category_id` 不变，历史流水仍有效）。

## 表：records

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| user_id | FK | 记账人 |
| book_id | FK | |
| account_id | FK | |
| category_id | FK | |
| type | str(16) | **`expense` \| `income`** |
| amount_cents | int | > 0 |
| note | text default `""` | |
| record_date | date index | |
| deleted_at | datetime nullable | 软删 |
| created_at | | |

**无** `to_account_id`（转账未做）、无票据字段。

## 表：budgets

| 字段 | 类型 | 说明 |
|------|------|------|
| id | PK | |
| user_id | FK | 写入者 |
| book_id | FK | |
| year_month | str(7) | `YYYY-MM` |
| amount_cents | int | |
| created_at / updated_at | | |

唯一约束：`(user_id, book_id, year_month)`。  
Upsert 查询按 **`book_id + year_month`** 取第一条更新（家庭场景下以账本月预算为准）。

## 默认种子（seed）

结构：一级大类 + 若干二级小类（见 `services/seed.py`）。

### 支出（一级 → 二级示例）

| 一级 | icon | 二级 |
|------|------|------|
| 餐饮 | food | 外卖、堂食、零食饮料 |
| 购物 | shopping | 服饰、数码、日用 |
| 交通 | transport | 公交地铁、打车、加油停车 |
| 生活 | home | 通讯、日杂、宠物 |
| 住房 | home | 房租房贷、水电燃气、物业维修 |
| 娱乐 | entertainment | 影视游戏、出行游玩 |
| 医疗 | medical | 药品、就诊 |
| 教育 | education | 学费培训、书籍文具 |
| 其他 | other | 其他支出 |

### 收入

| 一级 | icon | 二级 |
|------|------|------|
| 工资 | salary | 基本工资、加班补贴 |
| 奖金 | bonus | 年终奖、绩效奖金 |
| 理财 | invest | 利息分红、投资收益 |
| 红包 | redpacket | 红包礼金 |
| 其他 | other | 其他收入 |

### 账户

现金 cash、微信 wechat、支付宝 alipay（余额 0）。

## 与 Canvas 字段对照

| Canvas | 代码 | 备注 |
|--------|------|------|
| users.nickName | nickname | 蛇形命名 |
| books.owner_id | user_id | 另有 book_members |
| categories.kind | categories.type | |
| records.remark | note | |
| records.receiptFileIds | — | 未实现 |
| books.currency / archived | — | 未实现 |

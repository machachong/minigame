# 路线图

状态对照：代码已落地 vs 建议下一步。优先级：P0 高 / P1 中 / P2 低。

## 已完成（一期主路径）

| 项 | 说明 |
|----|------|
| 微信登录 + JWT（含 MOCK） | auth/login |
| 用户资料与手机号 | me、auth/phone |
| 个人 / 家庭账本与成员 | books、members |
| 分享 + 手机号邀请 | invites |
| 记支出/收入、流水列表、软删 API | records |
| 默认分类/账户种子（一二级树） | seed |
| 分类 parent_id 树 + 记一笔两级选择 | categories / record |
| 月汇总 + 分类占比 API/页 | stats |
| 账本×月预算 | budgets |
| 五 Tab 原生小程序 | home/ledger/record/charts/mine |
| 基础测试与 smoke 脚本 | tests、scripts/smoke.sh |

## 建议下一步

### P0 — 可立即提升可用度

| 项 | 说明 | 涉及 |
|----|------|------|
| 正式微信登录与域名部署 | 配 WX_APPID/SECRET、HTTPS、request 合法域名、关 MOCK | 运维、architecture |
| 流水删除 / 详情 UI | 接已有 DELETE；可选确认弹窗 | miniprogram ledger |
| 记一笔日期选择 | API 已支持 `record_date` | record 页 |
| 头像上传或稳定 URL | 避免临时路径；本机磁盘或 OSS | backend + mine |
| SQLite→Postgres 迁移说明与驱动 | 单机生产更稳 | requirements、backend.md |

### P1 — 补齐「部分」能力

| 项 | 说明 |
|----|------|
| 分类管理页 | 树列表/新建一级二级/（删改）；API 已有 GET 树与 POST |
| 账户管理页 | 列表/新建/软删；余额展示 |
| 流水筛选与换月 | 调已有 query；UI 加月份与 type |
| 邀请撤销 API | 模型已有 `revoked` |
| 成员角色变更 | admin 任命等 |
| 隐私政策入口 | 我的页链到静态页 |

### P2 — 体验增强（原 Canvas / 二期）

| 项 | 说明 |
|----|------|
| Canvas 饼图 + 近 6～12 月趋势 | 新 stats 接口或扩展 |
| 转账 | 模型加 to_account_id；type=transfer |
| 分类预算与告警 | 新表或扩展 budgets |
| 记录编辑 PATCH | 回滚并重算余额 |
| 账本改名/归档/删除 | books 扩展 |
| CSV/Excel 导出 | 新 API |
| 语音/图片记账 | 上传与识别 |
| 回收站恢复 | 基于 deleted_at |
| uni-app 多端 | **规划中**；当前坚持原生，迁移成本需单独立项 |
| 家庭细权（只读）/ 审批流 | 角色扩展 |

## 明确不排期（除非改 non-goals）

- 静默抓取微信/支付宝账单
- 账本市场、会员订阅（无模型前）
- 强制云数据库

## 迭代建议节奏

1. **先 P0 部署**：真实用户 openid 分开，否则 MOCK 共用一人。
2. **再补流水删除与日期**：与已有 API 对齐，改动面小。
3. **管理页（分类/账户）**：减少对 ActionSheet/种子的依赖。
4. **图表与转账**：产品差异化，需设计与模型评审。

更新本文件时：把「已完成」从表中移到上一节，并同步 `features.md` 状态。

# 代码规约与迭代约定

## 总则

1. **实现真相在代码**；`spec/` 描述当前行为与规划。改行为时**同步更新 spec**。
2. **不要编造接口**：小程序只调用 [api.md](./api.md) 已列出的路径。
3. **金额一律分**：库字段与 JSON 用 `*_cents`；UI 层再转元。
4. **软删除**：流水与账户用 `deleted_at`；查询默认过滤。
5. **文档语言**：面向用户的说明与本仓库 spec 使用**简体中文**。

## 后端

| 项 | 约定 |
|----|------|
| 路由前缀 | `/api/<资源>`；路由器在 `main.py` include |
| 依赖注入 | `Depends(get_db)`、`Depends(get_current_user)` |
| 账本访问 | 统一 `require_book_member` / `require_role` |
| Schema | 入参/出参放 `app/schemas/`；`model_config = from_attributes` |
| 微信 IO | 只在 `services/wx.py` |
| 错误 | `HTTPException`；对用户文案简短中文 |
| 测试 | 新行为补 `tests/`；家庭/权限类必测隔离 |

## 小程序

| 项 | 约定 |
|----|------|
| 请求 | 只经 `utils/request.js`，禁止散落写死域名 |
| 登录 | 页面 `onShow` 调 `ensureLogin` |
| 当前账本 | 读写 `getApp().globalData.bookId`（及 storage） |
| 新页面 | 注册 `app.json`；非 Tab 用 `navigateTo` |
| 样式 | 主题色 `#FF7A45`；复用 `app.wxss` 工具类 |

## 分支与变更注意

- 本仓库可为单人迭代；若使用 Git：功能分支 → 合并前跑 `pytest -q`。
- **破坏性 schema 变更**：在 PR/说明中写明是否需删本地 `qingji.db`；生产需迁移方案后再改。
- 同时改前后端契约时：先落地后端 + 测例 → 更新 api.md → 再改小程序。
- 不提交：`.venv/`、本地 `*.db`、真实 `.env` 密钥（保留 `.env.example`）。

## 如何按 spec 迭代

1. 在 [features.md](../product/features.md) / [roadmap.md](./roadmap.md) 选一条「规划中」或「部分」。
2. 若需新表/字段 → 改 models → 更新 [data-model.md](./data-model.md)。
3. 若需新 API → 实现路由/schema → 更新 [api.md](./api.md) → 加测试。
4. 小程序接好 → 更新 [miniprogram.md](./miniprogram.md) / [user-flows.md](../product/user-flows.md)。
5. 状态改为「已实现」；从 roadmap 勾掉或降级优先级。
6. 根 README 仅保留快速开始；细节链到 `spec/`，避免 README 膨胀成第二份文档。

## 禁止事项（工程向）

- 在未清 MOCK 的生产环境上线。
- 客户端信任自报的汇总金额当权威。
- 把随手记等品牌资源拷入项目。
- 为实现功能去静默抓取微信/支付宝账单（见 non-goals）。

# 轻记 · 产品与开发文档（spec）

本目录是「轻记」微信小程序的**权威规格说明**：产品范围、用户流程、信息架构，以及后端 API、数据模型、小程序对接与迭代路线。

> **原则**：以仓库代码（`backend/`、`miniprogram/`）为实现真相；架构 Canvas 仅作早期设计参考。未落地能力一律标为「规划中」，勿当作已上线功能。

## 阅读顺序（推荐）

| 顺序 | 文档 | 适合谁 |
|------|------|--------|
| 1 | [product/overview.md](./product/overview.md) | 产品 / 新人：定位与范围 |
| 2 | [product/features.md](./product/features.md) | 产品 / 研发：功能清单与状态 |
| 3 | [product/user-flows.md](./product/user-flows.md) | 产品 / 测试：关键路径 |
| 4 | [product/ia-and-ui.md](./product/ia-and-ui.md) | 设计 / 前端：五 Tab 与页面 |
| 5 | [product/non-goals.md](./product/non-goals.md) | 全员：明确不做 |
| 6 | [engineering/architecture.md](./engineering/architecture.md) | 后端 / 运维：整体架构与部署 |
| 7 | [engineering/data-model.md](./engineering/data-model.md) | 后端：表与关系 |
| 8 | [engineering/api.md](./engineering/api.md) | 前后端：HTTP 接口契约 |
| 9 | [engineering/miniprogram.md](./engineering/miniprogram.md) | 前端：页面与请求层 |
| 10 | [engineering/backend.md](./engineering/backend.md) | 后端：目录、启动、测试 |
| 11 | [engineering/conventions.md](./engineering/conventions.md) | 全员：迭代规约 |
| 12 | [engineering/roadmap.md](./engineering/roadmap.md) | 产品 / 研发：下一步优先级 |

## 目录树

```
spec/
  README.md                 ← 本索引
  product/
    overview.md
    features.md
    user-flows.md
    ia-and-ui.md
    non-goals.md
  engineering/
    architecture.md
    data-model.md
    api.md
    miniprogram.md
    backend.md
    conventions.md
    roadmap.md
```

## 相关入口

| 资源 | 路径 / 链接 |
|------|-------------|
| 项目 README | [/workspace/qingji/README.md](../README.md) |
| 后端代码 | `backend/` |
| 小程序代码 | `miniprogram/` |
| 架构 Canvas（设计稿，可能与代码有差异） | [记账小程序 · 架构与原型说明](https://cursor.com/canvas/store-76f33925-6dfd-4987-86a4-43739b712cf5/e25955da-5075-4ff2-8b6f-f4ccfe38501d) |
| 本地 API 文档（启动后端后） | `http://127.0.0.1:8000/docs` |

## 状态图例（全文通用）

| 标记 | 含义 |
|------|------|
| **已实现** | 后端 + 小程序主路径可用（或仅后端已就绪且前端有调用） |
| **部分** | 后端有接口、前端缺页/缺交互，或仅实现子集 |
| **规划中** | 产品愿景或 Canvas 提到，当前代码未实现 |

## 维护约定

1. **改行为先改代码，再同步本目录**；PR / 迭代说明应指出更新了哪些 spec 文件。
2. 新增 HTTP 接口必须同时更新 [engineering/api.md](./engineering/api.md) 与相关 schema。
3. 新增表字段必须更新 [engineering/data-model.md](./engineering/data-model.md)；SQLite 无自动迁移，见后端文档。
4. 功能从「规划中」落地后，改 [product/features.md](./product/features.md) 状态，并视情况更新 roadmap。

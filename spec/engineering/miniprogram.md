# 小程序前端说明

根目录：`/workspace/qingji/miniprogram/`  
技术：**微信原生**（WXML / WXSS / JS），非 uni-app。

## 目录结构

```
miniprogram/
  app.js                 # 全局：登录、账本、邀请码
  app.json               # 页面路由、tabBar、窗口样式
  app.wxss               # 全局样式
  project.config.json    # 开发者工具配置（touristappid, urlCheck:false）
  sitemap.json
  images/                # Tab 图标（home/ledger/record/charts/mine ± active）
  utils/
    config.js            # baseURL
    request.js           # request / login / formatYuan / currentYearMonth
  pages/
    home/                # Tab 首页
    ledger/              # Tab 流水
    record/              # Tab 记一笔
    charts/              # Tab 图表
    mine/                # Tab 我的
    books/               # 账本管理
    family/              # 家庭成员与邀请
    invite/accept.*      # 接受邀请
```

每个页面标准四件套：`.js` / `.wxml` / `.wxss` / `.json`。

## 页面路由（app.json）

| path | Tab? | 调用的主要 API |
|------|------|----------------|
| pages/home/home | ✓ | stats/summary, records |
| pages/ledger/ledger | ✓ | stats/summary, records |
| pages/record/record | ✓ | categories, accounts, POST records |
| pages/charts/charts | ✓ | stats/by-category |
| pages/mine/mine | ✓ | PATCH me, auth/phone, me/phone, books, budgets, login |
| pages/books/books | | books CRUD 列表与创建 |
| pages/family/family | | books/{id}, members, invites |
| pages/invite/accept | | invites/{code}, accept, me/phone |

## config 与 request

### `utils/config.js`

```js
module.exports = { baseURL: 'http://127.0.0.1:8000' }
```

真机调试改为局域网 IP；正式环境改为 `https://你的域名`。

### `utils/request.js`

| 导出 | 作用 |
|------|------|
| `request(options)` | `wx.request` 封装；自动 Bearer；2xx resolve；401 清 token |
| `login(profile?)` | `wx.login` → `POST /api/auth/login`（可带 nickname/avatar_url） |
| `formatYuan(cents)` | 分 → `"12.34"` |
| `currentYearMonth()` | 本地日期 `YYYY-MM` |
| `baseURL` | 透出配置 |

`options`：`{ url, method, data, header }`；`url` 为相对路径（如 `/api/books`）。

## 登录与 token 存储

| 键 | 存储 | 说明 |
|----|------|------|
| token | `wx.setStorageSync` + `globalData.token` | JWT |
| user | 同上 | UserOut |
| bookId / bookName | 同上 | 当前账本 |

`App.ensureLogin()`：

1. 若已有 token 且 bookId → resolve
2. 否则 `login()` → 写 token/user → `loadDefaultBook()`（GET books，选 default 或首本）

`App.onLaunch`：恢复 storage；解析邀请 code；ensureLogin 后若有邀请则 `navigateTo` 接受页。

## 与后端对接要点

1. **金额**：UI 用元字符串；提交 `Math.round(parseFloat(amountStr) * 100)`。
2. **年月**：一律客户端 `currentYearMonth()`，与后端 `year_month` 对齐。
3. **账本上下文**：所有记账/统计请求带当前 `globalData.bookId`；切换账本只改本地，不调后端。
4. **401**：`request` 清 token；页面需再次 `ensureLogin`（多数在 onShow）。
5. **错误展示**：`e.detail` 常为后端 detail 字符串；用 toast。
6. **分享**：`family.js` 的 `onShareAppMessage` 依赖先创建 share 邀请得到 `path`。
7. **头像**：`chooseAvatar` 临时路径直接 PATCH 时，正式环境可能无效；上传能力规划中。
8. **开发者工具**：须勾选不校验合法域名；后端需已启动且建议 `MOCK_OPENID=dev_user`。

## 各页行为摘要

### home

- 展示月支出/收入/预算占用、最近 8 笔
- `goLedger` / `goRecord` → `switchTab`

### ledger

- 当月最多 200 条，按日分组；显示 `user_nickname`
- **无**删除、详情、筛选 UI（API 有 DELETE records）

### record

- type 切换重载**分类树**；先选一级大类，再选二级小类（不能只选大类提交）
- 默认选第一大类下的第一小类、第一账户
- 简化键盘；无日期选择器（服务端记当天）
- 成功后回首页

### charts

- 支出/收入切换；占比条最小宽度约 2%

### mine

- 资料、手机、账本入口、预算 Modal、重新登录（清 storage 再 ensureLogin）

### books / family / invite

见 [user-flows.md](../product/user-flows.md)。

## 样式主题

- 导航栏 / 选中 Tab：`#FF7A45`
- 页面背景：`#F7F8FA`
- 全局工具类：`app.wxss`（card、muted、row、amount-* 等）

## 已知前端限制

| 项 | 说明 |
|----|------|
| 无分包 | 页面少，单包即可 |
| 无 npm 构建 | 纯原生 |
| Modal editable | 预算/建账本依赖基础库对 `showModal.editable` 的支持 |
| 流水不可删 | 后端可删，UI 未接 |
| 分类/账户管理页 | 缺失 |

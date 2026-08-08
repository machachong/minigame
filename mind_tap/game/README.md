# 敲到成佛 - 小游戏工程

## 快速开始

```bash
# 1. 安装依赖(仅 TypeScript,用于编译)
npm install

# 2. 开发模式:tsc 监听编译 src → dist
npm run watch

# 3. 微信开发者工具打开本目录(game/),即可预览
```

## 目录结构

```
game/
├── game.js              # 入口(require dist/main.js)
├── game.json            # 小游戏配置(竖屏/开放数据域)
├── project.config.json  # 开发者工具工程配置
├── tsconfig.json        # TS 编译配置(src → dist)
├── src/                 # TypeScript 源码
│   ├── main.ts          # 启动入口
│   ├── Game.ts          # 组合根(装配系统/场景/生命周期)
│   ├── core/            # 框架:渲染/循环/场景/事件/存储/音频/补间
│   ├── ui/              # 自研组件:Node/Button/Label/Panel/Toggle/Toast
│   ├── scenes/          # 场景:启动/主页/修行/功课/排行/设置
│   ├── systems/         # 业务:功德/境界/连击/日常/皮肤/同步/分享/广告/埋点
│   ├── data/            # 配置表(configs.ts 调参)+ 文案(strings.ts)
│   └── utils/           # 格式化/对象池
├── dist/                # tsc 编译产物(勿手改)
├── cloud/               # 云函数(login/syncProfile/offlineCalc/dailyClaim)
└── open-data/           # 开放数据域(好友功德榜)
```

## 开发流程

1. 改 `src/` 下的 TS 代码,`npm run watch` 自动编译到 `dist/`
2. 微信开发者工具自动热重载
3. 真机预览:开发者工具 → 预览 → 扫码

## 调参入口

| 要改什么 | 改哪里 |
|---|---|
| 手感(按压/飘字/连击/防抖) | `src/data/configs.ts` 的 `FEEL` |
| 境界数值/解锁 | `LEVELS` |
| 皮肤加成/音色/配色 | `SKINS` |
| 每日功课/奖励 | `DAILY_TAP_GOAL` / `DAILY_REWARDS` |
| 离线收益 | `OFFLINE_*` |
| 云同步/防刷 | `SYNC_CONFIG` |
| 文案/偈语 | `src/data/strings.ts` |

## 部署前必改

1. `src/data/configs.ts` → `CLOUD_ENV` 改为真实云环境 ID
2. `src/data/configs.ts` → `AD_UNIT_ID` 填真实广告位 ID,`DEV_MOCK_ADS` 改为 `false`
3. `project.config.json` → `appid` 改为真实 AppID
4. 云函数:开发者工具 → `cloud/` 下每个函数右键 → 上传并部署(云端安装依赖)
5. `src/data/configs.ts` → `BGMS` 填入云存储音频 URL(素材上传后)

## 测试

参考 `../spec/test-plan.md`(64 条用例 + 门禁)。

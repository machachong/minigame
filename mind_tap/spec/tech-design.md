# 《敲到成佛》技术选型与技术方案

> 版本:V1.0 | 2026-08-08 | 配套:`prd.md`(两期需求)、`design.md`(产品设计)
> 定位:个人开发者可执行、面向两期渐进式开发的完整技术方案。

---

## 一、技术选型

| 层 | 选型 | 理由 | 备选/迁移路径 |
|---|---|---|---|
| 游戏框架 | **微信原生小游戏(Canvas 2D + TypeScript)** | 玩法 = 点击 + UI + 音效 + 轻量动画,无引擎依赖;包体最小、启动最快;无引擎学习成本 | 二期特效量超舒适区 → Cocos Creator 3.x(仅代码层需重写,数据/云函数可复用) |
| 渲染 | Canvas 2D 自绘 + 自研轻量 UI 树 | 小游戏无 DOM;本项目面板场景(主页/境界/皮肤/设置)用自研组件足够 | — |
| 构建 | TypeScript 编译(tsc)或直接微信开发者工具 TS 工程;`miniprogram-ci` 用于 CI 上传 | 无外部打包器依赖,简单可控 | 需要模块化增强时引入 Rollup |
| 音频 | 敲击音 **WebAudio 合成**;BGM 用 InnerAudioContext | 木鱼"咚"= 约 180Hz 正弦 + 60ms 衰减包络,零音频文件;iOS 需首次触摸后激活 AudioContext(首个点击前静默属正常) | 音色商店(二期)可换采样音频文件 |
| 后端 | **微信云开发**(云函数 + 云数据库 + 云存储) | openid 免鉴权、免运维、天然抗爬;离线结算与防刷放服务端 | 用户量大后迁独立后端(云函数 → 自建 API) |
| 排行榜 | 开放数据域(subContext + sharedCanvas) | 微信唯一官方好友榜方案 | — |
| 分享 | Canvas 离屏绘制 → 图片 + `wx.shareAppMessage` 带参 | 每日一偈、境界突破、拉新 | — |
| 广告 | 激励视频 `wx.createRewardedVideoAd`(流量主) | 个人主体唯一变现方式 | 企业主体后加虚拟支付(二期) |

**关键决策说明**:
1. **不上引擎**:一期全部系统(UI/粒子/谱面)原生可实现,省去引擎包体(~3-5MB)与学习成本;迁移路径已预留。
2. **敲击音合成而非采样**:木鱼音用振荡器合成,包体零占用且可程序化生成多种"音色"(为二期音色商店铺路)。
3. **云开发而非自建服务器**:个人开发者最省事的方案,且云函数天然隔离 openid,防刷能力强。

---

## 二、总体架构

```
┌──────────────────────────────────────────────┐
│  主域(游戏逻辑)                               │
│  ┌───────────┐  ┌───────────┐  ┌──────────┐  │
│  │ 场景管理   │  │ 输入系统   │  │ UI 框架   │  │
│  │ SceneStack│  │ 敲击判定   │  │ 组件树    │  │
│  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  │
│        └───────┬──────┴──────┬───────┘        │
│            ┌───▼─────┐  ┌───▼─────────┐       │
│            │ 数值系统 │  │ 各业务系统  │       │
│            │ Merit   │  │ Daily/Offline│      │
│            └───┬─────┘  │ Share/Ad/...│      │
│                └───┬────┴──────┬──────┘       │
│            ┌───▼─────┐  ┌───▼─────┐           │
│            │ 存档服务  │  │ 音频系统 │           │
│            │ 本地镜像  │  │ 合成+BGM │           │
│            └───┬─────┘  └─────────┘           │
└────────────────┼──────────────────────────────┘
                 │ postMessage(仅分数/昵称等)
        ┌────────▼────────┐   ┌──────────────────┐
        │ 开放数据域(榜)   │   │ 云开发            │
        │ sharedCanvas 渲染│   │ 云函数:login/     │
        │                 │   │ syncProfile/      │
        │                 │   │ offlineCalc/rank  │
        └─────────────────┘   └─────────┬────────┘
                                        │
        ┌───────────────┐   ┌───────────▼────────┐
        │ 微信能力        │   │ 云数据库            │
        │ 震动/分享/广告/ │   │ users / profiles /  │
        │ Canvas 分享图  │   │ events              │
        └───────────────┘   └────────────────────┘
```

**数据流约定**:本地(镜像,秒开)→ 云(权威,异步同步);展示一律读本地,结算/校验/离线一律走云函数。

---

## 三、工程结构

```
mind_tap/
├── spec/                      # 文档:prd / design / tech-design / launch-checklist
├── game/                      # 小游戏工程(微信开发者工具打开)
│   ├── game.js / game.json / project.config.json
│   ├── src/
│   │   ├── main.ts            # 入口:初始化、首帧、场景挂载
│   │   ├── core/
│   │   │   ├── GameLoop.ts    # RAF 主循环 + 按需渲染(帧节流)
│   │   │   ├── Scene.ts       # 场景基类 + SceneStack 栈式切换
│   │   │   ├── EventBus.ts    # 全局事件总线(typed)
│   │   │   ├── Storage.ts     # 本地读写抽象(JSON + 版本迁移)
│   │   │   ├── AudioMgr.ts    # 合成音效 + BGM 状态机 + 音量/静音键
│   │   │   ├── Ticker.ts      # 时间/缓动工具
│   │   │   └── Renderer.ts    # Canvas 上下文封装(DPR 适配、安全区)
│   │   ├── ui/                # 自研轻量组件:Button/Text/Panel/ScrollList/Toast/飘字
│   │   ├── scenes/
│   │   │   ├── BootScene.ts   # 启动:存档加载、云登录(超时降级)、资源预载
│   │   │   ├── HomeScene.ts   # 敲击主场景:木鱼、功德数、连击条、入口按钮
│   │   │   ├── CultivateScene.ts # 境界/皮肤/场景/音频管理面板
│   │   │   ├── DailyScene.ts  # 每日功课 + 每日一偈
│   │   │   ├── RankScene.ts   # 好友功德榜(开放数据域挂载)
│   │   │   └── SettingScene.ts
│   │   ├── systems/
│   │   │   ├── MeritSystem.ts    # 功德结算(配置驱动)
│   │   │   ├── ComboSystem.ts    # 连击判定与文案
│   │   │   ├── LevelSystem.ts    # 境界成长/突破演出触发
│   │   │   ├── DailySystem.ts    # 每日功课/日期戳
│   │   │   ├── OfflineSystem.ts  # 离线展示(权威计算在云)
│   │   │   ├── SkinSystem.ts     # 皮肤/场景/音色装配
│   │   │   ├── ShareSystem.ts    # 分享卡绘制 + 带参分享
│   │   │   ├── AdSystem.ts       # 激励视频封装 + 频控
│   │   │   ├── SyncService.ts    # 云同步(游客模式状态机、合并、防刷批量上报)
│   │   │   └── Analytics.ts      # 埋点
│   │   ├── data/
│   │   │   ├── configs.ts      # 皮肤/场景/BGM/境界配置表
│   │   │   └── strings.ts      # 文案(偈语/连击文案/UI 文案,集中管理)
│   │   └── utils/              # format / date / easing / pool
│   ├── cloud/
│   │   ├── login/              # 云函数:获取 openid、建用户
│   │   ├── syncProfile/        # 云端合并存档(防刷校验)
│   │   ├── offlineCalc/        # 离线功德权威结算(lastSeenAt)
│   │   ├── dailyClaim/         # 每日功课领奖校验(防刷)
│   │   └── rank/               # 排行数据聚合(可选,开放域直读)
│   ├── open-data/              # 开放数据域子包
│   │   └── index.js            # sharedCanvas 渲染好友榜
│   └── audio/                  # (一期无音频文件,全部合成;BGM 走 CDN/分包)
└── docs/
```

---

## 四、核心模块设计

### 4.1 渲染与场景

- `Renderer`:封装 canvas 上下文,处理 DPR(高清屏)、安全区偏移(`wx.getWindowInfo().safeArea`),统一 `px` 坐标
- `GameLoop`:RAF 驱动,`setPauseOnHidden`(切后台停帧);低端机 `frameSkip` 降频
- `SceneStack`:栈式场景切换(Home ↔ 面板),切换动画用 Ticker 缓动

### 4.2 输入与敲击手感

- `touchstart` 计数为"一次敲击";同一点连续 touch 事件(间隔 <80ms)合并为一击;每帧至多结算 1 击
- 敲击 → `MeritSystem.calc()` → 三路反馈(视觉/听觉/触觉)并行派发,互不阻塞
- 手感调参集中 `configs.ts`,支持开发期热改

### 4.3 数值系统(配置驱动)

```
MeritSystem:
  meritPerTap = base(1) × (1 + skinBonus + gongfaBonus)   // 一期无功法
  onTap → merit += meritPerTap; combo++; emit('merit')
LevelSystem:
  level = 查询境界表(累计功德) → 跨阶触发突破事件(演出/音效/飘字)
```

### 4.4 存档与云同步(重点)

```
StorageService(本地):
  key: 'kxcf_save_v1'; 全量 JSON 镜像;写入节流(≥1s 或关键节点强写)
SyncService(云):
  状态机: online(正常) | guest(超时降级) | syncing | error
  上报:本地攒 N 次敲击(如 50 次)或关键节点(突破/领奖)触发云函数
  merge: 拉云端 profile,字段级合并(本地时间戳 > 云端则取本地)
防刷(云函数 syncProfile):
  校验 taps 增量 ≤ 频率上限(如 15 次/秒 × 时间窗口);异常增量截断并标记
  离线收益以云端 lastSeenAt 为准,客户端展示值仅预估
```

### 4.5 音频系统

```
AudioMgr:
  tapSound(皮肤) = WebAudio 合成(osc + gain 包络),实例池复用
  bgm: InnerAudioContext 单例;BGM 按境界解锁,切换 500ms 淡入淡出
  obeyMuteSwitch = true;背景音与白噪音混音音量 0.6/0.4
  iOS: 首次 touchstart 后 ctx.resume() 才可出声
```

### 4.6 每日系统与离线

- `DailySystem`:本地 `dateKey = YYYY-MM-DD`;每日功课计数、领奖状态、7 日连续;领奖走云函数 `dailyClaim` 防刷
- `OfflineSystem`:登录时 `now - lastSeenAt` 计算展示值;领取时调云函数权威结算并写库

### 4.7 分享与拉新

- `ShareSystem`:离屏 canvas 绘制分享卡(昵称/境界徽章/偈语),`wx.shareAppMessage({query: 'from=xxx'})`
- 分享得功德:每日首次分享成功后(回调)双方 +100,服务端校验当日次数
- iOS 中文渲染:等 `wx.loadFontFace` 或直接用系统字体

### 4.8 广告(激励视频)

- `AdSystem` 封装:`show(tag)` → 成功回调;本地频控表(每日次数,见 prd 3.9);**所有广告入口为主动领取按钮,不打断敲击**

### 4.9 排行榜(开放数据域)

- 主域:`wx.setUserCloudStorage({KVDataList:[{key:'merit', value:'12345'}]})`,**节流上传**(每 30s 或结算后),禁逐次敲击上传
- 开放域:`getOpenDataContext` → postMessage(我的分数) → sharedCanvas 渲染;字体用系统字体;头像昵称用"头像昵称填写能力"获取后存入 users 供展示

### 4.10 埋点

- `Analytics`:事件上报云数据库 `events` 集合(批量写,1 次/30s);字段:event/ts/duration/extra

---

## 五、数据模型(云数据库)

```
users:      { _openid, nickname, avatarUrl, createdAt, updatedAt }
profiles:   { _openid, merit, totalTaps, level, levelMaxUnlocked,
              skinId, sceneId, bgmId, soundOn, vibrateOn,
              inventory: { skins:[], scenes:[], bgms:[] },
              daily:    { dateKey, taps, claimed, streak, shareClaimedAt },
              lastSeenAt, lastSyncAt, offlineClaimedAt,
              extra: {}   // 二期:功法/舍利子/事件预留 }
events:     { _openid, event, ts, duration, extra }
```

- 集合权限:users/profiles/events 均仅"创建者可读写"(云函数以管理员权限访问,防客户端篡改)
- 索引:profiles 按 merit 倒序(榜单)、按 _openid 唯一

---

## 六、性能与包体预算

| 项 | 预算 |
|---|---|
| 主包 | ≤1.5MB(代码 + 核心配置 + 首屏资源) |
| 音频 | 一期零音频文件(全合成);BGM 放分包/CDN 流式 |
| 内存 | 同时 1 首 BGM + 音效池 ≤8 实例(LRU);粒子/光效对象池 |
| 帧率 | 目标 60fps;低端机检测后降 30fps、减粒子 |
| 渲染 | 按需渲染:无动画帧跳过绘制;后台自动停帧 |

---

## 七、两期开发计划

### 第一期(约 4~6 周,个人兼职)

| 里程碑 | 内容 | 估时 | 验收 |
|---|---|---|---|
| M0 资质(并行) | 软著申请 + 备案 + 名称查重 | 日历时间 | 受理通知/备案号 |
| M1 脚手架 | 工程、Renderer/GameLoop/Scene/UI 树、云环境 | 2~3 天 | 空场景真机可跑 |
| M2 敲击手感 | 输入判定、木鱼动画、飘字、合成音效、震动 | 3~5 天 | 手感自测达标 |
| M3 数值与境界 | 功德结算、六境界、突破演出、目标指引 | 3 天 | 数据流打通 |
| M4 皮肤场景音频 | 3 皮肤、2 场景、3 BGM、白噪音 | 4~5 天 | 切换无延迟 |
| M5 存档与同步 | 本地镜像、云同步、游客降级、离线结算、防刷 | 3~4 天 | 断网/换机恢复 |
| M6 日常与社交 | 每日功课、每日一偈、分享得功德、功德榜 | 3~4 天 | 三钩子生效 |
| M7 商业化与上线 | 激励视频、埋点、提审、灰度 | 1 周 | 审核通过、数据回收 |

### 第二期(约 6~8 周)

| 里程碑 | 内容 |
|---|---|
| P2-1 | 功法节奏副本:谱面加载、判定、评价、功法效果与槽位 |
| P2-2 | 涅槃转生 + 舍利子商店(境界处理规则需产品拍板) |
| P2-3 | 随机事件系统(烦恼气泡/佛光/菩提子) |
| P2-4 | 自定义深化:新皮肤/场景/音色商店 |
| P2-5 | 社交深化:共修莲灯、祈福、群共修(云函数房间模型) |
| P2-6 | 情绪木鱼、早课晚课、商业化深化(内购,企业主体后) |

---

## 八、测试与质量

| 维度 | 要点 |
|---|---|
| 真机矩阵 | iOS ≥ 2 台(iPhone 12 系 + 老机型)、Android 2~3 台(覆盖中低端) |
| 手感回归 | 每轮手感改动后,固定 3 组连敲节奏自测 + 录音对比音效 |
| 弱网/离线 | 飞行模式:启动、敲击、领奖、重连同步各场景 |
| 存档健壮性 | 杀进程、清缓存(本地)后云端恢复;本地/云端冲突合并 |
| 性能 | 连续敲击 10 分钟内存无增长;低端机帧率达标 |
| 审核自查 | 名称、宗教敏感词、未授权素材、广告诱导、分享内容安全(msgSecCheck) |

---

## 九、上线与灰度

1. 提审前核对:软著证书 + 备案号 + 代码包(见 launch-checklist.md)
2. 灰度策略:先 5% 流量 → 观察首日转化与崩溃率 → 全量
3. 上线后监控:3/7 日留存、广告 eCPM、离线结算正确率(异常单量)
4. 快速迭代:首周按埋点数据调数值(境界成本、广告频控),二期功能按数据优先级排序

---

> 本方案与 `prd.md`、`design.md` 配套。一期技术债控制:所有二期扩展(功法/转生/事件)只预留数据结构与事件钩子,不提前实现。

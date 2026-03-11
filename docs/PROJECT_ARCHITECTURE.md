# MOB.AI 项目架构档案

> 2026-03-11 更新：
> 当前仓库已经完成 Phase 1 的开源单机化落地。运行时事实已经从“PostgreSQL + Redis + 远程配置 + 远程静态资源 + 支付/登录分支”切换到“SQLite + 本地配置 + 本地资源 + 单机默认用户 + `/mcp`”。

## 1. 当前定位

MOB.AI 当前是一个以修仙题材为核心的 AI 驱动叙事游戏仓库。它仍然是一个 Next.js 单体应用，但已经具备三层同时运行的能力：

- 玩家本地游玩的前端与主流程
- 本地配置和持久化驱动的服务端动作
- 对外暴露给 agent 的 MCP / skills 接口

这份文档记录的是“当前事实架构”，作为后续 faction/world 重构的基线。

## 2. 技术栈与运行时

| 层级 | 当前实现 |
| --- | --- |
| Web 框架 | Next.js 15 App Router |
| UI | React 18 + Tailwind CSS v4 + 少量 Radix UI |
| 客户端状态 | Recoil |
| ORM / 数据库 | Prisma + SQLite (`prisma/dev.db`) |
| 配置中心 | 本地 JSON 配置 (`data/local-config.json`) |
| AI 调用 | Vercel AI SDK + `stableGenerateObject` |
| 模型路由 | `src/utils/modelAdapter.ts` |
| 媒体 | `public/assets/` + `public/generated/` |
| 用户模式 | 单机默认用户自动创建 |
| 图像生成 | 可选功能，默认关闭 |
| 埋点 | 默认关闭，可选开启 |
| Agent 兼容 | MCP (`/mcp`) + `skills/*/SKILL.md` + OpenClaw 示例配置 |

## 3. 顶层目录地图

```text
.
├── src/
│   ├── app/                     # App Router 页面、Server Actions、游戏主流程
│   ├── interfaces/              # schema、DTO、共享类型
│   ├── lib/                     # Prisma、本地配置、MCP、错误处理等基础设施
│   └── utils/                   # 模型适配、Prompt/配置桥、AI 工具
├── prisma/                      # SQLite schema
├── scripts/                     # SQLite 初始化、资源同步
├── public/
│   ├── assets/                  # 本地 UI 资源
│   └── generated/               # 本地生成图片
├── skills/                      # 标准 SKILL.md 资产
├── openclaw/                    # OpenClaw 示例配置
└── docs/                        # 架构、规则、roadmap、重构设计
```

## 4. 应用层结构

### 4.1 前端壳层

- `src/app/layout.tsx`
  - 注入全局样式。
  - 按本地配置决定是否启用 Umami。
- `src/app/ClientRoot.tsx`
  - 包裹 `RecoilRoot`、`ToastProvider`。
  - 渲染固定头部与设置入口。
  - 负责本地用户状态在客户端的同步。

### 4.2 游戏页面层

- `src/app/components/PageLayout.tsx`
  - 主流程容器，靠 Recoil `pageState` 在 `home/create/loading/char/story` 间切换。
- `src/app/components/PageHome.tsx`
  - 首页、角色列表、快速开局、导入分享入口。
- `src/app/components/PageCreateChar.tsx`
  - 灵根、属性点、姓名、角色背景创建。
- `src/app/components/PageChar.tsx`
  - 角色档案、立绘、开始修行入口。
- `src/app/components/PageStory.tsx`
  - 剧情展示、掷骰演出、选项推进、自定义输入、死亡/突破跳转。
- `src/app/pages/*`
  - 独立路由页，目前保留历史、设置、死亡、头像等页面。

### 4.3 服务端动作层

`src/app/actions/**` 是当前应用真正的后端接口层，核心包括：

- `character/action.ts`
  - 创建角色、获取角色、突破、复生。
- `game/action.ts`
  - `startGame()`、`pushGame()`。
- `settings/action.ts`
  - 本地模型配置、Prompt 模板、功能开关、连接测试。
- `revive/action.ts`
  - 单机复生动作。
- `story_segment/action.ts`
  - 剧情片段读取。
- `image-generation/action.ts`
  - 可选剧情配图触发。

### 4.4 游戏领域服务层

当前规则仍然没有被完全抽成独立 `domain/`，主要逻辑集中在：

- `GameCharacterRefactored.ts`
  - 主协调器，负责角色装载、推进、突破/死亡判定、current push 切换。
- `GamePushService.ts`
  - 创建剧情推进、调用 LLM、落库新 push。
- `OptionService.ts`
  - 选项推进与预加载衔接。
- `PreloadService.ts`
  - 给选项提前掷骰并准备结果。
- `checkSystem.ts`
  - 2d6 检定规则。
- `attributeSystem.ts`
  - 状态初始化、状态变化、死亡判定。
- `OptionAnalysisService.ts`
  - 自定义输入的动作分类和难度分析。

### 4.5 基础设施层

- `src/lib/prisma.ts`
  - Prisma 单例。
- `src/utils/config-client.ts`
  - 本地配置桥，保留旧 `ConfigService` 形式以减少业务改动。
- `src/lib/local-config/*`
  - 默认 Prompt Pack、本地配置存储、设置页读写接口。
- `src/lib/local-user.ts`
  - 单机默认用户引导。
- `src/lib/local-media.ts`
  - 本地图像落盘。
- `src/lib/mcp/server.ts`
  - MCP server 定义。
- `src/utils/modelAdapter.ts`
  - 把本地配置映射到 AI SDK provider。
- `src/utils/stableGenerateObject.ts`
  - 统一对象生成、修复、重试、日志落库。

## 5. 关键运行流程

### 5.1 主游戏循环

```mermaid
flowchart TD
  A["创建角色"] --> B["生成角色档案"]
  B --> C["开始修行"]
  C --> D["展示剧情与选项"]
  D --> E["2d6 检定与状态变动"]
  E --> F["写入新的 GamePush"]
  F --> G{"死亡 / 突破 / 继续"}
  G -->|继续| D
  G -->|死亡| H["死亡页 -> 本地复生"]
  G -->|突破| I["突破结算"]
```

### 5.2 导航模型

当前仍是双轨结构：

- 主游戏循环使用 Recoil `pageState`
- 历史、死亡、设置、头像使用 App Router 独立页面

这意味着后续 faction 地图接入时，需要决定它是进入主状态机，还是成为独立页面。

## 6. 数据模型

### 6.1 当前关键表

| 模型 | 作用 |
| --- | --- |
| `User` | 本地单用户主体，含复生状态 |
| `Character` | 角色档案、加点、灵根、当前推进指针 |
| `GamePush` | 每一步剧情推进节点 |
| `StorySegment` | 与推进一对一的剧情片段快照 |
| `Avatar` / `AvatarTask` | 角色头像与生成任务 |
| `Dictionary` | 兼容旧逻辑的字典表 |
| `PromptHistory` | Prompt 版本记录 |
| `LlmCallLog` | LLM 调用日志 |

### 6.2 当前关系重点

- `Character.currentPushId` 指向当前剧情节点
- `Character.gamePush[]` 保存推进历史
- `GamePush.fatherId` 形成推进树
- `StorySegment` 与 `GamePush` 一对一
- 复生不重建角色，而是重置状态并继续角色生命线

## 7. 配置与模型链路

当前 Prompt 与模型配置已经本地化，但业务层仍保留“配置服务”抽象：

- `ConfigService.getConfig(name)` 现在读取本地配置文件
- 每个配置项包含：
  - provider
  - base URL
  - API key
  - model name
  - system prompt / user prompt
  - thinking / feature 参数
- `modelAdapter.ts` 再把这些配置映射到 AI SDK providerOptions

这让旧代码改动面较小，但也意味着“本地配置中心”目前仍是兼容层，不是纯净的新设计。

## 8. Agent 暴露层

### 8.1 MCP

- 路径：`src/app/mcp/route.ts`
- 协议：标准 Streamable HTTP MCP
- SDK：`@modelcontextprotocol/sdk`
- 入口：`POST /mcp`

当前暴露：

- tools：角色查询、角色创建、开始游戏、推进、突破、设置读取
- resources：架构文档、规则文档、roadmap、skills、Prompt 模板
- prompts：重构顾问、游戏主持

### 8.2 Skills

仓库当前提供：

- `skills/mobai-gameplay/SKILL.md`
- `skills/mobai-refactor/SKILL.md`

文件格式为 YAML frontmatter + Markdown body，面向 Claude Code / Codex / Cursor / OpenClaw 风格工作流。

### 8.3 OpenClaw

- 示例配置在 `openclaw/example-config.json`
- 文档在 `docs/OPENCLAW_INTEGRATION.md`

## 9. 当前前端设计语言

后续重构必须保留以下视觉资产：

- 宣纸感浅米底色 `#F2EBD9`
- 黑墨 / 深褐色文字，而不是通用后台对比色
- 古籍/明朝体取向
- 大量图片化按钮
- 移动端全屏叙事感
- 五行色系和金色点缀

换句话说，Phase 2 即使加入 faction/map，也不能把界面做成普通管理后台或标准沙盒地图。

## 10. 当前重构热点

### 10.1 导航双轨制

主循环与独立路由页并存，后续 faction/map 接入时要先决定导航归属。

### 10.2 领域与持久化强耦合

`GameCharacterRefactored`、`GamePushService` 既管规则又直接打 Prisma，后续适合拆成 domain + repository + orchestration。

### 10.3 本地用户态双存储

cookie、`localStorage`、Recoil 同时存在，SSR/CSR 一致性仍有维护成本。

### 10.4 配置兼容层仍然较厚

代码已经摆脱远端 config service，但 `ConfigService` 语义仍在。后续可以考虑彻底改成显式本地配置仓储。

### 10.5 文档与代码要持续对齐

旧支付/后台文档已经不再代表当前产品，后续开发应以 `README.md`、`docs/ROADMAP.md`、当前源码为准。

## 11. 面向 Phase 2 的直接建议

- faction 不要重写主流程，而是作为世界上下文层插入
- 地图先做节点图 / 区域图，不直接上复杂 tile map
- world loop 要让代码掌握状态与结算，LLM 只负责意图和叙事增色
- MCP 资源层后续可以直接补 faction/world 文档、世界状态摘要、地图资源

# MOB.AI

开源、单机、单用户的 AI 修仙游戏。当前 Phase 1 已经把核心运行路径改成：

- 本地配置中心
- SQLite
- 本地默认用户
- 本地静态资源
- 可选图像生成
- 标准 MCP Server
- 标准 `SKILL.md`

不依赖 Docker。玩家只需要本机安装 Node.js 即可运行。

项目仍然保留原本的主循环和视觉气质：

`创建角色 -> 进入剧情 -> 选择行动 -> 掷骰检定 -> 推进故事 -> 死亡/复生/突破`

当前界面已同时适配桌面端与移动端，尽量保留原始贴图、按钮和宣纸式视觉风格。

## 快速开始

```bash
pnpm install
cp .env.example .env.local
pnpm bootstrap
pnpm dev
```

打开 [http://127.0.0.1:3009](http://127.0.0.1:3009)。

## 一键启动

开发模式：

```bash
node scripts/launch.mjs dev
```

生产模式：

```bash
node scripts/launch.mjs prod
```

仓库根目录还提供了便捷入口：

- `run-local.command`
- `deploy-local.command`
- `run-local.bat`
- `deploy-local.bat`

这些脚本会自动：

1. 检查 `pnpm`
2. 自动补 `.env.local`
3. 安装依赖
4. 执行 `pnpm bootstrap`
5. 按开发或生产模式启动

首次进入后：

1. 点击右上角 `设置`
2. 填入模型 `API Key / Base URL / Model`
3. 测试连接
4. 如需校对 Prompt，从设置页右上角进入 `高级提示词`
5. 返回主页开始创建角色

## 当前本地化结果

- 不再依赖外部配置服务
- 不再依赖 PostgreSQL
- 不再依赖 Redis
- 不再依赖 OSS 静态资源
- 不再保留后台、验证码登录、支付页面
- 支付在开源单机版中已移除
- 图像生成功能默认关闭，可在设置页启用
- 不依赖 Docker 或 docker-compose

## 关键本地文件

- `data/local-config.json`
  - 本地模型配置、Prompt 包、功能开关、默认用户
- `prisma/dev.db`
  - SQLite 数据库
- `public/assets/`
  - 本地 UI 资源
- `public/generated/`
  - 本地图像输出

## 常用命令

```bash
pnpm dev
pnpm build
pnpm db:generate
pnpm db:init
pnpm assets:sync
pnpm bootstrap
```

## MCP / Skills / OpenClaw

- MCP 入口：`http://127.0.0.1:3009/mcp`
- Skills 目录：`skills/`
- OpenClaw 示例配置：`openclaw/example-config.json`

更多说明见：

- [docs/OPENCLAW_INTEGRATION.md](./docs/OPENCLAW_INTEGRATION.md)
- [docs/ROADMAP.md](./docs/ROADMAP.md)

## 文档入口

- [docs/PROJECT_ARCHITECTURE.md](./docs/PROJECT_ARCHITECTURE.md)
- [docs/GAME_RULES.md](./docs/GAME_RULES.md)
- [docs/FACTION_SYSTEM_DESIGN.md](./docs/FACTION_SYSTEM_DESIGN.md)
- [docs/OPENCLAW_INTEGRATION.md](./docs/OPENCLAW_INTEGRATION.md)

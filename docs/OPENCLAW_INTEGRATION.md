# OpenClaw Integration

## 1. 目标

本项目在 Phase 1 内同时提供：

- 标准 MCP Server
- 标准 `SKILL.md`
- OpenClaw 可直接消费的接入信息

## 2. MCP 入口

默认本地运行时，MCP 入口为：

```json
{ "url": "http://127.0.0.1:3009/mcp" }
```

如果你修改了端口，请同步改 URL。

## 3. 当前暴露内容

### Tools

- `get_settings`
- `list_characters`
- `get_character`
- `create_character`
- `start_game`
- `push_game`
- `attempt_breakthrough`

### Resources

- 架构文档
- 规则文档
- roadmap
- Phase 1 重构方案
- 帮派设计文档
- 所有 `skills/*/SKILL.md`
- 本地 Prompt 模板

### Prompts

- `mobai-refactor-advisor`
- `mobai-game-master`

## 4. Skills 目录

当前 skills 在仓库内：

- `skills/mobai-gameplay/SKILL.md`
- `skills/mobai-refactor/SKILL.md`

这些文件使用 YAML frontmatter + Markdown body，可被 Claude Code / Codex / Cursor / OpenClaw 风格工作流消费。

## 5. 建议接法

对以技能驱动为主的 agent：

1. 先加载 `skills/mobai-refactor/SKILL.md` 或 `skills/mobai-gameplay/SKILL.md`
2. 再挂接 MCP URL
3. 通过 resources 读取架构与规则文档
4. 再调用 tools

## 6. 当前边界

本项目目前是单机单用户。

OpenClaw 接入时，也应按单用户本地游戏来理解，不应假设：

- 多租户
- 远程账号体系
- 维护方托管支付
- 维护方托管配置中心

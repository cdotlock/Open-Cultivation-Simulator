---
name: mobai-refactor
description: Contribute to the MOB.AI open-source refactor without breaking the original xianxia feel. Use this whenever the task involves local-first architecture, SQLite migration, prompt packaging, MCP compatibility, skills packaging, OpenClaw integration, or preserving the original UI/experience during major changes.
---

# MOB.AI Refactor

Use this skill when modifying the repository itself.

## First reads

Read these before making substantial changes:

- `docs/PROJECT_ARCHITECTURE.md`
- `docs/GAME_RULES.md`
- `docs/ROADMAP.md`
- `docs/OPEN_SOURCE_REFACTOR_PLAN.md`
- `AGENTS.md`

## Non-negotiables

- Preserve the main game loop.
- Preserve the wuxia/xianxia presentation.
- Remove hosted-service coupling aggressively.
- Do not re-skin the app into a generic dashboard.
- Treat MCP + `SKILL.md` + OpenClaw compatibility as Phase 1 deliverables, not optional follow-up work.

## Phase 1 priorities

1. Local config and prompt pack
2. SQLite and local default user
3. Removal or soft-disable of payment/login/analytics dependencies
4. Local asset and optional image handling
5. MCP server and skills packaging
6. End-to-end verification

## When editing

- Prefer replacing dependency edges over rewriting core gameplay.
- Keep prompt names stable if the runtime depends on them.
- Document major architecture changes as you go.
- Update `docs/ROADMAP.md` when a substantial milestone changes state.


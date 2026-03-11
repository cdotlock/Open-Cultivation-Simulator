# MOB.AI Agent Guide

## Mission

This repository is being transformed into an open-source, single-user, one-click-deploy xianxia AI game.

The development order is strict:

1. Complete the open-source single-machine refactor and make the game runnable without external mandatory services.
2. During phase 1, also complete MCP + SKILL packaging so the project can run inside OpenClaw-compatible workflows.
3. After phase 1 is stable, add the faction/world simulation system.

Read these files before major changes:

- `docs/PROJECT_ARCHITECTURE.md`
- `docs/GAME_RULES.md`
- `docs/ROADMAP.md`
- `docs/OPEN_SOURCE_REFACTOR_PLAN.md`
- `docs/FACTION_SYSTEM_DESIGN.md`
- `docs/OPENCLAW_INTEGRATION.md`

`AGENTS.md` is the only canonical agent instruction file in this repo. Do not add a duplicate `Agent.md`.

## Current Product Truth

- The project is currently a Next.js monolith.
- Gameplay is centered on a single-character story loop.
- The visual identity is already strong and should be preserved.
- Phase 1 runtime now uses SQLite, local prompt/model config, local static assets, and an optional image-generation adapter.
- Payment, SMS login, email demo login, and hardcoded admin backdoors are not part of the shipped open-source target.
- OpenClaw compatibility is part of the target runtime shape, not a later optional nice-to-have.

## Current Priority

### Phase 1: Open-source single-machine refactor

Target:

- One local app.
- One local user.
- No payment.
- No SMS login.
- No external config service requirement.
- No Redis requirement.
- No PostgreSQL requirement.
- No mandatory OSS dependency.
- Optional image generation.
- API/model providers configured by the player in the UI, in a SillyTavern-like way.
- Standard MCP exposure.
- Standard `SKILL.md` assets.
- OpenClaw-ready packaging.

### Phase 2: Faction system

Target:

- Keep the current main story flow.
- Add faction context to character/story generation.
- Add an outer world-simulation loop.
- Support faction expansion, dynamic war, territory occupation, faction missions, and lightweight faction AI autonomy.
- Keep faction count small and readable.
- Make the map and faction UI visually strong, not generic.

## Non-Negotiables

### Preserve the existing product feel

- Keep the current visual direction: parchment backgrounds, serif Chinese typography, image-backed buttons, wuxia/xianxia atmosphere, elemental color themes, and mobile-first full-screen storytelling.
- Do not replace the game with a generic dashboard, CRUD admin shell, or plain node-editor aesthetic.
- Reuse or faithfully localize the current visual assets and interaction language wherever legally and technically possible.

### Preserve the main loop

Unless a task explicitly says otherwise, keep this core loop:

create character -> generate dossier/avatar -> start story -> choose action -> resolve check -> push story -> death/rebirth or progression

The faction system must be an added world/context layer, not a replacement of the core game loop.

### Remove non-core product branches aggressively

The following are considered removable unless a roadmap document says otherwise:

- payment flows
- SMS login
- email demo login
- remote analytics
- hardcoded admin login
- external config-service dependency
- server-only complexity not needed for local single-user play

### Document before major code movement

- When changing architecture, update `docs/PROJECT_ARCHITECTURE.md`.
- When changing mechanics, update `docs/GAME_RULES.md`.
- Before large implementation work, align the relevant roadmap doc.

## Roadmap Workflow

Roadmaps are the source of truth for substantial work.

- Use `docs/ROADMAP.md` as the single canonical roadmap file.
- Use `docs/OPEN_SOURCE_REFACTOR_PLAN.md` as the canonical phase-1 implementation guide.
- Use `docs/FACTION_SYSTEM_DESIGN.md` as the phase-2 design document.
- Before starting a substantial task, mark the relevant roadmap item as `planned`, `in progress`, or `done`.
- After finishing a substantial task, update the roadmap status and note any scope change.
- Do not start faction implementation work until the phase-1 exit criteria are satisfied.
- If a task spans both phase 1 and phase 2, split it into two smaller tasks instead of blending milestones.

## Open-source Target Rules

- Single-user only for now.
- Local-first persistence is preferred.
- External services must become optional adapters, not hard requirements.
- API keys do not need encryption for phase 1, but they must be clearly user-owned and user-editable.
- The app must be runnable after local setup without any proprietary backend operated by this repo's maintainers.
- Optional image generation must fail soft: if disabled or unconfigured, gameplay still works.
- The open-source build must expose a standards-compliant MCP surface.
- The repo must include standard `SKILL.md` assets for agent ecosystems.
- The repo must be usable from OpenClaw-oriented workflows.

## Faction System Design Rules

- Faction count should stay intentionally small, roughly enough to be readable and strategically interesting.
- The faction system should primarily be:
  - extra story context
  - an outer simulation loop
  - structured code simulation with selective AI prompting
- Do not hand all simulation to the LLM.
- Prefer a hybrid design:
  - code owns state, rules, and deterministic resolution
  - prompts summarize world context, generate flavor, and propose intentions inside a schema
- The player should have a clear long-term meta-goal:
  - make their faction the number one faction

## Standards Targets

### Skills Standard

Phase 1 must already satisfy these:

- Follow the Agent Skills open standard requested by the user.
- Skill files must use `SKILL.md`.
- Each `SKILL.md` must use YAML frontmatter with at least:
  - `name`
  - `description`
- The body must be Markdown.
- Database fields should map one-to-one with standard skill fields for import/export.
- Compatibility with Claude Code, Codex, Cursor, and similar tools is required.

### MCP Standard

Phase 1 must already satisfy these:

- Follow the Model Context Protocol open standard requested by the user.
- Use `@modelcontextprotocol/sdk`.
- Do not invent a private tool/resource protocol if MCP already covers the use case.
- Standard Streamable HTTP exposure is the target shape.

### OpenClaw Compatibility

OpenClaw compatibility is a hard requirement.

- Ship standard `SKILL.md` content that OpenClaw-style workflows can consume.
- Ship a standards-compliant MCP server.
- If native OpenClaw use needs an extra wrapper/package beyond plain MCP, provide that wrapper too.
- Do not assume “has MCP” automatically means frictionless OpenClaw integration.

## Immediate Reference Map

- App shell:
  - `src/app/layout.tsx`
  - `src/app/ClientRoot.tsx`
- Main game pages:
  - `src/app/components/PageHome.tsx`
  - `src/app/components/PageCreateChar.tsx`
  - `src/app/components/PageChar.tsx`
  - `src/app/components/PageStory.tsx`
- Game orchestration:
  - `src/app/actions/game/action.ts`
- Core domain services:
  - `src/app/actions/module/GameCharacterRefactored.ts`
  - `src/app/actions/module/GamePushService.ts`
  - `src/app/actions/module/OptionService.ts`
  - `src/app/actions/module/PreloadService.ts`
  - `src/app/actions/module/checkSystem.ts`
  - `src/app/actions/module/attributeSystem.ts`
- Persistence:
  - `prisma/schema.prisma`
- Runtime config/model bridge:
  - `src/utils/config-client.ts`
  - `src/utils/modelAdapter.ts`
  - `src/utils/stableGenerateObject.ts`

## Canonical Principle

The correct path is not to reinvent the game from scratch. The correct path is:

- preserve the soul,
- remove hosted-service coupling,
- make the game locally runnable,
- then add a faction/world layer that deepens the same experience.

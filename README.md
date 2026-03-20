# Open Cultivation Simulator

Open Cultivation Simulator is a local-first, open-source AI cultivation narrative game built with Next.js, SQLite, and configurable LLM providers.

This repository is the single-player open-source edition of `MOB.AI`. It keeps the original xianxia tone, card-based mobile UI, dice checks, and story loop, while replacing the old online service dependencies with a self-hosted local stack.

## Overview

- Local-first runtime: SQLite, local assets, local prompt/model configuration, and a default local user flow
- AI-driven gameplay: character generation, branching story pushes, custom player actions, and structured story output
- Playable progression loop: create a character, enter story, roll checks, advance the plot, break through, die, revive, and continue
- Faction/world layer: world map nodes, faction relations, world-turn simulation, faction missions, and faction-aware story context
- Agent integration: built-in MCP endpoint and `skills/` support for agent tooling

## Project Status

The project is actively being refactored into a cleaner open-source shape.

Current open-source scope:

- Single-machine, single-user play
- Local configuration from `data/local-config.json`
- SQLite persistence in `prisma/dev.db`
- Optional image generation and avatar generation
- Desktop shell that embeds the mobile story UI

Out of scope in this edition:

- Hosted backend services
- Redis / PostgreSQL dependencies
- Payment flow
- SMS login and other SaaS-only branches

## Core Features

- AI-generated character setup with xianxia-themed backgrounds, missions, and relationships
- Structured story loop with `2d6 + modifiers` checks
- Pre-rolled options plus custom free-form player actions
- Character archive, history review, breakthrough, death, and revive flow
- Faction agent planning with prompt fallback to the shared model configuration
- World simulation with alliances, expansion, resource conflicts, and faction rumors
- Dedicated world map page and faction brief UI inside the main character flow
- Local settings UI for model provider, base URL, API key, and prompt management

## Tech Stack

| Layer | Implementation |
| --- | --- |
| Web | Next.js 15 + App Router |
| UI | React 18 + Tailwind CSS v4 + Radix UI |
| State | Recoil |
| Database | Prisma + SQLite |
| AI | Vercel AI SDK + local prompt/model config |
| Assets | `public/assets/` + `public/generated/` |
| Tooling | pnpm + TypeScript + ESLint |
| Agent Integration | MCP (`/mcp`) + `skills/` |

## Quick Start

### Requirements

- Node.js 20+
- pnpm 9+

### Install and run

```bash
pnpm install
cp .env.example .env.local
pnpm bootstrap
pnpm dev
```

Then open [http://localhost:3009](http://localhost:3009).

### First-time setup

1. Open the in-app `设置` page.
2. Fill in your model provider, model name, base URL, and API key.
3. Test the connection.
4. If needed, adjust prompts from the prompt settings page.
5. Return to the home page and create a character.

## One-Command Launch Scripts

The repository also includes local launch helpers:

- `run-local.command`
- `deploy-local.command`
- `run-local.bat`
- `deploy-local.bat`

These scripts can:

1. Check for `pnpm`
2. Create `.env.local` when missing
3. Install dependencies
4. Run `pnpm bootstrap`
5. Start the app in development or production mode

You can also use the explicit launcher:

```bash
node scripts/launch.mjs dev
node scripts/launch.mjs prod
```

## Common Commands

```bash
pnpm dev
pnpm build
pnpm start
pnpm lint
pnpm bootstrap
pnpm db:init
pnpm db:generate
pnpm assets:sync
```

## Project Structure

```text
.
├── src/
│   ├── app/                 # pages, components, server actions, game loop
│   ├── interfaces/          # schemas, DTOs, shared types
│   ├── lib/                 # prisma, local config, MCP, utilities
│   └── utils/               # model adapters and AI helpers
├── prisma/                  # SQLite schema and local database
├── public/                  # static assets and generated images
├── scripts/                 # bootstrap, launch, db init, asset sync
├── docs/                    # architecture, rules, roadmap, faction docs
├── skills/                  # SKILL.md assets for agents
└── openclaw/                # OpenClaw example config
```

## Local Data and Configuration

- `data/local-config.json`
  - Active model configuration, prompts, feature flags, and local user profile
- `prisma/dev.db`
  - SQLite database used by the local edition
- `public/assets/`
  - Bundled UI assets
- `public/generated/`
  - Generated local image outputs

## Documentation

- [Project Architecture](./docs/PROJECT_ARCHITECTURE.md)
- [Game Rules](./docs/GAME_RULES.md)
- [Faction System Design](./docs/FACTION_SYSTEM_DESIGN.md)
- [OpenClaw Integration](./docs/OPENCLAW_INTEGRATION.md)
- [Roadmap](./docs/ROADMAP.md)

## Known Limitations

- This edition is designed for local play, not multi-user deployment.
- Model keys are not bundled. You must configure your own provider credentials.
- Image generation is optional and disabled by default.
- `pnpm build` currently succeeds in the open-source local stack; day-to-day development is still more convenient with `pnpm dev`.

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before opening a pull request.

Useful contribution areas:

- gameplay balance
- faction/world simulation
- prompt quality
- UI/UX refinement
- documentation
- bug fixing and cleanup

## License

This project is released under the [MIT License](./LICENSE).

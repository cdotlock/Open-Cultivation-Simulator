# Contributing Guide

Thanks for contributing to Open Cultivation Simulator.

## Before You Start

- Read the project overview in [README.md](./README.md).
- Review the architecture and rules docs in `docs/` if your change touches gameplay or world simulation.
- For large gameplay, prompt, or data-model changes, open an issue or discussion first so scope is clear before implementation starts.

## Development Setup

```bash
pnpm install
cp .env.example .env.local
pnpm bootstrap
pnpm dev
```

App URL:

- `http://localhost:3009`

## Branching and Pull Requests

- Keep each pull request focused on one theme.
- Use clear commit messages.
- Describe user-facing behavior changes, not just implementation details.
- For UI changes, include screenshots or a short screen recording when possible.
- For gameplay or faction-system changes, explain the expected impact on progression or balance.

## Coding Expectations

- Prefer small, reviewable changes over broad rewrites.
- Keep local-only assumptions explicit.
- Avoid introducing hosted-service dependencies into the open-source local edition.
- Update docs when behavior, commands, or architecture change.

## Validation

Before opening a pull request, run the checks relevant to your change:

```bash
pnpm lint
```

If your change affects bootstrap, startup, or persistence, also verify the local run flow manually:

1. `pnpm bootstrap`
2. `pnpm dev`
3. Open the app
4. Confirm the changed flow works end to end

## Configuration and Secrets

- Do not commit real API keys or private credentials.
- Do not commit local runtime data such as `data/local-config.json`, `prisma/dev.db`, or generated outputs.
- Use `.env.example` when new environment variables are required.

## Good First Contribution Areas

- documentation fixes
- UI polish
- gameplay balance adjustments
- faction world simulation improvements
- prompt cleanups
- testability and code health improvements

## Reporting Bugs

When filing a bug, include:

- what you expected
- what actually happened
- reproduction steps
- browser / OS / Node.js version when relevant
- screenshots or logs if available

## License

By contributing to this repository, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

---
name: mobai-gameplay
description: Play, inspect, or narrate the MOB.AI single-player xianxia game through MCP. Use this whenever the user wants to create a character, start a run, inspect a dossier, continue the story loop, or ask for rules-grounded narrative help inside MOB.AI.
---

# MOB.AI Gameplay

Use this skill when the task is about operating or narrating the local MOB.AI game rather than editing the codebase.

## What this skill assumes

- The project is running locally.
- The MCP endpoint is available at `/mcp`.
- The game is single-user and local-first.
- The main loop is:
  `create character -> start story -> choose action -> resolve check -> continue story`

## Preferred workflow

1. Read the game rules resource first if the request depends on mechanics.
2. List characters before assuming a character exists.
3. If no suitable character exists, create one.
4. Start or continue the run using the MCP tools.
5. When narrating outcomes, stay aligned with the returned structured state instead of inventing contradictory facts.

## MCP tools to use

- `get_settings`
- `list_characters`
- `get_character`
- `create_character`
- `start_game`
- `push_game`
- `attempt_breakthrough`

## MCP resources to read when needed

- `docs://game-rules`
- `docs://project-architecture`
- `prompt://story_prompt_v1`
- `prompt://character_prompt`

## Output style

- Keep the xianxia tone.
- Ground explanations in actual returned data.
- If summarizing a run, include:
  - current realm
  - current task
  - latest scene
  - meaningful status changes

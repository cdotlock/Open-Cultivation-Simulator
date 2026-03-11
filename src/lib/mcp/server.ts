import "server-only";

import { readFile, readdir } from "fs/promises";
import path from "path";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { getLocalAppConfig } from "@/lib/local-config/store";
import { ensureLocalUserRecord } from "@/lib/local-user";
import { prisma } from "@/lib/prisma";
import {
  createCharacter,
  attemptBreakthrough,
  getCharacterById,
} from "@/app/actions/character/action";
import { startGame, pushGame } from "@/app/actions/game/action";

const ROOT = process.cwd();

const staticDocs = [
  {
    name: "project-architecture",
    uri: "docs://project-architecture",
    filePath: path.join(ROOT, "docs", "PROJECT_ARCHITECTURE.md"),
    description: "Detailed architecture baseline for the open-source refactor.",
  },
  {
    name: "game-rules",
    uri: "docs://game-rules",
    filePath: path.join(ROOT, "docs", "GAME_RULES.md"),
    description: "Canonical gameplay and simulation rules.",
  },
  {
    name: "roadmap",
    uri: "docs://roadmap",
    filePath: path.join(ROOT, "docs", "ROADMAP.md"),
    description: "Phase-based delivery roadmap.",
  },
  {
    name: "faction-system-design",
    uri: "docs://faction-system-design",
    filePath: path.join(ROOT, "docs", "FACTION_SYSTEM_DESIGN.md"),
    description: "Phase 2 faction simulation design.",
  },
];

async function readUtf8(filePath: string) {
  return readFile(filePath, "utf8");
}

async function listSkillFiles() {
  const skillsRoot = path.join(ROOT, "skills");

  try {
    const entries = await readdir(skillsRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => ({
        name: entry.name,
        uri: `skill://${entry.name}`,
        filePath: path.join(skillsRoot, entry.name, "SKILL.md"),
      }));
  } catch {
    return [];
  }
}

function formatToolResult(label: string, payload: unknown) {
  const text = typeof payload === "string" ? payload : JSON.stringify(payload, null, 2);
  const structuredContent =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : ({ result: payload } as Record<string, unknown>);

  return {
    content: [
      {
        type: "text" as const,
        text: `${label}\n${text}`,
      },
    ],
    structuredContent,
  };
}

function redactKey(apiKey: string) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return "*".repeat(apiKey.length);
  }

  return `${apiKey.slice(0, 3)}***${apiKey.slice(-4)}`;
}

export async function createMobaiMcpServer() {
  const server = new McpServer({
    name: "mobai-open-source",
    version: "1.0.0",
  });

  const localConfig = await getLocalAppConfig();

  for (const doc of staticDocs) {
    server.registerResource(
      doc.name,
      doc.uri,
      {
        title: doc.name,
        description: doc.description,
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri: doc.uri,
            mimeType: "text/markdown",
            text: await readUtf8(doc.filePath),
          },
        ],
      }),
    );
  }

  for (const skill of await listSkillFiles()) {
    server.registerResource(
      skill.name,
      skill.uri,
      {
        title: skill.name,
        description: "Agent skill definition for MOB.AI ecosystems.",
        mimeType: "text/markdown",
      },
      async () => ({
        contents: [
          {
            uri: skill.uri,
            mimeType: "text/markdown",
            text: await readUtf8(skill.filePath),
          },
        ],
      }),
    );
  }

  for (const prompt of localConfig.prompts) {
    const promptUri = `prompt://${prompt.name}`;
    server.registerResource(
      prompt.name,
      promptUri,
      {
        title: prompt.name,
        description: prompt.description || "Local prompt template",
        mimeType: "application/json",
      },
      async () => ({
        contents: [
          {
            uri: promptUri,
            mimeType: "application/json",
            text: JSON.stringify(
              {
                name: prompt.name,
                description: prompt.description,
                systemPrompt: prompt.systemPrompt,
                userPrompt: prompt.userPrompt,
                category: prompt.category,
              },
              null,
              2,
            ),
          },
        ],
      }),
    );
  }

  server.registerPrompt(
    "mobai-refactor-advisor",
    {
      description:
        "Use this whenever you need a maintainer-style conversation prompt for MOB.AI architecture, refactor sequencing, MCP/Skill compatibility, or open-source delivery tradeoffs.",
      argsSchema: {
        question: z.string().describe("The specific architecture or refactor question."),
      },
    },
    async ({ question }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "You are advising on the MOB.AI open-source refactor.",
              "Use the repository docs as the source of truth, keep the answer concrete, and preserve the original xianxia feel.",
              `Question: ${question}`,
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "mobai-game-master",
    {
      description:
        "Use this whenever an agent needs a conversation template for playing, narrating, or analyzing the MOB.AI single-player xianxia loop.",
      argsSchema: {
        topic: z.string().describe("The gameplay topic or scene to discuss."),
      },
    },
    async ({ topic }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: [
              "You are a MOB.AI xianxia game master.",
              "Stay grounded in the game's rule documents and structured story loop.",
              `Topic: ${topic}`,
            ].join("\n"),
          },
        },
      ],
    }),
  );

  server.registerTool(
    "get_settings",
    {
      description: "Read the current local model provider and feature flags for the single-machine open-source runtime.",
    },
    async () => {
      const config = await getLocalAppConfig();
      const activeModel = config.models.find((model) => model.isActive) || config.models[0];

      return formatToolResult("Current local settings", {
        activeModel: {
          ...activeModel,
          apiKey: redactKey(activeModel.apiKey),
        },
        features: config.features,
        mcp: config.mcp,
      });
    },
  );

  server.registerTool(
    "list_characters",
    {
      description: "List the local player's characters with current push and status summaries.",
    },
    async () => {
      const user = await ensureLocalUserRecord();
      const characters = await prisma.character.findMany({
        where: {
          userUuid: user.uuid,
          isDeleted: false,
        },
        orderBy: {
          createdAt: "desc",
        },
        include: {
          currentPush: true,
        },
      });

      return formatToolResult(
        "Character list",
        characters.map((character) => ({
          id: character.id,
          name: character.name,
          cover: character.cover,
          createdAt: character.createdAt,
          currentPushId: character.currentPushId,
          status: character.currentPush?.status || null,
        })),
      );
    },
  );

  server.registerTool(
    "get_character",
    {
      description: "Load a single character dossier and current progress.",
      inputSchema: {
        characterId: z.number().int().positive(),
      },
    },
    async ({ characterId }) => {
      const character = await getCharacterById(characterId);
      return formatToolResult("Character detail", character);
    },
  );

  server.registerTool(
    "create_character",
    {
      description: "Create a new MOB.AI character for the local user.",
      inputSchema: {
        name: z.string().min(1),
        background: z.string().min(1).describe("Natural-language role description or concept."),
        spiritRoot: z.string().optional(),
        charmPoints: z.number().int().min(0).max(10).default(4),
        spiritPoints: z.number().int().min(0).max(10).default(3),
        skillPoints: z.number().int().min(0).max(10).default(3),
      },
    },
    async ({ name, background, spiritRoot, charmPoints, spiritPoints, skillPoints }) => {
      const user = await ensureLocalUserRecord();
      const character = await createCharacter(
        name,
        background,
        user.uuid,
        {
          魅力: charmPoints,
          神识: spiritPoints,
          身手: skillPoints,
        },
        spiritRoot,
      );

      return formatToolResult("Character created", character);
    },
  );

  server.registerTool(
    "start_game",
    {
      description: "Start the main story loop for a character and return the first structured story push.",
      inputSchema: {
        characterId: z.number().int().positive(),
      },
    },
    async ({ characterId }) => {
      const result = await startGame(characterId);
      return formatToolResult("Game started", result);
    },
  );

  server.registerTool(
    "push_game",
    {
      description: "Advance the current story by choosing an option.",
      inputSchema: {
        characterId: z.number().int().positive(),
        currentPushId: z.number().int().positive(),
        choice: z.string().min(1),
      },
    },
    async ({ characterId, currentPushId, choice }) => {
      const result = await pushGame(currentPushId, characterId, choice);
      return formatToolResult("Game advanced", result);
    },
  );

  server.registerTool(
    "attempt_breakthrough",
    {
      description: "Attempt a cultivation breakthrough for a character using the current breakthrough success coefficient.",
      inputSchema: {
        characterId: z.number().int().positive(),
      },
    },
    async ({ characterId }) => {
      const user = await ensureLocalUserRecord();
      const result = await attemptBreakthrough(characterId, user.uuid);
      return formatToolResult("Breakthrough attempt", result);
    },
  );

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return { server, transport };
}

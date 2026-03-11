import { randomUUID } from "crypto";
import promptPack from "./default-prompt-pack.json";
import { AIConfig, AIModel, LocalAppConfig } from "./types";

const now = () => new Date().toISOString();

type PromptSeed = (typeof promptPack.prompts)[number];

function createDefaultModel(): AIModel {
  const timestamp = now();
  return {
    id: 1,
    name: process.env.LOCAL_DEFAULT_MODEL || "deepseek-chat",
    provider: "deepseek",
    apiUrl: process.env.LOCAL_DEFAULT_BASE_URL || "https://api.deepseek.com/v1",
    apiKey: process.env.DEEPSEEK_API_KEY || "",
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function parsePromptVersion(version: string | number | undefined) {
  if (typeof version === "number") {
    return version;
  }

  if (typeof version === "string") {
    const parsed = Number(version.replace(/[^\d]/g, ""));
    return Number.isNaN(parsed) ? 1 : parsed;
  }

  return 1;
}

function createPrompt(seed: PromptSeed): AIConfig {
  const timestamp = seed.updatedAt || now();

  return {
    id: seed.id,
    name: seed.name,
    modelId: seed.modelId,
    systemPrompt: seed.systemPrompt,
    userPrompt: seed.userPrompt,
    params: seed.params,
    streaming: seed.streaming,
    thinking: seed.thinking,
    outputStructure: seed.outputStructure,
    description: seed.description,
    category: seed.category,
    isActive: seed.isActive,
    version: parsePromptVersion(seed.version),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createDefaultPromptConfigs() {
  return promptPack.prompts.map(createPrompt);
}

export function getDefaultAvatarGenerationPrompt() {
  return promptPack.avatarGenerationTemplate;
}

export function createDefaultAppConfig(): LocalAppConfig {
  const model = createDefaultModel();

  return {
    version: promptPack.version,
    models: [model],
    prompts: createDefaultPromptConfigs(),
    features: {
      imageGenerationEnabled: false,
      avatarGenerationEnabled: false,
    },
    localUser: {
      uuid: process.env.LOCAL_USER_UUID || randomUUID(),
      name: process.env.LOCAL_USER_NAME || "本地修士",
      phone: process.env.LOCAL_USER_PHONE || "本地洞府",
    },
    mcp: {
      path: "/mcp",
      enabled: true,
    },
  };
}

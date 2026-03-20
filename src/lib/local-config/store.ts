import "server-only";

import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import { createDefaultAppConfig } from "./defaults";
import { AIConfig, AIModel, LocalAppConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const CONFIG_PATH = path.join(DATA_DIR, "local-config.json");

async function ensureDataDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

async function writeConfig(config: LocalAppConfig) {
  await ensureDataDir();
  await writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
}

function stripPromptModel(prompt: AIConfig) {
  const { model, ...rest } = prompt;
  void model;
  return rest;
}

function attachModels(config: LocalAppConfig): LocalAppConfig {
  return {
    ...config,
    prompts: config.prompts.map((prompt) => ({
      ...prompt,
      model: config.models.find((model) => model.id === prompt.modelId),
    })),
  };
}

function normalizeConfig(config: LocalAppConfig): LocalAppConfig {
  const defaults = createDefaultAppConfig();
  const builtInPromptMap = new Map(defaults.prompts.map((prompt) => [prompt.name, prompt]));
  const normalizedModel = config.models[0]
    ? {
        ...defaults.models[0],
        ...config.models[0],
        isActive: true,
        updatedAt: new Date().toISOString(),
      }
    : defaults.models[0];

  const incomingPrompts = config.prompts.map((prompt) =>
    prompt.name === "story_prompt_v2" || prompt.name === "story_prompt_v1"
      ? { ...prompt, name: "story_prompt" }
      : prompt,
  );

  const shouldResetBuiltIns = config.version !== defaults.version;
  const prompts = defaults.prompts.map((defaultPrompt) => {
    if (shouldResetBuiltIns) {
      return defaultPrompt;
    }

    const matched = incomingPrompts.find((prompt) => prompt.name === defaultPrompt.name);
    return matched
      ? {
          ...defaultPrompt,
          ...matched,
          name: defaultPrompt.name,
          modelId: normalizedModel.id,
        }
      : defaultPrompt;
  });

  const customPrompts = shouldResetBuiltIns
    ? []
    : incomingPrompts.filter((prompt) => !builtInPromptMap.has(prompt.name));

  return {
    ...defaults,
    ...config,
    version: defaults.version,
    models: [normalizedModel],
    prompts: [...prompts, ...customPrompts].map(stripPromptModel),
    features: {
      imageGenerationEnabled: config.features?.imageGenerationEnabled ?? defaults.features.imageGenerationEnabled,
      avatarGenerationEnabled: config.features?.avatarGenerationEnabled ?? defaults.features.avatarGenerationEnabled,
    },
    localUser: {
      ...defaults.localUser,
      ...config.localUser,
    },
    mcp: {
      ...defaults.mcp,
      ...config.mcp,
    },
  };
}

export async function getLocalAppConfig(): Promise<LocalAppConfig> {
  await ensureDataDir();

  try {
    const content = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(content) as LocalAppConfig;
    const normalized = normalizeConfig(parsed);
    await writeConfig(normalized);
    return attachModels(normalized);
  } catch {
    const defaults = createDefaultAppConfig();
    await writeConfig(defaults);
    return attachModels(defaults);
  }
}

export async function updateLocalAppConfig(
  updater: (config: LocalAppConfig) => LocalAppConfig | Promise<LocalAppConfig>,
): Promise<LocalAppConfig> {
  const current = await getLocalAppConfig();
  const next = await updater(current);
  await writeConfig({
    ...next,
    prompts: next.prompts.map(stripPromptModel),
  });
  return attachModels(next);
}

export async function getPromptConfigByName(name: string): Promise<AIConfig | undefined> {
  const config = await getLocalAppConfig();
  return config.prompts.find((prompt) => prompt.name === name && prompt.isActive);
}

export async function getModelById(id: number): Promise<AIModel | undefined> {
  const config = await getLocalAppConfig();
  return config.models.find((model) => model.id === id);
}

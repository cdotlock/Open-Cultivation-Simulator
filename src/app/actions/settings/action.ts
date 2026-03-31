"use server";

import { z } from "zod";
import { generateText } from "ai";
import { updateLocalAppConfig, getLocalAppConfig } from "@/lib/local-config/store";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";

const providerSchema = z.enum(["openai-compatible", "openai", "deepseek", "qwen", "doubao"]);

const settingsSchema = z.object({
  provider: providerSchema,
  modelName: z.string().min(1),
  apiUrl: z.string().min(1),
  apiKey: z.string(),
  imageGenerationEnabled: z.boolean(),
  avatarGenerationEnabled: z.boolean(),
});

const promptSchema = z.object({
  name: z.string().min(1),
  systemPrompt: z.string(),
  userPrompt: z.string(),
});

export async function getSettingsSnapshot() {
  const config = await getLocalAppConfig();
  const activeModel = config.models.find((model) => model.isActive) || config.models[0];

  return {
    activeModel,
    features: config.features,
    prompts: config.prompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description || "",
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
    })),
  };
}

export async function checkApiConfigured() {
  const config = await getLocalAppConfig();
  const activeModel = config.models.find((model) => model.isActive) || config.models[0];
  return Boolean(activeModel?.apiKey && activeModel.apiKey.trim().length > 0);
}

export async function saveSettings(input: z.infer<typeof settingsSchema>) {
  const parsed = settingsSchema.parse(input);

  await updateLocalAppConfig((config) => ({
    ...config,
    features: {
      imageGenerationEnabled: parsed.imageGenerationEnabled,
      avatarGenerationEnabled: parsed.avatarGenerationEnabled,
    },
    models: config.models.map((model, index) => ({
      ...model,
      provider: index === 0 ? parsed.provider : model.provider,
      name: index === 0 ? parsed.modelName : model.name,
      apiUrl: index === 0 ? parsed.apiUrl : model.apiUrl,
      apiKey: index === 0 ? parsed.apiKey : model.apiKey,
      isActive: index === 0,
      updatedAt: new Date().toISOString(),
    })),
  }));

  return { success: true };
}

export async function savePromptTemplate(input: z.infer<typeof promptSchema>) {
  const parsed = promptSchema.parse(input);

  await updateLocalAppConfig((config) => ({
    ...config,
    prompts: config.prompts.map((prompt) =>
      prompt.name === parsed.name
        ? {
            ...prompt,
            systemPrompt: parsed.systemPrompt,
            userPrompt: parsed.userPrompt,
            updatedAt: new Date().toISOString(),
          }
        : prompt,
    ),
  }));

  return { success: true };
}

export async function testActiveModelConnection(input?: Partial<z.infer<typeof settingsSchema>>) {
  let snapshot = await getSettingsSnapshot();

  if (input) {
    const merged = settingsSchema.parse({
      provider: input.provider ?? snapshot.activeModel.provider,
      modelName: input.modelName ?? snapshot.activeModel.name,
      apiUrl: input.apiUrl ?? snapshot.activeModel.apiUrl,
      apiKey: input.apiKey ?? snapshot.activeModel.apiKey,
      imageGenerationEnabled: input.imageGenerationEnabled ?? snapshot.features.imageGenerationEnabled,
      avatarGenerationEnabled: input.avatarGenerationEnabled ?? snapshot.features.avatarGenerationEnabled,
    });

    snapshot = {
      ...snapshot,
      activeModel: {
        ...snapshot.activeModel,
        provider: merged.provider,
        name: merged.modelName,
        apiUrl: merged.apiUrl,
        apiKey: merged.apiKey,
      },
      features: {
        imageGenerationEnabled: merged.imageGenerationEnabled,
        avatarGenerationEnabled: merged.avatarGenerationEnabled,
      },
    };
  }

  const model = snapshot.activeModel;
  const modelInstance = createModelFromConfig(model);
  const providerOptions = getProviderOptions(model, {
    params: { temperature: 0.3, max_tokens: 64, top_p: 0.9 },
  });

  const { text } = await generateText({
    model: modelInstance(model.name),
    prompt: "请只回复四个字：连接成功。",
    maxTokens: 32,
    providerOptions,
  });

  return {
    success: true,
    message: text.trim(),
  };
}

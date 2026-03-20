import { generateText, streamText } from "ai";
import { createModelFromConfig, getProviderOptions } from "./modelAdapter";
import {
  AIConfig,
  AIModel,
  CreateConfigData,
  UpdateConfigData,
} from "@/lib/local-config/types";
import {
  getLocalAppConfig,
  getModelById,
  getPromptConfigByName,
  updateLocalAppConfig,
} from "@/lib/local-config/store";

export type { AIConfig, AIModel, CreateConfigData, UpdateConfigData };

export interface QueryParams {
  category?: string;
  isActive?: boolean;
  search?: string;
}

export interface ConfigServiceOptions {
  timeout?: number;
}

export interface CallOptions {
  timeout?: number;
  customHeaders?: Record<string, string>;
}

export interface AIResponse {
  text?: string;
  content?: string;
  [key: string]: unknown;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

function applyVariables(template: string, variables: Record<string, unknown>) {
  return Object.entries(variables).reduce((content, [key, value]) => {
    const rendered = typeof value === "string" ? value : JSON.stringify(value);
    return content.replace(new RegExp(`\\{${key}\\}`, "g"), rendered);
  }, template);
}

export class ConfigServiceClient {
  constructor(options: ConfigServiceOptions = {}) {
    void options;
  }

  async getAllConfigs(params: QueryParams = {}) {
    const config = await getLocalAppConfig();
    let prompts = config.prompts;

    if (params.category) {
      prompts = prompts.filter((prompt) => prompt.category === params.category);
    }

    if (typeof params.isActive === "boolean") {
      prompts = prompts.filter((prompt) => prompt.isActive === params.isActive);
    }

    if (params.search) {
      prompts = prompts.filter((prompt) => {
        const haystack = `${prompt.name}\n${prompt.description || ""}\n${prompt.systemPrompt}\n${prompt.userPrompt}`;
        return haystack.toLowerCase().includes(params.search!.toLowerCase());
      });
    }

    return {
      data: prompts,
      pagination: {
        page: 1,
        limit: prompts.length,
        total: prompts.length,
        totalPages: 1,
      },
    };
  }

  async getConfig(name: string): Promise<AIConfig> {
    const config = await getPromptConfigByName(name);
    if (!config) {
      throw new Error(`未找到本地配置: ${name}`);
    }
    return config;
  }

  async getAllModels(): Promise<AIModel[]> {
    const config = await getLocalAppConfig();
    return config.models;
  }

  async getModelById(id: number): Promise<AIModel> {
    const model = await getModelById(id);
    if (!model) {
      throw new Error(`未找到模型配置: ${id}`);
    }
    return model;
  }

  async createConfig(configData: CreateConfigData): Promise<AIConfig> {
    const updated = await updateLocalAppConfig((config) => {
      const nextId = Math.max(0, ...config.prompts.map((item) => item.id)) + 1;
      const timestamp = new Date().toISOString();
      return {
        ...config,
        prompts: [
          ...config.prompts,
          {
            id: nextId,
            name: configData.name,
            modelId: configData.modelId,
            systemPrompt: configData.systemPrompt,
            userPrompt: configData.userPrompt,
            inputParams: configData.inputParams,
            params: configData.params,
            streaming: configData.streaming,
            thinking: configData.thinking,
            outputStructure: configData.outputStructure,
            description: configData.description,
            category: configData.category || "custom",
            isActive: true,
            version: 1,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      };
    });

    const created = updated.prompts.find((prompt) => prompt.name === configData.name);
    if (!created) {
      throw new Error(`创建配置失败: ${configData.name}`);
    }
    return created;
  }

  async updateConfig(name: string, configData: UpdateConfigData): Promise<AIConfig> {
    const updated = await updateLocalAppConfig((config) => ({
      ...config,
      prompts: config.prompts.map((prompt) => {
        if (prompt.name !== name) {
          return prompt;
        }

        return {
          ...prompt,
          ...configData,
          updatedAt: new Date().toISOString(),
        };
      }),
    }));

    const next = updated.prompts.find((prompt) => prompt.name === name);
    if (!next) {
      throw new Error(`未找到配置: ${name}`);
    }
    return next;
  }

  async toggleConfig(name: string, isActive: boolean): Promise<AIConfig> {
    return this.updateConfig(name, { isActive });
  }

  async callAI(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ): Promise<AIResponse> {
    const config = await this.getConfig(configName);
    if (!config.model) {
      throw new Error(`配置缺少模型信息: ${configName}`);
    }

    const systemPrompt = applyVariables(config.systemPrompt || "", variables);
    const userPrompt = applyVariables(customPrompt || config.userPrompt, variables);
    const modelInstance = createModelFromConfig(config.model);
    const providerOptions = getProviderOptions(config.model, config);

    const { text } = await generateText({
      model: modelInstance(config.model.name),
      system: systemPrompt,
      prompt: userPrompt,
      providerOptions,
      maxTokens: Number(config.params?.max_tokens || 1200),
    });

    return { text, content: text };
  }

  async call(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ): Promise<AIResponse> {
    return this.callAI(configName, variables, customPrompt);
  }

  async callWithPrompt(
    configName: string,
    customPrompt: string,
    variables: Record<string, unknown> = {},
  ): Promise<AIResponse> {
    return this.callAI(configName, variables, customPrompt);
  }

  async streamCall(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ) {
    const config = await this.getConfig(configName);
    if (!config.model) {
      throw new Error(`配置缺少模型信息: ${configName}`);
    }

    const systemPrompt = applyVariables(config.systemPrompt || "", variables);
    const userPrompt = applyVariables(customPrompt || config.userPrompt, variables);
    const modelInstance = createModelFromConfig(config.model);
    const providerOptions = getProviderOptions(config.model, config);

    return streamText({
      model: modelInstance(config.model.name),
      system: systemPrompt,
      prompt: userPrompt,
      providerOptions,
      maxTokens: Number(config.params?.max_tokens || 1200),
    });
  }

  async batchCall(
    configName: string,
    batchVariables: Array<Record<string, unknown>>,
  ): Promise<AIResponse[]> {
    const results: AIResponse[] = [];
    for (const variables of batchVariables) {
      results.push(await this.callAI(configName, variables));
    }
    return results;
  }

  async callWithRetry(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ): Promise<AIResponse> {
    return this.callAI(configName, variables, customPrompt);
  }
}

const defaultClient = new ConfigServiceClient();

export class ConfigService {
  static client = defaultClient;

  static async getConfig(name: string): Promise<AIConfig> {
    return this.client.getConfig(name);
  }

  static async getAllConfigs(params: QueryParams = {}) {
    return this.client.getAllConfigs(params);
  }

  static async createConfig(configData: CreateConfigData): Promise<AIConfig> {
    return this.client.createConfig(configData);
  }

  static async updateConfig(name: string, configData: UpdateConfigData): Promise<AIConfig> {
    return this.client.updateConfig(name, configData);
  }

  static async toggleConfig(name: string, isActive: boolean): Promise<AIConfig> {
    return this.client.toggleConfig(name, isActive);
  }

  static async getAllModels(): Promise<AIModel[]> {
    return this.client.getAllModels();
  }

  static async getModelById(id: number): Promise<AIModel> {
    return this.client.getModelById(id);
  }

  static async call(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ): Promise<AIResponse> {
    return this.client.call(configName, variables, customPrompt);
  }

  static async callWithPrompt(
    configName: string,
    customPrompt: string,
    variables: Record<string, unknown> = {},
  ): Promise<AIResponse> {
    return this.client.callWithPrompt(configName, customPrompt, variables);
  }

  static async streamCall(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ) {
    return this.client.streamCall(configName, variables, customPrompt);
  }

  static async batchCall(
    configName: string,
    batchVariables: Array<Record<string, unknown>>,
  ): Promise<AIResponse[]> {
    return this.client.batchCall(configName, batchVariables);
  }

  static async callWithRetry(
    configName: string,
    variables: Record<string, unknown> = {},
    customPrompt?: string,
  ): Promise<AIResponse> {
    return this.client.callWithRetry(configName, variables, customPrompt);
  }

  static configure(options: ConfigServiceOptions = {}) {
    this.client = new ConfigServiceClient(options);
  }

  static createClient(options: ConfigServiceOptions = {}) {
    return new ConfigServiceClient(options);
  }
}

export const getConfig = ConfigService.getConfig;
export const call = ConfigService.call;
export const callWithPrompt = ConfigService.callWithPrompt;
export const streamCall = ConfigService.streamCall;
export const batchCall = ConfigService.batchCall;
export const callWithRetry = ConfigService.callWithRetry;
export const configure = ConfigService.configure;
export const createClient = ConfigService.createClient;

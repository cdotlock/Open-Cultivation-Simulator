import { createOpenAI } from "@ai-sdk/openai";
import type { AIConfig, AIModel } from "@/lib/local-config/types";

type ProviderParams = {
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
};

type ProviderConfig = Pick<AIConfig, "thinking" | "params"> | {
  thinking?: boolean;
  params?: ProviderParams;
};

type ProviderOptionEntry = {
  temperature: number;
  max_tokens: number;
  top_p: number;
  enable_thinking?: boolean;
  enable_search?: boolean;
};

type ProviderOptions = {
  qwen?: ProviderOptionEntry;
  openai?: ProviderOptionEntry;
};

function normalizeBaseUrl(model: AIModel) {
  const raw = model.apiUrl.replace(/\/$/, "");

  if (model.provider === "deepseek" && !raw.endsWith("/v1")) {
    return `${raw}/v1`;
  }

  return raw
    .replace(/\/chat\/completions$/, "")
    .replace(/\/api\/v1\/services\/aigc\/text-generation\/generation$/, "");
}

/**
 * 根据模型配置创建对应的AI SDK模型实例
 */
export function createModelFromConfig(model: AIModel) {
  const modelName = model.name.toLowerCase();
  const baseURL = normalizeBaseUrl(model);
  
  // 根据模型名称和API URL判断模型类型
  if (modelName.includes('qwen') || model.apiUrl.includes('dashscope') || model.apiUrl.includes('aliyun')) {
    return createOpenAI({
      apiKey: model.apiKey,
      baseURL,
    });
  } else if (modelName.includes('doubao') || model.apiUrl.includes('doubao')) {
    return createOpenAI({
      apiKey: model.apiKey,
      baseURL,
    });
  } else if (modelName.includes('openai') || model.apiUrl.includes('openai') || model.apiUrl.includes('api.openai.com')) {
    return createOpenAI({
      apiKey: model.apiKey,
      baseURL,
    });
  } else if (modelName.includes('zhipu') || model.apiUrl.includes('zhipu') || model.apiUrl.includes('api.zhipu.ai')) {
    return createOpenAI({
      apiKey: model.apiKey,
      baseURL,
    });
  } else {
    return createOpenAI({
      apiKey: model.apiKey,
      baseURL,
    });
  }
}

/**
 * 根据模型类型获取对应的provider选项
 */
export function getProviderOptions(model: AIModel, config: ProviderConfig): ProviderOptions {
  const modelName = model.name.toLowerCase();
  const params = config.params ?? {};
  const baseOptions = {
    temperature: typeof params.temperature === "number" ? params.temperature : 0.7,
    max_tokens: typeof params.max_tokens === "number" ? params.max_tokens : 1000,
    top_p: typeof params.top_p === "number" ? params.top_p : 0.9,
  };
  
  if (modelName.includes('qwen') || model.apiUrl.includes('dashscope') || model.apiUrl.includes('aliyun')) {
    return {
      qwen: {
        ...baseOptions,
        enable_thinking: config.thinking || false,
      }
    };
  } else if (modelName.includes('zhipu') || model.apiUrl.includes('zhipu') || model.apiUrl.includes('api.zhipu.ai')) {
    return {
      openai: {
        ...baseOptions,
        enable_search: config.thinking || false,
      }
    };
  } else {
    return {
      openai: {
        ...baseOptions,
      }
    };
  }
} 

import { createOpenAI } from '@ai-sdk/openai';
import { AIModel } from '@/lib/local-config/types';

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
export function getProviderOptions(model: AIModel, config: any) {
  const modelName = model.name.toLowerCase();
  
  if (modelName.includes('qwen') || model.apiUrl.includes('dashscope') || model.apiUrl.includes('aliyun')) {
    return {
      qwen: {
        enable_thinking: config.thinking || false,
        temperature: config.params?.temperature || 0.7,
        max_tokens: config.params?.max_tokens || 1000,
        top_p: config.params?.top_p || 0.9,
      }
    } as any;
  } else if (modelName.includes('zhipu') || model.apiUrl.includes('zhipu') || model.apiUrl.includes('api.zhipu.ai')) {
    return {
      openai: {
        enable_search: config.thinking || false,
        temperature: config.params?.temperature || 0.7,
        max_tokens: config.params?.max_tokens || 1000,
        top_p: config.params?.top_p || 0.9,
      }
    } as any;
  } else {
    return {
      openai: {
        temperature: config.params?.temperature || 0.7,
        max_tokens: config.params?.max_tokens || 1000,
        top_p: config.params?.top_p || 0.9,
      }
    } as any;
  }
} 

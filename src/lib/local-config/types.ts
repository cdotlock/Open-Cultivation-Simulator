export interface AIModel {
  id: number;
  name: string;
  provider: "openai-compatible" | "openai" | "deepseek" | "qwen" | "doubao";
  apiUrl: string;
  apiKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AIConfig {
  id: number;
  name: string;
  modelId: number;
  systemPrompt: string;
  userPrompt: string;
  inputParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
  streaming?: boolean;
  thinking?: boolean;
  outputStructure?: string;
  description?: string;
  category: string;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
  model?: AIModel;
}

export interface LocalFeatureFlags {
  imageGenerationEnabled: boolean;
  avatarGenerationEnabled: boolean;
}

export interface LocalUserProfile {
  uuid: string;
  name: string;
  phone: string;
}

export interface LocalAppConfig {
  version: number;
  models: AIModel[];
  prompts: AIConfig[];
  features: LocalFeatureFlags;
  localUser: LocalUserProfile;
  mcp: {
    path: string;
    enabled: boolean;
  };
}

export interface CreateConfigData {
  name: string;
  modelId: number;
  systemPrompt: string;
  userPrompt: string;
  inputParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
  streaming?: boolean;
  thinking?: boolean;
  outputStructure?: string;
  description?: string;
  category?: string;
}

export interface UpdateConfigData {
  modelId?: number;
  systemPrompt?: string;
  userPrompt?: string;
  inputParams?: Record<string, unknown>;
  params?: Record<string, unknown>;
  streaming?: boolean;
  thinking?: boolean;
  outputStructure?: string;
  description?: string;
  category?: string;
  isActive?: boolean;
}

import { ProviderV1, LanguageModelV1, EmbeddingModelV1 } from '@ai-sdk/provider';
import { FetchFunction } from '@ai-sdk/provider-utils';

type QwenChatModelId = "qwen2.5-14b-instruct-1m" | "qwen2.5-72b-instruct" | "qwen2.5-32b-instruct" | "qwen2.5-14b-instruct" | "qwen2.5-7b-instruct" | "qwen2-57b-a14b-instruct" | "qwen2.5-7b-instruct-1m" | "qwen-max" | "qwen-max-latest" | "qwen-max-2025-01-25" | "qwen-plus" | "qwen-plus-latest" | "qwen-plus-2025-01-25" | "qwen-turbo" | "qwen-turbo-latest" | "qwen-turbo-2024-11-01" | "qwen-vl-max" | "qwen-vl-plus" | "qwen2.5-vl-72b-instruct" | "qwen2.5-vl-7b-instruct" | "qwen2.5-vl-3b-instruct" | (string & {});
interface QwenChatSettings {
    /**
  A unique identifier representing your end-user, which can help the provider to
  monitor and detect abuse.
     */
    user?: string;
    /**
  Simulates streaming by using a normal generate call and returning it as a stream.
  Enable this if the model that you are using does not support streaming.
  Defaults to `false`.
     */
    simulateStreaming?: boolean;
}

/**
 * Module defining types and interfaces for Qwen completion model settings.
 *
 * @module qwen-completion-settings
 */

/**
 * Alias for Qwen Chat Model ID used for completions.
 */
type QwenCompletionModelId = QwenChatModelId;
/**
 * Settings for Qwen completions, extending the base chat settings.
 *
 * @remarks
 * These settings control characteristics such as prompt echoing, token bias,
 * output suffix, and user identification.
 */
interface QwenCompletionSettings extends QwenChatSettings {
    /**
     * Echo the input prompt along with the completion.
     *
     * @example
     * { echo: true }
     */
    echo?: boolean;
    /**
     * Adjust the likelihood of specified tokens appearing in the completion.
     *
     * @remarks
     * Accepts an object mapping token IDs (from the qwen-plus tokenizer) to bias values.
     * The bias (ranging from -100 to 100) alters the model's logits prior to sampling.
     * Values near -100 or 100 can effectively ban or force the selection of tokens.
     *
     * @example
     * { logitBias: { "50256": -100 } }
     */
    logitBias?: Record<number, number>;
    /**
     * Suffix for the generated completion.
     *
     * @remarks
     * This string is appended to the generated text after completion.
     *
     * @example
     * { suffix: " -- End" }
     */
    suffix?: string;
    /**
     * A unique end-user identifier.
     *
     * @remarks
     * This identifier can assist in monitoring usage and detecting abuse.
     *
     * @example
     * { user: "user-1234" }
     */
    user?: string;
}

/**
 * Supported embedding model IDs.
 */
type QwenEmbeddingModelId = "text-embedding-v3" | (string & {});
/**
 * Settings configuration for Qwen text embeddings.
 */
interface QwenEmbeddingSettings {
    /**
     * A unique identifier for the end-user used for monitoring and abuse detection.
     */
    user?: string;
    /**
     * The type of text. Valid values are 'query' and 'document'.
     * Default is 'document'. Use 'query' when performing text queries.
     */
    text_type?: string;
    /**
     * The dimensionality of the output vector.
     * Valid values include 1024, 768, and 512. Default is 1024.
     */
    dimensions?: number;
    /**
     * Specifies the type of output vectors.
     * Valid values: "dense", "sparse", or "dense&sparse". Default is "dense".
     */
    output_type?: "dense" | "sparse" | "dense&sparse";
}

/**
 * QwenProvider function type and its properties.
 * Creates various language or embedding models based on the provided settings.
 */
interface QwenProvider extends ProviderV1 {
    (modelId: QwenChatModelId, settings?: QwenChatSettings): LanguageModelV1;
    /**
     * Create a new chat model for text generation.
     * @param modelId The model ID.
     * @param settings The settings for the model.
     * @returns The chat model.
     */
    chatModel: (modelId: QwenChatModelId, settings?: QwenChatSettings) => LanguageModelV1;
    /**
    Creates a text embedding model for text generation.
    @param modelId The model ID.
    @param settings The settings for the model.
    @returns The text embedding model.
     */
    textEmbeddingModel: (modelId: QwenEmbeddingModelId, settings?: QwenEmbeddingSettings) => EmbeddingModelV1<string>;
    languageModel: (modelId: QwenChatModelId, settings?: QwenChatSettings) => LanguageModelV1;
    completion: (modelId: QwenCompletionModelId, settings?: QwenCompletionSettings) => LanguageModelV1;
}
/**
 * QwenProviderSettings interface holds configuration options for Qwen.
 */
interface QwenProviderSettings {
    /**
    Use a different URL prefix for API calls, e.g. to use proxy servers.
    The default prefix is `https://dashscope-intl.aliyuncs.com/compatible-mode/v1`.
     */
    baseURL?: string;
    /**
    API key that is being send using the `Authorization` header.
    It defaults to the `DASHSCOPE_API_KEY` environment variable.
     */
    apiKey?: string;
    /**
    Custom headers to include in the requests.
     */
    headers?: Record<string, string>;
    /**
    Optional custom url query parameters to include in request urls.
     */
    queryParams?: Record<string, string>;
    /**
    /**
    Custom fetch implementation. You can use it as a middleware to intercept requests,
    or to provide a custom fetch implementation for e.g. testing.
     */
    fetch?: FetchFunction;
}
/**
 * Creates a Qwen provider instance with the specified options.
 * @param options Provider configuration options.
 * @returns A QwenProvider instance.
 */
declare function createQwen(options?: QwenProviderSettings): QwenProvider;
declare const qwen: QwenProvider;

export { type QwenProvider, type QwenProviderSettings, createQwen, qwen };

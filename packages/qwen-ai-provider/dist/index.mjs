// src/qwen-provider.ts
import { loadApiKey, withoutTrailingSlash } from "@ai-sdk/provider-utils";

// src/qwen-chat-language-model.ts
import {
  InvalidResponseDataError
} from "@ai-sdk/provider";
import {
  combineHeaders,
  createEventSourceResponseHandler,
  createJsonErrorResponseHandler as createJsonErrorResponseHandler2,
  createJsonResponseHandler,
  generateId,
  isParsableJson,
  postJsonToApi
} from "@ai-sdk/provider-utils";
import { z as z2 } from "zod";

// src/convert-to-qwen-chat-messages.ts
import {
  UnsupportedFunctionalityError
} from "@ai-sdk/provider";
import { convertUint8ArrayToBase64 } from "@ai-sdk/provider-utils";
function getQwenMetadata(message) {
  var _a, _b;
  return (_b = (_a = message == null ? void 0 : message.providerMetadata) == null ? void 0 : _a.qwen) != null ? _b : {};
}
function convertToQwenChatMessages(prompt) {
  const messages = [];
  for (const { role, content, ...message } of prompt) {
    const metadata = getQwenMetadata({ ...message });
    switch (role) {
      case "system": {
        messages.push({ role: "system", content, ...metadata });
        break;
      }
      case "user": {
        if (content.length === 1 && content[0].type === "text") {
          messages.push({
            role: "user",
            content: content[0].text,
            ...getQwenMetadata(content[0])
          });
          break;
        }
        messages.push({
          role: "user",
          content: content.map((part) => {
            var _a;
            const partMetadata = getQwenMetadata(part);
            switch (part.type) {
              case "text": {
                return { type: "text", text: part.text, ...partMetadata };
              }
              case "image": {
                return {
                  type: "image_url",
                  image_url: {
                    url: part.image instanceof URL ? part.image.toString() : `data:${(_a = part.mimeType) != null ? _a : "image/jpeg"};base64,${convertUint8ArrayToBase64(part.image)}`
                  },
                  ...partMetadata
                };
              }
              default: {
                throw new UnsupportedFunctionalityError({
                  functionality: "File content parts in user messages"
                });
              }
            }
          }),
          ...metadata
        });
        break;
      }
      case "assistant": {
        let text = "";
        const toolCalls = [];
        for (const part of content) {
          const partMetadata = getQwenMetadata(part);
          switch (part.type) {
            case "text": {
              text += part.text;
              break;
            }
            case "tool-call": {
              toolCalls.push({
                id: part.toolCallId,
                type: "function",
                function: {
                  name: part.toolName,
                  arguments: JSON.stringify(part.args)
                },
                ...partMetadata
              });
              break;
            }
            case "file":
            // Add cases in v5
            case "reasoning":
            case "redacted-reasoning": {
              throw new UnsupportedFunctionalityError({
                functionality: `${part.type} content parts in assistant messages`
              });
            }
            default: {
              const _exhaustiveCheck = part;
              throw new Error(`Unsupported part: ${_exhaustiveCheck}`);
            }
          }
        }
        messages.push({
          role: "assistant",
          content: text,
          tool_calls: toolCalls.length > 0 ? toolCalls : void 0,
          ...metadata
        });
        break;
      }
      case "tool": {
        for (const toolResponse of content) {
          const toolResponseMetadata = getQwenMetadata(toolResponse);
          messages.push({
            role: "tool",
            tool_call_id: toolResponse.toolCallId,
            content: JSON.stringify(toolResponse.result),
            ...toolResponseMetadata
          });
        }
        break;
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  return messages;
}

// src/get-response-metadata.ts
function getResponseMetadata({
  id,
  model,
  created
}) {
  return {
    // Assign 'id' if provided; otherwise, leave as undefined.
    id: id != null ? id : void 0,
    // Map 'model' to 'modelId' for improved clarity; assign if provided.
    modelId: model != null ? model : void 0,
    // If 'created' is provided, convert the Unix timestamp (seconds) to a JavaScript Date object.
    timestamp: created != null ? new Date(created * 1e3) : void 0
  };
}

// src/map-qwen-finish-reason.ts
function mapQwenFinishReason(finishReason) {
  switch (finishReason) {
    case "stop":
      return "stop";
    case "length":
      return "length";
    case "tool_calls":
      return "tool-calls";
    default:
      return "unknown";
  }
}

// src/qwen-error.ts
import { createJsonErrorResponseHandler } from "@ai-sdk/provider-utils";
import { z } from "zod";
var qwenErrorDataSchema = z.object({
  object: z.literal("error"),
  message: z.string(),
  type: z.string(),
  param: z.string().nullable(),
  code: z.string().nullable()
});
var qwenFailedResponseHandler = createJsonErrorResponseHandler({
  errorSchema: qwenErrorDataSchema,
  errorToMessage: (error) => error.message
});
var defaultQwenErrorStructure = {
  errorSchema: qwenErrorDataSchema,
  errorToMessage: (data) => data.message
};

// src/qwen-prepare-tools.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError2
} from "@ai-sdk/provider";
function prepareTools({
  mode
}) {
  var _a;
  const tools = ((_a = mode.tools) == null ? void 0 : _a.length) ? mode.tools : void 0;
  const toolWarnings = [];
  if (tools == null) {
    return { tools: void 0, tool_choice: void 0, toolWarnings };
  }
  const toolChoice = mode.toolChoice;
  const qwenCompatTools = [];
  for (const tool of tools) {
    if (tool.type === "provider-defined") {
      toolWarnings.push({ type: "unsupported-tool", tool });
    } else {
      qwenCompatTools.push({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters
        }
      });
    }
  }
  if (toolChoice == null) {
    return { tools: qwenCompatTools, tool_choice: void 0, toolWarnings };
  }
  const type = toolChoice.type;
  switch (type) {
    case "auto":
    case "none":
    case "required":
      return { tools: qwenCompatTools, tool_choice: type, toolWarnings };
    case "tool":
      return {
        tools: qwenCompatTools,
        tool_choice: {
          type: "function",
          function: {
            name: toolChoice.toolName
          }
        },
        toolWarnings
      };
    default: {
      const _exhaustiveCheck = type;
      throw new UnsupportedFunctionalityError2({
        functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`
      });
    }
  }
}

// src/qwen-chat-language-model.ts
var QwenChatResponseSchema = z2.object({
  id: z2.string().nullish(),
  created: z2.number().nullish(),
  model: z2.string().nullish(),
  choices: z2.array(
    z2.object({
      message: z2.object({
        role: z2.literal("assistant").nullish(),
        content: z2.string().nullish(),
        reasoning_content: z2.string().nullish(),
        tool_calls: z2.array(
          z2.object({
            id: z2.string().nullish(),
            type: z2.literal("function"),
            function: z2.object({
              name: z2.string(),
              arguments: z2.string()
            })
          })
        ).nullish()
      }),
      finish_reason: z2.string().nullish()
    })
  ),
  usage: z2.object({
    prompt_tokens: z2.number().nullish(),
    completion_tokens: z2.number().nullish()
  }).nullish()
});
var QwenChatLanguageModel = class {
  // type inferred via constructor
  /**
   * Constructs a new QwenChatLanguageModel.
   * @param modelId - The model identifier.
   * @param settings - Settings for the chat.
   * @param config - Model configuration.
   */
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    var _a, _b;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    const errorStructure = (_a = config.errorStructure) != null ? _a : defaultQwenErrorStructure;
    this.chunkSchema = createQwenChatChunkSchema(
      errorStructure.errorSchema
    );
    this.failedResponseHandler = createJsonErrorResponseHandler2(errorStructure);
    this.supportsStructuredOutputs = (_b = config.supportsStructuredOutputs) != null ? _b : false;
  }
  /**
   * Getter for the default object generation mode.
   */
  get defaultObjectGenerationMode() {
    return this.config.defaultObjectGenerationMode;
  }
  /**
   * Getter for the provider name.
   */
  get provider() {
    return this.config.provider;
  }
  /**
   * Internal getter that extracts the provider options name.
   * @private
   */
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  /**
   * Generates the arguments and warnings required for a language model generation call.
   *
   * This function prepares the argument object based on the provided generation options and mode,
   * including any necessary warnings for unsupported settings. It handles different generation modes
   * such as regular, object-json, and object-tool.
   *
   * @param options.mode - The generation mode configuration containing the type and additional settings.
   * @param options.prompt - The prompt input used to generate chat messages.
   * @param options.maxTokens - The maximum number of tokens to generate.
   * @param options.temperature - The temperature setting to control randomness in generation.
   * @param options.topP - The nucleus sampling parameter (top-p) for token selection.
   * @param options.topK - The top-k sampling parameter; if provided, it triggers a warning as it is unsupported.
   * @param options.frequencyPenalty - The penalty applied to frequently occurring tokens.
   * @param options.presencePenalty - The penalty applied based on the presence of tokens.
   * @param options.providerMetadata - Additional metadata customized for the specific provider.
   * @param options.stopSequences - An array of sequences that will signal the generation to stop.
   * @param options.responseFormat - The desired response format; supports JSON schema formatting when structured outputs are enabled.
   * @param options.seed - An optional seed value for randomization.
   *
   * @returns An object containing:
   * - args: The arguments constructed for the language model generation request.
   * - warnings: A list of warnings related to unsupported or deprecated settings.
   */
  getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    providerMetadata,
    stopSequences,
    responseFormat,
    seed
  }) {
    var _a, _b;
    const type = mode.type;
    const warnings = [];
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if ((responseFormat == null ? void 0 : responseFormat.type) === "json" && responseFormat.schema != null && !this.supportsStructuredOutputs) {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format schema is only supported with structuredOutputs"
      });
    }
    const baseArgs = {
      // model id:
      model: this.modelId,
      // model specific settings:
      user: this.settings.user,
      // standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      response_format: (responseFormat == null ? void 0 : responseFormat.type) === "json" ? this.supportsStructuredOutputs === true && responseFormat.schema != null ? {
        type: "json_schema",
        json_schema: {
          schema: responseFormat.schema,
          name: (_a = responseFormat.name) != null ? _a : "response",
          description: responseFormat.description
        }
      } : { type: "json_object" } : void 0,
      stop: stopSequences,
      seed,
      ...providerMetadata == null ? void 0 : providerMetadata[this.providerOptionsName],
      // messages:
      messages: convertToQwenChatMessages(prompt)
    };
    switch (type) {
      case "regular": {
        const { tools, tool_choice, toolWarnings } = prepareTools({
          mode,
          structuredOutputs: this.supportsStructuredOutputs
        });
        const isThinkingModel = this.modelId.includes("thinking");
        const finalArgs = isThinkingModel && tool_choice ? { ...baseArgs, tools } : { ...baseArgs, tools, tool_choice };
        return {
          args: finalArgs,
          warnings: [...warnings, ...toolWarnings]
        };
      }
      case "object-json": {
        return {
          args: {
            ...baseArgs,
            response_format: this.supportsStructuredOutputs === true && mode.schema != null ? {
              type: "json_schema",
              json_schema: {
                schema: mode.schema,
                name: (_b = mode.name) != null ? _b : "response",
                description: mode.description
              }
            } : { type: "json_object" }
          },
          warnings
        };
      }
      case "object-tool": {
        const isThinkingModel = this.modelId.includes("thinking");
        const toolChoice = isThinkingModel ? void 0 : {
          type: "function",
          function: { name: mode.tool.name }
        };
        return {
          args: {
            ...baseArgs,
            ...toolChoice && { tool_choice: toolChoice },
            tools: [
              {
                type: "function",
                function: {
                  name: mode.tool.name,
                  description: mode.tool.description,
                  parameters: mode.tool.parameters
                }
              }
            ]
          },
          warnings
        };
      }
      default: {
        const _exhaustiveCheck = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }
  /**
   * Generates a text response from the model.
   * @param options - Generation options.
   * @returns A promise resolving with the generation result.
   */
  async doGenerate(options) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    const { args, warnings } = this.getArgs({ ...options });
    const body = JSON.stringify(args);
    const {
      responseHeaders,
      value: responseBody,
      rawValue: parsedBody
    } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        QwenChatResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = args;
    const choice = responseBody.choices[0];
    const providerMetadata = (_b = (_a = this.config.metadataExtractor) == null ? void 0 : _a.extractMetadata) == null ? void 0 : _b.call(_a, {
      parsedBody
    });
    return {
      text: (_c = choice.message.content) != null ? _c : void 0,
      reasoning: (_d = choice.message.reasoning_content) != null ? _d : void 0,
      toolCalls: (_e = choice.message.tool_calls) == null ? void 0 : _e.map((toolCall) => {
        var _a2;
        return {
          toolCallType: "function",
          toolCallId: (_a2 = toolCall.id) != null ? _a2 : generateId(),
          toolName: toolCall.function.name,
          args: toolCall.function.arguments
        };
      }),
      finishReason: mapQwenFinishReason(choice.finish_reason),
      usage: {
        promptTokens: (_g = (_f = responseBody.usage) == null ? void 0 : _f.prompt_tokens) != null ? _g : Number.NaN,
        completionTokens: (_i = (_h = responseBody.usage) == null ? void 0 : _h.completion_tokens) != null ? _i : Number.NaN
      },
      ...providerMetadata && { providerMetadata },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      response: getResponseMetadata(responseBody),
      warnings,
      request: { body }
    };
  }
  /**
   * Returns a stream of model responses.
   * @param options - Stream generation options.
   * @returns A promise resolving with the stream and additional metadata.
   */
  async doStream(options) {
    var _a;
    if (this.settings.simulateStreaming) {
      const result = await this.doGenerate(options);
      const simulatedStream = new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "response-metadata", ...result.response });
          if (result.reasoning) {
            const reasoningText = typeof result.reasoning === "string" ? result.reasoning : result.reasoning.map((item) => item.type === "text" ? item.text : "").join("");
            controller.enqueue({
              type: "reasoning",
              textDelta: reasoningText
            });
          }
          if (result.text) {
            controller.enqueue({
              type: "text-delta",
              textDelta: result.text
            });
          }
          if (result.toolCalls) {
            for (const toolCall of result.toolCalls) {
              controller.enqueue({
                type: "tool-call",
                ...toolCall
              });
            }
          }
          controller.enqueue({
            type: "finish",
            finishReason: result.finishReason,
            usage: result.usage,
            logprobs: result.logprobs,
            providerMetadata: result.providerMetadata
          });
          controller.close();
        }
      });
      return {
        stream: simulatedStream,
        rawCall: result.rawCall,
        rawResponse: result.rawResponse,
        warnings: result.warnings
      };
    }
    const { args, warnings } = this.getArgs({ ...options });
    const requestBody = {
      ...args,
      stream: true,
      stream_options: {
        include_usage: true
      }
    };
    const body = JSON.stringify(requestBody);
    const metadataExtractor = (_a = this.config.metadataExtractor) == null ? void 0 : _a.createStreamExtractor();
    const { responseHeaders, value: response } = await postJsonToApi({
      url: this.config.url({
        path: "/chat/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders(this.config.headers(), options.headers),
      body: requestBody,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        this.chunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { messages: rawPrompt, ...rawSettings } = args;
    const toolCalls = [];
    let finishReason = "unknown";
    let usage = {
      promptTokens: void 0,
      completionTokens: void 0
    };
    let isFirstChunk = true;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          // Transforms incoming chunks and maps them to stream parts.
          transform(chunk, controller) {
            var _a2, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n;
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            metadataExtractor == null ? void 0 : metadataExtractor.processChunk(chunk.rawValue);
            if ("error" in value) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: value.error.message });
              return;
            }
            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value)
              });
            }
            if (value.usage != null) {
              usage = {
                promptTokens: (_a2 = value.usage.prompt_tokens) != null ? _a2 : void 0,
                completionTokens: (_b = value.usage.completion_tokens) != null ? _b : void 0
              };
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapQwenFinishReason(
                choice.finish_reason
              );
            }
            if ((choice == null ? void 0 : choice.delta) == null) {
              return;
            }
            const delta = choice.delta;
            if (delta.reasoning_content != null) {
              controller.enqueue({
                type: "reasoning",
                textDelta: delta.reasoning_content
              });
            }
            if (delta.content != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: delta.content
              });
            }
            if (delta.tool_calls != null) {
              for (const toolCallDelta of delta.tool_calls) {
                const index = toolCallDelta.index;
                if (toolCalls[index] == null) {
                  if (toolCallDelta.type !== "function") {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function' type.`
                    });
                  }
                  if (toolCallDelta.id == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'id' to be a string.`
                    });
                  }
                  if (((_c = toolCallDelta.function) == null ? void 0 : _c.name) == null) {
                    throw new InvalidResponseDataError({
                      data: toolCallDelta,
                      message: `Expected 'function.name' to be a string.`
                    });
                  }
                  toolCalls[index] = {
                    id: toolCallDelta.id,
                    type: "function",
                    function: {
                      name: toolCallDelta.function.name,
                      arguments: (_d = toolCallDelta.function.arguments) != null ? _d : ""
                    },
                    hasFinished: false
                  };
                  const toolCall2 = toolCalls[index];
                  if (((_e = toolCall2.function) == null ? void 0 : _e.name) != null && ((_f = toolCall2.function) == null ? void 0 : _f.arguments) != null) {
                    if (toolCall2.function.arguments.length > 0) {
                      controller.enqueue({
                        type: "tool-call-delta",
                        toolCallType: "function",
                        toolCallId: toolCall2.id,
                        toolName: toolCall2.function.name,
                        argsTextDelta: toolCall2.function.arguments
                      });
                    }
                    if (isParsableJson(toolCall2.function.arguments)) {
                      controller.enqueue({
                        type: "tool-call",
                        toolCallType: "function",
                        toolCallId: (_g = toolCall2.id) != null ? _g : generateId(),
                        toolName: toolCall2.function.name,
                        args: toolCall2.function.arguments
                      });
                      toolCall2.hasFinished = true;
                    }
                  }
                  continue;
                }
                const toolCall = toolCalls[index];
                if (toolCall.hasFinished) {
                  continue;
                }
                if (((_h = toolCallDelta.function) == null ? void 0 : _h.arguments) != null) {
                  toolCall.function.arguments += (_j = (_i = toolCallDelta.function) == null ? void 0 : _i.arguments) != null ? _j : "";
                }
                controller.enqueue({
                  type: "tool-call-delta",
                  toolCallType: "function",
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: (_k = toolCallDelta.function.arguments) != null ? _k : ""
                });
                if (((_l = toolCall.function) == null ? void 0 : _l.name) != null && ((_m = toolCall.function) == null ? void 0 : _m.arguments) != null && isParsableJson(toolCall.function.arguments)) {
                  controller.enqueue({
                    type: "tool-call",
                    toolCallType: "function",
                    toolCallId: (_n = toolCall.id) != null ? _n : generateId(),
                    toolName: toolCall.function.name,
                    args: toolCall.function.arguments
                  });
                  toolCall.hasFinished = true;
                }
              }
            }
          },
          flush(controller) {
            var _a2, _b;
            const metadata = metadataExtractor == null ? void 0 : metadataExtractor.buildMetadata();
            controller.enqueue({
              type: "finish",
              finishReason,
              usage: {
                promptTokens: (_a2 = usage.promptTokens) != null ? _a2 : Number.NaN,
                completionTokens: (_b = usage.completionTokens) != null ? _b : Number.NaN
              },
              ...metadata && { providerMetadata: metadata }
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings,
      request: { body }
    };
  }
};
function createQwenChatChunkSchema(errorSchema) {
  return z2.union([
    z2.object({
      id: z2.string().nullish(),
      created: z2.number().nullish(),
      model: z2.string().nullish(),
      choices: z2.array(
        z2.object({
          delta: z2.object({
            role: z2.enum(["assistant"]).nullish(),
            content: z2.string().nullish(),
            reasoning_content: z2.string().nullish(),
            tool_calls: z2.array(
              z2.object({
                index: z2.number(),
                id: z2.string().nullish(),
                type: z2.literal("function").nullish(),
                function: z2.object({
                  name: z2.string().nullish(),
                  arguments: z2.string().nullish()
                })
              })
            ).nullish()
          }).nullish(),
          finish_reason: z2.string().nullish()
        })
      ),
      usage: z2.object({
        prompt_tokens: z2.number().nullish(),
        completion_tokens: z2.number().nullish()
      }).nullish()
    }),
    errorSchema
  ]);
}

// src/qwen-completion-language-model.ts
import {
  UnsupportedFunctionalityError as UnsupportedFunctionalityError4
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders2,
  createEventSourceResponseHandler as createEventSourceResponseHandler2,
  createJsonErrorResponseHandler as createJsonErrorResponseHandler3,
  createJsonResponseHandler as createJsonResponseHandler2,
  postJsonToApi as postJsonToApi2
} from "@ai-sdk/provider-utils";
import { z as z3 } from "zod";

// src/convert-to-qwen-completion-prompt.ts
import {
  InvalidPromptError,
  UnsupportedFunctionalityError as UnsupportedFunctionalityError3
} from "@ai-sdk/provider";
function convertToQwenCompletionPrompt({
  prompt,
  inputFormat,
  user = "user",
  assistant = "assistant"
}) {
  if (inputFormat === "prompt" && prompt.length === 1 && prompt[0].role === "user" && prompt[0].content.length === 1 && prompt[0].content[0].type === "text") {
    return { prompt: prompt[0].content[0].text };
  }
  let text = "";
  if (prompt[0].role === "system") {
    text += `${prompt[0].content}

`;
    prompt = prompt.slice(1);
  }
  for (const { role, content } of prompt) {
    switch (role) {
      case "system": {
        throw new InvalidPromptError({
          message: `Unexpected system message in prompt: ${content}`,
          prompt
        });
      }
      case "user": {
        const userMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "image": {
              throw new UnsupportedFunctionalityError3({
                functionality: "images"
              });
            }
            default: {
              throw new Error(`Unsupported content part type: ${part.type}`);
            }
          }
        }).join("");
        text += `${user}:
${userMessage}

`;
        break;
      }
      case "assistant": {
        const assistantMessage = content.map((part) => {
          switch (part.type) {
            case "text": {
              return part.text;
            }
            case "tool-call": {
              throw new UnsupportedFunctionalityError3({
                functionality: "tool-call messages"
              });
            }
          }
        }).join("");
        text += `${assistant}:
${assistantMessage}

`;
        break;
      }
      case "tool": {
        throw new UnsupportedFunctionalityError3({
          functionality: "tool messages"
        });
      }
      default: {
        const _exhaustiveCheck = role;
        throw new Error(`Unsupported role: ${_exhaustiveCheck}`);
      }
    }
  }
  text += `${assistant}:
`;
  return {
    prompt: text,
    stopSequences: [`
${user}:`]
  };
}

// src/qwen-completion-language-model.ts
var QwenCompletionResponseSchema = z3.object({
  id: z3.string().nullish(),
  created: z3.number().nullish(),
  model: z3.string().nullish(),
  choices: z3.array(
    z3.object({
      text: z3.string(),
      finish_reason: z3.string()
    })
  ),
  usage: z3.object({
    prompt_tokens: z3.number(),
    completion_tokens: z3.number()
  }).nullish()
});
var QwenCompletionLanguageModel = class {
  // type inferred via constructor
  /**
   * Creates an instance of QwenCompletionLanguageModel.
   *
   * @param modelId - The model identifier.
   * @param settings - The settings specific for Qwen completions.
   * @param config - The configuration object which includes provider options and error handling.
   */
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.defaultObjectGenerationMode = void 0;
    var _a;
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
    const errorStructure = (_a = config.errorStructure) != null ? _a : defaultQwenErrorStructure;
    this.chunkSchema = createQwenCompletionChunkSchema(
      errorStructure.errorSchema
    );
    this.failedResponseHandler = createJsonErrorResponseHandler3(errorStructure);
  }
  get provider() {
    return this.config.provider;
  }
  get providerOptionsName() {
    return this.config.provider.split(".")[0].trim();
  }
  /**
   * Generates the arguments for invoking the LanguageModelV1 doGenerate method.
   *
   * This function processes the given options to build a configuration object for the request. It converts the
   * input prompt to a Qwen-specific format, merges stop sequences from both the user and the prompt conversion,
   * and applies standardized settings for model generation. Additionally, it emits warnings for any unsupported
   * settings (e.g., topK and non-text response formats) and throws errors if unsupported functionalities
   * (such as tools, toolChoice, or specific modes) are detected.
   *
   * @param options - The configuration options for generating completion arguments.
   * @param options.mode - The mode for generation, specifying the type and any additional functionalities.
   * @param options.inputFormat - The format of the input prompt.
   * @param options.prompt - The prompt text to be processed and used for generating a completion.
   * @param options.maxTokens - The maximum number of tokens to generate.
   * @param options.temperature - The sampling temperature for generation randomness.
   * @param options.topP - The nucleus sampling probability threshold.
   * @param options.topK - The Top-K sampling parameter (unsupported; will trigger a warning if provided).
   * @param options.frequencyPenalty - The frequency penalty to reduce token repetition.
   * @param options.presencePenalty - The presence penalty to encourage novel token generation.
   * @param options.stopSequences - Additional stop sequences provided by the user.
   * @param options.responseFormat - The desired response format (non-text formats will trigger a warning).
   * @param options.seed - The seed for random number generation, ensuring deterministic outputs.
   * @param options.providerMetadata - Additional metadata to be merged into the provider-specific settings.
   *
   * @returns An object containing:
   *  - args: The built arguments object ready to be passed to the generation method.
   *  - warnings: A list of warnings for unsupported settings that were detected.
   *
   * @throws UnsupportedFunctionalityError If unsupported functionalities (tools, toolChoice, object-json mode,
   *         or object-tool mode) are specified in the mode configuration.
   */
  getArgs({
    mode,
    inputFormat,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences: userStopSequences,
    responseFormat,
    seed,
    providerMetadata
  }) {
    var _a;
    const type = mode.type;
    const warnings = [];
    if (topK != null) {
      warnings.push({
        type: "unsupported-setting",
        setting: "topK"
      });
    }
    if (responseFormat != null && responseFormat.type !== "text") {
      warnings.push({
        type: "unsupported-setting",
        setting: "responseFormat",
        details: "JSON response format is not supported."
      });
    }
    const { prompt: completionPrompt, stopSequences } = convertToQwenCompletionPrompt({ prompt, inputFormat });
    const stop = [...stopSequences != null ? stopSequences : [], ...userStopSequences != null ? userStopSequences : []];
    const baseArgs = {
      // Model id and settings:
      model: this.modelId,
      echo: this.settings.echo,
      logit_bias: this.settings.logitBias,
      suffix: this.settings.suffix,
      user: this.settings.user,
      // Standardized settings:
      max_tokens: maxTokens,
      temperature,
      top_p: topP,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
      seed,
      ...providerMetadata == null ? void 0 : providerMetadata[this.providerOptionsName],
      // Prompt and stop sequences:
      prompt: completionPrompt,
      stop: stop.length > 0 ? stop : void 0
    };
    switch (type) {
      case "regular": {
        if ((_a = mode.tools) == null ? void 0 : _a.length) {
          throw new UnsupportedFunctionalityError4({
            functionality: "tools"
          });
        }
        if (mode.toolChoice) {
          throw new UnsupportedFunctionalityError4({
            functionality: "toolChoice"
          });
        }
        return { args: baseArgs, warnings };
      }
      case "object-json": {
        throw new UnsupportedFunctionalityError4({
          functionality: "object-json mode"
        });
      }
      case "object-tool": {
        throw new UnsupportedFunctionalityError4({
          functionality: "object-tool mode"
        });
      }
      default: {
        const _exhaustiveCheck = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }
  /**
   * Generates a completion response.
   *
   * @param options - Generation options including prompt and parameters.
   * @returns A promise resolving the generated text, usage, finish status, and metadata.
   */
  async doGenerate(options) {
    var _a, _b, _c, _d;
    const { args, warnings } = this.getArgs(options);
    const { responseHeaders, value: response } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler2(
        QwenCompletionResponseSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { prompt: rawPrompt, ...rawSettings } = args;
    const choice = response.choices[0];
    return {
      text: choice.text,
      usage: {
        promptTokens: (_b = (_a = response.usage) == null ? void 0 : _a.prompt_tokens) != null ? _b : Number.NaN,
        completionTokens: (_d = (_c = response.usage) == null ? void 0 : _c.completion_tokens) != null ? _d : Number.NaN
      },
      finishReason: mapQwenFinishReason(choice.finish_reason),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      response: getResponseMetadata(response),
      warnings,
      request: { body: JSON.stringify(args) }
    };
  }
  /**
   * Streams a completion response.
   *
   * @param options - Generation options including prompt and parameters.
   * @returns A promise resolving a stream of response parts and metadata.
   */
  async doStream(options) {
    const { args, warnings } = this.getArgs(options);
    const body = {
      ...args,
      stream: true
    };
    const { responseHeaders, value: response } = await postJsonToApi2({
      url: this.config.url({
        path: "/completions",
        modelId: this.modelId
      }),
      headers: combineHeaders2(this.config.headers(), options.headers),
      body,
      failedResponseHandler: this.failedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler2(
        this.chunkSchema
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch
    });
    const { prompt: rawPrompt, ...rawSettings } = args;
    let finishReason = "unknown";
    let usage = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN
    };
    let isFirstChunk = true;
    return {
      stream: response.pipeThrough(
        new TransformStream({
          transform(chunk, controller) {
            if (!chunk.success) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: chunk.error });
              return;
            }
            const value = chunk.value;
            if ("error" in value) {
              finishReason = "error";
              controller.enqueue({ type: "error", error: value.error });
              return;
            }
            if (isFirstChunk) {
              isFirstChunk = false;
              controller.enqueue({
                type: "response-metadata",
                ...getResponseMetadata(value)
              });
            }
            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.prompt_tokens,
                completionTokens: value.usage.completion_tokens
              };
            }
            const choice = value.choices[0];
            if ((choice == null ? void 0 : choice.finish_reason) != null) {
              finishReason = mapQwenFinishReason(
                choice.finish_reason
              );
            }
            if ((choice == null ? void 0 : choice.text) != null) {
              controller.enqueue({
                type: "text-delta",
                textDelta: choice.text
              });
            }
          },
          flush(controller) {
            controller.enqueue({
              type: "finish",
              finishReason,
              usage
            });
          }
        })
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      warnings,
      request: { body: JSON.stringify(body) }
    };
  }
};
function createQwenCompletionChunkSchema(errorSchema) {
  return z3.union([
    z3.object({
      id: z3.string().nullish(),
      created: z3.number().nullish(),
      model: z3.string().nullish(),
      choices: z3.array(
        z3.object({
          text: z3.string(),
          finish_reason: z3.string().nullish(),
          index: z3.number()
        })
      ),
      usage: z3.object({
        prompt_tokens: z3.number(),
        completion_tokens: z3.number()
      }).nullish()
    }),
    errorSchema
  ]);
}

// src/qwen-embedding-model.ts
import {
  TooManyEmbeddingValuesForCallError
} from "@ai-sdk/provider";
import {
  combineHeaders as combineHeaders3,
  createJsonErrorResponseHandler as createJsonErrorResponseHandler4,
  createJsonResponseHandler as createJsonResponseHandler3,
  postJsonToApi as postJsonToApi3
} from "@ai-sdk/provider-utils";
import { z as z4 } from "zod";
var qwenTextEmbeddingResponseSchema = z4.object({
  data: z4.array(z4.object({ embedding: z4.array(z4.number()) })),
  usage: z4.object({ prompt_tokens: z4.number() }).nullish()
});
var QwenEmbeddingModel = class {
  constructor(modelId, settings, config) {
    this.specificationVersion = "v1";
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }
  get provider() {
    return this.config.provider;
  }
  get maxEmbeddingsPerCall() {
    var _a;
    return (_a = this.config.maxEmbeddingsPerCall) != null ? _a : 2048;
  }
  get supportsParallelCalls() {
    var _a;
    return (_a = this.config.supportsParallelCalls) != null ? _a : true;
  }
  /**
   * Sends a request to the Qwen API to generate embeddings for the provided text inputs.
   *
   * This function validates that the number of embedding values does not exceed the allowed limit,
   * constructs a JSON payload with the required parameters, and sends it to the API endpoint.
   * It processes the response to extract embeddings, usage statistics, and raw response headers.
   *
   * @param param0 - The parameters object.
   * @param param0.values - An array of strings to be embedded.
   * @param param0.headers - Optional HTTP headers for the API request.
   * @param param0.abortSignal - Optional signal to abort the API request.
   * @returns A promise that resolves with an object containing:
   *   - embeddings: An array of embedding arrays.
   *   - usage: Optional usage information, including token counts.
   *   - rawResponse: The response headers from the API call.
   *
   * @throws TooManyEmbeddingValuesForCallError if the number of input values exceeds the maximum allowed.
   */
  async doEmbed({
    values,
    headers,
    abortSignal
  }) {
    var _a;
    if (values.length > this.maxEmbeddingsPerCall) {
      throw new TooManyEmbeddingValuesForCallError({
        provider: this.provider,
        modelId: this.modelId,
        maxEmbeddingsPerCall: this.maxEmbeddingsPerCall,
        values
      });
    }
    const { responseHeaders, value: response } = await postJsonToApi3({
      url: this.config.url({
        path: "/embeddings",
        modelId: this.modelId
      }),
      headers: combineHeaders3(this.config.headers(), headers),
      body: {
        model: this.modelId,
        input: values,
        encoding_format: "float",
        dimensions: this.settings.dimensions,
        user: this.settings.user
      },
      // Handle response errors using the provided error structure.
      failedResponseHandler: createJsonErrorResponseHandler4(
        (_a = this.config.errorStructure) != null ? _a : defaultQwenErrorStructure
      ),
      // Process successful responses based on a minimal schema.
      successfulResponseHandler: createJsonResponseHandler3(
        qwenTextEmbeddingResponseSchema
      ),
      abortSignal,
      fetch: this.config.fetch
    });
    return {
      embeddings: response.data.map((item) => item.embedding),
      usage: response.usage ? { tokens: response.usage.prompt_tokens } : void 0,
      rawResponse: { headers: responseHeaders }
    };
  }
};

// src/qwen-provider.ts
function createQwen(options = {}) {
  var _a;
  const baseURL = withoutTrailingSlash(
    (_a = options.baseURL) != null ? _a : "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"
  );
  const getHeaders = () => ({
    Authorization: `Bearer ${loadApiKey({
      apiKey: options.apiKey,
      environmentVariableName: "DASHSCOPE_API_KEY",
      description: "Qwen API key"
    })}`,
    ...options.headers
  });
  const getCommonModelConfig = (modelType) => ({
    provider: `qwen.${modelType}`,
    url: ({ path }) => {
      const url = new URL(`${baseURL}${path}`);
      if (options.queryParams) {
        url.search = new URLSearchParams(options.queryParams).toString();
      }
      return url.toString();
    },
    headers: getHeaders,
    fetch: options.fetch
  });
  const createChatModel = (modelId, settings = {}) => new QwenChatLanguageModel(modelId, settings, {
    ...getCommonModelConfig("chat"),
    defaultObjectGenerationMode: "tool"
  });
  const createCompletionModel = (modelId, settings = {}) => new QwenCompletionLanguageModel(
    modelId,
    settings,
    getCommonModelConfig("completion")
  );
  const createTextEmbeddingModel = (modelId, settings = {}) => new QwenEmbeddingModel(
    modelId,
    settings,
    getCommonModelConfig("embedding")
  );
  const provider = (modelId, settings) => createChatModel(modelId, settings);
  provider.chatModel = createChatModel;
  provider.completion = createCompletionModel;
  provider.textEmbeddingModel = createTextEmbeddingModel;
  provider.languageModel = createChatModel;
  return provider;
}
var qwen = createQwen();
export {
  createQwen,
  qwen
};
//# sourceMappingURL=index.mjs.map
/* eslint-disable @typescript-eslint/no-explicit-any */
import qwen from "@/utils/qwen";
import doubao from "./doubao";
import deepseek from "./deepseek";

export type LLMModelName = 'qwen' | 'doubao' | 'deepseek' | 'doubao-flash' | 'doubao-thinking';

type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

function cleanJSON(obj: Record<string, any>): Record<string, JSONValue> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, value]) => value !== undefined)
  );
}

export function getModelProvider(modelName: string = "doubao", enableThinking: boolean = false) {
  switch (modelName) {
    case "qwen":
      return {
        provider: "qwen",
        modelId: qwen("qwen3-30b-a3b-instruct-2507"),
        options: cleanJSON({
          enable_thinking: enableThinking
        })
      };
    case "doubao":
      return {
        provider: "doubao",
        modelId: doubao("doubao-seed-1-6-250615"),
        options: cleanJSON({
          enable_thinking: enableThinking
        })
      };
    case "doubao-flash":
      return {
        provider: "doubao",
        modelId: doubao("doubao-seed-1-6-flash-250615"),
        options: cleanJSON({
          enable_thinking: enableThinking
        })
      };
    case "doubao-thinking":
      return {
        provider: "doubao",
        modelId: doubao("doubao-seed-1-6-thinking-250715"),
        options: cleanJSON({
          enable_thinking: enableThinking
        })
      };
    case "deepseek":
      return {
        provider: "deepseek",
        modelId: deepseek("deepseek-chat"),
        options: cleanJSON({
          temperature: 0.6
        })
      };
    default:
      throw new Error(`不支持的模型名：${modelName}`);
  }
}
"use client";

import React, { useState } from "react";
import type { LLMModelName } from "@/utils/getModelProvider"; // 引入类型

interface Props {
  onChange: (modelName: LLMModelName) => void;
  onThinkingChange?: (thinking: boolean) => void;
}

const modelOptions: { value: LLMModelName; label: string }[] = [
  { value: "doubao", label: "豆包" },
  { value: "qwen", label: "通义千问" },
  { value: "deepseek", label: "DeepSeek" },
  { value: "doubao-flash", label: "豆包flash" },
  { value: "doubao-thinking", label: "豆包thinking" },
];

const ModelSelector: React.FC<Props> = ({ onChange, onThinkingChange }) => {
  const [selectedModel, setSelectedModel] = useState<LLMModelName>("qwen");
  const [enableThinking, setEnableThinking] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = e.target.value as LLMModelName; 
    setSelectedModel(newModel);
    onChange(newModel);
  };

  const handleThinkingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.checked;
    setEnableThinking(value);
    if (onThinkingChange) {
      onThinkingChange(value);
    }
  };

    return (
      <div className="w-full max-w-md p-4 border rounded-lg bg-white space-y-2">
        <label htmlFor="model-select" className="text-sm font-medium text-gray-700">
            选择大模型：
        </label>
        <select
            id="model-select"
            className="w-full px-3 py-2 border rounded-md"
            value={selectedModel}
            onChange={handleChange}
        >
            {modelOptions.map((model) => (
            <option key={model.value} value={model.value}>
                {model.label}
            </option>
            ))}
        </select>

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="thinking-mode"
            checked={enableThinking}
            onChange={handleThinkingToggle}
          />
          <label htmlFor="thinking-mode" className="text-sm text-gray-700">
            开启思考模式（enable_thinking）
          </label>
        </div>
      </div>
    );
}

export default ModelSelector;
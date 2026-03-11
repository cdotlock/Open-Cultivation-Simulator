import { generateObject, GenerateObjectResult, JSONParseError } from "ai";
import { jsonrepair } from "jsonrepair";
import pRetry from "p-retry";
import { z } from "zod";
import { prisma } from '@/lib/prisma';

interface StableGenerateObjectParams<T> {
  model: Parameters<typeof generateObject>[0]['model'];
  schema: z.ZodSchema<T>;
  system: string;
  prompt: string;
  maxTokens?: number;
  providerOptions?: Parameters<typeof generateObject>[0]['providerOptions'];
  maxRetries?: number;
  retryDelay?: number;
  promptTemplate?: string;
  gameId?: number;
  userUuid?: string;
}

/**
 * 稳定版本的generateObject，集成jsonRepair和retry机制
 */
export async function stableGenerateObject<T>({
  model,
  schema,
  system,
  prompt,
  maxTokens,
  providerOptions,
  maxRetries = 3,
  retryDelay = 1000,
  gameId,
  userUuid,
  promptTemplate,
}: StableGenerateObjectParams<T>): Promise<GenerateObjectResult<T>> {
  
  const startTime = Date.now();
  let attemptCount = 0;
  let usedRepair = false;
  let usedLlmRepair = false;

  // 创建初始日志记录
  const logData = {
    model: typeof model === 'string' ? model : String(model),
    prompt,
    schema: JSON.stringify(schema._def),
    maxTokens,
    providerOptions: providerOptions ? JSON.stringify(providerOptions) : null,
    success: false,
    attemptCount: 0,
    usedRepair: false,
    usedLlmRepair: false,
  };
  
  const attemptGeneration = async (): Promise<GenerateObjectResult<T>> => {

    attemptCount++;
    
    try {
      const result = await generateObject({
        model,
        schema,
        system,
        prompt,
        maxTokens,
        providerOptions,
        experimental_repairText: async ({ text, error }) => {
          console.error(`experimental_repairText 被调用: ${error?.message}`);

          let repairedText = text;

          // 第一步：如果是 JSON 解析错误，尝试使用 jsonrepair 修复
          if (text && (error instanceof JSONParseError || error?.name === 'JSONParseError')) {
            const repairStart = Date.now();
            try {
              repairedText = jsonrepair(text);

              usedRepair = true;
              
              // 验证修复后的 JSON 是否符合 schema
              try {
                const parsed = JSON.parse(repairedText);
                const validation = schema.safeParse(parsed);
                if (validation.success) {
                  const repairEnd = Date.now();
                  console.log(`✅JSON修复成功，耗时为 ${repairEnd - repairStart} ms`);
                  return repairedText;
                }
              } catch (parseError) {
                console.error(parseError)
              }
            } catch (repairError) {
                console.error(repairError)
            }
          }

          // 第二步：使用 LLM 修复（如果 jsonrepair 失败或修复后仍不符合 schema）
          usedLlmRepair = true;
          
          try {
            const llmRepairedResult = await llmRepairObject({
              model,
              schema,
              originalPrompt: prompt,
              errorMessage: error?.message || '未知错误',
              brokenOutput: repairedText || text, // 使用 jsonrepair 修复后的文本或原文本
              maxTokens,
              errorType: error?.constructor?.name || 'Unknown'
            });
            
            return JSON.stringify(llmRepairedResult.object);
          } catch (llmError) {
            console.error('❌LLM 修复也失败了:', llmError);
            // 返回一个最小的有效 JSON 结构
            return generateMinimalValidJson(schema);
          }
        }
      });

      return result;
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.warn(`generateObject attempt ${attemptCount} failed: ${errorMessage}`);
      throw error;
    }
  };

  try {
    // 使用p-retry进行重试
    const result = await pRetry(attemptGeneration, {
      retries: maxRetries,
      minTimeout: retryDelay,
      factor: 2, // 指数退避
      onFailedAttempt: (error) => {
        console.warn(
          `generateObject重试 ${error.attemptNumber}/${maxRetries + 1}: ${error.message}`
        );
      },
    });

    // 记录成功日志
    await prisma.llmCallLog.create({
      data: {
        ...logData,
        result: JSON.stringify(result.object),
        systemPrompt: system,
        success: true,
        attemptCount,
        model: model.modelId,
        usedRepair,
        userUuid,
        gameId,
        promptTemplate,
        usedLlmRepair,
        duration: Date.now() - startTime,
      }
    });

    return result;
  } catch (error) {
    // 记录失败日志
    await prisma.llmCallLog.create({
      data: {
        ...logData,
        errorMessage: error instanceof Error ? error.message : String(error),
        systemPrompt: system,
        success: false,
        attemptCount,
        model: model.modelId,
        usedRepair,
        usedLlmRepair,
        userUuid,
        gameId,
        promptTemplate,
        duration: Date.now() - startTime,
      }
    });

    throw error;
  }
}

/**
 * 使用 LLM 修复损坏的 JSON 输出
 */
async function llmRepairObject<T>({
  model,
  schema,
  originalPrompt,
  errorMessage,
  brokenOutput,
  maxTokens,
  errorType,
}: {
  model: Parameters<typeof generateObject>[0]['model'];
  schema: z.ZodSchema<T>;
  originalPrompt: string;
  errorMessage: string;
  brokenOutput?: string | null;
  maxTokens?: number;
  errorType?: string;
}): Promise<GenerateObjectResult<T>> {
  
  // 生成更好的 schema 描述
  const schemaDescription = generateSchemaDescription(schema);
  
  // 根据错误类型构建不同的修复提示词
  let repairPrompt = '';
  
  if (errorType === 'JSONParseError' || errorType?.includes('JSON')) {
    repairPrompt = `
# JSON 格式修复任务

## 遇到的问题
JSON 解析错误: ${errorMessage}

## 损坏的输出
${brokenOutput || '无法获取原始输出'}

## 要求的数据结构
${schemaDescription}

## 修复指导
1. 修复JSON语法错误（如缺少引号、括号不匹配、多余逗号等）
2. 确保所有字符串都用双引号包围
3. 确保数组和对象结构正确
4. 保留原始数据的语义内容
5. 如果某些字段缺失，根据上下文合理补充

请生成格式正确的JSON数据。`;
  } else if (errorType === 'TypeValidationError' || errorType?.includes('Type')) {
    repairPrompt = `
# 数据结构验证修复任务


## 遇到的问题
数据结构验证失败: ${errorMessage}

## 当前数据
${brokenOutput || '无法获取当前数据'}

## 要求的数据结构
${schemaDescription}

## 修复指导
1. 确保所有必填字段都存在
2. 确保字段类型正确（字符串、数字、布尔值、数组等）
3. 确保枚举值在允许的范围内
4. 确保数组元素符合要求的结构
5. 确保数字在指定的范围内
6. 保持原始数据的语义，只修正格式和类型问题

请生成符合结构要求的正确数据。`;
  } else {
    repairPrompt = `
# 通用数据修复任务


## 遇到的问题
${errorMessage}

## 问题数据
${brokenOutput || '无法获取问题数据'}

## 要求的数据结构
${schemaDescription}

## 修复指导
1. 根据原始任务要求重新生成数据
2. 确保JSON格式正确
3. 确保所有字段符合类型要求
4. 确保必填字段都存在
5. 尽量保持与原始意图一致的内容

请生成完整、正确的数据。`;
  }


  // 调用 LLM 进行修复
  const llmStartTime = Date.now();
  const llmResult = await generateObject({
    model,
    schema,
    system: "你是一个专业的数据修复专家。请根据用户的要求，修复有问题的数据，确保输出完全符合指定的结构要求。",
    prompt: repairPrompt,
    maxTokens,
    providerOptions: {
      qwen: { enable_thinking: false }
    }
  });
  const llmEndTime = Date.now();
  console.log(`✅LLM 修复成功！耗时 ${llmEndTime - llmStartTime} ms`);
  return llmResult;
}

/**
 * 生成 schema 的人类可读描述
 */
function generateSchemaDescription(schema: z.ZodSchema<unknown>): string {
  try {
    // 尝试使用 schema 生成一个示例来了解结构
    const sampleData = generateSampleFromSchema(schema);
    
    if (sampleData !== null) {
      return `
数据结构示例：
\`\`\`json
${JSON.stringify(sampleData, null, 2)}
\`\`\`

重要提示：
- 请严格按照上述结构生成数据
- 确保所有必填字段都存在
- 确保字段类型正确（字符串、数字、布尔值、数组、对象）
- 如果有枚举字段，只能使用枚举中定义的值
- 数字字段请确保在合理范围内`;
    } else {
      return `请根据 schema 要求生成正确的数据结构。确保：
- 所有必填字段都存在
- 字段类型正确
- 枚举值在允许范围内
- 数组包含正确类型的元素`;
    }
  } catch {
    return `请根据 schema 定义生成正确的数据结构。如果有具体的字段要求，请严格遵循。`;
  }
}

/**
 * 尝试从 schema 生成示例数据（通用版本）
 */
function generateSampleFromSchema(schema: z.ZodSchema<unknown>): unknown {
  try {
    // 尝试使用 schema.parse 来获取默认值或示例
    // 这里使用一个通用的方法来尝试生成示例
    
    // 对于大多数情况，我们可以尝试解析一个空对象或基本值
    // 如果 schema 有默认值，这会工作
    try {
      return schema.parse({});
    } catch {
      // 如果空对象不行，尝试一些常见的基本值
      const commonValues = [
        null,
        "",
        0,
        false,
        [],
        {}
      ];
      
      for (const value of commonValues) {
        try {
          return schema.parse(value);
        } catch {
          continue;
        }
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * 生成最小有效的 JSON 结构
 */
function generateMinimalValidJson(schema: z.ZodSchema<unknown>): string {
  try {
    // 尝试从 schema 生成一个最小的有效结构
    const sample = generateSampleFromSchema(schema);
    if (sample !== null) {
      return JSON.stringify(sample);
    }
    
    // 如果无法从 schema 生成，尝试一些通用的最小结构
    const fallbackValues = ['{}', '[]', '""', '0', 'false', 'null'];
    
    for (const fallback of fallbackValues) {
      try {
        const parsed = JSON.parse(fallback);
        schema.parse(parsed);
        return fallback;
      } catch {
        continue;
      }
    }
    
    // 最后的兜底方案
    return '{}';
  } catch (error) {
    console.error('无法生成最小有效 JSON:', error);
    return '{}';
  }
}
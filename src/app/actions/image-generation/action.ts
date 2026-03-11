"use server";

import { generateImage } from "../image-gen";
import { GamePushResponse } from "@/interfaces/dto";
import { CharacterDescriptionType } from "@/interfaces/schemas";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { generateText } from "ai";
import prisma from "@/lib/prisma";
import { getLocalAppConfig } from "@/lib/local-config/store";

/**
 * 检查是否需要生成图像并执行生成
 * @param characterId 角色ID
 * @param gamePushResponse 游戏推进响应
 * @returns 图像生成结果
 */
export async function checkAndGenerateImage(
  characterId: number, 
  gamePushResponse: GamePushResponse
): Promise<{ shouldGenerate: boolean; imageUrl?: string; error?: string }> {
  try {
    const localConfig = await getLocalAppConfig();
    if (!localConfig.features.imageGenerationEnabled) {
      return { shouldGenerate: false };
    }

    const pushCount = await prisma.gamePush.count({
      where: {
        characterId,
        isChoice: true,
      },
    });
    
    console.log(`角色 ${characterId} 推进局数: ${pushCount}`);
    
    // 检查是否达到10局
    if (pushCount>=10) {
      console.log(`角色 ${characterId} 达到10局，开始生成图像`);
      
      // 构建图像生成提示词
      const prompt = await buildImagePromptByLLM(characterId, gamePushResponse);
      
      // 生成图像 - 使用doubao-seedream模型
      const result = await generateImage({
        prompt,
        model: "doubao-seedream",
        size: "1664x2496", // 使用2:3尺寸
        negative_prompt: "模糊, 低质量, 变形, 不完整, 水印"
      });
      
      if (result.success && result.url) {
        console.log(`角色 ${characterId} 图像生成成功: ${result.url}`);
        
        return {
          shouldGenerate: true,
          imageUrl: result.url
        };
      } else {
        console.error(`角色 ${characterId} 图像生成失败: ${result.error}`);
        return {
          shouldGenerate: true,
          error: result.error
        };
      }
    }
    
    return { shouldGenerate: false };
    
  } catch (error) {
    console.error("图像生成检查失败:", error);
    return {
      shouldGenerate: false,
      error: error instanceof Error ? error.message : "未知错误"
    };
  }
}



async function buildImagePromptByLLM(characterId: number, gamePushResponse: GamePushResponse): Promise<string> {
  try {
    // 从配置服务获取story_illustration配置
    const config = await ConfigService.getConfig('story_illustration');

    if (!config) {
      throw new Error("未找到story_illustration配置");
    }

    // 检查模型配置是否存在
    if (!config.model) {
      throw new Error("story_illustration配置中缺少模型配置");
    }

    // 构建变量对象，使用INPUT变量替换JSON.stringify(gamePushResponse)
    let appearance = '';

    try {
      const character = await prisma.character.findUnique({
        where: { id: characterId },
        select: { description: true }
      });

      if (character?.description) {
        let descriptionData: CharacterDescriptionType | null = null;

        if (typeof character.description === 'string') {
          descriptionData = JSON.parse(character.description) as CharacterDescriptionType;
        } else if (typeof character.description === 'object' && character.description !== null) {
          descriptionData = character.description as CharacterDescriptionType;
        }

        appearance = descriptionData?.外貌特征 ?? '';
      }
    } catch (error) {
      console.warn('获取角色外貌特征失败:', error);
    }

    const variables: Record<string, string> = {
      INPUT: JSON.stringify(gamePushResponse),
      appearance
    };
    
    // 渲染系统提示词（替换插值表达式）
    let systemPrompt = config.systemPrompt || '';
    Object.keys(variables).forEach(key => {
      systemPrompt = systemPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
    });
    
    // 渲染用户提示词（替换插值表达式）
    let userPrompt = config.userPrompt;
    Object.keys(variables).forEach(key => {
      userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
    });

    console.log("\n📝 【图像提示词生成】提示词结构:");
    console.log(`- 系统提示词: ${systemPrompt ? '已渲染' : '无'}`);
    console.log(`- 用户提示词长度: ${userPrompt.length} 字符`);
    console.log("----------------------------------------");

    // 根据配置创建模型实例
    const modelInstance = createModelFromConfig(config.model);

    // 获取provider选项
    const providerOptions = getProviderOptions(config.model, config);

    const { text } = await generateText({
      model: modelInstance(config.model.name),
      prompt: userPrompt,
      system: systemPrompt,
      maxTokens: 1000,
      providerOptions,
    });

    // 记录LLM调用日志
    await prisma.llmCallLog.create({
      data: {
        model: config.model.name,
        prompt: userPrompt,
        systemPrompt: systemPrompt,
        result: text,
        schema: '',
        success: true,
        promptTemplate: 'story_illustration',
      }
    });

    return text;
  } catch (error) {
    console.error("图像提示词生成失败:", error);
    throw error;
  }
}


/**
 * 获取当前推进局数
 * @param characterId 角色ID
 * @returns 当前局数
 */
export async function getCurrentPushCount(characterId: number): Promise<number> {
  return prisma.gamePush.count({
    where: {
      characterId,
      isChoice: true,
    },
  });
}

/**
 * 重置推进局数
 * @param characterId 角色ID
 */
export async function resetPushCount(characterId: number): Promise<void> {
  void characterId;
}

/**
 * 使用指定模型生成图像
 * @param characterId 角色ID
 * @param gamePushResponse 游戏推进响应
 * @param model 图像生成模型 ("qwen" | "doubao-seedream")
 * @returns 图像生成结果
 */
export async function generateImageWithModel(
  characterId: number, 
  gamePushResponse: GamePushResponse,
  model: "qwen" | "doubao-seedream" = "doubao-seedream"
): Promise<{ shouldGenerate: boolean; imageUrl?: string; error?: string; model?: string }> {
  try {
    console.log(`角色 ${characterId} 使用 ${model} 模型生成图像`);
    
    // 构建图像生成提示词
    const prompt = await buildImagePromptByLLM(characterId, gamePushResponse);
    
    // 根据模型选择不同的参数
    const imageParams: {
      prompt: string;
      model: "qwen" | "doubao-seedream";
      negative_prompt: string;
      size?: string;
    } = {
      prompt,
      model,
      negative_prompt: "模糊, 低质量, 变形, 不完整, 水印"
    };

    // 根据模型设置不同的默认尺寸
    if (model === "qwen") {
      imageParams.size = "1328*1328";
    } else if (model === "doubao-seedream") {
      imageParams.size = "1024x1024";
    }
    
    // 生成图像
    const result = await generateImage(imageParams);
    
    if (result.success && result.url) {
      console.log(`角色 ${characterId} 使用 ${model} 模型图像生成成功: ${result.url}`);
      
      return {
        shouldGenerate: true,
        imageUrl: result.url,
        model: result.model
      };
    } else {
      console.error(`角色 ${characterId} 使用 ${model} 模型图像生成失败: ${result.error}`);
      return {
        shouldGenerate: true,
        error: result.error,
        model: result.model
      };
    }
    
  } catch (error) {
    console.error(`使用 ${model} 模型图像生成失败:`, error);
    return {
      shouldGenerate: false,
      error: error instanceof Error ? error.message : "未知错误",
      model
    };
  }
}

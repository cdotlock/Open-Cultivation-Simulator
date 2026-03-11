import Prompts from "@/utils/prompts";
import { generateObject } from 'ai';
import { z } from 'zod';
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { GamePush } from "@/app/actions/generated/prisma";
import { CharacterStatusType, StoryPushType } from "@/interfaces/schemas";
import { formatStatusWithMax } from "../character/constants";
import { performCheck } from "./checkSystem";

export interface OptionAnalysis {
  选项描述: string;
  选项类别: "交流" | "探索" | "战斗";
  选项难度: "轻而易举" | "按部就班" | "挑战重重" | "困难卓绝" | "逆天而行";
  成功率: number;
  是否成功: boolean;
  骰子: number[];
  基础DC: number;
  修正值: number;
  变动原因: string[];
}

const optionAnalysisSchema = z.object({
  选项描述: z.string(),
  选项类别: z.enum(["交流", "探索", "战斗"]),
  选项难度: z.enum(["轻而易举", "按部就班", "挑战重重", "困难卓绝", "逆天而行"])
});

export class OptionAnalysisService {
  /**
   * 分析自定义选项的类别和难度
   * @param userOption 用户输入的选项
   * @param currentPush 当前游戏进度
   * @param currentStatus 当前角色状态
   * @returns 选项分析结果
   */
  async analyzeCustomOption(
    userOption: string,
    currentPush: GamePush,
    currentStatus: CharacterStatusType
  ): Promise<OptionAnalysis> {
    try {
      // 获取配置
      const config = await ConfigService.getConfig('custom_option_difficulty');
      
      if (!config.model) {
        throw new Error('配置中缺少模型信息');
      }

      const modelInstance = createModelFromConfig(config.model);
      const providerOptions = getProviderOptions(config.model, config);

      // 构建上下文信息
      const currentInfo = currentPush.info as StoryPushType;
      const statusForPrompt = formatStatusWithMax(currentStatus);
      
      const context = {
        USER_OPTION: userOption,
        CURRENT_SCENE: currentInfo.节点要素.剧情要素.剧情,
        CHARACTER_STATUS: JSON.stringify(statusForPrompt, null, 2),
        STORY_CONTEXT: currentInfo.节点要素.剧情要素.剧情
      };

      // 替换prompt中的变量
      let finalPrompt = config.userPrompt;
      Object.entries(context).forEach(([key, value]) => {
        finalPrompt = finalPrompt.replace(new RegExp(`{${key}}`, 'g'), value);
      });

      // 调用LLM进行分析
      const { object } = await generateObject({
        model: modelInstance(config.model.name),
        system: config.systemPrompt,
        prompt: finalPrompt,
        schema: optionAnalysisSchema,
        temperature: 0.3,
        maxTokens: 200,
        providerOptions,
      }); 
      console.log(`[analyzeCustomOption] LLM返回的分析结果:`, object);

      // 直接使用解析后的对象
      const basicAnalysis = object;
      
      // 根据分析结果进行骰子检定
      const statusForCheck = formatStatusWithMax(currentStatus);
      const checkResult = performCheck(basicAnalysis.选项类别, basicAnalysis.选项难度, statusForCheck);
      
      // 组合完整的分析结果
      const fullAnalysis: OptionAnalysis = {
        ...basicAnalysis,
        成功率: checkResult.successRate,
        是否成功: checkResult.success,
        骰子: checkResult.diceValues,
        基础DC: checkResult.baseDC,
        修正值: checkResult.modifier,
        变动原因: checkResult.changeReasons
      };
      
      return fullAnalysis;
    } catch (error) {
      console.error('选项分析失败:', error);
      // 返回默认值（包含骰子检定）
      const statusForDefault = formatStatusWithMax(currentStatus);
      const defaultCheckResult = performCheck("探索", "按部就班", statusForDefault);
      
      return {
        选项描述: userOption,
        选项类别: "探索",
        选项难度: "按部就班",
        成功率: defaultCheckResult.successRate,
        是否成功: defaultCheckResult.success,
        骰子: defaultCheckResult.diceValues,
        基础DC: defaultCheckResult.baseDC,
        修正值: defaultCheckResult.modifier,
        变动原因: defaultCheckResult.changeReasons
      };
    }
  }
}
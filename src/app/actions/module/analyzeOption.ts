'use server';

import { OptionAnalysisService, OptionAnalysis } from './OptionAnalysisService';
import { getCharacterById, getGamePushById } from './query';
import { CharacterStatusSchema } from '@/interfaces/schemas';
import { handleActionError } from '@/lib/server-error-handler';

/**
 * 分析用户自定义选项的action
 */
export async function analyzeCustomOption(
  characterId: number,
  userOption: string
): Promise<OptionAnalysis> {
  try {
    // 获取角色和当前推进信息
    const character = await getCharacterById(characterId);
    if (!character.currentPushId) {
      throw new Error("角色当前推进ID为空");
    }
    const currentPush = await getGamePushById(character.currentPushId);
    
    // 解析当前状态
    const statusSchema = CharacterStatusSchema.safeParse(currentPush.status);
    if (!statusSchema.success) {
      throw new Error("角色状态解析失败");
    }
    const currentStatus = statusSchema.data;

    // 使用OptionAnalysisService分析选项
    const analysisService = new OptionAnalysisService();
    const result = await analysisService.analyzeCustomOption(
      userOption,
      currentPush,
      currentStatus
    );

    return result;
  } catch (error) {
    await handleActionError(
      error instanceof Error ? error : new Error(String(error)),
      'analyzeCustomOption',
      `characterId:${characterId}, userOption:${userOption}`
    );
    throw error;
  }
}
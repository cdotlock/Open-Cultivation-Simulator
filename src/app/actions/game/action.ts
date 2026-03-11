"use server";

import { GameCharacterRefactored as GameCharacter } from "../module/GameCharacterRefactored";
import { GamePushResponse, PreAnalyzedOptionPayload } from "@/interfaces/dto";
import { handleActionError } from "@/lib/server-error-handler";
import { checkAndGenerateImage } from "../image-generation/action";



/* -------------------------------------------------------------------------- */
/*                              Public Actions                                */
/* -------------------------------------------------------------------------- */

// 旧接口保持兼容，但内部完全委托给新版本 GameCharacter --------------------
export async function startGame(characterId: number): Promise<GamePushResponse> {
  try {
    const gameCharacter = await GameCharacter.load(characterId);
    return await gameCharacter.startGame();
  } catch (error) {
    // 统一错误处理
    await handleActionError(
      error instanceof Error ? error : new Error(String(error)),
      "startGame",
      characterId.toString()
    );
    throw error;
  }
}


export async function pushGame(
  currentPushId: number,
  characterId: number,
  choice: string,
  preAnalyzedOption?: PreAnalyzedOptionPayload
): Promise<GamePushResponse> {
  try {
    const gameCharacter = await GameCharacter.load(characterId);
    const serverCurrentPushId = gameCharacter.getCurrentPushId();

    // 对于自定义选项（包含preAnalyzedOption），允许状态不一致，自动使用服务器最新状态
    if (
      Number.isInteger(currentPushId) &&
      currentPushId > 0 &&
      serverCurrentPushId !== currentPushId &&
      !preAnalyzedOption
    ) {
      throw new Error(
        `当前进度与服务器已不一致，当前推送: ${serverCurrentPushId}, 客户端传入: ${currentPushId}`
      );
    }
    const response = await gameCharacter.pushGame(choice, preAnalyzedOption);
    
    // 检查是否需要生成图像
    const imageResult = await checkAndGenerateImage(characterId, response);
    
    // 将图像生成结果添加到响应中
    if (imageResult.shouldGenerate) {
      response.imageGeneration = {
        shouldGenerate: true,
        imageUrl: imageResult.imageUrl,
        error: imageResult.error
      };
    }
    
    return response;
  } catch (error) {
    // 统一错误处理
    await handleActionError(
      error instanceof Error ? error : new Error(String(error)),
      "pushGame",
      characterId.toString()
    );
    throw error;
  }
}

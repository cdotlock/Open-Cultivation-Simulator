"use server";

import { stableGenerateObject } from "@/utils/stableGenerateObject"
import { CharacterDescriptionSchema } from "@/interfaces/schemas";
import { cultivationLevels } from "@/interfaces/const";
import { handleActionError } from "@/lib/server-error-handler";
import { dbOperations } from "@/lib/db-error-wrapper";
import { GameCharacterRefactored as GameCharacter } from "../module/GameCharacterRefactored";
import { changeAttr, getInitialStatus } from "../module/attributeSystem";
import { formatStatusWithMax, getAttributeLimitsByLevel } from "./constants";
import { CharacterWithGamePush, BreakthroughResponse, CharacterDescriptionType, BaseGamePush } from "@/interfaces";
import { InputJsonValue } from "../generated/prisma/runtime/library";
import { CharacterStatusSchema, CharacterStatusType } from "@/interfaces/schemas";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { prisma } from '@/lib/prisma';
import { generateDefaultCharacterAvatar } from "../character_avatar/action";


/**
 * @Action 创建角色
 * @param name 角色名字
 * @param userInput 用户输入的角色描述
 * @param userUuid 用户UUID
 * @param attributePoints 加点属性
 * @returns 创建好的角色对象
 */
export async function createCharacter(
  name: string, 
  userInput: string, 
  userUuid: string, 
  attributePoints?: { 魅力: number; 神识: number; 身手: number },
  spiritRoot?: string
): Promise<CharacterWithGamePush> {
  try {
    // 构建用户输入，包含灵根信息
    let USER_INPUT = "为" + userInput + "撰写角色档案和故事梗概，不论你让ta当主角配角，都要让ta活得精彩。"
    
    // 如果有灵根信息，添加到用户输入中
    if (spiritRoot) {
      USER_INPUT += `\n\n该角色拥有${spiritRoot}，请根据这个灵根特点来塑造角色。`
    }
    
    // 从配置服务获取角色创建配置
    const config = await ConfigService.getConfig('character_prompt');
    
    if (!config) {
      throw new Error("未找到角色创建配置");
    }

    // 检查模型配置是否存在
    if (!config.model) {
      throw new Error("角色创建配置中缺少模型配置");
    }

    // 构建变量对象
    const variables: Record<string, string> = {
      USER_INPUT: USER_INPUT
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

    // 根据配置创建模型实例
    const modelInstance = createModelFromConfig(config.model);
    
    // 获取provider选项
    const providerOptions = getProviderOptions(config.model, config);

    const { object } = await stableGenerateObject({
      model: modelInstance(config.model.name),
      providerOptions,
      schema: CharacterDescriptionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      userUuid,
      promptTemplate: "character_prompt"
    });

    // 使用事务创建角色和初始推进
    const character = await dbOperations.transaction(async () => {
      // 创建主角色
      const mainCharacter = await prisma.character.create({
        data: {
          userUuid,
          name,
          description: object,
          cover: "", // 临时设置为空，将在头像生成后更新
          createPrompt: userPrompt,
          // 加点属性
          charmPoints: attributePoints?.魅力 || 0,
          spiritPoints: attributePoints?.神识 || 0,
          skillPoints: attributePoints?.身手 || 0,
          // 灵根
          spiritRoot: spiritRoot || null,
          // 创建初始推进
          gamePush: {
            create: {
              info: {},
              status: getInitialStatus(object, attributePoints),
              isSummary: false,
              finishType: 1
            }
          }
        },
        include: {
          gamePush: true
        }
      });

      // 更新角色的当前推进ID
      await prisma.character.update({
        where: { id: mainCharacter.id },
        data: {
          sharedFromCharacterId: mainCharacter.id,
          currentPushId: mainCharacter.gamePush[0].id
        }
      });

      return {
        ...mainCharacter,
        description: mainCharacter.description as CharacterDescriptionType,
        sharedFromCharacterId: mainCharacter.id,
        currentPushId: mainCharacter.gamePush[0].id,
        currentPush: mainCharacter.gamePush[0] as BaseGamePush
      };
    });

    // 并行生成默认头像
    let avatarUrl = "";
    try {
      avatarUrl = await generateDefaultCharacterAvatar(character.id, character.description);

      // 如果头像生成成功，更新角色的cover字段
      if (avatarUrl) {
        await prisma.character.update({
          where: { id: character.id },
          data: { cover: avatarUrl }
        });

        // 更新返回的角色对象的cover字段
        character.cover = avatarUrl;
      }
    } catch (avatarError) {
      console.error("Failed to generate default avatar for character:", character.id, avatarError);
      // 头像生成失败不影响角色创建，继续返回角色数据
    }

    return character;
  } catch (error) {
    // 发送错误到飞书
    await handleActionError(
      error instanceof Error ? error : new Error(String(error)),
      'createCharacter',
      userUuid
    );
    throw error;
  }
}

/**
 * @Action 克隆角色
 * @param characterId 主角色ID
 * @param newPlayerUUID 新玩家UUID
 * @returns 克隆的角色对象
 */
export async function cloneSharedCharacter(characterId: number, newPlayerUUID: string): Promise<CharacterWithGamePush> {
  const sharedCharacter = await prisma.character.findUnique({
    where: {
      id: characterId,
      isDeleted: false
    }
  });

  if (!sharedCharacter) {
    throw new Error("无法使用：该角色没有可分享的副本");
  }

  // 判断用户是否已拥有同源副本
  const exists = await prisma.character.findFirst({
    where: {
      userUuid: newPlayerUUID,
      sharedFromCharacterId: characterId
    }
  });
  if (exists) {
    throw new Error("该角色已存在");
  }

  // 使用事务创建角色和初始推进
  const character = await dbOperations.transaction(async () => {
    // 解析角色描述
    const description = CharacterDescriptionSchema.parse(sharedCharacter.description);

    // 创建主角色
    const mainCharacter = await prisma.character.create({
      data: {
        userUuid: newPlayerUUID,
        name: sharedCharacter.name,
        createPrompt: sharedCharacter.createPrompt,
        cover: sharedCharacter.cover,
        description: sharedCharacter.description as InputJsonValue,
        // 继承原始角色的加点属性
        charmPoints: sharedCharacter.charmPoints,
        spiritPoints: sharedCharacter.spiritPoints,
        skillPoints: sharedCharacter.skillPoints,
        sharedFromCharacterId: characterId, // 指向原始主角色
        gamePush: {
          create: {
            info: {},
            status: getInitialStatus(description, {
              魅力: sharedCharacter.charmPoints,
              神识: sharedCharacter.spiritPoints,
              身手: sharedCharacter.skillPoints
            }),
            isSummary: false,
            finishType: 1
          }
        }
      },
      include: {
        gamePush: true
      }
    });

    // 更新角色的当前推进ID
    const updatedCharacter = await prisma.character.update({
      where: { id: mainCharacter.id },
      data: {
        currentPushId: mainCharacter.gamePush[0].id
      }
    });

    return {
      ...updatedCharacter,
      description: updatedCharacter.description as CharacterDescriptionType,
      currentPush: mainCharacter.gamePush[0] as BaseGamePush
    };
  });

  return character;
}

/**
 * @Action 根据角色当前状态 来突破角色
 * @param characterId 角色id
 * @returns 突破结果 和 最新状态
 */
export async function attemptBreakthrough(characterId: number, userUuid: string): Promise<BreakthroughResponse> {
  const gameCharacter = await GameCharacter.load(characterId);
  const status = gameCharacter.currentStatus;

  if (gameCharacter.isDead) {
    return {
      success: false,
      newStatus: formatStatusWithMax(status),
      message: "角色已死亡，无法突破"
    };
  }

  const currentLevelIndex = cultivationLevels.indexOf(status.等级);

  if (currentLevelIndex === cultivationLevels.length - 1) {
    return {
      success: false,
      newStatus: formatStatusWithMax(status),
      message: "已达到最高等级"
    };
  }

  // 尝试突破
  const isSuccessful = Math.random() <= status.突破成功系数;

  if (isSuccessful) {
    // 从配置服务获取突破成功配置
    const config = await ConfigService.getConfig('breakthrough_success');
    
    if (!config) {
      throw new Error("未找到突破成功配置");
    }

    // 检查模型配置是否存在
    if (!config.model) {
      throw new Error("突破成功配置中缺少模型配置");
    }

    // 构建变量对象
    const variables: Record<string, string> = {
      玩家状态: JSON.stringify(status),
      上回合档案: JSON.stringify(gameCharacter.description),
      上回合记忆: "玩家完成任务后成功突破，修为提升",
      姓名: gameCharacter.description.角色名称
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

    // 合并系统提示词和用户提示词
    let combinedPrompt = userPrompt;
    if (systemPrompt) {
      combinedPrompt = `## 用户指令\n${userPrompt}\n\n## 系统指令\n${systemPrompt}`;
    }

    // 打印提示词结构
    console.log("\n📝 【突破成功】提示词结构:");
    console.log(`- 系统提示词: ${systemPrompt ? '已渲染' : '无'}`);
    console.log(`- 总提示词长度: ${combinedPrompt.length} 字符`);
    console.log("----------------------------------------");

    // 根据配置创建模型实例
    const modelInstance = createModelFromConfig(config.model);
    
    // 获取provider选项
    const providerOptions = getProviderOptions(config.model, config);

    const result = await stableGenerateObject({
      model: modelInstance(config.model.name),
      providerOptions,
      schema: CharacterDescriptionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      userUuid: userUuid,
      promptTemplate: "breakthrough_success"
    });

    // 使用事务更新角色状态和描述
    return await dbOperations.transaction(async () => {
      // 更新角色状态
      const { newStatus } = changeAttr(status, {
        节点要素: {
          基础信息: {
            等级: status.等级,
            类型: "机缘",
            终极任务是否完成: true,
            当前任务: "突破"
          },
          剧情要素: {
            剧情: "角色突破成功",
            场景: ["修炼场所"],
            人物: [gameCharacter.name],
            状态变化: {
              体魄变化: ["增加", "极多"],
              道心变化: ["增加", "一点"],
              行动点变化:["增加", "全部"],
              突破成功率变化: ["增加", "一点"]
            },
            玩家选项: [{
              选项描述: "继续修炼",
              选项类别: "探索",
              选项难度: "按部就班"
            }]
          }
        }
      });

      // 更新角色描述和状态
      await prisma.character.update({
        where: { id: characterId },
        data: { description: result.object }
      });

      await prisma.gamePush.update({
        where: { id: gameCharacter.currentPush.id },
        data: { status: newStatus }
      });

      return {
        success: true,
        newStatus: formatStatusWithMax(newStatus),
        message: `突破成功！修为提升至 ${newStatus.等级}，道心+0.5`,
        newDescription: result.object
      };
    });
  } else {
    // 失败处理
    // 从配置服务获取突破失败配置
    const config = await ConfigService.getConfig('breakthrough_fail');
    
    if (!config) {
      throw new Error("未找到突破失败配置");
    }

    // 检查模型配置是否存在
    if (!config.model) {
      throw new Error("突破失败配置中缺少模型配置");
    }

    // 构建变量对象
    const variables: Record<string, string> = {
      PLAYER_STATUS: JSON.stringify(status),
      PREVIOUS_DESCRIPTION: JSON.stringify(gameCharacter.description),
      PREVIOUS_MEMORY: "玩家完成任务后尝试突破失败，仍决定总结经验继续修行",
      CHARACTER_NAME: gameCharacter.description.角色名称
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

    // 合并系统提示词和用户提示词
    let combinedPrompt = userPrompt;
    if (systemPrompt) {
      combinedPrompt = `## 用户指令\n${userPrompt}\n\n## 系统指令\n${systemPrompt}`;
    }

    // 打印提示词结构
    console.log("\n📝 【突破失败】提示词结构:");
    console.log(`- 系统提示词: ${systemPrompt ? '已渲染' : '无'}`);
    console.log(`- 总提示词长度: ${combinedPrompt.length} 字符`);
    console.log("----------------------------------------");

    // 根据配置创建模型实例
    const modelInstance = createModelFromConfig(config.model);
    
    // 获取provider选项
    const providerOptions = getProviderOptions(config.model, config);

    const result = await stableGenerateObject({
      model: modelInstance(config.model.name),
      providerOptions,
      schema: CharacterDescriptionSchema,
      system: systemPrompt,
      prompt: userPrompt,
      userUuid: userUuid,
      promptTemplate: "breakthrough_fail"
    });

    // 使用事务更新角色状态和描述
    return await dbOperations.transaction(async () => {
      // 更新角色状态
      const { newStatus } = changeAttr(status, {
        节点要素: {
          基础信息: {
            等级: status.等级,
            类型: "机缘",
            终极任务是否完成: false,
            当前任务: "突破"
          },
          剧情要素: {
            剧情: "角色突破失败",
            场景: ["修炼场所"],
            人物: [gameCharacter.name],
            状态变化: {
              体魄变化: ["增加", "一点"],
              道心变化: ["增加", "一点"],
              行动点变化:["增加", "全部"],
              突破成功率变化: ["增加", "中等"]
            },
            玩家选项: [{
              选项描述: "继续修炼",
              选项类别: "探索",
              选项难度: "按部就班"
            }]
          }
        }
      });

      // 更新角色描述和状态
      await prisma.character.update({
        where: { id: characterId },
        data: { description: result.object }
      });

      await prisma.gamePush.update({
        where: { id: gameCharacter.currentPush.id },
        data: { status: newStatus }
      });

      return {
        success: false,
        newStatus: formatStatusWithMax(newStatus),
        message: "突破失败，突破成功系数+0.05",
        newDescription: result.object
      };
    });
  }
}

/**
 * 将角色存到用户
 * @param userUuid 用户UUID
 * @param characterId 角色ID
 */
export async function saveCharacterToUser(userUuid: string, characterId: number) {
  await dbOperations.update(async () => {
    const character = await prisma.character.findUnique({ where: { id: characterId } });
    if (!character) throw new Error("角色不存在");
    await prisma.character.update({ where: { id: characterId }, data: { userUuid } });
  }, 'character');
}

/**
 * @Action 删除角色（软删除）
 * @param characterId 要删除的角色ID
 * @param userUuid 当前操作用户的UUID（用于权限验证）
 */
export async function deleteCharacter(characterId: number, userUuid: string): Promise<{ success: boolean }> {
  return await dbOperations.transaction(async () => {
    // 验证角色是否存在且属于该用户
    const character = await prisma.character.findUnique({
      where: { id: characterId }
    });

    if (!character) {
      throw new Error("角色不存在");
    }

    if (character.userUuid !== userUuid) {
      throw new Error("无权限删除此角色");
    }

    // 执行软删除
    await prisma.character.update({
      where: { id: characterId },
      data: { isDeleted: true }
    });

    return { success: true };
  });
}

export async function getCharacterById(id: number): Promise<CharacterWithGamePush> {
  const character = await prisma.character.findUnique({
    where: { id }
  })

  if (!character) {
    throw new Error("角色不存在");
  }

  // 检查角色是否有currentPushId，如果没有说明是复活后的角色
  if (!character.currentPushId) {
    return {
      ...character,
      description: character.description as CharacterDescriptionType,
      currentPush: null
    }
  }

  const currentPush = await prisma.gamePush.findUnique({
    where: { id: character.currentPushId }
  })

  if (!currentPush) {
    throw new Error("推进记录不存在");
  }

  return {
    ...character,
    description: character.description as CharacterDescriptionType,
    currentPush: {
      ...currentPush,
      info: currentPush.info || {},
      status: currentPush.status || {}
    } as BaseGamePush
  }
}

export async function rebirthCharacter(characterId: number): Promise<{ success: boolean; message: string; newStatus?: CharacterStatusType }> {
  try {
    const character = await prisma.character.findUnique({ where: { id: characterId }, include: { currentPush: true } });
    if (!character || !character.currentPush) {
      return { success: false, message: 'Character or current push not found' };
    }

    const statusSchema = CharacterStatusSchema.safeParse(character.currentPush.status);
    if (!statusSchema.success) {
      return { success: false, message: 'Invalid character status' };
    }
    const status: CharacterStatusType = statusSchema.data;

    const limits = getAttributeLimitsByLevel(status.等级);

    // Reset specific fields
    status.是否死亡 = false;
    status.道心 = limits.道心.max;
    status.体魄 = limits.体魄.max;
    status.行动点 = limits.行动点.max;  // 重置行动点

    console.log('复活角色，重置状态:', {
      characterId,
      level: status.等级,
      newActionPoints: status.行动点,
      newHealth: status.体魄,
      newSpirit: status.道心
    });

    // Update the current push with new status
    await prisma.gamePush.update({
      where: { id: character.currentPushId! },
      data: { status: status }
    });

    return {
      success: true,
      message: 'Character reborn successfully',
      newStatus: formatStatusWithMax(status)
    };
  } catch (error) {
    console.error('Error in rebirthCharacter:', error);
    return { success: false, message: 'Failed to rebirth character' };
  }
}

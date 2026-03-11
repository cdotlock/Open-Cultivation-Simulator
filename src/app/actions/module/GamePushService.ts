import { Character, GamePush } from "@/app/actions/generated/prisma";
import { CharacterStatusType, StoryPushType, difficultyLevels, CharacterStatusSchema, storyPushSchema } from "@/interfaces/schemas";
import { StatusDelta } from "@/interfaces/dto";
import { formatStatusForLLM, formatStatusWithMax } from "../character/constants";
import { changeAttr, calculateStatusDelta } from "./attributeSystem";
import { compressMemoryIfNeeded } from "./memorySystem";
import { handleActionError } from "@/lib/server-error-handler";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { stableGenerateObject } from "@/utils/stableGenerateObject";
import { prisma } from '@/lib/prisma';
import { GamePushResponse } from "@/interfaces/dto";
import { handleCharacterDeath } from "./death";
import { attemptBreakthrough } from "../character/action";
import { extendMemory } from "@/utils/extendMemory";
import MemoryRules from "@/config/MemoryRules";
import eventBus from "@/utils/eventBus";
import { PreloadService, OptionWithPreroll } from "./PreloadService";
import { OptionService } from "./OptionService";

export class GamePushService {
    private preloadService: PreloadService;
    private optionService: OptionService;

    constructor() {
        this.preloadService = new PreloadService();
        this.optionService = new OptionService();
    }

    async createGamePush(
        characterId: number,
        currentPushId: number,
        dynamicInput: string,
        baseStatus: CharacterStatusType,
        characterDescription: Record<string, unknown>,
        choice?: string,
        success?: boolean
    ) {
        const { 初始属性, ...restDescription } = characterDescription;

        const push = await prisma.gamePush.create({
            data: {
                characterId,
                info: {},
                isSummary: false,
                fatherId: currentPushId,
                choice: choice
            }
        });

        const config = await ConfigService.getConfig('story_prompt_v1');
        if (!config) {
            throw new Error("未找到故事生成配置");
        }

        if (!config.model) {
            throw new Error("故事生成配置中缺少模型配置");
        }

        let processedDynamicInput = dynamicInput;
        if (choice) {
            let choiceSection = `## 玩家选择\n${choice}`;
            if (success !== undefined) {
                choiceSection += `，执行${success ? '成功' : '失败'}`;
            }
            processedDynamicInput = `${choiceSection}\n\n${dynamicInput}`;
        }

        const variables: Record<string, string> = {
            CHARACTER_DESCRIPTION: JSON.stringify(restDescription),
            DYNAMIC_INPUT: processedDynamicInput
        };

        let systemPrompt = config.systemPrompt || '';
        let userPrompt = config.userPrompt;

        Object.keys(variables).forEach(key => {
            systemPrompt = systemPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
            userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
        });

        const turnCount = this.calculateTurnCount(baseStatus);
        const extendedMemory = extendMemory(turnCount, MemoryRules);
        if (extendedMemory.trim()) {
            userPrompt += `\n\n## 扩展记忆（第${turnCount}回合）\n${extendedMemory}`;
        }

        const modelInstance = createModelFromConfig(config.model);
        const providerOptions = getProviderOptions(config.model, config);

        const { object: gamePush } = await stableGenerateObject({
            system: systemPrompt,
            prompt: userPrompt,
            model: modelInstance(config.model.name),
            providerOptions,
            schema: storyPushSchema,
            promptTemplate: "story_prompt_v1",
        });

        if (gamePush?.节点要素?.基础信息?.等级) {
            const level = gamePush.节点要素.基础信息.等级;
            const cleanLevel = level.replace(/(初期|中期|后期|圆满|大圆满|巅峰|大圆满巅峰)$/, '') as "炼气" | "筑基" | "金丹" | "元婴" | "化神" | "炼虚" | "合体" | "渡劫" | "真仙";
            gamePush.节点要素.基础信息.等级 = cleanLevel;
        }

        if (gamePush.节点要素.剧情要素.玩家选项) {
            gamePush.节点要素.剧情要素.玩家选项.forEach(option => {
                delete option.成功率;
                delete option.骰子;
                delete option.是否成功;
            });
        }

        const { newStatus, delta } = changeAttr(baseStatus, gamePush, success);

        const updatedPush = await prisma.gamePush.update({
            where: { id: push.id },
            data: {
                info: gamePush,
                status: newStatus,
                finishType: 1
            }
        });

        eventBus.emit(`game:push`, { id: updatedPush.id, push: updatedPush, delta });

        return { push: updatedPush, delta };
    }

    private calculateTurnCount(status: CharacterStatusType): number {
        return 50 - status.行动点;
    }

    async startGame(character: Character, currentStatus: CharacterStatusType): Promise<{ push: GamePush; delta: StatusDelta }> {
        const dynamicInput = `当前角色状态: ${formatStatusForLLM(currentStatus)}`;
        const result = await this.createGamePush(
            character.id,
            character.currentPushId!,
            dynamicInput,
            currentStatus,
            character.description as Record<string, unknown> || {}
        );

        result.push = await this.preloadService.addPrerollToGamePush(
            result.push,
            currentStatus,
            '开始游戏-预roll'
        );

        return result;
    }
    async pushGame(
        character: Character,
        currentStatus: CharacterStatusType,
        choice: string,
        success: boolean
    ): Promise<{ push: GamePush; delta: StatusDelta }> {
        const gameContext = await compressMemoryIfNeeded(character.id);
        const dynamicInput = `
        当前角色状态: ${formatStatusForLLM(currentStatus)}
        ${gameContext}
        `;

        const result = await this.createGamePush(
            character.id,
            character.currentPushId!,
            dynamicInput,
            currentStatus,
            character.description as Record<string, unknown> || {},
            choice,
            success
        );

        result.push = await this.preloadService.addPrerollToGamePush(
            result.push,
            currentStatus,
            '推进游戏预设结果-预roll'
        );

        return result;
    }

    async preloadNextOptions(
        character: Character,
        currentPush: GamePush,
        currentStatus: CharacterStatusType
    ): Promise<GamePush[]> {
        try {
            console.log(`[正在进行预加载] ${currentPush.id}`);
            
            // 直接使用currentPush的选项数据，因为之前已经通过addPrerollToGamePush处理过了
            const currentInfo = currentPush.info as StoryPushType;
            const prerolledOptions = currentInfo.节点要素.剧情要素.玩家选项 as OptionWithPreroll[];

            const gamePushes = await Promise.all(
                prerolledOptions.map(async (option) => {
                    const result = await this.pushGame(
                        character,
                        currentStatus,
                        option.选项描述,
                        option.是否成功!
                    );
                    return result.push;
                })
            );

            return gamePushes;
        } catch (error) {
            await handleActionError(
                error instanceof Error ? error : new Error(String(error)),
                'preloadNextOptions',
                `characterId:${character.id}`
            );
            throw error;
        }
    }

    async saveStorySegment(gamePush: GamePush, characterId: number) {
        try {
            const gamePushInfo = gamePush.info as StoryPushType;
            const storySummary = gamePushInfo?.节点要素?.剧情要素?.剧情;
            
            if (!storySummary) {
                console.log(`[saveStorySegment] 没有找到剧情，跳过保存 gamePushId: ${gamePush.id}`);
                return;
            }

            const existingStory = await prisma.storySegment.findFirst({ 
                where: { gamePushId: gamePush.id } 
            });
            
            if (existingStory) {
                await prisma.storySegment.update({ 
                    where: { id: existingStory.id }, 
                    data: { content: storySummary } 
                });
                console.log(`[saveStorySegment] 更新segment记录 id: ${existingStory.id}`);
            } else {
                await prisma.storySegment.create({ 
                    data: { 
                        characterId, 
                        gamePushId: gamePush.id, 
                        content: storySummary 
                    } 
                });
                console.log(`[saveStorySegment] 创建新segment记录 gamePushId: ${gamePush.id}`);
            }
        } catch (error) {
            console.error(`[saveStorySegment] 保存失败:`, error);
        }
    }

    async performBreakthrough(
        character: Character,
        currentPush: GamePush,
        currentStatus: CharacterStatusType
    ): Promise<void> {
        if (!character.userUuid) {
            throw new Error("用户UUID为空");
        }
        
        try {
            const breakthroughResult = await attemptBreakthrough(character.id, character.userUuid);
            
            if (breakthroughResult.newStatus) {
                const statusWithBreakthrough = {
                    ...breakthroughResult.newStatus,
                    _breakthrough: true,
                    _breakthroughSuccess: breakthroughResult.success,
                    _breakthroughMessage: breakthroughResult.message
                };
                
                await prisma.gamePush.update({
                    where: { id: currentPush.id },
                    data: { status: statusWithBreakthrough }
                });
            }
        } catch (error) {
            console.error("突破失败:", error);
            const statusWithBreakthrough = {
                ...currentStatus,
                _breakthrough: true,
                _breakthroughSuccess: false,
                _breakthroughMessage: "突破失败，请稍后重试"
            };
            
            await prisma.gamePush.update({
                where: { id: currentPush.id },
                data: { status: statusWithBreakthrough }
            });
        }
    }
}

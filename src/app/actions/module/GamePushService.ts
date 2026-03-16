import { Character, GamePush } from "@/app/actions/generated/prisma";
import { CharacterStatusType, StoryPushType, difficultyLevels, CharacterStatusSchema, storyPushSchema, GameOptionType } from "@/interfaces/schemas";
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
import {
  getFactionNarrativeContext,
  maybeAdvanceFactionWorldTurn,
  recordFactionActionOutcome,
} from "./factionSystem";

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
        success?: boolean,
        factionContext?: Record<string, string>
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

        const config = await ConfigService.getConfig('story_prompt');
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
            DYNAMIC_INPUT: processedDynamicInput,
            WORLD_STATE_SUMMARY: factionContext?.WORLD_STATE_SUMMARY || "天下局势暂时平稳。",
            CURRENT_REGION: factionContext?.CURRENT_REGION || "行踪未定。",
            PLAYER_FACTION_STATUS: factionContext?.PLAYER_FACTION_STATUS || "暂无帮派身份。",
            FACTION_RELATIONS: factionContext?.FACTION_RELATIONS || "暂无显著势力关系。",
            RECENT_WORLD_EVENTS: factionContext?.RECENT_WORLD_EVENTS || "最近天下无足以左右剧情的大事。",
            ACTIVE_FACTION_MISSIONS: factionContext?.ACTIVE_FACTION_MISSIONS || "暂无帮派任务。",
        };

        let systemPrompt = config.systemPrompt || '';
        let userPrompt = config.userPrompt;

        Object.keys(variables).forEach(key => {
            systemPrompt = systemPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
            userPrompt = userPrompt.replace(new RegExp(`\\{${key}\\}`, 'g'), variables[key]);
        });

        if (factionContext) {
            const factionPromptSection = [
                "## 帮派世界上下文",
                `世界摘要：${variables.WORLD_STATE_SUMMARY}`,
                `当前区域：${variables.CURRENT_REGION}`,
                `玩家帮派状态：${variables.PLAYER_FACTION_STATUS}`,
                `帮派关系：${variables.FACTION_RELATIONS}`,
                `最近世界事件：${variables.RECENT_WORLD_EVENTS}`,
                `当前帮派任务：${variables.ACTIVE_FACTION_MISSIONS}`,
            ].join("\n");

            if (!userPrompt.includes("帮派世界上下文")) {
                userPrompt += `\n\n${factionPromptSection}`;
            }

            const revealRule = [
                "## 帮派呈现规则",
                "不要把帮派关系分数、完整计划、隐藏数值、系统机制直接讲给玩家听。",
                "只通过门中口风、任务措辞、人物态度、边境变化、流言、书信、见闻来侧写局势。",
                "允许信息不完整、互相矛盾、带偏差，让玩家自己判断和博弈。",
            ].join("\n");

            if (!userPrompt.includes("帮派呈现规则")) {
                userPrompt += `\n\n${revealRule}`;
            }
        }

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
            promptTemplate: "story_prompt",
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
        const factionContext = await getFactionNarrativeContext(character.id);
        const result = await this.createGamePush(
            character.id,
            character.currentPushId!,
            dynamicInput,
            currentStatus,
            character.description as Record<string, unknown> || {},
            undefined,
            undefined,
            factionContext
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
        success: boolean,
        selectedOption?: Pick<GameOptionType, "选项类别" | "选项难度">
    ): Promise<{ push: GamePush; delta: StatusDelta }> {
        const nextPlayerTurn = this.calculateTurnCount(currentStatus) + 1;
        await maybeAdvanceFactionWorldTurn(character.id, nextPlayerTurn);

        const gameContext = await compressMemoryIfNeeded(character.id);
        const factionContext = await getFactionNarrativeContext(character.id);
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
            success,
            factionContext
        );

        result.push = await this.preloadService.addPrerollToGamePush(
            result.push,
            currentStatus,
            '推进游戏预设结果-预roll'
        );

        if (selectedOption) {
            await recordFactionActionOutcome(
                character.id,
                selectedOption,
                success,
                result.push.info as StoryPushType,
            );
        }

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

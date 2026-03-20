import { GamePush } from "@/app/actions/generated/prisma";
import { CharacterStatusType, StoryPushType, difficultyLevels } from "@/interfaces/schemas";
import { formatStatusWithMax } from "../character/constants";
import { performCheck } from "./checkSystem";
import { prisma } from '@/lib/prisma';
import eventBus from "@/utils/eventBus";
import { OptionWithPreroll } from "./PreloadService";

export interface OptionProcessResult {
    gamePush: GamePush;
    selectedOption: OptionWithPreroll;
    isPresetOption: boolean;
}

export class OptionService {
    
    async findPresetOption(
        choice: string, 
        currentPush: GamePush
    ): Promise<OptionWithPreroll | null> {
        const currentGamePush = currentPush.info as StoryPushType;
        const playerOptions = currentGamePush.节点要素.剧情要素.玩家选项;
        const selectedOption = playerOptions.find(option => option.选项描述 === choice);
        
        return selectedOption || null;
    }

    async processPresetOption(
        choice: string,
        presetOption: OptionWithPreroll,
        characterId: number,
        currentPushId: number
    ): Promise<GamePush> {
        return this.getOrCreateGamePush(choice, characterId, currentPushId, presetOption);
    }

    async processCustomOption(
        choice: string,
        characterId: number,
        currentPushId: number,
        currentStatus: CharacterStatusType
    ): Promise<{ gamePush: GamePush; selectedOption: OptionWithPreroll }> {
        const defaultActionType: "交流" | "探索" | "战斗" = "探索";
        const defaultDifficulty: typeof difficultyLevels[number] = "按部就班";
        
        const formattedStatus = formatStatusWithMax(currentStatus);
        const checkResult = performCheck(defaultActionType, defaultDifficulty, formattedStatus);
        
        const selectedOption: OptionWithPreroll = {
            选项描述: choice,
            选项类别: defaultActionType,
            选项难度: defaultDifficulty,
            成功率: checkResult.successRate,
            是否成功: checkResult.success,
            骰子: checkResult.diceValues,
            基础DC: checkResult.baseDC,
            修正值: checkResult.modifier,
            变动原因: checkResult.changeReasons
        };
        
        const gamePush = await this.getOrCreateGamePush(choice, characterId, currentPushId, selectedOption);
        
        return { gamePush, selectedOption };
    }

    private async getOrCreateGamePush(
        choice: string,
        characterId: number,
        currentPushId: number,
        presetOption?: OptionWithPreroll
    ): Promise<GamePush> {
        const existingPush = await this.findExistingGamePush(choice, characterId, currentPushId);
        
        if (existingPush) {
            return this.handleExistingGamePush(existingPush, choice, presetOption);
        }
        
        throw new Error(`Game push not found for choice: ${choice}. Need to create via GamePushService.`);
    }

    private async findExistingGamePush(
        choice: string,
        characterId: number,
        currentPushId: number
    ): Promise<GamePush | null> {
        const completedPush = await prisma.gamePush.findFirst({
            where: {
                characterId,
                isSummary: false,
                choice,
                fatherId: currentPushId,
                finishType: 1,
            },
            orderBy: { id: 'asc' },
        });

        if (completedPush) {
            return completedPush;
        }

        return prisma.gamePush.findFirst({
            where: {
                characterId,
                isSummary: false,
                choice,
                fatherId: currentPushId,
                finishType: 0,
            },
            orderBy: { id: 'asc' },
        });
    }

    private async handleExistingGamePush(
        gamePush: GamePush,
        choice: string,
        presetOption?: OptionWithPreroll
    ): Promise<GamePush> {
        if (gamePush.finishType === 0) {
            return this.waitForGamePushCompletion(gamePush, choice, presetOption);
        }
        
        if (gamePush.finishType === 1) {
            return gamePush;
        }
        
        throw new Error(`Unexpected finishType: ${gamePush.finishType}`);
    }

    private async waitForGamePushCompletion(
        gamePush: GamePush,
        choice: string,
        presetOption?: OptionWithPreroll
    ): Promise<GamePush> {
        return this.smartPreloadRace(gamePush.id, choice, presetOption);
    }

    private async smartPreloadRace(
        gamePushId: number,
        choice: string,
        presetOption?: OptionWithPreroll
    ): Promise<GamePush> {
        return new Promise<GamePush>((resolveMain, rejectMain) => {
            let resolved = false;
            let unsubscribe: (() => void) | null = null;
            
            const timeoutId: NodeJS.Timeout = setTimeout(() => {
                reject(new Error('Preload timeout after 30s'));
            }, 30000);
            
            const cleanup = () => {
                clearTimeout(timeoutId);
                if (unsubscribe) unsubscribe();
            };
            
            const resolve = (result: GamePush) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                resolveMain(result);
            };
            
            const reject = (error: Error) => {
                if (resolved) return;
                resolved = true;
                cleanup();
                rejectMain(error);
            };
            
            unsubscribe = eventBus.on(`game:push`, (event) => {
                const { id, push } = event;
                if (id === gamePushId) {
                    console.log(`[OptionService] 预加载完成，使用预加载结果: ${choice}`);
                    resolve(push);
                }
            });
            
            setTimeout(async () => {
                try {
                    console.log(`[OptionService] 启动实时生成备选方案: ${choice}`);
                    const result = await this.createFallbackGamePush(choice, gamePushId, presetOption);
                    resolve(result);
                } catch (error) {
                    reject(error instanceof Error ? error : new Error(String(error)));
                }
            }, 100);
        });
    }

    private async createFallbackGamePush(
        choice: string,
        gamePushId: number,
        presetOption?: OptionWithPreroll
    ): Promise<GamePush> {
        console.log(`[OptionService] 预加载超时，启动实时生成: ${choice}`);
        // 动态导入以避免循环依赖
        const { GamePushService } = await import("./GamePushService");
        const gps = new GamePushService();
        // 获取当前 push 记录以及角色、父 push 状态
        const currentPush = await prisma.gamePush.findUnique({ where: { id: gamePushId } });
        if (!currentPush) {
            throw new Error(`无法找到 gamePush 记录 id: ${gamePushId}`);
        }
        const character = await prisma.character.findUnique({ where: { id: currentPush.characterId } });
        if (!character) {
            throw new Error(`无法找到角色 id: ${currentPush.characterId}`);
        }
        const fatherPush = currentPush.fatherId ? await prisma.gamePush.findUnique({ where: { id: currentPush.fatherId } }) : null;
        const currentStatus = fatherPush?.status as CharacterStatusType;
        if (!currentStatus) {
            throw new Error("无法确定当前角色状态，无法生成备用 GamePush");
        }
        const success = presetOption?.是否成功 ?? true;
        const { push } = await gps.pushGame(character, currentStatus, choice, success, presetOption ? {
            选项类别: presetOption.选项类别,
            选项难度: presetOption.选项难度,
        } : undefined);
        return push;
    }

    async markGamePushAsChoice(gamePushId: number): Promise<GamePush> {
        return prisma.gamePush.update({
            where: { id: gamePushId },
            data: { 
                finishType: 1,
                isChoice: true
            }
        });
    }

     createDefaultCheckResult() {
        return {
            success: true,
            rollResult: 12,
            baseDC: 8,
            finalDC: 8,
            modifier: 0,
            successRate: 100,
            diceValues: [6, 6] as [number, number],
            changeReasons: []
        };
    }
}

import { GamePush } from "@/app/actions/generated/prisma";
import { CharacterStatusType, StoryPushType, difficultyLevels } from "@/interfaces/schemas";
import { FormattedCharacterStatus } from "@/interfaces/dto";
import { formatStatusWithMax } from "../character/constants";
import { performCheck } from "./checkSystem";
import { prisma } from '@/lib/prisma';

export interface OptionWithPreroll {
    选项描述: string;
    选项类别: "交流" | "探索" | "战斗";
    选项难度: typeof difficultyLevels[number];
    成功率?: number;
    是否成功?: boolean;
    骰子?: number[];
    基础DC?: number;
    修正值?: number;
    变动原因?: string[];
}

export class PreloadService {
    
    async addPrerollToGamePush(
        gamePush: GamePush, 
        currentStatus: CharacterStatusType,
        logPrefix: string = "预roll处理"
    ): Promise<GamePush> {
        console.log(`[${logPrefix}] 开始处理，gamePush.id: ${gamePush.id}`);
        
        try {
            const gamePushInfo = gamePush.info as StoryPushType;
            const playerOptions = gamePushInfo?.节点要素?.剧情要素?.玩家选项;
            
            if (!playerOptions) {
                console.log(`[${logPrefix}] 没有找到玩家选项！`);
                return gamePush;
            }

            console.log(`[${logPrefix}] 找到 ${playerOptions.length} 个选项`);
            
            const formattedStatus = formatStatusWithMax(currentStatus);
            const optionsWithPreroll = this.calculatePrerollForOptions(
                playerOptions, 
                formattedStatus, 
                logPrefix
            );

            const updatedInfo = this.updateGamePushInfo(gamePushInfo, optionsWithPreroll);
            
            await this.saveUpdatedGamePush(gamePush.id, updatedInfo);
            
            gamePush.info = updatedInfo;
            console.log(`[${logPrefix}] 处理完成，选项数量: ${optionsWithPreroll.length}`);
            
        } catch (error) {
            console.error(`${logPrefix} 预roll骰子失败:`, error);
        }
        
        return gamePush;
    }

    private calculatePrerollForOptions(
        options: OptionWithPreroll[], 
        formattedStatus: FormattedCharacterStatus, 
        logPrefix: string
    ): OptionWithPreroll[] {
        return options.map((option: OptionWithPreroll) => {
            const checkResult = performCheck(
                option.选项类别, 
                option.选项难度, 
                formattedStatus
            );
            
            console.log(`[${logPrefix}] ${option.选项描述} 成功率: ${checkResult.successRate}% 是否成功: ${checkResult.success} 骰子: ${checkResult.diceValues}`);
            
            return {
                ...option,
                成功率: checkResult.successRate,
                是否成功: checkResult.success,
                骰子: checkResult.diceValues,
                基础DC: checkResult.baseDC,
                修正值: checkResult.modifier,
                变动原因: checkResult.changeReasons
            };
        });
    }

    private updateGamePushInfo(gamePushInfo: StoryPushType, optionsWithPreroll: OptionWithPreroll[]): StoryPushType {
        return {
            ...gamePushInfo,
            节点要素: {
                ...gamePushInfo.节点要素,
                剧情要素: {
                    ...gamePushInfo.节点要素.剧情要素,
                    玩家选项: optionsWithPreroll
                }
            }
        };
    }

    private async saveUpdatedGamePush(gamePushId: number, updatedInfo: StoryPushType): Promise<void> {
        await prisma.gamePush.update({
            where: { id: gamePushId },
            data: { info: updatedInfo }
        });
    }

    async handleExistingPrerollOptions(
        options: OptionWithPreroll[], 
        formattedStatus: FormattedCharacterStatus
    ): Promise<OptionWithPreroll[]> {
        return options.map(option => {
            if (option.骰子 && option.是否成功 !== undefined) {
                console.log(`[预加载-复用] ${option.选项描述} 成功率: ${option.成功率} 是否成功: ${option.是否成功} 骰子: ${option.骰子}`);
                return option;
            }
            
            const checkResult = performCheck(option.选项类别, option.选项难度, formattedStatus);
            console.log(`[预加载-新roll] ${option.选项描述} 成功率: ${checkResult.successRate} 是否成功: ${checkResult.success} 骰子: ${checkResult.diceValues}`);
            
            return {
                ...option,
                成功率: checkResult.successRate,
                是否成功: checkResult.success,
                骰子: checkResult.diceValues,
                基础DC: checkResult.baseDC,
                修正值: checkResult.modifier,
                变动原因: checkResult.changeReasons
            };
        });
    }

    async updateCurrentPushWithPreroll(
        currentPush: GamePush, 
        currentStatus: CharacterStatusType
    ): Promise<{ updatedPush: GamePush; prerolledOptions: OptionWithPreroll[] }> {
        const currentInfo = currentPush.info as StoryPushType;
        const playerOptions = currentInfo.节点要素.剧情要素.玩家选项;
        
        const formattedStatus = formatStatusWithMax(currentStatus);
        const prerolledOptions = await this.handleExistingPrerollOptions(playerOptions, formattedStatus);
        
        const updatedInfo = this.updateGamePushInfo(currentInfo, prerolledOptions);
        await this.saveUpdatedGamePush(currentPush.id, updatedInfo);
        
        const updatedPush = { ...currentPush, info: updatedInfo };
        
        return { updatedPush, prerolledOptions };
    }
}
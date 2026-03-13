/* eslint-disable @typescript-eslint/no-explicit-any */
import { Character, GamePush } from "@/app/actions/generated/prisma";
import { CharacterStatusType, CharacterStatusSchema, StoryPushType, CharacterDescriptionSchema, storyPushSchema } from "@/interfaces/schemas";
import { getCharacterById, getGamePushById } from "./query";
import { formatStatusWithMax } from "../character/constants";
import { performCheck } from "./checkSystem";
import { calculateStatusDelta } from "./attributeSystem";
import { handleActionError } from "@/lib/server-error-handler";
import { prisma } from '@/lib/prisma';
import { GamePushResponse, PreAnalyzedOptionPayload } from "@/interfaces/dto";
import { handleCharacterDeath } from "./death";
import { GamePushService } from "./GamePushService";
import { OptionService } from "./OptionService";
import { OptionWithPreroll } from "./PreloadService";
import { getFactionUiData } from "./factionSystem";

export class GameCharacterRefactored {
    character: Character;
    currentPush!: GamePush;
    cloneStatus!: CharacterStatusType;
    private _currentStatus!: CharacterStatusType;

    private gamePushService: GamePushService;
    private optionService: OptionService;

    get currentStatus(): CharacterStatusType {
        return this._currentStatus;
    }

    get currentInfo(): StoryPushType {
        const infoSchema = storyPushSchema.safeParse(this.currentPush.info);
        if (!infoSchema.success) {
            throw new Error("角色信息解析失败");
        }
        return infoSchema.data;
    }

    get isStarted(): boolean {
        return Object.keys(this.currentStatus ?? {}).length > 0;
    }

    get isDead(): boolean {
        return this.currentStatus.是否死亡;
    }

    get id() {
        return this.character.id;
    }

    get name() {
        return this.character.name;
    }

    get userUuid() {
        return this.character.userUuid;
    }

    get description() {
        const description = CharacterDescriptionSchema.safeParse(this.character.description).data;
        if (!description) {
            throw new Error("角色描述解析失败");
        }
        return description;
    }

    public getStatus(): CharacterStatusType {
        return this.currentStatus;
    }

    public getCurrentPushId(): number {
        return this.currentPush.id;
    }

    private constructor(character: Character, currentPush: GamePush) {
        this.character = character;
        this.gamePushService = new GamePushService();
        this.optionService = new OptionService();

        this.setCurrentPush(currentPush, { refreshCloneBaseline: true });
    }

    static load(characterId: number): Promise<GameCharacterRefactored>;
    static load(character: Character): Promise<GameCharacterRefactored>;
    static load(character: Character, currentPush?: GamePush): Promise<GameCharacterRefactored>;
    static async load(param: number | Character, currentPush?: GamePush): Promise<GameCharacterRefactored> {
        const character = typeof param === 'number'
            ? await getCharacterById(param)
            : param;

        if (!currentPush) {
            currentPush = await GameCharacterRefactored.loadCurrentPush(character.currentPushId);
        }

        const instance = new GameCharacterRefactored(character, currentPush);
        return instance;
    }

    static async loadCurrentPush(pushId?: number | null): Promise<GamePush> {
        if (!pushId) {
            throw new Error("找不到角色当前进度");
        }
        return await getGamePushById(pushId);
    }

    public async startGame(): Promise<GamePushResponse> {
        try {
            const { push, delta } = await this.gamePushService.startGame(this.character, this.currentStatus);

            const parsedStatus = this.parseStatus(push.status);
            const updatedPush = { ...push, status: parsedStatus } as GamePush;
            this.setCurrentPush(updatedPush, { refreshCloneBaseline: true });

            let deathJudgement: string | undefined;
            if (parsedStatus.是否死亡) {
                deathJudgement = await handleCharacterDeath(
                    this.character,
                    parsedStatus,
                    updatedPush.info as StoryPushType
                );
            }

            this.character = await prisma.character.update({
                where: { id: this.id },
                data: { currentPushId: updatedPush.id },
            });

            // 异步预加载下一轮选项
            this.asyncPreloadNext(this.character, this.currentPush, this.currentStatus);

            const startGameCheckResult = this.optionService.createDefaultCheckResult();
            const factionData = await getFactionUiData(this.id);

            return {
                id: this.currentPush.id,
                gamePush: this.currentInfo,
                newStatus: formatStatusWithMax(parsedStatus),
                statusDelta: delta,
                deathJudgement,
                checkResult: startGameCheckResult,
                factionData
            };
        } catch (error) {
            await handleActionError(
                error instanceof Error ? error : new Error(String(error)),
                'startGameV2',
                `characterId:${this.id}`
            );
            throw error;
        }
    }

    public async pushGame(choice: string, preAnalyzedOption?: PreAnalyzedOptionPayload): Promise<GamePushResponse> {
        try {
            const presetOption = await this.optionService.findPresetOption(choice, this.currentPush);
            
            let gamePush: GamePush;
            let selectedOption: OptionWithPreroll;

            if (presetOption) {
                console.log(`[selectChoiceV2] 发现预设选项，启动智能竞争模式: ${choice}`);
                const processResult = await this.optionService.processPresetOption(
                    choice,
                    presetOption,
                    this.id,
                    this.currentPush.id
                );
                gamePush = processResult;
                selectedOption = presetOption;
            } else {
                console.log(`[selectChoiceV2] 自定义选项: ${choice}`);
                const actionType = preAnalyzedOption?.选项类别 ?? "探索";
                const difficulty = preAnalyzedOption?.选项难度 ?? "按部就班";

                const canReusePreAnalysis = Boolean(
                    preAnalyzedOption &&
                    Array.isArray(preAnalyzedOption.骰子) &&
                    preAnalyzedOption.骰子.length === 2 &&
                    typeof preAnalyzedOption.是否成功 === 'boolean' &&
                    typeof preAnalyzedOption.基础DC === 'number'
                );

                if (canReusePreAnalysis) {
                    const diceValues = preAnalyzedOption!.骰子 as [number, number];
                    selectedOption = {
                        选项描述: choice,
                        选项类别: actionType,
                        选项难度: difficulty,
                        成功率: preAnalyzedOption!.成功率,
                        是否成功: preAnalyzedOption!.是否成功,
                        骰子: diceValues,
                        基础DC: preAnalyzedOption!.基础DC,
                        修正值: preAnalyzedOption!.修正值,
                        变动原因: preAnalyzedOption!.变动原因
                    };

                    const result = await this.gamePushService.pushGame(
                        this.character,
                        this.currentStatus,
                        choice,
                        preAnalyzedOption!.是否成功 as boolean,
                        {
                            选项类别: actionType,
                            选项难度: difficulty,
                        }
                    );
                    gamePush = result.push;
                } else {
                    const formattedStatus = formatStatusWithMax(this.currentStatus);
                    const checkResult = performCheck(actionType, difficulty, formattedStatus);

                    selectedOption = {
                        选项描述: choice,
                        选项类别: actionType,
                        选项难度: difficulty,
                        成功率: checkResult.successRate,
                        是否成功: checkResult.success,
                        骰子: checkResult.diceValues,
                        基础DC: checkResult.baseDC,
                        修正值: checkResult.modifier,
                        变动原因: checkResult.changeReasons
                    };

                    const result = await this.gamePushService.pushGame(
                        this.character,
                        this.currentStatus,
                        choice,
                        checkResult.success,
                        {
                            选项类别: actionType,
                            选项难度: difficulty,
                        }
                    );
                    gamePush = result.push;
                }
            }

            gamePush = await this.optionService.markGamePushAsChoice(gamePush.id);
            await this.gamePushService.saveStorySegment(gamePush, this.id);


            return this.formatGamePushResponse(gamePush, selectedOption);
        } catch (error) {
            await handleActionError(
                error instanceof Error ? error : new Error(String(error)),
                'selectChoiceV2',
                `characterId:${this.id}`
            );
            throw error;
        }
    }

    private asyncPreloadNext(character: Character, push: GamePush, status: CharacterStatusType) {
        this.gamePushService.preloadNextOptions(character, push, status)
            .catch(error => {
                console.error('预加载失败:', error);
            });
    }


    private async formatGamePushResponse(
        gamePush: GamePush, 
        selectedOption: OptionWithPreroll
    ): Promise<GamePushResponse> {
        this.character = await prisma.character.update({
            where: { id: this.id },
            data: { currentPushId: gamePush.id }
        });

        this.setCurrentPush(gamePush);

        let deathJudgement: string | undefined;

        const shouldBreakthrough = this.cloneStatus.行动点 === 1 && this.currentStatus.行动点 === 0;

        if (this.isDead && !shouldBreakthrough) {
            deathJudgement = await handleCharacterDeath(
                this.character,
                this.currentStatus,
                gamePush.info as StoryPushType
            );
        }
        
        const currentStatusSnapshot = this.currentStatus;
        const statusDelta = calculateStatusDelta(this.cloneStatus, currentStatusSnapshot);
        const factionData = await getFactionUiData(this.id);

        let response: GamePushResponse;

        if (shouldBreakthrough) {
            await this.gamePushService.performBreakthrough(this.character, this.currentPush, this.currentStatus);
            response = {
                id: gamePush.id,
                gamePush: gamePush.info as StoryPushType,
                newStatus: formatStatusWithMax(currentStatusSnapshot),
                statusDelta,
                deathJudgement: deathJudgement,
                checkResult: {
                    success: selectedOption.是否成功 ?? false,
                    diceValues: selectedOption.骰子 ?? [1, 1]
                },
                factionData
            };
        } else {
            response = {
                id: gamePush.id,
                gamePush: gamePush.info as StoryPushType,
                newStatus: formatStatusWithMax(currentStatusSnapshot),
                statusDelta,
                deathJudgement: deathJudgement,
                checkResult: {
                    success: selectedOption.是否成功 ?? false,
                    diceValues: selectedOption.骰子 ?? [1, 1]
                },
                factionData
            };
        }

        this.cloneStatus = this.cloneStatusSnapshot(currentStatusSnapshot);
        this.asyncPreloadNext(this.character, this.currentPush, currentStatusSnapshot);

        return response;
    }

    private parseStatus(status: unknown): CharacterStatusType {
        const statusResult = CharacterStatusSchema.safeParse(status);
        if (!statusResult.success) {
            throw new Error("角色状态解析失败");
        }
        return statusResult.data;
    }

    private setCurrentPush(push: GamePush, options: { refreshCloneBaseline?: boolean } = {}) {
        const parsedStatus = this.parseStatus(push.status);
        const pushWithStatus = { ...push, status: parsedStatus } as GamePush;
        this.currentPush = pushWithStatus;
        this._currentStatus = parsedStatus;

        if (options.refreshCloneBaseline) {
            this.cloneStatus = this.cloneStatusSnapshot(parsedStatus);
        }
    }

    private cloneStatusSnapshot(status: CharacterStatusType): CharacterStatusType {
        if (typeof structuredClone === 'function') {
            return structuredClone(status);
        }
        return JSON.parse(JSON.stringify(status)) as CharacterStatusType;
    }
}

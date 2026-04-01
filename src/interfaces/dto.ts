import { CharacterDescriptionType, CharacterStatusType, StoryPushType, difficultyLevels, GameOptionType } from './schemas';
import { FactionUiPayload } from './faction';
import { BondUiPayload } from './bond';
import { formatStatusWithMax } from '@/app/actions/character/constants';

export type BaseResponse<T> = {
    isSuccess: boolean;
    message: string;
    data?: T;
}

// 状态变化类型
export interface StatusDelta {
    体魄: number;
    道心: number;
    突破成功系数: number;
    行动点: number;
    魅力: number;
    神识: number;
    身手: number;
}

// 格式化后的角色状态（包含最大值）
export interface FormattedCharacterStatus extends CharacterStatusType {
    最大体魄: number;
    最大道心: number;
}


// 游戏推进响应类型（用于 API 返回）
export type GamePushResponse = {
    id: number;
    gamePush: StoryPushType;
    newStatus: ReturnType<typeof formatStatusWithMax> & {
        _breakthrough?: boolean;
        _breakthroughSuccess?: boolean;
        _breakthroughMessage?: string;
    };
    statusDelta: StatusDelta;
    deathJudgement?: string;
    // 检定结果 每一次都一定判断是否成功了
    checkResult: {
        success: boolean;
        diceValues: number[];
    };
    // 自定义选项分析结果（可选，只有当使用自定义输入时才会返回）
    analyzedOption?: {
        选项描述: string;
        选项类别: "交流" | "探索" | "战斗";
        选项难度: typeof difficultyLevels[number];
    };
    // 图像生成结果（可选，当推进5局后生成图像时返回）
    imageGeneration?: {
        shouldGenerate: boolean;
        imageUrl?: string;
        error?: string;
    };
    // 是否从历史恢复（继续修行），用于 UI 显示上节回顾标识
    isResume?: boolean;
    factionData?: FactionUiPayload;
    bondData?: BondUiPayload;
};

export type PreAnalyzedOptionPayload = Pick<GameOptionType, '选项类别' | '选项难度'> & Partial<Pick<GameOptionType, '是否成功' | '骰子' | '成功率' | '基础DC' | '修正值' | '变动原因'>>;

// 突破响应类型
export type BreakthroughResponse = {
    success: boolean;
    newStatus: ReturnType<typeof formatStatusWithMax>;
    message: string;
    newDescription?: CharacterDescriptionType;
};

// API 错误类型
export interface ApiError extends Error {
    statusCode?: number;
    code?: string;
}

// 飞书 Webhook 载荷类型
export interface FeiShuWebhookPayload {
    title: string;
    content: string;
}

// 管理员相关类型
export interface PromptDict {
    key: string;
    value: string;
}

// 玩家选择类型（包含检定结果）
export interface PlayerChoice {
    选项描述: string;
    检定结果?: {
        成功: boolean;
        原因?: string; // 成功/失败的原因描述
    };
}

// 事件总线类型
export type EventMap = {
    [K: string]: unknown;
};

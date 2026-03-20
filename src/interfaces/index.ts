import { Character, GamePush } from "@/app/actions/generated/prisma";
import { Prisma } from "@/app/actions/generated/prisma";
import { GameStatus } from './const';

// 重新导出所有 Schema 和类型
export * from './const';
export * from './schemas';
export * from './dto';
export * from './faction';
export * from './bond';

export type CharacterDescriptionType = {
  所属帮派?: string;
  帮派身份?: string;
  帮派地位?: string;
  帮派当前目标?: string;
  帮派对主角的期待?: string;
  人物关系: string[];
  人物背景: string;
  初始属性: {
    灵根: '金' | '木' | '水' | '火' | '土';
    等级: string;
  };
  外貌特征: string;
  故事大纲: string;
  核心任务: string;
  灵根属性: string;
  角色名称: string;
  人物使命与当前阶段: string;
}

// 基础 Prisma 类型
export type BaseCharacter = Omit<Character, 'description' | 'gamePush' | 'currentPush'> & {
  description: CharacterDescriptionType;
};

export type BaseGamePush = Omit<GamePush, 'info' | 'status'> & {
  info: Prisma.JsonValue;
  status: Prisma.JsonValue;
};



// API 响应类型
export type CharacterWithGamePush = BaseCharacter & {
  currentPush: BaseGamePush | null;
  factionData?: import('./faction').FactionUiPayload;
  bondData?: import('./bond').BondUiPayload;
};

export type CharacterWithGamePushList = {
  characters: CharacterWithGamePush[];
};

// 状态管理类型
export type CharacterState = CharacterWithGamePush | undefined;

export type ShareState = {
  id: number;
  type?: 'share' | 'import';
};

// 游戏状态接口
export interface GameState {
  status: GameStatus;
  fadeOut: boolean;
  updateStrings: string[];
  userInput: string;
  showDeathModal: boolean;
  deathJudgement: string;
  showInputModal: boolean;
  loadingAnimateState: boolean;
  breakResult?: import('./dto').BreakthroughResponse;
}

// 工具类型
export type WithGamePush<T extends BaseCharacter> = T & {
  gamePush?: BaseGamePush;
};

export type WithCurrentPush<T extends BaseCharacter> = T & {
  currentPush: BaseGamePush | null;
};

// 视图层类型
export type ViewCharacter = WithCurrentPush<BaseCharacter> & {
  willDelete?: boolean;
  currentPush: BaseGamePush | null;
};

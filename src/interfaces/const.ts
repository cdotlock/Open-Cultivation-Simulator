// 游戏常量定义，用于枚举和常量定义，不随着游戏状态变化而更新

import { $img } from "@/utils";
import { GameOptionType } from "./schemas";

// 修为等级
export const cultivationLevels = ["炼气", "筑基", "金丹", "元婴", "化神", "炼虚", "合体", "渡劫", "真仙"] as const;

// 灵根属性
export const elements = ["金", "木", "水", "火", "土"] as const;

// 故事类型
export const storyTypes = ["主线", "机缘", "危机", "日常", "转折"] as const;

// 属性变化趋势
export const attributeTendency = ["增加", "减少"] as const;

// 属性变化程度
export const attributeChange = ["一点", "中等", "多", "极多", "全部"] as const;

// 页面类型
export const pages = ["home", "loading", "create", "char", "story"] as const;

export const attrIconMap = {
  "金": $img("attr-gold"),
  "木": $img("attr-wood"), 
  "水": $img("attr-water"),
  "火": $img("attr-fire"),
  "土": $img("attr-earth")
} as const

export const statusIconMap = {
  "体魄": $img("story/icon-1"),
  "突破": $img("story/icon-2"),
  "道心": $img("story/icon-3"),
  "行动点": $img("story/icon-4")
} as const

// 骰子图片集 - 点数1-6
export const diceImages = {
  dice1: $img("newDice/1"),
  dice2: $img("newDice/2"),
  dice3: $img("newDice/3"),
  dice4: $img("newDice/4"),
  dice5: $img("newDice/5"),
  dice6: $img("newDice/6"),
} as const;

export const getDiceImage = (dice: number) => {
  return diceImages[`dice${dice}` as keyof typeof diceImages];
}

// 游戏状态枚举
export enum GameStatus {
  PLAYING = 'playing',           // 游戏中
  TASK_COMPLETED = 'task_completed', // 完成任务
  BREAKTHROUGH = 'breakthrough',     // 突破
  DEATH = 'death',              // 死亡
  LOADING = 'loading',          // 加载中
  STREAMING = 'streaming'       // 流式生成故事中
}

// 难度等级Map
export const difficultyLevelMap = new Map<GameOptionType['选项难度'], number>([
  ["轻而易举", 4],
  ["按部就班", 7],
  ["挑战重重", 10],
  ["困难卓绝", 12],
  ["逆天而行", 14]
])

export interface LevelAttributeLimit {
  道心: { max: number };
  体魄: { max: number };
  行动点: { max: number };
}

export const LevelAttributeLimits: Record<CultivationLevel, LevelAttributeLimit> = {
  "炼气": {
    道心: { max: 3 },
    体魄: { max: 50 },
    行动点: { max: 50 },
  },
  "筑基": {
    道心: { max: 3 },
    体魄: { max: 70 },
    行动点: { max: 50 },
  },
  "金丹": {
    道心: { max: 3 },
    体魄: { max: 100 },
    行动点: { max: 50 },
  },
  "元婴": {
    道心: { max: 3.5 },
    体魄: { max: 130 },
    行动点: { max: 50 },
  },
  "化神": {
    道心: { max: 4 },
    体魄: { max: 170 },
    行动点: { max: 50 },
  },
  "炼虚": {
    道心: { max: 4.5 },
    体魄: { max: 210 },
    行动点: { max: 50 },
  },
  "合体": {
    道心: { max: 5 },
    体魄: { max: 250 },
    行动点: { max: 50 },
  },
  "渡劫": {
    道心: { max: 6 },
    体魄: { max: 300 },
    行动点: { max: 50 },
  },
  "真仙": {
    道心: { max: 7 },
    体魄: { max: 350 },
    行动点: { max: 50 },
  }
} as const;

export const charStatusConfig = {
  "炼气": {
    url: $img("charStatusV3/炼气"),
    name: "炼气"
  },
  "筑基": {
    url: $img("charStatusV3/筑基"),
    name: "筑基"
  },
  "金丹": {
    url: $img("charStatusV3/金丹"),
    name: "金丹"
  },
  "元婴": {
    url: $img("charStatusV3/元婴"),
    name: "元婴"
  },
  "化神": {
    url: $img("charStatusV3/化神"),
    name: "化神"
  },
  "炼虚": {
    url: $img("charStatusV3/炼虚"),
    name: "炼虚"
  },
  "合体": {
    url: $img("charStatusV3/合体"),
    name: "合体"
  },
  "大乘": {
    url: $img("charStatusV3/大乘"),
    name: "大乘"
  },
  "渡劫": {
    url: $img("charStatusV3/渡劫"),
    name: "渡劫"
  },
  "真仙": {
    url: $img("charStatusV3/真仙"),
    name: "真仙"
  }
}

// 获取境界状态图片URL的方法
export const getCharStatusUrl = (statusName: keyof typeof charStatusConfig): string => {
  return charStatusConfig[statusName]?.url || ""
}

// 根据境界名称获取状态配置
export const getCharStatusByName = (statusName: string) => {
  return charStatusConfig[statusName as keyof typeof charStatusConfig] || null
}

// 导出类型
export type PageType = typeof pages[number];
export type CultivationLevel = typeof cultivationLevels[number];
export type Element = typeof elements[number];
export type StoryType = typeof storyTypes[number];
export type AttributeTendency = typeof attributeTendency[number];
export type AttributeChange = typeof attributeChange[number];

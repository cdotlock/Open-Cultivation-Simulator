import { z } from "zod";
import {
  cultivationLevels,
  elements,
  attributeTendency,
  attributeChange
} from './const';

// 难度级别
// export const difficultyLevels = ["轻而易举", "按部就班", "普通", "挑战重重", "困难", "困难卓绝", "极困难", "逆天而行"] as const;
export const difficultyLevels = ["轻而易举", "按部就班",  "挑战重重", "困难卓绝", "逆天而行"] as const;

// 角色信息 Schema
export const CharacterDescriptionSchema = z.object({
    角色名称: z.string(),
    人物背景: z.string(),
    外貌特征: z.string(),
    灵根属性: z.string(),
    所属帮派: z.string().optional(),
    帮派身份: z.string().optional(),
    帮派地位: z.string().optional(),
    帮派当前目标: z.string().optional(),
    帮派对主角的期待: z.string().optional(),
    初始属性: z.object({
        灵根: z.enum(elements),
        等级: z.enum(cultivationLevels)
    }),
    人物使命与当前阶段: z.string(),
    人物关系: z.array(z.any()).optional(),
    核心任务: z.string(),
    故事大纲: z.string()
});

// 角色状态 Schema
export const CharacterStatusSchema = z.object({
    灵根属性: z.enum(elements),
    等级: z.enum(cultivationLevels),
    突破成功系数: z.number().min(0).max(1).default(0),
    行动点: z.number().min(0).max(50).default(50),
    体魄: z.number().min(0).max(300).default(40),
    道心: z.number().min(0).max(7).default(3),
    魅力: z.number().min(0).max(100).default(0),
    神识: z.number().min(0).max(100).default(0),
    身手: z.number().min(0).max(100).default(0),
    是否死亡: z.boolean().default(false)
});

export const GameOptionSchema = z.object({
    选项描述: z.string(),
    选项类别: z.enum(["交流", "探索", "战斗"]),
    选项难度: z.enum(difficultyLevels),
    成功率: z.number().optional(),
    是否成功: z.boolean().optional(),
    骰子: z.array(z.number()).optional(),
    // 检定相关信息
    基础DC: z.number().optional(),
    最终DC: z.number().optional(),
    变动原因: z.array(z.string()).optional(),
    修正值: z.number().optional(),
    // 自定义选项相关字段 - 仅用于前端状态管理，不存储到数据库
    _isCustomOption: z.boolean().optional(),
    _customInput: z.string().optional(),
});

// 故事推进 Schema
export const storyPushSchema = z.object({
    节点要素: z.object({
        基础信息: z.object({
            类型: z.enum(["主线", "机缘", "危机", "日常", "转折"]),
            等级: z.enum(cultivationLevels),
            终极任务是否完成: z.boolean(),
            当前任务: z.string(),
        }),
        剧情要素: z.object({
            剧情: z.string(),
            场景: z.array(z.string()),
            人物: z.array(z.string()),
            状态变化: z.object({
                体魄变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]),
                道心变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]),
                突破成功率变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]),
                行动点变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]).optional(),
                魅力变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]).optional(),
                神识变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]).optional(),
                身手变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(attributeTendency), z.enum(attributeChange)])
                ]).optional()
            }),
            玩家选项: z.array(GameOptionSchema)
        })
    })
});

// 总结推进 Schema
export const summaryPushSchema = z.object({
    剧情要素: z.object({
        剧情: z.string().optional(),
        场景: z.array(z.string()),
        人物: z.array(z.string()),
    })
});

export const summaryPushSchemaV0 = z.object({
    剧情要素: z.object({
        描述: z.string().optional(),
        场景: z.array(z.string()),
        人物: z.array(z.string()),
    })
});

export const bondWishStructSchema = z.object({
    desiredVibe: z.array(z.string()).default([]),
    desiredTraits: z.array(z.string()).default([]),
    desiredScenes: z.array(z.string()).default([]),
    adultTone: z.boolean().default(false),
    jokeTolerance: z.enum(["低", "中", "高"]).default("中")
});

export const bondChatResponseSchema = z.object({
    reply: z.string(),
    mood: z.string(),
    relationshipSummary: z.string(),
    memorySummary: z.string(),
    intimacyDelta: z.number().int().min(-5).max(8).default(0),
    trustDelta: z.number().int().min(-5).max(8).default(0),
    loyaltyDelta: z.number().int().min(-5).max(8).default(0),
    destinyDelta: z.number().int().min(-3).max(5).default(0)
});

// 加点系统 Schema
export const AttributePointsSchema = z.object({
    魅力: z.number().min(0).max(10).default(0),
    神识: z.number().min(0).max(10).default(0),
    身手: z.number().min(0).max(10).default(0)
});

// 加点验证 Schema
export const AttributePointsValidationSchema = z.object({
    魅力: z.number().min(0).max(10),
    神识: z.number().min(0).max(10),
    身手: z.number().min(0).max(10)
}).refine((data) => {
    return data.魅力 + data.神识 + data.身手 === 10;
}, {
    message: "总加点数必须等于10",
    path: ["total"]
});

// 旧版本的故事推进 Schema（使用 描述 而不是 剧情）
export const storyPushSchemaV0 = z.object({
    节点要素: z.object({
        基础信息: z.object({
            类型: z.enum(["主线", "机缘", "危机", "日常", "转折"]),
            等级: z.enum(cultivationLevels),
            终极任务是否完成: z.boolean()
        }),
        剧情要素: z.object({
            描述: z.string(),  // 旧版本使用 描述 字段
            场景: z.array(z.string()),
            人物: z.array(z.string()),
            状态变化: z.object({
                体魄变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(["减少", "增加"]), z.enum(["一点", "中等", "多", "极多", "全部"])])
                ]),
                道心变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(["减少", "增加"]), z.enum(["一点", "中等", "多", "极多", "全部"])])
                ]),
                突破成功率变化: z.union([
                    z.tuple([z.literal("无变化")]),
                    z.tuple([z.enum(["减少", "增加"]), z.enum(["一点", "中等", "多", "极多", "全部"])])
                ])
            }),
            玩家选项: z.array(z.string())
        })
    })
});

// 从 Schema 推断出的类型
export type CharacterDescriptionType = z.infer<typeof CharacterDescriptionSchema>;
export type CharacterStatusType = z.infer<typeof CharacterStatusSchema>;
export type StoryPushType = z.infer<typeof storyPushSchema>;
export type StoryPushV0Type = z.infer<typeof storyPushSchemaV0>;
export type SummaryPushType = z.infer<typeof summaryPushSchema>;
export type SummaryPushV0Type = z.infer<typeof summaryPushSchemaV0>;
export type GameOptionType = z.infer<typeof GameOptionSchema>;
export type BondWishStructType = z.infer<typeof bondWishStructSchema>;
export type BondChatResponseType = z.infer<typeof bondChatResponseSchema>;

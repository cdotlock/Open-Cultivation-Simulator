import { GamePush } from "@/app/actions/generated/prisma";
import { storyPushSchema, storyPushSchemaV0, summaryPushSchema, summaryPushSchemaV0 } from "@/interfaces/schemas";
import { generateText } from "ai";
import { InputJsonValue } from "@prisma/client/runtime/library";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { prisma } from '@/lib/prisma';

const COMPRESS_LEVEL = 5

/**
 * 后台执行记忆压缩，返回游戏上下文
 */
export async function compressMemoryIfNeeded(characterId: number) {
    // 立即返回当前数据，不等待压缩
    const currentPushes = await prisma.gamePush.findMany({
        where: {
            characterId,
            isSummary: false,
            isChoice: true
        },
        orderBy: { id: 'asc' }
    })

    // 等级统计
    const levelCount = currentPushes.reduce((acc, push) => {
        const level = push.level
        acc[level] = (acc[level] || 0) + 1
        return acc
    }, {} as Record<number, number>)

    // console.log("等级统计", levelCount)

    // 如果需要压缩，在后台执行
    if (Object.values(levelCount).some(count => count > COMPRESS_LEVEL)) {
        setTimeout(() => {
            backgroundCompressMemory(characterId).catch(error => {
                console.error(`后台记忆压缩异常，角色ID: ${characterId}`, error)
            })
        }, 0)
    }

    return buildGameContext(currentPushes)
}

/**
 * 后台执行记忆压缩
 */
async function backgroundCompressMemory(characterId: number) {
    try {
        // 立即返回当前数据，不等待压缩
        const currentPushes = await prisma.gamePush.findMany({
            where: {
                characterId,
                isSummary: false,
                isChoice: true
            },
            orderBy: { id: 'asc' }
        })

        // 等级统计
        const levelCount = currentPushes.reduce((acc, push) => {
            const level = push.level
            acc[level] = (acc[level] || 0) + 1
            return acc
        }, {} as Record<number, number>)

        Object.entries(levelCount).forEach(async ([levelKey, count]) => {

            const level = parseInt(levelKey)

            if (count > COMPRESS_LEVEL) {
                // 除最后一个节点，其他节点进行总结

                const currentLevelPushes = currentPushes.filter(push => push.level === level)
                const nodesToSummarize = currentLevelPushes.slice(0, currentLevelPushes.length - 1)
                const lastNode = nodesToSummarize[nodesToSummarize.length - 1]

                // console.log("allPushs", currentLevelPushes)

                // 标记原节点为已总结，防止重复总结
                await Promise.all(nodesToSummarize.map(async node =>
                    await prisma.gamePush.update({
                        where: { id: node.id },
                        data: { isSummary: true }
                    })
                ))

                let lastScenes: string[] = []
                let lastCharacters: string[] = []

                if (level === 0) {
                    const lastStoryPush = storyPushSchema.safeParse(lastNode.info)
                    if (lastStoryPush.success) {
                        const { 剧情要素 } = lastStoryPush.data.节点要素
                        lastScenes = 剧情要素.场景
                        lastCharacters = 剧情要素.人物
                    } else {
                        return
                    }
                } else {
                    const lastSummaryPush = summaryPushSchema.safeParse(lastNode.info)
                    if (lastSummaryPush.success) {
                        lastScenes = lastSummaryPush.data.剧情要素.场景
                        lastCharacters = lastSummaryPush.data.剧情要素.人物
                    } else {
                        return
                    }
                }

                const summaryContext = buildSummaryContext(nodesToSummarize)
                const contextWithSceneAndCharacters = `${summaryContext}

                当前场景：${lastScenes.join(', ')}
                当前人物：${lastCharacters.join(', ')}`

                // console.log("后台压缩 - summaryContext:", contextWithSceneAndCharacters)

                // 从配置服务获取总结配置
                const config = await ConfigService.getConfig('summary_prompt');
                
                if (!config) {
                    throw new Error("未找到总结配置");
                }

                // 检查模型配置是否存在
                if (!config.model) {
                    throw new Error("总结配置中缺少模型配置");
                }

                // 构建变量对象
                const variables: Record<string, string> = {
                    SUMMARY_CONTEXT: contextWithSceneAndCharacters
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


                // 根据配置创建模型实例
                const modelInstance = createModelFromConfig(config.model);
                
                // 获取provider选项
                const providerOptions = getProviderOptions(config.model, config);

                const { text: storyOutline } = await generateText({
                    model: modelInstance(config.model.name),
                    providerOptions,
                    prompt: combinedPrompt
                })

                // console.log("后台压缩 - storyOutline:", storyOutline)

                const lastNodeData = JSON.parse(JSON.stringify(lastNode.info)) // deep clone
                let finalSummaryPush

                // 尝试解析最后一个节点的数据结构
                if (level === 0) {
                    const lastStoryPushParsed = storyPushSchema.safeParse(lastNodeData)
                    if (lastStoryPushParsed.success) {
                        finalSummaryPush = {
                            剧情要素: {
                                剧情: storyOutline.trim(),
                                场景: lastScenes,
                                人物: lastCharacters
                            }
                        }
                    } else {
                        return
                    }
                } else {
                    const lastSummaryPushParsed = summaryPushSchema.safeParse(lastNodeData)
                    if (lastSummaryPushParsed.success) {
                        finalSummaryPush = {
                            剧情要素: {
                                ...lastSummaryPushParsed.data.剧情要素,
                                剧情: storyOutline.trim(),
                                场景: lastScenes,
                                人物: lastCharacters
                            }
                        }
                    } else {
                        return
                    }
                }

                // console.log("后台压缩 - 浓缩剧情:", JSON.stringify(finalSummaryPush))

                // 创建总结节点
                await prisma.gamePush.create({
                    data: {
                        characterId: lastNode.characterId,
                        info: finalSummaryPush,
                        level: level + 1,
                        isSummary: false,
                        isChoice: true,
                        status: lastNode.status as InputJsonValue
                    }
                })
            }
        })
    } catch (error) {
        console.error(`后台记忆压缩异常，角色ID: ${characterId}`, error)
    }
}


/**
 * 构建总结上下文 - 包含剧情和玩家意图
 */
function buildSummaryContext(gamePushes: Array<{ info: unknown; choice?: string | null }>) {
    if (gamePushes.length < 2) {
        return "先前剧情回顾：\n暂无足够的剧情记录"
    }

    let result = "先前剧情回顾：\n"

    // 取要总结的节点（通常是前两个节点）
    const pushesToSummarize = gamePushes.slice(0, 2)

    for (let i = 0; i < pushesToSummarize.length; i++) {
        const pushItem = pushesToSummarize[i]
        const pushData = pushItem.info
        const choice = pushItem.choice

        // 根据位置确定标题（第一个是上上轮，第二个是上轮）
        const title = i === 0 ? "上上轮剧情：" : "上轮剧情："
        const choiceTitle = i === 0 ? "上上轮玩家意图：" : "上轮玩家意图："

        // 解析剧情
        const storyPush = storyPushSchema.safeParse(pushData)
        if (storyPush.success) {
            const { 剧情要素 } = storyPush.data.节点要素
            result += `${title}\n${剧情要素.剧情}\n`
            result += `${choiceTitle}\n${choice || "无特定选择"}\n`
        } else {
            // 尝试解析旧版本的故事推进格式
            const storyPushV0 = storyPushSchemaV0.safeParse(pushData)
            if (storyPushV0.success) {
                const { 剧情要素 } = storyPushV0.data.节点要素
                result += `${title}\n${剧情要素.描述}\n`
                result += `${choiceTitle}\n${choice || "无特定选择"}\n`
            } else {
                // 尝试解析新版本总结格式
                const summaryPush = summaryPushSchema.safeParse(pushData)
                if (summaryPush.success) {
                    result += `${title}\n${summaryPush.data.剧情要素.剧情}\n`
                    result += `${choiceTitle}\n${choice || "无特定选择"}\n`
                } else {
                    // 尝试解析旧版本总结格式
                    const summaryV0Push = summaryPushSchemaV0.safeParse(pushData)
                    if (summaryV0Push.success) {
                        result += `${title}\n${summaryV0Push.data.剧情要素.描述}\n`
                        result += `${choiceTitle}\n${choice || "无特定选择"}\n`
                    }
                }
            }
        }
    }

    return result
}

function buildGameContext(gamePushes: GamePush[]) {
    if (gamePushes.length === 0) {
        return "暂无剧情记录";
    }

    const parsePushData = (pushData: InputJsonValue | null) => {
        if (!pushData) {
            return "";
        }

        // 先尝试解析新版本的故事推进格式
        const storyPush = storyPushSchema.safeParse(pushData);
        if (storyPush.success) {
            return storyPush.data.节点要素.剧情要素.剧情;
        }

        // 尝试解析旧版本的故事推进格式（使用 描述 字段）
        const storyPushV0 = storyPushSchemaV0.safeParse(pushData);
        if (storyPushV0.success) {
            return storyPushV0.data.节点要素.剧情要素.描述;
        }

        // 尝试解析新版本的总结格式
        const summaryPush = summaryPushSchema.safeParse(pushData);
        if (summaryPush.success) {
            return summaryPush.data.剧情要素.剧情 || "";
        }

        // 尝试解析旧版本的总结格式
        const summaryV0Push = summaryPushSchemaV0.safeParse(pushData);
        if (summaryV0Push.success) {
            return summaryV0Push.data.剧情要素.描述 || "";
        }

        // 如果所有 schema 解析都失败，尝试直接访问数据结构（临时解决 Rydia）
        try {
            const data = pushData as Record<string, unknown>;

            // 尝试访问新版本故事格式
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const nodeElements = (data as any)?.节点要素 as any;
            if (nodeElements?.剧情要素?.剧情) {
                return nodeElements.剧情要素.剧情 as string;
            }

            // 兼容旧字段名 '剧情梗概'
            if (nodeElements?.剧情要素?.剧情梗概) {
                return nodeElements.剧情要素.剧情梗概 as string;
            }

            // 尝试访问旧版本故事格式
            if (nodeElements?.剧情要素?.描述) {
                return nodeElements.剧情要素.描述 as string;
            }

            // 尝试访问总结格式
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const storyElements = (data as any)?.剧情要素 as any;
            if (storyElements?.剧情) {
                return storyElements.剧情 as string;
            }

            // 尝试访问旧版本总结格式
            if (storyElements?.描述) {
                return storyElements.描述 as string;
            }

            console.log("无法解析的推送数据格式:");
            console.log(pushData);
            throw new Error("游戏推送数据格式错误");
        } catch {
            console.log("无法解析的推送数据格式:");
            console.log(pushData);
            throw new Error("游戏推送数据格式错误");
        }
    };

    // 获取所有剧情内容
    const allStories = gamePushes.map(push => parsePushData(push.info));

    // 如果只有一个剧情，直接返回
    if (allStories.length === 1) {
        return `当前回合剧情：${allStories[0]}`;
    }
    const previousStories = allStories.slice(0, -1).join("。");
    const currentStory = allStories[allStories.length - 1];

    return `先前剧情回顾：${previousStories}      上回合剧情：\n${currentStory}`;
}

import { CharacterStatusType, StoryPushType } from "@/interfaces";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { Character } from "../generated/prisma";
import { generateText } from "ai";
import prisma from "@/lib/prisma";

export async function handleCharacterDeath(
    character: Character,
    newStatus: CharacterStatusType,
    gamePush: StoryPushType
): Promise<string> {
    // 从配置服务获取死亡判词提示词配置
    const config = await ConfigService.getConfig('death_judgement_prompt');
    
    if (!config) {
        throw new Error("未找到死亡判词提示词配置");
    }

    // 检查模型配置是否存在
    if (!config.model) {
        throw new Error("死亡判词配置中缺少模型配置");
    }

    // 构建变量对象
    const variables: Record<string, string> = {
        CHARACTER_DESCRIPTION: JSON.stringify(character.description),
        CURRENT_STATUS: JSON.stringify(newStatus),
        LAST_STORY: JSON.stringify(gamePush.节点要素?.剧情要素 || {})
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

    // 打印提示词结构
    console.log("\n📝 【死亡判词生成】提示词结构:");
    console.log(`- 系统提示词: ${systemPrompt ? '已渲染' : '无'}`);
    console.log(`- 用户提示词长度: ${userPrompt.length} 字符`);
    console.log("----------------------------------------");

    // 根据配置创建模型实例
    const modelInstance = createModelFromConfig(config.model);

    // 获取provider选项
    const providerOptions = getProviderOptions(config.model, config);

    const {text} = await generateText({
        model: modelInstance(config.model.name),
        prompt: userPrompt,
        system: systemPrompt,
        maxTokens: 1000,
        providerOptions,
    })

    await prisma.llmCallLog.create({
        data: {
            model: config.model.name,
            prompt: userPrompt,
            systemPrompt: systemPrompt,
            result: text,
            schema: '', // 请根据实际需求填写schema字段
            success: true, // 或根据实际调用结果设置
        }
    })

    return text;
}

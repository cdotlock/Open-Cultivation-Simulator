"use server";
// 角色头像

import { characterAvatar } from "./constants";
import { prisma } from '@/lib/prisma';
import { BaseResponse } from "@/interfaces/dto";
import { GameCharacterRefactored as GameCharacter } from "../module/GameCharacterRefactored";
import { CharacterDescriptionType } from "@/interfaces";
import { saveBufferToPublicFile } from "@/lib/local-media";
import { getLocalAppConfig } from "@/lib/local-config/store";
import { getDefaultAvatarGenerationPrompt } from "@/lib/local-config/defaults";

const DOUBAO_API_URL = "https://ark.cn-beijing.volces.com/api/v3/images/generations";
const MAX_DAILY_TASKS = 3;

const getPrompt = (appearance: string) =>
  getDefaultAvatarGenerationPrompt().replace(/\{appearance\}/g, appearance);

/**
 * 同步生成角色默认头像 - 用于角色创建时
 * @param characterId 角色ID
 * @param description 角色描述信息
 * @param userUuid 用户UUID
 * @returns 头像URL
 */
export async function generateDefaultCharacterAvatar(
    characterId: number,
    description: CharacterDescriptionType
): Promise<string> {
    try {
        const localConfig = await getLocalAppConfig();
        if (!localConfig.features.avatarGenerationEnabled) {
            return "";
        }

        // 从角色描述中提取外貌特征作为头像生成的提示词
        const appearancePrompt = description.外貌特征 || "古风仙侠人物，神秘气质";

        const apiKey = process.env.SEED_EDIT_KEY;
        if (!apiKey) {
            console.error("SEED_EDIT_KEY is not configured");
            return "";
        }

        console.log(getPrompt(appearancePrompt))

        const response = await fetch(DOUBAO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "doubao-seedream-4-0-250828",
                prompt: getPrompt(appearancePrompt),
                response_format: "url",
                size: "1024x1536",
                seed: Math.floor(Math.random() * 1000000),
                // "guidance_scale": 2.5,
                "watermark": false
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Avatar generation failed: ${response.statusText}, ${errorBody}`);
            return "";
        }

        const result = await response.json();
        const imageUrl = result.data?.[0]?.url;

        if (!imageUrl) {
            console.error("Image URL not found in API response");
            return "";
        }

        // 下载图片
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            console.error("Failed to download image from generated URL");
            return "";
        }
        const imageBuffer = await imageResponse.arrayBuffer();

        const localUrl = await saveBufferToPublicFile(Buffer.from(imageBuffer), "avatars");

        // 创建头像记录并设置为默认头像
        await prisma.avatar.create({
            data: {
                url: localUrl,
                prompt: appearancePrompt,
                characterId: characterId,
                isMain: true, // 设置为默认头像
            }
        });

        return localUrl;
    } catch (error) {
        console.error("Error generating default character avatar:", error);
        return "";
    }
}


async function processAvatarTask(taskId: string, prompt: string, characterId: number) {
    try {
        await prisma.avatarTask.update({ where: { id: taskId }, data: { status: 'PROCESSING' } });

        const apiKey = process.env.SEED_EDIT_KEY;
        if (!apiKey) {
            throw new Error("SEED_EDIT_KEY is not configured in environment variables.");
        }

        console.log(getPrompt(prompt))

        const response = await fetch(DOUBAO_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "doubao-seedream-4-0-250828",
                prompt: getPrompt(prompt),
                response_format: "url",
                size: "1024x1536",
                seed: Math.floor(Math.random() * 1000000),
                // "guidance_scale": 2.5,
                "watermark": false
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Failed to generate image: ${response.statusText}, ${errorBody}`);
        }

        const result = await response.json();
        const imageUrl = result.data?.[0]?.url;

        if (!imageUrl) {
            throw new Error("Image URL not found in API response.");
        }

        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error("Failed to download image from generated URL.");
        }
        const imageBuffer = await imageResponse.arrayBuffer();

        const localUrl = await saveBufferToPublicFile(Buffer.from(imageBuffer), "avatars");

        const newAvatar = await prisma.avatar.create({
            data: {
                url: localUrl,
                prompt: prompt,
                characterId: characterId,
                isMain: false,
            }
        });

        await prisma.avatarTask.update({
            where: { id: taskId },
            data: { status: 'SUCCESS', resultUrl: newAvatar.url }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
        await prisma.avatarTask.update({
            where: { id: taskId },
            data: { status: 'FAILED', error: errorMessage }
        });

        console.error("Error processing avatar task:", error);
    } finally {
    }
}


// 生成角色头像 - 异步，弹出提示信息 同一时间，同一用户只能生成一个任务，每个用户每天只能生成3个任务
export async function generateCharacterAvatar(characterId: number, prompt: string): Promise<{ isSuccess: boolean, message: string, taskId: string }> {

    const localConfig = await getLocalAppConfig();
    if (!localConfig.features.avatarGenerationEnabled) {
        return { isSuccess: false, message: "角色头像生成未开启，请先在设置页启用。", taskId: "" };
    }

    if (isNaN(characterId)) {
        return { isSuccess: false, message: "无效的角色ID", taskId: "" };
    }

    const character = await prisma.character.findUnique({ where: { id: characterId } });
    if (!character) {
        return { isSuccess: false, message: "角色不存在", taskId: "" };
    }
    const userUuid = character.userUuid;
    if (!userUuid) {
        return { isSuccess: false, message: "用户不存在", taskId: "" };
    }

    const existingTask = await prisma.avatarTask.findFirst({
        where: {
            userUuid,
            status: {
                in: ['PENDING', 'PROCESSING']
            }
        }
    });

    if (existingTask) {
        return { isSuccess: false, message: "您当前有正在进行的任务，请稍后再试。", taskId: "" };
    }

    // Get start and end of today in UTC
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0));
    const endOfDay = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999));

    const dailyTasksCount = await prisma.avatarTask.count({
        where: {
            userUuid: userUuid,
            createdAt: {
                gte: startOfDay,
                lte: endOfDay,
            },
            status: {
                not: 'FAILED' // Don't count failed tasks against the limit
            }
        },
    });

    if (dailyTasksCount >= MAX_DAILY_TASKS) {
        return { isSuccess: false, message: `您今天已达到头像生成任务的上限（${MAX_DAILY_TASKS}个），请明天再试。`, taskId: "" };
    }

    const newTask = await prisma.avatarTask.create({
        data: {
            prompt,
            characterId: characterId,
            userUuid: userUuid,
            status: 'PENDING'
        }
    });

    // Don't await this, let it run in the background
    processAvatarTask(newTask.id, prompt, characterId);

    return { isSuccess: true, message: "任务创建成功！", taskId: newTask.id };
}

// 角色生成历史
export async function characterAvatarList(characterId: number): Promise<characterAvatar[]> {
    if (isNaN(characterId)) {
        return [];
    }
    const avatars = await prisma.avatar.findMany({
        where: { characterId: characterId },
        orderBy: { createdAt: 'desc' }
    });

    return avatars.map(a => ({
        id: a.id,
        name: a.prompt, // Using prompt as name for display
        prompt: a.prompt,
        url: a.url,
    }));
}

// 角色确定选择头像
export async function selectCharacterAvatar(characterId: number, avatarId: number): Promise<boolean> {
    if (isNaN(characterId)) {
        return false;
    }

    try {
        const selectedAvatar = await prisma.avatar.findUnique({ where: { id: avatarId } });
        if (!selectedAvatar || selectedAvatar.characterId !== characterId) {
            return false;
        }

        await prisma.$transaction([
            prisma.avatar.updateMany({
                where: { characterId: characterId },
                data: { isMain: false }
            }),
            prisma.avatar.update({
                where: { id: avatarId },
                data: { isMain: true }
            }),
            prisma.character.update({
                where: { id: characterId },
                data: { cover: selectedAvatar.url }
            })
        ]);
        return true;
    } catch (e) {
        console.error("Failed to select character avatar:", e);
        return false;
    }
}

// 轮询任务状态 - By taskId, 轮询间隔5秒
export async function queryTask(taskId: string): Promise<{ current: number, total: number, result?: characterAvatar, status: string, error?: string }> {
    const task = await prisma.avatarTask.findUnique({ where: { id: taskId } });

    if (!task) {
        return { current: 0, total: 1, status: 'NOT_FOUND', error: "Task not found." };
    }

    const progress: { current: number, total: number, result?: characterAvatar, status: string, error?: string } = { current: 0, total: 100, status: task.status, error: task.error || undefined };

    switch (task.status) {
        case 'PENDING':
            progress.current = 10;
            break;
        case 'PROCESSING':
            progress.current = 50;
            break;
        case 'SUCCESS':
            progress.current = 100;
            if (task.resultUrl) {
                const avatar = await prisma.avatar.findFirst({ where: { url: task.resultUrl } });
                if (avatar) {
                    progress.result = {
                        id: avatar.id,
                        name: avatar.prompt,
                        prompt: avatar.prompt,
                        url: avatar.url,
                    };
                }
            }
            break;
        case 'FAILED':
            progress.current = 100;
            break;
    }

    return progress;
}

// 聚合查询接口：获取当前选择头像、角色描述、历史生成列表
export async function getCharacterAvatarAggregate(characterId: number, userUuid: string): Promise<BaseResponse<{
    currentAvatar?: characterAvatar;
    characterDescription: string;
    avatarHistory: characterAvatar[];
    characterExists: boolean;
}>> {
    if (isNaN(characterId)) {
        return {
            isSuccess: false,
            message: "无效的角色ID",
        };
    }

    // 获取角色信息
    const character = await GameCharacter.load(characterId);

    if (!character) {
        return {
            isSuccess: false,
            message: "角色不存在"
        };
    }

    // 验证用户权限
    if (character.userUuid !== userUuid) {
        console.log("userUuid", userUuid)
        console.log("character.userUuid", character.userUuid)
        return {
            isSuccess: false,
            message: "用户无权限访问"
        };
    }

    // 获取当前选择的头像
    const currentAvatar = await prisma.avatar.findFirst({
        where: {
            characterId: characterId,
            isMain: true
        }
    });

    // 获取历史头像列表
    const avatarHistory = await prisma.avatar.findMany({
        where: { characterId: characterId },
        orderBy: { createdAt: 'asc' }
    });

    return {
        isSuccess: true,
        message: "获取成功",
        data: {
        currentAvatar: currentAvatar ? {
            id: currentAvatar.id,
            name: currentAvatar.prompt,
            prompt: currentAvatar.prompt,
            url: currentAvatar.url,
        } : undefined,
        characterDescription: character.description.外貌特征 || "",
        avatarHistory: avatarHistory.map(a => ({
            id: a.id,
            name: a.prompt,
            prompt: a.prompt,
            url: a.url,
            })),
            characterExists: true,
        }
    };
}

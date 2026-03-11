import { Character, GamePush } from "../generated/prisma"
import { prisma } from '@/lib/prisma';

/**
 * @Action 获取角色ByID
 * @param id 
 * @returns 
 */
export async function getCharacterById(id: number): Promise<Character> {
    const character = await prisma.character.findFirst({
        where: {
            id: id
        }
    })

    if (!character) {
        throw new Error("没有找到角色")
    }

    return character
}

export async function getGamePushById(id: number): Promise<GamePush> {
    const gamePush = await prisma.gamePush.findFirst({
        where: {
            id: id
        }
    })

    if (!gamePush) {
        throw new Error("没有找到进度")
    }

    return gamePush
}

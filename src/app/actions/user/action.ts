"use server";

import { prisma } from '@/lib/prisma';
import { CharacterWithGamePush, CharacterDescriptionType, BaseGamePush } from "@/interfaces";
import { ensureLocalUserRecord } from "@/lib/local-user";

/**
 * 登录接口：通过 uuid 登录，没有则新建
 * @param uuid 用户唯一标识
 * @returns 用户
 */
export async function loginWithUuid(uuid: string) {
  let user = await prisma.user.findUnique({ where: { uuid } });
  if (!user) {
    user = await prisma.user.create({ data: { uuid } });
  }
  return uuid;
}

export async function getOrCreateLocalUser() {
  return ensureLocalUserRecord();
}

/**
 * 根据用户UUID获取角色列表
 * @param uuid 用户唯一标识
 * @returns 角色列表
 */
export async function getCharacterListByUuid(uuid: string): Promise<CharacterWithGamePush[]> {
  const user = await prisma.user.findUnique({ where: { uuid } });
  if (!user) return [];
  
  const characterList = await prisma.character.findMany({
    where: { userUuid: uuid, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    include: {
      currentPush: true
    }
  });

  // 返回所有角色，包括复活后currentPush为空的角色
  // 前端可以根据currentPush是否为空来判断角色状态
  return characterList.map(char => ({
    ...char,
    description: char.description as CharacterDescriptionType,
    currentPush: char.currentPush ? char.currentPush as BaseGamePush : null
  }));
}

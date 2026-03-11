'use server';

import { cookies } from 'next/headers';
import { PrismaClient } from '../generated/prisma';
import { requireAuth } from '@/utils/auth-server';

const prisma = new PrismaClient();

/**
 * 刷新用户状态到Cookie和前端
 * 在用户状态发生变化后调用此函数，确保前后端数据一致
 */
export async function refreshUserState() {
  try {
    // 获取当前用户信息
    const user = await requireAuth();
    
    // 从数据库获取最新的用户数据
    const dbUser = await prisma.user.findUnique({
      where: { uuid: user.uuid },
      select: {
        id: true,
        phone: true,
        uuid: true,
        freeReviveUsed: true,
        paidReviveCount: true,
      },
    });

    if (!dbUser) {
      throw new Error('用户不存在');
    }

    // 准备最新的用户数据
    const userData = {
      id: dbUser.id,
      phone: dbUser.phone!,
      uuid: dbUser.uuid!,
      isLoggedIn: true,
      freeReviveUsed: dbUser.freeReviveUsed,
      paidReviveCount: dbUser.paidReviveCount,
    };

    // 更新Cookie中的用户信息
    const cookieStore = await cookies();
    cookieStore.set('userInfo', JSON.stringify(userData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60, // 7天
      path: '/',
      sameSite: 'lax'
    });

    console.log('用户状态已刷新', { uuid: user.uuid, freeReviveUsed: userData.freeReviveUsed, paidReviveCount: userData.paidReviveCount });

    return {
      success: true,
      data: userData,
    };
  } catch (error) {
    console.error('刷新用户状态失败:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '刷新用户状态失败',
    };
  }
}
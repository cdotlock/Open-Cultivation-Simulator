import { cookies } from 'next/headers';
import { PrismaClient } from '../app/actions/generated/prisma';
import { ensureLocalUserRecord } from '@/lib/local-user';

const prisma = new PrismaClient();

export interface AuthUser {
  id: number;
  phone: string;
  uuid: string;
  isLoggedIn: boolean;
  freeReviveUsed: boolean;
  paidReviveCount: number;
}

export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

export async function getCurrentUser(): Promise<AuthResult> {
  try {
    const cookieStore = await cookies();
    const userInfo = cookieStore.get('userInfo')?.value;
    
    console.log('getCurrentUser: 检查Cookie中的用户信息');
    console.log('getCurrentUser: userInfo from cookie:', userInfo ? '存在' : '不存在');
    
    if (!userInfo) {
      const localUser = await ensureLocalUserRecord();
      return {
        success: true,
        user: localUser,
      };
    }
    
    const user = JSON.parse(userInfo) as AuthUser;
    console.log('getCurrentUser: 解析的用户数据:', { 
      id: user.id, 
      uuid: user.uuid, 
      freeReviveUsed: user.freeReviveUsed,
      phone: user.phone,
      isLoggedIn: user.isLoggedIn 
    });
    
    // 验证用户状态
    if (!user.isLoggedIn || !user.uuid || !user.id) {
      const localUser = await ensureLocalUserRecord();
      return {
        success: true,
        user: localUser,
      };
    }
    
    // 验证用户在数据库中是否存在
    console.log('getCurrentUser: 在数据库中查找用户, uuid:', user.uuid);
    const dbUser = await prisma.user.findUnique({
      where: { uuid: user.uuid },
    });
    
    if (!dbUser) {
      const localUser = await ensureLocalUserRecord();
      return {
        success: true,
        user: localUser,
      };
    }
    
    console.log('getCurrentUser: 用户验证成功', { dbUserId: dbUser.id, phone: dbUser.phone });
    
    // 返回数据库中的最新用户数据，而不是Cookie中可能过期的数据
    const authUser: AuthUser = {
      id: dbUser.id,
      phone: dbUser.phone || '',
      uuid: dbUser.uuid || '',
      isLoggedIn: true,
      freeReviveUsed: dbUser.freeReviveUsed,
      paidReviveCount: dbUser.paidReviveCount,
    };
    
    return {
      success: true,
      user: authUser
    };
  } catch (error) {
    console.error('获取当前用户失败:', error);
    return {
      success: false,
      error: '获取用户信息失败'
    };
  }
}

export async function requireAuth(): Promise<AuthUser> {
  const result = await getCurrentUser();
  
  if (!result.success || !result.user) {
    throw new Error(result.error || '用户未登录');
  }
  
  return result.user;
}

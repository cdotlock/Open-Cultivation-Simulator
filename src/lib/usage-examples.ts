/**
 * 错误处理使用示例
 * 
 * 这个文件展示了如何在不同场景下使用错误处理功能
 */

// ===== Server Actions 使用示例 =====

import { withErrorHandling, handleActionError } from './server-error-handler';
import { dbOperations, withDatabaseErrorHandling } from './db-error-wrapper';

// 方法1: 使用装饰器包装Server Action
export const createUser = withErrorHandling('createUser', async (userData: unknown) => {
  // 这里的错误会自动被捕获并发送到飞书
  return await dbOperations.create(async () => {
    // 假设这里是prisma操作
    // return await prisma.user.create({ data: userData });
    throw new Error('测试错误');
  }, 'user');
});

// 方法2: 手动处理Server Action错误
export async function updateUser(userId: string, userData: unknown) {
  try {
    return await dbOperations.update(async () => {
      // return await prisma.user.update({
      //   where: { id: userId },
      //   data: userData
      // });
      throw new Error('更新用户失败');
    }, 'user');
  } catch (error) {
    await handleActionError(
      error instanceof Error ? error : new Error(String(error)),
      'updateUser',
      userId
    );
    throw error;
  }
}

// ===== API 路由使用示例 =====

/*
// 在 src/app/api/users/route.ts 中使用:

import { NextRequest, NextResponse } from 'next/server';
import { withGetErrorHandling, withPostErrorHandling, createApiError } from '@/lib/api-error-wrapper';

export const GET = withGetErrorHandling(async (request: NextRequest) => {
  // 这里的错误会自动被捕获并发送到飞书
  throw createApiError('用户不存在', 404, 'USER_NOT_FOUND');
  
  return NextResponse.json({ users: [] });
});

export const POST = withPostErrorHandling(async (request: NextRequest) => {
  const body = await request.json();
  
  // 验证失败的例子
  if (!body.email) {
    throw createApiError('邮箱是必填项', 400, 'VALIDATION_ERROR');
  }
  
  // 数据库操作
  const user = await dbOperations.create(async () => {
    return await prisma.user.create({ data: body });
  }, 'user');
  
  return NextResponse.json({ user });
});
*/

// ===== 数据库操作使用示例 =====

// 使用 dbOperations 便捷函数
export async function getUserList() {
  return await dbOperations.findMany(async () => {
    // return await prisma.user.findMany({
    //   include: { posts: true }
    // });
    throw new Error('数据库查询失败');
  }, 'user');
}

// 使用装饰器方式（类方法）
class UserService {
  async createUser(userData: unknown) {
    return await dbOperations.create(async () => {
      // return await prisma.user.create({ data: userData });
      throw new Error('创建用户失败');
    }, 'user');
  }

  async findUserById(id: string) {
    return await dbOperations.findUnique(async () => {
      // return await prisma.user.findUnique({ where: { id } });
      throw new Error('查找用户失败');
    }, 'user');
  }
}

// ===== 中间件错误处理示例 =====

/*
// 在 src/middleware.ts 中添加:

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { handleServerError } from '@/lib/server-error-handler';

export async function middleware(request: NextRequest) {
  try {
    // 中间件逻辑
    return NextResponse.next();
  } catch (error) {
    await handleServerError(
      error instanceof Error ? error : new Error(String(error)),
      {
        path: request.nextUrl.pathname,
        method: request.method,
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('x-forwarded-for') || undefined,
      }
    );
    
    return NextResponse.json(
      { error: '中间件处理失败' },
      { status: 500 }
    );
  }
}
*/

// ===== 全局错误处理 =====

/*
// 在 src/app/global-error.tsx 中添加（如果需要的话）:

'use client';

import { useEffect } from 'react';
import { handleServerError } from '@/lib/server-error-handler';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 这里可以处理全局错误
    handleServerError(error, {
      path: window.location.pathname,
    });
  }, [error]);

  return (
    <html>
      <body>
        <h2>出现了一些问题!</h2>
        <button onClick={() => reset()}>重试</button>
      </body>
    </html>
  );
}
*/

// ===== 其他使用技巧 =====

// 1. 自定义错误类型
export class BusinessError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'BusinessError';
  }
}

// 2. 条件性错误上报（例如只在生产环境上报）
export async function conditionalErrorReporting(error: Error) {
  if (process.env.NODE_ENV === 'production') {
    await handleActionError(error, 'conditionalExample');
  } else {
    console.log('开发环境错误:', error);
  }
}

// 3. 错误重试机制
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  operationName = 'unknown'
): Promise<T> {
  let lastError: Error;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (i === maxRetries - 1) {
        // 最后一次重试失败，发送错误报告
        await handleActionError(lastError, `${operationName}:retry_failed`);
        throw lastError;
      }
      
      // 等待一段时间再重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError!;
} 
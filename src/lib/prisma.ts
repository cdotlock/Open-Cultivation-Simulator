import { PrismaClient } from "@/app/actions/generated/prisma";

// 全局变量，用于在开发环境中保持连接
declare global {
  var __prisma: PrismaClient | undefined;
}

// 创建Prisma客户端实例
export const prisma = globalThis.__prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn'] : ['error'],

  // 暂时把prisma日志安静一下
  // log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
});

// 在开发环境中，将实例保存到全局变量中
if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

export default prisma; 
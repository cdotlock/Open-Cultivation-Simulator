import { PrismaClientKnownRequestError, PrismaClientUnknownRequestError } from '@prisma/client/runtime/library';
import { handleDatabaseError } from './server-error-handler';

export interface DatabaseError extends Error {
  code?: string;
  table?: string;
  operation?: string;
}

/**
 * 处理Prisma错误
 */
function handlePrismaError(error: unknown, operation: string, table?: string): DatabaseError {
  if (error instanceof PrismaClientKnownRequestError) {
    const dbError = new Error(`数据库操作失败: ${error.message}`) as DatabaseError;
    dbError.code = error.code;
    dbError.table = table;
    dbError.operation = operation;
    return dbError;
  }

  if (error instanceof PrismaClientUnknownRequestError) {
    const dbError = new Error(`数据库未知错误: ${error.message}`) as DatabaseError;
    dbError.table = table;
    dbError.operation = operation;
    return dbError;
  }

  if (error instanceof Error) {
    const dbError = new Error(`数据库操作异常: ${error.message}`) as DatabaseError;
    dbError.table = table;
    dbError.operation = operation;
    return dbError;
  }

  const dbError = new Error(`数据库操作失败: ${String(error)}`) as DatabaseError;
  dbError.table = table;
  dbError.operation = operation;
  return dbError;
}

/**
 * 数据库操作错误处理包装器
 */
export function withDatabaseErrorHandling(
  operation: string,
  table?: string
) {
  return function <TArgs extends unknown[], TReturn>(
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: TArgs): Promise<TReturn> {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        const dbError = handlePrismaError(error, operation, table);
        
        // 发送错误到飞书
        await handleDatabaseError(dbError, operation, table);
        
        throw dbError;
      }
    };

    return descriptor;
  };
}

/**
 * 包装Prisma操作的通用函数
 */
export async function withDbErrorHandling<T>(
  operation: () => Promise<T>,
  operationName: string,
  table?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const dbError = handlePrismaError(error, operationName, table);
    
    // 发送错误到飞书
    await handleDatabaseError(dbError, operationName, table);
    
    throw dbError;
  }
}

/**
 * 常用数据库操作的便捷包装函数
 */
export const dbOperations = {
  /**
   * 创建记录
   */
  async create<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'CREATE', table);
  },

  /**
   * 查询记录
   */
  async findMany<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'FIND_MANY', table);
  },

  /**
   * 查询单个记录
   */
  async findUnique<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'FIND_UNIQUE', table);
  },

  /**
   * 更新记录
   */
  async update<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'UPDATE', table);
  },

  /**
   * 删除记录
   */
  async delete<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'DELETE', table);
  },

  /**
   * 批量更新
   */
  async updateMany<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'UPDATE_MANY', table);
  },

  /**
   * 批量删除
   */
  async deleteMany<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'DELETE_MANY', table);
  },

  /**
   * 创建或更新
   */
  async upsert<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'UPSERT', table);
  },

  /**
   * 聚合查询
   */
  async aggregate<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'AGGREGATE', table);
  },

  /**
   * 计数查询
   */
  async count<T>(operation: () => Promise<T>, table: string): Promise<T> {
    return withDbErrorHandling(operation, 'COUNT', table);
  },

  /**
   * 事务操作
   */
  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return withDbErrorHandling(operation, 'TRANSACTION');
  },
}; 

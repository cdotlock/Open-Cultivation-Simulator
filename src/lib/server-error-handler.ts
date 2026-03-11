import { NextRequest } from 'next/server';
import { FeiShuWebhookPayload } from '@/interfaces/dto';

interface ServerErrorContext {
  userId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
  environment: string;
  actionName?: string;
  apiRoute?: string;
  database?: string;
}

class ServerErrorHandler {
  private static instance: ServerErrorHandler;
  private readonly webhookUrl = process.env.FEISHU_WEBHOOK_URL;

  private constructor() {}

  public static getInstance(): ServerErrorHandler {
    if (!ServerErrorHandler.instance) {
      ServerErrorHandler.instance = new ServerErrorHandler();
    }
    return ServerErrorHandler.instance;
  }

  /**
   * 发送错误信息到飞书
   */
  private async sendToFeishu(payload: FeiShuWebhookPayload): Promise<void> {
    if (!this.webhookUrl) {
      return;
    }

    try {
      const response = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error('飞书webhook发送失败:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('发送飞书webhook时出错:', error);
    }
  }

  /**
   * 格式化服务器错误信息
   */
  private formatServerError(error: Error, context?: ServerErrorContext): FeiShuWebhookPayload {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });

    const title = `🚨 服务器错误告警 - ${error.name || 'ServerError'}`;
    
    let content = `**错误时间:** ${timestamp}\n`;
    content += `**错误类型:** ${error.name || 'Unknown'}\n`;
    content += `**错误信息:** ${error.message}\n`;
    
    if (error.stack) {
      content += `**错误堆栈:**\n\`\`\`\n${error.stack.substring(0, 1000)}${error.stack.length > 1000 ? '...' : ''}\`\`\`\n`;
    }

    if (context) {
      content += `\n**服务器上下文:**\n`;
      if (context.actionName) content += `- Server Action: ${context.actionName}\n`;
      if (context.apiRoute) content += `- API路由: ${context.apiRoute}\n`;
      if (context.path) content += `- 请求路径: ${context.path}\n`;
      if (context.method) content += `- 请求方法: ${context.method}\n`;
      if (context.userId) content += `- 用户ID: ${context.userId}\n`;
      if (context.ip) content += `- IP地址: ${context.ip}\n`;
      if (context.userAgent) content += `- 用户代理: ${context.userAgent.substring(0, 100)}...\n`;
      if (context.database) content += `- 数据库操作: ${context.database}\n`;
      content += `- 环境: ${context.environment}\n`;
    }

    return { title, content };
  }

  /**
   * 处理服务器错误并发送到飞书
   */
  public async handleServerError(error: Error, context?: Partial<ServerErrorContext>): Promise<void> {
    try {
      // 合并默认上下文
      const fullContext: ServerErrorContext = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        ...context,
      };

      console.error('服务器错误处理器捕获到错误:', error, fullContext);

      const payload = this.formatServerError(error, fullContext);
      await this.sendToFeishu(payload);
    } catch (handlerError) {
      console.error('服务器错误处理器自身出错:', handlerError);
    }
  }

  /**
   * 处理API路由错误
   */
  public async handleApiError(
    error: Error,
    request: NextRequest,
    apiPath: string
  ): Promise<void> {
    const context: Partial<ServerErrorContext> = {
      apiRoute: apiPath,
      path: request.url,
      method: request.method,
      userAgent: request.headers.get('user-agent') || undefined,
      ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
    };

    await this.handleServerError(error, context);
  }

  /**
   * 处理Server Action错误
   */
  public async handleActionError(
    error: Error,
    actionName: string,
    userId?: string
  ): Promise<void> {
    const context: Partial<ServerErrorContext> = {
      actionName,
      userId,
    };

    await this.handleServerError(error, context);
  }

  /**
   * 处理数据库操作错误
   */
  public async handleDatabaseError(
    error: Error,
    operation: string,
    table?: string
  ): Promise<void> {
    const context: Partial<ServerErrorContext> = {
      database: `${operation}${table ? ` on ${table}` : ''}`,
    };

    await this.handleServerError(error, context);
  }
}

// 导出单例实例
export const serverErrorHandler = ServerErrorHandler.getInstance();

// 便捷函数
export const handleServerError = (error: Error, context?: Partial<ServerErrorContext>) =>
  serverErrorHandler.handleServerError(error, context);

export const handleApiError = (error: Error, request: NextRequest, apiPath: string) =>
  serverErrorHandler.handleApiError(error, request, apiPath);

export const handleActionError = (error: Error, actionName: string, userId?: string) =>
  serverErrorHandler.handleActionError(error, actionName, userId);

export const handleDatabaseError = (error: Error, operation: string, table?: string) =>
  serverErrorHandler.handleDatabaseError(error, operation, table);

/**
 * Server Action错误装饰器
 */
export function withErrorHandling<T extends unknown[], R>(
  actionName: string,
  action: (...args: T) => Promise<R>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await action(...args);
    } catch (error) {
      await handleActionError(
        error instanceof Error ? error : new Error(String(error)),
        actionName
      );
      throw error;
    }
  };
}

/**
 * 数据库操作错误装饰器
 */
export function withDatabaseErrorHandling<T extends unknown[], R>(
  operation: string,
  table?: string
) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        await handleDatabaseError(
          error instanceof Error ? error : new Error(String(error)),
          operation,
          table
        );
        throw error;
      }
    };

    return descriptor;
  };
} 

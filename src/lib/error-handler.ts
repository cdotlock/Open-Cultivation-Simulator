import { FeiShuWebhookPayload } from '@/interfaces/dto';

interface ErrorContext {
  userId?: string;
  path?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  timestamp: string;
  environment: string;
}

class ErrorHandler {
  private static instance: ErrorHandler;
  private readonly webhookUrl = process.env.FEISHU_WEBHOOK_URL;

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
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
   * 格式化错误信息
   */
  private formatError(error: Error, context?: ErrorContext): FeiShuWebhookPayload {
    const timestamp = new Date().toLocaleString('zh-CN', {
      timeZone: 'Asia/Shanghai',
    });

    const title = `🚨 系统错误告警 - ${error.name || 'Error'}`;
    
    let content = `**错误时间:** ${timestamp}\n`;
    content += `**错误类型:** ${error.name || 'Unknown'}\n`;
    content += `**错误信息:** ${error.message}\n`;
    
    if (error.stack) {
      content += `**错误堆栈:**\n\`\`\`\n${error.stack}\`\`\`\n`;
    }

    if (context) {
      content += `\n**上下文信息:**\n`;
      if (context.path) content += `- 请求路径: ${context.path}\n`;
      if (context.method) content += `- 请求方法: ${context.method}\n`;
      if (context.userId) content += `- 用户ID: ${context.userId}\n`;
      if (context.ip) content += `- IP地址: ${context.ip}\n`;
      if (context.userAgent) content += `- 用户代理: ${context.userAgent}\n`;
      content += `- 环境: ${context.environment}\n`;
    }

    return { title, content };
  }

  /**
   * 处理错误并发送到飞书
   */
  public async handleError(error: Error, context?: Partial<ErrorContext>): Promise<void> {
    try {
      // 合并默认上下文
      const fullContext: ErrorContext = {
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'unknown',
        ...context,
      };

      console.error('错误处理器捕获到错误:', error, fullContext);

      const payload = this.formatError(error, fullContext);
      await this.sendToFeishu(payload);
    } catch (handlerError) {
      console.error('错误处理器自身出错:', handlerError);
    }
  }

  /**
   * 处理Next.js服务器错误
   */
  public async handleServerError(
    error: Error,
    request?: {
      url?: string;
      method?: string;
      headers?: Headers;
      ip?: string;
    }
  ): Promise<void> {
    const context: Partial<ErrorContext> = {};
    
    if (request) {
      context.path = request.url;
      context.method = request.method;
      context.userAgent = request.headers?.get('user-agent') || undefined;
      context.ip = request.ip || request.headers?.get('x-forwarded-for') || undefined;
    }

    await this.handleError(error, context);
  }

  /**
   * 处理客户端错误
   */
  public async handleClientError(
    error: Error,
    context?: {
      userId?: string;
      page?: string;
      component?: string;
    }
  ): Promise<void> {
    const errorContext: Partial<ErrorContext> = {
      path: context?.page || window?.location?.pathname,
      userId: context?.userId,
    };

    await this.handleError(error, errorContext);
  }
}

// 导出单例实例
export const errorHandler = ErrorHandler.getInstance();

// 便捷函数
export const handleError = (error: Error, context?: Partial<ErrorContext>) =>
  errorHandler.handleError(error, context);

export const handleServerError = (
  error: Error,
  request?: {
    url?: string;
    method?: string;
    headers?: Headers;
    ip?: string;
  }
) => errorHandler.handleServerError(error, request);

export const handleClientError = (
  error: Error,
  context?: {
    userId?: string;
    page?: string;
    component?: string;
  }
) => errorHandler.handleClientError(error, context); 

import { NextRequest, NextResponse } from 'next/server';
import { handleApiError } from './server-error-handler';
import { ApiError } from '@/interfaces/dto';

export function withApiErrorHandling(
  handler: (request: NextRequest, params?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return async (
    request: NextRequest,
    params?: { params: Record<string, string> }
  ): Promise<NextResponse> => {
    try {
      return await handler(request, params);
    } catch (error) {
      const apiError = error as ApiError;
      
      // 发送错误到飞书
      await handleApiError(
        apiError,
        request,
        request.nextUrl.pathname
      );

      // 返回错误响应
      return createApiErrorResponse(apiError);
    }
  };
}

export function createApiErrorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: error.message,
      code: error.code,
    },
    {
      status: error.statusCode || 500,
    }
  );
}

/**
 * GET方法的错误处理包装器
 */
export function withGetErrorHandling(
  handler: (request: NextRequest, params?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return withApiErrorHandling(handler);
}

/**
 * POST方法的错误处理包装器
 */
export function withPostErrorHandling(
  handler: (request: NextRequest, params?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return withApiErrorHandling(handler);
}

/**
 * PUT方法的错误处理包装器
 */
export function withPutErrorHandling(
  handler: (request: NextRequest, params?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return withApiErrorHandling(handler);
}

/**
 * DELETE方法的错误处理包装器
 */
export function withDeleteErrorHandling(
  handler: (request: NextRequest, params?: { params: Record<string, string> }) => Promise<NextResponse>
) {
  return withApiErrorHandling(handler);
} 
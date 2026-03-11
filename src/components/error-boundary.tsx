'use client';

import React, { Component, ReactNode } from 'react';
import { handleClientError } from '@/lib/error-handler';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  context?: {
    userId?: string;
    page?: string;
    component?: string;
  };
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary 捕获到错误:', error, errorInfo);
    
    // 发送错误到飞书
    handleClientError(error, {
      ...this.props.context,
      page: this.props.context?.page || window?.location?.pathname,
      component: this.props.context?.component || 'Unknown Component',
    });
  }

  render() {
    if (this.state.hasError) {
      // 使用自定义fallback或默认错误UI
      return this.props.fallback || (
        <div className="min-h-[200px] flex items-center justify-center">
          <div className="text-center space-y-4">
            <div className="text-6xl">🔧</div>
            <h2 className="text-xl font-semibold text-gray-800">出现了一些问题</h2>
            <p className="text-gray-600">我们已经收到错误报告，正在处理中...</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// 便捷的HOC
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  context?: {
    userId?: string;
    page?: string;
    component?: string;
  }
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary context={context}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
} 
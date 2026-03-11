// 调试工具 - 用于检测和修复服务器环境问题

export interface DebugInfo {
  environment: 'client' | 'server';
  timestamp: string;
  userAgent?: string;
  localStorage: {
    available: boolean;
    userInfo?: string;
  };
  userState: {
    user: any;
    isLoggedIn: boolean;
    isInitialized: boolean;
  };
}

export function getDebugInfo(): DebugInfo {
  const isClient = typeof window !== 'undefined';
  
  return {
    environment: isClient ? 'client' : 'server',
    timestamp: new Date().toISOString(),
    userAgent: isClient ? window.navigator.userAgent : undefined,
    localStorage: {
      available: isClient,
      userInfo: isClient ? localStorage.getItem('userInfo') || undefined : undefined,
    },
    userState: {
      user: null, // 这个需要在组件中传入
      isLoggedIn: false,
      isInitialized: false,
    }
  };
}

export function logDebugInfo(info: DebugInfo, context: string = '') {
  console.group(`🔍 调试信息 ${context}`);
  console.log('环境:', info.environment);
  console.log('时间:', info.timestamp);
  console.log('User Agent:', info.userAgent);
  console.log('localStorage 可用:', info.localStorage.available);
  console.log('localStorage 用户信息:', info.localStorage.userInfo);
  console.log('用户状态:', info.userState);
  console.groupEnd();
}

export function validateUserData(userData: any): boolean {
  if (!userData) return false;
  
  const requiredFields = ['id', 'phone', 'uuid', 'isLoggedIn'];
  const hasAllFields = requiredFields.every(field => userData.hasOwnProperty(field));
  
  if (!hasAllFields) {
    console.warn('用户数据缺少必要字段:', { userData, requiredFields });
    return false;
  }
  
  if (userData.isLoggedIn !== true) {
    console.warn('用户登录状态不正确:', userData.isLoggedIn);
    return false;
  }
  
  return true;
}

export function forceReloadUserData(): void {
  if (typeof window === 'undefined') return;
  
  console.log('🔄 强制重新加载用户数据');
  
  // 清除可能损坏的数据
  localStorage.removeItem('userInfo');
  
  // 重新加载页面
  window.location.reload();
}

export function checkServerEnvironment(): void {
  const isClient = typeof window !== 'undefined';
  const isServer = !isClient;
  
  console.log('🌐 环境检测:');
  console.log('- 是否客户端:', isClient);
  console.log('- 是否服务器端:', isServer);
  console.log('- 当前时间:', new Date().toISOString());
  
  if (isClient) {
    console.log('- localStorage 可用:', !!window.localStorage);
    console.log('- sessionStorage 可用:', !!window.sessionStorage);
    console.log('- User Agent:', window.navigator.userAgent);
  }
} 
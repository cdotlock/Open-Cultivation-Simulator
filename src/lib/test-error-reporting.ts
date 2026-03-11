/**
 * 测试错误报告功能
 * 这个文件可以用来快速测试飞书告警是否正常工作
 */

import { handleServerError, handleActionError, handleDatabaseError } from './server-error-handler';
import { dbOperations } from './db-error-wrapper';

/**
 * 测试基本错误报告
 */
export async function testBasicErrorReporting() {
  console.log('测试基本错误报告...');
  
  try {
    throw new Error('这是一个测试错误 - 基本报告');
  } catch (error) {
    await handleServerError(
      error as Error,
      {
        path: '/test-basic-error',
        method: 'GET',
        userAgent: 'Test-Agent/1.0',
        ip: '127.0.0.1',
      }
    );
  }
  
  console.log('基本错误报告测试完成');
}

/**
 * 测试Server Action错误报告
 */
export async function testActionErrorReporting() {
  console.log('测试Server Action错误报告...');
  
  try {
    throw new Error('这是一个测试错误 - Server Action');
  } catch (error) {
    await handleActionError(
      error as Error,
      'testAction',
      'test-user-123'
    );
  }
  
  console.log('Server Action错误报告测试完成');
}

/**
 * 测试数据库错误报告
 */
export async function testDatabaseErrorReporting() {
  console.log('测试数据库错误报告...');
  
  try {
    // 模拟数据库操作失败
    await dbOperations.create(async () => {
      throw new Error('模拟数据库插入失败');
    }, 'test_table');
  } catch (error) {
    console.log('数据库错误已被正确处理和报告');
  }
  
  console.log('数据库错误报告测试完成');
}

/**
 * 测试复杂错误场景
 */
export async function testComplexErrorScenario() {
  console.log('测试复杂错误场景...');
  
  try {
    // 模拟一个包含堆栈信息的复杂错误
    const nestedFunction = () => {
      const deepFunction = () => {
        throw new Error('深层嵌套函数中的错误');
      };
      deepFunction();
    };
    
    nestedFunction();
  } catch (error) {
    await handleServerError(
      error as Error,
      {
        path: '/complex-test',
        method: 'POST',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.100',
      }
    );
  }
  
  console.log('复杂错误场景测试完成');
}

/**
 * 运行所有测试
 */
export async function runAllErrorTests() {
  console.log('开始运行所有错误报告测试...');
  console.log('注意: 这些测试会发送真实的飞书告警消息!');
  
  await testBasicErrorReporting();
  await new Promise(resolve => setTimeout(resolve, 1000)); // 避免发送过快
  
  await testActionErrorReporting();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testDatabaseErrorReporting();
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testComplexErrorScenario();
  
  console.log('所有错误报告测试完成!');
  console.log('请检查您的飞书是否收到了4条告警消息。');
}

/**
 * 测试单个简单错误（用于快速验证）
 */
export async function testSingleError() {
  console.log('发送单个测试错误到飞书...');
  
  try {
    throw new Error('🧪 这是一个测试错误消息 - 用于验证飞书告警功能是否正常工作');
  } catch (error) {
    await handleServerError(
      error as Error,
      {
        path: '/quick-test',
        method: 'GET',
        userAgent: 'Quick-Test/1.0',
        ip: '127.0.0.1',
      }
    );
  }
  
  console.log('测试错误已发送，请检查飞书消息！');
} 
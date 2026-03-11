import { useCallback, useMemo } from 'react';
import { useToast } from './useToast';
import * as characterActions from '../actions/character/action';
import * as userActions from '../actions/user/action';
import { CharacterWithGamePush } from '@/interfaces';
import { useUuid } from './useLogin';

export function useAction() {
  const { showToast } = useToast();
  const uuid = useUuid();

  // 通用错误处理包装函数
  const withErrorHandler = useCallback(<T>(
    promise: Promise<T>,
    errorPrefix = '操作失败'
  ): Promise<T> => {
    return promise.catch(err => {
      const errorMessage = err.toString().slice(7) || '未知错误';
      showToast(`${errorPrefix}: ${errorMessage}`);
      throw err; // 继续抛出错误，让调用者决定如何处理
    });
  }, [showToast]);

  // Character Actions
  const getCharacterById = useCallback((id: number) => {
    return withErrorHandler(
      characterActions.getCharacterById(id),
      '获取角色失败'
    );
  }, [withErrorHandler]);

  const getCharacterListByUuid = useCallback(() => {
    // 只有当uuid存在且不为空时才执行请求
    if (!uuid) {
      return Promise.resolve([]);
    }
    return withErrorHandler(
      userActions.getCharacterListByUuid(uuid),
      '获取角色列表失败'
    );
  }, [withErrorHandler, uuid]);

  const cloneSharedCharacter = useCallback((characterId: number): Promise<CharacterWithGamePush> => {
    if (!uuid) {
      return Promise.reject(new Error('用户未登录'));
    }
    return withErrorHandler(
      characterActions.cloneSharedCharacter(characterId, uuid),
      '导入角色失败'
    );
  }, [withErrorHandler, uuid]);

  // 使用 useMemo 确保返回的对象引用稳定
  return {
    getCharacterById,
    getCharacterListByUuid,
    cloneSharedCharacter,
  }
} 
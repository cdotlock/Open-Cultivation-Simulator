import { useCallback } from 'react';
import { useRecoilState } from 'recoil';

import { characterState, shareCharacterState } from '@/app/store';
import { idToShortUrl, shortUrlToId } from "@/utils/shortUrl"

import useStartGame from "./useStartGame";
import useRoute from './useRoute';
import { useToast } from './useToast';
import { useAction } from './useAction';

export function useCharacterCrud() {
  const { routerTo } = useRoute();

  const setChar = useRecoilState(characterState)[1];
  const [shareCharacterInfo, setShareCharacterInfo] = useRecoilState(shareCharacterState);
  const { startGame } = useStartGame();
  const { showToast } = useToast();
  const { getCharacterById, cloneSharedCharacter } = useAction();

  // Share functionality
  const shortUrl = idToShortUrl(shareCharacterInfo.id);
  const copyLink = `http://mob-ai.cn/${shortUrl}`;

  const shareCharacter = useCallback((characterId: number) => {
    setShareCharacterInfo({
      id: characterId,
      type: "share"
    });
  }, [setShareCharacterInfo]);

  const closeShare = useCallback(() => {
    setShareCharacterInfo({
      id: 0,
      type: undefined
    });
  }, [setShareCharacterInfo]);

  // 获取单个角色并处理
  const handleCharacterSelect = useCallback((id: number, quick = false) => {
    getCharacterById(id)
      .then(res => {
        setChar(res);
        if (quick) {
          startGame();
        } else {
          routerTo("char");
        }
      })
      .catch(() => {}); // 错误已在 useAction 中处理
  }, [setChar, routerTo, startGame, getCharacterById]);

  const handleImportCharacter = useCallback((importChar: string) => {
    if (importChar.length === 6) {
      const characterId = shortUrlToId(importChar);
      cloneSharedCharacter(characterId)
        .then(res => {
          setChar(res);
          routerTo('char');
          showToast('角色导入成功');
          closeShare();
        })
        .catch(() => {}); // 错误已在 useAction 中处理
    }
  }, [setChar, closeShare, routerTo, showToast, cloneSharedCharacter]);

  return {
    handleCharacterSelect,
    shareCharacter,
    handleImportCharacter,
    closeShare,
    shareCharacterInfo,
    copyLink,
    shortUrl
  };
}

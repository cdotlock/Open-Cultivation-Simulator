import { useCallback } from 'react';
import useRoute from './useRoute';
import { startGame as startGameApi } from '@/app/actions/game/action';
import { useRecoilState } from "recoil"
import { characterState, gamePushState, loadingState } from "../store"
import { useToast } from './useToast';
import { GamePushResponse } from '@/interfaces';

const useStartGame = () => {
  const { routerTo } = useRoute();
  const [char] = useRecoilState(characterState)
  const setChar = useRecoilState(characterState)[1]
  const setGamePush = useRecoilState(gamePushState)[1]
  const setLoadingText = useRecoilState(loadingState)[1]
  const { showToast } = useToast()

  const startGame = useCallback(() => {
    if (!char?.id) return;
    setLoadingText([false, "story"]);
    let retryTime = 0
    const mainAction = () => {
      startGameApi(char.id).then((res:GamePushResponse) => {
        setGamePush(res);
        if (res.factionData) {
          setChar((previous) => previous ? { ...previous, factionData: res.factionData } : previous);
        }
        if (res.bondData) {
          setChar((previous) => previous ? { ...previous, bondData: res.bondData } : previous);
        }
        setLoadingText([true, "story"]);
      }).catch(() => {
          showToast("模型调用失败，正在重试。请检查设置中的 API Key、Base URL 与模型名。", 2600)
          if (!retryTime) {
            retryTime++
            return mainAction()
          }
          showToast("仍然无法生成剧情，即将返回角色页。", 3000)
          setTimeout(() => {
            routerTo("char")
          }, 2000)
        })
    }

    mainAction()
    
    routerTo("loading");
  }, [setChar, setGamePush, setLoadingText, showToast,routerTo, char?.id]);

  return { startGame };
};

export default useStartGame;

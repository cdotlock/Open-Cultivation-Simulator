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
        setLoadingText([true, "story"]);
      }).catch(() => {
          showToast("被神秘存在扰乱因果，正在重试", 2000)
          if (!retryTime) {
            retryTime++
            return mainAction()
          }
          showToast("重试失败，意识陷入混沌，即将返回", 3000)
          setTimeout(() => {
            routerTo("char")
          }, 2000)
        })
    }

    mainAction()
    
    routerTo("loading");
  }, [setGamePush, setLoadingText, showToast,routerTo, char?.id]);

  return { startGame };
};

export default useStartGame;

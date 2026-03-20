import { useRecoilState } from 'recoil';
import { loadingState, characterState } from '@/app/store'
import { useCallback } from 'react';
import { useToast } from '../hooks/useToast';
import { createCharacter } from '@/app/actions/character/action'
import useRoute from '../hooks/useRoute';

const useGameController = (uuid: string) => {
  const setLoadingText = useRecoilState(loadingState)[1]
  const setChar = useRecoilState(characterState)[1]
  const { showToast } = useToast()
  const { routerTo } = useRoute()

  const toCreateLoadingPage = useCallback((createForm: string[], trait: string, attributePoints?: { 魅力: number; 神识: number; 身手: number }, spiritRoot?: string) => {
    setLoadingText([false, "char"])

    let retryTime = 0
    const mainAction = () => {
      createCharacter(
        `${createForm[0]}${createForm[1]}`,
        `名为${createForm[0]}${createForm[1]}，身份是${createForm[2]}， 特质是${trait}`,
        uuid,
        attributePoints,
        spiritRoot
      )
        .then(res => {
          if (res) {
            setLoadingText([true, "char"])
            setChar(res)
          }
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
    routerTo("loading")
  }, [routerTo, setChar, setLoadingText, showToast, uuid])

  return { toCreateLoadingPage }
}

export default useGameController

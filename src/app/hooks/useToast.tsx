import { useRecoilState } from "recoil"
import { toastState } from "../store"
import { useCallback } from "react"

export function useToast() {
  const setToastText = useRecoilState(toastState)[1]

  const showToast = useCallback((text: string, delay = 1000) => {
    setToastText(text)
    setTimeout(() => {
      setToastText("")
    }, delay)
  }, [setToastText])

  const hideToast = useCallback(() => {
    setToastText("")
  }, [setToastText])

  return {
    showToast,
    hideToast
  }
}
import { useState, useEffect } from "react"
import { useRecoilState } from "recoil"
import { userState } from "../store"
import { getOrCreateLocalUser } from "../actions/user/action"

export function useLogin() {
  const [user, setUser] = useRecoilState(userState)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const localUser = await getOrCreateLocalUser()
        if (!cancelled) {
          setUser(localUser)
        }
      } catch (error) {
        console.error("初始化本地用户失败:", error)
      } finally {
        if (!cancelled) {
          setIsInitialized(true)
        }
      }
    }

    bootstrap()

    return () => {
      cancelled = true
    }
  }, [setUser])

  const logout = () => {
    console.info("单机版固定为本地用户，不提供退出登录。")
  }

  const checkLogin = (): void =>  {
    if (isInitialized && !user?.uuid) {
      console.warn("本地用户尚未初始化完成")
    }
  }

  return {
    user,
    setUser,
    isLoggedIn: !!user?.isLoggedIn,
    needsLogin: isInitialized && user === null,
    isInitialized, // 添加初始化状态
    logout,
    checkLogin
  }
}

// 为了兼容现有代码，保留useUuid函数
export function useUuid() {
  const { user } = useLogin()
  return user?.uuid || ""
}

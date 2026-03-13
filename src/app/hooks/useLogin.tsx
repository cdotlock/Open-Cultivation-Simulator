import { useState, useEffect } from "react"
import { useRecoilState, useRecoilValue } from "recoil"
import { userState } from "../store"
import { getOrCreateLocalUser } from "../actions/user/action"

type LocalUser = Awaited<ReturnType<typeof getOrCreateLocalUser>>;

let cachedLocalUser: LocalUser | null = null;
let localUserPromise: Promise<LocalUser> | null = null;

async function ensureLocalUser() {
  if (cachedLocalUser) {
    return cachedLocalUser;
  }

  if (!localUserPromise) {
    localUserPromise = getOrCreateLocalUser()
      .then((localUser) => {
        cachedLocalUser = localUser;
        return localUser;
      })
      .finally(() => {
        localUserPromise = null;
      });
  }

  return localUserPromise;
}

export function useLogin() {
  const [user, setUser] = useRecoilState(userState)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    if (user) {
      setIsInitialized(true)
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      try {
        const localUser = await ensureLocalUser()
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
  }, [setUser, user])

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
  const user = useRecoilValue(userState)
  return user?.uuid || ""
}

'use client'

import { FC, useEffect } from "react"
import { RecoilRoot } from "recoil"
import { useLogin } from "./hooks/useLogin"
import useRoute from "./hooks/useRoute"
import { useRouter } from "next/navigation"
import ToastProvider from "./components/ToastProvider"
import { $img } from "../utils/index"
import Image from "next/image"


const CustomHeader = () => {
  const router = useRouter()
  const { user, isLoggedIn, isInitialized } = useLogin()
  const {routerTo} = useRoute()

  useEffect(() => {
    if (typeof window !== 'undefined' && user) {
      localStorage.setItem("userInfo", JSON.stringify(user));
    }
  }, [user]); 

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!user) {
        localStorage.removeItem("userInfo");
      }
    }
  }, [user]);

  const handleLogoClick = () => {
    routerTo("home")
  }
  
  return <>
    <header className="w-full h-[48px] fixed z-50 top-0 left-0 flex justify-between items-center p-[8px_16px] bg-white">
      <Image
        width={596}
        height={920}
        unoptimized
        className="w-[71px] h-[32px] cursor-pointer"
        src={$img("logo2")}
        alt="logo2"
        onClick={handleLogoClick}
      />
      {/* 登录状态显示 - 只在客户端加载完成后显示 */}
      <div className="flex items-center gap-3 text-sm">
        {isInitialized ? (
          isLoggedIn && user ? (
            <>
              <span className="text-[#6b5738]">{user.phone || "本地洞府"}</span>
              <button
                onClick={() => router.push("/pages/settings")}
                className="rounded-full border border-[#8e6a38] px-3 py-1 text-[#5e4523] bg-[#f9f0de]"
              >
                设置
              </button>
            </>
          ) : (
            <button
              onClick={() => router.push("/pages/settings")}
              className="rounded-full border border-[#8e6a38] px-3 py-1 text-[#5e4523] bg-[#f9f0de]"
            >
              设置
            </button>
          )
        ) : (
          <button
            className="text-blue-600 hover:text-blue-800 font-medium opacity-0"
            disabled
          >
            设置
          </button>
        )}
      </div>
    </header>
    {/* placeholder */}
    <div className="w-full h-[48px] bg-white" />
  </>
}

const ClientRoot: FC<{ children: React.ReactNode }> = (props) => {
  return (
    <RecoilRoot override={true}>
      <ToastProvider>
        <div className="w-screen h-screen overflow-hidden bg-white">
          <CustomHeader />
          <div
            style={{
              height: `calc(100vh - 48px)`,
            }}
            className="w-screen overflow-y-scroll">
            {props.children}
          </div>
        </div>
      </ToastProvider>
    </RecoilRoot>
  )
}

export default ClientRoot

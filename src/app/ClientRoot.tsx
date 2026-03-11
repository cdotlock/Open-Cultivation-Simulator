'use client'

import { FC, useEffect, useState } from "react"
import { RecoilRoot } from "recoil"
import { useLogin } from "./hooks/useLogin"
import useRoute from "./hooks/useRoute"
import { useRouter } from "next/navigation"
import ToastProvider from "./components/ToastProvider"
import { $img } from "../utils/index"
import Image from "next/image"

type DesktopPreviewSize = {
  width: number
  height: number
}

const PREVIEW_VIEWPORT = {
  width: 390,
  height: 844,
}

const CustomHeader = () => {
  const router = useRouter()
  const { user, isLoggedIn, isInitialized } = useLogin()
  const { routerTo } = useRoute()

  useEffect(() => {
    if (typeof window !== "undefined" && user) {
      localStorage.setItem("userInfo", JSON.stringify(user))
    }
  }, [user])

  useEffect(() => {
    if (typeof window !== "undefined" && !user) {
      localStorage.removeItem("userInfo")
    }
  }, [user])

  const handleLogoClick = () => {
    routerTo("home")
  }

  return (
    <>
      <header className="fixed left-0 top-0 z-50 flex h-[48px] w-full items-center justify-between bg-white p-[8px_16px]">
        <Image
          width={596}
          height={920}
          unoptimized
          className="h-[32px] w-[71px] cursor-pointer"
          src={$img("logo2")}
          alt="logo2"
          onClick={handleLogoClick}
        />
        <div className="flex items-center gap-3 text-sm">
          {isInitialized ? (
            isLoggedIn && user ? (
              <>
                <span className="text-[#6b5738]">{user.phone || "本地洞府"}</span>
                <button
                  onClick={() => router.push("/pages/settings")}
                  className="rounded-full border border-[#8e6a38] bg-[#f9f0de] px-3 py-1 text-[#5e4523]"
                >
                  设置
                </button>
              </>
            ) : (
              <button
                onClick={() => router.push("/pages/settings")}
                className="rounded-full border border-[#8e6a38] bg-[#f9f0de] px-3 py-1 text-[#5e4523]"
              >
                设置
              </button>
            )
          ) : (
            <button className="font-medium opacity-0" disabled>
              设置
            </button>
          )}
        </div>
      </header>
      <div className="h-[48px] w-full bg-white" />
    </>
  )
}

const MobileAppShell: FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RecoilRoot override={true}>
      <ToastProvider>
        <div className="h-screen w-screen overflow-hidden bg-white">
          <CustomHeader />
          <div
            style={{
              height: `calc(100vh - 48px)`,
            }}
            className="w-screen overflow-y-scroll"
          >
            {children}
          </div>
        </div>
      </ToastProvider>
    </RecoilRoot>
  )
}

const ClientRoot: FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMounted, setIsMounted] = useState(false)
  const [showDesktopPreview, setShowDesktopPreview] = useState(false)
  const [iframeSrc, setIframeSrc] = useState("/")
  const [previewSize, setPreviewSize] = useState<DesktopPreviewSize>({ width: 430, height: 932 })

  useEffect(() => {
    const evaluateMode = () => {
      const params = new URLSearchParams(window.location.search)
      const embeddedPreview = params.get("mobilePreview") === "1"
      const isDesktop = window.innerWidth >= 768 && !embeddedPreview

      if (isDesktop) {
        const safeHorizontalPadding = 32
        const safeVerticalPadding = 32
        const availableWidth = Math.max(320, window.innerWidth - safeHorizontalPadding)
        const availableHeight = Math.max(640, window.innerHeight - safeVerticalPadding)
        const aspect = PREVIEW_VIEWPORT.width / PREVIEW_VIEWPORT.height
        const widthByHeight = availableHeight * aspect
        const width = Math.min(PREVIEW_VIEWPORT.width, availableWidth, widthByHeight)
        const height = width / aspect

        params.set("mobilePreview", "1")
        const query = params.toString()
        setIframeSrc(`${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
        setPreviewSize({ width, height })
      }

      setShowDesktopPreview(isDesktop)
      setIsMounted(true)
    }

    evaluateMode()
    window.addEventListener("resize", evaluateMode)
    return () => window.removeEventListener("resize", evaluateMode)
  }, [])

  if (!isMounted) {
    return null
  }

  if (showDesktopPreview) {
    return (
      <div className="flex min-h-screen w-full items-center justify-center overflow-auto bg-[#d9cfbf] bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.82),_rgba(228,216,196,0.95)_48%,_rgba(210,192,164,0.96))] p-4">
        <iframe
          title="mobile-preview"
          src={iframeSrc}
          className="border-0 bg-white shadow-[0_16px_40px_rgba(66,49,28,0.12)]"
          style={{
            width: `${previewSize.width}px`,
            height: `${previewSize.height}px`,
          }}
        />
      </div>
    )
  }

  return <MobileAppShell>{children}</MobileAppShell>
}

export default ClientRoot

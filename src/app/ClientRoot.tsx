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

const PREVIEW_CANVAS = {
  width: 430,
  height: 932,
}

function getDesktopPreviewSize(viewportWidth: number, viewportHeight: number): DesktopPreviewSize {
  const horizontalPadding = Math.max(24, Math.min(72, viewportWidth * 0.06))
  const verticalPadding = Math.max(20, Math.min(48, viewportHeight * 0.05))
  const availableWidth = Math.max(320, viewportWidth - horizontalPadding * 2)
  const availableHeight = Math.max(540, viewportHeight - verticalPadding * 2)
  const scaleByWidth = availableWidth / PREVIEW_CANVAS.width
  const scaleByHeight = availableHeight / PREVIEW_CANVAS.height
  const scale = Math.min(scaleByWidth, scaleByHeight, 1.08)

  return {
    width: Math.round(PREVIEW_CANVAS.width * scale),
    height: Math.round(PREVIEW_CANVAS.height * scale),
  }
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
  const [previewSize, setPreviewSize] = useState<DesktopPreviewSize>(PREVIEW_CANVAS)

  useEffect(() => {
    const evaluateMode = () => {
      const params = new URLSearchParams(window.location.search)
      const embeddedPreview = params.get("mobilePreview") === "1"
      const isDesktop = window.innerWidth >= 768 && !embeddedPreview

      if (isDesktop) {
        params.set("mobilePreview", "1")
        const query = params.toString()
        setIframeSrc(`${window.location.origin}${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`)
        setPreviewSize(getDesktopPreviewSize(window.innerWidth, window.innerHeight))
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
      <div className="flex min-h-screen w-full items-center justify-center overflow-auto bg-[#ddd1bc] px-6 py-5">
        <div
          className="overflow-hidden rounded-[28px] border border-[rgba(112,82,44,0.18)] bg-[#f7f1e3] shadow-[0_24px_60px_rgba(42,29,15,0.14)]"
          style={{
            width: `${previewSize.width}px`,
            height: `${previewSize.height}px`,
          }}
        >
          <iframe
            title="mobile-preview"
            src={iframeSrc}
            className="h-full w-full border-0 bg-white"
          />
        </div>
      </div>
    )
  }

  return <MobileAppShell>{children}</MobileAppShell>
}

export default ClientRoot

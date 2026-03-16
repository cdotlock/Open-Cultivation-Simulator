'use client'

import { FC, useEffect, useState } from "react"
import { RecoilRoot } from "recoil"
import ToastProvider from "./components/ToastProvider"

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
  const scale = Math.min(scaleByWidth, scaleByHeight, 1.16)

  return {
    width: Math.round(PREVIEW_CANVAS.width * scale),
    height: Math.round(PREVIEW_CANVAS.height * scale),
  }
}

const MobileAppShell: FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <RecoilRoot override={true}>
      <ToastProvider>
        <div className="min-h-screen w-full overflow-x-hidden overflow-y-auto bg-[#F2EBD9]">
          {children}
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
      <div className="relative min-h-screen w-full overflow-hidden bg-[radial-gradient(circle_at_top,rgba(255,247,232,0.96),rgba(226,210,183,0.9)_48%,rgba(205,188,160,0.96))]">
        <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(255,255,255,0.2),transparent_42%,rgba(99,73,38,0.08))]" />
        <div className="relative mx-auto flex min-h-screen w-full items-center justify-center px-5 py-6">
          <div className="relative">
            <div className="absolute inset-[-20px] rounded-[44px] bg-[radial-gradient(circle,rgba(217,184,126,0.3),rgba(217,184,126,0)_72%)] blur-[34px]" />
            <div className="relative overflow-hidden rounded-[38px] border border-[rgba(112,82,44,0.14)] bg-[linear-gradient(180deg,rgba(247,241,227,0.98),rgba(240,230,212,0.94))] p-3 shadow-[0_34px_80px_rgba(42,29,15,0.18)]">
              <div
                className="overflow-hidden rounded-[30px] border border-[rgba(112,82,44,0.14)] bg-[#F2EBD9]"
                style={{
                  width: `${previewSize.width}px`,
                  height: `${previewSize.height}px`,
                }}
              >
                <iframe
                  title="mobile-preview"
                  src={iframeSrc}
                  className="h-full w-full border-0 bg-[#F2EBD9]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return <MobileAppShell>{children}</MobileAppShell>
}

export default ClientRoot

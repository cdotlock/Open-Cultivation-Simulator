'use client'

import PageHome from "./PageHome";
import PageCreateChar from "./PageCreateChar";
import PageLoading from "./PageLoading";
import PageChar from './PageChar';
import PageStory from './PageStory';
import { useRecoilState, useRecoilValue } from 'recoil';
import { characterState, gamePushState, pageState, pages, PageType } from '@/app/store'
import { useEffect, useState } from "react";
import Image from "next/image";

import { useCharacterCrud } from "../hooks/charCrud";
import { useAction } from "../hooks/useAction";
import { $img } from "@/utils";

export default function PageLayout() {
  const [page, setPage] = useRecoilState(pageState)
  const [char, setChar] = useRecoilState(characterState)
  const gamePush = useRecoilValue(gamePushState)
  const [mounted, setMounted] = useState(false)
  const [urlBootstrapped, setUrlBootstrapped] = useState(false)
  const { handleImportCharacter } = useCharacterCrud()
  const { getCharacterById } = useAction()

  // 防止 hydration 错误
  useEffect(() => {
    setMounted(true)
  }, [])

  // 移除自动登录检查，让主页可以不登录访问
  // useEffect(() => {
  //   if (needsLogin && page !== "login") {
  //     routerTo("login")
  //   }
  // }, [needsLogin, page, routerTo])

  useEffect(() => {
    if (!mounted || urlBootstrapped) {
      return
    }

    let cancelled = false

    const syncFromUrl = async () => {
      const search = new URLSearchParams(window.location.search)
      const importId = search.get("id")
      const requestedView = search.get("view")
      const requestedCharacterId = Number(search.get("characterId") || "")
      const nextSearch = new URLSearchParams(search)

      if (importId) {
        nextSearch.delete("id")
        const nextUrl = nextSearch.toString()
          ? `${window.location.pathname}?${nextSearch.toString()}`
          : window.location.pathname
        window.history.replaceState({}, "", nextUrl)
        handleImportCharacter(importId)
      }

      if (Number.isFinite(requestedCharacterId) && requestedCharacterId > 0 && char?.id !== requestedCharacterId) {
        try {
          const nextCharacter = await getCharacterById(requestedCharacterId)
          if (!cancelled) {
            setChar(nextCharacter)
          }
        } catch {
          if (!cancelled) {
            setPage("home")
          }
        }
      }

      if (!cancelled && requestedView && pages.includes(requestedView as PageType)) {
        const nextPage = requestedView as PageType
        setPage(nextPage === "story" && !gamePush ? "char" : nextPage)
      }

      if (!cancelled) {
        setUrlBootstrapped(true)
      }
    }

    syncFromUrl()

    return () => {
      cancelled = true
    }
  }, [char?.id, gamePush, getCharacterById, handleImportCharacter, mounted, setChar, setPage, urlBootstrapped]);

  useEffect(() => {
    if (!mounted || !urlBootstrapped) {
      return
    }

    const safePage = page === "story" && !gamePush ? "char" : page
    const nextSearch = new URLSearchParams(window.location.search)

    nextSearch.delete("view")
    nextSearch.delete("characterId")

    if (safePage !== "home") {
      nextSearch.set("view", safePage)
    }

    if (char?.id && safePage !== "home" && safePage !== "create") {
      nextSearch.set("characterId", String(char.id))
    }

    const nextQuery = nextSearch.toString()
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname
    const currentUrl = `${window.location.pathname}${window.location.search}`

    if (nextUrl !== currentUrl) {
      window.history.replaceState({}, "", nextUrl)
    }
  }, [char?.id, gamePush, mounted, page, urlBootstrapped]);

  return (
    <div className="flex flex-col items-center justify-start min-h-[calc(100vh-48px)] overflow-hidden bg-[#F2EBD9]">
      <div className="w-full relative">
        <Image
          unoptimized
          width={200}
          height={200}
          className="w-full absolute top-0 left-0 mix-blend-overlay"
          src={$img("bg")}
          alt="bg"
        />
        <div className="relative z-10">
          {page === "home" && <PageHome />}
          {page === "create" && <PageCreateChar />}
          {page === "loading" && <PageLoading />}
          {page === "char" && <PageChar />}
          {page === "story" && <PageStory />}
        </div>
      </div>
    </div>
  )
}

'use client'

import PageHome from "./PageHome";
import PageCreateChar from "./PageCreateChar";
import PageLoading from "./PageLoading";
import PageChar from './PageChar';
import PageStory from './PageStory';
import { useRecoilState } from 'recoil';
import { pageState } from '@/app/store'
import { useEffect, useState } from "react";
import Image from "next/image";

import { useCharacterCrud } from "../hooks/charCrud";
import { $img } from "@/utils";

export default function PageLayout() {
  const [page] = useRecoilState(pageState)
  const [mounted, setMounted] = useState(false)
  const { handleImportCharacter } = useCharacterCrud()


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
    // 只在客户端执行
    if (!mounted) return
    
    // 获取 URL 参数
    const search = new URLSearchParams(window.location.search);
    const id = search.get('id');
    
    if (id) {
      // 清空 url 参数且不刷新
      window.history.replaceState({}, '', `${window.location.pathname}`);
      handleImportCharacter(id)
    }
  }, [handleImportCharacter, mounted]);

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

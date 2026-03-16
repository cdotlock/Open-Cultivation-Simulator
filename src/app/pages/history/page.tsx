"use client";

import { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { useRecoilState } from "recoil";
import { characterState } from "@/app/store";
import Image from "next/image";
import { $img } from "@/utils";
import { useLogin } from "@/app/hooks/useLogin";
import { useRouter } from "next/navigation";
import { GamePush } from "@/app/actions/generated/prisma";
import { CharStatusBar } from "@/app/components/CharStatusBar";
import { CharacterStatusSchema } from "@/interfaces/schemas";
import { formatStatusWithMax } from "@/app/actions/character/constants";
import { CharacterWithGamePush } from "@/interfaces";
import { StoryPushType } from "@/interfaces/schemas";

const extractGameInfo = (gamePush?: { info: unknown; choice?: string }): {
  playerChoice?: string;
  currentObjective?: string;
  storyline?: string;
} => {
  if (!gamePush?.info) return {};

  try {
    const info = gamePush.info as StoryPushType;
    return {
      playerChoice: gamePush.choice,
      currentObjective: info.节点要素?.基础信息?.当前任务,
      storyline: info.节点要素?.剧情要素?.剧情
    };
  } catch (error) {
    console.error("解析游戏信息失败:", error);
    return {};
  }
};

interface StorySegment {
  id: number;
  characterId: number;
  gamePushId: number;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  gamePush?: {
    info: unknown;
    choice?: string;
  };
}

interface StorySegmentsResponse {
  segments: StorySegment[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  totalPages: number;
  gamePush: Partial<GamePush>;
}

export default function PageHistory() {
  const [char] = useRecoilState<CharacterWithGamePush | undefined>(characterState);
  const { isLoggedIn, isInitialized } = useLogin();
  const router = useRouter();

  const [segments, setSegments] = useState<StorySegment[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  const pageSize = 5;

  const rawStatus = char?.currentPush?.status;
  let parsedStatus: ReturnType<typeof formatStatusWithMax> | undefined;

  if (rawStatus && typeof rawStatus === 'object') {
    try {
      const validatedStatus = CharacterStatusSchema.parse(rawStatus);
      parsedStatus = formatStatusWithMax(validatedStatus);
    } catch (error) {
      console.error("状态数据格式错误:", error);
    }
  }

  useEffect(() => {
    if (isInitialized && (!char?.id || !parsedStatus)) {
      router.push("/");
    }
  }, [char?.id, isInitialized, parsedStatus, router]);

  const loadSegments = useCallback(async (page: number, reset: boolean = false) => {
    if (!char?.id) {
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/story-segments?characterId=${char.id}&page=${page}&pageSize=${pageSize}`);

      if (!response.ok) {
        throw new Error('获取历史数据失败');
      }

      const data: StorySegmentsResponse = await response.json();

      if (reset) {
        setSegments(data.segments);
      } else {
        setSegments(prev => [...prev, ...data.segments]);
      }

      setHasMore(page < data.totalPages);
      setCurrentPage(page);
    } catch (error) {
      console.error("加载历史数据失败:", error);
    } finally {
      setLoading(false);
      setIsInitialLoading(false);
    }
  }, [char?.id, pageSize]);

  useEffect(() => {
    if (char?.id && isInitialized && isLoggedIn && segments.length === 0) {
      loadSegments(1, true);
    }
  }, [char?.id, isInitialized, isLoggedIn, loadSegments, segments.length]);

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadSegments(currentPage + 1, false);
    }
  }, [hasMore, loading, currentPage, loadSegments]);

  useEffect(() => {
    const handleScroll = () => {
      const isScrollable = document.documentElement.scrollHeight > window.innerHeight;
      if (isScrollable && window.innerHeight + document.documentElement.scrollTop >= document.documentElement.offsetHeight - 100) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  if (!isInitialized || !isLoggedIn || !char || !parsedStatus) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-start overflow-hidden bg-[#F2EBD9]">
      <div className="relative min-h-screen w-full">
        <Image
          unoptimized
          width={200}
          height={200}
          className="absolute left-0 top-0 w-full mix-blend-overlay"
          src={$img("bg")}
          alt="bg"
        />

        <CharStatusBar current={parsedStatus}/>

        <div className="relative z-10 mx-auto w-full max-w-[980px] px-4 py-6 xl:px-6">
          <div className="rounded-[32px] border border-[#d8c59c] bg-[rgba(250,242,226,0.9)] p-5 shadow-[0_18px_40px_rgba(83,55,18,0.08)] xl:p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[26px] text-[#3a2b1a]">前尘回顾</div>
                <div className="mt-1 text-[13px] text-[#6f5a3b]">逐回记录你在修仙路上的选择、任务与剧情转折。</div>
              </div>
              <button
                onClick={() => router.push("/")}
                className="rounded-full border border-[#8e6a38] bg-[#fff6e7] px-4 py-2 text-sm text-[#5f4525]"
              >
                返回首页
              </button>
            </div>

            <div className="mt-6 space-y-[16px]">
              {isInitialLoading ? (
                <div className="py-8 text-center text-[#8B4513]">加载历史数据中...</div>
              ) : segments.length === 0 ? (
                <div className="py-8 text-center">
                  <Card className="bg-white/80 p-6 backdrop-blur-sm">
                    <div className="text-[#8B4513] text-lg">暂无历史记录</div>
                    <div className="mt-2 text-gray-600">开始你的修仙之旅，创造属于你的传奇故事。</div>
                  </Card>
                </div>
              ) : (
                <>
                  {segments.map((segment, index) => {
                    const { playerChoice, currentObjective, storyline } = extractGameInfo(segment.gamePush);

                    return (
                      <div key={segment.id} className="rounded-[24px] border border-[#dcc9a4] bg-[rgba(255,250,242,0.78)] px-4 py-4 xl:px-5">
                        {playerChoice && index !== 0 ? (
                          <div className="text-[15px] leading-relaxed text-[#3b2c1b]">{playerChoice}</div>
                        ) : null}

                        {currentObjective && index !== 0 ? (
                          <div className="mb-5 mt-1 text-[12px] leading-relaxed text-[#7a6542]">{currentObjective}</div>
                        ) : null}

                        {storyline ? (
                          <div
                            className="story-prose text-[16px] leading-[2] text-[#2d2117]"
                            dangerouslySetInnerHTML={{ __html: storyline }}
                          />
                        ) : null}
                      </div>
                    );
                  })}

                  {hasMore ? (
                    <div className="py-4 text-center">
                      {loading ? (
                        <div className="text-[#8B4513]">加载更多中...</div>
                      ) : (
                        <button
                          onClick={loadMore}
                          className="rounded-full bg-[#8B4513] px-6 py-2 text-white"
                        >
                          加载更多
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="py-4 text-center text-gray-500">已加载全部历史记录</div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

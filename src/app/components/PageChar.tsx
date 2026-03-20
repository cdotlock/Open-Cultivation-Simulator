"use client";

import { useRecoilState } from "recoil"
import { $img } from "@/utils"
import { characterState } from "../store"
import { CharacterDescriptionType, CharacterStatusType } from "@/interfaces/schemas"
import { ReactNode, useEffect, useState } from "react"
import { trackEvent, trackPageView, track, UmamiEvents } from "@/lib/analytics/umami"
import useRoute from "../hooks/useRoute"
import charConfig from "./const/char"
import useStartGame from "../hooks/useStartGame"
import { useCharacterCrud } from "../hooks/charCrud"
import { useRouter } from "next/navigation"
import { deleteCharacter } from '../actions/character/action';
import { useUuid } from "../hooks/useLogin";
import { FactionPortalCard } from "./faction/FactionPanels";
import { BondPortalCard } from "./bond/BondPanels";

function DetailSection({
  titleSrc,
  titleAlt,
  children,
}: {
  titleSrc: string;
  titleAlt: string;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 rounded-[24px] border border-[rgba(242,228,195,0.14)] bg-[linear-gradient(180deg,rgba(92,53,36,0.56),rgba(52,31,20,0.62))] px-5 py-5 shadow-[0_18px_32px_rgba(22,12,8,0.12)]">
      <img className="mx-auto w-[58%] max-w-[220px]" src={titleSrc} alt={titleAlt} />
      <div className="mt-4 text-[13px] leading-[1.9] text-[#F2E7D0]">{children}</div>
    </section>
  );
}

export default function PageChar() {
  const { routerTo } = useRoute()
  const { startGame } = useStartGame()
  const [char, setChar] = useRecoilState(characterState)
  const { handleCharacterSelect } = useCharacterCrud()
  const router = useRouter()
  const uuid = useUuid();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!char) {
      routerTo("home")
      return
    }
    trackPageView('/char')
  }, [char, routerTo, setChar])

  useEffect(() => {
    if (!char?.id || char.factionData) {
      return;
    }

    fetch(`/api/faction-snapshot?characterId=${char.id}`)
      .then((response) => response.json())
      .then((result) => {
        if (result) {
          setChar((previous) => previous ? { ...previous, factionData: result } : previous);
        }
      })
      .catch(() => {});
  }, [char?.factionData, char?.id, setChar]);

  useEffect(() => {
    if (!char?.id || char.bondData) {
      return;
    }

    fetch(`/api/bond-snapshot?characterId=${char.id}`)
      .then((response) => response.json())
      .then((result) => {
        if (result) {
          setChar((previous) => previous ? { ...previous, bondData: result } : previous);
        }
      })
      .catch(() => {});
  }, [char?.bondData, char?.id, setChar]);

  if (!char) {
    return <></>
  }

  const charInfo = char.description as CharacterDescriptionType

  // 检查角色是否有currentPush，如果没有说明是复活后的角色
  if (!char.currentPush) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-white font-family-song">
        <div className="text-center">
          <div className="text-2xl mb-4">角色已复活</div>
          <div className="text-lg mb-6">你的角色已经复活，可以重新开始游戏</div>
          <button
            onClick={() => routerTo('home')}
            className="px-6 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const charStatus = char.currentPush.status as CharacterStatusType
  const factionData = char.factionData;
  const bondData = char.bondData;

  // 提取身份信息
  const identityMatch = char.createPrompt.match(/身份是(.*?)，/)
  const identity = identityMatch ? identityMatch[1] : ""

  const attr = charInfo.初始属性.灵根
  const config = charConfig[attr] || charConfig["土"]
  const hasGeneratedCover = Boolean(char.cover)
  const cover = hasGeneratedCover ? char.cover : config.backgroundImage
  const openWorldPage = () => {
    router.push(`/pages/world?characterId=${char.id}`);
  };
  const openBondPage = () => {
    router.push(`/pages/bonds?characterId=${char.id}`);
  };
  const openBondChatPage = () => {
    if (!bondData?.activeDaoLyu) {
      return;
    }
    router.push(`/pages/bond-chat?characterId=${char.id}&bondId=${bondData.activeDaoLyu.id}`);
  };

  // Add delete handler
  const handleDelete = async () => {
    await deleteCharacter(char.id, uuid);
    setDeleteConfirm(false);
    routerTo("home");
    try {
      trackEvent(UmamiEvents.删除角色, { character_id: char.id })
    } catch {}
  };

  return (
    <div style={{ background: `left -6.65% / 15% url(${$img('mask-repect')}), ${config.bg1}` }}
      className="relative flex min-h-screen w-full flex-col items-center font-family-song text-white">
      <div className="relative w-full">
        <div className="relative aspect-[0.98] w-full overflow-hidden">
          <img className="absolute left-0 top-0 h-full w-full object-cover" src={cover} alt="cover" />
          <img className="absolute left-0 top-0 z-20 h-full w-full object-cover" src={config.backgroundImage} alt="newCharBg" />
          {!hasGeneratedCover && (
            <div className="absolute inset-0 z-20 flex items-start justify-center pt-[10vw]">
              <div className="relative w-[54vw] max-w-[208px]">
                <img className="w-full opacity-90 mix-blend-screen" src={$img('circle')} alt="fallback-circle" />
                <img className="absolute left-1/2 top-[8%] w-[40%] -translate-x-1/2" src={config.url} alt="fallback-root" />
              </div>
            </div>
          )}

          <div className="absolute inset-x-[18px] bottom-[18px] z-30 rounded-[26px] border border-[rgba(242,228,195,0.22)] bg-[linear-gradient(180deg,rgba(87,48,31,0.8),rgba(45,25,16,0.9))] px-4 py-5 shadow-[0_18px_42px_rgba(20,10,6,0.28)]">
            <div className="flex flex-col items-center text-center">
              <div className="rounded-full border border-[rgba(242,228,195,0.28)] px-4 py-[6px] text-[12px] text-[#E9E0B2]">
                「{attr}」
              </div>
              <div className="mt-3 text-[28px] leading-[1.02] text-[#FFF8ED]">{charInfo.角色名称}</div>
              <div className="mt-[8px] max-w-[240px] text-[13px] leading-[1.7] text-[#F0E5CD]">{identity}</div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[#E9E0B2]">
              <div className="rounded-[16px] bg-[rgba(255,247,229,0.08)] px-2 py-3">
                <div className="text-[10px] tracking-[0.14em] text-[#F0E5CD]">魅力</div>
                <div className="mt-[8px] text-[20px] leading-none">{charStatus.魅力}</div>
              </div>
              <div className="rounded-[16px] bg-[rgba(255,247,229,0.08)] px-2 py-3">
                <div className="text-[10px] tracking-[0.14em] text-[#F0E5CD]">神识</div>
                <div className="mt-[8px] text-[20px] leading-none">{charStatus.神识}</div>
              </div>
              <div className="rounded-[16px] bg-[rgba(255,247,229,0.08)] px-2 py-3">
                <div className="text-[10px] tracking-[0.14em] text-[#F0E5CD]">身手</div>
                <div className="mt-[8px] text-[20px] leading-none">{charStatus.身手}</div>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[#F5E8D0]">
              <div className="rounded-[16px] bg-[rgba(17,17,17,0.24)] px-2 py-3">
                <div className="text-[10px] tracking-[0.14em] text-[#E7D9BF]">修为</div>
                <div className="mt-[8px] break-keep text-[18px] leading-none text-[#E9E0B2]">{charStatus.等级}</div>
              </div>
              <div className="rounded-[16px] bg-[rgba(17,17,17,0.24)] px-2 py-3">
                <div className="text-[10px] tracking-[0.14em] text-[#E7D9BF]">突破</div>
                <div className="mt-[8px] text-[20px] leading-none text-[#E9E0B2]">{Math.round(charStatus.突破成功系数 * 100)}%</div>
              </div>
              <div className="rounded-[16px] bg-[rgba(17,17,17,0.24)] px-2 py-3">
                <div className="text-[10px] tracking-[0.14em] text-[#E7D9BF]">道心</div>
                <div className="mt-[8px] text-[20px] leading-none text-[#E9E0B2]">{charStatus.道心}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-40 mx-auto w-full max-w-[420px] px-[18px] pb-[138px] pt-[20px]">
          <DetailSection titleSrc={$img('newCharBg/title1')} titleAlt="人物背景">
            {charInfo.人物背景}
          </DetailSection>

          <DetailSection titleSrc={$img('newCharBg/title2')} titleAlt="核心任务">
            {charInfo.核心任务}
          </DetailSection>

          <DetailSection titleSrc={$img('newCharBg/title3')} titleAlt="外貌特征">
            {charInfo.外貌特征}
          </DetailSection>

          {charInfo.人物关系 && (
            <DetailSection titleSrc={$img('newCharBg/title4')} titleAlt="人物关系">
              <div className="space-y-2 text-left">
                {charInfo.人物关系.map((relation, index) => (
                  <div key={index}>· {relation}</div>
                ))}
              </div>
            </DetailSection>
          )}

          {factionData ? (
            <div className="mt-5">
              <FactionPortalCard data={factionData} onOpenWorld={openWorldPage} />
            </div>
          ) : null}

          {bondData ? (
            <div className="mt-5">
              <BondPortalCard data={bondData} onOpenBonds={openBondPage} onOpenChat={openBondChatPage} />
            </div>
          ) : null}

          <div className="sticky bottom-3 z-30 mt-6 flex justify-center bg-[linear-gradient(180deg,rgba(126,70,45,0),rgba(126,70,45,0.22)_24%,rgba(126,70,45,0.72)_100%)] px-4 py-4 backdrop-blur-[2px]">
            <button
              type="button"
              onClick={startGame}
              className="flex min-h-[52px] items-center justify-center"
              aria-label="开始修行"
            >
              <img
                className="w-[72vw] max-w-[300px] cursor-pointer"
                src={$img('newCharBg/btn-start')}
                alt="开始修行"
              />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute left-3 top-4 z-50 flex w-[40px] flex-col gap-[10px]">
        <button
          type="button"
          className="flex h-[40px] w-[40px] items-center justify-center rounded-[14px] bg-[rgba(24,17,11,0.26)] backdrop-blur-[2px]"
          aria-label="查看历史记录"
          onClick={() => {
            try {
              track('web.char_profile.history_record.click');
              trackEvent(UmamiEvents.首页历史按钮, { character_id: char.id, from: 'char' })
            } catch {}
            handleCharacterSelect(char.id);
            router.push("/pages/history");
          }}
        >
          <img
            src={$img('newCharBg/history')}
            alt="历史记录"
            className="h-[28px] w-[28px] cursor-pointer"
          />
        </button>
        <button
          type="button"
          onClick={openWorldPage}
          className="flex h-[40px] w-[40px] items-center justify-center rounded-[14px] border border-[rgba(255,242,212,0.58)] bg-[linear-gradient(145deg,rgba(126,93,48,0.96),rgba(41,29,18,0.92))] text-[12px] text-[#f7e8c4] shadow-[0_12px_22px_rgba(23,14,8,0.25)]"
          aria-label="打开势力视图"
        >
          势
        </button>
      </div>

      {/* Add delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center">
          <div onClick={() => setDeleteConfirm(false)} className="absolute inset-0 bg-[#000000B2] backdrop-blur-[5px]"></div>
          <div className="relative w-[311px] h-[280px] leading-[1]">
            <img className="w-full h-full" src={$img('bg-invite')} alt="bg-invite" />
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-[70px]">
              <div className="text-[#111] text-[24px]">确认删除角色</div>
              <div className="text-[#11111188] text-[14px] mt-[16px] text-center px-[20px]">
                你确定要删除角色 &ldquo;{charInfo.角色名称}&rdquo; 吗？
              </div>
              <div className="text-[#11111188] text-[14px] mt-[4px]">删除后无法恢复</div>
              <div className="flex gap-[12px] mt-auto mb-[24px]">
                <div onClick={handleDelete} className="w-[100px] h-[40px] bg-[#B92217] rounded-[4px] flex items-center justify-center">
                  <div className="text-white text-[14px]">确认删除</div>
                </div>
                <div onClick={() => setDeleteConfirm(false)} className="w-[100px] h-[40px] bg-[#666] rounded-[4px] flex items-center justify-center">
                  <div className="text-white text-[14px]">取消</div>
                </div>
              </div>
            </div>
          </div>
          <img onClick={() => setDeleteConfirm(false)} className="relative w-[32px] h-[32px] mt-[16px]" src={$img('icon-cancel')} alt="icon-cancel" />
        </div>
      )}
    </div>
  )
}

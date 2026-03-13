"use client";

import { useRecoilState } from "recoil"
import { $img } from "@/utils"
import { characterState } from "../store"
import { CharacterDescriptionType, CharacterStatusType } from "@/interfaces/schemas"
import { useEffect, useState } from "react"
import { trackEvent, trackPageView, track, UmamiEvents } from "@/lib/analytics/umami"
import useRoute from "../hooks/useRoute"
import charConfig from "./const/char"
import useStartGame from "../hooks/useStartGame"
import { useCharacterCrud } from "../hooks/charCrud"
import { useRouter } from "next/navigation"
import { deleteCharacter } from '../actions/character/action';
import { useUuid } from "../hooks/useLogin";
import { FactionPortalCard } from "./faction/FactionPanels";

export default function PageChar() {
  const { routerTo } = useRoute()
  const { startGame } = useStartGame()
  const [char, setChar] = useRecoilState(characterState)
  const { shareCharacter } = useCharacterCrud()
  const router = useRouter()
  const uuid = useUuid();
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { handleCharacterSelect } = useCharacterCrud();

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
      className="relative font-family-song flex flex-col items-center w-full min-h-full text-white">
      <div className="relative w-full">
        <div className="relative aspect-[0.96] w-full overflow-hidden">
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

          <div className="absolute inset-x-[18px] bottom-[18px] z-30 rounded-[24px] border border-[rgba(242,228,195,0.22)] bg-[linear-gradient(180deg,rgba(87,48,31,0.82),rgba(45,25,16,0.88))] px-4 py-4 shadow-[0_18px_42px_rgba(20,10,6,0.28)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[20px] leading-[1.05] text-[#FFF8ED]">{charInfo.角色名称}</div>
                <div className="mt-[6px] text-[11px] leading-[1.55] text-[#F0E5CD]">{identity}</div>
              </div>
              <div className="shrink-0 rounded-full border border-[rgba(242,228,195,0.28)] px-3 py-[6px] text-[12px] text-[#E9E0B2]">
                「{attr}」
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2 text-[#E9E0B2]">
              <div className="rounded-[14px] bg-[rgba(255,247,229,0.08)] px-2 py-2">
                <div className="flex items-center gap-1 text-[10px] text-[#F0E5CD]">
                  <img className="h-[14px] w-[14px]" src={$img('newCharBg/attr1')} alt="魅力" />
                  <span>魅力</span>
                </div>
                <div className="mt-[6px] text-[15px] leading-none">{charStatus.魅力}</div>
              </div>
              <div className="rounded-[14px] bg-[rgba(255,247,229,0.08)] px-2 py-2">
                <div className="flex items-center gap-1 text-[10px] text-[#F0E5CD]">
                  <img className="h-[14px] w-[14px]" src={$img('newCharBg/attr2')} alt="神识" />
                  <span>神识</span>
                </div>
                <div className="mt-[6px] text-[15px] leading-none">{charStatus.神识}</div>
              </div>
              <div className="rounded-[14px] bg-[rgba(255,247,229,0.08)] px-2 py-2">
                <div className="flex items-center gap-1 text-[10px] text-[#F0E5CD]">
                  <img className="h-[14px] w-[14px]" src={$img('newCharBg/attr3')} alt="身手" />
                  <span>身手</span>
                </div>
                <div className="mt-[6px] text-[15px] leading-none">{charStatus.身手}</div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 overflow-hidden rounded-[14px] bg-[linear-gradient(90deg,rgba(17,17,17,0.82),rgba(17,17,17,0.28))] px-2 py-2">
              <div className="shrink-0 rounded-[10px] bg-[#D7C576] px-3 py-[6px] text-[11px] text-[#2b2116]">
                {charStatus.等级}
              </div>
              <div className="grid flex-1 grid-cols-3 gap-2 text-[10px] text-[#F5E8D0]">
                <div>
                  <div className="text-[#E7D9BF]">突破</div>
                  <div className="mt-[4px] text-[13px] leading-none text-[#E9E0B2]">{Math.round(charStatus.突破成功系数 * 100)}%</div>
                </div>
                <div>
                  <div className="text-[#E7D9BF]">体魄</div>
                  <div className="mt-[4px] text-[13px] leading-none text-[#E9E0B2]">{charStatus.体魄}</div>
                </div>
                <div>
                  <div className="text-[#E7D9BF]">道心</div>
                  <div className="mt-[4px] text-[13px] leading-none text-[#E9E0B2]">{charStatus.道心}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-40 px-[20px] pb-[132px] pt-[20px] text-left text-[12px] leading-[1.9] text-[#F2E7D0]">
          <img className="w-[68%] max-w-[220px]" src={$img('newCharBg/title1')} alt="" />
          <div className="mt-3">{charInfo.人物背景}</div>

          <img className="mt-5 w-[68%] max-w-[220px]" src={$img('newCharBg/title2')} alt="" />
          <div className="mt-3">{charInfo.核心任务}</div>

          <img className="mt-5 w-[68%] max-w-[220px]" src={$img('newCharBg/title3')} alt="" />
          <div className="mt-3">{charInfo.外貌特征}</div>

          {charInfo.人物关系 && (
            <>
              <img className="mt-5 w-[68%] max-w-[220px]" src={$img('newCharBg/title4')} alt="" />
              <div className="mt-3 space-y-2">
                {charInfo.人物关系.map((relation, index) => (
                  <div key={index}>· {relation}</div>
                ))}
              </div>
            </>
          )}

          {factionData ? (
            <div className="mt-5">
              <FactionPortalCard data={factionData} onOpenWorld={openWorldPage} />
            </div>
          ) : null}

          <div className="sticky bottom-3 z-30 mt-6 flex justify-center bg-[linear-gradient(180deg,rgba(126,70,45,0),rgba(126,70,45,0.26)_26%,rgba(126,70,45,0.72)_100%)] px-4 py-4 backdrop-blur-[2px]">
            <img
              className="w-[68vw] max-w-[300px] cursor-pointer"
              src={$img('newCharBg/btn-start')}
              alt="开始修行"
              onClick={startGame}
            />
          </div>
        </div>
      </div>

      <div className="absolute left-2 top-4 z-50 flex w-[34px] flex-col gap-3">
        <img
          src={$img('newCharBg/share')}
          alt="分享"
          className="h-[34px] w-[34px] cursor-pointer"
          onClick={() => {
            try {
              track('web.char_profile.share_character.click');
              trackEvent(UmamiEvents.角色导入, { action: 'share', character_id: char.id })
            } catch {}
            shareCharacter(char.id)
          }}
        />
        <img
          src={$img('newCharBg/history')}
          alt="历史记录"
          className="h-[34px] w-[34px] cursor-pointer"
          onClick={() => {
            try {
              track('web.char_profile.history_record.click');
              trackEvent(UmamiEvents.首页历史按钮, { character_id: char.id, from: 'char' })
            } catch {}
            handleCharacterSelect(char.id);
            router.push("/pages/history");
          }}
        />
        <button
          type="button"
          onClick={openWorldPage}
          className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-[rgba(255,242,212,0.58)] bg-[linear-gradient(145deg,rgba(126,93,48,0.96),rgba(41,29,18,0.92))] text-[12px] text-[#f7e8c4] shadow-[0_12px_22px_rgba(23,14,8,0.25)]"
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

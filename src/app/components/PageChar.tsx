"use client";

import { useRecoilState } from "recoil"
import { $img } from "@/utils"
import { characterState } from "../store"
import { CharacterDescriptionType, CharacterStatusType } from "@/interfaces/schemas"
import { useCallback, useEffect, useState } from "react"
import { trackEvent, trackPageView, track, UmamiEvents } from "@/lib/analytics/umami"
import useRoute from "../hooks/useRoute"
import charConfig from "./const/char"
import useStartGame from "../hooks/useStartGame"
import { useCharacterCrud } from "../hooks/charCrud"
import { useRouter } from "next/navigation"
import { rebirthCharacter } from '../actions/character/action';
import { getCharacterById } from '../actions/character/action';
import { deleteCharacter } from '../actions/character/action';
import { useUuid } from "../hooks/useLogin";

export default function PageChar() {
  const { routerTo, routerBack } = useRoute()
  const { startGame } = useStartGame()
  const [char, setChar] = useRecoilState(characterState)
  const { shareCharacter } = useCharacterCrud()
  const router = useRouter()
  const uuid = useUuid();
  const [isRebirth, setIsRebirth] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Add states for delete functionality
  const [willDelete, setWillDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const { handleCharacterSelect } = useCharacterCrud();

  useEffect(() => {
    const isRebirth = localStorage.getItem('isRebirth');
    if (isRebirth) {
      localStorage.removeItem('isRebirth');
      setIsRebirth(true)
    }
  }, []);

  const handleAddAvatar = useCallback(() => {
    router.push(`/pages/avatar?characterId=${char?.id}`)
  }, [char?.id, router])

  useEffect(() => {
    if (!char) {
      routerTo("home")
      return
    }
    trackPageView('/char')
  }, [char, routerTo, setChar])

  if (!char) {
    return <></>
  }

  console.log(char)
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

  // 提取身份信息
  const identityMatch = char.createPrompt.match(/身份是(.*?)，/)
  const identity = identityMatch ? identityMatch[1] : ""

  const attr = charInfo.初始属性.灵根
  const config = charConfig[attr] || charConfig["土"]
  const hasGeneratedCover = Boolean(char.cover)
  const cover = hasGeneratedCover ? char.cover : config.backgroundImage

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

      {/* Add right upper operation bar */}
      {/* <div className='absolute top-[4px] right-[4px] flex flex-row justify-end gap-[4px] z-10'>
        <img onClick={() => shareCharacter(char.id)} className='w-[75px] h-[20px]' src={$img('index/btn-share-char')} alt="btn-share" />
        <img onClick={() => setWillDelete(!willDelete)} className='w-[20px] h-[20px]' src={$img('btn-more')} alt="btn-more" />
        {willDelete && (
          <div className='w-[66px] bg-white rounded-[4px] h-[29px] absolute top-[28px] right-0 flex gap-[2px] items-center justify-center'>
            <img className='w-[16px] h-[16px]' src={$img('icon-delete')} alt="icon-delete" />
            <div className='text-[12px] text-[#B92217] leading-[1] mt-[1px]' onClick={() => setDeleteConfirm(true)}>删除</div>
          </div>
        )}
      </div> */}

      <div className="w-full aspect-[2/3] relative">
        <img className="w-full absolute top-0 left-0" src={cover} alt="cover" />
        <img className="absolute top-0 left-0 w-full object-cover z-20" src={config.backgroundImage} alt="newCharBg" />
        {!hasGeneratedCover && (
          <div className="absolute inset-0 z-20 flex items-start justify-center pt-[10vw]">
            <div className="relative w-[56vw] max-w-[220px]">
              <img className="w-full opacity-90 mix-blend-screen" src={$img('circle')} alt="fallback-circle" />
              <img className="absolute left-1/2 top-[10%] w-[42%] -translate-x-1/2" src={config.url} alt="fallback-root" />
            </div>
          </div>
        )}
        <div className="absolute top-0 left-0 z-30">
          <div className="absolute px-4 pt-4 top-[84vw] left-[24px] w-[calc(100vw-48px)] aspect-[327/147]">
            <div className="text-[24px] text-white">{charInfo.角色名称}</div>
            <div className="flex flex-row items-center justify-between">
              <div className="text-[14px] text-white">{identity}</div>
              <div className="flex justify-end items-center flex-row text-[#E9E0B2] gap-1 text-[20px]">
                <img className="w-[20px] h-[20px]" src={$img('newCharBg/attr1')} alt="魅力" />
                <div>{charStatus.魅力}</div>
                <img className="w-[20px] h-[20px]" src={$img('newCharBg/attr2')} alt="神识" />
                <div>{charStatus.神识}</div>
                <img className="w-[20px] h-[20px]" src={$img('newCharBg/attr3')} alt="身手" />
                <div>{charStatus.身手}</div>
              </div>
            </div>
            <div className="w-full mt-[8px] flex flex-row h-[24px]"
              style={{ background: `linear-gradient(90deg, rgba(17, 17, 17, 0.80) 59.13%, rgba(17, 17, 17, 0.00) 100%)`}}>
              <div className="w-[34px] text-[13px] text-center rounded-l-sm text-[#222] bg-[#D7C576] shrink-0">{charStatus.等级}</div>
              <div className="w-full flex flex-row justify-center items-center gap-2 text-[13px]">
                <div className="flex items-center gap-0.5">
                  <div>突破进度</div>
                  <div className="text-[#E9E0B2]">{Math.round(charStatus.突破成功系数 * 100)}%</div>
                </div>
                <div className="flex items-center gap-0.5">
                  <div>体魄</div>
                  <div className="text-[#E9E0B2]">{charStatus.体魄}</div>
                </div>
                <div className="flex items-center gap-0.5">
                  <div>道心</div>
                  <div className="text-[#E9E0B2]">{charStatus.道心}</div>
                </div>
                <img className="w-[20px]" src={$img('newCharBg/icon-right')} alt="" />
              </div>
            </div>
          </div>
        </div>
        <div className="relative mt-[134vw] flex flex-col items-center z-40 left-0">
          <div className="mt-[37px] w-[calc(100vw-48px)] flex flex-col gap-4 text-left mx-[24px] text-[14px]">
            <img className="w-[calc(100vw-48px)]" src={$img('newCharBg/title1')} alt="" />
            <div>{charInfo.人物背景}</div>

            <img className="w-[calc(100vw-48px)]" src={$img('newCharBg/title2')} alt="" />
            <div>{charInfo.核心任务}</div>

            <img className="w-[calc(100vw-48px)]" src={$img('newCharBg/title3')} alt="" />
            <div>{charInfo.外貌特征}</div>

            {
              charInfo.人物关系 && (<>
                <img className="w-[calc(100vw-48px)]" src={$img('newCharBg/title4')} alt="" />
                <div>
                  {
                    charInfo.人物关系.map((relation, index) => (
                      <div key={index}>· {relation}</div>
                    ))
                  }
                </div>
              </>)
            }

            <div className="h-[22px]"></div>
            <img
              className="fixed left-[16vw] bottom-[20px] w-[72vw] cursor-pointer"
              src={$img('newCharBg/btn-start')}
              alt="开始修行"
              onClick={startGame}
            />

            {/* <div className="mb-[100px]"></div>
            {!isRebirth && <div className="fixed left-[24px] h-[40px] bottom-[48px] w-[calc(100vw-48px)] mt-[24px]">
              <div className="grid grid-cols-2 items-center gap-[8px]">
                <img onClick={() => {
                  handleCharacterSelect(char.id);
                  router.push("/pages/history")
                }} src={$img("btn-char-history")} alt="history" />
                <img
                  onClick={charStatus.是否死亡 ? () => { } : startGame}
                  src={charStatus.是否死亡 ? $img("btn-disable-die-continue") : $img("btn-quick-start")}
                  alt="continue"
                />
              </div>
            </div>} */}
          </div>
        </div>
      </div>

      {/* 固定操作栏位 */}
      <div className="absolute w-[40px] top-6 left-3 flex z-50 flex-col gap-4">
        <img
          src={$img('newCharBg/share')}
          alt="分享"
          className="cursor-pointer"
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
          className="cursor-pointer"
          onClick={() => {
            try {
              track('web.char_profile.history_record.click');
              trackEvent(UmamiEvents.首页历史按钮, { character_id: char.id, from: 'char' })
            } catch {}
            handleCharacterSelect(char.id);
            router.push("/pages/history");
          }}
        />
      </div>

      {
        false && isRebirth && (
          <>
            <div className={`mix-blend-color bg-black absolute top-0 left-0 z-20 w-full h-full transition-opacity duration-[2000ms] ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
            </div>
            <img
              className="fixed left-1/2 bottom-[28px] z-30 -translate-x-1/2 w-[45%] cursor-pointer"
              src={$img("death/rebirth")}
              alt="rebirth"
              onClick={async () => {
                if (!char?.id) return;
                const result = await rebirthCharacter(char.id);
                if (result.success) {
                  // Refresh character data
                  const updatedChar = await getCharacterById(char.id);
                  setChar(updatedChar);
                  setFadeOut(true);
                  setTimeout(() => {
                    setIsRebirth(false);
                    setFadeOut(false);
                  }, 2000);
                } else {
                  console.error(result.message);
                }
              }}
            />
          </>
        )
      }

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

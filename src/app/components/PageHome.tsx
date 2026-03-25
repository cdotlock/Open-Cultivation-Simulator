import { $img } from '@/utils'
import { useCallback, useEffect, useState } from 'react';
import { deleteCharacter, getCharacterById } from '@/app/actions/character/action'
import { useUuid, useLogin } from '../hooks/useLogin';
import { CharacterDescriptionType, CharacterStatusType } from "@/interfaces/schemas"
import charConfig from './const/char';
import useRoute from '../hooks/useRoute';
import { useCharacterCrud } from '../hooks/charCrud';

import { useAction } from '../hooks/useAction';
import useStartGame from '../hooks/useStartGame';
import { ViewCharacter } from '@/interfaces';
import { characterState } from '../store';
import { useRecoilState } from 'recoil';
import { useRouter } from 'next/navigation';
import { trackEvent, trackPageView, UmamiEvents, track } from '@/lib/analytics/umami';

export default function PageHome() {
  const { routerTo } = useRoute()
  const router = useRouter()
  const uuid = useUuid()
  const { isLoggedIn } = useLogin()
  // const [charList, setCharList] = useState<charList>([]);
  const { startGame } = useStartGame()
  const [, setChar] = useRecoilState(characterState)
  const {
    handleCharacterSelect,
  } = useCharacterCrud();

  const { getCharacterListByUuid } = useAction();

  // 视图层状态
  const [charList, setCharList] = useState<ViewCharacter[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    characterId: number;
    characterName: string;
  }>({
    show: false,
    characterId: 0,
    characterName: ''
  });

  const getCharacterList = useCallback(async () => {
    const res = await getCharacterListByUuid()
    setCharList(res.map(char => ({
      ...char,
      willDelete: false
    })))
  }, [getCharacterListByUuid, setCharList])

  useEffect(() => {
    getCharacterList()
  }, [getCharacterList])

  useEffect(() => {
    trackPageView('/home')
    track('web.index.view')
  }, [])

  const checkLoginAndExecute = useCallback((callback: () => void) => {
    if (!uuid) {
      return
    }
    callback()
  }, [uuid])

  const renderCharList = useCallback(() => {
    // 只有在登录状态下才获取角色列表
    if (!isLoggedIn || !uuid) {
      setCharList([])
      return
    }

    getCharacterListByUuid().then(res => {
      setCharList(res.map(item => ({
        ...item,
        willDelete: false
      })))
    })
  }, [uuid, isLoggedIn, getCharacterListByUuid])

  // 快速开始游戏 || 角色页面
  const toCharPage = useCallback((id: number, quick = false) => {
    checkLoginAndExecute(() => {
      getCharacterById(id).then(res => {
        setChar(res)

        if (quick) {
          startGame()
        } else {
          routerTo("char")
        }
        trackEvent(UmamiEvents.选择角色, { character_id: id, quick })
      })
    })
  }, [routerTo, startGame, checkLoginAndExecute, setChar])

  const eventStopPropagation = useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
  }, [])

  // 切换删除状态
  const toggleDeleteState = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCharList(prev => prev.map(char =>
      char.id === id
        ? { ...char, willDelete: !char.willDelete }
        : { ...char, willDelete: false }
    ));
  }, []);

  // 显示删除确认
  const showDeleteConfirm = useCallback((id: number, name: string) => {
    checkLoginAndExecute(() => {
      setDeleteConfirm({
        show: true,
        characterId: id,
        characterName: name
      })
      trackEvent(UmamiEvents.角色删除确认, {
        character_id: id,
        character_name: name,
      })
    })
  }, [checkLoginAndExecute])

  // 确认删除角色
  const confirmDelete = useCallback(() => {
    checkLoginAndExecute(() => {
      deleteCharacter(deleteConfirm.characterId, uuid).then(res => {
        if (res) {
          setCharList(pre => pre.filter(item => item.id !== deleteConfirm.characterId))
          renderCharList()
          setDeleteConfirm({ show: false, characterId: 0, characterName: '' })
          trackEvent(UmamiEvents.删除角色, {
            character_id: deleteConfirm.characterId,
          })
        }
      })
    })
  }, [deleteConfirm.characterId, uuid, renderCharList, checkLoginAndExecute])

  // 取消删除
  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ show: false, characterId: 0, characterName: '' });
  }, []);

  useEffect(() => {
    renderCharList()
  }, [renderCharList, isLoggedIn])


  return (
    <div className="flex flex-col items-center px-[18px] pb-[90px] pt-[18px] font-family-song">
      <div className="flex w-full max-w-[360px] items-start justify-between gap-3">
        <div className="w-[68%] max-w-[250px]">
          <img className="w-full" src={$img('logo')} alt="logo" />
        </div>
        <button
          type="button"
          onClick={() => router.push("/pages/settings")}
          className="mt-1 flex min-h-[40px] shrink-0 items-center rounded-full border border-[rgba(126,93,48,0.22)] bg-[rgba(255,249,239,0.9)] px-4 text-[13px] text-[#5e4523] shadow-[0_10px_20px_rgba(83,55,18,0.08)] backdrop-blur-[4px]"
          aria-label="打开设置"
        >
          设置
        </button>
      </div>

      <button
        type="button"
        onClick={() => checkLoginAndExecute(() => {
          track('web.index.create_character.click')
          trackEvent(UmamiEvents.快速生成角色, { source: 'create_button' })
          routerTo("create")
        })}
        className="mt-[22px] flex w-full max-w-[360px] justify-center px-[8px] transition-transform active:translate-y-[1px]"
        aria-label="创建角色"
      >
        <img className='w-full' src={$img('btn-create-char-new')} alt="create-char" />
      </button>
      {
        isLoggedIn && !!charList.length && (
          <img className="mt-[10px] w-[132px]" src={$img('btn-reincarnation')} alt="btn-reincarnation" />
        )
      }
      {
        charList.map((char) => {
          const charInfo = char.description as CharacterDescriptionType
          const charStatus = char.currentPush?.status as CharacterStatusType
          
          // 检查角色是否复活（没有currentPush）
          const isRevived = !char.currentPush;
          
          // 提取身份信息
          const identityMatch = char.createPrompt.match(/身份是(.*?)，/)
          const identity = identityMatch ? identityMatch[1] : ""

          const attr = charInfo.初始属性.灵根
          const config = charConfig[attr] || charConfig["土"]

          return (
            <div className='relative mt-[18px] w-full max-w-[360px] overflow-hidden rounded-[26px] border border-[rgba(126,93,48,0.18)] shadow-[0_20px_36px_rgba(22,14,8,0.16)]' key={char.id}>
              <div
                onClick={() => {
                  track('web.index.char_card.click', { character_id: char.id, character_name: charInfo.角色名称 });
                  handleCharacterSelect(char.id)
                }}
                style={{ background: `left -6.65% / 13.3% 11.4% url(${$img('mask-repect')}), ${config.bg1}` }}
                className="relative w-full overflow-hidden px-[16px] pb-[14px] pt-[16px] aspect-[1.26]"
              >
                <div onClick={eventStopPropagation} className='absolute right-[14px] top-[14px] z-20'>
                  <div className='relative'>
                    <button
                      type="button"
                      onClick={(e) => toggleDeleteState(char.id, e)}
                      className="flex h-[34px] w-[34px] items-center justify-center rounded-[12px] bg-[rgba(17,12,8,0.24)] shadow-[0_10px_18px_rgba(20,10,6,0.12)] backdrop-blur-[3px]"
                      aria-label={`更多操作 ${charInfo.角色名称}`}
                    >
                      <img className='h-[18px] w-[18px]' src={$img('btn-more')} alt="btn-more" />
                    </button>
                    {char.willDelete && (
                      <button
                        type="button"
                        className='absolute right-0 top-[38px] flex min-h-[34px] min-w-[80px] items-center justify-center gap-[5px] rounded-[10px] border border-[#efd9d5] bg-white px-[10px] shadow-[0_14px_28px_rgba(22,14,8,0.12)]'
                        onClick={() => { track('web.index.char_card.delete_character.click', { character_id: char.id, character_name: charInfo.角色名称 }); showDeleteConfirm(char.id, charInfo.角色名称) }}
                      >
                        <img className='h-[14px] w-[14px]' src={$img('icon-delete')} alt="icon-delete" />
                        <span className='mt-[1px] text-[11px] leading-[1] text-[#B92217]'>删除</span>
                      </button>
                    )}
                  </div>
                </div>

                <div className="absolute left-[-8%] top-[12px] w-[47%]">
                  <img className="w-full mix-blend-screen opacity-95" src={$img('circle')} alt="circle" />
                  <img className="absolute left-1/2 top-[-11%] w-[38%] -translate-x-1/2" src={config.url} alt="attr-water" />
                </div>

                <div className="relative z-10 ml-[39%] flex h-full flex-col justify-start text-white">
                  <div className="pr-[44px]">
                    <div className="flex items-start justify-between gap-2 text-[#D7C576]">
                      <div className="min-w-0 text-[21px] leading-[1.02] tracking-[0.04em]">{charInfo.角色名称}</div>
                      <div className="shrink-0 pt-[4px] text-[12px] text-[#E9D88E]">「{attr}」</div>
                    </div>
                    <div className='mt-[10px] max-h-[4.9em] overflow-hidden text-[13px] leading-[1.65] text-[#F5EADA]'>
                      {identity}
                    </div>
                  </div>
                </div>

                {isRevived ? (
                  <div className="absolute bottom-[14px] left-[16px] right-[16px] rounded-[16px] border border-[rgba(242,228,195,0.14)] bg-[rgba(17,12,8,0.2)] px-4 py-3 text-center text-[12px] leading-[1.5] text-[#F0D37C] shadow-[0_10px_24px_rgba(20,10,6,0.08)]">
                    已复活，可重新开始这段修行
                  </div>
                ) : charStatus ? (
                  <div className="absolute bottom-[14px] left-[16px] right-[16px] grid grid-cols-3 gap-[8px] text-[#F2E8D8]">
                    <div className="rounded-[14px] bg-[rgba(17,12,8,0.22)] px-[6px] py-[10px] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="text-[11px] leading-none text-[#E8DCC7]">突破率</div>
                      <div className="mt-[8px] text-[20px] leading-none text-[#D7C576]">{Math.round(charStatus.突破成功系数 * 100)}%</div>
                    </div>
                    <div className="rounded-[14px] bg-[rgba(17,12,8,0.22)] px-[6px] py-[10px] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="text-[11px] leading-none text-[#E8DCC7]">修为</div>
                      <div className="mt-[8px] break-keep text-[18px] leading-none text-[#D7C576]">{charStatus.等级}</div>
                    </div>
                    <div className="rounded-[14px] bg-[rgba(17,12,8,0.22)] px-[6px] py-[10px] text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                      <div className="text-[11px] leading-none text-[#E8DCC7]">道心</div>
                      <div className="mt-[8px] text-[20px] leading-none text-[#D7C576]">{charStatus.道心}<span className="text-[11px] text-[#E8DCC7]">/3</span></div>
                    </div>
                  </div>
                ) : null}
              </div>
              <div className='flex h-[56px] w-full items-center justify-between gap-[10px] px-[10px]' style={{ background: config.bg1 }}>
                <button
                  type="button"
                  onClick={() => checkLoginAndExecute(() => {
                    track('web.index.char_card.history_record.click', { character_id: char.id })
                    trackEvent(UmamiEvents.首页历史按钮, { character_id: char.id })
                    handleCharacterSelect(char.id);
                    router.push("/pages/history")
                  })}
                  className="flex min-h-[42px] w-[46%] max-w-[148px] items-center justify-center"
                  aria-label={`查看 ${charInfo.角色名称} 的历史记录`}
                >
                  <img className='w-full' src={$img('index/btn-history')} alt="btn-history" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (isRevived) {
                      // 复活后的角色，直接开始新游戏
                      checkLoginAndExecute(() => { track('web.index.char_card.continue_story.click', { character_id: char.id }); toCharPage(char.id, true) });
                    } else if (charStatus && !charStatus.是否死亡) {
                      // 正常角色，检查是否死亡
                      checkLoginAndExecute(() => { track('web.index.char_card.continue_story.click', { character_id: char.id }); toCharPage(char.id, true) });
                    }
                  }}
                  className='flex min-h-[42px] w-[46%] max-w-[148px] items-center justify-center'
                  disabled={!isRevived && !!charStatus?.是否死亡}
                  aria-label={isRevived || !charStatus?.是否死亡 ? `继续 ${charInfo.角色名称} 的剧情` : `${charInfo.角色名称} 当前无法继续`}
                >
                  <img
                    className='w-full'
                    src={
                      isRevived ? $img('btn-text-continue') : 
                      charStatus?.是否死亡 ? $img('btn-disable-die-continue') : $img('btn-text-continue')
                    }
                    alt={isRevived || !charStatus?.是否死亡 ? "继续剧情" : "无法继续"}
                  />
                </button>
              </div>
            </div>
          )
        })
      }

      {/* 删除确认弹窗 */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center">
          <div onClick={cancelDelete} className="absolute inset-0 bg-[#000000B2] backdrop-blur-[5px]"></div>
          <div onClick={eventStopPropagation} className="relative w-[311px] h-[280px] leading-[1]">
            <img className="w-full h-full" src={$img('bg-invite')} alt="bg-invite" />
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-[70px]">
              <div className="text-[#111] text-[24px]">确认删除角色</div>
              <div className="text-[#11111188] text-[14px] mt-[16px] text-center px-[20px]">
                你确定要删除角色 &ldquo;{deleteConfirm.characterName}&rdquo; 吗？
              </div>
              <div className="text-[#11111188] text-[14px] mt-[4px]">删除后无法恢复</div>

              <div className="flex gap-[12px] mt-auto mb-[24px]">
                <button type="button" onClick={confirmDelete} className="w-[100px] h-[40px] bg-[#B92217] rounded-[4px] flex items-center justify-center cursor-pointer">
                  <span className="text-white text-[14px]">确认删除</span>
                </button>
                <button type="button" onClick={cancelDelete} className="w-[100px] h-[40px] bg-[#666] rounded-[4px] flex items-center justify-center cursor-pointer">
                  <span className="text-white text-[14px]">取消</span>
                </button>
              </div>
            </div>
          </div>
          <img onClick={cancelDelete} className="relative w-[32px] h-[32px] mt-[16px]" src={$img('icon-cancel')} alt="icon-cancel" />
        </div>
      )}
    </div>
  );
}

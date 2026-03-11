import { $img } from '@/utils'
import { ramdomFirstName, ramdomIdentity, ramdomLastName, randomAttributeDistribution443 } from '@/utils/ramdom'
import { useCallback, useEffect, useState } from 'react';
import { deleteCharacter, getCharacterById } from '@/app/actions/character/action'
import { useUuid, useLogin } from '../hooks/useLogin';
import { CharacterDescriptionType, CharacterStatusType } from "@/interfaces/schemas"
import charConfig from './const/char';
import useRoute from '../hooks/useRoute';
import useGameControll from '../hooks/useGameControll';
import { useCharacterCrud } from '../hooks/charCrud';

import { useAction } from '../hooks/useAction';
import useStartGame from '../hooks/useStartGame';
import { ViewCharacter } from '@/interfaces';
import { characterState } from '../store';
import { useRecoilState } from 'recoil';
import { useRouter } from 'next/navigation';
import { trackEvent, trackPageView, UmamiEvents, track } from '@/lib/analytics/umami';

const traitList = ["聪慧", "财富", "魅力", "幸运", "野性", "贫穷", "隐匿", "诅咒"]

export default function PageHome() {
  const { routerTo } = useRoute()
  const router = useRouter()
  const uuid = useUuid()
  const { isLoggedIn } = useLogin()
  // const [charList, setCharList] = useState<charList>([]);
  const { startGame } = useStartGame()
  const [char, setChar] = useRecoilState(characterState)
  const { toCreateLoadingPage } = useGameControll(uuid)
  const [firstClick, setFirstClick] = useState(true)
  const {
    handleCharacterSelect,
    shareCharacter,
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

  const toCreateLoadingPageRandom = useCallback((traitCount: number = 3) => {
    const firstName = ramdomFirstName();
    const lastName = ramdomLastName();
    const identity = ramdomIdentity();

    const shuffledTraits = [...traitList]
      .sort(() => Math.random() - 0.5)
      .slice(0, traitCount);
    const traitStr = shuffledTraits.join(" ");

    // 随机分配443点属性
    const attributePoints = randomAttributeDistribution443();

    // 随机选择灵根
    const spiritRoots = ["金灵根", "木灵根", "水灵根", "火灵根", "土灵根"];
    const randomSpiritRoot = spiritRoots[Math.floor(Math.random() * spiritRoots.length)];

    toCreateLoadingPage([firstName, lastName, identity], traitStr, attributePoints, randomSpiritRoot)
  }, [toCreateLoadingPage]);

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

  const eventStopPropagation = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
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

  //   setDeleteConfirm({
  //     show: true,
  //     characterId: id,
  //     characterName: name
  //   });
  // }, []);

  // 取消删除
  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ show: false, characterId: 0, characterName: '' });
  }, []);

  // // 添加切换删除状态的函数
  // const toggleDeleteState = useCallback((id: number, e: React.MouseEvent) => {
  //   e.stopPropagation()
  //   setCharList(prev => prev.map(char => 
  //     char.id === id 
  //       ? { ...char, willDelete: !char.willDelete }
  //       : { ...char, willDelete: false } // 关闭其他角色的删除状态
  //   ))
  // }, [])

  useEffect(() => {
    renderCharList()
  }, [renderCharList, isLoggedIn])


  return (
    <div className="p-[27px_24px_98px] flex flex-col items-center font-family-song">
      <div className="w-[71.7%] flex justify-end">
        <img className="w-[90%]" src={$img('logo')} alt="logo" />
      </div>

      <img onClick={() => checkLoginAndExecute(() => {
        track('web.index.create_character.click')
        trackEvent(UmamiEvents.快速生成角色, { source: 'create_button' })
        routerTo("create")
      })} className='w-full px-[8px] mt-[33px]' src={$img('btn-create-char-new')} alt="create-char" />
      <div className="mt-[12px] w-full px-[8px]">
        <img onClick={() => checkLoginAndExecute(() => {
          track('web.index.play_now.click')
          trackEvent(UmamiEvents.快速生成角色, { source: 'quick_start' })
          toCreateLoadingPageRandom()
        })} className="w-full" src={$img('btn-play-now-new')} alt="play-now" />
      </div>
      {
        isLoggedIn && !!charList.length && (
          <img className="w-[42%] mt-[38px]" src={$img('btn-reincarnation')} alt="btn-reincarnation" />
        )
      }
      {
        charList.map((char, index) => {
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
            <div className='relative w-[87.2%] mt-[24px] shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]' key={index}>
              <div onClick={() => { track('web.index.char_card.click', { character_id: char.id, character_name: charInfo.角色名称 }); handleCharacterSelect(char.id) }} style={{ background: `left -6.65% / 13.3% 11.4% url(${$img('mask-repect')}), ${config.bg1}` }} className="relative overflow-hidden w-full aspect-[1.285]">
                <div onClick={eventStopPropagation} className='absolute top-[0px] right-[0px] w-[120px] h-[60px]'>
                  <div className='absolute h-[20px] top-[4px] right-[4px] flex flex-row justify-end gap-[4px]'>
                    <img onClick={() => checkLoginAndExecute(() => { track('web.index.char_card.share_character.click', { character_id: char.id, character_name: charInfo.角色名称 }); shareCharacter(char.id) })} className='w-[75px] h-[20px]' src={$img('index/btn-share-char')} alt="btn-share" />
                    <img onClick={(e) => toggleDeleteState(char.id, e)} className='w-[20px] h-[20px]' src={$img('btn-more')} alt="btn-more" />
                    {
                      char.willDelete && (
                        <>
                          <div className='w-[66px] bg-white rounded-[4px] h-[29px] absolute top-[28px] right-[4px] flex gap-[2px] items-center justify-center'>
                            <img className='w-[16px] h-[16px]' src={$img('icon-delete')} alt="icon-delete" />
                          <div className='text-[12px] text-[#B92217] leading-[1] mt-[1px]' onClick={() => { track('web.index.char_card.delete_character.click', { character_id: char.id, character_name: charInfo.角色名称 }); showDeleteConfirm(char.id, charInfo.角色名称) }}>删除</div>
                          </div>
                        </>
                      )
                    }
                  </div>
                </div>
                <div className="w-2/3 absolute top-[8%] left-[-20%]">
                  <img className="w-full mix-blend-screen" src={$img('circle')} alt="circle" />
                  <img className="w-[42%] absolute left-1/2 top-[-20%] -translate-x-1/2 " src={config.url} alt="attr-water" />
                </div>

                <div className="ml-[calc(50%+2px)] mt-[36px] w-1/2 h-3/4 leading-[1.25] flex flex-col justify-between text-[12px] text-white">
                  <div>
                    <div className="flex flex-row items-end text-[#D7C576]">
                      <div className="text-[24px]">{charInfo.角色名称}</div>
                      <div className="">「{attr}」</div>
                    </div>
                    <div className='mt-[4px]'>
                      {identity}
                    </div>
                    {/* 复活状态提示 */}
                    {isRevived && (
                      <div className='mt-[4px] text-[#FFD700] text-[10px]'>
                        已复活 - 可重新开始
                      </div>
                    )}
                  </div>
                  
                  {!isRevived && (
                    <>
                      <div className='mt-[8px]'>
                        <div className="flex flex-row gap-[2px] items-end">
                          <div>突破率</div>
                          <div className='origin-bottom-left scale-75 mb-[1px]'>/Upgrade rate</div>
                        </div>
                        <div className="flex flex-row items-end text-[16px] pl-[12px]">
                          <div className="text-[#D7C576]">{Math.round(charStatus.突破成功系数 * 100)}%</div>
                          {/* <div>/100%</div> */}
                        </div>
                      </div>

                      <div className='mt-[8px]'>
                        <div className="flex flex-row gap-[2px] items-end">
                          <div>修为</div>
                          <div className='origin-bottom-left scale-75 mb-[1px]'>/Level</div>
                        </div>
                        <div className="text-[#D7C576] text-[16px] pl-[12px]">{charStatus?.等级}</div>
                      </div>

                      <div className='mt-[8px]'>
                        <div className="flex flex-row gap-[2px] items-end">
                          <div>道心</div>
                          <div className='origin-bottom-left scale-75 mb-[1px]'>/Rationality</div>
                        </div>
                        <div className="flex flex-row items-end text-[16px] pl-[12px]">
                          <div className="text-[#D7C576]">{charStatus?.道心}</div>
                          <div>/3</div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
              <div className='w-full h-[48px] left-0 bottom-0 flex justify-end items-center gap-[16px]' style={{ background: config.bg1 }}>
                <img onClick={() => checkLoginAndExecute(() => {
                  track('web.index.char_card.history_record.click', { character_id: char.id })
                  trackEvent(UmamiEvents.首页历史按钮, { character_id: char.id })
                  handleCharacterSelect(char.id);
                  router.push("/pages/history")
                })} className='w-[44%]' src={$img('index/btn-history')} alt="btn-history" />
                <img onClick={() => {
                  if (isRevived) {
                    // 复活后的角色，直接开始新游戏
                    checkLoginAndExecute(() => { track('web.index.char_card.continue_story.click', { character_id: char.id }); toCharPage(char.id, true) });
                  } else {
                    // 正常角色，检查是否死亡
                    charStatus.是否死亡 || checkLoginAndExecute(() => { track('web.index.char_card.continue_story.click', { character_id: char.id }); toCharPage(char.id, true) });
                  }
                }}
                  className={`w-[44%]`} src={
                    isRevived ? $img('btn-text-continue') : 
                    charStatus?.是否死亡 ? $img('btn-disable-die-continue') : $img('btn-text-continue')
                  } alt="" />
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
                <div onClick={confirmDelete} className="w-[100px] h-[40px] bg-[#B92217] rounded-[4px] flex items-center justify-center">
                  <div className="text-white text-[14px]">确认删除</div>
                </div>
                <div onClick={cancelDelete} className="w-[100px] h-[40px] bg-[#666] rounded-[4px] flex items-center justify-center">
                  <div className="text-white text-[14px]">取消</div>
                </div>
              </div>
            </div>
          </div>
          <img onClick={cancelDelete} className="relative w-[32px] h-[32px] mt-[16px]" src={$img('icon-cancel')} alt="icon-cancel" />
        </div>
      )}
    </div>
  );
}

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

const traitList = ["聪慧", "财富", "魅力", "幸运", "野性", "贫穷", "隐匿", "诅咒"]

export default function PageHome() {
  const { routerTo } = useRoute()
  const router = useRouter()
  const uuid = useUuid()
  const { isLoggedIn } = useLogin()
  const { startGame } = useStartGame()
  const [, setChar] = useRecoilState(characterState)
  const { toCreateLoadingPage } = useGameControll(uuid)
  const { handleCharacterSelect, shareCharacter, showImportCharacter } = useCharacterCrud();
  const { getCharacterListByUuid } = useAction();

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
  }, [getCharacterListByUuid])

  useEffect(() => {
    getCharacterList()
  }, [getCharacterList])

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
    const attributePoints = randomAttributeDistribution443();
    const spiritRoots = ["金灵根", "木灵根", "水灵根", "火灵根", "土灵根"];
    const randomSpiritRoot = spiritRoots[Math.floor(Math.random() * spiritRoots.length)];

    toCreateLoadingPage([firstName, lastName, identity], traitStr, attributePoints, randomSpiritRoot)
  }, [toCreateLoadingPage]);

  const renderCharList = useCallback(() => {
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

  const toCharPage = useCallback((id: number, quick = false) => {
    checkLoginAndExecute(() => {
      getCharacterById(id).then(res => {
        setChar(res)

        if (quick) {
          startGame()
        } else {
          routerTo("char")
        }
      })
    })
  }, [routerTo, startGame, checkLoginAndExecute, setChar])

  const eventStopPropagation = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
  }, [])

  const toggleDeleteState = useCallback((id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCharList(prev => prev.map(char =>
      char.id === id
        ? { ...char, willDelete: !char.willDelete }
        : { ...char, willDelete: false }
    ));
  }, []);

  const showDeleteConfirm = useCallback((id: number, name: string) => {
    checkLoginAndExecute(() => {
      setDeleteConfirm({
        show: true,
        characterId: id,
        characterName: name
      })
    })
  }, [checkLoginAndExecute])

  const confirmDelete = useCallback(() => {
    checkLoginAndExecute(() => {
      deleteCharacter(deleteConfirm.characterId, uuid).then(res => {
        if (res) {
          setCharList(pre => pre.filter(item => item.id !== deleteConfirm.characterId))
          renderCharList()
          setDeleteConfirm({ show: false, characterId: 0, characterName: '' })
        }
      })
    })
  }, [deleteConfirm.characterId, uuid, renderCharList, checkLoginAndExecute])

  const cancelDelete = useCallback(() => {
    setDeleteConfirm({ show: false, characterId: 0, characterName: '' });
  }, []);

  useEffect(() => {
    renderCharList()
  }, [renderCharList, isLoggedIn])

  return (
    <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-4 pb-12 pt-6 font-family-song xl:px-6">
      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[34px] border border-[#d8c59c] bg-[rgba(250,242,226,0.9)] px-5 py-6 shadow-[0_16px_40px_rgba(83,55,18,0.08)] xl:px-8">
          <div className="mx-auto flex w-full max-w-[320px] justify-end xl:mx-0 xl:max-w-[360px]">
            <img className="w-full" src={$img('logo')} alt="logo" />
          </div>
          <div className="mt-5 text-[14px] leading-7 text-[#6f5a3b] xl:max-w-[32rem]">
            修仙路由此开启。单机版保留原本的志怪、命数与因果感，只是把配置与运行方式都收进了本地洞府。
          </div>

          <div className="mt-6 space-y-3">
            <img
              onClick={() => checkLoginAndExecute(() => routerTo("create"))}
              className='w-full cursor-pointer'
              src={$img('btn-create-char-new')}
              alt="create-char"
            />
            <div className="grid grid-cols-2 gap-3">
              <img
                onClick={() => checkLoginAndExecute(() => toCreateLoadingPageRandom())}
                src={$img('btn-play-now-new')}
                alt="play-now"
                className="w-full cursor-pointer"
              />
              <img
                onClick={() => checkLoginAndExecute(() => showImportCharacter())}
                src={$img('btn-import-char-new')}
                alt="import-char"
                className="w-full cursor-pointer"
              />
            </div>
          </div>

          <div className="mt-6 rounded-[28px] border border-[#dbc8a2] bg-[rgba(255,248,238,0.88)] px-5 py-4 text-[13px] leading-6 text-[#6d5838]">
            <div>快速开始会随机姓名、身份、灵根与加点。</div>
            <div>创建角色则允许你手动定命、选灵根、分配额外属性。</div>
          </div>
        </div>

        <div className="rounded-[34px] border border-[#d8c59c] bg-[rgba(250,242,226,0.86)] px-4 py-5 shadow-[0_16px_40px_rgba(83,55,18,0.08)] xl:px-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[24px] text-[#3b2c1b]">转世录</div>
              <div className="mt-1 text-[13px] text-[#765f3c]">已创建角色会显示在这里，可继续修行、查看历史或删除存档。</div>
            </div>
            {isLoggedIn && !!charList.length ? (
              <img className="hidden w-[180px] xl:block" src={$img('btn-reincarnation')} alt="btn-reincarnation" />
            ) : null}
          </div>

          {charList.length === 0 ? (
            <div className="mt-6 rounded-[30px] border border-dashed border-[#ccb487] bg-[rgba(255,249,239,0.8)] px-6 py-12 text-center text-[#6e5937]">
              <div className="text-[22px]">暂无角色</div>
              <div className="mt-2 text-[13px]">先造一个角色，或者导入密令唤醒别人的因果线。</div>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              {charList.map((char) => {
                const charInfo = char.description as CharacterDescriptionType
                const charStatus = char.currentPush?.status as CharacterStatusType
                const isRevived = !char.currentPush;
                const identityMatch = char.createPrompt.match(/身份是(.*?)，/)
                const identity = identityMatch ? identityMatch[1] : ""
                const attr = charInfo.初始属性.灵根
                const config = charConfig[attr] || charConfig["土"]

                return (
                  <div className='relative shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)]' key={char.id}>
                    <div
                      onClick={() => handleCharacterSelect(char.id)}
                      style={{ background: `left -6.65% / 13.3% 11.4% url(${$img('mask-repect')}), ${config.bg1}` }}
                      className="relative overflow-hidden aspect-[1.285] w-full cursor-pointer rounded-t-[18px]"
                    >
                      <div onClick={eventStopPropagation} className='absolute right-[8px] top-[8px] z-20 flex flex-row justify-end gap-[4px]'>
                        <img onClick={() => checkLoginAndExecute(() => shareCharacter(char.id))} className='h-[20px] w-[75px]' src={$img('index/btn-share-char')} alt="btn-share" />
                        <img onClick={(e) => toggleDeleteState(char.id, e)} className='h-[20px] w-[20px]' src={$img('btn-more')} alt="btn-more" />
                        {char.willDelete ? (
                          <div className='absolute right-[0px] top-[28px] flex h-[29px] w-[66px] items-center justify-center gap-[2px] rounded-[4px] bg-white'>
                            <img className='h-[16px] w-[16px]' src={$img('icon-delete')} alt="icon-delete" />
                            <div className='mt-[1px] text-[12px] leading-[1] text-[#B92217]' onClick={() => showDeleteConfirm(char.id, charInfo.角色名称)}>删除</div>
                          </div>
                        ) : null}
                      </div>

                      <div className="absolute left-[-16%] top-[8%] w-2/3">
                        <img className="w-full mix-blend-screen" src={$img('circle')} alt="circle" />
                        <img className="absolute left-1/2 top-[-20%] w-[42%] -translate-x-1/2" src={config.url} alt={attr} />
                      </div>

                      <div className="ml-[calc(50%+6px)] mt-[30px] flex h-[74%] w-[45%] flex-col justify-between text-[12px] leading-[1.25] text-white">
                        <div>
                          <div className="flex flex-row items-end text-[#D7C576]">
                            <div className="text-[24px]">{charInfo.角色名称}</div>
                            <div>「{attr}」</div>
                          </div>
                          <div className='mt-[4px] line-clamp-2'>{identity}</div>
                          {isRevived ? (
                            <div className='mt-[6px] text-[10px] text-[#FFD700]'>已复活，可重开命线</div>
                          ) : null}
                        </div>

                        {!isRevived ? (
                          <div className="space-y-2">
                            <StatLine label="突破率" value={`${Math.round(charStatus.突破成功系数 * 100)}%`} />
                            <StatLine label="修为" value={charStatus?.等级} />
                            <StatLine label="道心" value={`${charStatus?.道心}/3`} />
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className='flex h-[48px] items-center justify-end gap-[16px] rounded-b-[18px] px-3' style={{ background: config.bg1 }}>
                      <img
                        onClick={() => checkLoginAndExecute(() => {
                          handleCharacterSelect(char.id);
                          router.push("/pages/history")
                        })}
                        className='w-[44%] cursor-pointer'
                        src={$img('index/btn-history')}
                        alt="btn-history"
                      />
                      <img
                        onClick={() => {
                          if (isRevived) {
                            checkLoginAndExecute(() => { toCharPage(char.id, true) });
                            return;
                          }

                          if (!charStatus.是否死亡) {
                            checkLoginAndExecute(() => { toCharPage(char.id, true) });
                          }
                        }}
                        className='w-[44%] cursor-pointer'
                        src={
                          isRevived ? $img('btn-text-continue') :
                          charStatus?.是否死亡 ? $img('btn-disable-die-continue') : $img('btn-text-continue')
                        }
                        alt="continue"
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {deleteConfirm.show && (
        <div className="fixed inset-0 z-30 flex flex-col items-center justify-center">
          <div onClick={cancelDelete} className="absolute inset-0 bg-[#000000B2] backdrop-blur-[5px]"></div>
          <div onClick={eventStopPropagation} className="relative w-[311px] h-[280px] leading-[1]">
            <img className="w-full h-full" src={$img('bg-invite')} alt="bg-invite" />
            <div className="absolute inset-0 flex flex-col items-center justify-start pt-[70px]">
              <div className="text-[#111] text-[24px]">确认删除角色</div>
              <div className="mt-[16px] px-[20px] text-center text-[14px] text-[#11111188]">
                你确定要删除角色 &ldquo;{deleteConfirm.characterName}&rdquo; 吗？
              </div>
              <div className="mt-[4px] text-[14px] text-[#11111188]">删除后无法恢复</div>

              <div className="mt-auto mb-[24px] flex gap-[12px]">
                <div onClick={confirmDelete} className="flex h-[40px] w-[100px] items-center justify-center rounded-[4px] bg-[#B92217]">
                  <div className="text-[14px] text-white">确认删除</div>
                </div>
                <div onClick={cancelDelete} className="flex h-[40px] w-[100px] items-center justify-center rounded-[4px] bg-[#666]">
                  <div className="text-[14px] text-white">取消</div>
                </div>
              </div>
            </div>
          </div>
          <img onClick={cancelDelete} className="relative mt-[16px] h-[32px] w-[32px]" src={$img('icon-cancel')} alt="icon-cancel" />
        </div>
      )}
    </div>
  );
}

const StatLine = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="flex flex-row gap-[2px] items-end">
      <div>{label}</div>
    </div>
    <div className="pl-[12px] text-[16px] text-[#D7C576]">{value}</div>
  </div>
);

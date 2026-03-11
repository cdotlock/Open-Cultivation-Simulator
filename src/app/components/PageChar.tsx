"use client";

import { useRecoilState } from "recoil"
import { $img } from "@/utils"
import { characterState } from "../store"
import { CharacterDescriptionType, CharacterStatusType } from "@/interfaces/schemas"
import { useCallback, useEffect, useState } from "react"
import useRoute from "../hooks/useRoute"
import charConfig from "./const/char"
import useStartGame from "../hooks/useStartGame"
import { useCharacterCrud } from "../hooks/charCrud"
import { useRouter } from "next/navigation"
import { deleteCharacter } from '../actions/character/action';
import { useUuid } from "../hooks/useLogin";

export default function PageChar() {
  const { routerTo } = useRoute()
  const { startGame } = useStartGame()
  const [char] = useRecoilState(characterState)
  const { shareCharacter, handleCharacterSelect } = useCharacterCrud()
  const router = useRouter()
  const uuid = useUuid();
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  useEffect(() => {
    if (!char) {
      routerTo("home")
    }
  }, [char, routerTo])

  if (!char) {
    return null
  }

  const charInfo = char.description as CharacterDescriptionType

  if (!char.currentPush) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6 text-white font-family-song">
        <div className="rounded-[30px] border border-[#d7c59d] bg-[rgba(42,31,18,0.92)] px-8 py-10 text-center shadow-[0_24px_60px_rgba(0,0,0,0.24)]">
          <div className="text-2xl mb-4">角色已复活</div>
          <div className="text-lg mb-6">你的角色已经复活，可以重新开始游戏。</div>
          <button
            onClick={() => routerTo('home')}
            className="rounded-full bg-[#caa35f] px-6 py-3 text-[#2e2010]"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  const charStatus = char.currentPush.status as CharacterStatusType
  const identityMatch = char.createPrompt.match(/身份是(.*?)，/)
  const identity = identityMatch ? identityMatch[1] : ""
  const attr = charInfo.初始属性.灵根
  const config = charConfig[attr] || charConfig["土"]
  const hasGeneratedCover = Boolean(char.cover)
  const cover = hasGeneratedCover ? char.cover : config.backgroundImage

  const handleDelete = async () => {
    await deleteCharacter(char.id, uuid);
    setDeleteConfirm(false);
    routerTo("home");
  };

  return (
    <div
      style={{ background: `left -6.65% / 15% url(${$img('mask-repect')}), ${config.bg1}` }}
      className="relative min-h-[calc(100vh-48px)] font-family-song text-white"
    >
      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-4 pb-24 pt-6 xl:grid-cols-[0.94fr_1.06fr] xl:px-6">
        <section className="relative overflow-hidden rounded-[36px] border border-[rgba(255,240,212,0.25)] bg-[rgba(20,16,11,0.54)] shadow-[0_18px_40px_rgba(0,0,0,0.22)]">
          <div className="relative aspect-[4/5] min-h-[420px] xl:min-h-[680px]">
            <img className="absolute inset-0 h-full w-full object-cover" src={cover} alt="cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(6,4,2,0.12)_0%,rgba(6,4,2,0.4)_58%,rgba(6,4,2,0.88)_100%)]" />

            {hasGeneratedCover ? (
              <img className="absolute inset-0 z-10 h-full w-full object-cover opacity-85" src={config.backgroundImage} alt="newCharBg" />
            ) : (
              <DefaultPortrait attr={attr} config={config} status={charStatus} />
            )}

            <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 py-4 xl:px-6 xl:py-5">
              <div className="rounded-full border border-[rgba(255,238,213,0.25)] bg-[rgba(20,16,11,0.48)] px-4 py-2 text-[12px] tracking-[0.2em] text-[#e6d7b6]">
                {hasGeneratedCover ? "角色画像" : "默认画像"}
              </div>
              <div className="flex items-center gap-3">
                <IconAction icon={$img('newCharBg/share')} label="分享角色" onClick={() => shareCharacter(char.id)} />
                <IconAction
                  icon={$img('newCharBg/history')}
                  label="历史记录"
                  onClick={() => {
                    handleCharacterSelect(char.id);
                    router.push("/pages/history");
                  }}
                />
                <button
                  onClick={() => setDeleteConfirm(true)}
                  className="rounded-full border border-[rgba(255,238,213,0.25)] bg-[rgba(20,16,11,0.48)] px-4 py-2 text-[12px] text-[#f3d7b3]"
                >
                  删除
                </button>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 z-20 px-5 pb-6 xl:px-7 xl:pb-8">
              <div className="rounded-[28px] border border-[rgba(255,240,212,0.18)] bg-[rgba(10,8,6,0.42)] p-5 backdrop-blur-[4px]">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <div className="text-[30px] leading-none text-[#f7efe0] xl:text-[40px]">{charInfo.角色名称}</div>
                    <div className="mt-2 text-[15px] text-[#ddd0b2]">{identity}</div>
                    <div className="mt-2 inline-flex rounded-full border border-[rgba(255,237,203,0.22)] px-3 py-1 text-[12px] text-[#e7d4a3]">
                      {attr}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center xl:min-w-[260px]">
                    <PortraitStat label="魅力" value={charStatus.魅力} icon={$img('newCharBg/attr1')} />
                    <PortraitStat label="神识" value={charStatus.神识} icon={$img('newCharBg/attr2')} />
                    <PortraitStat label="身手" value={charStatus.身手} icon={$img('newCharBg/attr3')} />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-[13px] text-[#efe5d2] sm:grid-cols-3">
                  <StatusChip label="境界" value={charStatus.等级} />
                  <StatusChip label="突破进度" value={`${Math.round(charStatus.突破成功系数 * 100)}%`} />
                  <StatusChip label="体魄 / 道心" value={`${charStatus.体魄} / ${charStatus.道心}`} />
                </div>

                {!hasGeneratedCover ? (
                  <div className="mt-4 rounded-[22px] border border-[rgba(255,235,200,0.16)] bg-[rgba(255,248,236,0.08)] px-4 py-3 text-[13px] leading-6 text-[#eadfca]">
                    尚未生成角色画像，当前以灵根主题插画作为默认展示。档案与属性照常可读，不影响开始修行。
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-[36px] border border-[rgba(255,240,212,0.22)] bg-[rgba(17,13,9,0.55)] px-5 py-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)] xl:px-7 xl:py-7">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-start">
            <div>
              <div className="text-[18px] text-[#f4e4c0]">角色档案</div>
              <div className="mt-1 text-[13px] leading-6 text-[#cab894]">
                当前档案会直接影响后续剧情与检定结果。无论手机还是桌面端，这里展示的都是同一份本地存档。
              </div>
            </div>
            <button
              onClick={startGame}
              className="hidden xl:block"
            >
              <img className="w-[240px]" src={$img('newCharBg/btn-start')} alt="开始修行" />
            </button>
          </div>

          <div className="mt-6 space-y-5 text-[15px] leading-8 text-[#f4ecde]">
            <SectionBlock titleImg={$img('newCharBg/title1')} title="人物背景">
              {charInfo.人物背景}
            </SectionBlock>

            <SectionBlock titleImg={$img('newCharBg/title2')} title="核心任务">
              {charInfo.核心任务}
            </SectionBlock>

            <SectionBlock titleImg={$img('newCharBg/title3')} title="外貌特征">
              {charInfo.外貌特征}
            </SectionBlock>

            {charInfo.人物关系?.length ? (
              <SectionBlock titleImg={$img('newCharBg/title4')} title="人物关系">
                <div className="space-y-2">
                  {charInfo.人物关系.map((relation, index) => (
                    <div key={index}>· {relation}</div>
                  ))}
                </div>
              </SectionBlock>
            ) : null}
          </div>

          <div className="mt-8 xl:hidden">
            <img
              className="mx-auto w-full max-w-[340px] cursor-pointer"
              src={$img('newCharBg/btn-start')}
              alt="开始修行"
              onClick={startGame}
            />
          </div>
        </section>
      </div>

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

const DefaultPortrait = ({
  attr,
  config,
  status,
}: {
  attr: string;
  config: typeof charConfig[keyof typeof charConfig];
  status: CharacterStatusType;
}) => (
  <div className="absolute inset-0 z-10 overflow-hidden">
    <div className="absolute left-1/2 top-[16%] w-[76%] max-w-[420px] -translate-x-1/2">
      <img className="w-full mix-blend-screen opacity-90" src={$img('circle')} alt="circle" />
      <img className="absolute left-1/2 top-[4%] w-[34%] -translate-x-1/2" src={config.url} alt={attr} />
    </div>
    <div className="absolute left-0 right-0 top-[14%] px-8 text-center text-[#f3eadb]">
      <div className="text-[12px] tracking-[0.32em] text-[#dccaa8]">灵根主题默认画像</div>
      <div className="mt-4 text-[28px] leading-none">{attr}</div>
      <div className="mt-3 text-[14px] text-[#dbc9a5]">突破进度 {Math.round(status.突破成功系数 * 100)}%</div>
    </div>
  </div>
);

const PortraitStat = ({ label, value, icon }: { label: string; value: number; icon: string }) => (
  <div className="rounded-[20px] border border-[rgba(255,240,212,0.16)] bg-[rgba(255,250,241,0.08)] px-3 py-3">
    <img className="mx-auto h-[20px] w-[20px]" src={icon} alt={label} />
    <div className="mt-2 text-[12px] text-[#d9c8a2]">{label}</div>
    <div className="mt-1 text-[22px] leading-none text-[#fff5e7]">{value}</div>
  </div>
);

const StatusChip = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-[20px] border border-[rgba(255,240,212,0.16)] bg-[rgba(255,250,241,0.08)] px-4 py-3">
    <div className="text-[12px] text-[#d8c59d]">{label}</div>
    <div className="mt-2 text-[18px] leading-none text-[#f7efe1]">{value}</div>
  </div>
);

const IconAction = ({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-[rgba(255,238,213,0.25)] bg-[rgba(20,16,11,0.48)]"
    aria-label={label}
    title={label}
  >
    <img src={icon} alt={label} className="h-[22px] w-[22px]" />
  </button>
);

const SectionBlock = ({
  titleImg,
  title,
  children,
}: {
  titleImg: string;
  title: string;
  children: React.ReactNode;
}) => (
  <section className="rounded-[26px] border border-[rgba(255,240,212,0.14)] bg-[rgba(255,250,241,0.06)] px-4 py-4 xl:px-5">
    <img className="w-full max-w-[420px]" src={titleImg} alt={title} />
    <div className="mt-3">{children}</div>
  </section>
);

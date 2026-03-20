import { CharacterStatusTypeWithMax } from "@/app/actions/character/constants";
import { StatusDelta } from "@/interfaces/dto";
import { $img } from "@/utils";
import { getCharStatusUrl } from "@/interfaces/const";
import { useEffect, useState } from "react";

/**
 * 角色状态栏 - 游戏推进，历史回归
 * 展示角色状态，即：体魄，道心，突破，剩余回合
 * 状态：正常展示数值
 * 副作用：有差异后1秒，展示体魄和道心的差异
 */

const deltaColor = (i: number) => i > 0 ? "#3D8070" : "#A34A06"
const deltaText = (i: number) => i > 0 ? `+${i}` :`${i}`

interface CharStatusBarProps {
  current: CharacterStatusTypeWithMax;
  delta?: StatusDelta;
}


export const CharStatusBar = ({ current, delta }: CharStatusBarProps) => {
  const [showDelta, setShowDelta] = useState(true);

  useEffect(() => {
    setShowDelta(true);
    setTimeout(() => {
      setShowDelta(false);
    }, 5000);
  }, [delta]);

  return (
    <div className="mx-auto w-full max-w-[1240px] px-2 pt-2 xl:px-4 xl:pt-3">
      <div
        className="relative flex h-[72px] flex-row items-center justify-between bg-cover bg-center px-3 text-[#111] tracking-[-0.05em] leading-[1] xl:h-[84px] xl:px-5"
        style={{ backgroundImage: `url(${$img('charStatusV3/bg1')})` }}
      >
      <div className="flex flex-col gap-1 text-[12px] text-[#111] xl:text-[14px]">
        <div className="flex flex-row items-center gap-1">
          <img className="w-[20px] h-[20px]" src={$img('charStatusV3/icon-1')} alt="" />
          <div>体魄</div>
          <div>{current.体魄.toFixed(0)}/{current.最大体魄.toFixed(0)}</div>
          {showDelta && delta && delta?.体魄 !== 0 && (
            <div style={{ color: deltaColor(delta.体魄) }}>
              {deltaText(delta.体魄)}
            </div>
          )}
        </div>
        <div className="flex flex-row items-center gap-1">
          <img className="w-[20px] h-[20px]" src={$img('charStatusV3/icon-2')} alt="" />
          <div>道心</div>
          <div>{current.道心.toFixed(0)}/{current.最大道心.toFixed(0)}</div>
          {showDelta && delta && delta?.道心 !== 0 && (
            <div style={{ color: deltaColor(delta.道心) }}>
              {deltaText(delta.道心)}
            </div>
          )}
        </div>
      </div>
      <div className="absolute left-1/2 top-1/2 text-center -translate-1/2">
        <div className="text-[28px] text-[#111] xl:text-[36px]">
          {current.行动点.toFixed(0)}/{current.最大行动点.toFixed(0)}
        </div>
        <div className="mt-[4px] text-[12px] text-[#11111180] xl:text-[13px]">劫难倒计时</div>
      </div>
      <div>
        {/* 境界图片 */}
        <img className="h-[24px] w-auto xl:h-[28px]" src={getCharStatusUrl(current.等级)} alt={current.等级} />
        <div className="mt-1 text-[12px] text-[#11111180] xl:text-[13px]">经验 {Math.round(current.突破成功系数 * 100)}%</div>
      </div>
      <div className="w-full h-[2px] absolute left-0 bottom-0 bg-[#1111114D]">
        <div style={{ width: `${current.突破成功系数 * 100}%` }} className="h-[2px] bg-[#111111]"></div>
      </div>
    </div>
    </div>
  )
}

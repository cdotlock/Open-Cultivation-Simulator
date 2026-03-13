"use client";
import React from 'react';
import { difficultyLevels } from '@/interfaces/schemas';

type DiceOverlayProps = {
  show: boolean;
  rollingDice: [number, number];
  finalDice: [number, number] | null;
  difficultyText?: string;
  dcValue?: number | null;
  // 结果：成功或失败（用于替换上半块的 DC 为文案）
  resultSuccess?: boolean | null;
  onClose?: () => void;
};

/**
 * 2d6 动画覆盖层
 * - 背景半透明灰
 * - 居中显示上下两段框体，间隔很小
 * - 在框体中展示两枚骰子的点数（滚动时快速随机，收到结果后显示最终值）
 */
export const DiceOverlay: React.FC<DiceOverlayProps> = ({ show, rollingDice, finalDice, difficultyText, dcValue, resultSuccess, onClose }) => {
  const topUrl = '/subtract.svg';
  const topMaskUrl = '/mask-group.png';
  const bottomUrl = '/group-1312335718@2x.png';
  const diceBgUrl = '/Group 1312335753.png';

  const [d1, d2] = finalDice ?? rollingDice;
  const computedDC = dcValue ?? (
    difficultyText === '轻而易举' ? 4 :
    difficultyText === '按部就班' ? 7 :
    difficultyText === '普通' ? 8 :
    difficultyText === '挑战重重' ? 10 :
    difficultyText === '困难' ? 11 :
    difficultyText === '困难卓绝' ? 12 :
    difficultyText === '极困难' ? 13 :
    difficultyText === '逆天而行' ? 14 :
    null
  );
  const [entered, setEntered] = React.useState(false);
  const [bounceL, setBounceL] = React.useState(false);
  const [bounceR, setBounceR] = React.useState(false);

  React.useEffect(() => {
    if (!show) {
      setEntered(false);
      return;
    }
    const t = setTimeout(() => setEntered(true), 10);
    return () => clearTimeout(t);
  }, [show]);

  // 数字变化时做一次缩放动画，增强“滚动感”
  React.useEffect(() => {
    if (!show) {
      return;
    }
    setBounceL(true);
    const t = setTimeout(() => setBounceL(false), 180);
    return () => clearTimeout(t);
  }, [d1, show]);

  React.useEffect(() => {
    if (!show) {
      return;
    }
    setBounceR(true);
    const t = setTimeout(() => setBounceR(false), 180);
    return () => clearTimeout(t);
  }, [d2, show]);

  if (!show) return null;


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${entered ? 0 : 20}px)`,
          opacity: entered ? 1 : 0,
          transition: 'transform 600ms ease, opacity 600ms ease',
          transitionDelay: '800ms'
        }}
      >
        {/* 上半部分 */}
        <div className="relative w-[247px] h-[123px]">
          <div className="absolute w-[247px] h-[123px] top-0 left-0">
            <div className="relative w-[251px] h-[127px] -top-0.5 -left-0.5 bg-[100%_100%]" style={{ backgroundImage: `url(${topUrl})` }}>
              <img className="absolute w-[247px] h-[123px] top-0.5 left-0.5" alt="Mask group" src={topMaskUrl} />
            </div>
          </div>
          {/* 顶部信息：难度与DC */}
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none">
            <div className="mb-2 text-sm font-semibold leading-tight text-center" style={{ color: '#CCC2C3' }}>
              <div>难度</div>
              <div>等级</div>
            </div>
            {resultSuccess == null ? (
              <div className="text-5xl font-extrabold leading-none" style={{ color: '#FFE7C4' }}>
                {computedDC != null ? computedDC : ''}
              </div>
            ) : (
              <div className="text-4xl font-extrabold leading-none" style={{ color: resultSuccess ? '#68C783' : '#E57373' }}>
                {resultSuccess ? '成功' : '失败'}
              </div>
            )}
          </div>
        </div>

        {/* 微小间隔 */}
        <div className="h-1" />

        {/* 下半部分 */}
        <div className="relative w-[247px] h-[231px]">
          {/* 原底部块保留不变 */}
          <img className="absolute w-[251px] h-[235px] top-0 left-0" alt="Group" src={bottomUrl} />

          {/* 覆盖在底部块上的两列：每列上方为数字，下方为图片（图片作为数字的背景，整体悬浮） */}
          <div className="absolute inset-0 flex items-end justify-center pointer-events-none">
            <div className="mb-23 flex flex-row items-end justify-center gap-3">
              {/* 左列 */}
              <div className="relative w-28 h-28">
                <img src={diceBgUrl} alt="dice-bg-left" className="absolute inset-0 w-full h-full object-cover" />
                <div
                  className="absolute inset-0 flex items-center justify-center font-extrabold"
                  style={{
                    color: '#FFE7C4',
                    fontSize: '2.75rem',
                    lineHeight: 1,
                    transform: `scale(${bounceL ? 1.15 : 1})`,
                    transition: 'transform 180ms ease-out'
                  }}
                >
                  {d1}
                </div>
              </div>
              {/* 右列 */}
              <div className="relative w-28 h-28">
                <img src={diceBgUrl} alt="dice-bg-right" className="absolute inset-0 w-full h-full object-cover" />
                <div
                  className="absolute inset-0 flex items-center justify-center font-extrabold"
                  style={{
                    color: '#FFE7C4',
                    fontSize: '2.75rem',
                    lineHeight: 1,
                    transform: `scale(${bounceR ? 1.15 : 1})`,
                    transition: 'transform 180ms ease-out'
                  }}
                >
                  {d2}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DiceOverlay;


"use client";
import React, { useState, useEffect, useRef } from 'react';
import { GameOptionType } from '@/interfaces';
import { difficultyLevelMap, getDiceImage } from '@/interfaces/const';
import { $img } from '@/utils';

const DiceAnimate2 = (props: { option: GameOptionType, timeout: () => void }) => {
  const option = props.option;
  const [phase, setPhase] = useState<'entering' | 'rolling' | 'result' | 'success'>('entering');
  const [showClose, setShowClose] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [dice1, setDice1] = useState(1);
  const [dice2, setDice2] = useState(1);

  // 计算基础骰子值
  const baseDiceValue = (option?.骰子?.[0] || 0) + (option?.骰子?.[1] || 0);

  const appliedModifier = option?.修正值 || 0;

  // 计算最终总值（基础值 + 总修正）
  const totalDiceValue = baseDiceValue + appliedModifier;

  // 检定目标DC
  const dcValue = difficultyLevelMap.get(option?.选项难度 || "轻而易举") ?? 4;

  const containerRef = useRef<HTMLDivElement>(null);
  const circleContainerRef = useRef<HTMLDivElement>(null);
  const diceContainerRef = useRef<HTMLDivElement>(null);
  const checkInfoRef = useRef<HTMLDivElement>(null);
  const reasonsContainerRef = useRef<HTMLDivElement>(null);
  const diceValueRef = useRef<HTMLSpanElement>(null);

  // 仅在摇骰阶段显示"？"
  useEffect(() => {
    if (diceValueRef.current) {
      if (phase === 'entering' || phase === 'rolling') {
        diceValueRef.current.textContent = "？";
      }
    }
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    let rollInterval: ReturnType<typeof setInterval> | null = null;

    const animateSequence = async () => {
      const sleep = (ms: number) => new Promise<void>(resolve => {
        setTimeout(resolve, ms);
      });

      // 1. 背景出现动画 - 透明度0-1，1s
      if (!cancelled && containerRef.current) {
        containerRef.current.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: 1000,
          easing: 'ease-out',
          fill: 'forwards'
        });
      }

      await sleep(500);
      if (cancelled) return;

      // 2. 顶部circle元素出现
      if (circleContainerRef.current) {
        circleContainerRef.current.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: 1000,
          easing: 'ease-out',
          fill: 'forwards'
        });
      }

      await sleep(500);
      if (cancelled) return;

      // 3. 骰子和检定信息出现
      if (diceContainerRef.current) {
        diceContainerRef.current.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: 1000,
          easing: 'ease-out',
          fill: 'forwards'
        });
      }

      if (checkInfoRef.current) {
        checkInfoRef.current.animate([
          { opacity: 0 },
          { opacity: 1 }
        ], {
          duration: 1000,
          easing: 'ease-out',
          fill: 'forwards'
        });
      }

      // 开始骰子滚动动画
      setPhase('rolling');
      rollInterval = setInterval(() => {
        if (cancelled) return;
        setDice1(Math.floor(Math.random() * 6) + 1);
        setDice2(Math.floor(Math.random() * 6) + 1);
      }, 100);

      await sleep(2000);
      if (cancelled) return;

      // 4. 停止滚动，先显示骰子原始点数（不含修正）
      setPhase('result');
      setDice1(option?.骰子?.[0] || 1);
      setDice2(option?.骰子?.[1] || 1);
      if (rollInterval) {
        clearInterval(rollInterval);
        rollInterval = null;
      }

      // 先展示原始骰子值，让玩家看清楚投了多少
      if (diceValueRef.current) {
        diceValueRef.current.textContent = `${baseDiceValue}`;
      }

      await sleep(900);
      if (cancelled) return;

      // 5. 修正值原因浮现（如果有修正）
      if (option?.变动原因 && option.变动原因.length > 0) {
        setShowReasons(true);
        await sleep(50); // 等一帧让 React 渲染容器
        if (cancelled) return;
        if (reasonsContainerRef.current) {
          reasonsContainerRef.current.animate([
            { opacity: 0 },
            { opacity: 1 }
          ], {
            duration: 800,
            easing: 'ease-out',
            fill: 'forwards'
          });
        }
        await sleep(1000);
        if (cancelled) return;
      }

      // 6. 过渡到最终总值（含修正）并变色
      if (diceValueRef.current) {
        // 如果有修正值，先把数字更新为最终值再做颜色动画
        if (appliedModifier !== 0) {
          diceValueRef.current.textContent = `${totalDiceValue}`;
        }
        const animation = diceValueRef.current.animate([
          {
            transform: 'scale(1.4)',
            color: option?.是否成功 ? '#10B981' : '#EF4444'
          },
          {
            transform: 'scale(1)',
            color: option?.是否成功 ? '#10B981' : '#EF4444'
          }
        ], {
          duration: 1200,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          fill: 'forwards'
        });

        await new Promise<void>(resolve => {
          animation.onfinish = () => resolve();
        });
      }

      if (cancelled) return;

      // 7. 进入success阶段，显示关闭按钮
      setPhase('success');
      setShowClose(true);
    };

    animateSequence();

    return () => {
      cancelled = true;
      if (rollInterval) {
        clearInterval(rollInterval);
      }
    };
  // 只依赖 option 本身，避免 props/派生值变化重触发动画
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [option]);

  return (
    <div className="fixed inset-0 z-40 bg-[#000000cd] flex items-center justify-center">
      <div
        ref={containerRef}
        className="relative w-[350px] min-h-[450px] opacity-0"
        style={{ background: `url(${$img('newDice/bg-main')}) center / 100% 100% no-repeat` }}
      >
        {/* 背景图案平铺，一半在背景内一半超出 */}
        <div ref={circleContainerRef} className="absolute w-[108px] h-[108px] left-1/2 top-0 leading-[1] flex flex-col justify-center items-center -translate-1/2 overflow-hidden opacity-0"
          style={{ background: `url(${$img('newDice/circle')}) center / cover no-repeat`}}
        >
          <div className='text-white text-[40px]'>{difficultyLevelMap.get(option?.选项难度 || "轻而易举")}</div>
          <div className='text-white text-[14px] mt-[8px]'>{option?.选项难度 || "轻而易举"}</div>
          <div className='text-[#FFFFFF80] text-[12px] mt-[4px]'>难度</div>
        </div>

        {/* 主内容区域 */}
        <div className="relative z-10 flex flex-col items-center pt-[74px]">
          {/* 骰子显示 */}
          <div
            ref={diceContainerRef}
            className="flex gap-5 opacity-0"
          >
            <div className="relative w-[108px] h-[108px]">
              <img src={getDiceImage(dice1)} alt="dice-bg" className="absolute inset-0 w-full h-full object-cover" />
            </div>
            <div className="relative w-[108px] h-[108px]">
              <img src={getDiceImage(dice2)} alt="dice-bg" className="absolute inset-0 w-full h-full object-cover" />
            </div>
          </div>

          {/* 检定信息 */}
          <div ref={checkInfoRef} className="text-center mb-4 text-[#F3E0BB] opacity-0">
            <div className="text-[15px] mt-2">
              {option?.选项类别}检定
            </div>
            <div className="text-[24px] mt-1">
              2D6 = <span ref={diceValueRef}>？</span>
            </div>
          </div>

          {/* 分割线 */}
          <div className="w-[calc(100vw-96px)] h-px mb-4" 
            style={{ background: `url(${$img('newDice/line')}) center / cover no-repeat` }} />

          {/* 变动原因/加成列表 - 两列布局，变色后才显示 */}
          {showReasons && option?.变动原因 && option.变动原因.length > 0 && (
            <div ref={reasonsContainerRef} className="w-full px-4 opacity-0">
              <div className="grid grid-cols-2 gap-4">
                {option.变动原因.map((reason, index) => {
                  // 解析变动原因格式，支持多种格式
                  let name = reason;
                  let value = "";

                  if (reason.includes('+')) {
                    const parts = reason.split('+');
                    name = parts[0];
                    value = `+${parts[1]}`;
                  } else if (reason.includes('加成')) {
                    // 处理"XX加成+数字"格式
                    const match = reason.match(/(.+?)(\+\d+)$/);
                    if (match) {
                      name = match[1];
                      value = match[2];
                    }
                  }

                  return (
                    <div key={index} className="text-center text-[14px] w-full justify-center items-center aspect-[144/32] flex flex-row"
                      style={{background: `url(${$img('newDice/reason')}) center / 100% 100% no-repeat`}}
                    >
                      <div className="text-white mb-1">{name}</div>
                      <div className="text-white font-bold">{value}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 手动关闭按钮，动画全部结束后出现 */}
        {showClose && (
          <button
            onClick={props.timeout}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-[#c9a96e] bg-[rgba(40,28,14,0.82)] px-6 py-2 text-[13px] tracking-[0.14em] text-[#f3e0bb] hover:bg-[rgba(60,42,20,0.92)] transition-colors"
          >
            继续
          </button>
        )}
      </div>
    </div>
  );
};

export default DiceAnimate2;

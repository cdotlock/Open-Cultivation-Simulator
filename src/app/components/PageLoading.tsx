import { useEffect, useRef, useState } from "react";
import { useRecoilState } from 'recoil';
import { loadingState, pageState } from '@/app/store'
import { loadingText as textListInfo } from "./const/loadingText";

const { create: textList } = textListInfo;

// 预设的loading时间（秒）
const presetLoadingTime = 20;
// 最大进度值
const maxProgress = 99;
// 快速增长的概率
const fastGrowthChance = 0.1;
// 快速增长时的最小和最大增量
const fastGrowthRange = { min: 8, max: 12 };

export default function PageLoading() {
  const setPage = useRecoilState(pageState)[1];
  const loadingText = useRecoilState(loadingState)[0];
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [noTransition, setNoTransition] = useState(false);
  const [progress, setProgress] = useState(0);

  const timer1 = useRef<NodeJS.Timeout | undefined>(void 0);
  const timer2 = useRef<NodeJS.Timeout | undefined>(void 0);

  useEffect(() => {
    // 每5秒切换一次文字
    timer1.current = setInterval(() => {
      if (currentTextIndex < textList.length - 1) {
        setNoTransition(false);
        setIsAnimating(true);

        // 动画结束后更新索引并重置位置
        setTimeout(() => {
          setNoTransition(true); // 取消过渡效果
          setCurrentTextIndex(prev => prev + 1);
          setIsAnimating(false);
        }, 500);
      }
    }, 5000);

    return () => {
      clearInterval(timer1.current);
    };
  }, [currentTextIndex]);

  // 回调时，淡出并跳转
  useEffect(() => {
    if (loadingText[0]) {
      setFadeOut(true);
      clearInterval(timer1.current);
      clearInterval(timer2.current);
      setTimeout(() => {
        setPage(loadingText[1]);
        setProgress(100);
      }, 500);
    }
  }, [loadingText, setPage]);

  useEffect(() => {
    let currentProgress = 0;
    let lastUpdateTime = Date.now();

    const updateProgress = () => {
      const now = Date.now();
      const deltaTime = (now - lastUpdateTime) / 1000; // 转换为秒
      lastUpdateTime = now;

      // 如果当前进度接近最大值，减缓增长速度
      if (currentProgress >= maxProgress - 5) {
        return;
      }

      // 随机决定是否使用快速增长
      if (Math.random() < fastGrowthChance) {
        // 快速随机增长
        const randomIncrease = Math.floor(
          Math.random() * (fastGrowthRange.max - fastGrowthRange.min) + fastGrowthRange.min
        );
        currentProgress = Math.min(maxProgress - 1, currentProgress + randomIncrease);
      } else {
        const baseIncrease = (maxProgress / presetLoadingTime) * deltaTime;
        currentProgress = Math.min(maxProgress - 1, currentProgress + baseIncrease);
      }

      setProgress(Math.floor(currentProgress));
    };

    // 每100ms更新一次进度
    timer2.current = setInterval(updateProgress, 300);

    // 确保在预设时间后达到最大值
    const finalTimer = setTimeout(() => {
      setProgress(maxProgress);
      clearInterval(timer2.current);
    }, presetLoadingTime * 1000);

    return () => {
      clearInterval(timer2.current);
      clearTimeout(finalTimer);
    };
  }, []);

  return (
    <div
      className={`
        relative 
        w-full 
        h-[calc(100vh-48px)] 
        overflow-hidden
        ${fadeOut ? 'animate-fadeOut' : 'animate-fadeIn'}
      `}
    >
      {/* 文字容器 */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-[56px] overflow-hidden">
        {/* 固定的两个文本框 */}
        <div className="relative w-full h-full">
          {/* 当前文字 */}
          <div
            className={`
              absolute 
              w-full
              text-[28px] 
              text-center
              ${!noTransition ? 'transition-transform duration-500 ease-in-out' : ''}
              ${isAnimating ? '-translate-y-[60px]' : 'translate-y-0'}
            `}
          >
            {textList[currentTextIndex]}
          </div>

          <div
            className={`
              absolute 
              w-full
              text-[28px] 
              text-center
              ${!noTransition ? 'transition-transform duration-500 ease-in-out' : ''}
              ${isAnimating ? 'translate-y-0' : 'translate-y-[60px]'}
            `}
          >
            {currentTextIndex < textList.length - 1 ? textList[currentTextIndex + 1] : ''}
          </div>
        </div>
      </div>

      {/* 添加进度显示 */}
      <div className="w-full h-[2px] bg-[#1111114C] fixed bottom-[78px] left-0" />
      <div className="h-[2px] bg-[#1111114C] fixed bottom-[78px] left-0" style={{ width: `${progress}%` }} />
      <div className="fixed bottom-[60px] text-black text-[14px]" style={{ left: `${progress - 5}%` }}>
        {progress}%
      </div>
    </div>
  );
}

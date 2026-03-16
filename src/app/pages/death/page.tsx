'use client';

import { useCallback, useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRecoilValue } from 'recoil';
import { $img } from '@/utils';
import useRoute from '@/app/hooks/useRoute';
import { characterState } from '@/app/store';
import { performLocalRevive, getLocalReviveStatus } from '@/app/actions/revive/action';

const JudgementPageContent = ({ handleBirth }: { handleBirth: () => void }) => {
  const searchParams = useSearchParams();
  const { routerTo } = useRoute();
  const [deathJudgement, setDeathJudgement] = useState<string[]>([]);

  useEffect(() => {
    const judgement = searchParams.get('judgement');
    if (judgement) {
      setDeathJudgement(decodeURIComponent(judgement).split("\n"));
    }
  }, [searchParams]);

  const handleBackToHome = useCallback(() => {
    routerTo('home');
  }, [routerTo]);

  if (!deathJudgement.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-[#e2e2e2] text-xl">加载中...</div>
      </div>
    );
  }

  return (
    <>
      <img className="w-40 h-32 mt-20" src={$img('death-title')} alt="death-title" />
      <div className="text-[#e2e2e2] text-xl mt-8 text-center px-6">{deathJudgement[0]}</div>
      <div className="p-6 max-h-96 overflow-y-auto">
        <div className="text-[15px] text-[#E2E2E2B2] leading-relaxed whitespace-pre-line text-center">
          {deathJudgement.slice(1).join("\n")}
        </div>
      </div>
      <div className="flex flex-row gap-[8px] justify-center mt-[auto] mb-[50px]">
        
        <img className='w-[45%] aspect-[4.25] cursor-pointer' onClick={handleBackToHome} src={$img('btn-back-to-home')} alt="lose-memory" />
        {/* 投胎转世按钮（复活按钮） */}
        <img className='w-[45%] aspect-[4.25] cursor-pointer' onClick={handleBirth} src={$img('death/reincarnation')} alt="retain-memory" />
      </div>
    </>
  )
}

const JudgementPage = ({ handleBirth }: { handleBirth: () => void }) => {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-full">
        <div className="text-[#e2e2e2] text-xl">加载中...</div>
      </div>
    }>
      <JudgementPageContent handleBirth={handleBirth} />
    </Suspense>
  );
}

const RerebirthPage = () => {
  const [animationState, setAnimationState] = useState(5);
  const [reviveStatus, setReviveStatus] = useState<{
    freeReviveUsed: boolean;
    paidReviveCount: number;
    canUseFreeRevive: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { routerTo } = useRoute();
  const character = useRecoilValue(characterState);

  // 获取复活状态
  useEffect(() => {
    const fetchReviveStatus = async () => {
      try {
        const result = await getLocalReviveStatus();
        if (result.success && result.data) {
          setReviveStatus(result.data);
        }
      } catch (error) {
        console.error('获取复活状态失败:', error);
      }
    };
    
    fetchReviveStatus();
  }, []);

  // 免费复活
  const handleFreeRevive = async () => {
    if (!character?.id) {
      alert('角色信息获取失败，请重试');
      return;
    }

    setIsLoading(true);
    try {
      const result = await performLocalRevive(character.id);
      if (result.success) {
        localStorage.setItem('isRebirth', 'true');
        routerTo('char');
      } else {
        alert(result.error || '免费复活失败');
      }
    } catch (error) {
      console.error('免费复活失败:', error);
      alert('免费复活失败，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetainMemory = () => {
    handleFreeRevive();
  };

  const handleBackToHome = useCallback(() => {
    routerTo('home');
  }, [routerTo]);

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimationState(prev => {
        if (prev === 0) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 600);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      <img
        className={`w-[184px] h-[184px] mt-auto transition-all duration-1000 ${
          animationState > 3 ? 'translate-y-[100px] opacity-0' : 'translate-y-0 opacity-100'}`}
        src={$img('death/mp-soup')}
        alt="mp-soup"
      />
      <div className={`text-[#e2e2e2] flex flex-col leading-[24px] items-center text-[16px] transition-all duration-1000 ${
        animationState > 2 ? 'translate-y-[100px] opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div>这是一碗孟婆汤</div>
        <div>按规矩，投胎前需饮此汤</div>
        <div>你会丧失记忆，重获新生</div>
        <div>若心怀不甘，不愿忘记</div>
        <div>现有一法可以保存记忆</div>
        <div>服下这枚<span className='text-[#D7C576]'>忆尘丹</span></div>
        <div className='text-[#D7C576]'>可保你记忆延续，功力不减</div>
      </div>
      <img
        className={`w-[88px] h-[88px] mb-[45px] mt-[30px] cursor-pointer transition-all duration-1000 ${
          animationState > 1 ? 'translate-y-[100px] opacity-0' : 'translate-y-0 opacity-100'}`}
        src={$img('death/dan')}
        alt="dan"
      />
      <div className={`flex flex-row gap-[8px] justify-center mt-[auto] mb-[50px] transition-all duration-1000 ${
        animationState > 0 ? 'translate-y-[100px] opacity-0' : 'translate-y-0 opacity-100'}`}>
        <div onClick={handleBackToHome} className='w-[45%]'>
          <img className='w-full aspect-[4.25]' src={$img('death/lose-memory')} alt="lose-memory" />
        </div>
        
        <div onClick={isLoading ? undefined : handleRetainMemory} className={`w-[45%] ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
          {isLoading ? (
            <div className="w-full aspect-[4.25] bg-gray-600 rounded flex items-center justify-center text-white">
              处理中...
            </div>
          ) : reviveStatus?.canUseFreeRevive ? (
            <img className='w-full aspect-[4.25]' src={$img('death/retain-memory')} alt="retain-memory" />
          ) : (
            <img className='w-full aspect-[4.25]' src={$img('death/retain-memory')} alt="retain-memory-pay" />
          )}
        </div>
      </div>
    </>
  )
}

export default function DeathPage() {
  const [pageState, setPageState] = useState<"judgement" | "rebirth">("judgement");

  return (
    <div
      style={{ background: `url(${$img('bg-end')}) center / cover no-repeat` }}
      className="flex min-h-screen flex-col items-center justify-center z-50 font-family-song"
    >
      {pageState === "judgement" && <JudgementPage handleBirth={() => setPageState("rebirth")} />}
      {pageState === "rebirth" && <RerebirthPage />}
    </div>
  );
}

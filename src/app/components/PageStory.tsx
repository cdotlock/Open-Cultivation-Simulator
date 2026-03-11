import { useRecoilState } from "recoil";
import { characterState, gamePushState } from "../store";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { $img } from "@/utils";
import { GameOptionType, BreakthroughResponse } from "@/interfaces";
import { pushGame } from "../actions/game/action";
import { analyzeCustomOption } from "../actions/module/analyzeOption";
import { useRouter } from 'next/navigation';
import { difficultyLevelMap, attrIconMap, statusIconMap } from "@/interfaces/const";
import { useBgm } from '../hooks/useBgm';
import { CharStatusBar } from "./CharStatusBar";
import useRoute from "../hooks/useRoute";
import DiceAnimate2 from "./DiceAnimate2";
import { trackEvent, trackPageView, UmamiEvents } from "@/lib/analytics/umami";

interface gameState {
  status: "streaming" | "loading" | "playing" | "breakthrough";
  breakResult?: BreakthroughResponse;
  loadingAnimateState?: boolean;
}

interface imageGenerationState {
  showImage: boolean;
  imageUrl?: string;
  error?: string;
}

const storyProseClass = "mx-6 mt-4 whitespace-pre-wrap text-[20px] leading-[1.9] text-[#524a37]";

// 将剧情文本转换为段落化 HTML，便于后续展示
const buildStoryHtml = (story: string) => {
  if (!story) {
    return "";
  }

  const normalized = story.replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${paragraph.replace(/\n/g, '<br />')}</p>`)
    .join("");
};

// 自定义输入按钮组件
const CustomInputButton = ({ onClick }: { onClick: (customInput: string) => void }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleButtonClick = () => {
    setIsModalOpen(true);
  };

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onClick(inputValue.trim());
      setIsModalOpen(false);
      setInputValue('');
    }
  };

  const handleClose = () => {
    setIsModalOpen(false);
    setInputValue('');
  };

  return (
    <>
      <div 
        className="font-bold cursor-pointer w-full h-12 bg-[#222222] text-white flex items-center justify-center rounded"
        onClick={handleButtonClick}
      >
        <img className="w-[20px] h-[20px] mr-1" src={$img('newStory/icon-edit')} alt="" />
        <div>
          我有其他行动的想法
        </div>
      </div>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* 灰色蒙版 */}
          <div className="absolute inset-0 bg-[#F2EBD999] backdrop-blur-[3px]" onClick={handleClose} />
          {/* 输入面板 */}
          <div className="relative z-50 w-full mx-6">
            <div className="flex gap-3 mb-3 rounded-lg bg-[#222222]">
              {/* 左侧文本输入区 */}
              <textarea
                className="flex-1 p-3 text-white border border-none resize-y focus:outline-none"
                placeholder="请输入您的自定义输入..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
              <img onClick={handleSubmit} className="w-[40px] h-[40px] mt-auto" src={$img('newStory/story-submit')} alt="" />
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// 游戏选项组件
const GameOptions = ({ onNext, onCustomInput }: {
  onNext: (option: GameOptionType) => void;
  onCustomInput: (customInput: string) => void;
}) => {
  const [gamePush] = useRecoilState(gamePushState);
  if(!gamePush) {
    throw new Error("No game push");
  }
  const playerOptions = gamePush.gamePush.节点要素.剧情要素.玩家选项
  console.log(playerOptions, gamePush)

  return <div className="my-20 flex flex-col gap-6 text-white text-sm text-center">
    {playerOptions.length > 0 && playerOptions.map((item, index) => (
      <div 
        key={index} 
        className="cursor-pointer gap-1 flex flex-row items-center justify-center w-full aspect-[327/48]"
        style={{background: `url(${$img('newStory/story-select-bg')}) center center / cover no-repeat`}}
        onClick={() => onNext(item)}
      >
        <div className="flex-shrink-0 text-sm text-center">
          [{item.选项类别} - {item.选项难度}]
        </div>
        <div className="text-sm text-center">{item.选项描述}</div>
      </div>
    ))}
    <CustomInputButton onClick={onCustomInput} />
  </div>
};

const StatusStreaming = ({ complete }: { complete: (story: string) => void }) => {
  const [gamePush] = useRecoilState(gamePushState);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const startTimeRef = useRef<number>(0);

  const storyText = useMemo(() => {
    const storyNode = gamePush?.gamePush?.节点要素?.剧情要素;
    const summary = storyNode?.剧情  || "";
    return summary.trim();
  }, [gamePush]);

  useEffect(() => {
    if (!gamePush) {
      setDisplayText("");
      setIsTyping(false);
      return;
    }

    if (!storyText) {
      setDisplayText("");
      setIsTyping(false);
      complete("");
      return;
    }

    const characters = Array.from(storyText);
    if (characters.length === 0) {
      setIsTyping(false);
      complete("");
      return;
    }

    setDisplayText("");
    setIsTyping(true);
    startTimeRef.current = (typeof performance !== 'undefined' ? performance.now() : Date.now());

    let index = 0;
    const timer = window.setInterval(() => {
      setDisplayText((prev) => prev + characters[index]);
      index += 1;

      if (index >= characters.length) {
        window.clearInterval(timer);
        setIsTyping(false);
        const end = (typeof performance !== 'undefined' ? performance.now() : Date.now());
        const durationMs = Math.max(0, Math.round(end - startTimeRef.current));
        trackEvent(UmamiEvents.故事生成完成, { chars: characters.length, ms: durationMs });
        complete(buildStoryHtml(storyText));
      }
    }, 35);

    return () => {
      window.clearInterval(timer);
    };
  }, [complete, gamePush, storyText]);

  return (
    <div className={storyProseClass}>
      {displayText}
      {isTyping && <span className="animate-pulse">▌</span>}
    </div>
  );
}

// 加载页面组件 - 迁移自 PageStory.tsx
const StatusLoading = ({ loadingAnimateState = true }: { loadingAnimateState?: boolean }) => {
  const [displayText, setDisplayText] = useState("");
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [fadeOut, setFadeOut] = useState(false);

  // 新增更多加载提示文案
  const loadingTexts = [
    "天地灵气正在汇聚",
    "因果轮回悄然运转",
    "命数轨迹逐渐清晰",
    "三千大道正在推演",
    "时空长河泛起涟漪",
    "造化玉碟解析天机"
  ];

  useEffect(() => {
    if (loadingAnimateState) {
      const currentText = loadingTexts[currentTextIndex];
      let charIndex = 0;

      // 打字机效果
      const typing = setInterval(() => {
        if (charIndex <= currentText.length) {
          setDisplayText(currentText.slice(0, charIndex) + (charIndex === currentText.length ? "" : "▌"));
          charIndex++;
        } else {
          clearInterval(typing);
          // 切换到下一条文案
          setTimeout(() => {
            setCurrentTextIndex((prev) => (prev + 1) % loadingTexts.length);
          }, 2000);
        }
      }, 100);

      return () => clearInterval(typing);
    }
  }, [currentTextIndex, loadingAnimateState]);

  return (
    <div className={`text-xl relative flex justify-center items-center w-full h-[calc(100vh-170px)] ${fadeOut ? "animate-(--animate-fade-out)" : 'animate-(--animate-fade-in)'
      }`}>
      <div className="translate-1/2 scale-70 translate-y-[150%] text-[#1111114D]"></div>
      <div className={`transition-all ${loadingAnimateState ? 'scale-70 -translate-y-[150%] text-[#1111114D]' : 'text-[#111]'}`}>
        命运齿轮正在转动
      </div>
      <div className={`absolute transition-all break-keep top-1/2 left-1/2 -translate-1/2 ${loadingAnimateState ? 'text-[#111]' : 'scale-70 translate-y-[150%] text-[#1111114D]'
        }`}>
        <div className="typing-effect font-mono">
          {displayText}
        </div>
      </div>
    </div>
  );
};

const DiceAnimate = ( props: { option: GameOptionType, timeout: () => void }) => {
  const option = props.option
  const [phase, setPhase] = useState<'entering' | 'rolling' | 'result' | 'success'>('entering')
  const [dice1, setDice1] = useState(1)
  const [dice2, setDice2] = useState(1)
  
  // 计算总点数（基础骰子 + 额外点数）
  const totalDiceValue = option?.骰子?.reduce((sum, val) => sum + val, 0) || 0
  const baseDiceValue = (option?.骰子?.[0] || 0) + (option?.骰子?.[1] || 0)
  const extraPoints = totalDiceValue - baseDiceValue
  
  const topPanelRef = useRef<HTMLDivElement>(null)
  const diceContainerRef = useRef<HTMLDivElement>(null)
  const difficultyNumberRef = useRef<HTMLDivElement>(null)
  const resultTextRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const animateSequence = async () => {
      // 1. 入场动画 - 弹窗先出现
      if (topPanelRef.current) {
        topPanelRef.current.animate([
          { transform: 'translateY(20px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ], {
          duration: 600,
          delay: 800,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          fill: 'forwards'
        })
      }

      // 骰子容器错开100ms出现
      if (diceContainerRef.current) {
        diceContainerRef.current.animate([
          { transform: 'translateY(20px)', opacity: 0 },
          { transform: 'translateY(0)', opacity: 1 }
        ], {
          duration: 600,
          delay: 900,
          easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          fill: 'forwards'
        })
      }

      // 2. 等待入场动画完成后开始滚动
      setTimeout(() => {
        setPhase('rolling')
        
        // 开始滚动动画
        const rollInterval = setInterval(() => {
          setDice1(Math.floor(Math.random() * 6) + 1)
          setDice2(Math.floor(Math.random() * 6) + 1)
        }, 100)

        // 2秒后停止滚动，显示最终结果
        setTimeout(() => {
          setPhase('result')
          setDice1(option?.骰子?.[0] || 1)
          setDice2(option?.骰子?.[1] || 1)
          clearInterval(rollInterval)

          // 难度等级数字动画：先变大后变小
          if (difficultyNumberRef.current) {
            const scaleAnimation = difficultyNumberRef.current.animate([
              { transform: 'scale(1)', color: '#FFE7C4' },
              { transform: 'scale(1.3)', color: option?.是否成功 ? '#10B981' : '#EF4444' },
              { transform: 'scale(1)', color: option?.是否成功 ? '#10B981' : '#EF4444' }
            ], {
              duration: 800,
              easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)'
            })

            // 数字动画完成后显示成功/失败文字
            scaleAnimation.onfinish = () => {
              setPhase('success')
              
              // 维持2秒后消失
              setTimeout(() => {
                props.timeout()
              }, 2000)
            }
          }
        }, 2000)
      }, 1500) // 等待入场动画完成(800 + 600 + 100ms缓冲)
    }

    animateSequence()
  }, [option, props])

  return <div className="fixed inset-0 z-40 bg-[#0000009e] flex flex-col gap-[12px] justify-center items-center">
    <div 
      ref={topPanelRef}
      className="w-[247px] h-[123px] flex flex-col justify-center items-center opacity-0"
      style={{ background: `url(${$img('story/dice-top')}) center center / cover no-repeat` }}
    >
      <div className="w-[3em] text-center text-[18px] leading-[1] text-[#CCC2C3]">难度等级</div>
      <div className="mt-[8px] text-[40px] leading-[1] text-[#D4752D]">
        {phase === 'success' ? (
          <div ref={resultTextRef}>
            {option?.是否成功 ? "成功" : "失败"}
          </div>
        ) : (
          <div 
            ref={difficultyNumberRef}
            className="text-[#FFE7C4]"
          >
            {phase === 'rolling' ? difficultyLevelMap.get(option?.选项难度 || "轻而易举") : difficultyLevelMap.get(option?.选项难度 || "轻而易举")}
          </div>
        )}
      </div>
    </div>
    
    <div 
      ref={diceContainerRef}
      className="w-[247px] h-[231px] opacity-0" 
      style={{ background: `url(${$img('story/dice-button')}) center center / cover no-repeat` }}
    >
      <div className="flex mt-[26px] flex-row justify-center text-[#FFE7C4] text-[56px] items-center gap-[12px]">
        <div 
          className={`w-[108px] h-[108px] flex flex-col justify-center items-center transition-all duration-150 ${
            phase === 'rolling' ? 'animate-pulse scale-110' : ''
          }`}
          style={{ background: `url(${$img('story/dice')}) center center / cover no-repeat` }}
        >
          {dice1}
        </div>
        <div
          className={`w-[108px] h-[108px] flex flex-col justify-center items-center transition-all duration-150 ${
            phase === 'rolling' ? 'animate-pulse scale-110' : ''
          }`}
          style={{ background: `url(${$img('story/dice')}) center center / cover no-repeat` }}
        >
          {dice2}
        </div>
      </div>
      
      {/* 额外点数信息显示 */}
      {phase !== 'rolling' && extraPoints > 0 && (
        <div className="text-center text-[#FFE7C4] text-[20px] mt-2">
          {baseDiceValue} + {extraPoints} = {totalDiceValue}
        </div>
      )}

          {/* 底部额外点数记录区域 */}
      {(phase === 'result' || phase === 'success') && option?.变动原因 && option.变动原因.length > 0 && (
        <div className="w-full text-[14px] h-[100px] text-[#CCC2C3] flex flex-col items-center justify-center gap-1">
          {option.变动原因.map((reason, index) => (
            <div key={index}>{reason}</div> 
          ))}
        </div>
      )}
    </div>
  </div>
}

const StatusPlaying = ({ story, onNext, setGameState, imageUrl, imageError, showImage }: { story: string, onNext: (option: GameOptionType) => void, setGameState: (state: gameState) => void, imageUrl?: string, imageError?: string, showImage?: boolean }) => {
  const [option, setOption] = useState<GameOptionType | null>(null)
  const [tempImg, setTempImg] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [char] = useRecoilState(characterState);
  const [gamePush, setGamePush] = useRecoilState(gamePushState);
  
  const rollDice = useCallback((option: GameOptionType) => {
    setOption(option)
    try {
      const baseDiceValue = (option?.骰子?.[0] || 0) + (option?.骰子?.[1] || 0)
      const totalDiceValue = option?.骰子?.reduce((sum, val) => sum + val, 0) || 0
      const extraPoints = totalDiceValue - baseDiceValue
    trackEvent(UmamiEvents.点击剧情选项, {
        option_type: option?.选项类别,
        difficulty: option?.选项难度,
        is_success: !!option?.是否成功,
      })
    trackEvent(UmamiEvents.骰子结果出现, {
        base: baseDiceValue,
        extra: extraPoints,
        total: totalDiceValue,
        success: !!option?.是否成功,
      })
    } catch {}
  }, [setOption])

  // 检测是否有图片并进入预览状态
  useEffect(() => {
    if (showImage && imageUrl) {
      setTempImg(imageUrl)
      setIsPreviewing(true)
    } else {
      setIsPreviewing(false)
      setTempImg(null)
    }
  }, [showImage, imageUrl])

  // 图片预览埋点
  useEffect(() => {
    if (isPreviewing && tempImg) {
      trackEvent(UmamiEvents.打开剧情图片, { image_url: tempImg })
    } else if (!isPreviewing && tempImg === null) {
      trackEvent(UmamiEvents.关闭剧情图片)
    }
  }, [isPreviewing, tempImg])

  // 处理点击屏幕退出预览
  const handlePreviewClick = useCallback(() => {
    if (isPreviewing) {
      setIsPreviewing(false)
      setTempImg(null)
    }
  }, [isPreviewing])

  const handleCustomInput = useCallback(async (customInput: string) => {
    if (!char) return;

    setIsAnalyzing(true);

    try {
      // 1. 先分析自定义选项
      const analysisResult = await analyzeCustomOption(char.id, customInput);

      // 2. 创建选项对象，用于展示骰子动画
      const customOption: GameOptionType = {
        选项类别: analysisResult.选项类别,
        选项难度: analysisResult.选项难度,
        选项描述: customInput,
        是否成功: analysisResult.是否成功,
        骰子: analysisResult.骰子,
        成功率: analysisResult.成功率,
        基础DC: analysisResult.基础DC,
        修正值: analysisResult.修正值,
        变动原因: analysisResult.变动原因,
        // 添加标记，表示这是自定义选项，需要在动画后调用pushGame
        _isCustomOption: true,
        _customInput: customInput
      };

      setOption(customOption);
      
      // pushGame将在骰子动画完成后的timeout回调中调用
    } catch (error) {
      console.error("自定义输入推进失败:", error);
      // 出错时回到playing状态
      setGameState({ status: "playing" });
    } finally {
      setIsAnalyzing(false);
    }
  }, [char, setOption, setGameState]);

  const handleTimeout = useCallback(async () => {
    if(!option) return
    
    // 检查是否是自定义选项
    if (option._isCustomOption && option._customInput) {
      const customInput = option._customInput;
      const currentOption = option;
      
      try {
        setOption(null);
        setGameState({ status: "loading" });
        
        // 调用pushGame推进游戏（传入预分析的选项信息）
        const activePushId = gamePush?.id ?? 0;
        const result = await pushGame(activePushId, char!.id, customInput, {
          选项类别: currentOption.选项类别,
          选项难度: currentOption.选项难度,
          是否成功: currentOption.是否成功,
          骰子: currentOption.骰子,
          成功率: currentOption.成功率,
          基础DC: currentOption.基础DC,
          修正值: currentOption.修正值,
          变动原因: currentOption.变动原因
        });

        console.log("customresult", result);

        setGamePush(result);
        // 切换到流式传输状态，开始播放新的剧情文本
        setGameState({ status: "streaming" });
      } catch (error) {
        console.error("自定义输入推进失败:", error);
        // 出错时回到playing状态
        setGameState({ status: "playing" });
      }
    } else {
      // 普通选项的处理逻辑
      setOption(null)
      onNext(option)
    }
  }, [option, onNext, char, setGameState, setGamePush, gamePush])

  return <div className="text-[20px] relative w-full h-[calc(100vh-112px)] text-[#524a37]">
    {isAnalyzing && (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#00000080]">
        <div className="text-white text-[16px]">自定义选项分析中...</div>
      </div>
    )}
    {/* 图片预览状态 */}
    {isPreviewing && tempImg && (
      <div 
        className="absolute z-10 inset-0 flex items-center justify-center cursor-pointer"
        onClick={handlePreviewClick}
      >
        <img 
          src={tempImg} 
          className="relative z-10 w-full h-full object-cover"
          alt="预览图片"
        />
        <div className="fixed w-full z-30 bottom-[130px] text-center text-white text-[17px]">点击继续剧情</div>
      </div>
    )}
    
    <div className="w-screen h-[44px] relative z-40 my-4 flex flex-row justify-start px-2 gap-1 items-center"
      style={{ background: `url(${$img('newStory/story-locate')}) center center / 100% 44px no-repeat` }}>
      <div className="text-[#F2EBD9] text-[15px]">{gamePush?.gamePush?.节点要素?.基础信息?.当前任务}</div>
      <img className="w-[20px] h-[20px]" src={$img('newStory/distance')}></img>
    </div>
    
    {/* 正常内容，在预览状态下隐藏 */}
    {!isPreviewing && (
      <div className="px-[24px]">
        <div
          className={storyProseClass}
          dangerouslySetInnerHTML={{ __html: story }}
        />
        <GameOptions onNext={rollDice} onCustomInput={handleCustomInput} />
        {
          option && <DiceAnimate2 option={option} timeout={handleTimeout} />
        }
      </div>
    )}
  </div>
}

const StatusBreakthrough = ({ breakResult }: { breakResult: BreakthroughResponse; }) =>{
  const { routerTo } = useRoute();

  const handleContinue = useCallback(() => {
    routerTo("home");
  }, [routerTo])

  return (
  <div className="p-[24px] text-sm text-[#524a37] flex flex-col items-center">
    {/* 突破结果头部图片 */}
    <div className="mx-6 mt-0 -mb-10">
      <img 
        className="w-[210px] ml-[20px]" 
        src={breakResult?.success ? $img("newStory/update-success") : $img("newStory/update-fail")} 
        alt={breakResult?.success ? "game-success" : "game-fail"} 
      />
    </div>
    
    {/* 突破内容 */}
    <div className={`${storyProseClass} mt-12 text-[#111111]`}
      dangerouslySetInnerHTML={{ __html: breakResult?.message || "" }}
    >
    </div>
    
    {/* 继续按钮 */}
    <div className="mt-16 w-[188px]" onClick={handleContinue}>
      <img src={$img('newStory/break-btn-continue')} />
    </div>
  </div>
)}

const PageStory= () => {
  // 游戏状态
  const [gameState, setGameState] = useState<gameState>({ status: "streaming" });
  const [char, setChar] = useRecoilState(characterState);
  const [gamePush, setGamePush] = useRecoilState(gamePushState);
  const [expendedStory, setExpendedStory] = useState<string>("");
  const [updateStrings, setUpdateStrings] = useState<string[]>([]);
  const [imageState, setImageState] = useState<imageGenerationState>({ showImage: false });
  const router = useRouter();

  console.log(gamePush)

  // 监听 gamePush 和游戏状态的变化，在故事流式输出结束后再展示图片
  useEffect(() => {
    if (gamePush?.imageGeneration?.shouldGenerate) {
      setImageState({
        showImage: gameState.status === "playing",
        imageUrl: gamePush.imageGeneration.imageUrl,
        error: gamePush.imageGeneration.error
      });
    } else {
      setImageState({ showImage: false });
    }
  }, [gamePush, gameState.status]);

  if(!char) {
    throw new Error("No character");
  }
  
  const completeExpendedStory = useCallback((story: string) => {
    setExpendedStory(story);
    setGameState({ status: "playing" });
  }, []);

  const handleNextInternal = useCallback((option: GameOptionType) => {
    // 简单设置加载状态
    setGameState({ status: "loading" });
    
    const activePushId = gamePush?.id ?? 0;
    pushGame(activePushId, char.id, option.选项描述).then((res) => {
      if(res.newStatus) {
        // 检查角色是否死亡
        if (res.newStatus.是否死亡) {
          // 跳转到死亡页面，传递死亡判决信息
          router.push(`/pages/death?judgement=${encodeURIComponent(res.deathJudgement || "")}`);
          return;
        }

        // 检查是否有突破结果（通过状态中的特殊字段检测）
        if (res.newStatus && '_breakthrough' in res.newStatus && res.newStatus._breakthrough) {
          trackEvent(UmamiEvents.浏览突破页面, {
              success: (res.newStatus as any)._breakthroughSuccess,
            })
          setGameState({
            breakResult: {
              success: '_breakthroughSuccess' in res.newStatus ? res.newStatus._breakthroughSuccess as boolean : false,
              newStatus: res.newStatus,
              message: '_breakthroughMessage' in res.newStatus ? res.newStatus._breakthroughMessage as string : ''
            },
            status: "breakthrough"
          });
          return;
        }

        // 更新游戏推进状态
        setGamePush(res);

        trackEvent(UmamiEvents.推进成功, {
            push_id: res.id,
            next_level: res.newStatus.等级,
          })

        // 计算属性变化
        const list = ['体魄', '道心', '行动点'] as const;
        const previousStatus = gamePush?.newStatus || res.newStatus;
        const newUpdateStrings = list
          .map(item => {
            const diff = Math.round(res.newStatus[item] - previousStatus[item]);
            return diff ? `${item}: ${diff > 0 ? `+${diff}` : diff}` : "";
          })
          .filter(item => item !== "");

        // 显示属性更新提示
        setUpdateStrings(newUpdateStrings);

        // 5秒后清除属性更新提示
        setTimeout(() => {
          setUpdateStrings([]);
        }, 5000);

        // 检查是否有图像生成
        if (res.imageGeneration?.shouldGenerate) {
          const newImageState = {
            showImage: true,
            imageUrl: res.imageGeneration.imageUrl,
            error: res.imageGeneration.error
          };
          setImageState(newImageState);
          trackEvent(UmamiEvents.触发图片生成, {
              image_url: res.imageGeneration.imageUrl || undefined,
            })
        }
        
        // 切换到流式传输状态，开始生成新的故事内容
        setGameState({ status: "streaming" });
      }
    }).catch((error) => {
      console.error("推进游戏失败:", error);
      trackEvent(UmamiEvents.推进失败, {
          reason: (error as Error)?.message || 'unknown'
        })
      // 出错时回到playing状态
      setGameState({ status: "playing" });
    });
  }, [char, gamePush, setGamePush, router]);

  // 使用防抖的handleNext，防止用户快速点击
  const handleNext = useDebounceCallback(handleNextInternal, 1000);
  const { isPlaying, bgmSwitch, bgmOn } = useBgm()

  useEffect(() => {
    bgmOn();
  }, []);

  // 故事页曝光
  useEffect(() => {
    trackPageView('/story')
  }, [])

  return (
    <div className="text-xl font-family-song flex flex-col justify-start items-center w-full overflow-y-scroll"
      style={{ letterSpacing: '0.05em' }}>
      {gamePush && <CharStatusBar current={gamePush.newStatus} delta={gamePush.statusDelta} />}
      <div className="fixed bottom-3 z-20 right-0 w-[90px] h-[50px]">
        <img className="w-full mt-auto" src={$img('newStory/bgm-b')} alt="" />
        {isPlaying ? 
          <img onClick={() => { trackEvent(UmamiEvents.切换背景音乐, { is_playing: false }); bgmSwitch() }} className="absolute w-[44px] left-[55%] -translate-1/2 top-0" src={$img('bgm-play2')} alt="bgm-toggle" /> :
          <img onClick={() => { trackEvent(UmamiEvents.切换背景音乐, { is_playing: true }); bgmSwitch() }} className="absolute w-[44px] left-[55%] -translate-1/2 top-0" src={$img('bgm-stop')} alt="bgm-toggle" />
        }
      </div>
      {/* {updateStrings?.length > 0 && <AttributeUpdate updateStrings={updateStrings} />} */}
      {gameState.status === "streaming" && <StatusStreaming complete={completeExpendedStory} />}
      {gameState.status === "playing" && <StatusPlaying story={expendedStory} onNext={handleNext} setGameState={setGameState} imageUrl={imageState.imageUrl} imageError={imageState.error} showImage={imageState.showImage} />}
      {gameState.status === "loading" && <StatusLoading loadingAnimateState={gameState.loadingAnimateState} />}
      {gameState.status === "breakthrough" && (
        <StatusBreakthrough 
          breakResult={gameState.breakResult!} 
        />
      )}
    </div>
  );
}

export default PageStory

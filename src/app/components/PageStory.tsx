import { useRecoilState } from "recoil";
import { characterState, gamePushState } from "../store";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import { $img } from "@/utils";
import { GameOptionType, BreakthroughResponse, FormattedCharacterStatus } from "@/interfaces";
import { pushGame } from "../actions/game/action";
import { analyzeCustomOption } from "../actions/module/analyzeOption";
import { useRouter } from 'next/navigation';
import { useBgm } from '../hooks/useBgm';
import { CharStatusBar } from "./CharStatusBar";
import useRoute from "../hooks/useRoute";
import DiceAnimate2 from "./DiceAnimate2";
import { trackEvent, trackPageView, UmamiEvents } from "@/lib/analytics/umami";
import { FactionStoryStrip } from "./faction/FactionPanels";
import { BondStoryStrip } from "./bond/BondPanels";
import { makeDaoLyuWish } from "../actions/bond/action";

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

type BreakthroughStatus = FormattedCharacterStatus & {
  _breakthrough?: boolean;
  _breakthroughSuccess?: boolean;
  _breakthroughMessage?: string;
};

const storyProseClass = "mx-5 mt-4 whitespace-pre-wrap text-[17px] leading-[1.95] text-[#524a37]";
const loadingTexts = [
  "天地灵气正在汇聚",
  "因果轮回悄然运转",
  "命数轨迹逐渐清晰",
  "三千大道正在推演",
  "时空长河泛起涟漪",
  "造化玉碟解析天机"
];
const STREAM_REVEAL_DURATION_MS = 4200;
const STREAM_MIN_INTERVAL_MS = 16;
const STREAM_MAX_INTERVAL_MS = 34;
const STREAM_TARGET_STEPS = 140;

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
    .map((paragraph) => `<p style="text-indent:2em">${paragraph.replace(/\n/g, '<br />')}</p>`)
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
      <button
        type="button"
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[20px] border border-[rgba(245,229,201,0.18)] bg-[linear-gradient(180deg,rgba(30,23,18,0.94),rgba(15,12,10,0.98))] px-4 text-white shadow-[0_16px_30px_rgba(22,14,9,0.16)] transition-transform active:translate-y-[1px]"
        onClick={handleButtonClick}
      >
        <img className="h-[20px] w-[20px]" src={$img('newStory/icon-edit')} alt="" />
        <span className="font-semibold tracking-[0.04em]">我有其他行动的想法</span>
      </button>
      
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* 灰色蒙版 */}
          <div className="absolute inset-0 bg-[#F2EBD999] backdrop-blur-[3px]" onClick={handleClose} />
          {/* 输入面板 */}
          <div className="relative z-50 w-full mx-6">
            <div className="mb-3 rounded-[22px] border border-[rgba(245,229,201,0.16)] bg-[linear-gradient(180deg,rgba(30,23,18,0.96),rgba(15,12,10,0.98))] p-3 shadow-[0_18px_40px_rgba(22,14,9,0.28)]">
              <div className="mb-3 flex items-center justify-between px-1 text-[#f5e6ca]">
                <div className="text-sm tracking-[0.14em]">自定行动</div>
                <button
                  type="button"
                  className="rounded-full border border-[rgba(245,229,201,0.2)] px-3 py-1 text-xs text-[#d9c9ae]"
                  onClick={handleClose}
                >
                  关闭
                </button>
              </div>
              <div className="flex items-end gap-3">
              {/* 左侧文本输入区 */}
              <textarea
                className="min-h-[140px] flex-1 resize-y rounded-[18px] border border-[rgba(245,229,201,0.16)] bg-[rgba(255,255,255,0.03)] p-4 text-white placeholder:text-[#bcae96] focus:outline-none"
                placeholder="写下你想做的事，例如试探、偷袭、交涉或布置陷阱。"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
              />
                <button
                  type="button"
                  onClick={handleSubmit}
                  className="flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-full bg-[rgba(215,197,118,0.16)]"
                  aria-label="提交自定义行动"
                >
                  <img className="h-[40px] w-[40px]" src={$img('newStory/story-submit')} alt="" />
                </button>
              </div>
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

  return <div className="my-10 flex flex-col gap-4 text-white">
    {playerOptions.length > 0 && playerOptions.map((item, index) => (
      <button
        type="button"
        key={index} 
        className="flex min-h-[58px] w-full flex-row items-center gap-3 rounded-[20px] border border-[rgba(245,229,201,0.16)] px-4 py-3 text-left shadow-[0_14px_30px_rgba(22,14,9,0.12)] transition-transform active:translate-y-[1px]"
        style={{background: `linear-gradient(180deg,rgba(58,43,34,0.94),rgba(25,18,14,0.98)), url(${$img('newStory/story-select-bg')}) center center / cover no-repeat`}}
        onClick={() => onNext(item)}
      >
        <div className="shrink-0 text-[12px] text-[#e7d6b6]">
          [{item.选项类别} - {item.选项难度}]
        </div>
        <div className="text-[14px] leading-[1.6] text-[#fff6e4]">{item.选项描述}</div>
      </button>
    ))}
    <CustomInputButton onClick={onCustomInput} />
  </div>
};

const StatusStreaming = ({ complete }: { complete: (story: string) => void }) => {
  const [gamePush] = useRecoilState(gamePushState);
  const [displayText, setDisplayText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const startTimeRef = useRef<number>(0);
  const finishedRef = useRef(false);

  const storyText = useMemo(() => {
    const storyNode = gamePush?.gamePush?.节点要素?.剧情要素;
    const summary = storyNode?.剧情  || "";
    return summary.trim();
  }, [gamePush]);

  useEffect(() => {
    finishedRef.current = false;

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

    const finishReveal = () => {
      if (finishedRef.current) {
        return;
      }

      finishedRef.current = true;
      setDisplayText(storyText);
      setIsTyping(false);
      const end = (typeof performance !== 'undefined' ? performance.now() : Date.now());
      const durationMs = Math.max(0, Math.round(end - startTimeRef.current));
      trackEvent(UmamiEvents.故事生成完成, { chars: characters.length, ms: durationMs });
      complete(buildStoryHtml(storyText));
    };

    let index = 0;
    const stepSize = Math.max(2, Math.ceil(characters.length / STREAM_TARGET_STEPS));
    const steps = Math.max(1, Math.ceil(characters.length / stepSize));
    const intervalMs = Math.max(
      STREAM_MIN_INTERVAL_MS,
      Math.min(STREAM_MAX_INTERVAL_MS, Math.floor(STREAM_REVEAL_DURATION_MS / steps)),
    );

    const timer = window.setInterval(() => {
      const nextIndex = Math.min(characters.length, index + stepSize);
      setDisplayText(characters.slice(0, nextIndex).join(""));
      index = nextIndex;

      if (index >= characters.length) {
        window.clearInterval(timer);
        finishReveal();
      }
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [complete, gamePush, storyText]);

  const paragraphs = displayText.split(/\n{2,}/).filter(Boolean);

  return (
    <div className={storyProseClass}>
      {paragraphs.length > 0 ? paragraphs.map((para, i) => (
        <p key={i} style={{ textIndent: "2em" }}>
          {para.split("\n").map((line, j) => j === 0 ? line : <Fragment key={j}><br />{line}</Fragment>)}
          {isTyping && i === paragraphs.length - 1 && <span className="animate-pulse">▌</span>}
        </p>
      )) : (
        isTyping && <span className="animate-pulse">▌</span>
      )}
    </div>
  );
}

// 加载页面组件 - 迁移自 PageStory.tsx
const StatusLoading = ({ loadingAnimateState = true }: { loadingAnimateState?: boolean }) => {
  const [displayText, setDisplayText] = useState("");
  const [currentTextIndex, setCurrentTextIndex] = useState(0);

  useEffect(() => {
    if (!loadingAnimateState) {
      return;
    }

    const currentText = loadingTexts[currentTextIndex];
    let charIndex = 0;
    let switchTimer: ReturnType<typeof setTimeout> | null = null;

    // 打字机效果
    const typing = setInterval(() => {
      if (charIndex <= currentText.length) {
        setDisplayText(currentText.slice(0, charIndex) + (charIndex === currentText.length ? "" : "▌"));
        charIndex++;
      } else {
        clearInterval(typing);
        // 切换到下一条文案
        switchTimer = setTimeout(() => {
          setCurrentTextIndex((prev) => (prev + 1) % loadingTexts.length);
        }, 2000);
      }
    }, 100);

    return () => {
      clearInterval(typing);
      if (switchTimer) {
        clearTimeout(switchTimer);
      }
    };
  }, [currentTextIndex, loadingAnimateState]);

  return (
    <div className="relative flex h-[calc(100vh-170px)] w-full items-center justify-center text-[18px] animate-(--animate-fade-in)">
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

const StatusPlaying = ({ story, onNext, setGameState, imageUrl, showImage }: { story: string, onNext: (option: GameOptionType) => void, setGameState: (state: gameState) => void, imageUrl?: string, showImage?: boolean }) => {
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
    } catch (error) { console.warn('分析事件跟踪失败:', error); }
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

  return <div className="relative h-[calc(100vh-112px)] w-full text-[18px] text-[#524a37]">
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
        <div className="fixed w-full z-30 bottom-[130px] text-center text-white text-[15px]">点击继续剧情</div>
      </div>
    )}
    
    <div
      className="relative z-40 mx-auto my-4 flex h-[44px] w-[calc(100%-20px)] max-w-[420px] flex-row items-center gap-1 px-3"
      style={{ background: `url(${$img('newStory/story-locate')}) center center / 100% 44px no-repeat` }}
    >
      <div className="text-[#F2EBD9] text-[13px]">{gamePush?.gamePush?.节点要素?.基础信息?.当前任务}</div>
      <img className="h-[20px] w-[20px]" src={$img('newStory/distance')} alt="" />
    </div>
    
    {/* 正常内容，在预览状态下隐藏 */}
    {!isPreviewing && (
      <div className="px-[22px] pb-10">
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

const StatusBreakthrough = ({
  breakResult,
  canWish,
  characterId,
  onWishCompleted,
}: {
  breakResult: BreakthroughResponse;
  canWish: boolean;
  characterId: number;
  onWishCompleted: (payload: unknown) => void;
}) =>{
  const { routerTo } = useRoute();
  const [wishText, setWishText] = useState("");
  const [isSubmittingWish, setIsSubmittingWish] = useState(false);

  const handleContinue = useCallback(() => {
    if (canWish) {
      return;
    }
    routerTo("home");
  }, [canWish, routerTo])

  const handleSubmitWish = useCallback(async () => {
    if (!canWish || !wishText.trim()) {
      return;
    }
    setIsSubmittingWish(true);
    try {
      const payload = await makeDaoLyuWish(characterId, wishText.trim());
      onWishCompleted(payload);
    } finally {
      setIsSubmittingWish(false);
    }
  }, [canWish, characterId, onWishCompleted, wishText]);

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

    {canWish ? (
      <div className="mt-8 w-full max-w-[420px] rounded-[22px] border border-[rgba(130,89,56,0.18)] bg-[rgba(255,248,236,0.9)] px-4 py-4">
        <div className="text-[12px] tracking-[0.18em] text-[#7d5b37]">筑基已成 · 向天道许一人</div>
        <div className="mt-2 text-[13px] leading-[1.8] text-[#5a4630]">
          写下你想要的道侣。愿望不必克制，因果会替你慢慢兑现。
        </div>
        <textarea
          className="mt-3 min-h-[120px] w-full rounded-[18px] border border-[rgba(130,89,56,0.16)] bg-[rgba(255,255,255,0.76)] px-4 py-3 text-[14px] leading-[1.8] text-[#3f3123] focus:outline-none"
          placeholder="例如：我想要一个清冷但护短、会在我最狼狈时守灯等我的人。"
          value={wishText}
          onChange={(event) => setWishText(event.target.value)}
        />
        <button
          type="button"
          onClick={handleSubmitWish}
          disabled={!wishText.trim() || isSubmittingWish}
          className="mt-3 w-full rounded-full bg-[rgba(82,52,28,0.92)] px-4 py-3 text-[13px] tracking-[0.14em] text-[#f8ead0] disabled:opacity-50"
        >
          {isSubmittingWish ? "因果推演中..." : "许下此愿"}
        </button>
      </div>
    ) : null}
    
    {/* 继续按钮 */}
    <div className={`mt-16 w-[188px] ${canWish ? "opacity-50" : ""}`} onClick={handleContinue}>
      <img src={$img('newStory/break-btn-continue')} alt="继续" />
    </div>
  </div>
)}

const PageStory= () => {
  // 游戏状态
  const [gameState, setGameState] = useState<gameState>({ status: "streaming" });
  const [char, setChar] = useRecoilState(characterState);
  const [gamePush, setGamePush] = useRecoilState(gamePushState);
  const [expendedStory, setExpendedStory] = useState<string>("");
  const [imageState, setImageState] = useState<imageGenerationState>({ showImage: false });
  const router = useRouter();

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
        const breakthroughStatus = res.newStatus as BreakthroughStatus;
        if (breakthroughStatus._breakthrough) {
          if (res.factionData) {
            setChar((previous) => previous ? { ...previous, factionData: res.factionData } : previous);
          }
          if (res.bondData) {
            setChar((previous) => previous ? { ...previous, bondData: res.bondData } : previous);
          }
          trackEvent(UmamiEvents.浏览突破页面, {
              success: breakthroughStatus._breakthroughSuccess,
            })
          setGameState({
            breakResult: {
              success: breakthroughStatus._breakthroughSuccess ?? false,
              newStatus: res.newStatus,
              message: breakthroughStatus._breakthroughMessage || ''
            },
            status: "breakthrough"
          });
          return;
        }

        // 更新游戏推进状态
        setGamePush(res);
        if (res.factionData) {
          setChar((previous) => previous ? { ...previous, factionData: res.factionData } : previous);
        }
        if (res.bondData) {
          setChar((previous) => previous ? { ...previous, bondData: res.bondData } : previous);
        }

        trackEvent(UmamiEvents.推进成功, {
            push_id: res.id,
            next_level: res.newStatus.等级,
          })

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
  }, [char, gamePush, setChar, setGamePush, router]);

  // 使用防抖的handleNext，防止用户快速点击
  const handleNext = useDebounceCallback(handleNextInternal, 1000);
  const { isPlaying, bgmSwitch, bgmOn } = useBgm()

  useEffect(() => {
    bgmOn();
  }, [bgmOn]);

  // 故事页曝光
  useEffect(() => {
    trackPageView('/story')
  }, [])

  useEffect(() => {
    if (!char?.id || char.factionData) {
      return;
    }

    fetch(`/api/faction-snapshot?characterId=${char.id}`)
      .then((response) => response.json())
      .then((result) => {
        if (result) {
          setChar((previous) => previous ? { ...previous, factionData: result } : previous);
        }
      })
      .catch((error) => { console.warn('加载势力数据失败:', error); });
  }, [char?.factionData, char?.id, setChar]);

  useEffect(() => {
    if (!char?.id || char.bondData) {
      return;
    }

    fetch(`/api/bond-snapshot?characterId=${char.id}`)
      .then((response) => response.json())
      .then((result) => {
        if (result) {
          setChar((previous) => previous ? { ...previous, bondData: result } : previous);
        }
      })
      .catch((error) => { console.warn('加载缘簿数据失败:', error); });
  }, [char?.bondData, char?.id, setChar]);

  return (
    <div className="flex w-full flex-col items-center justify-start overflow-y-scroll pb-6 font-family-song text-[18px]"
      style={{ letterSpacing: '0.05em' }}>
      {gamePush && <CharStatusBar current={gamePush.newStatus} delta={gamePush.statusDelta} />}
      {char.factionData ? (
        <div className="w-full max-w-[1240px] px-4 pt-2 xl:px-6">
          <FactionStoryStrip
            data={char.factionData}
            onOpenWorld={() => router.push(`/pages/world?characterId=${char.id}`)}
          />
        </div>
      ) : null}
      {char.bondData ? (
        <div className="w-full max-w-[1240px] px-4 pt-2 xl:px-6">
          <BondStoryStrip
            data={char.bondData}
            onOpenBonds={() => router.push(`/pages/bonds?characterId=${char.id}`)}
            onOpenChat={() => {
              const chatTarget = char.bondData?.activeDaoLyu || char.bondData?.activeDisciples[0];
              if (chatTarget) {
                router.push(`/pages/bond-chat?characterId=${char.id}&bondId=${chatTarget.id}`);
              }
            }}
          />
        </div>
      ) : null}
      <div className="fixed bottom-3 z-20 right-0 w-[90px] h-[50px]">
        <img className="w-full mt-auto" src={$img('newStory/bgm-b')} alt="" />
        {isPlaying ? 
          <img onClick={() => { trackEvent(UmamiEvents.切换背景音乐, { is_playing: false }); bgmSwitch() }} className="absolute w-[44px] left-[55%] -translate-1/2 top-0" src={$img('bgm-play2')} alt="bgm-toggle" /> :
          <img onClick={() => { trackEvent(UmamiEvents.切换背景音乐, { is_playing: true }); bgmSwitch() }} className="absolute w-[44px] left-[55%] -translate-1/2 top-0" src={$img('bgm-stop')} alt="bgm-toggle" />
        }
      </div>
      {/* {updateStrings?.length > 0 && <AttributeUpdate updateStrings={updateStrings} />} */}
      {gameState.status === "streaming" && <StatusStreaming complete={completeExpendedStory} />}
      {gameState.status === "playing" && <StatusPlaying story={expendedStory} onNext={handleNext} setGameState={setGameState} imageUrl={imageState.imageUrl} showImage={imageState.showImage} />}
      {gameState.status === "loading" && <StatusLoading loadingAnimateState={gameState.loadingAnimateState} />}
      {gameState.status === "breakthrough" && (
        <StatusBreakthrough 
          breakResult={gameState.breakResult!}
          canWish={Boolean(char.bondData?.overview.canWishForDaoLyu)}
          characterId={char.id}
          onWishCompleted={(payload) => {
            setChar((previous) => previous ? { ...previous, bondData: payload as typeof previous.bondData } : previous);
          }}
        />
      )}
    </div>
  );
}

export default PageStory

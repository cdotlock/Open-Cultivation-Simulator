import { useState, useCallback, useEffect, useRef } from "react";
import { getBgmList } from "@/app/actions/dict/action";

// 全局单例音频实例
let globalAudioInstance: HTMLAudioElement | null = null;
let currentBgmIndex = 0;
let bgmList: string[] = ['/assets/bgm.mp3'];

export function useBgm() {
  const [isPlaying, setIsPlaying] = useState(false);
  const desiredPlayStateRef = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 清理音频实例
  const cleanupAudio = useCallback(() => {
    if (globalAudioInstance) {
      globalAudioInstance.pause();
      globalAudioInstance.src = "";
      globalAudioInstance.onended = null;
      globalAudioInstance = null;
    }
    setIsPlaying(false);
    desiredPlayStateRef.current = false;
    
    // 清理重试定时器
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, []);

  // 状态一致性检查与重试（最多重试3次，避免自动播放策略导致的无限循环）
  const checkAndRetryState = useCallback((retryCount = 0) => {
    if (!globalAudioInstance) return;
    if (retryCount >= 3) return; // 超过重试次数，放弃

    const actualPlaying = !globalAudioInstance.paused;
    const desiredPlaying = desiredPlayStateRef.current;

    if (actualPlaying !== desiredPlaying) {
      retryTimeoutRef.current = setTimeout(() => {
        if (desiredPlaying && globalAudioInstance && globalAudioInstance.paused) {
          const playPromise = globalAudioInstance.play();
          if (playPromise !== undefined) {
            playPromise.catch(error => {
              if (error.name === 'NotAllowedError') {
                // 浏览器自动播放策略阻止，静默放弃，等待用户交互
                desiredPlayStateRef.current = false;
                setIsPlaying(false);
                return;
              }
              if (error.name !== 'AbortError') {
                console.warn('BGM 重试播放失败:', error);
              }
              checkAndRetryState(retryCount + 1);
            });
          }
        } else if (!desiredPlaying && globalAudioInstance && !globalAudioInstance.paused) {
          globalAudioInstance.pause();
          setIsPlaying(false);
        }
      }, 300);
    } else {
      setIsPlaying(desiredPlaying);
    }
  }, []);

  // 加载并播放音乐
  const loadBgm = useCallback(async () => {
    cleanupAudio();

    try {
      const audio = new Audio(bgmList[currentBgmIndex]);
      audio.loop = false;
      audio.volume = 0.4;
      
      audio.onended = () => {
        // 播放结束后自动播放下一首
        currentBgmIndex = (currentBgmIndex + 1) % bgmList.length;
        cleanupAudio();
        setTimeout(() => loadBgm(), 100);
      };

      globalAudioInstance = audio;
      desiredPlayStateRef.current = true;
      
      try {
        await audio.play();
        setIsPlaying(true);
      } catch (error) {
        const name = (error as Error).name;
        if (name === 'NotAllowedError') {
          // 浏览器自动播放策略阻止，静默等待用户交互后手动开启
          desiredPlayStateRef.current = false;
          setIsPlaying(false);
        } else if (name !== 'AbortError') {
          console.warn('BGM 播放失败:', error);
          cleanupAudio();
        } else {
          // AbortError - 启动状态一致性检查
          checkAndRetryState();
        }
      }
      
    } catch (error) {
      console.error('BGM 加载失败:', error);
      cleanupAudio();
    }
  }, [cleanupAudio, checkAndRetryState]);

  const bgmOn = useCallback(async () => {
    desiredPlayStateRef.current = true;
    
    if (globalAudioInstance && globalAudioInstance.paused) {
      try {
        await globalAudioInstance.play();
        setIsPlaying(true);
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('BGM 播放失败:', error);
        } else {
          // AbortError - 启动状态一致性检查
          checkAndRetryState();
        }
      }
    } else if (!globalAudioInstance) {
      await loadBgm();
    }
  }, [loadBgm, checkAndRetryState]);

  const bgmOff = useCallback(() => {
    desiredPlayStateRef.current = false;
    
    if (globalAudioInstance) {
      globalAudioInstance.pause();
      setIsPlaying(false);
      // 立即检查状态一致性
      checkAndRetryState();
    }
  }, [checkAndRetryState]);

  const bgmSwitch = useCallback(() => {
    if (isPlaying) {
      bgmOff();
    } else {
      bgmOn();
    }
  }, [isPlaying, bgmOn, bgmOff]);

  const bgmNext = useCallback(() => {
    currentBgmIndex = (currentBgmIndex + 1) % bgmList.length;
    loadBgm();
  }, [loadBgm]);

  // 初始化 BGM 列表
  useEffect(() => {
    const initBgmList = async () => {
      try {
        const list = await getBgmList();
        bgmList = list;
        currentBgmIndex = 0;
      } catch (error) {
        console.error('获取 BGM 列表失败:', error);
      }
    };

    initBgmList();

    // 组件卸载时清理
    return () => {
      cleanupAudio();
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [cleanupAudio]);

  return {
    loadBgm,
    bgmOn,
    bgmOff,
    bgmSwitch,
    bgmNext,
    isPlaying
  };
}

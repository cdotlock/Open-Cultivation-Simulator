"use client"

import { useCallback, useState, useEffect, Suspense } from "react"
import { $img } from "@/utils"
import { generateCharacterAvatar, selectCharacterAvatar, queryTask, getCharacterAvatarAggregate } from "@/app/actions/character_avatar/action"
import { useSearchParams, useRouter } from "next/navigation";
import { useUuid } from "@/app/hooks/useLogin";
import { useToast } from "@/app/hooks/useToast";
import { useCharacterCrud } from "@/app/hooks/charCrud";

interface AvatarItem {
  url: string
  id: number
  prompt: string
  name: string
}

interface AvatarWithSelected extends AvatarItem {
  selected: boolean
}

// 选择头像组件
const ChooseIcon = ({ size, active }: { size: number, active: boolean }) => {
  return active ?
    <img src={$img('avatar/checked')} alt="checked" style={{ width: `${size}px`, height: `${size}px` }} />
    :
    <img src={$img('avatar/check')} alt="check" style={{ width: `${size}px`, height: `${size}px` }} />
}

// 动态按钮
const Btn = ({ text1, text2, disabled = false, onClick }: { text1: string, text2: string, disabled?: boolean, onClick: () => void }) => {
  return <div onClick={onClick} style={{ backgroundImage: `url(${$img('avatar/btn')})` }}
    className={`w-[45%] text-[#524A37] leading-[1] aspect-[4.25] bg-cover ${disabled ? 'opacity-30' : ''}`} >
    <div className="w-full h-full flex flex-col items-center justify-center">
      <div className="text-[17px]">{text1}</div>
      <div className="text-[12px] scale-75">{text2}</div>
    </div>
  </div>
}

export default function AvatarPage() {
  return <>
    <Suspense fallback={<div>Loading...</div>}>
      <AvatarContainerWrapper />
    </Suspense>
  </>
}

const AvatarContainerWrapper = () => {
  const searchParams = useSearchParams();
  const characterId = Number(searchParams.get("characterId")) || 14;
  
  return <AvatarContainer characterId={characterId} />
}


const AvatarContainer = ({ characterId }: { characterId: number }) => {  
  const [pageState, setPageState] = useState<"default" | "queue">("default")
  const [avatarList, setAvatarList] = useState<AvatarWithSelected[]>([])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const userUuid = useUuid()

  const isQueue = pageState === "queue"
  const isEmptyList = avatarList.length === 0

  const [avatar, setAvatar] = useState<string>('')
  const [description, setDescription] = useState<string>("")

  const {handleCharacterSelect} = useCharacterCrud()

  const router = useRouter()
  const { showToast } = useToast()

  // 是否已选择形象
  const hasSelected = avatarList.some(item => item.selected)

  // 加载聚合数据
  const loadAggregateData = useCallback(async () => {
    if (!userUuid) {
      setError("用户UUID不能为空")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const data = await getCharacterAvatarAggregate(characterId, userUuid)

      if (!data.isSuccess) {
        setError(data.message)
        setLoading(false)
        return
      }
      
      const { currentAvatar, characterDescription, avatarHistory } = data.data!;

      // 设置当前选择的头像
      if (currentAvatar) {
        setAvatar(currentAvatar.url)
      }

      // 设置角色描述
      setDescription(characterDescription || "")

      // 设置历史头像列表
      setAvatarList(avatarHistory.map(avatar => ({
        ...avatar,
        selected: false
      })))

      setError(null)
    } catch (error) {
      console.error("Failed to load aggregate data:", error)
      setError("加载数据失败")
    } finally {
      setLoading(false)
    }
  }, [characterId, userUuid])

  // 初始加载
  useEffect(() => {
    loadAggregateData()
  }, [loadAggregateData])

  // 自动清除错误信息
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // 轮询任务状态
  useEffect(() => {
    if (!taskId || !isQueue) return

    let pollCount = 0
    const maxPollAttempts = 20
    const pollInterval = 5000 // 5秒轮询一次

    const pollTaskStatus = async () => {
      try {
        const queryResult = await queryTask(taskId)
        
        if (queryResult.status === 'SUCCESS' && queryResult.result) {
          setPageState("default")
          setTaskId(null)
          setError(null)
          
          // 重新加载聚合数据
          await loadAggregateData()
          
          // 自动选择最新生成的头像
          if (queryResult.result) {
            setAvatarList(prev => {
              return prev.map((item, i) => ({ 
                ...item, 
                selected: item.id === queryResult.result?.id 
              }))
            })
          }
        } else if (queryResult.status === 'FAILED') {
          setPageState("default")
          setTaskId(null)
          setError(queryResult.error || "任务执行失败")
        } else if (pollCount >= maxPollAttempts) {
          setPageState("default")
          setTaskId(null)
          setError("任务超时，请稍后重试")
        } else {
          pollCount++
        }
      } catch (error) {
        console.error("Failed to query task status:", error)
        setPageState("default")
        setTaskId(null)
        setError("查询任务状态失败")
      }
    }

    // 立即执行一次
    pollTaskStatus()
    
    // 设置轮询
    const interval = setInterval(pollTaskStatus, pollInterval)
    
    return () => clearInterval(interval)
  }, [taskId, isQueue, loadAggregateData])

  // 生成形象
  const handleGenerate = useCallback(async () => {
    try {
      setError(null)
      setPageState("queue")
      
      const result = await generateCharacterAvatar(characterId, description)
      
      if (result.isSuccess) {
        setTaskId(result.taskId)
      } else {
        setPageState("default")
        setError(result.message)
      }
    } catch (error) {
      console.error("Failed to generate avatar:", error)
      setPageState("default")
      setError("生成头像失败")
    }
  }, [characterId, description])

  // 选择形象
  const handleSelect = useCallback((index: number) => {
    setAvatarList(prev => prev.map((item, i) => ({ ...item, selected: i === index })))
  }, [])

  // 确认形象
  const handleConfirm = useCallback(async () => {
    const selectedAvatar = avatarList.find(item => item.selected)
    if (selectedAvatar) {
      try {
        const success = await selectCharacterAvatar(characterId, selectedAvatar.id)
        if (success) {
          setAvatar(selectedAvatar.url)
          handleCharacterSelect(characterId)
          showToast("选择形象成功")
          setError(null)
          router.push(`/`)
        } else {
          setError("选择头像失败")
        }
      } catch (error) {
        console.error("Failed to select avatar:", error)
        setError("选择头像失败")
      }
    }
  }, [avatarList, characterId])

  if (loading) {
    return (
      <div className="bg-[#111] w-full min-h-screen flex flex-col items-center justify-center text-[#fff] text-[16px]">
        <img src={$img('avatar/spin')} alt="loading" className="w-[64px] h-[64px] animate-spin" />
        <div className="text-[12px] mt-[4px] text-[#ffffff3c]">加载中...</div>
      </div>
    )
  }

  return <div className="bg-[#111] w-full min-h-screen flex flex-col items-center text-[#fff] text-[16px] pb-[128px]">
    {error && (
      <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-red-500 text-white px-4 py-2 rounded-md z-50">
        {error}
      </div>
    )}
    <div className="mt-[27px] relative w-[256px] h-[256px] flex flex-col items-center justify-center bg-[#222] rounded-[4px]">
      {
        isQueue &&
        <>
          <img src={$img('avatar/spin')} alt="spin" className="w-[64px] h-[64px] animate-spin" />
          <div className="text-[12px] mt-[4px] text-[#ffffff3c]">生图任务已在后台进行，请稍后...</div>
        </>
      }
      {
        avatar && !isQueue &&
        <img src={avatar} alt="avatar" className="w-full h-full object-cover" />
      }
      <div className="absolute top-[4px] right-[4px]">
        {/* <ChooseIcon size={24} active={false} /> */}
      </div>
    </div>
    <div className="mt-[18px] mb-[24px] text-[13px] w-[256px]">
      {description}
    </div>
    <div className="w-full h-[1px] bg-[#ffffff80]"></div>
    {
      !isEmptyList &&
      <>
        <div className="w-full px-[4px]">
          <div className="w-full mt-[16px] mb-[14px] text-center">历史生成</div>
          <div className="w-full grid grid-cols-3 gap-[4px]">
            {
              avatarList.map((item, index) => (
                <div onClick={() => handleSelect(index)} key={index} className="w-full aspect-square relative">
                  <img src={item.url} alt="avatar" className="w-full h-full rounded-[4px] object-cover" />
                  <div className="absolute top-[4px] right-[4px]">
                    <ChooseIcon size={20} active={item.selected} />
                  </div>
                </div>
              ))
            }
          </div>
        </div>
      </>
    }
    <div className="fixed bottom-0 left-0 w-full bg-[#111111]">
      <div className="mt-[12px] mb-[40px] flex justify-center gap-[8px]">
        {
          isEmptyList ?
            <Btn text1="生成形象" text2="Confirm" disabled={isQueue} onClick={handleGenerate} />
            :
            <>
              <Btn text1="重新生成" text2="Reproduce" disabled={isQueue} onClick={handleGenerate} />
              <Btn text1="确认形象" text2="Confirm" disabled={isQueue || !hasSelected} onClick={handleConfirm} />
            </>
        }
      </div>
    </div>
  </div>
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackEvent, trackPageView, track, UmamiEvents } from '@/lib/analytics/umami';
import { useToast } from '../hooks/useToast';
import { ramdomFirstName, ramdomIdentity, ramdomLastName } from '@/utils/ramdom'
import { useLogin } from '../hooks/useLogin';
import useGameControll from '@/app/hooks/useGameControll';
import { CharacterCreationSection } from './CharacterCreationSection';
import { $img } from '@/utils';

const MAX_ATTRIBUTE_POINTS = 5

// 灵根配置
const spiritRoots = [
  { name: "金灵根", bonus: { 神识: 1, 身手: 1, 魅力: 0 } },
  { name: "木灵根", bonus: { 魅力: 1, 神识: 1, 身手: 0 } },
  { name: "水灵根", bonus: { 魅力: 2, 神识: 0, 身手: 0 } },
  { name: "火灵根", bonus: { 身手: 2, 神识: 0, 魅力: 0 } },
  { name: "土灵根", bonus: { 魅力: 1, 身手: 1, 神识: 0 } }
] as const

export default function PageCreateChar() {
  const { showToast } = useToast()
  const [createForm, setCreateForm] = useState([ramdomFirstName(), ramdomLastName(), ramdomIdentity()])
  const { user, checkLogin } = useLogin()
  const uuid = user?.uuid || ""
  const { toCreateLoadingPage } = useGameControll(uuid)

  // 灵根选择
  const [selectedSpiritRoot, setSelectedSpiritRoot] = useState<number | null>(null)

  // 加点状态（基础1点，额外5点可分配）
  const [attributePoints, setAttributePoints] = useState({
    魅力: 1, // 基础1点
    神识: 1, // 基础1点
    身手: 1  // 基础1点
  })

  useEffect(() => {
    checkLogin()
  }, [checkLogin])

  useEffect(() => {
    trackPageView('/create')
  }, [])

  const updateFormValue = useCallback((index: number, value: string) => {
    setCreateForm(pre => pre.map((item, i) => i === index ? value : item))
  }, [setCreateForm])



  const handleUserInput = useCallback((event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    setCreateForm(pre => pre.map((item, i) => i === index ? event.target.value : item))
  }, [setCreateForm])

  // 计算调整后的属性点（确保不超过上限）
  const calculateAdjustedAttributes = useCallback((currentPoints: typeof attributePoints, bonus: { 魅力: number, 神识: number, 身手: number }) => {
    const adjustedPoints = { ...currentPoints }
    let hasAdjustment = false
    
    // 检查每个属性，如果加上灵根奖励后超过6点，则调整基础点数
    Object.keys(adjustedPoints).forEach(key => {
      const attr = key as keyof typeof adjustedPoints
      const totalWithBonus = adjustedPoints[attr] + (bonus[attr] || 0)
      
      if (totalWithBonus > 6) {
        adjustedPoints[attr] = Math.max(1, 6 - (bonus[attr] || 0))
        hasAdjustment = true
      }
    })
    
    return { adjustedPoints, hasAdjustment }
  }, [])

  // 选择灵根
  const handleSpiritRootSelect = useCallback((index: number) => {
    const newBonus = spiritRoots[index].bonus
    const { adjustedPoints, hasAdjustment } = calculateAdjustedAttributes(attributePoints, newBonus)

    // 一次性更新所有相关状态
    setSelectedSpiritRoot(index)
    if (hasAdjustment) {
      setAttributePoints(adjustedPoints)
      showToast("灵根切换后属性已自动调整至上限内")
    }
    try {
      track('web.create_character.choose_attribute.click');
      trackEvent(UmamiEvents.快速生成角色, { source: 'create_page_spirit_root', spirit_root: spiritRoots[index].name })
    } catch {}
  }, [attributePoints, calculateAdjustedAttributes, showToast])


  const bonus = useMemo(() => {
    if (selectedSpiritRoot === null) return { 魅力: 0, 神识: 0, 身手: 0 }
    return spiritRoots[selectedSpiritRoot].bonus as { 魅力: number, 神识: number, 身手: number }
  }, [selectedSpiritRoot])
  
  const totalAttributes = useMemo(() => ({
    魅力: attributePoints.魅力 + bonus.魅力,
    神识: attributePoints.神识 + bonus.神识,
    身手: attributePoints.身手 + bonus.身手
  }), [attributePoints, bonus])

  // 计算已分配的额外点数
  const getExtraPointsUsed = useCallback(() => {
    return (attributePoints.魅力 - 1) + (attributePoints.神识 - 1) + (attributePoints.身手 - 1)
  }, [attributePoints])

  // 加点相关函数
  const handleAttributeChange = useCallback((attribute: keyof typeof attributePoints, value: number) => {
    const currentValue = attributePoints[attribute]
    const totalWithBonus = value + (bonus[attribute] || 0)
    
    // 检查上限（6点）
    if (totalWithBonus > 6) {
      showToast(`${attribute}属性最高为6点`)
      return
    }
    
    // 检查下限（1点基础）
    if (value < 1) {
      showToast(`${attribute}属性最低为1点`)
      return
    }

    // 检查额外点数限制
    const otherPoints = (attributePoints.魅力 - 1) + (attributePoints.神识 - 1) + (attributePoints.身手 - 1)
    const newExtraPoints = otherPoints - (currentValue - 1) + (value - 1)
    
    if (newExtraPoints > MAX_ATTRIBUTE_POINTS) {
      showToast(`额外点数不能超过${MAX_ATTRIBUTE_POINTS}点`)
      return
    }

    setAttributePoints(prev => ({
      ...prev,
      [attribute]: value
    }))
  }, [attributePoints, showToast, bonus])

  // 随机按钮的回调函数
  const handleRandomFirstName = useCallback(() => {
    try {
      track('web.create_character.random.click', { random_type: 'surname' });
    } catch {}
    updateFormValue(0, ramdomFirstName());
  }, [updateFormValue])

  const handleRandomLastName = useCallback(() => {
    try {
      track('web.create_character.random.click', { random_type: 'name' });
    } catch {}
    updateFormValue(1, ramdomLastName());
  }, [updateFormValue])

  const handleRandomIdentity = useCallback(() => {
    try {
      track('web.create_character.random.click', { random_type: 'identity' });
    } catch {}
    updateFormValue(2, ramdomIdentity());
  }, [updateFormValue])

  // 验证条件
  const canCreate = createForm[0].length > 0 && 
                   createForm[1].length > 0 && 
                   createForm[2].length > 0 && 
                   selectedSpiritRoot !== null &&
                   getExtraPointsUsed() === MAX_ATTRIBUTE_POINTS

  const handleCreate = useCallback(() => {
    if (canCreate) {
      const selectedSpiritRootName = selectedSpiritRoot !== null ? spiritRoots[selectedSpiritRoot].name : ''
      toCreateLoadingPage(createForm, "", totalAttributes, selectedSpiritRootName)
      try {
        track('web.create_character.create_profile.click');
        trackEvent(UmamiEvents.提交角色创建, {
          spirit_root: selectedSpiritRootName,
          charm: totalAttributes.魅力,
          sense: totalAttributes.神识,
          agility: totalAttributes.身手,
        })
      } catch {}
    }
  }, [canCreate, toCreateLoadingPage, createForm, selectedSpiritRoot, totalAttributes])

  const extraPointsUsed = getExtraPointsUsed()
  const remainingPoints = MAX_ATTRIBUTE_POINTS - extraPointsUsed
  const selectedSpiritRootLabel = useMemo(() => {
    if (selectedSpiritRoot === null) {
      return "未定"
    }

    return spiritRoots[selectedSpiritRoot].name.replace("灵根", "")
  }, [selectedSpiritRoot])

  return (
    <div className="w-full px-4 pb-[134px] pt-5 text-[14px] text-[#111]">
      <div className="mx-auto flex max-w-md flex-col gap-4">
        <section className="rounded-[30px] border border-[#d6be92] bg-[linear-gradient(180deg,rgba(255,249,239,0.95),rgba(247,238,222,0.92))] px-5 py-5 shadow-[0_18px_36px_rgba(66,43,16,0.08)]">
          <div className="text-center text-[13px] tracking-[0.22em] text-[#8c734a]">{`{ 创建角色 }`}</div>
          <div className="mt-2 text-center font-family-song text-[34px] leading-[1.08] text-[#2f2212]">{`"在下名为"`}</div>
          <div className="mt-3 text-center text-[12px] leading-[1.7] text-[#6d5a39]">
            定下名讳、身份与灵根，便可踏上你的修行之路。
          </div>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-3 rounded-[22px] border border-[#decaa1] bg-[rgba(255,252,247,0.84)] px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] tracking-[0.18em] text-[#8d734d]">姓氏</span>
                <button
                  type="button"
                  onClick={handleRandomFirstName}
                  className="rounded-full border border-[#c8ab79] bg-[#fcf4e3] px-3 py-[6px] text-[11px] text-[#6a5231]"
                >
                  随机
                </button>
              </div>
              <input
                className="w-full bg-transparent text-center font-family-song text-[34px] leading-none focus-visible:outline-none"
                maxLength={2}
                value={createForm[0]}
                onChange={(e) => handleUserInput(e, 0)}
                onFocus={() => track('web.create_character.input.click', { input_type: 'surname' })}
              />
            </label>

            <label className="grid gap-3 rounded-[22px] border border-[#decaa1] bg-[rgba(255,252,247,0.84)] px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] tracking-[0.18em] text-[#8d734d]">名字</span>
                <button
                  type="button"
                  onClick={handleRandomLastName}
                  className="rounded-full border border-[#c8ab79] bg-[#fcf4e3] px-3 py-[6px] text-[11px] text-[#6a5231]"
                >
                  随机
                </button>
              </div>
              <input
                className="w-full bg-transparent text-center font-family-song text-[34px] leading-none focus-visible:outline-none"
                maxLength={2}
                value={createForm[1]}
                onChange={(e) => handleUserInput(e, 1)}
                onFocus={() => track('web.create_character.input.click', { input_type: 'name' })}
              />
            </label>

            <label className="grid gap-3 rounded-[22px] border border-[#decaa1] bg-[rgba(255,252,247,0.84)] px-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] tracking-[0.18em] text-[#8d734d]">身份</span>
                <button
                  type="button"
                  onClick={handleRandomIdentity}
                  className="rounded-full border border-[#c8ab79] bg-[#fcf4e3] px-3 py-[6px] text-[11px] text-[#6a5231]"
                >
                  随机
                </button>
              </div>
              <input
                className="w-full bg-transparent text-center text-[20px] text-[#2a2014] focus-visible:outline-none"
                maxLength={9}
                value={createForm[2]}
                onChange={(e) => handleUserInput(e, 2)}
                onFocus={() => track('web.create_character.input.click', { input_type: 'identity' })}
              />
            </label>
          </div>
        </section>

        <section className="rounded-[30px] border border-[#d6be92] bg-[linear-gradient(180deg,rgba(247,239,225,0.96),rgba(242,235,217,0.94))] shadow-[0_18px_36px_rgba(66,43,16,0.06)]">
          <CharacterCreationSection 
            extraAttributePoints={bonus}
            selectedSpiritRoot={selectedSpiritRoot}
            onSpiritRootSelect={handleSpiritRootSelect}
            attributePoints={attributePoints}
            onAttributeChange={handleAttributeChange}
            remainingPoints={remainingPoints}
            totalPoints={MAX_ATTRIBUTE_POINTS}
          />
        </section>
      </div>

      <div className="fixed bottom-3 left-1/2 z-30 w-[calc(100vw-24px)] max-w-[430px] -translate-x-1/2 rounded-[26px] border border-[#ceb485] bg-[linear-gradient(180deg,rgba(251,244,232,0.96),rgba(242,232,211,0.98))] px-4 py-4 shadow-[0_24px_50px_rgba(52,33,12,0.18)] backdrop-blur-[10px]">
        <div className="mb-3 flex items-center justify-between text-[12px] text-[#6d5838]">
          <div>
            <div className="tracking-[0.12em] text-[#927548]">灵根</div>
            <div className="mt-1 font-family-song text-[18px] text-[#2f2212]">{selectedSpiritRootLabel}</div>
          </div>
          <div className="text-right">
            <div className="tracking-[0.12em] text-[#927548]">剩余点数</div>
            <div className="mt-1 text-[18px] font-semibold text-[#2f2212]">
              {remainingPoints}/{MAX_ATTRIBUTE_POINTS}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCreate}
          disabled={!canCreate}
          className="flex w-full items-center justify-center"
          aria-label={canCreate ? "创建角色" : "创建角色不可用"}
        >
          <img
            style={{ filter: "drop-shadow(0px 6px 16px rgba(0, 0, 0, 0.24))" }}
            className="w-[260px]"
            src={$img(canCreate ? "btn-create-profile" : "btn-create-profile-dis")}
            alt={canCreate ? "创建角色" : "创建角色不可用"}
          />
        </button>
        <div className="mt-2 text-center text-[11px] leading-[1.6] text-[#6d5838]">
          {canCreate
            ? "灵根与属性已定，可以正式踏入修行。"
            : selectedSpiritRoot === null
              ? "先选定灵根，再将 5 点额外属性分配完。"
              : `还需分配完 ${remainingPoints} 点额外属性。`}
        </div>
      </div>
    </div>
  )
}

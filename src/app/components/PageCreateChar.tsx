import { useCallback, useEffect, useMemo, useState } from 'react';
import { trackEvent, trackPageView, track, UmamiEvents } from '@/lib/analytics/umami';
import { useToast } from '../hooks/useToast';
import { ramdomFirstName, ramdomIdentity, ramdomLastName } from '@/utils/ramdom'
import { useLogin } from '../hooks/useLogin';
import useGameControll from '@/app/hooks/useGameControll';
import { CharacterCreationSection } from './CharacterCreationSection';

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

  return (
    <div className="text-[#111] text-[14px] flex flex-col items-center">
      {/* 基本信息部分 */}
      <div className="text-[24px] mt-[24px]">{`{ 创建角色 }`}</div>
      <div className="text-[48px] ">{`"在下名为"`}</div>
      <div>我将以这个名字开启修行之路 （确认后无法更改）</div>
      
      <div className="border-b-[1px] h-[56px] w-[calc(100vw-72px)] mt-[62px] box-border flex flex-row items-end justify-between leading-[1] pb-[7px]">
        <div className="text-[#11111188]">姓氏</div>
        <input className="text-[48px] w-[2em] focus-visible:outline-none text-center" maxLength={2} value={createForm[0]} onChange={(e) => handleUserInput(e, 0)} onFocus={() => track('web.create_character.input.click', { input_type: 'surname' })} />
        <div onClick={handleRandomFirstName}>随机</div>
      </div>

      <div className="border-b-[1px] h-[56px] w-[calc(100vw-72px)] mt-[36px] box-border flex flex-row items-end justify-between leading-[1] pb-[7px]">
        <div className="text-[#11111188]">名&nbsp;</div>
        <input className="text-[48px] w-[2em] focus-visible:outline-none text-center" maxLength={2} value={createForm[1]} onChange={(e) => handleUserInput(e, 1)} onFocus={() => track('web.create_character.input.click', { input_type: 'name' })} />
        <div onClick={handleRandomLastName}>随机</div>
      </div>

      <div className="border-b-[1px] h-[56px] w-[calc(100vw-72px)] mt-[36px] box-border flex flex-row items-end justify-between leading-[1] pb-[7px]">
        <div className="text-[#11111188]">身份</div>
        <input className="text-[20px] text-center w-[9em] focus-visible:outline-none" maxLength={9} value={createForm[2]} onChange={(e) => handleUserInput(e, 2)} onFocus={() => track('web.create_character.input.click', { input_type: 'identity' })} />
        <div onClick={handleRandomIdentity}>随机</div>
      </div>

      {/* 新的灵根选择和属性加点部分 */}
      <div className="mt-[40px] w-full flex flex-col items-center">
        <CharacterCreationSection 
          extraAttributePoints={bonus}
          selectedSpiritRoot={selectedSpiritRoot}
          onSpiritRootSelect={handleSpiritRootSelect}
          attributePoints={attributePoints}
          onAttributeChange={handleAttributeChange}
          remainingPoints={MAX_ATTRIBUTE_POINTS - extraPointsUsed}
          totalPoints={MAX_ATTRIBUTE_POINTS}
          canCreate={canCreate}
          onCreate={handleCreate}
        />
      </div>
    </div>
  )
}
import { useCallback, useEffect, useMemo, useState } from 'react';
import { $img } from '@/utils';
import { useToast } from '../hooks/useToast';
import { ramdomFirstName, ramdomIdentity, ramdomLastName } from '@/utils/ramdom'
import { useLogin } from '../hooks/useLogin';
import useGameControll from '@/app/hooks/useGameControll';
import { CharacterCreationSection } from './CharacterCreationSection';

const MAX_ATTRIBUTE_POINTS = 5

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
  const [selectedSpiritRoot, setSelectedSpiritRoot] = useState<number | null>(null)
  const [attributePoints, setAttributePoints] = useState({
    魅力: 1,
    神识: 1,
    身手: 1
  })

  useEffect(() => {
    checkLogin()
  }, [checkLogin])

  const updateFormValue = useCallback((index: number, value: string) => {
    setCreateForm(pre => pre.map((item, i) => i === index ? value : item))
  }, [])

  const handleUserInput = useCallback((event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    setCreateForm(pre => pre.map((item, i) => i === index ? event.target.value : item))
  }, [])

  const calculateAdjustedAttributes = useCallback((currentPoints: typeof attributePoints, bonus: { 魅力: number, 神识: number, 身手: number }) => {
    const adjustedPoints = { ...currentPoints }
    let hasAdjustment = false

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

  const handleSpiritRootSelect = useCallback((index: number) => {
    const newBonus = spiritRoots[index].bonus
    const { adjustedPoints, hasAdjustment } = calculateAdjustedAttributes(attributePoints, newBonus)

    setSelectedSpiritRoot(index)
    if (hasAdjustment) {
      setAttributePoints(adjustedPoints)
      showToast("灵根切换后属性已自动调整至上限内")
    }
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

  const getExtraPointsUsed = useCallback(() => {
    return (attributePoints.魅力 - 1) + (attributePoints.神识 - 1) + (attributePoints.身手 - 1)
  }, [attributePoints])

  const handleAttributeChange = useCallback((attribute: keyof typeof attributePoints, value: number) => {
    const currentValue = attributePoints[attribute]
    const totalWithBonus = value + (bonus[attribute] || 0)

    if (totalWithBonus > 6) {
      showToast(`${attribute}属性最高为6点`)
      return
    }

    if (value < 1) {
      showToast(`${attribute}属性最低为1点`)
      return
    }

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
  }, [attributePoints, bonus, showToast])

  const handleRandomFirstName = useCallback(() => {
    updateFormValue(0, ramdomFirstName());
  }, [updateFormValue])

  const handleRandomLastName = useCallback(() => {
    updateFormValue(1, ramdomLastName());
  }, [updateFormValue])

  const handleRandomIdentity = useCallback(() => {
    updateFormValue(2, ramdomIdentity());
  }, [updateFormValue])

  const canCreate = createForm[0].length > 0 &&
                   createForm[1].length > 0 &&
                   createForm[2].length > 0 &&
                   selectedSpiritRoot !== null &&
                   getExtraPointsUsed() === MAX_ATTRIBUTE_POINTS

  const handleCreate = useCallback(() => {
    if (!canCreate) {
      return
    }

    const selectedSpiritRootName = selectedSpiritRoot !== null ? spiritRoots[selectedSpiritRoot].name : ''
    toCreateLoadingPage(createForm, "", totalAttributes, selectedSpiritRootName)
  }, [canCreate, createForm, selectedSpiritRoot, toCreateLoadingPage, totalAttributes])

  const extraPointsUsed = getExtraPointsUsed()

  return (
    <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-6 px-4 pb-14 pt-6 text-[#111] xl:px-6 xl:pt-8">
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[32px] border border-[#d7c49c] bg-[rgba(248,241,225,0.92)] p-6 shadow-[0_18px_44px_rgba(85,58,23,0.08)]">
          <div className="text-[20px] text-[#6b5738] xl:text-[22px]">{`{ 创建角色 }`}</div>
          <div className="mt-2 text-[36px] leading-none xl:text-[52px]">{`"在下名为"`}</div>
          <div className="mt-2 text-[13px] leading-6 text-[#6c5735] xl:text-[14px]">我将以这个名字开启修行之路。角色名确认后不可更改，请在此刻定下命数。</div>

          <div className="mt-8 space-y-6">
            <FieldRow
              label="姓氏"
              value={createForm[0]}
              maxLength={2}
              onChange={(event) => handleUserInput(event, 0)}
              onRandom={handleRandomFirstName}
              inputClassName="text-[44px] xl:text-[52px]"
            />
            <FieldRow
              label="名"
              value={createForm[1]}
              maxLength={2}
              onChange={(event) => handleUserInput(event, 1)}
              onRandom={handleRandomLastName}
              inputClassName="text-[44px] xl:text-[52px]"
            />
            <FieldRow
              label="身份"
              value={createForm[2]}
              maxLength={9}
              onChange={(event) => handleUserInput(event, 2)}
              onRandom={handleRandomIdentity}
              inputClassName="text-[22px] xl:text-[24px]"
              wide
            />
          </div>

          <div className="mt-8 rounded-[28px] border border-[#d9c8a6] bg-[rgba(255,249,239,0.86)] p-5">
            <div className="flex items-center justify-between text-[13px] text-[#6b5738]">
              <span>命格预览</span>
              <span>{selectedSpiritRoot !== null ? spiritRoots[selectedSpiritRoot].name : "待定灵根"}</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <PreviewStat label="魅力" value={totalAttributes.魅力} />
              <PreviewStat label="神识" value={totalAttributes.神识} />
              <PreviewStat label="身手" value={totalAttributes.身手} />
            </div>
            <div className="mt-4 flex items-center gap-3 rounded-[20px] bg-[#efe5d1] px-4 py-3 text-[13px] text-[#6a5430]">
              <img className="h-10 w-10 shrink-0" src={$img('circle')} alt="命数轮盘" />
              <div className="leading-6">
                已分配额外属性 {extraPointsUsed}/{MAX_ATTRIBUTE_POINTS}。灵根加成会实时计入总属性，并自动处理超上限的情况。
              </div>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4">
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
        </section>
      </div>
    </div>
  )
}

const FieldRow = ({
  label,
  value,
  maxLength,
  onChange,
  onRandom,
  inputClassName,
  wide = false,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onRandom: () => void;
  inputClassName: string;
  wide?: boolean;
}) => {
  return (
    <div className="border-b border-[#b79d70] pb-3">
      <div className="flex items-end justify-between gap-4">
        <div className="shrink-0 text-[#11111188]">{label}</div>
        <input
          className={`min-w-0 flex-1 bg-transparent text-center focus-visible:outline-none ${wide ? "max-w-[12em]" : "max-w-[2.6em]"} ${inputClassName}`}
          maxLength={maxLength}
          value={value}
          onChange={onChange}
        />
        <button onClick={onRandom} className="shrink-0 text-[14px] text-[#6b5738]">
          随机
        </button>
      </div>
    </div>
  );
};

const PreviewStat = ({ label, value }: { label: string; value: number }) => (
  <div className="rounded-[20px] border border-[#d3bf95] bg-[#fffaf1] px-4 py-3 text-center">
    <div className="text-[12px] text-[#6c5836]">{label}</div>
    <div className="mt-2 text-[28px] leading-none text-[#2e2217]">{value}</div>
  </div>
);

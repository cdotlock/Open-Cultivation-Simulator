import { $img } from "@/utils";
import React from "react";

interface SpiritualRootSectionProps {
  selectedSpiritRoot: number | null;
}

export const SpiritualRootSection = ({ selectedSpiritRoot }: SpiritualRootSectionProps) => {
  // 根据选择的灵根显示不同的加成信息
  const getBonusText = () => {
    if (selectedSpiritRoot === null) return "请选择灵根";
    
    const bonusMap = {
      0: "神识+1 身手+1", // 金灵根
      1: "魅力+1 神识+1", // 木灵根
      2: "魅力+2",         // 水灵根
      3: "身手+2",         // 火灵根
      4: "魅力+1 身手+1"  // 土灵根
    };
    
    return bonusMap[selectedSpiritRoot as keyof typeof bonusMap] || "请选择灵根";
  };

  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex items-center gap-2 relative self-stretch w-full flex-[0_0_auto]">
        <img
          className="relative h-px max-w-[132px] flex-1 opacity-75"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />

        <div className="relative w-fit font-family-song text-center text-sm font-normal leading-[normal] whitespace-nowrap text-[#111111] tracking-[0.14em]">
          选择灵根
        </div>

        <img
          className="relative h-px max-w-[132px] flex-1 opacity-75"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />
      </div>

      <div className="relative self-stretch text-center font-family-song text-xs font-normal leading-[normal] tracking-[0.04em] text-[#11111180]">
        {getBonusText()}
      </div>
    </div>
  );
};

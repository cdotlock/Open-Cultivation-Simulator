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
          className="flex-1 max-w-[132px] relative h-px"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />

        <div className="relative w-fit mt-[-1.00px] [font-family:'Huiwen-mincho-Regular',Helvetica] font-normal text-[#111111] text-sm text-center tracking-[0] leading-[normal] whitespace-nowrap">
          选择灵根
        </div>

        <img
          className="flex-1 max-w-[132px] relative h-px"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />
      </div>

      <div className="relative self-stretch text-[#11111180] text-xs tracking-[0] [font-family:'Huiwen-mincho-Regular',Helvetica] font-normal text-center leading-[normal]">
        {getBonusText()}
      </div>
    </div>
  );
};

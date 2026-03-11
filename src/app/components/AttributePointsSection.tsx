import { $img } from "@/utils";
import React from "react";

export const AttributePointsSection = ({ remainingPoints = 7, totalPoints = 7 }) => {
  return (
    <div className="flex w-full flex-col items-center gap-1">
      <div className="flex items-center justify-center gap-2 relative self-stretch w-full flex-[0_0_auto]">
        <img
          className="flex-1 relative h-px"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />

        <div className="relative flex-shrink-0 mt-[-1.00px] [font-family:'Huiwen-mincho-Regular',Helvetica] font-normal text-[#111111] text-sm text-center tracking-[0] leading-[normal] whitespace-nowrap">
          分配属性点
        </div>

        <img
          className="flex-1 relative h-px"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />
      </div>

      <div className="relative self-stretch text-[#11111180] text-xs tracking-[0] [font-family:'Huiwen-mincho-Regular',Helvetica] font-normal text-center leading-[normal]">
        剩余：{remainingPoints}/{totalPoints}
      </div>
    </div>
  );
};

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

        <div className="relative mt-[-1.00px] flex-shrink-0 font-family-song text-center text-sm font-normal leading-[normal] whitespace-nowrap text-[#111111] tracking-[0]">
          分配属性点
        </div>

        <img
          className="flex-1 relative h-px"
          alt="Task dec right"
          src={$img('char/task_dec_right')}
        />
      </div>

      <div className="relative self-stretch font-family-song text-center text-xs font-normal leading-[normal] text-[#11111180] tracking-[0]">
        剩余：{remainingPoints}/{totalPoints}
      </div>
    </div>
  );
};

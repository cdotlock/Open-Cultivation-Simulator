import { $img } from "@/utils";
import React from "react";

interface AttributeCardProps {
  title: string;
  description: string;
  initialValue: number;
  onValueChange: (title: string, newValue: number) => void;
  extraValue: number;
}

export const AttributeCard = ({ title, description, extraValue, initialValue = 1, onValueChange }: AttributeCardProps) => {
  const handleIncrement = () => {
    const newValue = initialValue + 1;
    onValueChange?.(title, newValue);
  };

  const handleDecrement = () => {
    if (initialValue > 1) {
      const newValue = initialValue - 1;
      onValueChange?.(title, newValue);
    }
  };

  return (
    <div className="grid min-h-[72px] w-full grid-cols-[1fr_auto] items-center rounded-xl border border-solid border-[#cec498] bg-[#f4f1e1] px-3 py-2">
      <div>
        <div className="[font-family:'Huiwen-mincho-Regular',Helvetica] text-xl leading-none text-[#111111]">
          {title}
        </div>
        <div className="mt-2 text-xs leading-none text-[#11111199]">
          {description}
        </div>
      </div>

      <div className="inline-flex items-center gap-4 pl-3">
        <button 
          onClick={handleDecrement}
          className="relative w-6 h-6 aspect-[1] cursor-pointer"
          disabled={initialValue <= 1}
        >
          <img
            className="w-full h-full"
            alt="Decrease"
            src={$img('char/btn-decrease')}
          />
        </button>

        <div className="relative w-fit [font-family:'Huiwen-mincho-Regular',Helvetica] font-normal text-black text-xl tracking-[-1.00px] leading-[normal] whitespace-nowrap">
          {initialValue + extraValue}
        </div>

        <button 
          onClick={handleIncrement}
          className="relative w-6 h-6 aspect-[1] cursor-pointer"
        >
          <img
            className="w-full h-full"
            alt="Increase"
            src={$img('char/btn-increase')}
          />
        </button>
      </div>
    </div>
  );
};

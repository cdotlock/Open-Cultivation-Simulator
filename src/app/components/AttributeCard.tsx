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
    <div className="grid min-h-[84px] w-full grid-cols-[1fr_auto] items-center rounded-[18px] border border-solid border-[#cec498] bg-[#f4f1e1] px-4 py-3 shadow-[0_10px_20px_rgba(56,36,14,0.04)]">
      <div>
        <div className="flex items-center gap-2">
          <div className="font-family-song text-[22px] leading-none text-[#111111]">{title}</div>
          {extraValue > 0 ? (
            <span className="rounded-full bg-[#ead8b0] px-2 py-[4px] text-[11px] text-[#6f552d]">灵根 +{extraValue}</span>
          ) : null}
        </div>
        <div className="mt-2 text-xs leading-[1.5] text-[#11111199]">{description}</div>
      </div>

      <div className="inline-flex items-center gap-2 pl-3">
        <button 
          type="button"
          onClick={handleDecrement}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d7c18c] bg-[#fff7e5] transition-transform active:translate-y-[1px] disabled:opacity-45"
          disabled={initialValue <= 1}
          aria-label={`${title}减少一点`}
        >
          <img
            className="h-6 w-6"
            alt="Decrease"
            src={$img('char/btn-decrease')}
          />
        </button>

        <div className="min-w-[2.5em] text-center font-family-song text-[28px] font-normal leading-none whitespace-nowrap text-black tracking-[-1.00px]">
          {initialValue + extraValue}
        </div>

        <button 
          type="button"
          onClick={handleIncrement}
          className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d7c18c] bg-[#fff7e5] transition-transform active:translate-y-[1px]"
          aria-label={`${title}增加一点`}
        >
          <img
            className="h-6 w-6"
            alt="Increase"
            src={$img('char/btn-increase')}
          />
        </button>
      </div>
    </div>
  );
};

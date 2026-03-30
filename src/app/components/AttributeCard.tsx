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
        <div className="font-family-song text-[17px] leading-none text-[#111111]">{title}</div>
        <div className="mt-[3px] flex items-center gap-1">
          {extraValue > 0 ? (
            <span className="rounded-full bg-[#ead8b0] px-[6px] py-[2px] text-[10px] text-[#6f552d]">灵根 +{extraValue}</span>
          ) : null}
        </div>
        <div className="mt-1 text-xs leading-[1.5] text-[#11111199]">{description}</div>
      </div>

      <div className="inline-flex items-center gap-1 pl-2">
        <button
          type="button"
          onClick={handleDecrement}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d7c18c] bg-[#fff7e5] transition-transform active:translate-y-[1px] disabled:opacity-45"
          disabled={initialValue <= 1}
          aria-label={`${title}减少一点`}
        >
          <img
            className="h-5 w-5"
            alt="Decrease"
            src={$img('char/btn-decrease')}
          />
        </button>

        <div className="min-w-[2em] text-center font-family-song text-[22px] font-normal leading-none whitespace-nowrap text-black tracking-[-1.00px]">
          {initialValue + extraValue}
        </div>

        <button
          type="button"
          onClick={handleIncrement}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#d7c18c] bg-[#fff7e5] transition-transform active:translate-y-[1px]"
          aria-label={`${title}增加一点`}
        >
          <img
            className="h-5 w-5"
            alt="Increase"
            src={$img('char/btn-increase')}
          />
        </button>
      </div>
    </div>
  );
};

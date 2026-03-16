import { $img } from "@/utils";
import React from "react";

interface SpiritualElementsProps {
  selectedSpiritRoot: number | null;
  onSpiritRootSelect: (index: number) => void;
}

export const SpiritualElements = ({ selectedSpiritRoot, onSpiritRootSelect }: SpiritualElementsProps) => {
  const elements = ['金', '木', '水', '火', '土'];
  
  return (
    <div className="grid w-full grid-cols-5 items-center justify-evenly gap-2">
      {elements.map((element, index) => (
        <button
          type="button"
          key={element}
          onClick={() => onSpiritRootSelect(index)}
          className={`relative flex h-16 w-full items-center justify-center rounded-[18px] border border-[#d8c89f] bg-[rgba(255,250,242,0.85)] transition-transform active:translate-y-[1px] ${
            selectedSpiritRoot === index 
              ? 'bg-[rgba(255,247,229,0.96)] text-[#111111] shadow-[0_8px_18px_rgba(149,111,57,0.14)]' 
              : 'text-[#11111180]'
          }`}
          aria-pressed={selectedSpiritRoot === index}
        >
          <div className="font-family-song text-center text-xl font-normal leading-[normal] whitespace-nowrap tracking-[-1.00px]">
            {element}
          </div>
          
          {/* 选中状态使用图片框选 */}
          {selectedSpiritRoot === index && (
            <img 
              className="absolute w-12 h-12 shrink-0"
              style={{ 
                transform: 'translate(-50%, -50%)',
                top: '50%',
                left: '50%'
              }}
              alt="Group" 
              src={$img('char/attr-active')}
            />
          )}
        </button>
      ))}
    </div>
  );
};

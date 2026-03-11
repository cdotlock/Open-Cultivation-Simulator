import React from "react";
import { SpiritualRootSection } from "./SpiritualRootSection";
import { SpiritualElements } from "./SpiritualElements";
import { AttributePointsSection } from "./AttributePointsSection";
import { AttributeCards } from "./AttributeCards";
import { $img } from '@/utils';

interface AttributePoints {
  魅力: number;
  神识: number;
  身手: number;
}

interface CharacterCreationSectionProps {
  selectedSpiritRoot: number | null;
  onSpiritRootSelect: (index: number) => void;
  attributePoints: AttributePoints;
  onAttributeChange: (attribute: keyof AttributePoints, value: number) => void;
  remainingPoints: number;
  totalPoints: number;
  canCreate: boolean;
  onCreate: () => void;
  extraAttributePoints: AttributePoints;
}

export const CharacterCreationSection = ({ 
  selectedSpiritRoot, 
  onSpiritRootSelect, 
  attributePoints, 
  onAttributeChange, 
  remainingPoints,
  totalPoints,
  canCreate,
  onCreate,
  extraAttributePoints
}: CharacterCreationSectionProps) => {

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-[28px] border border-[#d6c398] bg-[rgba(250,244,230,0.9)] p-4 shadow-[0_12px_30px_rgba(87,58,25,0.08)] xl:p-6">
      {/* Spiritual Root Selection */}
      <div className="flex w-full flex-col items-center gap-3">
        <SpiritualRootSection selectedSpiritRoot={selectedSpiritRoot} />
        <SpiritualElements 
          selectedSpiritRoot={selectedSpiritRoot}
          onSpiritRootSelect={onSpiritRootSelect}
        />
      </div>

      {/* Attribute Points Allocation */}
      <div className="flex flex-col items-center gap-3 w-full">
        <AttributePointsSection remainingPoints={remainingPoints} totalPoints={totalPoints} />
        <AttributeCards 
          extraAttributePoints={extraAttributePoints}
          attributePoints={attributePoints}
          onAttributeChange={onAttributeChange} 
        />
        
        {/* 生成按钮 - 紧贴在属性点下方 */}
        <div className="mt-2 flex w-full flex-row justify-center">
          <img
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.25))" }}
            className={`w-full max-w-[320px] cursor-pointer ${canCreate ? "" : "hidden"}`}
            onClick={canCreate ? onCreate : undefined}
            src={$img("btn-create-profile")}
            alt="btn-create" />
          <img
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.25))" }}
            className={`w-full max-w-[320px] ${canCreate ? "hidden" : ""}`}
            src={$img("btn-create-profile-dis")}
            alt="btn-create-dis" />
        </div>
      </div>
    </div>
  );
};

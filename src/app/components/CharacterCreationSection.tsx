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
    <div className="flex flex-col items-center gap-4 p-4 bg-[#f2ebd9] w-full max-w-md mx-auto">
      {/* Spiritual Root Selection */}
      <div className="flex flex-col items-center gap-3">
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
        <div className="mt-2 w-full flex flex-row justify-center">
          <img
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.25))" }}
            className={`w-[73.2%] ${canCreate ? "" : "hidden"}`}
            onClick={canCreate ? onCreate : undefined}
            src={$img("btn-create-profile")}
            alt="btn-create" />
          <img
            style={{ filter: "drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.25))" }}
            className={`w-[73.2%] ${canCreate ? "hidden" : ""}`}
            src={$img("btn-create-profile-dis")}
            alt="btn-create-dis" />
        </div>
      </div>
    </div>
  );
};

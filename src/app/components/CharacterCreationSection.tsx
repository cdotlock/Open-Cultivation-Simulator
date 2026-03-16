import React from "react";
import { SpiritualRootSection } from "./SpiritualRootSection";
import { SpiritualElements } from "./SpiritualElements";
import { AttributePointsSection } from "./AttributePointsSection";
import { AttributeCards } from "./AttributeCards";

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
  extraAttributePoints: AttributePoints;
}

export const CharacterCreationSection = ({ 
  selectedSpiritRoot, 
  onSpiritRootSelect, 
  attributePoints, 
  onAttributeChange, 
  remainingPoints,
  totalPoints,
  extraAttributePoints
}: CharacterCreationSectionProps) => {

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-5 p-4 sm:p-5">
      {/* Spiritual Root Selection */}
      <div className="flex w-full flex-col items-center gap-3 rounded-[24px] border border-[#dbc9a6] bg-[rgba(255,250,241,0.76)] p-4">
        <SpiritualRootSection selectedSpiritRoot={selectedSpiritRoot} />
        <SpiritualElements 
          selectedSpiritRoot={selectedSpiritRoot}
          onSpiritRootSelect={onSpiritRootSelect}
        />
      </div>

      {/* Attribute Points Allocation */}
      <div className="flex w-full flex-col items-center gap-3 rounded-[24px] border border-[#dbc9a6] bg-[rgba(255,250,241,0.76)] p-4">
        <AttributePointsSection remainingPoints={remainingPoints} totalPoints={totalPoints} />
        <AttributeCards 
          extraAttributePoints={extraAttributePoints}
          attributePoints={attributePoints}
          onAttributeChange={onAttributeChange} 
        />
      </div>
    </div>
  );
};

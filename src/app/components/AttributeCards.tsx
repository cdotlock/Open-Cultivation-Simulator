import React from "react";
import { AttributeCard } from "./AttributeCard";

interface AttributePoints {
  魅力: number;
  神识: number;
  身手: number;
}

interface AttributeCardsProps {
  attributePoints: AttributePoints;
  extraAttributePoints: AttributePoints;
  onAttributeChange: (attribute: keyof AttributePoints, value: number) => void;
}

export const AttributeCards = ({ attributePoints, extraAttributePoints, onAttributeChange }: AttributeCardsProps) => {
  const attributes = [
    {
      title: "魅力",
      description: "主要用于交流类行动检定",
      initialValue: attributePoints.魅力
    },
    {
      title: "神识", 
      description: "主要用于探索类行动检定",
      initialValue: attributePoints.神识
    },
    {
      title: "身手",
      description: "主要用于战斗类行动检定", 
      initialValue: attributePoints.身手
    }
  ];

  return (
    <div className="flex w-full flex-col items-start gap-2">
      {attributes.map((attr, index) => (
        <AttributeCard
          key={index}
          title={attr.title}
          description={attr.description}
          extraValue={extraAttributePoints[attr.title as keyof AttributePoints]}
          initialValue={attr.initialValue}
          onValueChange={(title: string, newValue: number) => {
            const attributeKey = title === '魅力' ? '魅力' : title === '神识' ? '神识' : '身手';
            onAttributeChange(attributeKey as keyof AttributePoints, newValue);
          }}
        />
      ))}
    </div>
  );
};

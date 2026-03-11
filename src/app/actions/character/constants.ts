import { CharacterStatusType } from "@/interfaces/schemas";
import { LevelAttributeLimits, CultivationLevel, LevelAttributeLimit } from "@/interfaces/const";
// 各等级的属性上限和下限


export interface CharacterStatusTypeWithMax extends CharacterStatusType {
  最大体魄: number,
  最大道心: number,
  最大行动点: number
}


export function formatStatusWithMax(status: CharacterStatusType): CharacterStatusTypeWithMax {
  const limits = getAttributeLimitsByLevel(status.等级);

  return {
    ...status,
    最大体魄: limits.体魄.max,
    最大道心: limits.道心.max,
    最大行动点: limits.行动点.max
  };
}

// 根据等级获取属性限制
export function getAttributeLimitsByLevel(level: CultivationLevel): LevelAttributeLimit {
  return LevelAttributeLimits[level];
}

/**
 * 格式化状态给LLM，显示为 当前值/最大值 的格式
 */
export function formatStatusForLLM(status: CharacterStatusType): string {
  const limits = getAttributeLimitsByLevel(status.等级);
  
  const formattedStatus = {
    等级: status.等级,
    体魄: `${status.体魄}/${limits.体魄.max}`,
    道心: `${status.道心}/${limits.道心.max}`,
    行动点: `${status.行动点}/${limits.行动点.max}`,
    突破成功系数: status.突破成功系数,
    是否死亡: status.是否死亡
  };
  
  return JSON.stringify(formattedStatus, null, 2);
}


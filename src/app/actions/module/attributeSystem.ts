import { getAttributeLimitsByLevel } from "../character/constants";
import { CharacterDescriptionType, CharacterStatusSchema, CharacterStatusType, StoryPushType } from "@/interfaces/schemas";
import { StatusDelta } from "@/interfaces/dto";

// 角色初始状态
export const getInitialStatus = (
  character: CharacterDescriptionType, 
  attributePoints?: { 魅力: number; 神识: number; 身手: number }
) => {
  // 根据角色等级获取体魄上限
  const limits = getAttributeLimitsByLevel(character.初始属性.等级);
  
  return CharacterStatusSchema.parse({
    灵根属性: character.初始属性.灵根,
    等级: character.初始属性.等级,
    体魄: limits.体魄.max, // 使用等级对应的体魄最大值
    道心: 3,
    魅力: attributePoints?.魅力 || 0,
    神识: attributePoints?.神识 || 0,
    身手: attributePoints?.身手 || 0,
    是否死亡: false,
    行动点: 50,
    突破成功系数: 0
  });
};

export function changeAttr(currentStatus: CharacterStatusType, storyPush: StoryPushType, success?: boolean) {

    const { 状态变化 } = storyPush.节点要素.剧情要素;

    const newStatus: CharacterStatusType = { ...currentStatus };

    const attributeLimits = getAttributeLimitsByLevel(currentStatus.等级);

    if (!success) {
        // 处理体魄变化
        if (状态变化.体魄变化[0] !== "无变化") {
            const [direction, degree] = 状态变化.体魄变化;
            const change = calculateAttributeChange("体魄", currentStatus.体魄, direction, degree, currentStatus.等级);
            newStatus.体魄 = Math.max(0, Math.min(attributeLimits.体魄.max, currentStatus.体魄 + change));
        }

        // 处理道心变化
        if (状态变化.道心变化[0] !== "无变化") {
            const [direction, degree] = 状态变化.道心变化;
            const change = calculateAttributeChange("道心", currentStatus.道心, direction, degree, currentStatus.等级);
            newStatus.道心 = Math.max(0, Math.min(attributeLimits.道心.max, currentStatus.道心 + change));
        }
    }

    // 处理突破成功率变化
    if (状态变化.突破成功率变化[0] !== "无变化") {
        const [direction, degree] = 状态变化.突破成功率变化;
        const change = calculateAttributeChange("突破成功系数", currentStatus.突破成功系数, direction, degree, currentStatus.等级);
        newStatus.突破成功系数 = Math.max(0, Math.min(1, currentStatus.突破成功系数 + change)); // 突破率范围为0-1
    }

    // 处理行动点变化
    // if (状态变化.行动点变化 && 状态变化.行动点变化[0] !== "无变化") {
    //     const [direction, degree] = 状态变化.行动点变化;
    //     // 如果是"全部"且是"增加"，则直接恢复满行动点
    //     if (degree === "全部" && direction === "增加") {
    //         newStatus.行动点 = attributeLimits.行动点.max;
    //     } else {
    //         const change = calculateAttributeChange("行动点", currentStatus.行动点, direction, degree, currentStatus.等级);
    //         newStatus.行动点 = Math.max(0, Math.min(attributeLimits.行动点.max, currentStatus.行动点 + change));
    //     }
    // }

    // 处理新属性变化（魅力、神识、身手）
    if (状态变化.魅力变化 && 状态变化.魅力变化[0] !== "无变化") {
        const [direction, degree] = 状态变化.魅力变化;
        const change = calculateAttributeChange("魅力", currentStatus.魅力, direction, degree, currentStatus.等级);
        newStatus.魅力 = Math.max(0, Math.min(100, currentStatus.魅力 + change));
    }

    if (状态变化.神识变化 && 状态变化.神识变化[0] !== "无变化") {
        const [direction, degree] = 状态变化.神识变化;
        const change = calculateAttributeChange("神识", currentStatus.神识, direction, degree, currentStatus.等级);
        newStatus.神识 = Math.max(0, Math.min(100, currentStatus.神识 + change));
    }

    if (状态变化.身手变化 && 状态变化.身手变化[0] !== "无变化") {
        const [direction, degree] = 状态变化.身手变化;
        const change = calculateAttributeChange("身手", currentStatus.身手, direction, degree, currentStatus.等级);
        newStatus.身手 = Math.max(0, Math.min(100, currentStatus.身手 + change));
    }

    // 行动点减1
    newStatus.行动点 = Math.max(0, newStatus.行动点 - 1);

    // 检查角色是否死亡
    if (newStatus.体魄 <= 0 || newStatus.道心 <= 0 || newStatus.行动点 <= 0) {
        newStatus.是否死亡 = true;
    }

    return {
        newStatus,
        delta: calculateStatusDelta(currentStatus, newStatus)
    }
}

export function calculateStatusDelta(oldStatus: CharacterStatusType, newStatus: CharacterStatusType): StatusDelta {
    return {
        体魄: Number((newStatus.体魄 - oldStatus.体魄).toFixed(2)),
        行动点: Number((newStatus.行动点 - oldStatus.行动点).toFixed(2)),
        道心: Number((newStatus.道心 - oldStatus.道心).toFixed(2)),
        突破成功系数: Number((newStatus.突破成功系数 - oldStatus.突破成功系数).toFixed(3)),
        魅力: Number((newStatus.魅力 - oldStatus.魅力).toFixed(2)),
        神识: Number((newStatus.神识 - oldStatus.神识).toFixed(2)),
        身手: Number((newStatus.身手 - oldStatus.身手).toFixed(2))
    }
}

function calculateAttributeChange(attribute: string, currentValue: number, direction: "增加" | "减少", degree: string, level: string): number {
    // 如果是"全部"，且是减少，特殊处理
    if (degree === "全部" && direction === "减少") {
        if (attribute === "体魄") return -currentValue; // 清空体魄
        return 0; // 其他属性不处理全部减少
    }

    const { 基础值 } = getChangeValueByDegree(degree, attribute);

    // 获取随机基础值
    const baseValue = attribute === "道心"
        ? 基础值[0]  // 道心直接取固定值
        : getRandomBaseValue(基础值);

    // 根据公式计算变化值
    let changeValue = 0;

    // 突破率计算需要考虑突破难度
    if (attribute === "突破成功系数") {
        // 根据等级计算突破难度系数：越高等级，突破越难
        const levelDifficulty = {
            "炼气": 1,
            "筑基": 1.2,
            "金丹": 1.5,
            "元婴": 1.8,
            "化神": 2.1,
            "炼虚": 2.5,
            "合体": 3,
            "渡劫": 3.5,
            "真仙": 4
        }[level] || 1;

        changeValue = baseValue * levelDifficulty / 100; // 按百分比
    } else if (attribute === "道心") {
        // 道心只加减基础值
        changeValue = baseValue;
    } else if (attribute === "行动点") {
        // 行动点只加减基础值
        changeValue = baseValue;
    } else {
        // 行动点、体魄、道心的计算公式：基础值 + (当前值 * 变化百分比)
        changeValue = baseValue
    }

    return direction === "增加" ? changeValue : -changeValue;
}

// 获取随机的基础值
function getRandomBaseValue(range: number[]): number {
    if (range.length < 2) return 0;
    const min = range[0];
    const max = range[1];
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// 根据变化程度获取基础值和变化百分比
function getChangeValueByDegree(degree: string, attribute: string): { 基础值: number[], 变化百分比: number } {
    // 对道心特殊处理
    if (attribute === "道心") {
        // 临时修改: 90%概率不影响道心
        if (Math.random() < 0.9) {
            return { 基础值: [0, 0], 变化百分比: 0 };
        }

        switch (degree) {
            case "一点":
            case "中等":
                return { 基础值: [0.5, 0.5], 变化百分比: 0 }; // 道心基础值固定为0.5
            case "多":
            case "极多":
                return { 基础值: [1, 1], 变化百分比: 0 }; // 道心基础值固定为1
            default:
                return { 基础值: [0, 0], 变化百分比: 0 };
        }
    }

    // 对其他属性通用处理
    switch (degree) {
        case "一点":
            return { 基础值: [2, 2], 变化百分比: 0.05 };
        case "中等":
            return { 基础值: [3, 3], 变化百分比: 0.1 };
        case "多":
            return { 基础值: [5, 5], 变化百分比: 0.15 };
        case "极多":
            return { 基础值: [7, 7], 变化百分比: 0.2 };
        case "全部":
            return { 基础值: [], 变化百分比: 0 }; // 全部会有特殊处理
        default:
            return { 基础值: [0, 0], 变化百分比: 0 };
    }
}

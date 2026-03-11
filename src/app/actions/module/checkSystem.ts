import { FormattedCharacterStatus } from '@/interfaces/dto';
import { difficultyLevels } from '@/interfaces/schemas';

// 检定结果类型
export interface CheckResult {
  success: boolean;
  rollResult: number;
  baseDC: number;          // 基础DC值（难度对应的DC）
  modifier: number;        // 总修正值（应用到骰子结果上）
  successRate: number;
  // 两个单骰点数（用于前端动画展示）
  diceValues: [number, number];
  // 变动原因列表
  changeReasons: string[];
}

// 难度对应的DC值
const DIFFICULTY_DC = {
  轻而易举: 4,
  按部就班: 7,
  普通: 8,      // 保持原有普通难度
  挑战重重: 10,
  困难: 11,      // 保持原有困难难度
  困难卓绝: 12,
  极困难: 13,    // 保持原有极困难难度
  逆天而行: 14
};

// 成功奖励（突破成功率增加）
const SUCCESS_REWARDS = {
  轻而易举: 0.001, // 0.1%
  按部就班: 0.002, // 0.2%
  普通: 0.003,     // 0.3%
  挑战重重: 0.004, // 0.4%
  困难: 0.006,     // 0.6%
  困难卓绝: 0.008, // 0.8%
  极困难: 0.01,    // 1%
  逆天而行: 0.015  // 1.5%
};

// 2d6所有可能结果的概率分布
const DICE_2D6_PROBABILITIES = [
  { sum: 2, count: 1 },   // 1+1
  { sum: 3, count: 2 },   // 1+2, 2+1
  { sum: 4, count: 3 },   // 1+3, 2+2, 3+1
  { sum: 5, count: 4 },   // 1+4, 2+3, 3+2, 4+1
  { sum: 6, count: 5 },   // 1+5, 2+4, 3+3, 4+2, 5+1
  { sum: 7, count: 6 },   // 1+6, 2+5, 3+4, 4+3, 5+2, 6+1
  { sum: 8, count: 5 },   // 2+6, 3+5, 4+4, 5+3, 6+2
  { sum: 9, count: 4 },   // 3+6, 4+5, 5+4, 6+3
  { sum: 10, count: 3 },  // 4+6, 5+5, 6+4
  { sum: 11, count: 2 },  // 5+6, 6+5
  { sum: 12, count: 1 }   // 6+6
];

/**
 * 投掷2d6，返回两个单骰点数
 */
function roll2d6(): [number, number] {
  const d1 = Math.floor(Math.random() * 6) + 1;
  const d2 = Math.floor(Math.random() * 6) + 1;
  return [d1, d2];
}

/**
 * 应用运气因素到骰子修正值
 * 20%概率+1修正，20%概率-1修正，60%无修正
 */
function applyLuckFactor(): { luckModifier: number; changeReasons: string[] } {
  const random = Math.random();
  const changeReasons: string[] = [];

  if (random < 0.2) {
    // 20%概率运气好，+1修正
    changeReasons.push("天道眷顾+1");
    return { luckModifier: 1, changeReasons };
  } else if (random < 0.4) {
    // 20%概率运气差，-1修正
    changeReasons.push("霉运连连-1");
    return { luckModifier: -1, changeReasons };
  } else {
    // 60%概率无修正
    return { luckModifier: 0, changeReasons };
  }
}

/**
 * 应用能力修正因素到骰子修正值
 * 公式：对应加点数值 - 3
 */
function applyAbilityCorrection(
  actionType: '交流' | '探索' | '战斗',
  status: FormattedCharacterStatus
): { abilityModifier: number; changeReasons: string[] } {
  const changeReasons: string[] = [];
  let abilityValue = 0;

  // 根据行动类型获取对应的加点数值
  switch (actionType) {
    case '交流':
      abilityValue = status.魅力 || 0;
      break;
    case '探索':
      abilityValue = status.神识 || 0;
      break;
    case '战斗':
      abilityValue = status.身手 || 0;
      break;
  }

  // 计算能力修正：加点数值 - 3
  const abilityModifier = abilityValue - 3;

  if (abilityModifier !== 0) {
    const sign = abilityModifier > 0 ? '+' : '';
    changeReasons.push(`能力修正${sign}${abilityModifier}`);
  }

  return { abilityModifier, changeReasons };
}

/**
 * 应用状态条件因素到骰子修正值
 * 根据角色状态应用不同的修正
 */
function applyStatusConditions(
  actionType: '交流' | '探索' | '战斗',
  status: FormattedCharacterStatus
): { statusModifier: number; changeReasons: string[] } {
  const changeReasons: string[] = [];
  let statusModifier = 0;

  // 神完气足:体魄>35:+1修正
  if (status.体魄 > 35) {
    statusModifier += 1;
    changeReasons.push("神完气足+1");
  }

  // 身负重伤:体魄<20:战斗探索-1修正
  if (status.体魄 < 20 && (actionType === '战斗' || actionType === '探索')) {
    statusModifier -= 1;
    changeReasons.push("身负重伤-1");
  }

  // 道心清明：道心>=3：交流探索+1修正
  if (status.道心 >= 3 && (actionType === '交流' || actionType === '探索')) {
    statusModifier += 1;
    changeReasons.push("道心清明+1");
  }

  // 心魔缠身:道心<=1:所有行动-1修正
  if (status.道心 <= 1) {
    statusModifier -= 1;
    changeReasons.push("心魔缠身-1");
  }

  return { statusModifier, changeReasons };
}

/**
 * 计算检定成功率
 * 公式：需要2d6 + modifier >= dc
 */
function calculateSuccessRate(modifier: number, dc: number): number {
  const effectiveDC = dc;
  
  // 计算需要的最小骰子值
  const minDiceNeeded = effectiveDC - modifier;
  
  // 如果需要的骰子值<=2，2d6最小值就是2，100%成功
  if (minDiceNeeded <= 2) return 100;
  
  // 如果需要的骰子值>12，2d6最大值就是12，0%成功  
  if (minDiceNeeded > 12) return 0;
  
  // 计算2d6 >= minDiceNeeded的概率
  let successfulOutcomes = 0;
  
  for (const { sum, count } of DICE_2D6_PROBABILITIES) {
    if (sum >= minDiceNeeded) {
      successfulOutcomes += count;
    }
  }
  
  // 总共36种可能的结果 (6*6)
  const totalOutcomes = 36;
  const successRate = (successfulOutcomes / totalOutcomes) * 100;
  
  return Math.round(successRate * 100) / 100; // 保留两位小数
}

/**
 * 执行检定
 */
export function performCheck(
  actionType: '交流' | '探索' | '战斗',
  difficulty: typeof difficultyLevels[number],
  status: FormattedCharacterStatus
): CheckResult {
  const baseDC = DIFFICULTY_DC[difficulty];
  const changeReasons: string[] = [];

  // 应用运气因素（现在应用到骰子修正值）
  const { luckModifier, changeReasons: luckReasons } = applyLuckFactor();
  changeReasons.push(...luckReasons);

  // 应用能力修正因素（现在应用到骰子修正值） 
  const { abilityModifier, changeReasons: abilityReasons } = applyAbilityCorrection(actionType, status);
  changeReasons.push(...abilityReasons);

  // 应用状态条件因素（现在应用到骰子修正值）
  const { statusModifier, changeReasons: statusReasons } = applyStatusConditions(actionType, status);
  changeReasons.push(...statusReasons);

  // 计算总修正值（包括所有修正因素）
  const totalModifier = luckModifier + abilityModifier + statusModifier;

  // debug输出每个fact数值和DC
  console.log(`[performCheck] actionType: ${actionType}, difficulty: ${difficulty}`);
  console.log(`[performCheck] 运气修正(luckModifier): ${luckModifier}`);
  console.log(`[performCheck] 能力修正(abilityModifier): ${abilityModifier}`);
  console.log(`[performCheck] 状态修正(statusModifier): ${statusModifier}`);
  console.log(`[performCheck] 总修正(totalModifier): ${totalModifier}`);
  console.log(`[performCheck] DC: ${baseDC}`);


  // 计算成功率（DC保持不变，修正值应用到骰子结果）
  const successRate = calculateSuccessRate(totalModifier, baseDC);

  // 投掷2d6
  const [d1, d2] = roll2d6();
  const rollResult = d1 + d2;

  // 计算最终结果（骰子结果 + 总修正值）
  const totalResult = rollResult + totalModifier;

  // 判断是否成功（骰子结果 + 修正值 >= 基础DC）
  const success = totalResult >= baseDC;
  console.log(`[performCheck] 最终结果: ${totalResult} >= ${baseDC} = ${success}`);

  return {
    success,
    rollResult: totalResult, // 返回最终结果（骰子 + 修正值）
    baseDC: baseDC,          // 基础DC值（保持不变）
    modifier: totalModifier, // 总修正值
    successRate,
    diceValues: [d1, d2],    // 原始骰子点数
    changeReasons
  };
}

/**
 * 获取成功奖励
 */
export function getSuccessReward(difficulty: typeof difficultyLevels[number]): number {
  return SUCCESS_REWARDS[difficulty];
}

/**
 * 计算所有选项的成功率
 */
export function calculateAllOptionSuccessRates(
  playerOptions: Array<{
    选项描述: string;
    选项类别: '交流' | '探索' | '战斗';
    选项难度: typeof difficultyLevels[number];
  }>,
  status: FormattedCharacterStatus
) {
  return playerOptions.map(option => {
    const checkResult = performCheck(option.选项类别, option.选项难度, status);

    return {
      ...option,
      成功率: checkResult.successRate,
      基础DC: checkResult.baseDC,
      修正值: checkResult.modifier,
      变动原因: checkResult.changeReasons
    };
  });
}

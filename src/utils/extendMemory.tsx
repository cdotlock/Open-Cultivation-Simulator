/**
 * 扩展记忆模块，用于给LLM提供一些额外的注入的提示词，以达成一定的差异化
 */

interface Params {
    turn: number[];
}

// Base rule configuration
interface BaseRuleConfig {
    turns: number[];
}

// Random rule type - requires randomList
interface RandomRuleConfig extends BaseRuleConfig {
  type: 'random';
  randomList: Array<string>;
}

// Fixed rule type - requires value
interface FixedRuleConfig extends BaseRuleConfig {
  type: 'fixed';
  value: string;
}

// Custom rule type - requires customFunction
interface CustomRuleConfig extends BaseRuleConfig {
  type: 'custom';
  customFunction: (params: Params) => string;
}

// Union type for all rule configurations
export type RuleConfig =
  | RandomRuleConfig
  | FixedRuleConfig
  | CustomRuleConfig

// Rule engine configuration
export type RuleEngineConfig =  RuleConfig[];

/**
 *
 * @param turn 当前回合数
 * @returns
 */
export function extendMemory(turn: number, config: RuleEngineConfig): string {
    return config.map(rule => {
        if (!rule.turns.includes(turn)) return '';

        if (rule.type === 'random') {
            return rule.randomList[Math.floor(Math.random() * rule.randomList.length)];
        }
        if (rule.type === 'fixed') {
            return rule.value;
        }
        if (rule.type === 'custom') {
            return rule.customFunction({ turn: [turn] });
        }
    }).join('\t');
}
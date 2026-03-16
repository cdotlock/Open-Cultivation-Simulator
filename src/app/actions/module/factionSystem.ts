import "server-only";

import { z } from "zod";
import { Prisma } from "@/app/actions/generated/prisma";
import type {
  Character,
  CharacterFactionState,
  Faction,
  FactionMission,
  MapNode,
  World,
  WorldEvent,
} from "@/app/actions/generated/prisma";
import { prisma } from "@/lib/prisma";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { stableGenerateObject } from "@/utils/stableGenerateObject";
import type {
  FactionClueView,
  FactionMissionBriefView,
  CharacterFactionStateView,
  FactionMissionView,
  FactionNodeView,
  FactionPalette,
  FactionPlayerLensView,
  FactionRelationView,
  FactionSignalView,
  FactionUiPayload,
  FactionView,
  FactionWorldSummary,
  WorldEventView,
} from "@/interfaces/faction";
import type { GameOptionType, StoryPushType } from "@/interfaces/schemas";

const WORLD_TURN_INTERVAL = 3;
const SEASONS = ["春分", "长夏", "白露", "玄冬"] as const;
const TIME_PHASES = ["拂晓", "日中", "黄昏", "子夜"] as const;
const FACTION_INTENT_TYPES = ["扩张", "清剿", "结盟", "经营", "休养", "培养弟子", "宣战", "争夺资源点", "追杀仇敌"] as const;
type FactionDbClient = typeof prisma | Prisma.TransactionClient;
type FactionPowerLike = {
  strengthMilitary: number;
  strengthEconomy: number;
  strengthEspionage: number;
  strengthHeritage: number;
  stability: number;
  reputation: number;
};
type FactionPlanSnapshot = {
  summary: string;
  stance?: string;
  riskPreference?: string;
  priorities?: string[];
  publicClaim?: string;
  rationale?: string;
  usedPrompt?: boolean;
};
type IncludedMissionRecord = FactionMission & {
  targetNode?: MapNode | null;
};
type IncludedNodeRecord = MapNode & {
  capitalOfFaction?: Faction | null;
};
type IncludedCharacterFactionState = CharacterFactionState & {
  faction: Faction;
  currentNode: MapNode | null;
  activeMission: IncludedMissionRecord | null;
};
type IncludedCharacterRecord = Character & {
  world: World | null;
  factionState: IncludedCharacterFactionState | null;
};
type SimulatedFaction = Omit<
  Faction,
  "controlledNodeIds" | "currentPlan" | "recentObservations" | "importantMemories" | "strategicReflections"
> & {
  controlledNodeIds: number[];
  currentPlan: FactionPlanSnapshot | string | null;
  recentObservations: string[];
  importantMemories: string[];
  strategicReflections: string[];
};
type SimulatedNode = Omit<MapNode, "neighborNodeIds" | "resourceTags"> & {
  neighborNodeIds: number[];
  resourceTags: string[];
};

type DraftNode = {
  key: string;
  name: string;
  type: string;
  terrain: string;
  positionX: number;
  positionY: number;
  resourceTags: string[];
  neighborKeys: string[];
  prosperity: number;
  danger: number;
  ownerFactionKey?: string;
};

type DraftFaction = {
  key: string;
  name: string;
  title: string;
  type: string;
  elementAffinity: string;
  doctrine: string;
  styleTags: string[];
  leaderName: string;
  leaderArchetype: string;
  strengthMilitary: number;
  strengthEconomy: number;
  strengthEspionage: number;
  strengthHeritage: number;
  stability: number;
  reputation: number;
  aggression: number;
  expansionDesire: number;
  capitalNodeKey: string;
  controlledNodeKeys: string[];
  goal: string;
  currentPlan: string;
  recentObservations: string[];
  importantMemories: string[];
  strategicReflections: string[];
  playerFacingSummary: string;
};

type DraftRelation = {
  fromFactionKey: string;
  toFactionKey: string;
  relationType: string;
  relationScore: number;
  lastReason?: string;
};

type DraftMission = {
  title: string;
  category: string;
  description: string;
  status: string;
  progress: number;
  goal: number;
  rewardContribution: number;
  rewardTrust: number;
  rewardMilitaryCredit: number;
  rewardPoliticalStanding: number;
  targetNodeKey?: string;
  targetNodeId?: number;
};

const RESOURCE_TAG_VALUES: Record<string, number> = {
  灵脉: 24,
  矿脉: 19,
  商路: 18,
  药田: 18,
  丹火: 16,
  灵盐: 15,
  灵泉: 15,
  异宝: 18,
  玄砂: 17,
  灵木: 14,
  祖库: 16,
  阵盘: 14,
  军寨: 13,
  战备: 13,
  消息: 12,
  剑冢: 11,
  悟道: 11,
  寒晶: 10,
  水道: 10,
  瘴气: 8,
};
const GENERIC_CHARACTER_TOKENS = new Set([
  "",
  "你",
  "自己",
  "本人",
  "路人",
  "旁人",
  "众人",
  "人群",
  "行人",
  "修士们",
  "弟子们",
]);
const CHARACTER_ABSENCE_PATTERNS = [
  "无人",
  "空无一人",
  "四下无人",
  "不见人影",
  "没有旁人",
];
const CHARACTER_ROLE_PATTERN =
  /(长老|执事|弟子|师兄|师姐|师叔|师伯|掌门|宗主|门主|护法|供奉|客卿|真人|散修|守卫|守将|探子|使者|掌柜|商旅|药师|矿奴|城主|家主|首座|阁主|坛主|堂主|族老|前辈|老者|少女|少年|妇人|汉子)/;
const MOVEMENT_HINTS = ["前往", "赶往", "抵达", "来到", "潜入", "踏入", "行至", "奔赴", "折返", "回到", "深入", "转往"];

export type PreparedFactionWorldDraft = {
  seed: string;
  worldName: string;
  season: string;
  timePhase: string;
  summary: string;
  factions: DraftFaction[];
  nodes: DraftNode[];
  relations: DraftRelation[];
  playerFactionKey: string;
  playerRank: string;
  playerRole: string;
  playerExpectation: string;
  playerNodeKey: string;
  initialMission: DraftMission;
};

type PersistedFactionWorld = {
  worldId: number;
  nodeIdByKey: Record<string, number>;
  factionIdByKey: Record<string, number>;
};

type FactionIntent = {
  type: (typeof FACTION_INTENT_TYPES)[number];
  summary: string;
  targetNodeId?: number;
  targetFactionId?: number;
};

type IntentCandidate = FactionIntent & {
  score: number;
  rationale: string;
  targetNodeName?: string;
  targetFactionName?: string;
};

type FactionReflection = z.infer<typeof factionReflectionSchema>;
type FactionPlanning = z.infer<typeof factionPlanningSchema>;
type FactionPromptConfig = Awaited<ReturnType<typeof ConfigService.getConfig>>;
type FactionModelConfig = NonNullable<FactionPromptConfig["model"]>;
type FactionPromptBundle = {
  reflection?: FactionPromptConfig;
  planning?: FactionPromptConfig;
};
type FactionTurnDecision = {
  intent: FactionIntent;
  candidates: IntentCandidate[];
  reflection?: FactionReflection;
  planning?: FactionPlanning;
  usedPrompt: boolean;
};

const factionReflectionSchema = z.object({
  局势总评: z.string().min(16).max(220),
  核心压力: z.string().min(4).max(60),
  建议姿态: z.enum(FACTION_INTENT_TYPES),
  风险偏好: z.enum(["保守", "均衡", "进取"]),
  优先目标: z.array(z.string()).max(3),
  对外口径: z.string().min(10).max(120),
});

const factionPlanningSchema = z.object({
  行动类型: z.enum(FACTION_INTENT_TYPES),
  行动摘要: z.string().min(10).max(120),
  行动理由: z.string().min(10).max(160),
  目标势力: z.string().max(30).optional(),
  目标节点: z.string().max(30).optional(),
  对外宣示: z.string().min(8).max(120).optional(),
});

const MAP_NODE_TEMPLATES: Array<Omit<DraftNode, "ownerFactionKey">> = [
  {
    key: "taihua_peak",
    name: "太华剑坪",
    type: "山门",
    terrain: "峻岭",
    positionX: 18,
    positionY: 24,
    resourceTags: ["灵脉", "剑冢"],
    neighborKeys: ["yunhe_market", "qixing_pass", "jade_basin"],
    prosperity: 55,
    danger: 32,
  },
  {
    key: "danxia_valley",
    name: "丹霞药谷",
    type: "山门",
    terrain: "丹霞谷地",
    positionX: 42,
    positionY: 18,
    resourceTags: ["药田", "丹火"],
    neighborKeys: ["taihua_peak", "yunhe_market", "misty_marsh", "jade_basin"],
    prosperity: 72,
    danger: 24,
  },
  {
    key: "tingchao_port",
    name: "听潮津",
    type: "渡口",
    terrain: "江海潮汐",
    positionX: 74,
    positionY: 24,
    resourceTags: ["商路", "灵盐"],
    neighborKeys: ["yunhe_market", "frost_ferry", "misty_marsh"],
    prosperity: 78,
    danger: 20,
  },
  {
    key: "jiuyue_hall",
    name: "九岳祖祠",
    type: "山门",
    terrain: "古岳台地",
    positionX: 24,
    positionY: 48,
    resourceTags: ["祖库", "矿脉"],
    neighborKeys: ["taihua_peak", "jade_basin", "qixing_pass", "emerald_forest"],
    prosperity: 63,
    danger: 27,
  },
  {
    key: "qixing_pass",
    name: "七星隘",
    type: "要塞",
    terrain: "崖关",
    positionX: 48,
    positionY: 42,
    resourceTags: ["军寨", "阵盘"],
    neighborKeys: ["yunhe_market", "danxia_valley", "jiuyue_hall", "frost_ferry", "emerald_forest"],
    prosperity: 48,
    danger: 44,
  },
  {
    key: "frost_ferry",
    name: "寒汐渡",
    type: "渡口",
    terrain: "寒江",
    positionX: 78,
    positionY: 46,
    resourceTags: ["水道", "寒晶"],
    neighborKeys: ["tingchao_port", "qixing_pass", "misty_marsh", "blackreef_fort"],
    prosperity: 58,
    danger: 35,
  },
  {
    key: "yunhe_market",
    name: "云河坊",
    type: "坊市",
    terrain: "平川",
    positionX: 56,
    positionY: 30,
    resourceTags: ["商路", "消息"],
    neighborKeys: ["taihua_peak", "danxia_valley", "tingchao_port", "qixing_pass", "misty_marsh"],
    prosperity: 84,
    danger: 18,
  },
  {
    key: "jade_basin",
    name: "明镜灵潭",
    type: "秘境",
    terrain: "湖泽",
    positionX: 34,
    positionY: 34,
    resourceTags: ["灵泉", "悟道"],
    neighborKeys: ["taihua_peak", "danxia_valley", "jiuyue_hall", "emerald_forest"],
    prosperity: 50,
    danger: 38,
  },
  {
    key: "misty_marsh",
    name: "雾汀沼",
    type: "秘境",
    terrain: "雾沼",
    positionX: 66,
    positionY: 54,
    resourceTags: ["瘴气", "异宝"],
    neighborKeys: ["danxia_valley", "tingchao_port", "frost_ferry", "yunhe_market", "blackreef_fort"],
    prosperity: 44,
    danger: 60,
  },
  {
    key: "emerald_forest",
    name: "幽篁林",
    type: "矿区",
    terrain: "林泽",
    positionX: 30,
    positionY: 68,
    resourceTags: ["灵木", "矿脉"],
    neighborKeys: ["jiuyue_hall", "qixing_pass", "jade_basin", "blackreef_fort"],
    prosperity: 47,
    danger: 30,
  },
  {
    key: "blackreef_fort",
    name: "玄砂堡",
    type: "要塞",
    terrain: "黑礁荒原",
    positionX: 68,
    positionY: 74,
    resourceTags: ["玄砂", "战备"],
    neighborKeys: ["frost_ferry", "misty_marsh", "emerald_forest", "ghost_shrine"],
    prosperity: 40,
    danger: 52,
  },
  {
    key: "ghost_shrine",
    name: "暝河祭坛",
    type: "秘境",
    terrain: "幽河",
    positionX: 50,
    positionY: 84,
    resourceTags: ["幽魂", "秘术"],
    neighborKeys: ["blackreef_fort", "emerald_forest"],
    prosperity: 28,
    danger: 76,
  },
];

const FACTION_PROTOTYPES = [
  {
    key: "taihua",
    name: "太华剑宗",
    title: "剑压群峦",
    type: "宗门",
    elementAffinity: "金",
    doctrine: "斩妄证心，以剑止乱",
    styleTags: ["剑修", "霜金", "孤峰"],
    leaders: ["沈孤城", "陆听白", "姬衡山"],
    archetypes: ["冷峻掌教", "诛邪剑首", "守岳长老"],
    base: { military: 82, economy: 48, espionage: 40, heritage: 76, stability: 68, reputation: 82, aggression: 61, expansion: 58 },
    goal: "稳住北境剑脉，将七星隘纳入宗门剑阵。",
  },
  {
    key: "danxia",
    name: "丹霞谷",
    title: "百炉生春",
    type: "宗门",
    elementAffinity: "火",
    doctrine: "以丹养道，以火济世",
    styleTags: ["丹修", "暖焰", "药谷"],
    leaders: ["祝红绡", "许丹辰", "韩砚秋"],
    archetypes: ["温和谷主", "炼丹宗师", "藏锋供奉"],
    base: { military: 54, economy: 72, espionage: 46, heritage: 84, stability: 73, reputation: 79, aggression: 38, expansion: 42 },
    goal: "扩张药谷药圃，守住丹火灵脉与坊市药路。",
  },
  {
    key: "tingchao",
    name: "听潮商盟",
    title: "万舶同归",
    type: "商盟",
    elementAffinity: "水",
    doctrine: "财路即命脉，商誓即军令",
    styleTags: ["商路", "海潮", "金契"],
    leaders: ["温栖澜", "何千帆", "柳潮生"],
    archetypes: ["笑面盟主", "铁算盘", "潮汐舵主"],
    base: { military: 46, economy: 88, espionage: 66, heritage: 44, stability: 62, reputation: 71, aggression: 32, expansion: 47 },
    goal: "打通听潮津与云河坊的商路，把寒汐渡变成自家命门。",
  },
  {
    key: "jiuyue",
    name: "九岳世家",
    title: "古印镇川",
    type: "世家",
    elementAffinity: "土",
    doctrine: "血脉与祖训同重，山河由我守望",
    styleTags: ["祖地", "厚土", "门阀"],
    leaders: ["岳承安", "岳青霜", "岳闻钟"],
    archetypes: ["守成家主", "铁腕宗老", "温润少主"],
    base: { military: 64, economy: 61, espionage: 42, heritage: 79, stability: 77, reputation: 69, aggression: 44, expansion: 45 },
    goal: "守住祖祠旧地，重整九岳边军与灵矿税道。",
  },
  {
    key: "xuanjia",
    name: "玄甲盟",
    title: "铁骑护城",
    type: "帮会",
    elementAffinity: "木",
    doctrine: "先立阵脚，再谈天下",
    styleTags: ["体修", "军旅", "铁旗"],
    leaders: ["杜长锋", "石问岚", "陈归野"],
    archetypes: ["沙场都统", "悍勇盟主", "沉稳将军"],
    base: { military: 75, economy: 52, espionage: 39, heritage: 51, stability: 58, reputation: 63, aggression: 57, expansion: 63 },
    goal: "夺回玄砂堡外围据点，让盟中补给不再受制于人。",
  },
  {
    key: "minghe",
    name: "暝河教",
    title: "夜雨沉灯",
    type: "魔门",
    elementAffinity: "水",
    doctrine: "借人心裂隙，养幽河阴火",
    styleTags: ["秘术", "幽河", "夜祭"],
    leaders: ["晏无咎", "迟夜雨", "曲沉渊"],
    archetypes: ["诡谲教主", "妖艳祭司", "冷血执火人"],
    base: { military: 69, economy: 44, espionage: 82, heritage: 62, stability: 41, reputation: 22, aggression: 79, expansion: 71 },
    goal: "掌控暝河祭坛与雾汀沼，把幽河密探铺进整个中州。",
  },
];

const SPIRIT_ROOT_TO_ELEMENT: Record<string, string> = {
  金灵根: "金",
  木灵根: "木",
  水灵根: "水",
  火灵根: "火",
  土灵根: "土",
};

const RANK_POOL = ["外门执事", "真传弟子", "亲传弟子", "巡山执令", "内库行走"];
const ROLE_POOL = ["前锋历练者", "情报联络人", "护道随行者", "宗门新秀", "外务使者"];
const EXPECTATION_POOL = [
  "替宗门在外立威，把功劳带回山门。",
  "在风波里稳住局势，别让本帮在你手上丢脸。",
  "看清局势后再出手，但该争的利益一寸都不能让。",
  "多结善缘，也别忘了给自家势力挣来筹码。",
];

function hashSeed(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashSeed(seed) || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function pick<T>(items: T[], random: () => number) {
  return items[Math.floor(random() * items.length)];
}

function shuffle<T>(items: T[], random: () => number) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function powerScore(faction: FactionPowerLike) {
  return Math.round(
    faction.strengthMilitary * 0.34 +
      faction.strengthEconomy * 0.2 +
      faction.strengthEspionage * 0.12 +
      faction.strengthHeritage * 0.16 +
      faction.stability * 0.1 +
      faction.reputation * 0.08
  );
}

function getFactionPalette(elementAffinity: string, factionType: string): FactionPalette {
  const palettes: Record<string, FactionPalette> = {
    金: { primary: "#A88A4A", accent: "#F2E2B3", glow: "rgba(214, 182, 104, 0.35)" },
    木: { primary: "#567A5B", accent: "#CFE2B7", glow: "rgba(120, 176, 115, 0.30)" },
    水: { primary: "#3F6F8E", accent: "#BFD8E8", glow: "rgba(108, 165, 212, 0.30)" },
    火: { primary: "#9C5437", accent: "#F0C1A5", glow: "rgba(217, 118, 68, 0.32)" },
    土: { primary: "#7C6947", accent: "#E5D2A2", glow: "rgba(195, 155, 87, 0.28)" },
  };

  if (factionType === "魔门") {
    return { primary: "#4A3846", accent: "#D6C4D4", glow: "rgba(140, 108, 142, 0.32)" };
  }

  return palettes[elementAffinity] || palettes.土;
}

function relationTypeFromScore(score: number) {
  if (score >= 55) {
    return "alliance";
  }
  if (score <= -65) {
    return "bloodFeud";
  }
  if (score <= -18) {
    return "hostile";
  }
  return "neutral";
}

function readStringArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [];
}

function readNumberArray(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => Number(item)).filter((item) => Number.isFinite(item));
  }
  return [];
}

function normalizePlanState(currentPlan: Faction["currentPlan"]): FactionPlanSnapshot | string | null {
  if (typeof currentPlan === "string") {
    return currentPlan;
  }

  if (currentPlan && typeof currentPlan === "object" && "summary" in currentPlan) {
    const rawPlan = currentPlan as Record<string, unknown>;
    const summary = rawPlan.summary;
    if (typeof summary === "string" && summary.trim()) {
      return {
        summary,
        stance: typeof rawPlan.stance === "string" ? rawPlan.stance : undefined,
        riskPreference: typeof rawPlan.riskPreference === "string" ? rawPlan.riskPreference : undefined,
        priorities: Array.isArray(rawPlan.priorities) ? rawPlan.priorities.map((item) => String(item)) : undefined,
        publicClaim: typeof rawPlan.publicClaim === "string" ? rawPlan.publicClaim : undefined,
        rationale: typeof rawPlan.rationale === "string" ? rawPlan.rationale : undefined,
        usedPrompt: typeof rawPlan.usedPrompt === "boolean" ? rawPlan.usedPrompt : undefined,
      };
    }
  }

  return null;
}

function readPlanSummary(currentPlan: Faction["currentPlan"] | SimulatedFaction["currentPlan"]) {
  const normalizedPlan =
    typeof currentPlan === "string" || currentPlan === null
      ? currentPlan
      : normalizePlanState(currentPlan as Faction["currentPlan"]);

  if (typeof normalizedPlan === "string") {
    return normalizedPlan;
  }

  if (normalizedPlan?.summary) {
    return normalizedPlan.summary;
  }

  return undefined;
}

function pushBounded<T>(items: T[], next: T, limit: number) {
  return [next, ...items].slice(0, limit);
}

function buildFactionSummary(faction: DraftFaction) {
  return `${faction.name}以“${faction.doctrine}”为圭臬，现由${faction.leaderName}主持门墙。门中眼下主张：${faction.goal}`;
}

function compatibilityScore(left: DraftFaction, right: DraftFaction) {
  let score = 0;

  if (left.type === right.type) {
    score += 10;
  }

  if (left.type === "魔门" || right.type === "魔门") {
    score -= 28;
  }

  if (left.type === "商盟" || right.type === "商盟") {
    score += 8;
  }

  if (left.elementAffinity === right.elementAffinity) {
    score += 6;
  }

  return score;
}

function choosePlayerFaction(factions: DraftFaction[], spiritRoot?: string) {
  const sorted = [...factions].sort((left, right) => powerScore(right) - powerScore(left));
  const candidates = sorted.slice(1, sorted.length - 1);
  const preferredElement = spiritRoot ? SPIRIT_ROOT_TO_ELEMENT[spiritRoot] : undefined;
  if (preferredElement) {
    const match = candidates.find((item) => item.elementAffinity === preferredElement);
    if (match) {
      return match;
    }
  }
  return candidates[Math.floor(candidates.length / 2)] || sorted[0];
}

function assignControlledNodes(factions: DraftFaction[], nodes: DraftNode[]) {
  const nodeMap = new Map(nodes.map((node) => [node.key, node]));
  const powerSorted = [...factions].sort((left, right) => powerScore(right) - powerScore(left));
  const extrasPerFaction = new Map<string, number>([
    [powerSorted[0].key, 2],
    [powerSorted[1].key, 1],
    [powerSorted[2].key, 1],
    [powerSorted[3].key, 1],
    [powerSorted[4].key, 1],
    [powerSorted[5].key, 0],
  ]);

  const usedNodeKeys = new Set<string>();

  for (const faction of factions) {
    faction.controlledNodeKeys = [faction.capitalNodeKey];
    const capital = nodeMap.get(faction.capitalNodeKey);
    if (!capital) {
      continue;
    }
    capital.ownerFactionKey = faction.key;
    usedNodeKeys.add(capital.key);
  }

  for (const faction of powerSorted) {
    const extraCount = extrasPerFaction.get(faction.key) || 0;
    const capital = nodeMap.get(faction.capitalNodeKey);
    if (!capital) {
      continue;
    }

    const neighborChoices = capital.neighborKeys
      .map((key) => nodeMap.get(key))
      .filter((node): node is DraftNode => node !== undefined)
      .filter((node) => !usedNodeKeys.has(node.key));

    for (const node of neighborChoices.slice(0, extraCount)) {
      node.ownerFactionKey = faction.key;
      faction.controlledNodeKeys.push(node.key);
      usedNodeKeys.add(node.key);
    }
  }

  const remaining = nodes.filter((node) => !usedNodeKeys.has(node.key));
  for (const node of remaining) {
    const nearestFaction = factions
      .map((faction) => ({
        key: faction.key,
        distance: faction.controlledNodeKeys.some((controlledKey) => node.neighborKeys.includes(controlledKey))
          ? 0
          : 1,
      }))
      .sort((left, right) => left.distance - right.distance)[0];

    const owner = factions.find((item) => item.key === nearestFaction?.key) || powerSorted[0];
    node.ownerFactionKey = owner.key;
    owner.controlledNodeKeys.push(node.key);
    usedNodeKeys.add(node.key);
  }
}

function nodeResourceValue(node: { resourceTags: string[]; prosperity: number }) {
  const tagValue = node.resourceTags.reduce((sum, tag) => sum + (RESOURCE_TAG_VALUES[tag] || 6), 0);
  return tagValue + Math.round(node.prosperity * 0.18);
}

function resourceLineLabel(node: { resourceTags: string[]; terrain: string }) {
  return node.resourceTags[0] || node.terrain;
}

function sortBorderTargets<T extends { prosperity: number; danger: number; resourceTags: string[] }>(nodes: T[]) {
  return [...nodes].sort(
    (left, right) =>
      right.prosperity + nodeResourceValue(right) - right.danger * 0.55 - (left.prosperity + nodeResourceValue(left) - left.danger * 0.55),
  );
}

function createMissionDraft(
  faction: DraftFaction,
  nodes: DraftNode[],
  relations: DraftRelation[],
  currentNodeKey: string,
  turn: number,
) {
  const hostileRelation = relations
    .filter((item) => item.fromFactionKey === faction.key && item.relationScore <= -18)
    .sort((left, right) => left.relationScore - right.relationScore)[0];
  const bloodFeud = relations
    .filter((item) => item.fromFactionKey === faction.key && item.relationScore <= -52)
    .sort((left, right) => left.relationScore - right.relationScore)[0];

  const borderTargets = sortBorderTargets(
    nodes.filter(
      (node) =>
        node.ownerFactionKey !== faction.key &&
        node.neighborKeys.some((neighborKey) => faction.controlledNodeKeys.includes(neighborKey)),
    ),
  );
  const borderTarget = borderTargets[0];
  const resourceTarget = [...borderTargets]
    .sort((left, right) => nodeResourceValue(right) - nodeResourceValue(left))
    .find((node) => nodeResourceValue(node) >= 34);

  if (resourceTarget && faction.strengthEconomy < 62) {
    return {
      title: `踩清${resourceTarget.name}财路`,
      category: "资源争夺",
      description: `${faction.name}盯上了${resourceTarget.name}的${resourceLineLabel(resourceTarget)}，你需要先摸清供给、人手与下手的缺口。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 13,
      rewardTrust: 4,
      rewardMilitaryCredit: 2,
      rewardPoliticalStanding: 2,
      targetNodeKey: resourceTarget.key,
    } satisfies DraftMission;
  }

  if (bloodFeud && turn > 0) {
    return {
      title: "寻出宿怨暗线",
      category: "复仇",
      description: `${faction.name}与旧敌积怨已深，你需要替门中查清对方外线破绽，为追索宿怨铺好第一刀。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 12,
      rewardTrust: 4,
      rewardMilitaryCredit: 2,
      rewardPoliticalStanding: 2,
      targetNodeKey: currentNodeKey,
    } satisfies DraftMission;
  }

  if (borderTarget && hostileRelation) {
    return {
      title: `摸清${borderTarget.name}缺口`,
      category: "扩张",
      description: `帮中判断边境将起风波，你需以战斗或探查手段为${faction.name}打开${borderTarget.name}的缺口。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 14,
      rewardTrust: 4,
      rewardMilitaryCredit: 3,
      rewardPoliticalStanding: 1,
      targetNodeKey: borderTarget.key,
    } satisfies DraftMission;
  }

  if (faction.stability < 55) {
    return {
      title: "安抚门中暗流",
      category: "内政",
      description: `近来${faction.name}内部人心浮动，你需要通过交流与探索稳住门中风声，替帮里收拾隐患。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 12,
      rewardTrust: 5,
      rewardMilitaryCredit: 1,
      rewardPoliticalStanding: 2,
    } satisfies DraftMission;
  }

  if (turn > 0 && hostileRelation) {
    return {
      title: "试探敌对势力",
      category: "外交",
      description: `局势尚未彻底撕破脸，你需要替${faction.name}探明敌对势力底细，为后续谋划争取主动。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 10,
      rewardTrust: 3,
      rewardMilitaryCredit: 1,
      rewardPoliticalStanding: 3,
      targetNodeKey: currentNodeKey,
    } satisfies DraftMission;
  }

  return {
    title: "搜罗本帮机缘",
    category: "修行",
    description: `${faction.name}希望你在外积累机缘与见闻，借此壮大本帮声势，也为下一轮风波做准备。`,
    status: "ACTIVE",
    progress: 0,
    goal: 2,
    rewardContribution: 11,
    rewardTrust: 3,
    rewardMilitaryCredit: 2,
    rewardPoliticalStanding: 1,
    targetNodeKey: currentNodeKey,
  } satisfies DraftMission;
}

function buildWorldSummary(factions: DraftFaction[], relations: DraftRelation[]) {
  const factionNameByKey = new Map(factions.map((item) => [item.key, item.name]));
  const ranking = [...factions]
    .sort((left, right) => powerScore(right) - powerScore(left))
    .slice(0, 3)
    .map((item) => item.name);

  const flashpoint = relations
    .filter((item) => item.relationScore <= -18)
    .sort((left, right) => left.relationScore - right.relationScore)[0];

  if (flashpoint) {
    return `天下势力榜当前以${ranking.join("、")}最盛。眼下最显著的火药味，来自${factionNameByKey.get(flashpoint.fromFactionKey) || flashpoint.fromFactionKey}与${factionNameByKey.get(flashpoint.toFactionKey) || flashpoint.toFactionKey}一线。`;
  }

  return `天下势力榜当前以${ranking.join("、")}最盛，各家都在收敛锋芒、暗蓄后手。`;
}

function normalizeWorldSummary(summary: string) {
  let normalized = summary;

  for (const prototype of FACTION_PROTOTYPES) {
    normalized = normalized.replace(new RegExp(prototype.key, "g"), prototype.name);
  }

  return normalized;
}

export function prepareFactionWorldDraft(input: { name: string; userInput: string; spiritRoot?: string }) {
  const seed = `${input.name}:${input.spiritRoot || "无"}:${input.userInput}`;
  const random = createSeededRandom(seed);
  const season = SEASONS[Math.floor(random() * SEASONS.length)];
  const timePhase = TIME_PHASES[Math.floor(random() * TIME_PHASES.length)];
  const nodes = MAP_NODE_TEMPLATES.map((node) => ({ ...node, neighborKeys: [...node.neighborKeys] }));
  const factions = shuffle(FACTION_PROTOTYPES, random).map((template, index) => {
    const leaderName = pick(template.leaders, random);
    const leaderArchetype = pick(template.archetypes, random);
    const currentPlan = index % 2 === 0 ? "稳住边线，静观其他宗门先出手。" : "小步扩张，先把资源点握牢。";
    const faction: DraftFaction = {
      key: template.key,
      name: template.name,
      title: template.title,
      type: template.type,
      elementAffinity: template.elementAffinity,
      doctrine: template.doctrine,
      styleTags: template.styleTags,
      leaderName,
      leaderArchetype,
      strengthMilitary: clamp(template.base.military + Math.floor(random() * 9) - 4, 35, 95),
      strengthEconomy: clamp(template.base.economy + Math.floor(random() * 9) - 4, 35, 95),
      strengthEspionage: clamp(template.base.espionage + Math.floor(random() * 9) - 4, 30, 95),
      strengthHeritage: clamp(template.base.heritage + Math.floor(random() * 9) - 4, 30, 95),
      stability: clamp(template.base.stability + Math.floor(random() * 7) - 3, 30, 90),
      reputation: clamp(template.base.reputation + Math.floor(random() * 9) - 4, 10, 90),
      aggression: clamp(template.base.aggression + Math.floor(random() * 9) - 4, 20, 90),
      expansionDesire: clamp(template.base.expansion + Math.floor(random() * 9) - 4, 20, 90),
      capitalNodeKey: nodes[index].key,
      controlledNodeKeys: [],
      goal: template.goal,
      currentPlan,
      recentObservations: [`${template.name}正在重新梳理边境与门中资源。`],
      importantMemories: [`${template.name}将${nodes[index].name}视作不容有失的命门。`],
      strategicReflections: [currentPlan],
      playerFacingSummary: "",
    };
    faction.playerFacingSummary = buildFactionSummary(faction);
    return faction;
  });

  assignControlledNodes(factions, nodes);

  const relations: DraftRelation[] = [];
  for (const left of factions) {
    for (const right of factions) {
      if (left.key === right.key) {
        continue;
      }
      const rawScore = clamp(
        compatibilityScore(left, right) + Math.floor(random() * 37) - 18,
        -90,
        90,
      );
      relations.push({
        fromFactionKey: left.key,
        toFactionKey: right.key,
        relationType: relationTypeFromScore(rawScore),
        relationScore: rawScore,
        lastReason: rawScore <= -18 ? "旧怨未消，边线暗斗不止。" : "彼此尚在观望，暂未撕破脸。",
      });
    }
  }

  const playerFaction = choosePlayerFaction(factions, input.spiritRoot);
  const playerRank = RANK_POOL[Math.floor(random() * RANK_POOL.length)];
  const playerRole = ROLE_POOL[Math.floor(random() * ROLE_POOL.length)];
  const playerExpectation = EXPECTATION_POOL[Math.floor(random() * EXPECTATION_POOL.length)];
  const playerNodeKey = playerFaction.capitalNodeKey;
  const summary = buildWorldSummary(factions, relations);
  const initialMission = createMissionDraft(playerFaction, nodes, relations, playerNodeKey, 0);

  return {
    seed,
    worldName: "九州风云卷",
    season,
    timePhase,
    summary,
    factions,
    nodes,
    relations,
    playerFactionKey: playerFaction.key,
    playerRank,
    playerRole,
    playerExpectation,
    playerNodeKey,
    initialMission,
  } satisfies PreparedFactionWorldDraft;
}

export function getFactionPromptVariables(draft: PreparedFactionWorldDraft) {
  const playerFaction = draft.factions.find((item) => item.key === draft.playerFactionKey);
  if (!playerFaction) {
    return {
      FACTION_PROFILE: "散修，无固定帮派归属。",
      FACTION_ROLE: "暂未定下帮派身份。",
      FACTION_GOAL: "先在乱世中站稳脚跟。",
    };
  }

  return {
    FACTION_PROFILE: `${playerFaction.name}·${playerFaction.title}。${playerFaction.playerFacingSummary}`,
    FACTION_ROLE: `${draft.playerRank}，职责是${draft.playerRole}。`,
    FACTION_GOAL: `${playerFaction.goal} 帮中对你的期待是：${draft.playerExpectation}`,
  };
}

export async function persistPreparedFactionWorld(db: FactionDbClient, draft: PreparedFactionWorldDraft): Promise<PersistedFactionWorld> {
  const world = await db.world.create({
    data: {
      name: draft.worldName,
      seed: draft.seed,
      worldTurn: 0,
      season: draft.season,
      timePhase: draft.timePhase,
      newsSummary: draft.summary,
      summary: {
        headline: draft.summary,
      },
    },
  });

  const nodeIdByKey: Record<string, number> = {};
  for (const node of draft.nodes) {
    const created = await db.mapNode.create({
      data: {
        worldId: world.id,
        name: node.name,
        type: node.type,
        positionX: node.positionX,
        positionY: node.positionY,
        terrain: node.terrain,
        resourceTags: node.resourceTags,
        neighborNodeIds: [],
        prosperity: node.prosperity,
        danger: node.danger,
      },
    });
    nodeIdByKey[node.key] = created.id;
  }

  const factionIdByKey: Record<string, number> = {};
  for (const faction of draft.factions) {
    const created = await db.faction.create({
      data: {
        worldId: world.id,
        name: faction.name,
        title: faction.title,
        type: faction.type,
        elementAffinity: faction.elementAffinity,
        doctrine: faction.doctrine,
        styleTags: faction.styleTags,
        leaderName: faction.leaderName,
        leaderArchetype: faction.leaderArchetype,
        strengthMilitary: faction.strengthMilitary,
        strengthEconomy: faction.strengthEconomy,
        strengthEspionage: faction.strengthEspionage,
        strengthHeritage: faction.strengthHeritage,
        stability: faction.stability,
        reputation: faction.reputation,
        aggression: faction.aggression,
        expansionDesire: faction.expansionDesire,
        capitalNodeId: nodeIdByKey[faction.capitalNodeKey],
        controlledNodeIds: faction.controlledNodeKeys.map((key) => nodeIdByKey[key]),
        goal: faction.goal,
        currentPlan: { summary: faction.currentPlan },
        recentObservations: faction.recentObservations,
        importantMemories: faction.importantMemories,
        strategicReflections: faction.strategicReflections,
        lastExecutedAction: faction.currentPlan,
        playerFacingSummary: faction.playerFacingSummary,
      },
    });
    factionIdByKey[faction.key] = created.id;
  }

  for (const node of draft.nodes) {
    await db.mapNode.update({
      where: { id: nodeIdByKey[node.key] },
      data: {
        ownerFactionId: node.ownerFactionKey ? factionIdByKey[node.ownerFactionKey] : null,
        neighborNodeIds: node.neighborKeys.map((key) => nodeIdByKey[key]),
      },
    });
  }

  for (const relation of draft.relations) {
    await db.factionRelation.create({
      data: {
        worldId: world.id,
        fromFactionId: factionIdByKey[relation.fromFactionKey],
        toFactionId: factionIdByKey[relation.toFactionKey],
        relationType: relation.relationType,
        relationScore: relation.relationScore,
        lastReason: relation.lastReason,
      },
    });
  }

  return {
    worldId: world.id,
    nodeIdByKey,
    factionIdByKey,
  };
}

export async function createCharacterFactionSetup(
  db: FactionDbClient,
  draft: PreparedFactionWorldDraft,
  persisted: PersistedFactionWorld,
  characterId: number,
) {
  const playerFactionId = persisted.factionIdByKey[draft.playerFactionKey];
  const currentNodeId = persisted.nodeIdByKey[draft.playerNodeKey];

  await db.characterFactionState.create({
    data: {
      characterId,
      factionId: playerFactionId,
      currentNodeId,
      rank: draft.playerRank,
      factionRole: draft.playerRole,
      factionExpectation: draft.playerExpectation,
      trust: 52,
      contribution: 3,
      militaryCredit: 0,
      politicalStanding: 0,
      factionGoalProgress: 14,
    },
  });

  const mission = await db.factionMission.create({
    data: {
      worldId: persisted.worldId,
      factionId: playerFactionId,
      characterId,
      targetNodeId: draft.initialMission.targetNodeKey
        ? persisted.nodeIdByKey[draft.initialMission.targetNodeKey]
        : null,
      title: draft.initialMission.title,
      category: draft.initialMission.category,
      description: draft.initialMission.description,
      status: draft.initialMission.status,
      progress: draft.initialMission.progress,
      goal: draft.initialMission.goal,
      rewardContribution: draft.initialMission.rewardContribution,
      rewardTrust: draft.initialMission.rewardTrust,
      rewardMilitaryCredit: draft.initialMission.rewardMilitaryCredit,
      rewardPoliticalStanding: draft.initialMission.rewardPoliticalStanding,
    },
  });

  await db.characterFactionState.update({
    where: { characterId },
    data: {
      activeMissionId: mission.id,
    },
  });
}

export async function ensureCharacterHasFactionWorld(characterId: number, db: FactionDbClient = prisma) {
  const character = await db.character.findUnique({
    where: { id: characterId },
    include: {
      factionState: true,
    },
  });

  if (!character) {
    return;
  }

  if (character.worldId && character.factionState) {
    return;
  }

  const draft = prepareFactionWorldDraft({
    name: character.name,
    userInput:
      typeof character.description === "object"
        ? JSON.stringify(character.description)
        : character.createPrompt,
    spiritRoot: character.spiritRoot || undefined,
  });
  const persisted = await persistPreparedFactionWorld(db, draft);

  await db.character.update({
    where: { id: characterId },
    data: { worldId: persisted.worldId },
  });

  if (!character.factionState) {
    await createCharacterFactionSetup(db, draft, persisted, characterId);
  }
}

function buildRelationKey(fromFactionId: number, toFactionId: number) {
  return `${fromFactionId}:${toFactionId}`;
}

function missionToView(mission: IncludedMissionRecord): FactionMissionView {
  return {
    id: mission.id,
    title: mission.title,
    category: mission.category,
    description: mission.description,
    status: mission.status,
    progress: mission.progress,
    goal: mission.goal,
    rewardContribution: mission.rewardContribution,
    rewardTrust: mission.rewardTrust,
    rewardMilitaryCredit: mission.rewardMilitaryCredit,
    rewardPoliticalStanding: mission.rewardPoliticalStanding,
    targetNodeId: mission.targetNodeId || undefined,
    targetNodeName: mission.targetNode?.name || undefined,
  };
}

function factionToView(faction: Faction): FactionView {
  return {
    id: faction.id,
    name: faction.name,
    title: faction.title,
    type: faction.type,
    elementAffinity: faction.elementAffinity,
    doctrine: faction.doctrine,
    styleTags: readStringArray(faction.styleTags),
    leaderName: faction.leaderName,
    leaderArchetype: faction.leaderArchetype,
    strengthMilitary: faction.strengthMilitary,
    strengthEconomy: faction.strengthEconomy,
    strengthEspionage: faction.strengthEspionage,
    strengthHeritage: faction.strengthHeritage,
    stability: faction.stability,
    reputation: faction.reputation,
    aggression: faction.aggression,
    expansionDesire: faction.expansionDesire,
    goal: faction.goal,
    capitalNodeId: faction.capitalNodeId || undefined,
    controlledNodeIds: readNumberArray(faction.controlledNodeIds),
    playerFacingSummary: faction.playerFacingSummary || undefined,
    currentPlan: readPlanSummary(faction.currentPlan),
    powerScore: powerScore(faction),
    palette: getFactionPalette(faction.elementAffinity, faction.type),
  };
}

function nodeToView(node: IncludedNodeRecord, factionsById: Map<number, FactionView>): FactionNodeView {
  const owner = node.ownerFactionId ? factionsById.get(node.ownerFactionId) : undefined;
  return {
    id: node.id,
    name: node.name,
    type: node.type,
    terrain: node.terrain,
    positionX: node.positionX,
    positionY: node.positionY,
    prosperity: node.prosperity,
    danger: node.danger,
    resourceTags: readStringArray(node.resourceTags),
    neighborNodeIds: readNumberArray(node.neighborNodeIds),
    ownerFactionId: node.ownerFactionId || undefined,
    ownerFactionName: owner?.name,
    ownerFactionPalette: owner?.palette,
    isCapital: Boolean(node.capitalOfFaction),
  };
}

function buildWorldPayload(
  world: World,
  playerFaction: FactionView,
  playerState: CharacterFactionStateView,
  factions: FactionView[],
  mapNodes: FactionNodeView[],
  relations: FactionRelationView[],
  recentEvents: WorldEventView[],
  activeMission?: FactionMissionView,
): FactionUiPayload {
  return {
    world: {
      id: world.id,
      name: world.name,
      seed: world.seed,
      worldTurn: world.worldTurn,
      season: world.season,
      timePhase: world.timePhase,
      newsSummary: world.newsSummary || "天下局势暂时平稳。",
    } satisfies FactionWorldSummary,
    playerFaction,
    playerState,
    factions: [...factions].sort((left, right) => right.powerScore - left.powerScore),
    mapNodes,
    relations,
    recentEvents,
    activeMission,
    missionBrief: undefined,
    playerLens: {
      currentTheater: "行踪尚未坐实。",
      currentClimate: "门中风向仍在酝酿。",
      pressure: "暂无足以压顶的外部杀机。",
      opportunity: "机会还埋在暗处。",
      nextPulse: "下一股风声还没有落到你手边。",
    },
    factionSignals: [],
    intelRumors: [],
  };
}

function deriveFactionRank(playerState: Pick<CharacterFactionStateView, "contribution" | "trust" | "militaryCredit" | "politicalStanding">) {
  const score =
    playerState.contribution +
    playerState.trust * 2 +
    playerState.militaryCredit * 3 +
    playerState.politicalStanding * 3;

  if (score >= 50) {
    return "真传执令";
  }

  if (score >= 34) {
    return "真传候补";
  }

  if (score >= 20) {
    return "内门骨干";
  }

  if (score >= 10) {
    return "执事弟子";
  }

  return "外门弟子";
}

function deriveGoalProgress(payload: FactionUiPayload) {
  const rankingIndex = payload.factions.findIndex((item) => item.id === payload.playerFaction.id);
  const base = rankingIndex >= 0 ? 55 - rankingIndex * 9 : 32;
  return Math.round(clamp(base + payload.playerState.contribution * 2 + payload.playerState.trust / 3, 0, 100));
}

function nodeRiskBand(node?: FactionNodeView) {
  if (!node) {
    return "地界未明";
  }
  if (node.danger >= 65) {
    return "杀机翻浪";
  }
  if (node.danger >= 44) {
    return "暗潮起伏";
  }
  if (node.danger >= 28) {
    return "边线绷紧";
  }
  return "尚算稳当";
}

function nodeProsperityBand(node?: FactionNodeView) {
  if (!node) {
    return "路数未显";
  }
  if (node.prosperity >= 72) {
    return "财路通畅";
  }
  if (node.prosperity >= 54) {
    return "来路尚稳";
  }
  if (node.prosperity >= 38) {
    return "只够周转";
  }
  return "地气稀薄";
}

function missionProgressHint(mission?: FactionMissionView) {
  if (!mission) {
    return "帮中暂未放出新密令。";
  }

  const ratio = mission.goal > 0 ? mission.progress / mission.goal : 0;
  if (ratio <= 0) {
    return "线头刚刚攥在手里，还没真正落子。";
  }
  if (ratio < 0.5) {
    return "已经摸到一点脉络，但关键口子还没撬开。";
  }
  if (ratio < 1) {
    return "局面已有眉目，只差临门一脚。";
  }
  return "这条线已经收束，门中会很快另起一局。";
}

function missionSuggestedApproach(category: string) {
  const mapping: Record<string, string> = {
    扩张: "宜先探路，再挑守备松动处下手。",
    外交: "先试口风，再借人情与承诺换位。",
    内政: "先稳住门内气氛，别让风声先乱了阵脚。",
    修行: "把历练当筹码，既为自己也为帮中留后手。",
    资源争夺: "先掐商路和仓储，再看守备轮换，别在明面上先亮底牌。",
    复仇: "别急着硬碰，先找对方真正的软肋。",
  };
  return mapping[category] || "先看风向，再挑一处最可借势的落点。";
}

function missionUrgency(payload: FactionUiPayload, mission?: FactionMissionView) {
  if (!mission) {
    return "帮中暂且按兵不动。";
  }

  const hostilePressure = payload.relations.some(
    (relation) => relation.fromFactionId === payload.playerFaction.id && relation.relationScore <= -40,
  );

  if (mission.category === "扩张" || mission.category === "资源争夺" || mission.category === "复仇" || hostilePressure) {
    return "这不是可以慢慢磨的差事，边线已经开始催人。";
  }
  if (mission.category === "内政") {
    return "门内先稳住，比对外出手更要紧。";
  }
  if (mission.category === "外交") {
    return "表面平静，但每一句试探都可能改写下一步。";
  }
  return "眼下仍有腾挪空间，但最好别把机会拖凉。";
}

function relationPosture(score: number, relationType: string) {
  if (score >= 56) {
    return "盟意渐实";
  }
  if (score >= 18) {
    return "试着靠拢";
  }
  if (score <= -66) {
    return "血债压身";
  }
  if (score <= -32) {
    return "刀背向外";
  }
  if (relationType === "vassal") {
    return "礼数偏重";
  }
  return "表面无波";
}

function relationThreat(score: number, targetPower: number, playerPower: number): FactionSignalView["threat"] {
  const pressure = Math.abs(Math.min(0, score)) + Math.max(0, targetPower - playerPower);
  if (pressure >= 90) {
    return "高";
  }
  if (pressure >= 42) {
    return "中";
  }
  return "低";
}

function stripFactionHeadline(summary: string, factionName: string) {
  return compactText(summary)
    .replace(new RegExp(`^${factionName}`), "")
    .replace(/^现下气象为[“"][^”"]+[”"]。?/, "")
    .replace(/^[：:，,\s]+/, "")
    .trim();
}

function buildSignalRead(target: FactionView, relation?: FactionRelationView) {
  const summary = compactText(target.playerFacingSummary || target.currentPlan || target.goal, `${target.name}还没有露出太清晰的手势。`);
  const headline = stripFactionHeadline(summary, target.name) || summary;
  if (relation && relation.relationScore <= -32) {
    return `近来能看出的，是${target.name}多半不会轻易让步。${headline}`;
  }
  if (relation && relation.relationScore >= 18) {
    return `从外放口风看，${target.name}似乎还留着转圜余地。${headline}`;
  }
  return `暂时只能从细枝末节判断：${headline}`;
}

function buildSignalLeverage(target: FactionView, relation?: FactionRelationView) {
  const styleTag = target.styleTags[0] || target.type;
  if (relation && relation.relationScore <= -32) {
    return `若要周旋，多半得从${styleTag}这条线找破绽。`;
  }
  if (relation && relation.relationScore >= 18) {
    return `若要借势，可先围着${styleTag}递话试探。`;
  }
  return `现在更像在比谁先露底，${styleTag}会是第一条缝。`;
}

function buildFactionSignals(payload: FactionUiPayload): FactionSignalView[] {
  const relationsByTarget = new Map(
    payload.relations
      .filter((relation) => relation.fromFactionId === payload.playerFaction.id)
      .map((relation) => [relation.toFactionId, relation]),
  );

  const relevantFactions = payload.factions
    .filter((faction) => faction.id !== payload.playerFaction.id)
    .map((faction) => {
      const relation = relationsByTarget.get(faction.id);
      const relationWeight = relation ? Math.abs(relation.relationScore) : 0;
      const neighborWeight = faction.controlledNodeIds.some((nodeId) =>
        payload.mapNodes.some(
          (node) =>
            node.ownerFactionId === payload.playerFaction.id &&
            node.neighborNodeIds.includes(nodeId),
        ),
      )
        ? 24
        : 0;
      return {
        faction,
        relation,
        weight: relationWeight + neighborWeight + faction.powerScore,
      };
    })
    .sort((left, right) => right.weight - left.weight)
    .slice(0, 3);

  return relevantFactions.map(({ faction, relation }) => ({
    factionId: faction.id,
    name: faction.name,
    posture: relationPosture(relation?.relationScore || 0, relation?.relationType || "neutral"),
    threat: relationThreat(relation?.relationScore || 0, faction.powerScore, payload.playerFaction.powerScore),
    read: buildSignalRead(faction, relation),
    leverage: buildSignalLeverage(faction, relation),
    palette: faction.palette,
  }));
}

function clueCertainty(importance: number): FactionClueView["certainty"] {
  if (importance >= 3) {
    return "坐实";
  }
  if (importance >= 2) {
    return "旁证";
  }
  return "风闻";
}

function clueHeat(importance: number): FactionClueView["heat"] {
  if (importance >= 3) {
    return "炽烈";
  }
  if (importance >= 2) {
    return "暗涌";
  }
  return "微澜";
}

function clueSource(event: WorldEventView) {
  const mapping: Record<string, string> = {
    alliance_offer: "驿站耳报",
    alliance_accept: "宗门邸抄",
    border_skirmish: "边线传闻",
    war_declared: "军报残页",
    mission_complete: "执事口风",
    occupation: "行脚见闻",
    resource_conflict: "商旅暗报",
    vendetta: "秘探回帖",
    fortify: "内堂纪要",
    training: "山门训令",
  };
  if (mapping[event.type]) {
    return mapping[event.type];
  }
  if (event.title.includes("宣战")) {
    return "军报残页";
  }
  if (event.title.includes("盟约")) {
    return "宗门邸抄";
  }
  if (event.title.includes("财路") || event.summary.includes("账册") || event.summary.includes("补给")) {
    return "内堂纪要";
  }
  if (event.title.includes("夺下") || event.title.includes("争夺") || event.summary.includes("势力范围")) {
    return "行脚见闻";
  }
  if (event.summary.includes("旧仇") || event.summary.includes("追")) {
    return "秘探回帖";
  }
  return "坊间传抄";
}

function buildIntelRumors(payload: FactionUiPayload): FactionClueView[] {
  return payload.recentEvents.slice(0, 4).map((event) => ({
    id: `event-${event.id}`,
    title: event.title,
    summary: compactText(event.summary, "风声太杂，尚未拼成全貌。"),
    source: clueSource(event),
    certainty: clueCertainty(event.importance),
    heat: clueHeat(event.importance),
    factionId: event.factionId,
    nodeId: undefined,
  }));
}

function buildMissionBrief(payload: FactionUiPayload): FactionMissionBriefView | undefined {
  const mission = payload.activeMission;
  if (!mission) {
    return undefined;
  }

  return {
    title: mission.title,
    summary: compactText(mission.description, `${payload.playerFaction.name}还没有把这步棋说透。`),
    urgency: missionUrgency(payload, mission),
    progressHint: missionProgressHint(mission),
    suggestedApproach: missionSuggestedApproach(mission.category),
    targetLabel: mission.targetNodeName,
  };
}

function buildPlayerLens(payload: FactionUiPayload): FactionPlayerLensView {
  const currentNode = payload.mapNodes.find((node) => node.id === payload.playerState.currentNodeId);
  const hottestSignal = payload.factionSignals[0];
  const latestClue = payload.intelRumors[0];

  return {
    currentTheater: currentNode
      ? `${currentNode.name} · ${currentNode.terrain}，眼下是“${nodeRiskBand(currentNode)} / ${nodeProsperityBand(currentNode)}”的路数。`
      : "行踪尚未在帮派沙盘上坐实。",
    currentClimate: compactText(
      payload.playerFaction.playerFacingSummary,
      `${payload.playerFaction.name}还在按旧步子走，真正的转向还没完全露面。`,
    ),
    pressure: hottestSignal
      ? `${hottestSignal.name}现在是最值得提防的一股风。${hottestSignal.leverage}`
      : "四面风声都还在试探，没有哪一股已经压到眼前。",
    opportunity: currentNode
      ? `${currentNode.resourceTags[0] || currentNode.terrain}这条线仍有可借之机，先别急着把牌全亮出来。`
      : "机会还埋在细处，先把局势再看半步。",
    nextPulse: latestClue
      ? `${latestClue.source}传来的最新口风是：${latestClue.title}。`
      : "下一股真正改变局面的风，还没有吹到你脚下。",
  };
}

export async function getFactionUiData(characterId: number, db: FactionDbClient = prisma): Promise<FactionUiPayload | undefined> {
  await ensureCharacterHasFactionWorld(characterId, db);

  const character = await db.character.findUnique({
    where: { id: characterId },
    include: {
      world: true,
      factionState: {
        include: {
          faction: true,
          currentNode: true,
          activeMission: {
            include: {
              targetNode: true,
            },
          },
        },
      },
    },
  }) as IncludedCharacterRecord | null;

  if (!character?.world || !character.factionState?.faction) {
    return undefined;
  }

  const [factions, mapNodes, relations, recentEvents] = await Promise.all([
    db.faction.findMany({
      where: { worldId: character.world.id },
      orderBy: { id: "asc" },
    }),
    db.mapNode.findMany({
      where: { worldId: character.world.id },
      include: {
        capitalOfFaction: true,
      },
      orderBy: { id: "asc" },
    }),
    db.factionRelation.findMany({
      where: { worldId: character.world.id },
      orderBy: { id: "asc" },
    }),
    db.worldEvent.findMany({
      where: { worldId: character.world.id },
      orderBy: [{ turn: "desc" }, { id: "desc" }],
      take: 8,
    }),
  ]);

  const factionViews = factions.map(factionToView);
  const factionMap = new Map<number, FactionView>(factionViews.map((item) => [item.id, item]));
  const nodeViews = mapNodes.map((node) => nodeToView(node, factionMap));
  const activeMission = character.factionState.activeMission ? missionToView(character.factionState.activeMission) : undefined;

  const payload = buildWorldPayload(
    character.world,
    factionMap.get(character.factionState.faction.id)!,
    {
      factionId: character.factionState.faction.id,
      factionName: character.factionState.faction.name,
      factionTitle: character.factionState.faction.title,
      factionType: character.factionState.faction.type,
      rank: character.factionState.rank,
      factionRole: character.factionState.factionRole,
      factionExpectation: character.factionState.factionExpectation,
      contribution: character.factionState.contribution,
      trust: character.factionState.trust,
      militaryCredit: character.factionState.militaryCredit,
      politicalStanding: character.factionState.politicalStanding,
      factionGoalProgress: character.factionState.factionGoalProgress,
      currentNodeId: character.factionState.currentNodeId || undefined,
      currentNodeName: character.factionState.currentNode?.name || undefined,
    },
    factionViews,
    nodeViews,
    relations.map(
      (relation) =>
        ({
          id: relation.id,
          fromFactionId: relation.fromFactionId,
          toFactionId: relation.toFactionId,
          relationType: relation.relationType,
          relationScore: relation.relationScore,
          lastReason: relation.lastReason || undefined,
        }) satisfies FactionRelationView,
    ),
    recentEvents.map(
      (event) =>
        ({
          id: event.id,
          turn: event.turn,
          type: event.type,
          title: event.title,
          summary: event.summary,
          importance: event.importance,
          factionId: event.factionId || undefined,
          secondaryFactionId: event.secondaryFactionId || undefined,
          createdAt: event.createdAt.toISOString(),
        }) satisfies WorldEventView,
    ),
    activeMission,
  );

  const normalizedSummary = normalizeWorldSummary(payload.world.newsSummary);
  if (normalizedSummary !== payload.world.newsSummary) {
    payload.world.newsSummary = normalizedSummary;
    await db.world.update({
      where: { id: character.world.id },
      data: { newsSummary: normalizedSummary },
    });
  }

  const derivedGoal = deriveGoalProgress(payload);
  const derivedRank = deriveFactionRank(payload.playerState);
  const statePatch: Record<string, number | string> = {};

  if (derivedGoal !== payload.playerState.factionGoalProgress) {
    payload.playerState.factionGoalProgress = derivedGoal;
    statePatch.factionGoalProgress = derivedGoal;
  }

  if (derivedRank !== payload.playerState.rank) {
    payload.playerState.rank = derivedRank;
    statePatch.rank = derivedRank;
  }

  if (Object.keys(statePatch).length > 0) {
    await db.characterFactionState.update({
      where: { characterId },
      data: statePatch,
    });
  }

  payload.factionSignals = buildFactionSignals(payload);
  payload.intelRumors = buildIntelRumors(payload);
  payload.missionBrief = buildMissionBrief(payload);
  payload.playerLens = buildPlayerLens(payload);

  return payload;
}

export async function getFactionNarrativeContext(characterId: number) {
  const payload = await getFactionUiData(characterId);
  if (!payload) {
    return {
      WORLD_STATE_SUMMARY: "当前仍以个人修行为主，尚未接入帮派世界。",
      CURRENT_REGION: "未知地界",
      PLAYER_FACTION_STATUS: "暂无帮派身份。",
      FACTION_RELATIONS: "暂无势力关系可供参考。",
      RECENT_WORLD_EVENTS: "最近天下没有足以影响主角的重大势力事件。",
      ACTIVE_FACTION_MISSIONS: "暂无帮派任务。",
    };
  }

  const relations = payload.factionSignals
    .map((signal) => `${signal.name}：${signal.posture}，威胁${signal.threat}。${signal.read}`)
    .join("；");

  const recentEvents = payload.intelRumors
    .map((clue) => `${clue.source}·${clue.certainty}·${clue.title}：${clue.summary}`)
    .join("\n");

  const missionText = payload.missionBrief
    ? `${payload.missionBrief.title}：${payload.missionBrief.summary}。${payload.missionBrief.urgency}${payload.missionBrief.progressHint}${payload.missionBrief.suggestedApproach}`
    : "当前暂无专项帮派任务，可先积累贡献，静看风向。";

  return {
    WORLD_STATE_SUMMARY: `${payload.world.newsSummary} 只把最显眼的浪头写出来，别把天下底牌一次说尽。`,
    CURRENT_REGION: payload.playerLens.currentTheater,
    PLAYER_FACTION_STATUS: `${payload.playerFaction.name}·${payload.playerFaction.title}。你的身份是${payload.playerState.rank}，职责是${payload.playerState.factionRole}。帮中最近透出的口风：${payload.playerLens.currentClimate} 当前帮中期望：${payload.playerState.factionExpectation}`,
    FACTION_RELATIONS: relations || "周边势力暂未出现足以左右剧情的鲜明态度。",
    RECENT_WORLD_EVENTS: recentEvents || "最近天下平静，尚无值得特别写入剧情的势力震荡。",
    ACTIVE_FACTION_MISSIONS: missionText,
  };
}

function matchesMissionCategory(category: string, actionType: GameOptionType["选项类别"]) {
  const mapping: Record<string, GameOptionType["选项类别"][]> = {
    扩张: ["战斗", "探索"],
    外交: ["交流"],
    内政: ["交流", "探索"],
    修行: ["探索", "战斗"],
    复仇: ["战斗"],
    资源争夺: ["探索", "战斗"],
  };
  return (mapping[category] || ["探索"]).includes(actionType);
}

type StoryOutcomeSignal = {
  inferredNodeId?: number;
  hasMeaningfulCharacters: boolean;
};

function isMeaningfulCharacterMention(name: string) {
  const trimmed = compactText(name);
  if (!trimmed) {
    return false;
  }

  if (CHARACTER_ABSENCE_PATTERNS.some((pattern) => trimmed.includes(pattern))) {
    return false;
  }

  if (GENERIC_CHARACTER_TOKENS.has(trimmed)) {
    return false;
  }

  if (trimmed.length >= 2 && !/^第.+人$/.test(trimmed)) {
    return true;
  }

  return CHARACTER_ROLE_PATTERN.test(trimmed);
}

function hasMeaningfulCharacters(storyInfo?: StoryPushType) {
  const characters = (storyInfo?.节点要素?.剧情要素?.人物 || []).map((item) => compactText(item)).filter(Boolean);
  if (characters.some(isMeaningfulCharacterMention)) {
    return true;
  }

  const plot = compactText(storyInfo?.节点要素?.剧情要素?.剧情);
  return CHARACTER_ROLE_PATTERN.test(plot);
}

function inferNodeFromStory(
  nodes: Pick<MapNode, "id" | "name" | "terrain" | "resourceTags" | "neighborNodeIds">[],
  storyInfo: StoryPushType | undefined,
  currentNodeId?: number,
  missionTargetNodeId?: number,
) {
  if (!storyInfo || !nodes.length) {
    return undefined;
  }

  const scenes = (storyInfo.节点要素?.剧情要素?.场景 || []).map((item) => compactText(item)).filter(Boolean);
  const plot = compactText(storyInfo.节点要素?.剧情要素?.剧情);
  const task = compactText(storyInfo.节点要素?.基础信息?.当前任务);
  const joinedText = [plot, task, ...scenes].filter(Boolean).join(" ");
  const hasMovementHint = MOVEMENT_HINTS.some((hint) => joinedText.includes(hint));

  const ranked = nodes
    .map((node) => {
      let score = 0;
      let exactNameHit = false;

      if (scenes.some((scene) => includesLookupKey(scene, node.name))) {
        score += 18;
        exactNameHit = true;
      }

      if ([plot, task].some((text) => includesLookupKey(text, node.name))) {
        score += 14;
        exactNameHit = true;
      }

      if (!exactNameHit && scenes.some((scene) => scene.includes(node.terrain))) {
        score += 4;
      }

      if (!exactNameHit && [plot, task].some((text) => text.includes(node.terrain))) {
        score += 3;
      }

      const resourceHits = readStringArray(node.resourceTags).filter((tag) =>
        [plot, task, ...scenes].some((text) => text.includes(tag)),
      ).length;
      score += Math.min(2, resourceHits) * 2;

      if (missionTargetNodeId && node.id === missionTargetNodeId) {
        if (exactNameHit) {
          score += 6;
        } else if (score > 0) {
          score += 4;
        }
      }

      if (
        hasMovementHint &&
        currentNodeId &&
        node.id !== currentNodeId &&
        readNumberArray(node.neighborNodeIds).includes(currentNodeId) &&
        score > 0
      ) {
        score += 3;
      }

      if (node.id === currentNodeId && exactNameHit) {
        score += 2;
      }

      return {
        nodeId: node.id,
        score,
        exactNameHit,
      };
    })
    .sort((left, right) => right.score - left.score);

  const best = ranked[0];
  const runnerUp = ranked[1];

  if (!best || best.score <= 0) {
    return undefined;
  }

  if (best.exactNameHit) {
    return best.nodeId;
  }

  if (missionTargetNodeId && best.nodeId === missionTargetNodeId && best.score >= 8) {
    return best.nodeId;
  }

  if (best.score >= 10 && (!runnerUp || best.score - runnerUp.score >= 3)) {
    return best.nodeId;
  }

  return undefined;
}

async function analyzeStoryOutcome(
  worldId: number | undefined,
  storyInfo: StoryPushType | undefined,
  currentNodeId?: number,
  missionTargetNodeId?: number,
): Promise<StoryOutcomeSignal> {
  const signal: StoryOutcomeSignal = {
    hasMeaningfulCharacters: hasMeaningfulCharacters(storyInfo),
  };

  if (!worldId || !storyInfo) {
    return signal;
  }

  const nodes = await prisma.mapNode.findMany({
    where: { worldId },
    select: {
      id: true,
      name: true,
      terrain: true,
      resourceTags: true,
      neighborNodeIds: true,
    },
  });

  signal.inferredNodeId = inferNodeFromStory(nodes, storyInfo, currentNodeId, missionTargetNodeId);
  return signal;
}

function calculateMissionProgressGain(
  mission: IncludedMissionRecord,
  option: Pick<GameOptionType, "选项类别" | "选项难度">,
  success: boolean,
  signal: StoryOutcomeSignal,
  fallbackNodeId?: number,
) {
  if (!success || mission.status !== "ACTIVE" || !matchesMissionCategory(mission.category, option.选项类别)) {
    return 0;
  }

  const activeNodeId = signal.inferredNodeId || fallbackNodeId;
  const atTargetNode = Boolean(mission.targetNodeId && activeNodeId === mission.targetNodeId);
  const hardBonus = option.选项难度 === "逆天而行" ? 1 : 0;

  switch (mission.category) {
    case "外交":
      if (option.选项类别 !== "交流" || !signal.hasMeaningfulCharacters) {
        return 0;
      }
      return Math.min(2, 1 + hardBonus + (atTargetNode ? 1 : 0));
    case "内政":
      if (!signal.hasMeaningfulCharacters) {
        return 0;
      }
      return Math.min(2, 1 + hardBonus + (option.选项类别 === "交流" ? 1 : 0));
    case "扩张":
    case "资源争夺":
    case "复仇":
      if (mission.targetNodeId && !atTargetNode) {
        return 0;
      }
      return Math.min(2, 1 + hardBonus + (option.选项类别 === "战斗" ? 1 : 0));
    case "修行":
      return Math.min(2, 1 + hardBonus + (option.选项类别 === "探索" ? 1 : 0));
    default:
      return Math.min(2, 1 + hardBonus);
  }
}

export async function recordFactionActionOutcome(
  characterId: number,
  option: Pick<GameOptionType, "选项类别" | "选项难度">,
  success: boolean,
  storyInfo?: StoryPushType,
) {
  const state = await prisma.characterFactionState.findUnique({
    where: { characterId },
    include: {
      activeMission: {
        include: {
          targetNode: true,
        },
      },
      faction: true,
      character: true,
      currentNode: true,
    },
  });

  if (!state) {
    return;
  }

  const signal = await analyzeStoryOutcome(
    state.character?.worldId || state.faction.worldId,
    storyInfo,
    state.currentNodeId || undefined,
    state.activeMission?.targetNodeId || undefined,
  );

  const statePatch: Prisma.CharacterFactionStateUpdateInput = {};
  if (signal.inferredNodeId && signal.inferredNodeId !== state.currentNodeId) {
    statePatch.currentNode = { connect: { id: signal.inferredNodeId } };
  }

  if (success) {
    statePatch.contribution = { increment: 1 };
    if (option.选项类别 === "交流" && signal.hasMeaningfulCharacters) {
      statePatch.trust = { increment: 1 };
    }
  }

  if (Object.keys(statePatch).length > 0) {
    await prisma.characterFactionState.update({
      where: { characterId },
      data: statePatch,
    });
  }

  if (!state.activeMission || state.activeMission.status !== "ACTIVE" || !matchesMissionCategory(state.activeMission.category, option.选项类别)) {
    return;
  }

  const activeMission = state.activeMission;
  const progressGain = calculateMissionProgressGain(
    activeMission,
    option,
    success,
    signal,
    state.currentNodeId || undefined,
  );
  if (progressGain <= 0) {
    return;
  }

  const nextProgress = activeMission.progress + progressGain;
  if (nextProgress < activeMission.goal) {
    await prisma.factionMission.update({
      where: { id: activeMission.id },
      data: { progress: nextProgress },
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.factionMission.update({
      where: { id: activeMission.id },
      data: {
        progress: activeMission.goal,
        status: "COMPLETED",
      },
    });

    await tx.characterFactionState.update({
      where: { characterId },
      data: {
        contribution: { increment: activeMission.rewardContribution },
        trust: { increment: activeMission.rewardTrust },
        militaryCredit: { increment: activeMission.rewardMilitaryCredit },
        politicalStanding: { increment: activeMission.rewardPoliticalStanding },
        activeMissionId: null,
      },
    });

      const character = await tx.character.findUnique({ where: { id: characterId } });
      if (character?.worldId) {
        const world = await tx.world.findUnique({ where: { id: character.worldId } });
        await tx.worldEvent.create({
          data: {
            worldId: character.worldId,
            factionId: state.factionId,
            type: "mission_complete",
            title: `${state.faction.name}记下你的功劳`,
            summary: `你完成了“${activeMission.title}”，帮中对你的评价明显上扬。`,
            importance: 1,
            turn: world?.worldTurn || 0,
          },
        });
      }
  });

  await ensureCharacterFactionMission(characterId);
}

function renderPromptTemplate(template: string, variables: Record<string, unknown>) {
  return Object.entries(variables).reduce((content, [key, value]) => {
    const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2);
    return content.replace(new RegExp(`\\{${key}\\}`, "g"), rendered);
  }, template);
}

function compactText(input: unknown, fallback = "") {
  const normalized = String(input ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || fallback;
}

function normalizeLookupKey(input: string) {
  return input.replace(/[·\s，。、；：:,"'“”‘’（）()\-]/g, "").trim();
}

function includesLookupKey(haystack: string, needle: string) {
  const normalizedHaystack = normalizeLookupKey(haystack);
  const normalizedNeedle = normalizeLookupKey(needle);
  return Boolean(normalizedHaystack && normalizedNeedle && normalizedHaystack.includes(normalizedNeedle));
}

function matchByName<T extends { name: string }>(items: T[], expected?: string) {
  if (!expected) {
    return undefined;
  }

  const normalizedExpected = normalizeLookupKey(expected);
  if (!normalizedExpected) {
    return undefined;
  }

  return (
    items.find((item) => normalizeLookupKey(item.name) === normalizedExpected) ||
    items.find((item) => normalizeLookupKey(item.name).includes(normalizedExpected)) ||
    items.find((item) => normalizedExpected.includes(normalizeLookupKey(item.name)))
  );
}

function describeFactionProfile(faction: Faction | SimulatedFaction) {
  return `${faction.name}·${faction.title}，属于${faction.type}，灵性偏向${faction.elementAffinity}，奉行“${faction.doctrine}”。现由${faction.leaderName}（${faction.leaderArchetype}）主事。军力${faction.strengthMilitary}，财力${faction.strengthEconomy}，谍报${faction.strengthEspionage}，传承${faction.strengthHeritage}，稳定${faction.stability}，声望${faction.reputation}。长期目标：${faction.goal}`;
}

function describeControlledNodes(
  faction: Faction | SimulatedFaction,
  nodes: Array<IncludedNodeRecord | SimulatedNode>,
  factionsById: Map<number, Pick<Faction, "name"> | Pick<SimulatedFaction, "name">>,
) {
  const controlledSet = new Set(readNumberArray(faction.controlledNodeIds));
  const controlledNodes = nodes.filter((node) => controlledSet.has(node.id));

  if (!controlledNodes.length) {
    return "当前暂无稳固据点，仍处于摇摆边线。";
  }

  return controlledNodes
    .map((node) => {
      const ownerName = node.ownerFactionId ? factionsById.get(node.ownerFactionId)?.name || "未知" : "无主";
      return `${node.name}（${node.terrain}，归属${ownerName}，繁荣${node.prosperity}，险度${node.danger}，资源${readStringArray(node.resourceTags).join("、") || "暂无"}）`;
    })
    .join("；");
}

function describeRelationsForPrompt(
  faction: Pick<Faction, "id"> | Pick<SimulatedFaction, "id">,
  relations: FactionRelationView[],
  factionsById: Map<number, Pick<Faction, "name"> | Pick<SimulatedFaction, "name">>,
) {
  const relevant = relations
    .filter((relation) => relation.fromFactionId === faction.id)
    .sort((left, right) => Math.abs(right.relationScore) - Math.abs(left.relationScore))
    .slice(0, 5);

  if (!relevant.length) {
    return "暂无足够鲜明的外交牵扯。";
  }

  return relevant
    .map((relation) => {
      const target = factionsById.get(relation.toFactionId);
      return `${target?.name || "未知势力"}：关系${relation.relationScore}，定性${relation.relationType}${relation.lastReason ? `，最近因由${relation.lastReason}` : ""}`;
    })
    .join("；");
}

function describeRecentEventsForPrompt(recentEvents: WorldEvent[]) {
  if (!recentEvents.length) {
    return "近几轮暂无需要重点提防的世界异动。";
  }

  return recentEvents
    .slice(0, 5)
    .map((event) => `第${event.turn}轮·${event.title}：${event.summary}`)
    .join("\n");
}

function describeFactionMemory(faction: Faction | SimulatedFaction) {
  const memoryEntries = [
    ...readStringArray(faction.strategicReflections),
    ...readStringArray(faction.importantMemories),
    ...readStringArray(faction.recentObservations),
  ]
    .filter(Boolean)
    .slice(0, 6);

  if (!memoryEntries.length) {
    return "此前尚未沉淀出明确的旧策与记忆。";
  }

  return memoryEntries.map((entry, index) => `${index + 1}. ${entry}`).join("\n");
}

function buildIntentCandidates(
  faction: SimulatedFaction,
  nodes: SimulatedNode[],
  relations: FactionRelationView[],
  factions: SimulatedFaction[],
) {
  const controlledNodeIds = readNumberArray(faction.controlledNodeIds);
  const controlledSet = new Set(controlledNodeIds);
  const factionsById = new Map(factions.map((item) => [item.id, item]));
  const borderTargets = sortBorderTargets(
    nodes.filter(
      (node) =>
        node.ownerFactionId !== faction.id &&
        node.neighborNodeIds.some((neighborId: number) => controlledSet.has(neighborId)),
    ),
  );
  const resourceTargets = [...borderTargets]
    .sort((left, right) => nodeResourceValue(right) - nodeResourceValue(left))
    .filter((node) => nodeResourceValue(node) >= 32);
  const hostileRelations = relations
    .filter((relation) => relation.fromFactionId === faction.id && relation.relationScore <= -18)
    .sort((left, right) => left.relationScore - right.relationScore);
  const bloodFeuds = hostileRelations.filter((relation) => relation.relationScore <= -54);
  const warTargets = hostileRelations.filter((relation) => relation.relationScore <= -38);
  const diplomaticRelations = relations
    .filter(
      (relation) =>
        relation.fromFactionId === faction.id &&
        relation.relationScore >= 8 &&
        relation.relationScore <= 48,
    )
    .sort((left, right) => right.relationScore - left.relationScore);
  const candidates: IntentCandidate[] = [];

  for (const target of borderTargets.slice(0, 3)) {
    const defender = target.ownerFactionId ? factionsById.get(target.ownerFactionId) : undefined;
    const score =
      faction.strengthMilitary * 0.46 +
      faction.expansionDesire * 0.26 +
      target.prosperity * 0.22 -
      target.danger * 0.18 -
      (defender?.strengthMilitary || 36) * 0.14 +
      (target.ownerFactionId ? 0 : 8);
    candidates.push({
      type: "扩张",
      summary: `${faction.name}准备向${target.name}压上边线，争取把疆界再推前一步。`,
      targetNodeId: target.id,
      targetFactionId: target.ownerFactionId || undefined,
      targetNodeName: target.name,
      targetFactionName: defender?.name,
      score,
      rationale: `${target.name}位于边线交汇处，${target.prosperity >= 60 ? "收益高" : "收益可观"}，且${target.danger <= 36 ? "守备空隙较多" : "虽然险要但仍有试探空间"}。`,
      });
  }

  for (const target of resourceTargets.slice(0, 2)) {
    const defender = target.ownerFactionId ? factionsById.get(target.ownerFactionId) : undefined;
    const resourceLabel = resourceLineLabel(target);
    const score =
      faction.strengthEconomy * 0.28 +
      faction.strengthMilitary * 0.22 +
      faction.expansionDesire * 0.18 +
      nodeResourceValue(target) * 0.42 -
      target.danger * 0.16 -
      (defender?.strengthMilitary || 38) * 0.12;
    candidates.push({
      type: "争夺资源点",
      summary: `${faction.name}盯上${target.name}的${resourceLabel}，准备先把这条命脉掐进自己手里。`,
      targetNodeId: target.id,
      targetFactionId: target.ownerFactionId || undefined,
      targetNodeName: target.name,
      targetFactionName: defender?.name,
      score,
      rationale: `${target.name}兼具${target.resourceTags.join("、")}，一旦得手，足以改写后续供给与边线筹码。`,
    });
  }

  for (const hostileRelation of hostileRelations.slice(0, 2)) {
    const targetFaction = factionsById.get(hostileRelation.toFactionId);
    const score =
      faction.aggression * 0.34 +
      faction.strengthMilitary * 0.22 +
      Math.abs(hostileRelation.relationScore) * 0.3 +
      faction.strengthEspionage * 0.14;
    candidates.push({
      type: "清剿",
      summary: `${faction.name}想先清掉${targetFaction?.name || "旧敌"}外线探子与附庸，逼对方暂时收手。`,
      targetFactionId: hostileRelation.toFactionId,
      targetFactionName: targetFaction?.name,
      score,
      rationale: `${targetFaction?.name || "对头"}与本帮积怨已深，继续放任只会让边线与风声同时恶化。`,
    });
  }

  for (const warRelation of warTargets.slice(0, 1)) {
    const targetFaction = factionsById.get(warRelation.toFactionId);
    const score =
      faction.aggression * 0.3 +
      faction.strengthMilitary * 0.26 +
      Math.abs(warRelation.relationScore) * 0.28 +
      faction.reputation * 0.08 +
      faction.stability * 0.08;
    candidates.push({
      type: "宣战",
      summary: `${faction.name}准备与${targetFaction?.name || "对头"}公开撕破脸，把暗斗逼成台前硬碰。`,
      targetFactionId: warRelation.toFactionId,
      targetFactionName: targetFaction?.name,
      score,
      rationale: `双方关系已逼近断口，继续只做暗斗，反而会让边线与门中判断都陷入被动。`,
    });
  }

  for (const bloodFeud of bloodFeuds.slice(0, 1)) {
    const targetFaction = factionsById.get(bloodFeud.toFactionId);
    const score =
      faction.aggression * 0.24 +
      faction.strengthEspionage * 0.24 +
      faction.strengthMilitary * 0.16 +
      Math.abs(bloodFeud.relationScore) * 0.36;
    candidates.push({
      type: "追杀仇敌",
      summary: `${faction.name}要顺着旧怨追索${targetFaction?.name || "宿敌"}，不给对方回身整队的余地。`,
      targetFactionId: bloodFeud.toFactionId,
      targetFactionName: targetFaction?.name,
      score,
      rationale: `${targetFaction?.name || "宿敌"}已被记为死结，若不继续追压，对方迟早会反咬回来。`,
    });
  }

  if (faction.type !== "魔门") {
    for (const diplomaticRelation of diplomaticRelations.slice(0, 2)) {
      const targetFaction = factionsById.get(diplomaticRelation.toFactionId);
      const score =
        diplomaticRelation.relationScore * 0.42 +
        faction.strengthEconomy * 0.18 +
        faction.reputation * 0.18 +
        (targetFaction?.strengthEconomy || 40) * 0.08 +
        faction.stability * 0.14;
      candidates.push({
        type: "结盟",
        summary: `${faction.name}想先把${targetFaction?.name || "可拉拢势力"}拢到身边，以免腹背受敌。`,
        targetFactionId: diplomaticRelation.toFactionId,
        targetFactionName: targetFaction?.name,
        score,
        rationale: `对${targetFaction?.name || "该势力"}的关系尚可，若及时递出筹码，有机会换来边线缓冲与资源互通。`,
      });
    }
  }

  candidates.push({
    type: "经营",
    summary: `${faction.name}准备先修补财路、仓储与供给，不急着把底牌押在前线。`,
    score:
      Math.max(0, 78 - faction.strengthEconomy) * 1.08 +
      Math.max(0, 60 - faction.stability) * 0.46 +
      Math.max(0, 3 - controlledNodeIds.length) * 4,
    rationale: "财路与后勤若先稳住，后续无论动兵还是结盟都会更从容。",
  });
  candidates.push({
    type: "休养",
    summary: `${faction.name}决定先收束外线，把门中裂缝与疲态补平。`,
    score:
      Math.max(0, 62 - faction.stability) * 1.34 +
      Math.max(0, 55 - faction.reputation) * 0.28 +
      Math.max(0, 52 - faction.strengthMilitary) * 0.12,
    rationale: "若内里不稳，继续冒进只会让门中更早出血。",
  });
  candidates.push({
    type: "培养弟子",
    summary: `${faction.name}想把重心压在门下新秀和秘传训练上，为下一轮争锋蓄一口长气。`,
    score:
      Math.max(0, 74 - faction.strengthHeritage) +
      Math.max(0, 58 - faction.strengthMilitary) * 0.34 +
      12,
    rationale: "门下战力与传承梯队若不补强，再好的局面也守不久。",
  });

  return candidates.sort((left, right) => right.score - left.score);
}

function chooseHeuristicIntent(
  faction: SimulatedFaction,
  nodes: SimulatedNode[],
  relations: FactionRelationView[],
  factions: SimulatedFaction[],
  candidates?: IntentCandidate[],
) {
  const allCandidates = candidates || buildIntentCandidates(faction, nodes, relations, factions);
  const bestOf = (type: FactionIntent["type"]) => allCandidates.find((candidate) => candidate.type === type);
  const expansionCandidate = bestOf("扩张");
  const hostileCandidate = bestOf("清剿");
  const warCandidate = bestOf("宣战");
  const resourceCandidate = bestOf("争夺资源点");
  const vendettaCandidate = bestOf("追杀仇敌");
  const economyCandidate = bestOf("经营");
  const allianceCandidate = bestOf("结盟");
  const restCandidate = bestOf("休养");
  const trainingCandidate = bestOf("培养弟子");

  if (faction.stability < 46 && restCandidate) {
    return restCandidate;
  }

  if (vendettaCandidate && faction.aggression + faction.strengthEspionage >= 138) {
    return vendettaCandidate;
  }

  if (warCandidate && faction.aggression + faction.strengthMilitary >= 134) {
    return warCandidate;
  }

  if (resourceCandidate && (faction.strengthEconomy < 62 || faction.expansionDesire >= 56)) {
    return resourceCandidate;
  }

  if (expansionCandidate && faction.expansionDesire + faction.strengthMilitary >= 124) {
    return expansionCandidate;
  }

  if (hostileCandidate && faction.aggression > 58) {
    return hostileCandidate;
  }

  if (economyCandidate && faction.strengthEconomy < 58) {
    return economyCandidate;
  }

  if (allianceCandidate && faction.type !== "魔门") {
    return allianceCandidate;
  }

  return trainingCandidate || economyCandidate || restCandidate || allCandidates[0] || {
    type: "培养弟子",
    summary: `${faction.name}决定先养精蓄锐，磨好下一批能用的人。`,
    score: 0,
    rationale: "缺少更好的方案时，至少先守住基本盘。",
  };
}

function formatCandidateActions(candidates: IntentCandidate[]) {
  return candidates
    .slice(0, 6)
    .map((candidate, index) => {
      const targetParts = [
        candidate.targetNodeName ? `目标节点：${candidate.targetNodeName}` : "",
        candidate.targetFactionName ? `目标势力：${candidate.targetFactionName}` : "",
      ].filter(Boolean);
      return `${index + 1}. [${candidate.type}] ${candidate.summary}${targetParts.length ? `｜${targetParts.join("｜")}` : ""}｜理由：${candidate.rationale}`;
    })
    .join("\n");
}

function buildFactionPromptVariables(
  world: World,
  faction: SimulatedFaction,
  nodes: SimulatedNode[],
  relations: FactionRelationView[],
  factions: SimulatedFaction[],
  recentEvents: WorldEvent[],
  candidates: IntentCandidate[],
) {
  const factionsById = new Map(factions.map((item) => [item.id, item]));
  const borderTargets = candidates
    .filter((candidate) => ["扩张", "清剿", "宣战", "争夺资源点", "追杀仇敌"].includes(candidate.type))
    .slice(0, 3)
    .map((candidate) => `${candidate.type}:${candidate.targetNodeName || candidate.targetFactionName || candidate.summary}`)
    .join("；");

  const currentDirective = readPlanSummary(faction.currentPlan) || "当前暂无明确旧策。";

  return {
    WORLD_NAME: world.name,
    WORLD_TURN: String(world.worldTurn + 1),
    CURRENT_SEASON: world.season,
    CURRENT_TIME_PHASE: world.timePhase,
    WORLD_SUMMARY: compactText(world.newsSummary, "天下局势尚未出现明显的新裂口。"),
    FACTION_PROFILE: describeFactionProfile(faction),
    CONTROLLED_TERRITORY: describeControlledNodes(faction, nodes, factionsById),
    BORDER_PRESSURE: borderTargets || "边线暂未出现必须立刻动刀的目标。",
    RELATION_OVERVIEW: describeRelationsForPrompt(faction, relations, factionsById),
    RECENT_WORLD_EVENTS: describeRecentEventsForPrompt(recentEvents),
    MEMORY_ARCHIVE: describeFactionMemory(faction),
    CURRENT_DIRECTIVE: compactText(currentDirective, "当前暂无明确旧策。"),
    CANDIDATE_ACTIONS: formatCandidateActions(candidates),
  };
}

function canUsePromptConfig(config?: FactionPromptConfig) {
  return Boolean(config?.model?.name && config.model.apiKey?.trim());
}

function mergePromptWithFallbackModel(
  config: FactionPromptConfig | undefined,
  fallbackModel: FactionModelConfig | undefined,
) {
  if (!config) {
    return undefined;
  }

  if (canUsePromptConfig(config)) {
    return config;
  }

  if (!fallbackModel?.name || !fallbackModel.apiKey?.trim()) {
    return undefined;
  }

  return {
    ...config,
    modelId: fallbackModel.id,
    model: fallbackModel,
  };
}

async function loadFactionPromptBundle(): Promise<FactionPromptBundle> {
  const [reflection, planning, storyPrompt, models] = await Promise.all([
    ConfigService.getConfig("faction_reflection_prompt").catch(() => undefined),
    ConfigService.getConfig("faction_planning_prompt").catch(() => undefined),
    ConfigService.getConfig("story_prompt").catch(() => undefined),
    ConfigService.getAllModels().catch(() => []),
  ]);
  const fallbackModel =
    (storyPrompt?.model?.name && storyPrompt.model.apiKey?.trim() ? storyPrompt.model : undefined) ||
    models.find((model) => model.isActive && model.apiKey?.trim()) ||
    models.find((model) => model.apiKey?.trim());

  return {
    reflection: mergePromptWithFallbackModel(reflection, fallbackModel),
    planning: mergePromptWithFallbackModel(planning, fallbackModel),
  };
}

async function generatePromptObject<T>({
  config,
  schema,
  variables,
}: {
  config?: FactionPromptConfig;
  schema: z.ZodSchema<T>;
  variables: Record<string, unknown>;
}) {
  if (!config?.model) {
    return undefined;
  }

  const modelInstance = createModelFromConfig(config.model);
  const providerOptions = getProviderOptions(config.model, config);
  const system = renderPromptTemplate(config.systemPrompt || "", variables);
  const prompt = renderPromptTemplate(config.userPrompt || "", variables);
  const { object } = await stableGenerateObject({
    model: modelInstance(config.model.name),
    schema,
    system,
    prompt,
    maxTokens: Number(config.params?.max_tokens || 1200),
    providerOptions,
    promptTemplate: config.name,
  });

  return object;
}

function resolvePlannedIntent(
  planning: FactionPlanning | undefined,
  candidates: IntentCandidate[],
  fallback: IntentCandidate,
  factions: SimulatedFaction[],
  nodes: SimulatedNode[],
) {
  if (!planning) {
    return fallback;
  }

  const typedCandidates = candidates.filter((candidate) => candidate.type === planning.行动类型);
  const targetFaction = matchByName(factions, planning.目标势力);
  const targetNode = matchByName(nodes, planning.目标节点);

  const matchedCandidate =
    typedCandidates.find(
      (candidate) =>
        (!targetFaction || candidate.targetFactionId === targetFaction.id) &&
        (!targetNode || candidate.targetNodeId === targetNode.id),
    ) ||
    typedCandidates.find((candidate) => (targetFaction ? candidate.targetFactionId === targetFaction.id : false)) ||
    typedCandidates.find((candidate) => (targetNode ? candidate.targetNodeId === targetNode.id : false)) ||
    typedCandidates[0] ||
    fallback;

  return {
    ...matchedCandidate,
    summary: compactText(planning.行动摘要, matchedCandidate.summary),
  };
}

async function chooseIntentForFaction(
  faction: SimulatedFaction,
  nodes: SimulatedNode[],
  relations: FactionRelationView[],
  factions: SimulatedFaction[],
  recentEvents: WorldEvent[],
  world: World,
  prompts: FactionPromptBundle,
): Promise<FactionTurnDecision> {
  const candidates = buildIntentCandidates(faction, nodes, relations, factions);
  const fallback = chooseHeuristicIntent(faction, nodes, relations, factions, candidates);

  if (!prompts.reflection || !prompts.planning) {
    return {
      intent: {
        type: fallback.type,
        summary: fallback.summary,
        targetNodeId: fallback.targetNodeId,
        targetFactionId: fallback.targetFactionId,
      },
      candidates,
      usedPrompt: false,
    };
  }

  const promptVariables = buildFactionPromptVariables(world, faction, nodes, relations, factions, recentEvents, candidates);

  try {
    const reflection = await generatePromptObject({
      config: prompts.reflection,
      schema: factionReflectionSchema,
      variables: promptVariables,
    });

    const planning = await generatePromptObject({
      config: prompts.planning,
      schema: factionPlanningSchema,
      variables: {
        ...promptVariables,
        REFLECTION_REPORT: reflection
          ? [
              `局势总评：${reflection.局势总评}`,
              `核心压力：${reflection.核心压力}`,
              `建议姿态：${reflection.建议姿态}`,
              `风险偏好：${reflection.风险偏好}`,
              `优先目标：${reflection.优先目标.join("、") || "暂无"}`,
              `对外口径：${reflection.对外口径}`,
            ].join("\n")
          : "暂无反思报告。",
      },
    });

    const selected = resolvePlannedIntent(planning, candidates, fallback, factions, nodes);
    return {
      intent: {
        type: selected.type,
        summary: selected.summary,
        targetNodeId: selected.targetNodeId,
        targetFactionId: selected.targetFactionId,
      },
      candidates,
      reflection,
      planning,
      usedPrompt: true,
    };
  } catch (error) {
    console.warn(`[FactionWorld] prompt planning failed for ${faction.name}:`, error);
    return {
      intent: {
        type: fallback.type,
        summary: fallback.summary,
        targetNodeId: fallback.targetNodeId,
        targetFactionId: fallback.targetFactionId,
      },
      candidates,
      usedPrompt: false,
    };
  }
}

function syncControlledNodeIds(factions: SimulatedFaction[], nodes: SimulatedNode[]) {
  for (const faction of factions) {
    faction.controlledNodeIds = nodes
      .filter((node) => node.ownerFactionId === faction.id)
      .map((node) => node.id);
  }
}

function updateRelation(relations: Map<string, FactionRelationView>, fromFactionId: number, toFactionId: number, delta: number, reason: string) {
  const relation = relations.get(buildRelationKey(fromFactionId, toFactionId));
  if (!relation) {
    return;
  }
  relation.relationScore = clamp(relation.relationScore + delta, -100, 100);
  relation.relationType = relationTypeFromScore(relation.relationScore);
  relation.lastReason = reason;
}

function turnEvent(type: string, title: string, summary: string, turn: number, factionId?: number, secondaryFactionId?: number, importance = 1) {
  return {
    type,
    title,
    summary,
    importance,
    turn,
    factionId,
    secondaryFactionId,
    payload: {},
  };
}

export async function advanceFactionWorldTurn(worldId: number) {
  const world = await prisma.world.findUnique({ where: { id: worldId } });
  if (!world) {
    return;
  }

  const [rawFactions, rawNodes, rawRelations, rawRecentEvents] = await Promise.all([
    prisma.faction.findMany({ where: { worldId }, orderBy: { id: "asc" } }),
    prisma.mapNode.findMany({ where: { worldId }, orderBy: { id: "asc" } }),
    prisma.factionRelation.findMany({ where: { worldId }, orderBy: { id: "asc" } }),
    prisma.worldEvent.findMany({
      where: { worldId },
      orderBy: [{ turn: "desc" }, { id: "desc" }],
      take: 6,
    }),
  ]);

  const factions: SimulatedFaction[] = rawFactions.map((item) => ({
    ...item,
    controlledNodeIds: readNumberArray(item.controlledNodeIds),
    currentPlan: normalizePlanState(item.currentPlan),
    recentObservations: readStringArray(item.recentObservations),
    importantMemories: readStringArray(item.importantMemories),
    strategicReflections: readStringArray(item.strategicReflections),
  }));
  const nodes: SimulatedNode[] = rawNodes.map((item) => ({
    ...item,
    neighborNodeIds: readNumberArray(item.neighborNodeIds),
    resourceTags: readStringArray(item.resourceTags),
  }));
  const relations = new Map<string, FactionRelationView>(
    rawRelations.map((relation) => [
      buildRelationKey(relation.fromFactionId, relation.toFactionId),
      {
        id: relation.id,
        fromFactionId: relation.fromFactionId,
        toFactionId: relation.toFactionId,
        relationType: relation.relationType,
        relationScore: relation.relationScore,
        lastReason: relation.lastReason || undefined,
      } satisfies FactionRelationView,
    ]),
  );

  const nextTurn = world.worldTurn + 1;
  const events: Array<ReturnType<typeof turnEvent>> = [];
  const promptBundle = await loadFactionPromptBundle();
  const relationSnapshot = Array.from(relations.values()).map((relation) => ({ ...relation }));
  const decisions = await Promise.all(
    factions.map(async (faction) => ({
      factionId: faction.id,
      decision: await chooseIntentForFaction(
        faction,
        nodes,
        relationSnapshot,
        factions,
        rawRecentEvents,
        world,
        promptBundle,
      ),
    })),
  );
  const decisionByFactionId = new Map(decisions.map((item) => [item.factionId, item.decision]));

  for (const faction of factions) {
    const decision = decisionByFactionId.get(faction.id);
    const intent = decision?.intent || {
      type: "培养弟子",
      summary: `${faction.name}决定先养精蓄锐，磨好下一批能用的人。`,
    };

    if (intent.type === "宣战" && intent.targetFactionId) {
      const targetFaction = factions.find((item) => item.id === intent.targetFactionId);
      if (targetFaction) {
        updateRelation(relations, faction.id, targetFaction.id, -22, "宣战文书已经递到案头。");
        updateRelation(relations, targetFaction.id, faction.id, -18, "对方公开宣战，双方已无缓冲。");
        faction.aggression = clamp(faction.aggression + 3, 20, 100);
        faction.reputation = clamp(faction.reputation + 1, 0, 100);
        targetFaction.stability = clamp(targetFaction.stability - 2, 15, 100);

        for (const node of nodes) {
          const touchesFaction = node.ownerFactionId === faction.id && node.neighborNodeIds.some((neighborId) => targetFaction.controlledNodeIds.includes(neighborId));
          const touchesTarget = node.ownerFactionId === targetFaction.id && node.neighborNodeIds.some((neighborId) => faction.controlledNodeIds.includes(neighborId));
          if (touchesFaction || touchesTarget) {
            node.danger = clamp(node.danger + 4, 10, 100);
          }
        }

        events.push(
          turnEvent(
            "war_declared",
            `${faction.name}向${targetFaction.name}公开宣战`,
            `${faction.name}将与${targetFaction.name}的暗斗推到台前，边线火药味骤然翻上来。`,
            nextTurn,
            faction.id,
            targetFaction.id,
            2,
          ),
        );
      }
    } else if (intent.type === "争夺资源点" && intent.targetNodeId) {
      const targetNode = nodes.find((item) => item.id === intent.targetNodeId);
      const defender = targetNode?.ownerFactionId
        ? factions.find((item) => item.id === targetNode.ownerFactionId)
        : undefined;
      if (targetNode) {
        const resourceLabel = resourceLineLabel(targetNode);
        const attackScore =
          faction.strengthEconomy * 0.28 +
          faction.strengthMilitary * 0.26 +
          faction.strengthEspionage * 0.16 +
          faction.expansionDesire * 0.12 +
          nodeResourceValue(targetNode) * 0.24 +
          Math.random() * 16;
        const defenseScore =
          (defender?.strengthMilitary || 40) * 0.3 +
          (defender?.strengthEconomy || 42) * 0.16 +
          targetNode.danger * 0.22 +
          targetNode.prosperity * 0.12 +
          Math.random() * 14;

        if (attackScore >= defenseScore) {
          targetNode.ownerFactionId = faction.id;
          targetNode.prosperity = clamp(targetNode.prosperity + 4, 10, 100);
          faction.strengthEconomy = clamp(faction.strengthEconomy + 6, 20, 100);
          faction.stability = clamp(faction.stability + 1, 15, 100);
          faction.reputation = clamp(faction.reputation + 2, 0, 100);
          if (defender) {
            defender.strengthEconomy = clamp(defender.strengthEconomy - 4, 20, 100);
            defender.stability = clamp(defender.stability - 3, 15, 100);
            updateRelation(relations, faction.id, defender.id, -10, "资源线被截断，旧怨更深。");
            updateRelation(relations, defender.id, faction.id, -12, "命脉被掐，对方已成必防之敌。");
          }
          events.push(
            turnEvent(
              "resource_conflict",
              `${faction.name}截下${targetNode.name}资源线`,
              `${faction.name}围绕${resourceLabel}突然出手，把${targetNode.name}的重要供给抓进了自己手里。`,
              nextTurn,
              faction.id,
              defender?.id,
              2,
            ),
          );
        } else {
          faction.strengthEconomy = clamp(faction.strengthEconomy - 2, 20, 100);
          faction.stability = clamp(faction.stability - 2, 15, 100);
          if (defender) {
            defender.reputation = clamp(defender.reputation + 1, 0, 100);
            updateRelation(relations, faction.id, defender.id, -7, "抢夺财路失手，边线上又添一笔旧账。");
            updateRelation(relations, defender.id, faction.id, -5, "对方伸手抢线，这笔账已被记下。");
          }
          events.push(
            turnEvent(
              "resource_conflict",
              `${faction.name}争夺${targetNode.name}受挫`,
              `${faction.name}本想夺走${targetNode.name}的${resourceLabel}，却被对方及时守住。`,
              nextTurn,
              faction.id,
              defender?.id,
              1,
            ),
          );
        }
      }
    } else if (intent.type === "扩张" && intent.targetNodeId) {
      const targetNode = nodes.find((item) => item.id === intent.targetNodeId);
      const defender = targetNode?.ownerFactionId
        ? factions.find((item) => item.id === targetNode.ownerFactionId)
        : undefined;
      if (targetNode) {
        const attackScore =
          faction.strengthMilitary * 0.52 +
          faction.expansionDesire * 0.18 +
          faction.stability * 0.12 +
          Math.random() * 18;
        const defenseScore =
          (defender?.strengthMilitary || 42) * 0.44 +
          (defender?.stability || 46) * 0.2 +
          targetNode.danger * 0.16 +
          targetNode.prosperity * 0.08 +
          Math.random() * 14;

        if (attackScore >= defenseScore) {
          targetNode.ownerFactionId = faction.id;
          faction.stability = clamp(faction.stability + 2, 20, 95);
          faction.reputation = clamp(faction.reputation + 3, 0, 100);
          if (defender) {
            defender.stability = clamp(defender.stability - 4, 15, 95);
            updateRelation(relations, faction.id, defender.id, -12, "边线失守后仇怨加深。");
            updateRelation(relations, defender.id, faction.id, -12, "旧地被夺，双方正式结怨。");
          }
          events.push(
            turnEvent(
              "occupation",
              `${faction.name}夺下${targetNode.name}`,
              `${faction.name}借边线混乱压上前锋，最终把${targetNode.name}纳入势力范围。`,
              nextTurn,
              faction.id,
              defender?.id,
              2,
            ),
          );
        } else {
          faction.stability = clamp(faction.stability - 3, 15, 95);
          if (defender) {
            defender.reputation = clamp(defender.reputation + 2, 0, 100);
            updateRelation(relations, faction.id, defender.id, -8, "试探失手，边境杀气更盛。");
            updateRelation(relations, defender.id, faction.id, -6, "对方伸手过界，迟早要还。");
          }
          events.push(
            turnEvent(
              "border_skirmish",
              `${faction.name}试探${targetNode.name}未果`,
              `${faction.name}本想趁势拿下${targetNode.name}，却被守军顶住了锋头。`,
              nextTurn,
              faction.id,
              defender?.id,
              1,
            ),
          );
        }
      }
    } else if (intent.type === "追杀仇敌" && intent.targetFactionId) {
      const targetFaction = factions.find((item) => item.id === intent.targetFactionId);
      if (targetFaction) {
        const feudPressure = Math.abs(relations.get(buildRelationKey(faction.id, targetFaction.id))?.relationScore || -48);
        const attackScore =
          faction.strengthEspionage * 0.32 +
          faction.strengthMilitary * 0.22 +
          faction.aggression * 0.18 +
          feudPressure * 0.22 +
          Math.random() * 16;
        const defenseScore =
          targetFaction.strengthEspionage * 0.2 +
          targetFaction.strengthMilitary * 0.2 +
          targetFaction.stability * 0.24 +
          Math.random() * 14;

        if (attackScore >= defenseScore) {
          targetFaction.stability = clamp(targetFaction.stability - 6, 12, 100);
          targetFaction.reputation = clamp(targetFaction.reputation - 4, 0, 100);
          targetFaction.strengthMilitary = clamp(targetFaction.strengthMilitary - 3, 20, 100);
          faction.reputation = clamp(faction.reputation + 2, 0, 100);
          updateRelation(relations, faction.id, targetFaction.id, -14, "宿怨被重新翻出，双方只会越斗越深。");
          updateRelation(relations, targetFaction.id, faction.id, -12, "对方穷追不舍，双方已成死结。");
          events.push(
            turnEvent(
              "vendetta",
              `${faction.name}追索${targetFaction.name}旧怨`,
              `${faction.name}顺着旧仇摸出${targetFaction.name}外线破绽，对方一时难以抽身整队。`,
              nextTurn,
              faction.id,
              targetFaction.id,
              2,
            ),
          );
        } else {
          faction.stability = clamp(faction.stability - 3, 15, 100);
          targetFaction.reputation = clamp(targetFaction.reputation + 1, 0, 100);
          updateRelation(relations, faction.id, targetFaction.id, -8, "追索失手，旧仇又添新账。");
          updateRelation(relations, targetFaction.id, faction.id, -6, "对方追压未成，但仇已经更深。");
          events.push(
            turnEvent(
              "vendetta",
              `${faction.name}追击${targetFaction.name}失手`,
              `${faction.name}本想顺势逼住${targetFaction.name}，却被对方提前化开了杀机。`,
              nextTurn,
              faction.id,
              targetFaction.id,
              1,
            ),
          );
        }
      }
    } else if (intent.type === "清剿" && intent.targetFactionId) {
      const targetFaction = factions.find((item) => item.id === intent.targetFactionId);
      if (targetFaction) {
        const threatenedNode = nodes
          .filter(
            (node) =>
              node.ownerFactionId === faction.id &&
              node.neighborNodeIds.some((neighborId) => targetFaction.controlledNodeIds.includes(neighborId)),
          )
          .sort((left, right) => right.danger - left.danger)[0];
        faction.stability = clamp(faction.stability + 2, 15, 100);
        faction.reputation = clamp(faction.reputation + 1, 0, 100);
        targetFaction.strengthEspionage = clamp(targetFaction.strengthEspionage - 3, 20, 100);
        if (threatenedNode) {
          threatenedNode.danger = clamp(threatenedNode.danger - 6, 10, 100);
        }
        updateRelation(relations, faction.id, targetFaction.id, -6, "边线清剿后，双方杀意更明显。");
        updateRelation(relations, targetFaction.id, faction.id, -4, "对方沿线清剿，我方折了几处暗线。");
        events.push(
          turnEvent(
            "border_skirmish",
            `${faction.name}沿边清剿${targetFaction.name}`,
            `${faction.name}在边线上连拔数处暗线，暂时把${targetFaction.name}的渗透压了回去。`,
            nextTurn,
            faction.id,
            targetFaction.id,
            1,
          ),
        );
      }
    } else if (intent.type === "结盟" && intent.targetFactionId) {
      const targetFaction = factions.find((item) => item.id === intent.targetFactionId);
      if (targetFaction) {
        updateRelation(relations, faction.id, targetFaction.id, 18, "来往频密，盟意渐成。");
        updateRelation(relations, targetFaction.id, faction.id, 16, "双方交换筹码，关系升温。");
        faction.reputation = clamp(faction.reputation + 1, 0, 100);
        targetFaction.reputation = clamp(targetFaction.reputation + 1, 0, 100);
        const relationScore = relations.get(buildRelationKey(faction.id, targetFaction.id))?.relationScore || 0;
        events.push(
          turnEvent(
            relationScore >= 56 ? "alliance_accept" : "alliance_offer",
            `${faction.name}向${targetFaction.name}递出盟约`,
            `${faction.name}与${targetFaction.name}之间的关系明显回暖，边线火药味暂时压下。`,
            nextTurn,
            faction.id,
            targetFaction.id,
            1,
          ),
        );
      }
    } else if (intent.type === "经营") {
      faction.strengthEconomy = clamp(faction.strengthEconomy + 5, 20, 100);
      faction.stability = clamp(faction.stability + 2, 20, 100);
      const anchorNode = nodes.find((item) => faction.controlledNodeIds.includes(item.id));
      if (anchorNode) {
        anchorNode.prosperity = clamp(anchorNode.prosperity + 6, 10, 100);
      }
      events.push(
        turnEvent(
          "fortify",
          `${faction.name}整饬财路`,
          `${faction.name}没有急着动兵，而是先稳住账册、粮秣与门中补给。`,
          nextTurn,
          faction.id,
          undefined,
          1,
        ),
      );
    } else if (intent.type === "休养") {
      faction.stability = clamp(faction.stability + 7, 20, 100);
      faction.reputation = clamp(faction.reputation + 1, 0, 100);
      events.push(
        turnEvent(
          "fortify",
          `${faction.name}暂收兵锋`,
          `${faction.name}开始收拢外线修士，先把门中的裂缝一一补上。`,
          nextTurn,
          faction.id,
          undefined,
          1,
        ),
      );
    } else {
      faction.strengthHeritage = clamp(faction.strengthHeritage + 4, 20, 100);
      faction.strengthMilitary = clamp(faction.strengthMilitary + 2, 20, 100);
      faction.reputation = clamp(faction.reputation + 1, 0, 100);
      events.push(
        turnEvent(
          "training",
          `${faction.name}磨砺门下新秀`,
          `${faction.name}将本轮重心放在磨炼弟子与秘传功法上，准备为下一轮争锋蓄力。`,
          nextTurn,
          faction.id,
          undefined,
          1,
        ),
      );
    }

    const latestOwnEvent = [...events].reverse().find((event) => event.factionId === faction.id);
    if (latestOwnEvent) {
      faction.importantMemories = pushBounded(
        faction.importantMemories,
        `第${nextTurn}轮：${latestOwnEvent.title}`,
        6,
      );
    }

    faction.currentPlan = {
      summary: intent.summary,
      stance: decision?.reflection?.建议姿态 || intent.type,
      riskPreference: decision?.reflection?.风险偏好,
      priorities: decision?.reflection?.优先目标 || [],
      publicClaim: compactText(decision?.planning?.对外宣示, intent.summary),
      rationale: decision?.planning?.行动理由,
      usedPrompt: decision?.usedPrompt || false,
    };
    faction.lastExecutedAction = intent.type;
    faction.recentObservations = pushBounded(
      faction.recentObservations,
      compactText(decision?.reflection?.局势总评, intent.summary),
      6,
    );
    if (decision?.planning?.行动理由) {
      faction.importantMemories = pushBounded(
        faction.importantMemories,
        `${intent.type}理由：${decision.planning.行动理由}`,
        6,
      );
    }
    faction.strategicReflections = pushBounded(
      faction.strategicReflections,
      decision?.reflection
        ? `${decision.reflection.建议姿态}｜${decision.reflection.核心压力}｜${decision.reflection.局势总评}`
        : `${intent.type}：${intent.summary}`,
      5,
    );
    faction.playerFacingSummary = `${faction.name}现下气象为“${decision?.reflection?.建议姿态 || intent.type}”。${compactText(decision?.planning?.对外宣示, intent.summary)}`;
  }

  syncControlledNodeIds(factions, nodes);

  const ranking = [...factions].sort((left, right) => powerScore(right) - powerScore(left));
  const headlineEvents = events.slice(0, 4).map((event) => event.title).join("；");
  const newsSummary = headlineEvents
    ? `第${nextTurn}轮天下风云：${headlineEvents}。如今最强势力为${ranking[0]?.name || "未知势力"}。`
    : `第${nextTurn}轮天下风云暂平，各家都在酝酿下一步。`;

  await prisma.$transaction(async (tx) => {
    await tx.world.update({
      where: { id: worldId },
      data: {
        worldTurn: nextTurn,
        season: SEASONS[nextTurn % SEASONS.length],
        timePhase: TIME_PHASES[nextTurn % TIME_PHASES.length],
        newsSummary,
        summary: {
          headline: newsSummary,
          ranking: ranking.slice(0, 3).map((item) => item.name),
        },
      },
    });

    for (const faction of factions) {
      await tx.faction.update({
        where: { id: faction.id },
        data: {
          strengthMilitary: faction.strengthMilitary,
          strengthEconomy: faction.strengthEconomy,
          strengthEspionage: faction.strengthEspionage,
          strengthHeritage: faction.strengthHeritage,
          stability: faction.stability,
          reputation: faction.reputation,
          aggression: faction.aggression,
          expansionDesire: faction.expansionDesire,
          controlledNodeIds: faction.controlledNodeIds as Prisma.InputJsonValue,
          currentPlan: faction.currentPlan
            ? (faction.currentPlan as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          recentObservations: faction.recentObservations as Prisma.InputJsonValue,
          importantMemories: faction.importantMemories as Prisma.InputJsonValue,
          strategicReflections: faction.strategicReflections as Prisma.InputJsonValue,
          lastExecutedAction: faction.lastExecutedAction,
          playerFacingSummary: faction.playerFacingSummary,
        },
      });
    }

    for (const node of nodes) {
      await tx.mapNode.update({
        where: { id: node.id },
        data: {
          ownerFactionId: node.ownerFactionId,
          prosperity: node.prosperity,
          danger: node.danger,
        },
      });
    }

    for (const relation of relations.values()) {
      await tx.factionRelation.update({
        where: { id: relation.id },
        data: {
          relationType: relation.relationType,
          relationScore: relation.relationScore,
          lastReason: relation.lastReason,
        },
      });
    }

    for (const event of events) {
      await tx.worldEvent.create({
        data: {
          worldId,
          factionId: event.factionId,
          secondaryFactionId: event.secondaryFactionId,
          type: event.type,
          title: event.title,
          summary: event.summary,
          importance: event.importance,
          turn: event.turn,
          payload: event.payload,
        },
      });
    }
  });
}

export async function maybeAdvanceFactionWorldTurn(characterId: number, nextPlayerTurn: number) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { worldId: true },
  });

  if (!character?.worldId) {
    return;
  }

  if (nextPlayerTurn % WORLD_TURN_INTERVAL === 0) {
    await advanceFactionWorldTurn(character.worldId);
  }

  await ensureCharacterFactionMission(characterId);
}

function buildMissionFromLiveState(payload: FactionUiPayload): DraftMission {
  const hostile = payload.relations
    .filter((relation) => relation.fromFactionId === payload.playerFaction.id && relation.relationScore <= -18)
    .sort((left, right) => left.relationScore - right.relationScore)[0];
  const bloodFeud = payload.relations
    .filter((relation) => relation.fromFactionId === payload.playerFaction.id && relation.relationScore <= -52)
    .sort((left, right) => left.relationScore - right.relationScore)[0];
  const borderTargets = sortBorderTargets(
    payload.mapNodes.filter(
      (node) =>
        node.ownerFactionId !== payload.playerFaction.id &&
        node.neighborNodeIds.some((neighborId) => payload.playerFaction.controlledNodeIds.includes(neighborId)),
    ),
  );
  const borderTarget = borderTargets[0];
  const resourceTarget = [...borderTargets]
    .sort((left, right) => nodeResourceValue(right) - nodeResourceValue(left))
    .find((node) => nodeResourceValue(node) >= 32);

  if (bloodFeud) {
    return {
      title: "追查宿怨暗线",
      category: "复仇",
      description: `门中要你顺着旧怨摸出对头真正的破绽，为下一轮追索或反击做足铺垫。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 12,
      rewardTrust: 4,
      rewardMilitaryCredit: 2,
      rewardPoliticalStanding: 2,
      targetNodeId: payload.playerState.currentNodeId,
    };
  }

  if (resourceTarget && (payload.playerFaction.strengthEconomy < 64 || payload.playerFaction.expansionDesire >= 56)) {
    return {
      title: `踩清${resourceTarget.name}命脉`,
      category: "资源争夺",
      description: `${payload.playerFaction.name}盯上了${resourceTarget.name}的${resourceLineLabel(resourceTarget)}，你要先替门中摸透这条财路与守备。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 13,
      rewardTrust: 4,
      rewardMilitaryCredit: 2,
      rewardPoliticalStanding: 2,
      targetNodeId: resourceTarget.id,
    };
  }

  if (borderTarget && hostile) {
    return {
      title: `探清${borderTarget.name}虚实`,
      category: "扩张",
      description: `边境对峙已经压不住了。替${payload.playerFaction.name}摸清${borderTarget.name}一线的守备与弱点。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 13,
      rewardTrust: 4,
      rewardMilitaryCredit: 2,
      rewardPoliticalStanding: 1,
      targetNodeId: borderTarget.id,
    };
  }

  if (payload.playerFaction.stability < 52) {
    return {
      title: "稳住门中风声",
      category: "内政",
      description: `${payload.playerFaction.name}内部尚有裂缝，你要先替本帮稳住人心与外部传言。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 10,
      rewardTrust: 4,
      rewardMilitaryCredit: 1,
      rewardPoliticalStanding: 2,
      targetNodeId: payload.playerState.currentNodeId,
    };
  }

  if (hostile) {
    return {
      title: "放出试探风声",
      category: "外交",
      description: `替${payload.playerFaction.name}摸清敌对势力的反应，必要时借交流为本帮争到转圜。`,
      status: "ACTIVE",
      progress: 0,
      goal: 2,
      rewardContribution: 11,
      rewardTrust: 3,
      rewardMilitaryCredit: 1,
      rewardPoliticalStanding: 3,
      targetNodeId: payload.playerState.currentNodeId,
    };
  }

  return {
    title: "替本帮寻机缘",
    category: "修行",
    description: `${payload.playerFaction.name}希望你用一次漂亮的历练，为宗门和自己都攒下后手。`,
    status: "ACTIVE",
    progress: 0,
    goal: 2,
    rewardContribution: 11,
    rewardTrust: 3,
    rewardMilitaryCredit: 2,
    rewardPoliticalStanding: 1,
    targetNodeId: payload.playerState.currentNodeId,
  };
}

export async function ensureCharacterFactionMission(characterId: number) {
  const payload = await getFactionUiData(characterId);
  if (!payload) {
    return;
  }

  if (payload.activeMission && payload.activeMission.status === "ACTIVE") {
    return;
  }

  const draft = buildMissionFromLiveState(payload);
  const mission = await prisma.factionMission.create({
    data: {
      worldId: payload.world.id,
      factionId: payload.playerFaction.id,
      characterId,
      targetNodeId: draft.targetNodeId || null,
      title: draft.title,
      category: draft.category,
      description: draft.description,
      status: draft.status,
      progress: draft.progress,
      goal: draft.goal,
      rewardContribution: draft.rewardContribution,
      rewardTrust: draft.rewardTrust,
      rewardMilitaryCredit: draft.rewardMilitaryCredit,
      rewardPoliticalStanding: draft.rewardPoliticalStanding,
    },
  });

  await prisma.characterFactionState.update({
    where: { characterId },
    data: { activeMissionId: mission.id },
  });
}

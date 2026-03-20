import { Prisma } from "@/app/actions/generated/prisma";
import { cultivationLevels, CultivationLevel } from "@/interfaces/const";
import {
  BondChatResponseType,
  bondChatResponseSchema,
  BondWishStructType,
  bondWishStructSchema,
  CharacterStatusSchema,
  CharacterStatusType,
} from "@/interfaces/schemas";
import { BondChatResult, BondType, BondUiPayload, BondWishView, CharacterBondView } from "@/interfaces/bond";
import { prisma } from "@/lib/prisma";
import { ConfigService } from "@/utils/config-client";
import { createModelFromConfig, getProviderOptions } from "@/utils/modelAdapter";
import { ramdomFirstName, ramdomLastName } from "@/utils/ramdom";
import { stableGenerateObject } from "@/utils/stableGenerateObject";

type DbClient = Prisma.TransactionClient | typeof prisma;

const DAO_LU = "DAO_LU";
const DISCIPLE = "DISCIPLE";
const STAGE_CANDIDATE = "CANDIDATE";
const STAGE_ACTIVE = "ACTIVE";
const STAGE_ARCHIVED = "ARCHIVED";
const WISH_ACTIVE = "ACTIVE";
const WISH_FULFILLED = "FULFILLED";
const DISCIPLE_REFRESH_INTERVAL = 5;
const DISCIPLE_CANDIDATE_COUNT = 3;

const DAO_LU_VIBES = [
  "清冷",
  "温柔",
  "嘴硬心软",
  "狐系",
  "师姐气",
  "知性",
  "黏人",
  "危险又体面",
] as const;

const TRAIT_POOL = [
  "记仇但护短",
  "嘴上刻薄手上细",
  "夜里不睡爱守灯",
  "见事先笑再出刀",
  "喜欢拿袖口试探人心",
  "越紧张越爱装平静",
  "表面清冷私下会哄人",
  "说话爱留半句后手",
] as const;

const DISCIPLE_ARCHETYPES = [
  {
    title: "山门晚辈",
    origin: "从偏峰杂役里硬闯出来，胆气不小，眼神也不肯低下去。",
    traits: ["倔", "能挨", "认死理"],
    quirks: ["写战报总爱押韵", "打坐前一定要先擦剑", "见谁都想请教半招"],
  },
  {
    title: "坊市散修",
    origin: "在坊市摸爬滚打多年，练出的不是圆滑，是一身躲祸求活的本事。",
    traits: ["财迷", "机灵", "脸皮厚"],
    quirks: ["总把灵石藏在鞋底", "嘴上喊穷手里永远有货", "见到便宜货会走不动路"],
  },
  {
    title: "落魄世家子",
    origin: "家道中落后一路辗转，骨子里还留着几分不肯服输的旧气。",
    traits: ["好胜", "要脸", "死扛"],
    quirks: ["挨打也要把衣襟理平", "说到祖上传承就眼红", "爱偷偷练到半夜"],
  },
  {
    title: "戏班遗脉",
    origin: "从戏班里练出身段和眼力，看人比看剑还准。",
    traits: ["会察言观色", "爱表现", "心思细"],
    quirks: ["动手前总先整衣领", "爱给法器起怪名字", "紧张时会自己给自己报幕"],
  },
] as const;

const DISCIPLE_REALMS: Record<CultivationLevel, CultivationLevel> = {
  炼气: "炼气",
  筑基: "炼气",
  金丹: "筑基",
  元婴: "金丹",
  化神: "元婴",
  炼虚: "化神",
  合体: "炼虚",
  渡劫: "合体",
  真仙: "渡劫",
};

function asStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map((item) => String(item)).filter(Boolean) : [];
}

function compactText(input: unknown, fallback = "") {
  const normalized = String(input ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function sampleUnique(items: readonly string[], count: number) {
  const pool = [...items];
  const selected: string[] = [];
  while (pool.length && selected.length < count) {
    const index = Math.floor(Math.random() * pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }
  return selected;
}

function getLevelIndex(level: CultivationLevel) {
  return cultivationLevels.indexOf(level);
}

function isLevelAtLeast(level: CultivationLevel, required: CultivationLevel) {
  return getLevelIndex(level) >= getLevelIndex(required);
}

function getDiscipleSlotCount(level: CultivationLevel) {
  if (isLevelAtLeast(level, "炼虚")) {
    return 4;
  }
  if (isLevelAtLeast(level, "化神")) {
    return 3;
  }
  if (isLevelAtLeast(level, "元婴")) {
    return 2;
  }
  if (isLevelAtLeast(level, "金丹")) {
    return 1;
  }
  return 0;
}

function getCurrentTurn(status: CharacterStatusType) {
  return Math.max(0, 50 - status.行动点);
}

function inferPreferredGender(wishText: string) {
  if (/(姐姐|师姐|仙子|她|姑娘|少女|女修)/.test(wishText)) {
    return "女";
  }
  if (/(哥哥|师兄|公子|他|少年|男修)/.test(wishText)) {
    return "男";
  }
  return Math.random() < 0.5 ? "女" : "男";
}

function inferWishStructHeuristically(wishText: string): BondWishStructType {
  const vibeKeywords = ["清冷", "温柔", "师姐", "师兄", "狐系", "黏人", "知性", "危险", "体贴", "嘴硬心软"];
  const traitKeywords = ["会照顾人", "嘴硬心软", "会撩", "爱吃醋", "稳重", "聪明", "毒舌", "乖", "疯", "护短"];
  const sceneKeywords = ["并肩", "雨夜", "喝酒", "下棋", "双修", "夜谈", "秘境", "飞舟", "守灯", "并行"];
  const desiredVibe = vibeKeywords.filter((item) => wishText.includes(item));
  const desiredTraits = traitKeywords.filter((item) => wishText.includes(item));
  const desiredScenes = sceneKeywords.filter((item) => wishText.includes(item));
  const adultTone = /(擦边|暧昧|会撩|黏人|身材|诱|勾人|撩)/.test(wishText);
  const jokeTolerance = /(整活|恶搞|沙雕|抽象)/.test(wishText)
    ? "高"
    : /(正经|别太闹|安静)/.test(wishText)
      ? "低"
      : "中";

  return {
    desiredVibe,
    desiredTraits,
    desiredScenes,
    adultTone,
    jokeTolerance,
  };
}

async function parseWishStruct(wishText: string): Promise<BondWishStructType> {
  const fallback = inferWishStructHeuristically(wishText);
  const config = await ConfigService.getConfig("bond_generation_prompt");
  if (!config?.model) {
    return fallback;
  }

  try {
    const modelInstance = createModelFromConfig(config.model);
    const providerOptions = getProviderOptions(config.model, config);
    const { object } = await stableGenerateObject({
      model: modelInstance(config.model.name),
      providerOptions,
      schema: bondWishStructSchema,
      system: config.systemPrompt || "",
      prompt: (config.userPrompt || "{WISH_TEXT}")
        .replace(/\{WISH_TEXT\}/g, wishText)
        .replace(/\{FALLBACK_HINT\}/g, JSON.stringify(fallback)),
      promptTemplate: "bond_generation_prompt",
    });
    return bondWishStructSchema.parse(object);
  } catch {
    return fallback;
  }
}

function buildDaoLyuActorDraft(level: CultivationLevel, wish: BondWishStructType, rawWish: string) {
  const gender = inferPreferredGender(rawWish);
  const vibe = wish.desiredVibe.length ? wish.desiredVibe : sampleUnique(DAO_LU_VIBES, 2);
  const publicTraits = wish.desiredTraits.length ? wish.desiredTraits : sampleUnique(TRAIT_POOL, 3);
  const speakingStyle = vibe.includes("清冷")
    ? "字少，却总能在你最狼狈时把话说到心口上。"
    : vibe.includes("温柔")
      ? "声线温缓，像是先替你想过了退路。"
      : "表面漫不经心，真正开口时分寸拿得很准。";

  return {
    bondType: DAO_LU,
    name: `${ramdomFirstName()}${ramdomLastName()}`,
    title: vibe.includes("师姐") ? "旧宗来客" : vibe.includes("师兄") ? "同路修士" : "命里来人",
    gender,
    age: 20 + Math.floor(Math.random() * 12),
    realm: level,
    appearance: `${pick(vibe)}的气质先落在眼里，衣襟收得利落，眸色沉静，却总在看向你时多停一瞬。`,
    originSummary: `你曾许愿想遇到一个${compactText(rawWish, "能与你并肩走很远的人")}。此人像是顺着这份愿望，被因果慢慢推到了你面前。`,
    personalityTags: vibe,
    publicTraits,
    hiddenTraits: wish.adultTone ? ["擅长在沉默里试探距离"] : ["把情绪藏得比刀锋还深"],
    speakingStyle,
    adultContentEnabled: wish.adultTone,
    summary: `你还没真正与此人走到命定一线，但风声和因果已经把对方推到了你身边。`,
    label: "天命道侣",
    intimacy: 18,
    trust: 52,
    loyalty: 58,
    destiny: 72,
    mood: "试探",
  };
}

function buildDiscipleActorDraft(level: CultivationLevel) {
  const archetype = pick(DISCIPLE_ARCHETYPES);
  const publicTraits = sampleUnique(
    [...archetype.traits, ...archetype.quirks, "嘴快", "护短", "脸皮厚", "会记人情", "偷练", "爱抬杠"],
    3,
  );
  const hiddenTraits = sampleUnique(archetype.quirks, 1);
  return {
    bondType: DISCIPLE,
    name: `${ramdomFirstName()}${ramdomLastName()}`,
    title: archetype.title,
    gender: Math.random() < 0.5 ? "男" : "女",
    age: 18 + Math.floor(Math.random() * 9),
    realm: DISCIPLE_REALMS[level],
    appearance: "衣着还带着未定下来的寒酸与倔气，眼神却已经先把退路烧干净了。",
    originSummary: archetype.origin,
    personalityTags: archetype.traits,
    publicTraits,
    hiddenTraits,
    speakingStyle: "说话直，遇到不服的事会先顶一句，再偷偷把该做的都做完。",
    adultContentEnabled: false,
    summary: `此人有点毛病，也有点狠劲，像是一块没打磨开的好材料。`,
    label: "候选弟子",
    intimacy: 0,
    trust: 32,
    loyalty: 38,
    destiny: 20,
    mood: "观望",
  };
}

function serializeWish(wish: {
  id: number;
  wishType: string;
  rawWish: string;
  status: string;
  targetEncounterTurn: number | null;
  fulfilledBondId: number | null;
  structuredWish: Prisma.JsonValue | null;
}): BondWishView {
  const structured = wish.structuredWish && typeof wish.structuredWish === "object"
    ? bondWishStructSchema.safeParse(wish.structuredWish).data
    : undefined;
  return {
    id: wish.id,
    wishType: wish.wishType as BondType,
    rawWish: wish.rawWish,
    status: wish.status,
    targetEncounterTurn: wish.targetEncounterTurn ?? undefined,
    fulfilledBondId: wish.fulfilledBondId ?? undefined,
    structuredWish: structured,
  };
}

function serializeBond(bond: {
  id: number;
  bondType: string;
  stage: string;
  status: string;
  slotIndex: number | null;
  label: string;
  intimacy: number;
  trust: number;
  loyalty: number;
  destiny: number;
  mood: string;
  summary: string | null;
  introducedAtTurn: number | null;
  lastInteractionTurn: number | null;
  nextEventTurn: number | null;
  actor: {
    id: number;
    bondType: string;
    name: string;
    title: string | null;
    gender: string;
    age: number;
    realm: string;
    appearance: string;
    originSummary: string;
    personalityTags: Prisma.JsonValue;
    publicTraits: Prisma.JsonValue;
    hiddenTraits: Prisma.JsonValue | null;
    speakingStyle: string;
    adultContentEnabled: boolean;
  };
  memories: Array<{
    id: number;
    sourceType: string;
    summary: string;
    mood: string | null;
    importance: number;
    createdAt: Date;
    payload: Prisma.JsonValue | null;
  }>;
}): CharacterBondView {
  return {
    id: bond.id,
    bondType: bond.bondType as BondType,
    stage: bond.stage as CharacterBondView["stage"],
    status: bond.status,
    slotIndex: bond.slotIndex ?? undefined,
    label: bond.label,
    intimacy: bond.intimacy,
    trust: bond.trust,
    loyalty: bond.loyalty,
    destiny: bond.destiny,
    mood: bond.mood,
    summary: bond.summary ?? undefined,
    introducedAtTurn: bond.introducedAtTurn ?? undefined,
    lastInteractionTurn: bond.lastInteractionTurn ?? undefined,
    nextEventTurn: bond.nextEventTurn ?? undefined,
    actor: {
      id: bond.actor.id,
      bondType: bond.actor.bondType as BondType,
      name: bond.actor.name,
      title: bond.actor.title ?? undefined,
      gender: bond.actor.gender,
      age: bond.actor.age,
      realm: bond.actor.realm,
      appearance: bond.actor.appearance,
      originSummary: bond.actor.originSummary,
      personalityTags: asStringArray(bond.actor.personalityTags),
      publicTraits: asStringArray(bond.actor.publicTraits),
      hiddenTraits: asStringArray(bond.actor.hiddenTraits),
      speakingStyle: bond.actor.speakingStyle,
      adultContentEnabled: bond.actor.adultContentEnabled,
    },
    memories: bond.memories.map((memory) => {
      const payload = memory.payload && typeof memory.payload === "object" ? memory.payload as Record<string, unknown> : {};
      return {
        id: memory.id,
        sourceType: memory.sourceType,
        summary: memory.summary,
        mood: memory.mood ?? undefined,
        importance: memory.importance,
        createdAt: memory.createdAt.toISOString(),
        payload: {
          user: typeof payload.user === "string" ? payload.user : undefined,
          bond: typeof payload.bond === "string" ? payload.bond : undefined,
        },
      };
    }),
  };
}

async function createBondActorWithRelation(
  db: DbClient,
  characterId: number,
  draft: ReturnType<typeof buildDaoLyuActorDraft> | ReturnType<typeof buildDiscipleActorDraft>,
  turn: number,
  stage: string,
  slotIndex?: number,
) {
  const actor = await db.bondActor.create({
    data: {
      characterId,
      bondType: draft.bondType,
      name: draft.name,
      title: draft.title,
      gender: draft.gender,
      age: draft.age,
      realm: draft.realm,
      appearance: draft.appearance,
      originSummary: draft.originSummary,
      personalityTags: draft.personalityTags,
      publicTraits: draft.publicTraits,
      hiddenTraits: draft.hiddenTraits,
      speakingStyle: draft.speakingStyle,
      adultContentEnabled: draft.adultContentEnabled,
    },
  });

  return db.characterBond.create({
    data: {
      characterId,
      actorId: actor.id,
      bondType: draft.bondType,
      stage,
      status: "ACTIVE",
      slotIndex,
      label: draft.label,
      intimacy: draft.intimacy,
      trust: draft.trust,
      loyalty: draft.loyalty,
      destiny: draft.destiny,
      mood: draft.mood,
      summary: draft.summary,
      introducedAtTurn: turn,
      lastInteractionTurn: turn,
      nextEventTurn: draft.bondType === DISCIPLE ? turn + DISCIPLE_REFRESH_INTERVAL : turn + 3,
    },
  });
}

async function addBondMemory(
  db: DbClient,
  bondId: number,
  sourceType: string,
  summary: string,
  mood?: string,
  importance = 1,
  payload?: Prisma.InputJsonValue,
) {
  await db.bondMemory.create({
    data: {
      bondId,
      sourceType,
      summary,
      mood,
      importance,
      payload,
    },
  });
}

async function loadRuntime(characterId: number, db: DbClient) {
  return db.character.findUnique({
    where: { id: characterId },
    include: {
      currentPush: true,
      bonds: {
        include: {
          actor: true,
          memories: {
            orderBy: { createdAt: "desc" },
            take: 6,
          },
        },
        orderBy: [{ updatedAt: "desc" }],
      },
      bondWishes: {
        orderBy: [{ updatedAt: "desc" }],
      },
    },
  });
}

async function fulfillDaoLyuWish(
  db: DbClient,
  characterId: number,
  level: CultivationLevel,
  turn: number,
  wish: {
    id: number;
    rawWish: string;
    structuredWish: Prisma.JsonValue | null;
  },
) {
  const parsedWish = wish.structuredWish && typeof wish.structuredWish === "object"
    ? bondWishStructSchema.safeParse(wish.structuredWish).data
    : undefined;
  const draft = buildDaoLyuActorDraft(level, parsedWish || inferWishStructHeuristically(wish.rawWish), wish.rawWish);
  const bond = await createBondActorWithRelation(db, characterId, draft, turn, STAGE_ACTIVE);
  await addBondMemory(
    db,
    bond.id,
    "SYSTEM",
    `${draft.name}顺着你许下的愿望出现，自此与你结成了一段说不清来历、却很难撇开的道缘。`,
    "试探",
    3,
  );
  await db.bondWish.update({
    where: { id: wish.id },
    data: {
      status: WISH_FULFILLED,
      fulfilledBondId: bond.id,
    },
  });
}

async function refreshDiscipleCandidates(
  db: DbClient,
  characterId: number,
  level: CultivationLevel,
  turn: number,
  existingCandidates: Array<{ id: number }>,
) {
  if (existingCandidates.length) {
    await db.characterBond.updateMany({
      where: { id: { in: existingCandidates.map((item) => item.id) } },
      data: { stage: STAGE_ARCHIVED, status: "EXPIRED" },
    });
  }

  for (let index = 0; index < DISCIPLE_CANDIDATE_COUNT; index += 1) {
    const draft = buildDiscipleActorDraft(level);
    const bond = await createBondActorWithRelation(db, characterId, draft, turn, STAGE_CANDIDATE);
    await addBondMemory(
      db,
      bond.id,
      "SYSTEM",
      `${draft.name}出现在门墙之外，像是下一批会被你亲手挑中的苗子之一。`,
      "观望",
      1,
    );
  }
}

async function ensureBondRuntimeStateInternal(
  characterId: number,
  db: DbClient,
  overrideTurn?: number,
) {
  const runtime = await loadRuntime(characterId, db);
  if (!runtime?.currentPush?.status) {
    return runtime;
  }

  const statusResult = CharacterStatusSchema.safeParse(runtime.currentPush.status);
  if (!statusResult.success) {
    return runtime;
  }

  const status = statusResult.data;
  const level = status.等级;
  const turn = overrideTurn ?? getCurrentTurn(status);

  const activeDaoLyu = runtime.bonds.find((bond) => bond.bondType === DAO_LU && bond.stage === STAGE_ACTIVE);
  const activeWish = runtime.bondWishes.find((wish) => wish.wishType === DAO_LU && wish.status === WISH_ACTIVE);
  if (activeWish && !activeDaoLyu) {
    if (!activeWish.targetEncounterTurn) {
      await db.bondWish.update({
        where: { id: activeWish.id },
        data: { targetEncounterTurn: turn + 2 + Math.floor(Math.random() * 5) },
      });
    } else if (activeWish.targetEncounterTurn <= turn) {
      await fulfillDaoLyuWish(db, characterId, level, turn, activeWish);
    }
  }

  if (isLevelAtLeast(level, "金丹")) {
    const candidates = runtime.bonds.filter((bond) => bond.bondType === DISCIPLE && bond.stage === STAGE_CANDIDATE);
    const shouldRefresh =
      candidates.length === 0 ||
      candidates.every((bond) => (bond.introducedAtTurn ?? turn) <= turn - DISCIPLE_REFRESH_INTERVAL);
    if (shouldRefresh) {
      await refreshDiscipleCandidates(db, characterId, level, turn, candidates);
    }
  }

  return loadRuntime(characterId, db);
}

function buildHighlights(
  activeDaoLyu?: CharacterBondView,
  activeDisciples: CharacterBondView[] = [],
  candidates: CharacterBondView[] = [],
  wish?: BondWishView,
) {
  const highlights: string[] = [];
  if (activeDaoLyu) {
    highlights.push(`${activeDaoLyu.actor.name}此刻与你的气氛偏“${activeDaoLyu.mood}”。`);
  } else if (wish?.targetEncounterTurn) {
    highlights.push(`你许下的道侣愿望将在第${wish.targetEncounterTurn}回合前后应验。`);
  }
  if (activeDisciples.length) {
    highlights.push(`门下现有${activeDisciples.length}名弟子在跟着你长见识。`);
  } else if (candidates.length) {
    highlights.push(`门墙外已有${candidates.length}名候选晚辈在等你点头。`);
  }
  if (!highlights.length) {
    highlights.push("你的命里还没有哪段关系真正落定，但风声已经开始动了。");
  }
  return highlights;
}

export async function getBondUiData(characterId: number, db: DbClient = prisma): Promise<BondUiPayload | undefined> {
  const runtime = await ensureBondRuntimeStateInternal(characterId, db);
  if (!runtime?.currentPush?.status) {
    return undefined;
  }

  const statusResult = CharacterStatusSchema.safeParse(runtime.currentPush.status);
  if (!statusResult.success) {
    return undefined;
  }

  const status = statusResult.data;
  const level = status.等级;
  const discipleSlots = getDiscipleSlotCount(level);
  const activeWish = runtime.bondWishes.find((wish) => wish.wishType === DAO_LU && wish.status === WISH_ACTIVE);
  const activeDaoLyu = runtime.bonds.find((bond) => bond.bondType === DAO_LU && bond.stage === STAGE_ACTIVE);
  const activeDisciples = runtime.bonds.filter((bond) => bond.bondType === DISCIPLE && bond.stage === STAGE_ACTIVE);
  const discipleCandidates = runtime.bonds.filter((bond) => bond.bondType === DISCIPLE && bond.stage === STAGE_CANDIDATE);

  const serializedDaoLyu = activeDaoLyu ? serializeBond(activeDaoLyu) : undefined;
  const serializedWish = activeWish ? serializeWish(activeWish) : undefined;
  const serializedDisciples = activeDisciples.map(serializeBond);
  const serializedCandidates = discipleCandidates.map(serializeBond);

  return {
    overview: {
      hasDaoLyu: Boolean(serializedDaoLyu),
      discipleSlots,
      disciplesUsed: serializedDisciples.length,
      canWishForDaoLyu: isLevelAtLeast(level, "筑基") && !serializedDaoLyu && !serializedWish,
      canRecruitDisciples: discipleSlots > serializedDisciples.length,
      nextMajorEvent: serializedDaoLyu
        ? `${serializedDaoLyu.actor.name}常伴左右`
        : serializedWish?.targetEncounterTurn
          ? `第${serializedWish.targetEncounterTurn}回合前后，愿中之人会出现`
          : isLevelAtLeast(level, "筑基")
            ? "筑基已成，可以试着向天道许一个人"
            : "先把修为撑到筑基，道缘才会真正松动",
      nextRefreshHint: discipleSlots
        ? serializedCandidates.length
          ? `候选弟子将在约${DISCIPLE_REFRESH_INTERVAL}回合后重整一轮`
          : "门墙外尚无人叩门"
        : "金丹后方可正式收徒",
    },
    activeDaoLyu: serializedDaoLyu,
    activeWish: serializedWish,
    activeDisciples: serializedDisciples,
    discipleCandidates: serializedCandidates,
    recentHighlights: buildHighlights(serializedDaoLyu, serializedDisciples, serializedCandidates, serializedWish),
  };
}

export async function maybeAdvanceBondWorld(
  characterId: number,
  nextTurn: number,
) {
  await ensureBondRuntimeStateInternal(characterId, prisma, nextTurn);
}

export async function getBondNarrativeContext(characterId: number) {
  const payload = await getBondUiData(characterId);
  if (!payload) {
    return undefined;
  }

  const daoLyuSummary = payload.activeDaoLyu
    ? `${payload.activeDaoLyu.actor.name}（${payload.activeDaoLyu.label}）如今常在你身边，眼下情绪偏${payload.activeDaoLyu.mood}。${payload.activeDaoLyu.summary || payload.activeDaoLyu.actor.originSummary}`
    : payload.activeWish
      ? `你曾在突破后许下道侣心愿：${payload.activeWish.rawWish}。缘分尚未落定，但可以通过见闻、流言、同路人与因果暗线慢慢逼近。`
      : "眼下还没有真正落定的道侣关系。";

  const discipleSummary = payload.activeDisciples.length
    ? payload.activeDisciples
      .map((item) => `${item.actor.name}（${item.actor.realm}，${item.mood}）`)
      .join("；")
    : payload.discipleCandidates.length
      ? `门墙外已有${payload.discipleCandidates.length}名候选晚辈在观望。`
      : "门下尚无值得点名的弟子。";

  return {
    RELATIONSHIP_SUMMARY: `${daoLyuSummary}\n${discipleSummary}`,
    RELATIONSHIP_RULES: [
      "不要直接暴露亲密、信任、忠诚等隐藏数值。",
      "通过插话、陪行、来信、汇报、吃醋、护短、顶嘴、试探等方式侧写关系。",
      "道侣应当像长期陪伴者，而不是一次性彩蛋。",
      "弟子应当有性格和毛病，不要写成没有记忆点的背景板。",
    ].join("\n"),
  };
}

export async function submitDaoLyuWish(characterId: number, rawWish: string) {
  const runtime = await loadRuntime(characterId, prisma);
  if (!runtime?.currentPush?.status) {
    throw new Error("角色状态不存在");
  }
  const statusResult = CharacterStatusSchema.safeParse(runtime.currentPush.status);
  if (!statusResult.success) {
    throw new Error("角色状态解析失败");
  }
  if (!isLevelAtLeast(statusResult.data.等级, "筑基")) {
    throw new Error("筑基后方可向道缘许愿");
  }
  if (!compactText(rawWish)) {
    throw new Error("愿望不能为空");
  }
  const hasDaoLyu = runtime.bonds.some((bond) => bond.bondType === DAO_LU && bond.stage === STAGE_ACTIVE);
  if (hasDaoLyu) {
    throw new Error("已有道侣，无需再次许愿");
  }

  const structured = await parseWishStruct(rawWish);
  const turn = getCurrentTurn(statusResult.data);
  await prisma.bondWish.updateMany({
    where: { characterId, wishType: DAO_LU, status: WISH_ACTIVE },
    data: { status: STAGE_ARCHIVED },
  });
  await prisma.bondWish.create({
    data: {
      characterId,
      wishType: DAO_LU,
      rawWish: compactText(rawWish),
      structuredWish: structured,
      status: WISH_ACTIVE,
      targetEncounterTurn: turn + 2 + Math.floor(Math.random() * 5),
    },
  });
  return getBondUiData(characterId);
}

export async function acceptDiscipleCandidate(characterId: number, bondId: number) {
  const payload = await getBondUiData(characterId);
  if (!payload) {
    throw new Error("关系面板尚未准备好");
  }
  if (!payload.overview.canRecruitDisciples) {
    throw new Error("当前没有可用弟子槽位");
  }

  const candidate = await prisma.characterBond.findFirst({
    where: {
      id: bondId,
      characterId,
      bondType: DISCIPLE,
      stage: STAGE_CANDIDATE,
    },
  });
  if (!candidate) {
    throw new Error("候选弟子不存在");
  }

  const occupied = new Set(payload.activeDisciples.map((item) => item.slotIndex).filter((item): item is number => typeof item === "number"));
  let slotIndex = 1;
  while (occupied.has(slotIndex)) {
    slotIndex += 1;
  }

  await prisma.characterBond.update({
    where: { id: bondId },
    data: {
      stage: STAGE_ACTIVE,
      slotIndex,
      label: slotIndex === 1 ? "首徒" : `门下弟子${slotIndex}`,
      trust: clamp(candidate.trust + 12, 0, 100),
      loyalty: clamp(candidate.loyalty + 16, 0, 100),
      summary: "你已正式点头收下此人，对方开始以你的名义行走和受训。",
    },
  });
  await addBondMemory(prisma, bondId, "SYSTEM", "你点头收徒，对方从候选晚辈正式成了门下弟子。", "敬服", 2);

  return getBondUiData(characterId);
}

export async function dismissDiscipleCandidate(characterId: number, bondId: number) {
  const candidate = await prisma.characterBond.findFirst({
    where: {
      id: bondId,
      characterId,
      bondType: DISCIPLE,
      stage: STAGE_CANDIDATE,
    },
  });
  if (!candidate) {
    throw new Error("候选弟子不存在");
  }
  await prisma.characterBond.update({
    where: { id: bondId },
    data: {
      stage: STAGE_ARCHIVED,
      status: "DISMISSED",
      summary: "这段师徒缘分没有真正落地。",
    },
  });
  return getBondUiData(characterId);
}

function buildFallbackChatResult(message: string, bond: CharacterBondView): BondChatResult {
  const trimmed = compactText(message, "你没有说出口的话");
  return {
    reply: `${bond.actor.name}听完后沉了片刻，低声道：“${trimmed.slice(0, 22)}……我记住了。你若真要走这一步，我陪着你。”`,
    mood: bond.bondType === DAO_LU ? "靠近" : "认真",
    relationshipSummary: bond.bondType === DAO_LU ? "你们之间的距离比方才更近了一寸。" : "对方把你的话记得很重，敬意也更实了一层。",
    memorySummary: `你与${bond.actor.name}谈及“${trimmed.slice(0, 18)}”，彼此的态度都比先前更明朗。`,
    intimacyDelta: bond.bondType === DAO_LU ? 2 : 0,
    trustDelta: 2,
    loyaltyDelta: bond.bondType === DISCIPLE ? 2 : 0,
    destinyDelta: bond.bondType === DAO_LU ? 1 : 0,
  };
}

export async function sendBondChatMessage(characterId: number, bondId: number, message: string) {
  const payload = await getBondUiData(characterId);
  const bond = payload?.activeDaoLyu?.id === bondId
    ? payload.activeDaoLyu
    : payload?.activeDisciples.find((item) => item.id === bondId);
  if (!bond) {
    throw new Error("当前只能与已建立关系的对象对话");
  }
  if (!compactText(message)) {
    throw new Error("说点什么再开口");
  }

  const recentMemories = bond.memories
    .slice(0, 6)
    .map((item) => `- ${item.summary}`)
    .join("\n");
  const fallback = buildFallbackChatResult(message, bond);
  const config = await ConfigService.getConfig("bond_chat_prompt");
  let result: BondChatResponseType = fallback;

  if (config?.model) {
    try {
      const modelInstance = createModelFromConfig(config.model);
      const providerOptions = getProviderOptions(config.model, config);
      const prompt = (config.userPrompt || "{PLAYER_MESSAGE}")
        .replace(/\{PLAYER_MESSAGE\}/g, message)
        .replace(/\{BOND_PROFILE\}/g, JSON.stringify(bond.actor))
        .replace(/\{BOND_STATE\}/g, JSON.stringify({
          bondType: bond.bondType,
          label: bond.label,
          mood: bond.mood,
          intimacy: bond.intimacy,
          trust: bond.trust,
          loyalty: bond.loyalty,
          destiny: bond.destiny,
        }))
        .replace(/\{RECENT_MEMORIES\}/g, recentMemories || "暂无最近记忆")
        .replace(/\{FALLBACK_HINT\}/g, JSON.stringify(fallback));
      const { object } = await stableGenerateObject({
        model: modelInstance(config.model.name),
        providerOptions,
        schema: bondChatResponseSchema,
        system: config.systemPrompt || "",
        prompt,
        promptTemplate: "bond_chat_prompt",
      });
      result = bondChatResponseSchema.parse(object);
    } catch {
      result = fallback;
    }
  }

  await prisma.characterBond.update({
    where: { id: bondId },
    data: {
      mood: compactText(result.mood, bond.mood),
      summary: compactText(result.relationshipSummary, bond.summary || ""),
      intimacy: clamp(bond.intimacy + result.intimacyDelta, 0, 100),
      trust: clamp(bond.trust + result.trustDelta, 0, 100),
      loyalty: clamp(bond.loyalty + result.loyaltyDelta, 0, 100),
      destiny: clamp(bond.destiny + result.destinyDelta, 0, 100),
      lastInteractionTurn: bond.lastInteractionTurn ? bond.lastInteractionTurn + 1 : 1,
    },
  });
  await addBondMemory(
    prisma,
    bondId,
    "CHAT",
    compactText(result.memorySummary, fallback.memorySummary),
    compactText(result.mood, bond.mood),
    2,
    {
      user: compactText(message),
      bond: compactText(result.reply, fallback.reply),
    },
  );

  return {
    result: {
      reply: compactText(result.reply, fallback.reply),
      mood: compactText(result.mood, bond.mood),
      relationshipSummary: compactText(result.relationshipSummary, fallback.relationshipSummary),
      memorySummary: compactText(result.memorySummary, fallback.memorySummary),
      intimacyDelta: result.intimacyDelta,
      trustDelta: result.trustDelta,
      loyaltyDelta: result.loyaltyDelta,
      destinyDelta: result.destinyDelta,
    },
    bondData: await getBondUiData(characterId),
  };
}

import { Prisma } from "@/app/actions/generated/prisma";
import { cultivationLevels, CultivationLevel } from "@/interfaces/const";
import {
  BondChatResponseType,
  bondChatResponseSchema,
  BondEventResponseType,
  bondEventResponseSchema,
  BondWishStructType,
  bondWishStructSchema,
  CharacterStatusSchema,
  CharacterStatusType,
} from "@/interfaces/schemas";
import {
  BondChatResult,
  BondEventView,
  BondProgressStage,
  BondTimelineEntryView,
  BondType,
  BondUiPayload,
  BondWishView,
  CharacterBondView,
} from "@/interfaces/bond";
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
const DAO_LU_EVENT_INTERVAL = 3;
const DISCIPLE_EVENT_INTERVAL = 4;

type JokeTolerance = BondWishStructType["jokeTolerance"];

type EventBlueprint = {
  key: string;
  title: string;
  summary: string;
  storyHook: string;
  mood: string;
  relationshipSummary: string;
  memorySummary: string;
  intimacyDelta: number;
  trustDelta: number;
  loyaltyDelta: number;
  destinyDelta: number;
  requiresAdultTone?: boolean;
  minJokeTolerance?: JokeTolerance;
  preferredScenes?: readonly string[];
  preferredMoods?: readonly string[];
};

type EventTreeNode = {
  key: string;
  label: string;
  weight?: number;
  requiresAdultTone?: boolean;
  minJokeTolerance?: JokeTolerance;
  preferredScenes?: readonly string[];
  preferredMoods?: readonly string[];
  allowedProgressStages?: readonly BondProgressStage[];
  children?: readonly EventTreeNode[];
  blueprints?: readonly EventBlueprint[];
};

type EventSelection = {
  blueprint: EventBlueprint;
  branchPath: string[];
};

type BondFlavorProfile = {
  adultTone: boolean;
  jokeTolerance: JokeTolerance;
  desiredScenes: string[];
};

const DAO_LYU_PROGRESS_STAGES = ["初识", "牵丝", "相偎", "缠心", "同契"] as const;
const DISCIPLE_PROGRESS_STAGES = ["观望", "入门", "亲随", "得力", "倚重"] as const;

const DAO_LU_VIBES = [
  "清冷",
  "温柔",
  "嘴硬心软",
  "狐系",
  "师姐气",
  "御姐",
  "大姐姐",
  "知性",
  "黏人",
  "危险又体面",
  "坏心眼",
  "酒气漂亮",
  "懒散贵气",
  "艳而不俗",
  "甜辣",
  "纯欲",
  "妖女气",
  "魅魔感",
  "圣女脸",
  "丰润",
  "肉感慵懒",
  "会撩",
  "薄情脸",
] as const;

const DAO_LYU_BASE_TRAIT_POOL = [
  // 社交倾向
  "内敛",
  "慢热",
  "心思细腻",
  "开朗直爽",
  "主动热情",
  // 思维方式
  "务实稳重",
  "理想主义",
  "有远见",
  "擅揣测",
  // 决策风格
  "高冷毒舌",
  "理智冷静",
  "温柔治愈",
  "共情力强",
  "心软",
  // 行事风格
  "执着",
  "严谨",
  "霸道",
  "控制欲强",
  "随性洒脱",
  // 情绪稳定性
  "淡定抗压",
  "完美主义",
  "易纠结",
  // 复合标签
  "外冷内热",
  "护短成性",
  "嘴硬心软",
  "腹黑",
  "占有欲强",
] as const;

const DAO_LYU_ADULT_TRAIT_POOL = [
  "危险且体面",
  "撩而不自知",
  "克制中带侵略性",
  "温柔得像陷阱",
] as const;

const DAO_LYU_JOKE_TRAIT_POOL = [
  "一本正经说酸话",
  "传音符里爱留半句欠揍的话",
  "会拿你的嘴硬原样还回来",
  "护短时还不忘顺手挤兑你一句",
] as const;

const DAO_LYU_DEFAULT_SCENES = [
  "并肩",
  "夜谈",
  "雨夜",
  "飞舟",
  "秘境",
  "喝酒",
  "双修",
  "屏风",
  "更衣",
  "榻边",
  "温泉",
  "沐发",
] as const;

function deriveDaoLyuMbti(vibe: readonly string[]): string {
  // 根据气质推断 MBTI 四维度，最终附加 -A（自信稳定）或 -T（敏感多虑）后缀
  const vibeStr = vibe.join(" ");

  // 推断基础类型
  let base: string;
  if (/(清冷|知性|危险又体面)/.test(vibeStr)) base = pick(["INTJ", "INFJ", "ISTJ"]);
  else if (/(御姐|师姐气)/.test(vibeStr)) base = pick(["ENTJ", "ESTJ", "INTJ"]);
  else if (/(温柔|大姐姐)/.test(vibeStr)) base = pick(["INFJ", "ENFJ", "ISFJ"]);
  else if (/(狐系|坏心眼|魅魔感)/.test(vibeStr)) base = pick(["ENTP", "ENFP", "ESTP"]);
  else if (/(黏人|甜辣|纯欲)/.test(vibeStr)) base = pick(["ENFP", "ESFP", "INFP"]);
  else if (/(嘴硬心软|薄情脸)/.test(vibeStr)) base = pick(["ISTP", "ESTP", "INTJ"]);
  else if (/(妖女气|艳而不俗)/.test(vibeStr)) base = pick(["ENFJ", "ENTJ", "ESFP"]);
  else if (/(懒散贵气|酒气漂亮)/.test(vibeStr)) base = pick(["ISFP", "ESFP", "INFP"]);
  else if (/(肉感慵懒|丰润|会撩)/.test(vibeStr)) base = pick(["ESFP", "ISFP", "ENFP"]);
  else base = pick(["INTJ", "INFJ", "ENFJ", "ENTJ", "INTP", "ENTP", "INFP", "ENFP"]);

  // 推断情绪稳定性后缀：-A 自信稳定，-T 敏感多虑
  const variant = /(淡定|抗压|霸道|高冷|严谨|控制欲)/.test(vibeStr) ? "A" : pick(["A", "T"]);
  return `${base}-${variant}`;
}

function deriveDaoLyuAdultStyle(wish: BondWishStructType, rawWish: string) {
  const text = `${rawWish} ${wish.desiredVibe.join(" ")} ${wish.desiredTraits.join(" ")}`;
  if (/(魅魔|妖女|色系|纯欲|勾人|坏女人)/.test(text)) {
    return "魅魔拉扯";
  }
  if (/(胸无大志|大胸|丰乳|丰润|丰腴|肉感|蜜桃)/.test(text)) {
    return "丰润压迫";
  }
  if (/(圣女|清纯|反差|端庄|仙子脸)/.test(text)) {
    return "圣洁反差";
  }
  if (/(御姐|姐姐|大姐姐|师姐|女王|年上)/.test(text)) {
    return "御姐拿捏";
  }
  if (/(腿精|腰精|长腿|细腰|锁骨)/.test(text)) {
    return "身段杀伤";
  }
  return wish.adultTone ? "暧昧压近" : "克制";
}

function buildDaoLyuAppearanceLine(vibe: string[], rawWish: string, wish: BondWishStructType) {
  if (!wish.adultTone) {
    return `${pick(vibe)}的气质先落在眼里，衣襟收得利落，眸色沉静，却总在看向你时多停一瞬。`;
  }

  const adultStyle = deriveDaoLyuAdultStyle(wish, rawWish);
  const styleDetail = adultStyle === "魅魔拉扯"
    ? "眉眼与唇线都带着一点犯规的勾火，连正经看人都像故意先撩一寸。"
    : adultStyle === "丰润压迫"
      ? "身段丰润得过分，曲线被衣料收住大半，却仍压得人很难不多看一眼。"
      : adultStyle === "圣洁反差"
        ? "面相清圣得像不该沾尘，偏偏靠近时那点坏心就从眼尾慢慢漏出来。"
        : adultStyle === "御姐拿捏"
          ? "举手投足都像在从容拿捏距离，压迫感和照顾欲一起落下来。"
          : adultStyle === "身段杀伤"
            ? "腰线与腿影都收得太漂亮，光是走近一步就足够扰乱人的呼吸。"
            : "衣襟收得利落，呼吸和视线却总像故意压得更近一些。";
  return `${pick(vibe)}的气质先落在眼里，${styleDetail}`;
}

const DAO_LU_EVENT_BLUEPRINTS = [
  {
    key: "protective",
    title: "当街护短",
    summary: "有人在旁说了不该说的话，道侣没抬高声音，却先一步把那股气头替你拦下来了。",
    storyHook: "本回合适合写成道侣在外人面前替主角护短，动作可以克制，但态度要明显偏向主角，让关系通过插话、挡灾或冷脸来显影。",
    mood: "护短",
    relationshipSummary: "这段关系已经开始带出明显的偏心和站位，不再只是若即若离。",
    memorySummary: "有人当面触了霉头，对方替你拦了下来，护短之意已经藏不住。",
    intimacyDelta: 1,
    trustDelta: 2,
    loyaltyDelta: 0,
    destinyDelta: 1,
  },
  {
    key: "night-talk",
    title: "并肩夜谈",
    summary: "你们在夜里并肩坐了一阵，谁都没把话说得太满，但很多心思已经不必明说。",
    storyHook: "本回合适合安排一段并肩夜谈、飞舟闲坐或短暂歇脚，让道侣用少量台词试探、宽慰或嘴硬心软地贴近主角。",
    mood: "试探",
    relationshipSummary: "彼此说话仍留余地，但已经能在沉默里看懂对方的意思。",
    memorySummary: "你们夜里并肩说了一阵话，很多试探没有点破，却都被记下了。",
    intimacyDelta: 2,
    trustDelta: 1,
    loyaltyDelta: 0,
    destinyDelta: 0,
  },
] as const;

const DISCIPLE_EVENT_BLUEPRINTS = [
  {
    key: "report",
    title: "歪战报里藏线索",
    summary: "弟子交上来的战报写得七扭八歪，偏偏里面藏着一条还算有用的线索。",
    storyHook: "本回合适合让弟子带着蹩脚战报、错字连篇的汇报或不成体统的口信闯进来，闹出点笑话，但最终给主角带来真正有用的信息。",
    mood: "献宝",
    relationshipSummary: "对方做事还不够稳，但已经明显在努力把门下的份内事往前扛。",
    memorySummary: "弟子交来一份漏洞不少的汇报，却意外给你带回了能用的线索。",
    intimacyDelta: 0,
    trustDelta: 2,
    loyaltyDelta: 1,
    destinyDelta: 0,
  },
  {
    key: "trouble",
    title: "惹祸后先来认错",
    summary: "弟子在外惹了点不大不小的麻烦，第一时间回头来找你兜底，倒也没敢藏着掖着。",
    storyHook: "本回合适合把弟子写成惹了点麻烦后主动回来认错或求救，让师徒关系通过顶嘴、认罚、硬着头皮汇报来体现。",
    mood: "心虚",
    relationshipSummary: "对方虽然毛病不少，但已经开始把你真正当作能托底的人。",
    memorySummary: "弟子在外惹了点祸，却第一时间回来向你交代，师徒之间的依赖更实了一层。",
    intimacyDelta: 0,
    trustDelta: 1,
    loyaltyDelta: 2,
    destinyDelta: 0,
  },
  {
    key: "credit",
    title: "替你争了脸面",
    summary: "弟子把一件小事办得比预想中还利落，回来的时候嘴上装镇定，眼里却明晃晃写着求夸。",
    storyHook: "本回合适合安排弟子把一件差事办成、替主角挣回一点脸面，再用得意、嘴硬或求夸的细节把师徒关系写活。",
    mood: "得意",
    relationshipSummary: "门下这人开始能替你撑一点场面，师门的味道也跟着立起来了。",
    memorySummary: "弟子办成一桩差事，明明很想讨夸，却还在你面前装作没什么。",
    intimacyDelta: 1,
    trustDelta: 2,
    loyaltyDelta: 2,
    destinyDelta: 0,
  },
] as const;

const DAO_LYU_EVENT_TREE: EventTreeNode = {
  key: "dao-lu-root",
  label: "道侣事件树",
  children: [
    {
      key: "dao-lu-early",
      label: "初识牵丝",
      allowedProgressStages: ["初识", "牵丝"],
      children: [
        {
          key: "early-quiet",
          label: "安静靠近",
          weight: 3,
          preferredScenes: ["守灯", "夜谈", "并肩", "雨夜"],
          preferredMoods: ["靠近", "试探", "平静"],
          blueprints: [
            {
              key: "shared-lamp-shadow",
              title: "守灯时袖影相叠",
              summary: "对方在你调息时守了半夜灯火，明明离得不远，却偏偏只用袖影和呼吸把距离一点点推近。",
              storyHook: "本回合适合把道侣写成在夜里守灯、递水或替主角压住屋外风声，用袖影、停顿和并肩的静动作表现靠近。",
              mood: "靠近",
              relationshipSummary: "你们之间还没把话说透，但沉默已经开始容得下彼此。",
              memorySummary: "对方在夜里陪你守灯，明明没说多少话，距离却比先前近得多。",
              intimacyDelta: 2,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
            {
              key: "umbrella-shoulder-brush",
              title: "借伞时肩骨相碰",
              summary: "雨丝压下来时，对方把伞面偏向你这边，肩骨若有若无擦过一下，像故意，又像只是懒得解释。",
              storyHook: "本回合适合安排雨夜同行、山路共伞或避雨短停，让道侣用偏伞、贴肩和一句轻描淡写的话制造暧昧拉扯。",
              mood: "试探",
              relationshipSummary: "这段关系开始出现克制却明显的身体靠近，谁都没拆穿。",
              memorySummary: "雨夜同路时，对方把伞偏向你，肩骨轻轻碰过，暧昧被谁都没点破地留了下来。",
              intimacyDelta: 2,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 0,
              preferredScenes: ["雨夜"],
            },
            {
              key: "window-medicine",
              title: "隔窗递来温药",
              summary: "你还没开口，对方便把温药从窗边递进来，语气淡得像顺手，偏偏温度和时机都卡得刚好。",
              storyHook: "本回合适合让道侣以递药、送符、隔窗提醒的方式入场，用过分合时宜的照顾感去侧写心思。",
              mood: "留心",
              relationshipSummary: "对方已经开始记你的气口和作息，这份留心很难再解释成偶然。",
              memorySummary: "你尚未开口，对方就把温药送到了手边，像早把你的状态记在了心里。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
          ],
        },
        {
          key: "early-joke",
          label: "嘴硬整活",
          weight: 2,
          minJokeTolerance: "中",
          preferredMoods: ["试探", "嘴硬", "得意"],
          blueprints: [
            {
              key: "teasing-transmission",
              title: "传音符只留半句",
              summary: "对方传来的符纸上只写了半句欠揍的话，害你多走半条街去找人，结果他人就靠在檐下看你反应。",
              storyHook: "本回合适合把道侣写成一本正经地整活，先用半句传音吊着主角，再在会面时装作若无其事地看反应。",
              mood: "逗弄",
              relationshipSummary: "彼此已经能拿心思互相试探，气氛比单纯客气更活了。",
              memorySummary: "对方用半句传音把你逗了过去，见面时还装得像什么都没做。",
              intimacyDelta: 2,
              trustDelta: 0,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
            {
              key: "serious-sour-line",
              title: "一本正经说酸话",
              summary: "旁人多看了你两眼，对方表面在谈正事，话里却平白多出几分带刺的酸意，偏偏说得格外体面。",
              storyHook: "本回合适合让道侣在正经场合里夹一句酸话，既不失体面，又让人听得出偏心和试探。",
              mood: "吃味",
              relationshipSummary: "对方开始对你显出占有欲的雏形，只是还肯用玩笑包一层皮。",
              memorySummary: "有外人靠近时，对方装作若无其事地说了句酸话，偏心藏得不算高明。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
          ],
        },
        {
          key: "early-adult",
          label: "贴近试温",
          weight: 2,
          requiresAdultTone: true,
          preferredScenes: ["守灯", "并肩", "双修", "喝酒", "屏风", "更衣", "温泉", "沐发"],
          preferredMoods: ["靠近", "试探", "留心"],
          blueprints: [
            {
              key: "collar-adjustment",
              title: "理衣领时指尖太慢",
              summary: "你衣领被风吹乱，对方伸手替你理好，却在喉侧停得比必要多了一瞬，慢得像故意试你会不会躲。",
              storyHook: "本回合适合写一段极短的贴近动作，比如理衣领、拂灰或扶肩，让暧昧通过指尖停顿和谁都没后退的那一息体现出来。",
              mood: "撩拨",
              relationshipSummary: "你们之间已经有了成年人心照不宣的拉扯，不必靠直白言语也能发热。",
              memorySummary: "对方替你理衣领时指尖停得过慢，像在无声试探你肯不肯让他靠近。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 0,
              requiresAdultTone: true,
            },
            {
              key: "meridian-touch",
              title: "试你灵脉时离得过近",
              summary: "你气息稍乱，对方伸手替你试脉，腕骨和呼吸都压得太近，偏偏神情还淡得像是在做最正经不过的事。",
              storyHook: "本回合适合安排道侣替主角试脉、压息或扶稳，让克制的专业动作里带出明显的成年人暧昧张力。",
              mood: "贴近",
              relationshipSummary: "你们已经能借正经理由自然地靠近彼此，心思藏不住了。",
              memorySummary: "对方替你试灵脉时离得太近，连呼吸都像故意压到了你耳边。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["双修", "守灯"],
            },
            {
              key: "screen-belt-knot",
              title: "屏风后替你系好衣带",
              summary: "你衣带在屏风后松了半寸，对方走近替你系回去，指节碰过腰侧时并不慌，反倒像故意看你先乱几分。",
              storyHook: "本回合适合安排屏风、更衣或临出门前的极短照料动作，让道侣借系衣带、扶袍角把距离压到很暧昧的一线。",
              mood: "压近",
              relationshipSummary: "你们已经开始用很短的贴身动作试探彼此的底线，谁都没有先退。",
              memorySummary: "屏风后，对方替你系回衣带，指节贴过腰侧时停得刚刚够人记很久。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 0,
              requiresAdultTone: true,
              preferredScenes: ["屏风", "更衣"],
            },
            {
              key: "wet-hair-scent",
              title: "沐发后水汽绕得太近",
              summary: "你发尾未干，对方替你拢住湿发，水汽和香气一起压到肩侧，说是怕你受凉，距离却明显近得过界。",
              storyHook: "本回合适合把道侣写进温泉后、沐发后或雨后短暂停留的场景，用拢发、擦水和气息交错做成人向拉扯。",
              mood: "缠人",
              relationshipSummary: "这段关系已经开始借照顾的名义把身体距离压得很近。",
              memorySummary: "对方替你拢住湿发，水汽与呼吸一起落到肩侧，近得让人很难装作无事。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["温泉", "沐发"],
            },
          ],
        },
      ],
    },
    {
      key: "dao-lu-mid",
      label: "相偎缠心",
      allowedProgressStages: ["相偎", "缠心"],
      children: [
        {
          key: "mid-public",
          label: "当众偏心",
          weight: 3,
          preferredMoods: ["护短", "吃味", "认真"],
          blueprints: [
            {
              key: "street-protection",
              title: "当街护短",
              summary: "有人话里带刺，对方连语气都没抬高，就先一步把你的场子接了过去，护短护得很不留缝。",
              storyHook: "本回合适合让道侣在外人面前替主角挡话、挡灾或冷脸表态，把偏心和站位写得鲜明但不直白。",
              mood: "护短",
              relationshipSummary: "你们的关系已经长出公开站位，对方不会再让旁人随意碰你。",
              memorySummary: "外人话里生刺时，对方当街把场子替你接住，护短得毫不含糊。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
            {
              key: "cloak-around-shoulder",
              title: "当众替你拢袍",
              summary: "夜风稍重，对方抬手替你把外袍拢好，动作自然得像做惯了，旁人却都看得出那份不加掩饰的偏心。",
              storyHook: "本回合适合让道侣在众人视线里做一个自然但亲密的照顾动作，让旁人意识到这段关系已经越过了普通同路人。",
              mood: "偏心",
              relationshipSummary: "对方已经不太介意把照顾你这件事摆到别人眼前。",
              memorySummary: "对方当众替你拢了外袍，偏心显得太自然，谁都装不成没看见。",
              intimacyDelta: 2,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
            {
              key: "cold-smile-jealousy",
              title: "冷笑替你截话",
              summary: "有人对你献殷勤，对方只笑了一下，便把那人的话题轻轻截断，笑意不深，醋意倒是藏得并不认真。",
              storyHook: "本回合适合让道侣在外人靠近主角时自然打断、接话或重新占住位置，把吃味写得克制而好看。",
              mood: "吃味",
              relationshipSummary: "这段关系已经带出明显的占有欲，对方开始不太愿意让别人靠得太近。",
              memorySummary: "有人向你献殷勤时，对方笑着把话截走，吃味吃得相当体面。",
              intimacyDelta: 2,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "mid-private",
          label: "并肩私下",
          weight: 3,
          preferredScenes: ["夜谈", "飞舟", "喝酒", "守灯", "秘境"],
          preferredMoods: ["靠近", "留心", "试探"],
          blueprints: [
            {
              key: "night-drink",
              title: "并肩夜饮",
              summary: "你们靠着栏边分了一壶酒，对方酒量分明比你稳，却偏偏在你看过来时故意慢了一拍，像在等一句不太好说的话。",
              storyHook: "本回合适合安排飞舟夜饮、栏边歇脚或危机后的短暂放松，让道侣用压低声线和留白句子把关系往前推。",
              mood: "缱绻",
              relationshipSummary: "彼此已经能在夜色里把话说到一半也不怕对方听不懂。",
              memorySummary: "你们并肩分了一壶酒，很多没说透的话都被夜风和目光记了下来。",
              intimacyDelta: 2,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              preferredScenes: ["喝酒", "飞舟"],
            },
            {
              key: "hand-over-hand-guidance",
              title: "扶你运气时不肯放手",
              summary: "你气海浮动时，对方在背后替你导气，明明已经稳住了，却迟迟没把手撤开，像是舍不得先松。",
              storyHook: "本回合适合让道侣在主角气机不稳或疲惫时出手相助，用手势、停顿和呼吸距离来表现缠心阶段的默契。",
              mood: "安心",
              relationshipSummary: "对方已经习惯在你最不稳的时候亲手把你按回安全处。",
              memorySummary: "你气海浮动时，对方替你导气许久，等稳了还没急着松手。",
              intimacyDelta: 2,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
            {
              key: "secret-lamp-talk",
              title: "熄灯前又留了一句",
              summary: "夜里灯都快熄了，对方却在门边又停了一下，回头补了一句似真似假的叮嘱，听上去像命令，实际全是挂念。",
              storyHook: "本回合适合写一段短暂收尾场景，让道侣在离开前回头补一句嘴硬心软的话，把关系余温留到章节尾部。",
              mood: "挂念",
              relationshipSummary: "你们已经习惯把关心藏进临走前那句最难装作随口的话。",
              memorySummary: "熄灯前，对方回头多留了一句叮嘱，嘴上像发号施令，实际全是挂念。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
          ],
        },
        {
          key: "mid-adult",
          label: "克制擦边",
          weight: 2,
          requiresAdultTone: true,
          preferredScenes: ["飞舟", "双修", "夜谈", "喝酒", "屏风", "更衣", "榻边", "温泉"],
          preferredMoods: ["撩拨", "贴近", "缱绻", "吃味"],
          blueprints: [
            {
              key: "drug-application",
              title: "上药时嗓音压得太低",
              summary: "你伤处并不重，对方却坚持亲手上药，俯身时嗓音压得太低，连你呼吸乱了都像早被他听见。",
              storyHook: "本回合适合让道侣借上药、包扎或整理伤势的名义短暂贴近，用低声、停顿和目光承接成年人暧昧。",
              mood: "撩拨",
              relationshipSummary: "你们之间的拉扯已经明显到连正经照料都带着发烫的边缘感。",
              memorySummary: "对方替你上药时离得过近，连声线都低得像故意磨人。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
            },
            {
              key: "flying-boat-wrap",
              title: "飞舟夜风里把你拢近",
              summary: "飞舟夜风太急，对方索性把你往自己这边带了一下，说是怕你伤势见风，手却一直没松得太干净。",
              storyHook: "本回合适合安排飞舟、崖边或高处同行，让道侣借避风、扶稳或护身的动作把距离压得更近。",
              mood: "贴近",
              relationshipSummary: "对方已经习惯在照顾你的借口里藏一点不太单纯的私心。",
              memorySummary: "飞舟夜风里，对方借着护你把人拢近，手上那点不肯松的意思很难忽略。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["飞舟"],
            },
            {
              key: "breath-near-ear",
              title: "耳畔低声叫你别逞强",
              summary: "你还想硬撑，对方直接凑近到你耳侧低声叫你别装，语气不重，却近得足够让人心神乱一瞬。",
              storyHook: "本回合适合用极短的一句耳畔低语或近距离警告制造拉扯感，不用直白表白，也能把成年人暧昧写得很浓。",
              mood: "压迫",
              relationshipSummary: "你们已经越过普通亲近，连一句警告都能带出近乎失控的张力。",
              memorySummary: "你逞强时，对方贴到耳边压低声线叫你别装，那一瞬的距离太近，谁都忘不掉。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 0,
              requiresAdultTone: true,
            },
          ],
        },
        {
          key: "mid-adult-flair",
          label: "风情压境",
          weight: 2,
          requiresAdultTone: true,
          preferredScenes: ["屏风", "更衣", "榻边", "温泉", "沐发"],
          preferredMoods: ["压近", "缱绻", "炽热", "贴近"],
          blueprints: [
            {
              key: "screen-shadow-press",
              title: "屏风半掩时还敢压近",
              summary: "屏风半掩，对方分明能站远些，却偏偏一步逼近替你理平袍角，目光顺着你的反应慢吞吞地落下来。",
              storyHook: "本回合适合用屏风、更衣或出门前的一息空档，把道侣写成故意不肯退开的人，用目光和手上动作制造成人向压迫感。",
              mood: "压近",
              relationshipSummary: "你们之间的暧昧已经从试探走到明晃晃地互相施压，只差谁先认输。",
              memorySummary: "屏风半掩时，对方替你理袍却迟迟不退，目光把那一息暧昧压得很满。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["屏风", "更衣"],
            },
            {
              key: "bedside-hair-dry",
              title: "榻边擦发时膝侧抵住",
              summary: "你坐在榻边，对方替你擦发，膝侧若有若无抵住一点，动作温得很，偏偏比任何情话都更让人乱。",
              storyHook: "本回合适合安排榻边休整、雨后擦发或闭关前短暂停留，用擦发、膝侧、发尾这些细节把色气堆出来。",
              mood: "缱绻",
              relationshipSummary: "这段关系已经足够熟，熟到连最日常的照顾都能被做得过分撩人。",
              memorySummary: "榻边擦发时，对方膝侧轻轻抵住，动作温柔，暧昧却一点没收。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["榻边", "沐发"],
            },
            {
              key: "hot-spring-waist-steady",
              title: "温泉雾里扶你时手没撤",
              summary: "池边石滑，你刚一晃，对方就揽住你腰把人扶稳，话说得平静，掌心却一直没急着撤开。",
              storyHook: "本回合适合把温泉、水汽或湿滑地面当作借口，让道侣用揽腰、扶稳和近距离低声说话把关系温度直接抬起来。",
              mood: "贴近",
              relationshipSummary: "你们已经能把身体上的照顾做得几乎没有多余遮掩。",
              memorySummary: "温泉雾气里，对方揽腰把你扶稳，掌心停得太久，像故意给你乱心的时间。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["温泉"],
            },
          ],
        },
        {
          key: "mid-joke",
          label: "热闹逗弄",
          weight: 1,
          minJokeTolerance: "高",
          preferredMoods: ["得意", "逗弄", "吃味"],
          blueprints: [
            {
              key: "fake-calm-jealousy",
              title: "装镇定却酸得明显",
              summary: "对方明明已经吃味，还要一本正经教你怎么避桃花，教到最后自己先被自己说得冷了脸。",
              storyHook: "本回合适合把道侣的吃味写成一本正经的假劝告，让玩笑和酸意同时落地。",
              mood: "嘴硬",
              relationshipSummary: "你们已经能把暧昧和吃味拿来互相逗，关系显得又熟又热。",
              memorySummary: "对方装作给你提建议，实则一整段都酸得明显，最后连自己都绷不住。",
              intimacyDelta: 2,
              trustDelta: 0,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
          ],
        },
      ],
    },
    {
      key: "dao-lu-late",
      label: "同契相守",
      allowedProgressStages: ["同契"],
      children: [
        {
          key: "late-vow",
          label: "并命相守",
          weight: 3,
          preferredMoods: ["安心", "认真", "护短"],
          blueprints: [
            {
              key: "same-advance-retreat",
              title: "并肩说定同进退",
              summary: "局势压下来时，对方只说了一句“同进退”，语气平得厉害，却把你们之间最后一层试探也压成了实意。",
              storyHook: "本回合适合在危机、选择或大战前写一句分量很重的并肩承诺，不要长篇表白，只要一句够硬的同进退。",
              mood: "相守",
              relationshipSummary: "这段关系已经不再只是暧昧与偏心，而是开始具备真正的共命意味。",
              memorySummary: "局势最紧时，对方只说了一句同进退，就把你们的关系压成了真正的并命。",
              intimacyDelta: 2,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 2,
            },
            {
              key: "closed-door-companion",
              title: "闭关前守到天明",
              summary: "你要闭关前，对方在门外守到天明，半句多余的情话都没有，只把该备的都替你备齐了。",
              storyHook: "本回合适合写一段闭关前夜或大战前夜的安静陪伴，让道侣用实打实的守候表现同契阶段的厚度。",
              mood: "安定",
              relationshipSummary: "你们已经把陪伴从热烈拉扯走到了真正能托命的安稳。",
              memorySummary: "你闭关前，对方守到天明，把该备的都先替你备好了。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 2,
            },
          ],
        },
        {
          key: "late-protect",
          label: "偏心到底",
          weight: 2,
          preferredMoods: ["护短", "吃味", "相守"],
          blueprints: [
            {
              key: "reject-suitors",
              title: "替你回绝烂桃花",
              summary: "麻烦人刚靠近，对方已经替你把话回绝得干干净净，手段温和，界线却摆得比谁都明。",
              storyHook: "本回合适合让道侣在不失体面的情况下替主角挡掉多余纠缠，把成熟关系里的边界感写清楚。",
              mood: "占位",
              relationshipSummary: "对方已经把你的位置默认纳入自己的边界之内，不再给旁人留错觉。",
              memorySummary: "有人纠缠上来时，对方先一步替你把界线摆明，半点缝也没留。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
            {
              key: "injury-cold-face",
              title: "你一受伤他就冷了脸",
              summary: "你刚见血，对方神色一下冷下去，先把局面收拾干净，再回来一言不发地亲手把你按稳。",
              storyHook: "本回合适合让道侣在危机后先处理残局，再把所有情绪收进亲手照顾主角的动作里，表现成熟关系的护短与占位。",
              mood: "压火",
              relationshipSummary: "你们之间已经到了不用解释也知道该先护谁、该先稳谁的地步。",
              memorySummary: "你受伤时，对方先把局面压住，回来后一句废话都没说，只把你按稳照顾好。",
              intimacyDelta: 2,
              trustDelta: 2,
              loyaltyDelta: 0,
              destinyDelta: 1,
            },
          ],
        },
        {
          key: "late-adult",
          label: "成熟拉扯",
          weight: 2,
          requiresAdultTone: true,
          preferredScenes: ["双修", "守灯", "喝酒", "夜谈", "榻边", "更衣", "温泉", "沐发"],
          preferredMoods: ["缱绻", "相守", "贴近"],
          blueprints: [
            {
              key: "breath-steadying-embrace",
              title: "气机乱时先把你拥稳",
              summary: "你气机一乱，对方先把人扣稳在怀里，等你呼吸平下去才肯松开，动作熟得像已经做过很多次。",
              storyHook: "本回合适合把成年人暧昧写进救急动作里，用拥稳、压息、贴近耳语表现成熟道侣之间克制但真实的热度。",
              mood: "缠绵",
              relationshipSummary: "你们已经有了足够亲密和默契的身体信任，很多靠近不必再借口。",
              memorySummary: "你气机紊乱时，对方先把你拥稳许久，等你缓过来才慢慢松手。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 2,
              requiresAdultTone: true,
            },
            {
              key: "wine-gaze-linger",
              title: "酒后视线停得太久",
              summary: "酒意上来后，对方靠着桌沿看了你太久，久到连收回目光都像是在给你最后一次躲开的机会。",
              storyHook: "本回合适合用酒后、夜静或大战后放松的短场景写目光和呼吸，不需要直接挑明，也能让成熟暧昧成立。",
              mood: "炽热",
              relationshipSummary: "这段关系已经从试探走到几乎无需遮掩，只差谁先把最后半步迈明。",
              memorySummary: "酒后，对方看你看得太久，久到连收回目光都像一种放过。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["喝酒"],
            },
            {
              key: "waist-draw-no-hide",
              title: "揽腰把你带回自己身侧",
              summary: "你刚想从喧闹里退开，对方就顺手揽住你的腰把人带回自己身侧，动作熟得像早把这个位置留给了你。",
              storyHook: "本回合适合把成熟道侣写得更笃定一些，用揽腰、带回身侧、替你占位这种动作直接表现主权感和色气。",
              mood: "占位",
              relationshipSummary: "你们之间已经不是试探谁先靠近，而是谁更自然地把对方收回自己身边。",
              memorySummary: "你刚想退开，对方就揽腰把你带回身侧，动作熟得像天经地义。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 2,
              requiresAdultTone: true,
              preferredScenes: ["夜谈", "飞舟", "榻边"],
            },
            {
              key: "morning-belt-tie",
              title: "晨起替你系衣时离得太近",
              summary: "晨起时你还带着倦，对方俯身替你系好衣带，嗓音低得像怕惊了你，偏偏人却始终没离远半分。",
              storyHook: "本回合适合在大战后、闭关后或晨起短场景里写道侣替主角整理衣襟、束发或系带，用熟门熟路的亲密拉高成熟期色气。",
              mood: "缱绻",
              relationshipSummary: "你们的亲密已经渗进了最日常的动作里，连晨起整理衣冠都带着热度。",
              memorySummary: "晨起时，对方俯身替你系衣，离得太近，像把整份熟稔都压进了那一息里。",
              intimacyDelta: 3,
              trustDelta: 1,
              loyaltyDelta: 0,
              destinyDelta: 1,
              requiresAdultTone: true,
              preferredScenes: ["更衣", "榻边"],
            },
          ],
        },
      ],
    },
  ],
};

const DISCIPLE_EVENT_TREE: EventTreeNode = {
  key: "disciple-root",
  label: "弟子事件树",
  children: [
    {
      key: "disciple-early",
      label: "入门磨合",
      allowedProgressStages: ["观望", "入门"],
      children: [
        {
          key: "early-trouble",
          label: "惹祸认错",
          weight: 3,
          preferredMoods: ["心虚", "观望", "认真"],
          blueprints: [
            {
              key: "trouble-confession",
              title: "惹祸后先来认错",
              summary: "弟子在外惹了点不大不小的麻烦，兜不住时第一反应不是跑，而是硬着头皮回来找你认错。",
              storyHook: "本回合适合让弟子惹祸后第一时间回来认错、求罚或求兜底，用嘴硬、认栽和不敢藏着掖着体现师徒关系。",
              mood: "心虚",
              relationshipSummary: "对方已经开始把你当作真正能托底的人，虽然惹祸的本事也没落下。",
              memorySummary: "弟子惹了祸后第一时间回来认错，没敢把事情往外藏。",
              intimacyDelta: 0,
              trustDelta: 1,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
            {
              key: "manual-misread",
              title: "把口诀背出旁门味",
              summary: "弟子把你给的口诀背得七零八落，还自己乱加理解，差点练偏，发现不对后又吓得连夜回来求你打回来。",
              storyHook: "本回合适合写弟子学艺时的离谱偏差和慌张补救，让笑点和‘还知道回来找师尊’的依赖感同时成立。",
              mood: "慌乱",
              relationshipSummary: "这孩子毛病不少，但至少出了岔子时还知道先回来找你。",
              memorySummary: "弟子把口诀练偏后吓得连夜回来求你纠正，狼狈得很，却没敢自己硬扛到底。",
              intimacyDelta: 0,
              trustDelta: 1,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "early-meme",
          label: "闹腾献宝",
          weight: 2,
          preferredMoods: ["献宝", "得意", "观望"],
          blueprints: [
            {
              key: "crooked-report-plus",
              title: "歪战报里藏线索",
              summary: "弟子递来的战报写得七扭八歪，押韵押得像在念词牌，偏偏里面还真藏着一条能用的线索。",
              storyHook: "本回合适合让弟子带着不成体统却意外有用的情报闯进来，用笑料包着正经贡献，把人写活。",
              mood: "献宝",
              relationshipSummary: "对方做事还不够稳，但已经急着把能用的东西往你面前送。",
              memorySummary: "弟子交来一份歪得离谱的战报，却还真给你带回了可用的线索。",
              intimacyDelta: 0,
              trustDelta: 2,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
            {
              key: "artifact-weird-name",
              title: "给法器起怪名还叫开了",
              summary: "弟子顺手给新法器起了个不像样的名字，原以为只会丢人，结果附近弟子全给传开了，叫得比正式名还响。",
              storyHook: "本回合适合把弟子写成闹腾、嘴快又意外带起气氛的人，让一个怪名字或怪梗在门下传开。",
              mood: "得意",
              relationshipSummary: "这人虽然闹腾，但已经开始给门下带出一点鲜活的烟火气。",
              memorySummary: "弟子给法器起的怪名字莫名传遍了门下，丢人和长脸居然只差一步。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
            {
              key: "shoe-stones",
              title: "灵石又藏鞋底",
              summary: "弟子明明已经入你门下，还是改不掉把灵石藏鞋底的老毛病，被人当场抖出来后红着脸来找你求一套新规矩。",
              storyHook: "本回合适合用弟子的旧毛病闹出轻喜剧，再借师徒间的训话或包庇写关系温度。",
              mood: "窘迫",
              relationshipSummary: "对方还带着过去的穷酸毛病，但已经愿意把这些狼狈交到你面前。",
              memorySummary: "弟子灵石藏鞋底的旧毛病被揭出来后，硬着头皮来找你求规矩。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "early-earnest",
          label: "倔着上进",
          weight: 2,
          preferredMoods: ["认真", "敬服", "观望"],
          blueprints: [
            {
              key: "midnight-practice",
              title: "半夜偷练还装不累",
              summary: "弟子练到半夜手都发抖，见你问起还要嘴硬说不累，结果连剑都差点握不稳。",
              storyHook: "本回合适合把弟子的死扛和求强写得有点狼狈也有点讨人疼，让师徒关系借训斥或默许推进。",
              mood: "死扛",
              relationshipSummary: "对方已经开始把你的认可看得很重，所以练得比嘴上承认的更狠。",
              memorySummary: "弟子半夜偷练到手抖还硬说不累，求强求得很不体面，却也很认真。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
            {
              key: "half-move-request",
              title: "见你就想讨半招",
              summary: "弟子刚从外面跑回来，气都没喘匀，第一句话就是想向你讨半招，眼神亮得像怕晚一点你就不肯教了。",
              storyHook: "本回合适合写弟子逮到机会就想学两手的黏劲，用求教、讨打、抢着演示来增强师徒存在感。",
              mood: "求教",
              relationshipSummary: "对方已经把从你手里抠到一点真东西，当成了最值钱的奖赏。",
              memorySummary: "弟子一回来就想向你讨半招，眼神亮得像怕机会从手缝里漏掉。",
              intimacyDelta: 0,
              trustDelta: 2,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
          ],
        },
      ],
    },
    {
      key: "disciple-mid",
      label: "亲随得力",
      allowedProgressStages: ["亲随", "得力"],
      children: [
        {
          key: "mid-competence",
          label: "争脸办事",
          weight: 3,
          preferredMoods: ["得意", "认真", "献宝"],
          blueprints: [
            {
              key: "win-face-plus",
              title: "替你争了脸面",
              summary: "弟子把差事办得比预想中利落，回来时明明想求夸，还非要装出一副“这不是应该的吗”的样子。",
              storyHook: "本回合适合安排弟子把一件差事办成，用装镇定、等夸、嘴硬这些细节把师徒关系写活。",
              mood: "得意",
              relationshipSummary: "门下这人已经能替你撑一点场面，师门的骨头开始立起来了。",
              memorySummary: "弟子办成差事后明明很想讨夸，却还在你面前装得没什么。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
            {
              key: "market-negotiation",
              title: "坊市里替你谈成了价",
              summary: "弟子在坊市和人磨了半天嘴皮，最后真把一桩本不该占便宜的交易谈成了，回来时尾巴都快翘到天上。",
              storyHook: "本回合适合让弟子在外跑腿、交涉或打探，把机灵和想讨夸都写出来，让师徒线更有烟火气。",
              mood: "得意",
              relationshipSummary: "对方已经不止会惹祸，也开始知道替你把事办漂亮。",
              memorySummary: "弟子在坊市替你谈成了一桩便宜买卖，回来时得意得几乎藏不住。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
            {
              key: "public-defense",
              title: "替你把闲话怼回去",
              summary: "旁人说了句不轻不重的闲话，弟子当场就给怼了回去，怼完才想起来自己说得有点太冲，只能再回来认罚。",
              storyHook: "本回合适合让弟子在外维护主角声名，先长脸后心虚，把忠心和鲁莽一起落地。",
              mood: "护短",
              relationshipSummary: "对方已经把替你守脸面当成本能，哪怕方式还不够稳。",
              memorySummary: "弟子为你当场把闲话怼了回去，长脸是长脸了，回来也老老实实认了罚。",
              intimacyDelta: 0,
              trustDelta: 2,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "mid-loyalty",
          label: "先回你这里",
          weight: 2,
          preferredMoods: ["敬服", "认真", "心虚"],
          blueprints: [
            {
              key: "report-first",
              title: "风头正紧也先回来报你",
              summary: "外头风声很紧，弟子明明可以先躲，却还是先回来把来龙去脉交到你手里，像把这一门的规矩认进骨头了。",
              storyHook: "本回合适合让弟子在紧要关头先回师门报你，用‘先回来再说’的选择体现忠诚和归属感。",
              mood: "敬服",
              relationshipSummary: "对方已经把回到你这里当成了遇事的第一反应。",
              memorySummary: "局势紧时，弟子没有先躲，而是先回来把事情交到你手里。",
              intimacyDelta: 0,
              trustDelta: 2,
              loyaltyDelta: 3,
              destinyDelta: 0,
            },
            {
              key: "take-blame",
              title: "先把错往自己身上拦",
              summary: "差事出了纰漏，弟子第一反应不是推责，而是先把错拦到自己身上，回头再老老实实来问你该怎么补。",
              storyHook: "本回合适合把弟子写成先扛责任、后求指点的状态，让‘长大一点了’的感觉自然显出来。",
              mood: "认账",
              relationshipSummary: "对方开始学着替你守门面，也学着替自己担事。",
              memorySummary: "出了纰漏后，弟子先把错拦到了自己身上，再回来问你怎么补。",
              intimacyDelta: 0,
              trustDelta: 2,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "mid-meme",
          label: "门下梗王",
          weight: 2,
          preferredMoods: ["得意", "献宝", "护短"],
          blueprints: [
            {
              key: "stage-announcer",
              title: "紧张时又给自己报幕",
              summary: "弟子一紧张就忍不住给自己报幕，原本是坏毛病，这次却硬是把围观的人都整懵了，反倒替你抢回了场面。",
              storyHook: "本回合适合把弟子的怪毛病写成反差喜感，让原本丢人的习惯意外派上用场。",
              mood: "滑头",
              relationshipSummary: "对方那些离谱毛病正在慢慢变成有记忆点的门下特色。",
              memorySummary: "弟子紧张时又给自己报幕，原本丢人，结果这回居然还真救了场。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
            {
              key: "victory-rhyme",
              title: "写捷报还要强行押韵",
              summary: "弟子明明打了场漂亮仗，回来交捷报时却还在强行押韵，把严肃场面写出一股歪门邪道的喜气。",
              storyHook: "本回合适合让弟子用不靠谱的表达方式交出靠谱成果，让笑点和成长同时成立。",
              mood: "献宝",
              relationshipSummary: "这人还是那个会整活的人，但已经越来越会把事做成。",
              memorySummary: "弟子写捷报还不忘强行押韵，离谱归离谱，功劳倒也是真的。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
          ],
        },
      ],
    },
    {
      key: "disciple-late",
      label: "倚重门下",
      allowedProgressStages: ["倚重"],
      children: [
        {
          key: "late-backbone",
          label: "能撑门面",
          weight: 3,
          preferredMoods: ["护短", "认真", "得意"],
          blueprints: [
            {
              key: "hold-the-line",
              title: "替你把门面撑住了",
              summary: "你不在时，弟子先一步把门下的人心和场面都稳住了，等你回来时才把一肚子紧张往下咽。",
              storyHook: "本回合适合让弟子在主角未到场时先稳住局面，表现其已能代表师门做出判断。",
              mood: "撑场",
              relationshipSummary: "对方已经不只是门下跟班，而是能替你暂时扛起门面的人。",
              memorySummary: "你不在时，弟子先把场面稳住了，等你回来才露出那口一直憋着的紧张。",
              intimacyDelta: 1,
              trustDelta: 3,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
            {
              key: "organize-juniors",
              title: "会替你收拾小崽子了",
              summary: "门下小辈闹成一团，弟子居然先一步把人拎住了，训话训得还真有几分你的影子。",
              storyHook: "本回合适合让弟子代替主角管束门下、整理秩序，用模仿师尊口吻的细节体现传承感。",
              mood: "成熟",
              relationshipSummary: "你教出去的痕迹，已经开始在对方身上长成新的门风。",
              memorySummary: "弟子替你收拾门下小辈，训起人来竟真有几分你的影子。",
              intimacyDelta: 1,
              trustDelta: 2,
              loyaltyDelta: 2,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "late-loyalty",
          label: "死心塌地",
          weight: 2,
          preferredMoods: ["敬服", "护短", "心虚"],
          blueprints: [
            {
              key: "rush-and-report",
              title: "先替你顶上再回来领罚",
              summary: "局势一乱，弟子第一反应就是先替你顶上去，顶完回来还知道老实来领罚，半句辩解都没留。",
              storyHook: "本回合适合让弟子先斩后奏地替主角顶上风险，再回来认罚，把鲁莽和忠心同时写出来。",
              mood: "死扛",
              relationshipSummary: "对方已经把替你扛一下视作本能，哪怕自己也知道会挨训。",
              memorySummary: "局势一乱，弟子先替你顶了上去，事后回来半句不辩地领罚。",
              intimacyDelta: 0,
              trustDelta: 2,
              loyaltyDelta: 3,
              destinyDelta: 0,
            },
            {
              key: "face-first-loyalty",
              title: "嘴还是硬，膝却先弯了",
              summary: "弟子嘴上还想顶一句，真到该认错的时候却先一步跪稳了，认错认得又快又直，像怕你比他更失望。",
              storyHook: "本回合适合把弟子那点嘴硬和真正的敬服放在一起写，让角色既好笑又见真心。",
              mood: "敬服",
              relationshipSummary: "这份忠心已经不只是喊出来的，连认错时的姿态都带着把你放很重的意思。",
              memorySummary: "弟子嘴上还想顶，膝却先一步跪稳了，认错认得比谁都快。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 3,
              destinyDelta: 0,
            },
          ],
        },
        {
          key: "late-meme",
          label: "离谱门风",
          weight: 1,
          preferredMoods: ["得意", "滑头", "撑场"],
          blueprints: [
            {
              key: "warning-ballad",
              title: "把门规唱成了顺口溜",
              summary: "弟子嫌正经宣讲太慢，索性把门规编成顺口溜传给众人，离谱归离谱，居然真比板着脸讲更好使。",
              storyHook: "本回合适合把弟子的鬼点子写成能落地的管理方式，让门下气质更鲜活。",
              mood: "滑头",
              relationshipSummary: "对方已经不是单纯闹腾，而是学会拿离谱办法办正经事了。",
              memorySummary: "弟子把门规编成顺口溜传了出去，荒唐是荒唐，效果却出奇地好。",
              intimacyDelta: 1,
              trustDelta: 1,
              loyaltyDelta: 1,
              destinyDelta: 0,
            },
          ],
        },
      ],
    },
  ],
};

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

const DAO_LYU_STAGE_SUMMARY: Record<(typeof DAO_LYU_PROGRESS_STAGES)[number], string> = {
  初识: "刚结缘不久，彼此已不再是纯粹的陌路人。",
  牵丝: "心思开始越界，很多偏心和试探已经藏不太住。",
  相偎: "彼此会自然地靠向对方，关系已经有了稳定温度。",
  缠心: "情意和占位都越来越明，很多靠近不再需要借口。",
  同契: "这段关系已经长成并肩共命的样子，日常与险境都能彼此托底。",
};

const DISCIPLE_STAGE_SUMMARY: Record<(typeof DISCIPLE_PROGRESS_STAGES)[number], string> = {
  观望: "还在门墙之外观望，尚未真正拜入门下。",
  入门: "已经入门，但还在摸索你的规矩和门下位置。",
  亲随: "开始把你当真正的师尊，遇事会先回到你这里。",
  得力: "能替你争脸面、跑差事，逐渐像个能用的人。",
  倚重: "已经能代你撑一阵门面，是门下真正拿得出手的人。",
};

function getJokeToleranceRank(value: JokeTolerance) {
  if (value === "高") {
    return 2;
  }
  if (value === "中") {
    return 1;
  }
  return 0;
}

function normalizeJokeTolerance(input: string | undefined): JokeTolerance {
  return input === "高" || input === "低" ? input : "中";
}

function isDaoLyuProgressStage(stage: BondProgressStage): stage is (typeof DAO_LYU_PROGRESS_STAGES)[number] {
  return DAO_LYU_PROGRESS_STAGES.includes(stage as (typeof DAO_LYU_PROGRESS_STAGES)[number]);
}

function isDiscipleProgressStage(stage: BondProgressStage): stage is (typeof DISCIPLE_PROGRESS_STAGES)[number] {
  return DISCIPLE_PROGRESS_STAGES.includes(stage as (typeof DISCIPLE_PROGRESS_STAGES)[number]);
}

function buildStableSeed(...parts: Array<string | number | undefined>) {
  let hash = 2166136261;
  for (const part of parts) {
    const text = String(part ?? "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
  }
  return Math.abs(hash >>> 0);
}

function pickSeededWeighted<T>(
  items: readonly T[],
  seed: number,
  weightFn: (item: T) => number,
): T | undefined {
  const weighted = items
    .map((item) => ({ item, weight: Math.max(0, weightFn(item)) }))
    .filter((entry) => entry.weight > 0);
  if (!weighted.length) {
    return undefined;
  }
  const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = seed % total;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor < 0) {
      return entry.item;
    }
  }
  return weighted[weighted.length - 1]?.item;
}

function buildBondFlavorProfile(bond: CharacterBondView): BondFlavorProfile {
  const hiddenTraits = bond.actor.hiddenTraits ?? [];
  const jokeTag = hiddenTraits.find((item) => item.startsWith("整活耐受:"));
  const jokeTolerance = normalizeJokeTolerance(jokeTag?.split(":")[1]);
  const desiredScenes = hiddenTraits
    .filter((item) => item.startsWith("偏好场景:"))
    .map((item) => compactText(item.split(":")[1]))
    .filter(Boolean);

  return {
    adultTone: bond.actor.adultContentEnabled,
    jokeTolerance,
    desiredScenes,
  };
}

function deriveBondProgressStage(
  bondType: BondType,
  stage: string,
  stats: Pick<CharacterBondView, "intimacy" | "trust" | "loyalty" | "destiny">,
): BondProgressStage {
  if (bondType === DAO_LU) {
    const score = stats.intimacy * 0.42 + stats.trust * 0.2 + stats.destiny * 0.38;
    if (score >= 86) {
      return "同契";
    }
    if (score >= 68) {
      return "缠心";
    }
    if (score >= 50) {
      return "相偎";
    }
    if (score >= 28) {
      return "牵丝";
    }
    return "初识";
  }

  if (stage === STAGE_CANDIDATE) {
    return "观望";
  }
  const score = stats.intimacy * 0.16 + stats.trust * 0.38 + stats.loyalty * 0.46;
  if (score >= 82) {
    return "倚重";
  }
  if (score >= 64) {
    return "得力";
  }
  if (score >= 46) {
    return "亲随";
  }
  return "入门";
}

function describeBondProgressStage(bondType: BondType, progressStage: BondProgressStage) {
  if (bondType === DAO_LU && isDaoLyuProgressStage(progressStage)) {
    return DAO_LYU_STAGE_SUMMARY[progressStage];
  }
  if (bondType === DISCIPLE && isDiscipleProgressStage(progressStage)) {
    return DISCIPLE_STAGE_SUMMARY[progressStage];
  }
  return bondType === DAO_LU ? DAO_LYU_STAGE_SUMMARY.初识 : DISCIPLE_STAGE_SUMMARY.入门;
}

function pickFallbackFlatBlueprint(bond: CharacterBondView, turn: number) {
  const pool = bond.bondType === DAO_LU ? DAO_LU_EVENT_BLUEPRINTS : DISCIPLE_EVENT_BLUEPRINTS;
  const affinity =
    bond.bondType === DAO_LU
      ? bond.intimacy + bond.trust + bond.destiny
      : bond.trust + bond.loyalty + bond.intimacy;
  const index = Math.abs(bond.id * 17 + turn * 13 + affinity) % pool.length;
  return pool[index];
}

function nodeMatchesFlavor(node: EventTreeNode | EventBlueprint, bond: CharacterBondView, flavor: BondFlavorProfile) {
  if (node.requiresAdultTone && !flavor.adultTone) {
    return false;
  }
  if (node.minJokeTolerance && getJokeToleranceRank(flavor.jokeTolerance) < getJokeToleranceRank(node.minJokeTolerance)) {
    return false;
  }
  if ("allowedProgressStages" in node && node.allowedProgressStages && !node.allowedProgressStages.includes(bond.progressStage)) {
    return false;
  }
  return true;
}

function scoreEventNode(node: EventTreeNode | EventBlueprint, bond: CharacterBondView, flavor: BondFlavorProfile) {
  let score = "weight" in node ? node.weight ?? 1 : 1;
  if (node.preferredMoods?.some((item) => bond.mood.includes(item))) {
    score += 2;
  }
  if (node.preferredScenes?.some((item) => flavor.desiredScenes.includes(item))) {
    score += 2;
  }
  if (node.requiresAdultTone && flavor.adultTone) {
    score += 2;
  }
  if (node.minJokeTolerance) {
    score += Math.max(0, getJokeToleranceRank(flavor.jokeTolerance) - getJokeToleranceRank(node.minJokeTolerance) + 1);
  }
  return score;
}

function chooseEventSelectionFromTree(
  node: EventTreeNode,
  bond: CharacterBondView,
  flavor: BondFlavorProfile,
  seed: number,
  recentlyUsedKeys: Set<string>,
  branchPath: string[] = [],
): EventSelection | undefined {
  const children = (node.children ?? []).filter((item) => nodeMatchesFlavor(item, bond, flavor));
  if (children.length) {
    const child = pickSeededWeighted(children, seed, (item) => scoreEventNode(item, bond, flavor));
    if (child) {
      return chooseEventSelectionFromTree(
        child,
        bond,
        flavor,
        buildStableSeed(seed, child.key, bond.progressStage, bond.mood),
        recentlyUsedKeys,
        [...branchPath, child.label],
      );
    }
  }

  // 优先选未近期使用过的蓝图，避免重复
  const allBlueprints = (node.blueprints ?? []).filter((item) => nodeMatchesFlavor(item, bond, flavor));
  const freshBlueprints = allBlueprints.filter((item) => !recentlyUsedKeys.has(item.key));
  const blueprints = freshBlueprints.length > 0 ? freshBlueprints : allBlueprints;
  const blueprint = pickSeededWeighted(blueprints, seed, (item) => scoreEventNode(item, bond, flavor));
  if (!blueprints.length || !blueprint) {
    return undefined;
  }
  return {
    blueprint,
    branchPath: [...branchPath, blueprint.title],
  };
}

function chooseEventSelection(bond: CharacterBondView, turn: number): EventSelection {
  const flavor = buildBondFlavorProfile(bond);
  const root = bond.bondType === DAO_LU ? DAO_LYU_EVENT_TREE : DISCIPLE_EVENT_TREE;
  const seed = buildStableSeed(
    bond.id,
    turn,
    bond.progressStage,
    bond.mood,
    bond.intimacy,
    bond.trust,
    bond.loyalty,
    bond.destiny,
    flavor.jokeTolerance,
    flavor.desiredScenes.join("|"),
  );

  // 收集最近4次事件用过的蓝图key，避免选重
  const recentlyUsedKeys = new Set<string>(
    bond.memories
      .filter((m) => {
        const p = m.payload && typeof m.payload === "object" ? m.payload as Record<string, unknown> : {};
        return m.sourceType === "EVENT" && typeof p.eventType === "string";
      })
      .slice(-4)
      .map((m) => (m.payload as Record<string, unknown>).eventType as string),
  );

  return (
    chooseEventSelectionFromTree(root, bond, flavor, seed, recentlyUsedKeys, [root.label]) || {
      blueprint: pickFallbackFlatBlueprint(bond, turn),
      branchPath: [root.label, "平铺回退"],
    }
  );
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

function parseRuntimeStatus(runtime: Awaited<ReturnType<typeof loadRuntime>>) {
  if (!runtime?.currentPush?.status) {
    return undefined;
  }
  const statusResult = CharacterStatusSchema.safeParse(runtime.currentPush.status);
  return statusResult.success ? statusResult.data : undefined;
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
  const vibeKeywords = [
    "清冷",
    "温柔",
    "师姐",
    "师兄",
    "狐系",
    "黏人",
    "知性",
    "危险",
    "体贴",
    "嘴硬心软",
    "坏心眼",
    "会撩",
    "艳",
    "贵气",
    "御姐",
    "大姐姐",
    "甜辣",
    "纯欲",
    "妖女",
    "魅魔",
    "圣女",
    "丰润",
    "肉感",
    "坏女人",
  ];
  const traitKeywords = [
    "会照顾人",
    "嘴硬心软",
    "会撩",
    "爱吃醋",
    "稳重",
    "聪明",
    "毒舌",
    "乖",
    "疯",
    "护短",
    "会哄",
    "偏心",
    "勾人",
    "坏",
    "胸无大志",
    "魅魔感",
    "大姐姐",
    "会拿捏",
    "会揽腰",
    "会压近",
    "反差",
    "清纯脸",
    "坏女人",
    "腿精",
    "腰精",
    "丰润",
    "肉感",
  ];
  const sceneKeywords = [
    "并肩",
    "雨夜",
    "喝酒",
    "下棋",
    "双修",
    "夜谈",
    "秘境",
    "飞舟",
    "守灯",
    "并行",
    "上药",
    "贴肩",
    "理衣领",
    "温泉",
    "屏风",
    "更衣",
    "榻边",
    "沐发",
    "耳边",
    "揽腰",
    "屏风后",
    "换药",
  ];
  const desiredVibe = vibeKeywords.filter((item) => wishText.includes(item));
  const desiredTraits = traitKeywords.filter((item) => wishText.includes(item));
  const desiredScenes = sceneKeywords.filter((item) => wishText.includes(item));
  const adultTone = /(擦边|暧昧|会撩|黏人|身材|诱|勾人|撩|色气|腿|腰|锁骨|贴贴|亲近点|压近|会亲|会抱|耳边|低声|撩人|魅魔|胸无大志|大胸|丰润|丰腴|肉感|色系|纯欲|坏女人|腿精|腰精|揽腰|榻边|更衣|屏风|温泉)/.test(wishText);
  const jokeTolerance = /(整活|恶搞|沙雕|抽象|玩梗|搞笑|活宝)/.test(wishText)
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
  const desiredScenes = wish.desiredScenes.length ? wish.desiredScenes : sampleUnique(DAO_LYU_DEFAULT_SCENES, 2);
  const adultStyle = deriveDaoLyuAdultStyle(wish, rawWish);
  const traitPool = [
    ...DAO_LYU_BASE_TRAIT_POOL,
    ...(wish.adultTone ? DAO_LYU_ADULT_TRAIT_POOL : []),
    ...(wish.jokeTolerance === "高" ? DAO_LYU_JOKE_TRAIT_POOL : []),
  ];
  const publicTraits = wish.desiredTraits.length
    ? sampleUnique([...wish.desiredTraits, ...traitPool], 3)
    : sampleUnique(traitPool, 3);
  const speakingStyle = vibe.includes("清冷")
    ? "字少，却总能在你最狼狈时把话说到心口上。"
    : vibe.includes("温柔")
      ? "声线温缓，像是先替你想过了退路。"
      : wish.adultTone && adultStyle === "魅魔拉扯"
        ? "尾音天生带勾，明明在说正事，也像故意把你往更近处引。"
        : wish.adultTone && adultStyle === "御姐拿捏"
          ? "说话像拿着分寸和绳子，既会哄，也会把你按在她划出的界线里。"
          : wish.adultTone && adultStyle === "丰润压迫"
            ? "嗓音不急不缓，靠近时却总带着一种不讲理的压迫感。"
      : wish.adultTone
        ? "说话时声线总压得很低，像故意留一线余地给你心乱。"
        : "表面漫不经心，真正开口时分寸拿得很准。";
  const intimacy = wish.adultTone ? 24 : 18;
  const trust = 52;
  const loyalty = 58;
  const destiny = wish.adultTone ? 74 : 72;
  const progressStage = deriveBondProgressStage(DAO_LU, STAGE_ACTIVE, { intimacy, trust, loyalty, destiny });
  const mbtiTag = deriveDaoLyuMbti(vibe);

  return {
    bondType: DAO_LU,
    name: `${ramdomFirstName()}${ramdomLastName()}`,
    title: vibe.includes("师姐") ? "旧宗来客" : vibe.includes("师兄") ? "同路修士" : "命里来人",
    gender,
    age: 20 + Math.floor(Math.random() * 12),
    realm: level,
    appearance: buildDaoLyuAppearanceLine(vibe as string[], rawWish, wish),
    originSummary: `你曾许愿想遇到一个${compactText(rawWish, "能与你并肩走很远的人")}。此人像是顺着这份愿望，被因果慢慢推到了你面前。`,
    personalityTags: [...(vibe as string[]), mbtiTag],
    publicTraits,
    hiddenTraits: [
      wish.adultTone ? "暧昧阈值:高" : "暧昧阈值:低",
      `成人风格:${adultStyle}`,
      `整活耐受:${wish.jokeTolerance}`,
      ...desiredScenes.slice(0, 2).map((scene) => `偏好场景:${scene}`),
      wish.adultTone ? "擅长在安静处把距离压近" : "把情绪藏得比刀锋还深",
    ],
    speakingStyle,
    adultContentEnabled: wish.adultTone,
    summary: `你还没真正与此人走到命定一线，但风声和因果已经把对方推到了你身边。`,
    label: "天命道侣",
    intimacy,
    trust,
    loyalty,
    destiny,
    mood: "试探",
    progressStage,
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
    progressStage: "观望" as BondProgressStage,
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
  progressStage: string;
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
    progressStage: bond.progressStage as BondProgressStage,
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
          title: typeof payload.title === "string" ? payload.title : undefined,
          storyHook: typeof payload.storyHook === "string" ? payload.storyHook : undefined,
          eventType: typeof payload.eventType === "string" ? payload.eventType : undefined,
          turn: typeof payload.turn === "number" ? payload.turn : undefined,
        },
      };
    }),
  };
}

function getBondEventInterval(bondType: BondType) {
  return bondType === DAO_LU ? DAO_LU_EVENT_INTERVAL : DISCIPLE_EVENT_INTERVAL;
}

function chooseEventBlueprint(bond: CharacterBondView, turn: number) {
  return chooseEventSelection(bond, turn).blueprint;
}

function buildProgressMilestoneSummary(
  bond: CharacterBondView,
  fromStage: BondProgressStage,
  toStage: BondProgressStage,
) {
  if (bond.bondType === DAO_LU) {
    return `${bond.actor.name}与你的关系从“${fromStage}”推到“${toStage}”。${describeBondProgressStage(DAO_LU, toStage)}`;
  }
  return `${bond.actor.name}与你这一脉的师徒关系从“${fromStage}”走到“${toStage}”。${describeBondProgressStage(DISCIPLE, toStage)}`;
}

function buildBondStatePatch(
  bond: CharacterBondView,
  result: Pick<BondChatResult, "intimacyDelta" | "trustDelta" | "loyaltyDelta" | "destinyDelta" | "mood" | "relationshipSummary">,
  turn: number,
  nextEventTurn: number,
) {
  const nextStats = {
    intimacy: clamp(bond.intimacy + result.intimacyDelta, 0, 100),
    trust: clamp(bond.trust + result.trustDelta, 0, 100),
    loyalty: clamp(bond.loyalty + result.loyaltyDelta, 0, 100),
    destiny: clamp(bond.destiny + result.destinyDelta, 0, 100),
  };
  const nextProgressStage = deriveBondProgressStage(bond.bondType, bond.stage, nextStats);
  return {
    data: {
      mood: compactText(result.mood, bond.mood),
      summary: compactText(result.relationshipSummary, bond.summary || ""),
      intimacy: nextStats.intimacy,
      trust: nextStats.trust,
      loyalty: nextStats.loyalty,
      destiny: nextStats.destiny,
      progressStage: nextProgressStage,
      lastInteractionTurn: turn,
      nextEventTurn,
    } satisfies Prisma.CharacterBondUpdateInput,
    stageChanged: nextProgressStage !== bond.progressStage,
    nextProgressStage,
  };
}

function buildFallbackEventResult(bond: CharacterBondView, turn: number): BondEventResponseType {
  const blueprint = chooseEventBlueprint(bond, turn);
  const actorName = bond.actor.name;

  return {
    title: blueprint.title,
    summary: blueprint.summary.replace(/道侣|对方/g, actorName).replace(/弟子/g, actorName),
    storyHook: blueprint.storyHook.replace(/道侣|对方/g, actorName).replace(/弟子/g, actorName),
    mood: blueprint.mood,
    relationshipSummary: blueprint.relationshipSummary.replace(/对方/g, actorName),
    memorySummary: blueprint.memorySummary.replace(/对方/g, actorName).replace(/弟子/g, actorName),
    intimacyDelta: blueprint.intimacyDelta,
    trustDelta: blueprint.trustDelta,
    loyaltyDelta: blueprint.loyaltyDelta,
    destinyDelta: blueprint.destinyDelta,
  };
}

async function generateBondEventResult(bond: CharacterBondView, turn: number): Promise<BondEventResponseType> {
  const fallback = buildFallbackEventResult(bond, turn);
  const config = await ConfigService.getConfig("bond_event_prompt");
  if (!config?.model) {
    return fallback;
  }

  try {
    const modelInstance = createModelFromConfig(config.model);
    const providerOptions = getProviderOptions(config.model, config);
    const eventSelection = chooseEventSelection(bond, turn);
    const recentMemories = bond.memories
      .slice(0, 6)
      .map((item) => `- ${item.summary}`)
      .join("\n");
    const prompt = (config.userPrompt || "{EVENT_BLUEPRINT}")
      .replace(/\{BOND_PROFILE\}/g, JSON.stringify(bond.actor))
      .replace(/\{BOND_STATE\}/g, JSON.stringify({
        bondType: bond.bondType,
        label: bond.label,
        progressStage: bond.progressStage,
        progressSummary: describeBondProgressStage(bond.bondType, bond.progressStage),
        mood: bond.mood,
        intimacy: bond.intimacy,
        trust: bond.trust,
        loyalty: bond.loyalty,
        destiny: bond.destiny,
        adultTone: bond.actor.adultContentEnabled,
      }))
      .replace(/\{RECENT_MEMORIES\}/g, recentMemories || "暂无最近记忆")
      .replace(/\{EVENT_BLUEPRINT\}/g, JSON.stringify({
        ...eventSelection.blueprint,
        branchPath: eventSelection.branchPath,
      }))
      .replace(/\{FALLBACK_HINT\}/g, JSON.stringify(fallback));
    const { object } = await stableGenerateObject({
      model: modelInstance(config.model.name),
      providerOptions,
      schema: bondEventResponseSchema,
      system: config.systemPrompt || "",
      prompt,
      promptTemplate: "bond_event_prompt",
    });
    return bondEventResponseSchema.parse(object);
  } catch {
    return fallback;
  }
}

function buildMemoryTimeline(
  bonds: CharacterBondView[],
  limit = 8,
): BondTimelineEntryView[] {
  return bonds
    .flatMap((bond) => bond.memories.map((memory) => ({
      id: memory.id,
      bondId: bond.id,
      bondType: bond.bondType,
      actorName: bond.actor.name,
      label: bond.label,
      sourceType: memory.sourceType,
      summary: memory.summary,
      mood: memory.mood,
      createdAt: memory.createdAt,
      title: memory.payload?.title,
      storyHook: memory.payload?.storyHook,
      turn: memory.payload?.turn,
    })))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, limit);
}

function buildFeaturedEvent(
  timeline: BondTimelineEntryView[],
  currentTurn: number,
): BondEventView | undefined {
  const eventEntry = timeline.find((item) => item.sourceType === "EVENT" && item.turn === currentTurn)
    || timeline.find((item) => item.sourceType === "EVENT");

  if (!eventEntry || !eventEntry.title) {
    return undefined;
  }

  return {
    id: eventEntry.id,
    bondId: eventEntry.bondId,
    bondType: eventEntry.bondType,
    actorName: eventEntry.actorName,
    label: eventEntry.label,
    title: eventEntry.title,
    summary: eventEntry.summary,
    storyHook: eventEntry.storyHook,
    mood: eventEntry.mood,
    turn: eventEntry.turn,
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
      progressStage: draft.progressStage,
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

async function syncBondProgressStages(
  db: DbClient,
  bonds: NonNullable<Awaited<ReturnType<typeof loadRuntime>>>["bonds"],
) {
  for (const bond of bonds) {
    const expected = deriveBondProgressStage(bond.bondType as BondType, bond.stage, {
      intimacy: bond.intimacy,
      trust: bond.trust,
      loyalty: bond.loyalty,
      destiny: bond.destiny,
    });
    if (bond.progressStage !== expected) {
      await db.characterBond.update({
        where: { id: bond.id },
        data: { progressStage: expected },
      });
    }
  }
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
  // 防止并发竞争导致重复创建：若已存在 ACTIVE 道侣则直接将愿望标为已完成
  const existing = await db.characterBond.findFirst({
    where: { characterId, bondType: DAO_LU, stage: STAGE_ACTIVE },
  });
  if (existing) {
    await db.bondWish.update({
      where: { id: wish.id },
      data: { status: WISH_FULFILLED, fulfilledBondId: existing.id },
    });
    return;
  }

  const parsedWish = wish.structuredWish && typeof wish.structuredWish === "object"
    ? bondWishStructSchema.safeParse(wish.structuredWish).data
    : undefined;
  const draft = buildDaoLyuActorDraft(level, parsedWish || inferWishStructHeuristically(wish.rawWish), wish.rawWish);
  const bond = await createBondActorWithRelation(db, characterId, draft, turn, STAGE_ACTIVE);
  await addBondMemory(
    db,
    bond.id,
    "SYSTEM",
    `${draft.name}顺着你许下的愿望出现，自此与你结成了一段说不清来历、却很难撇开的道缘，关系落在“${draft.progressStage}”。`,
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

async function triggerBondEvent(
  db: DbClient,
  bond: Parameters<typeof serializeBond>[0],
  turn: number,
) {
  const serializedBond = serializeBond(bond);
  const result = await generateBondEventResult(serializedBond, turn);
  const eventSelection = chooseEventSelection(serializedBond, turn);
  const payload = {
    title: compactText(result.title, "关系异动"),
    storyHook: compactText(result.storyHook, ""),
    eventType: eventSelection.blueprint.key,
    branchPath: eventSelection.branchPath.join(" > "),
    turn,
  } satisfies Prisma.InputJsonObject;
  const patch = buildBondStatePatch(
    serializedBond,
    {
      intimacyDelta: result.intimacyDelta,
      trustDelta: result.trustDelta,
      loyaltyDelta: result.loyaltyDelta,
      destinyDelta: result.destinyDelta,
      mood: compactText(result.mood, serializedBond.mood),
      relationshipSummary: compactText(result.relationshipSummary, serializedBond.summary || ""),
    },
    turn,
    turn + getBondEventInterval(serializedBond.bondType),
  );

  await db.characterBond.update({
    where: { id: bond.id },
    data: patch.data,
  });

  await addBondMemory(
    db,
    bond.id,
    "EVENT",
    compactText(result.memorySummary, result.summary),
    compactText(result.mood, bond.mood),
    2,
    payload,
  );

  if (patch.stageChanged) {
    await addBondMemory(
      db,
      bond.id,
      "MILESTONE",
      buildProgressMilestoneSummary(serializedBond, serializedBond.progressStage, patch.nextProgressStage),
      compactText(result.mood, serializedBond.mood),
      3,
      {
        fromStage: serializedBond.progressStage,
        toStage: patch.nextProgressStage,
        turn,
      },
    );
  }
}

async function maybeTriggerBondEvents(
  db: DbClient,
  runtime: NonNullable<Awaited<ReturnType<typeof loadRuntime>>>,
  turn: number,
) {
  const activeBonds = runtime.bonds.filter((bond) => bond.stage === STAGE_ACTIVE);
  if (!activeBonds.length) {
    return;
  }

  const alreadyTriggered = activeBonds.some((bond) => bond.memories.some((memory) => {
    const payload = memory.payload && typeof memory.payload === "object" ? memory.payload as Record<string, unknown> : {};
    return memory.sourceType === "EVENT" && payload.turn === turn;
  }));

  if (alreadyTriggered) {
    return;
  }

  const dueBonds = activeBonds
    .filter((bond) => (bond.nextEventTurn ?? turn) <= turn)
    .sort((left, right) => {
      const leftScore = (left.bondType === DAO_LU ? 1000 : 0) - (left.nextEventTurn ?? turn);
      const rightScore = (right.bondType === DAO_LU ? 1000 : 0) - (right.nextEventTurn ?? turn);
      return rightScore - leftScore;
    });

  const selectedBond = dueBonds[0];
  if (!selectedBond) {
    return;
  }

  await triggerBondEvent(db, selectedBond, turn);
}

async function ensureBondRuntimeStateInternal(
  characterId: number,
  db: DbClient,
  overrideTurn?: number,
) {
  let runtime = await loadRuntime(characterId, db);
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

  await syncBondProgressStages(db, runtime.bonds);
  runtime = await loadRuntime(characterId, db);
  if (!runtime) {
    return runtime;
  }

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

  const refreshedRuntime = await loadRuntime(characterId, db);
  if (refreshedRuntime) {
    await maybeTriggerBondEvents(db, refreshedRuntime, turn);
  }

  return loadRuntime(characterId, db);
}

function buildHighlights(
  featuredEvent?: BondEventView,
  activeDaoLyu?: CharacterBondView,
  activeDisciples: CharacterBondView[] = [],
  candidates: CharacterBondView[] = [],
  wish?: BondWishView,
) {
  const highlights: string[] = [];
  if (featuredEvent) {
    highlights.push(`${featuredEvent.actorName}这边有新动静：${featuredEvent.title}。`);
  }
  if (activeDaoLyu) {
    highlights.push(`${activeDaoLyu.actor.name}已走到“${activeDaoLyu.progressStage}”，此刻气氛偏“${activeDaoLyu.mood}”。`);
  } else if (wish?.targetEncounterTurn) {
    highlights.push(`你许下的道侣愿望将在第${wish.targetEncounterTurn}回合前后应验。`);
  }
  if (activeDisciples.length) {
    const seniorDisciple = activeDisciples.find((item) => item.progressStage === "得力" || item.progressStage === "倚重");
    highlights.push(
      seniorDisciple
        ? `门下现有${activeDisciples.length}名弟子，其中${seniorDisciple.actor.name}已走到“${seniorDisciple.progressStage}”。`
        : `门下现有${activeDisciples.length}名弟子在跟着你长见识。`,
    );
  } else if (candidates.length) {
    highlights.push(`门墙外已有${candidates.length}名候选晚辈在等你点头。`);
  }
  if (!highlights.length) {
    highlights.push("你的命里还没有哪段关系真正落定，但风声已经开始动了。");
  }
  return highlights;
}

export async function getBondUiData(
  characterId: number,
  db: DbClient = prisma,
  overrideTurn?: number,
): Promise<BondUiPayload | undefined> {
  const runtime = await ensureBondRuntimeStateInternal(characterId, db, overrideTurn);
  if (!runtime?.currentPush?.status) {
    return undefined;
  }

  const statusResult = CharacterStatusSchema.safeParse(runtime.currentPush.status);
  if (!statusResult.success) {
    return undefined;
  }

  const status = statusResult.data;
  const level = status.等级;
  const currentTurn = overrideTurn ?? getCurrentTurn(status);
  const discipleSlots = getDiscipleSlotCount(level);
  const activeWish = runtime.bondWishes.find((wish) => wish.wishType === DAO_LU && wish.status === WISH_ACTIVE);
  const activeDaoLyu = runtime.bonds.find((bond) => bond.bondType === DAO_LU && bond.stage === STAGE_ACTIVE);
  const activeDisciples = runtime.bonds.filter((bond) => bond.bondType === DISCIPLE && bond.stage === STAGE_ACTIVE);
  const discipleCandidates = runtime.bonds.filter((bond) => bond.bondType === DISCIPLE && bond.stage === STAGE_CANDIDATE);

  const serializedDaoLyu = activeDaoLyu ? serializeBond(activeDaoLyu) : undefined;
  const serializedWish = activeWish ? serializeWish(activeWish) : undefined;
  const serializedDisciples = activeDisciples.map(serializeBond);
  const serializedCandidates = discipleCandidates.map(serializeBond);
  const timeline = buildMemoryTimeline(
    [
      ...(serializedDaoLyu ? [serializedDaoLyu] : []),
      ...serializedDisciples,
      ...serializedCandidates,
    ],
    10,
  );
  const featuredEvent = buildFeaturedEvent(timeline, currentTurn);

  return {
    overview: {
      hasDaoLyu: Boolean(serializedDaoLyu),
      discipleSlots,
      disciplesUsed: serializedDisciples.length,
      canWishForDaoLyu: isLevelAtLeast(level, "筑基") && !serializedDaoLyu && !serializedWish,
      canRecruitDisciples: discipleSlots > serializedDisciples.length,
      nextMajorEvent: featuredEvent
        ? `${featuredEvent.actorName}：${featuredEvent.title}`
        : serializedDaoLyu
        ? `${serializedDaoLyu.actor.name}常伴左右 · ${serializedDaoLyu.progressStage}`
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
    featuredEvent,
    memoryTimeline: timeline,
    recentHighlights: buildHighlights(featuredEvent, serializedDaoLyu, serializedDisciples, serializedCandidates, serializedWish),
  };
}

export async function maybeAdvanceBondWorld(
  characterId: number,
  nextTurn: number,
) {
  await ensureBondRuntimeStateInternal(characterId, prisma, nextTurn);
}

export async function getBondNarrativeContext(characterId: number, overrideTurn?: number) {
  const payload = await getBondUiData(characterId, prisma, overrideTurn);
  if (!payload) {
    return undefined;
  }

  const daoLyuSummary = payload.activeDaoLyu
    ? `${payload.activeDaoLyu.actor.name}（${payload.activeDaoLyu.label} / ${payload.activeDaoLyu.progressStage}）如今常在你身边，眼下情绪偏${payload.activeDaoLyu.mood}。${payload.activeDaoLyu.summary || payload.activeDaoLyu.actor.originSummary}`
    : payload.activeWish
      ? `你曾在突破后许下道侣心愿：${payload.activeWish.rawWish}。缘分尚未落定，但可以通过见闻、流言、同路人与因果暗线慢慢逼近。`
      : "眼下还没有真正落定的道侣关系。";

  const discipleSummary = payload.activeDisciples.length
    ? payload.activeDisciples
      .map((item) => `${item.actor.name}（${item.actor.realm}，${item.progressStage}，${item.mood}）`)
      .join("；")
    : payload.discipleCandidates.length
      ? `门墙外已有${payload.discipleCandidates.length}名候选晚辈在观望。`
      : "门下尚无值得点名的弟子。";

  const relationshipEventSummary = payload.featuredEvent
    ? `${payload.featuredEvent.actorName}眼下的关系事件是“${payload.featuredEvent.title}”：${payload.featuredEvent.summary}`
    : payload.memoryTimeline
      .filter((item) => item.sourceType === "EVENT")
      .slice(0, 2)
      .map((item) => `${item.actorName}：${item.summary}`)
      .join("；") || "眼下没有必须强行插入的关系事件。";

  return {
    RELATIONSHIP_SUMMARY: `${daoLyuSummary}\n${discipleSummary}\n最近关系事件：${relationshipEventSummary}`,
    RELATIONSHIP_PRIORITY_HOOK: payload.featuredEvent?.storyHook || "若本轮剧情合适，可优先让关键关系对象通过陪行、插话、来信、汇报、护短或顶嘴自然入场。",
    RELATIONSHIP_RULES: [
      "不要直接暴露亲密、信任、忠诚等隐藏数值。",
      "通过插话、陪行、来信、汇报、吃醋、护短、顶嘴、试探等方式侧写关系。",
      "道侣应当像长期陪伴者，而不是一次性彩蛋。",
      "若道侣已进入相偎、缠心、同契，可用理衣、借伞、贴肩、低声警告、亲手上药等克制动作表现成年人拉扯，但不要露骨。",
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

  const runtime = await loadRuntime(characterId, prisma);
  const runtimeStatus = parseRuntimeStatus(runtime);
  const currentTurn = runtimeStatus ? getCurrentTurn(runtimeStatus) : candidate.introducedAtTurn ?? 0;

  const occupied = new Set(payload.activeDisciples.map((item) => item.slotIndex).filter((item): item is number => typeof item === "number"));
  let slotIndex = 1;
  while (occupied.has(slotIndex)) {
    slotIndex += 1;
  }
  const trust = clamp(candidate.trust + 12, 0, 100);
  const loyalty = clamp(candidate.loyalty + 16, 0, 100);
  const progressStage = deriveBondProgressStage(DISCIPLE, STAGE_ACTIVE, {
    intimacy: candidate.intimacy,
    trust,
    loyalty,
    destiny: candidate.destiny,
  });

  await prisma.characterBond.update({
    where: { id: bondId },
    data: {
      stage: STAGE_ACTIVE,
      progressStage,
      slotIndex,
      label: slotIndex === 1 ? "首徒" : `门下弟子${slotIndex}`,
      trust,
      loyalty,
      summary: "你已正式点头收下此人，对方开始以你的名义行走和受训。",
      nextEventTurn: currentTurn + 2,
    },
  });
  await addBondMemory(
    prisma,
    bondId,
    "SYSTEM",
    `你点头收徒，对方从候选晚辈正式成了门下弟子，关系阶段落在“${progressStage}”。`,
    "敬服",
    2,
  );

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
  const daoLyuReply = bond.actor.adultContentEnabled && bond.progressStage === "同契"
    ? `${bond.actor.name}眸光在你脸上停了许久，顺手把你往近处带了一寸，嗓音低得发烫：“${trimmed.slice(0, 20)}……好。你既然敢撩到我跟前，就别想再一个人退回去。”`
    : bond.actor.adultContentEnabled && (bond.progressStage === "相偎" || bond.progressStage === "缠心")
      ? `${bond.actor.name}看了你一会儿，指节若有若无碰过你的衣袖，嗓音压得很低：“${trimmed.slice(0, 20)}……行。你别再一个人硬扛，我会先把你按稳，再陪你把后面的路走完。”`
      : `${bond.actor.name}听完后沉了片刻，低声道：“${trimmed.slice(0, 22)}……我记住了。你若真要走这一步，我陪着你。”`;
  return {
    reply: bond.bondType === DAO_LU
      ? daoLyuReply
      : `${bond.actor.name}抿了抿唇，还是先把腰板站直：“${trimmed.slice(0, 18)}……弟子记住了。你开口的事，我会先去做，再回来给你交代。”`,
    mood: bond.bondType === DAO_LU ? "靠近" : "认真",
    relationshipSummary: bond.bondType === DAO_LU
      ? `你们之间的距离比方才更近了一寸，关系仍停在“${bond.progressStage}”，却已经比刚才更烫。`
      : `对方把你的话记得很重，师徒关系停在“${bond.progressStage}”，敬意也更实了一层。`,
    memorySummary: `你与${bond.actor.name}谈及“${trimmed.slice(0, 18)}”，彼此的态度都比先前更明朗。`,
    intimacyDelta: bond.bondType === DAO_LU ? 2 : 0,
    trustDelta: 2,
    loyaltyDelta: bond.bondType === DISCIPLE ? 2 : 0,
    destinyDelta: bond.bondType === DAO_LU ? 1 : 0,
  };
}

export async function sendBondChatMessage(characterId: number, bondId: number, message: string) {
  let payload = await getBondUiData(characterId);
  let bond = payload?.activeDaoLyu?.id === bondId
    ? payload.activeDaoLyu
    : payload?.activeDisciples.find((item) => item.id === bondId);

  // payload 可能是旧缓存或首次刷新后状态未稳定，直接查 DB 确认后再重取一次
  if (!bond) {
    const dbBond = await prisma.characterBond.findFirst({
      where: { id: bondId, characterId, stage: STAGE_ACTIVE },
      select: { id: true },
    });
    if (!dbBond) {
      throw new Error("当前只能与已建立关系的对象对话");
    }
    payload = await getBondUiData(characterId);
    bond = payload?.activeDaoLyu?.id === bondId
      ? payload.activeDaoLyu
      : payload?.activeDisciples.find((item) => item.id === bondId);
    if (!bond) {
      throw new Error("当前只能与已建立关系的对象对话");
    }
  }
  if (!compactText(message)) {
    throw new Error("说点什么再开口");
  }

  const runtime = await loadRuntime(characterId, prisma);
  const runtimeStatus = parseRuntimeStatus(runtime);
  const currentTurn = runtimeStatus ? getCurrentTurn(runtimeStatus) : bond.lastInteractionTurn ?? 0;

  const recentMemories = bond.memories
    .slice(0, 6)
    .map((item) => `- ${item.summary}`)
    .join("\n");

  // 查询主线剧情中含有道侣姓名的最近片段，作为聊天上下文注入
  const recentMainStorySegments = await prisma.storySegment.findMany({
    where: {
      characterId,
      content: { contains: bond.actor.name },
    },
    orderBy: { createdAt: "desc" },
    take: 3,
    select: { content: true },
  });
  const recentMainStory = recentMainStorySegments.length
    ? recentMainStorySegments.map((s, i) => `[主线片段${i + 1}] ${s.content}`).join("\n\n")
    : "";

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
          progressStage: bond.progressStage,
          progressSummary: describeBondProgressStage(bond.bondType, bond.progressStage),
          mood: bond.mood,
          intimacy: bond.intimacy,
          trust: bond.trust,
          loyalty: bond.loyalty,
          destiny: bond.destiny,
          adultTone: bond.actor.adultContentEnabled,
        }))
        .replace(/\{RECENT_MEMORIES\}/g, recentMemories || "暂无最近记忆")
        .replace(/\{RECENT_MAIN_STORY\}/g, recentMainStory || "近期主线中暂无与此人直接相关的剧情")
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

  const patch = buildBondStatePatch(
    bond,
    {
      intimacyDelta: result.intimacyDelta,
      trustDelta: result.trustDelta,
      loyaltyDelta: result.loyaltyDelta,
      destinyDelta: result.destinyDelta,
      mood: compactText(result.mood, bond.mood),
      relationshipSummary: compactText(result.relationshipSummary, bond.summary || ""),
    },
    currentTurn,
    Math.min(bond.nextEventTurn ?? Number.MAX_SAFE_INTEGER, currentTurn + 2),
  );

  await prisma.characterBond.update({
    where: { id: bondId },
    data: patch.data,
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
      turn: currentTurn,
    },
  );
  if (patch.stageChanged) {
    await addBondMemory(
      prisma,
      bondId,
      "MILESTONE",
      buildProgressMilestoneSummary(bond, bond.progressStage, patch.nextProgressStage),
      compactText(result.mood, bond.mood),
      3,
      {
        fromStage: bond.progressStage,
        toStage: patch.nextProgressStage,
        turn: currentTurn,
      },
    );
  }

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

export async function renameBondActorByBondId(
  characterId: number,
  bondId: number,
  newName: string,
) {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error("名字不能为空");

  const bond = await prisma.characterBond.findFirst({
    where: { id: bondId, characterId },
    select: { actorId: true },
  });
  if (!bond) throw new Error("未找到对应的羁绊");

  await prisma.bondActor.update({
    where: { id: bond.actorId },
    data: { name: trimmed },
  });

  return getBondUiData(characterId);
}

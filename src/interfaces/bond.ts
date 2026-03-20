export type BondType = "DAO_LU" | "DISCIPLE";
export type BondStage = "WISHING" | "CANDIDATE" | "ACTIVE" | "ARCHIVED";

export interface BondMemoryView {
  id: number;
  sourceType: string;
  summary: string;
  mood?: string;
  importance: number;
  createdAt: string;
  payload?: {
    user?: string;
    bond?: string;
    title?: string;
    storyHook?: string;
    eventType?: string;
    turn?: number;
  };
}

export interface BondEventView {
  id: number;
  bondId: number;
  bondType: BondType;
  actorName: string;
  label: string;
  title: string;
  summary: string;
  storyHook?: string;
  mood?: string;
  turn?: number;
}

export interface BondTimelineEntryView {
  id: number;
  bondId: number;
  bondType: BondType;
  actorName: string;
  label: string;
  sourceType: string;
  summary: string;
  mood?: string;
  createdAt: string;
  title?: string;
  storyHook?: string;
  turn?: number;
}

export interface BondActorView {
  id: number;
  bondType: BondType;
  name: string;
  title?: string;
  gender: string;
  age: number;
  realm: string;
  appearance: string;
  originSummary: string;
  personalityTags: string[];
  publicTraits: string[];
  hiddenTraits?: string[];
  speakingStyle: string;
  adultContentEnabled: boolean;
}

export interface CharacterBondView {
  id: number;
  bondType: BondType;
  stage: BondStage;
  status: string;
  slotIndex?: number;
  label: string;
  intimacy: number;
  trust: number;
  loyalty: number;
  destiny: number;
  mood: string;
  summary?: string;
  introducedAtTurn?: number;
  lastInteractionTurn?: number;
  nextEventTurn?: number;
  actor: BondActorView;
  memories: BondMemoryView[];
}

export interface BondWishView {
  id: number;
  wishType: BondType;
  rawWish: string;
  status: string;
  targetEncounterTurn?: number;
  fulfilledBondId?: number;
  structuredWish?: {
    desiredVibe: string[];
    desiredTraits: string[];
    desiredScenes: string[];
    adultTone: boolean;
    jokeTolerance: "低" | "中" | "高";
  };
}

export interface BondOverviewView {
  hasDaoLyu: boolean;
  discipleSlots: number;
  disciplesUsed: number;
  canWishForDaoLyu: boolean;
  canRecruitDisciples: boolean;
  nextMajorEvent: string;
  nextRefreshHint: string;
}

export interface BondUiPayload {
  overview: BondOverviewView;
  activeDaoLyu?: CharacterBondView;
  activeWish?: BondWishView;
  activeDisciples: CharacterBondView[];
  discipleCandidates: CharacterBondView[];
  featuredEvent?: BondEventView;
  memoryTimeline: BondTimelineEntryView[];
  recentHighlights: string[];
}

export interface BondChatResult {
  reply: string;
  mood: string;
  relationshipSummary: string;
  memorySummary: string;
  intimacyDelta: number;
  trustDelta: number;
  loyaltyDelta: number;
  destinyDelta: number;
}

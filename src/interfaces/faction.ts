export interface FactionPalette {
  primary: string;
  accent: string;
  glow: string;
}

export interface FactionWorldSummary {
  id: number;
  name: string;
  seed: string;
  worldTurn: number;
  season: string;
  timePhase: string;
  newsSummary: string;
}

export interface FactionNodeView {
  id: number;
  name: string;
  type: string;
  terrain: string;
  positionX: number;
  positionY: number;
  prosperity: number;
  danger: number;
  resourceTags: string[];
  neighborNodeIds: number[];
  ownerFactionId?: number;
  ownerFactionName?: string;
  ownerFactionPalette?: FactionPalette;
  isCapital?: boolean;
}

export interface FactionView {
  id: number;
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
  goal: string;
  capitalNodeId?: number;
  controlledNodeIds: number[];
  playerFacingSummary?: string;
  currentPlan?: string;
  powerScore: number;
  palette: FactionPalette;
}

export interface FactionRelationView {
  id: number;
  fromFactionId: number;
  toFactionId: number;
  relationType: string;
  relationScore: number;
  lastReason?: string;
}

export interface FactionSignalView {
  factionId: number;
  name: string;
  posture: string;
  threat: "低" | "中" | "高";
  read: string;
  leverage: string;
  palette: FactionPalette;
}

export interface FactionClueView {
  id: string;
  title: string;
  summary: string;
  source: string;
  certainty: "风闻" | "旁证" | "坐实";
  heat: "微澜" | "暗涌" | "炽烈";
  factionId?: number;
  nodeId?: number;
}

export interface FactionMissionView {
  id: number;
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
  targetNodeId?: number;
  targetNodeName?: string;
}

export interface FactionMissionBriefView {
  title: string;
  summary: string;
  urgency: string;
  progressHint: string;
  suggestedApproach: string;
  targetLabel?: string;
}

export interface WorldEventView {
  id: number;
  turn: number;
  type: string;
  title: string;
  summary: string;
  importance: number;
  factionId?: number;
  secondaryFactionId?: number;
  createdAt: string;
}

export interface CharacterFactionStateView {
  factionId: number;
  factionName: string;
  factionTitle: string;
  factionType: string;
  rank: string;
  factionRole: string;
  factionExpectation: string;
  contribution: number;
  trust: number;
  militaryCredit: number;
  politicalStanding: number;
  factionGoalProgress: number;
  currentNodeId?: number;
  currentNodeName?: string;
}

export interface FactionPlayerLensView {
  currentTheater: string;
  currentClimate: string;
  pressure: string;
  opportunity: string;
  nextPulse: string;
}

export interface FactionUiPayload {
  world: FactionWorldSummary;
  playerFaction: FactionView;
  playerState: CharacterFactionStateView;
  factions: FactionView[];
  mapNodes: FactionNodeView[];
  relations: FactionRelationView[];
  recentEvents: WorldEventView[];
  activeMission?: FactionMissionView;
  missionBrief?: FactionMissionBriefView;
  playerLens: FactionPlayerLensView;
  factionSignals: FactionSignalView[];
  intelRumors: FactionClueView[];
}

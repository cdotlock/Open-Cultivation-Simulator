"use client";

import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  FactionClueView,
  FactionMissionBriefView,
  FactionNodeView,
  FactionPlayerLensView,
  FactionSignalView,
  FactionUiPayload,
  FactionView,
  WorldEventView,
} from "@/interfaces/faction";
import { $img } from "@/utils";

function toneStyle(color: string) {
  return {
    background: `linear-gradient(135deg, ${color}, rgba(255,255,255,0.16))`,
    boxShadow: `0 10px 24px ${color.replace("1)", "0.18)")}`,
  };
}

function panelSurface() {
  return {
    background: `linear-gradient(140deg, rgba(252,247,238,0.96), rgba(240,229,209,0.94)), url(${$img("share-item-bg")}) center/cover no-repeat`,
  };
}

function tagClass(tone: "soft" | "warn" | "dark" = "soft") {
  const mapping = {
    soft: "bg-[rgba(255,250,242,0.9)] text-[#7a5f3d]",
    warn: "bg-[rgba(100,56,28,0.92)] text-[#f3dfba]",
    dark: "bg-[rgba(54,36,20,0.92)] text-[#f6ead2]",
  } as const;
  return mapping[tone];
}

function nodePressure(node?: FactionNodeView) {
  if (!node) {
    return "地界未明";
  }
  if (node.danger >= 65) {
    return "刀口翻浪";
  }
  if (node.danger >= 44) {
    return "暗潮逼人";
  }
  if (node.danger >= 28) {
    return "风线绷着";
  }
  return "尚算稳当";
}

function nodeProsperity(node?: FactionNodeView) {
  if (!node) {
    return "路数未显";
  }
  if (node.prosperity >= 72) {
    return "财路通亮";
  }
  if (node.prosperity >= 54) {
    return "来路尚稳";
  }
  if (node.prosperity >= 38) {
    return "只够周转";
  }
  return "地气偏薄";
}

function certaintyTone(certainty: FactionClueView["certainty"]) {
  if (certainty === "坐实") {
    return "dark";
  }
  if (certainty === "旁证") {
    return "warn";
  }
  return "soft";
}

function threatTone(threat: FactionSignalView["threat"]) {
  if (threat === "高") {
    return "warn";
  }
  if (threat === "中") {
    return "dark";
  }
  return "soft";
}

function trimPanelText(text: string | undefined, fallback: string) {
  const normalized = (text || "").replace(/\s+/g, " ").trim();
  if (!normalized) {
    return fallback;
  }
  return normalized.length > 54 ? `${normalized.slice(0, 54)}...` : normalized;
}

function rankingAura(index: number) {
  if (index === 0) {
    return "鼎盛";
  }
  if (index === 1) {
    return "上扬";
  }
  if (index === 2) {
    return "盘踞";
  }
  if (index === 3) {
    return "守线";
  }
  return "藏锋";
}

function eventImportanceLabel(importance: number) {
  if (importance >= 3) {
    return "大事";
  }
  if (importance >= 2) {
    return "要闻";
  }
  return "风声";
}

function PanelHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <div className="text-[10px] tracking-[0.22em] text-[#8a6a45]">{eyebrow}</div>
        <div className="mt-1 text-[18px] text-[#2f2217]">{title}</div>
      </div>
      {action}
    </div>
  );
}

export function FactionStoryStrip({
  data,
  onOpenWorld,
}: {
  data: FactionUiPayload;
  onOpenWorld: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="w-full">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] border border-[rgba(137,103,54,0.22)] px-4 py-3 text-left shadow-[0_12px_28px_rgba(54,32,12,0.12)]"
        style={panelSurface()}
      >
        <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("mask-repect")}) center/36% repeat` }} />
        <div
          className="relative z-10 flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[14px] font-semibold text-white"
          style={toneStyle(data.playerFaction.palette.primary)}
        >
          势
        </div>
        <div className="relative z-10 min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[11px] text-[#6f5536]">
            <span>{data.playerFaction.name}</span>
            <span>·</span>
            <span>{data.playerState.rank}</span>
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[#2f2217]">{data.playerLens.currentClimate}</div>
        </div>
        <div className="relative z-10 shrink-0 rounded-full px-3 py-1 text-[10px] tracking-[0.14em] text-[#7d6341]">
          {expanded ? "收起" : "展开"}
        </div>
      </button>

      {expanded ? (
        <div
          className="relative mt-2 overflow-hidden rounded-[22px] border border-[rgba(137,103,54,0.18)] px-4 py-4 shadow-[0_12px_28px_rgba(54,32,12,0.10)]"
          style={panelSurface()}
        >
          <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("bg")}) center/cover no-repeat` }} />
          <div className="relative z-10 space-y-3">
            <div>
              <div className="text-[10px] tracking-[0.18em] text-[#8c6c45]">帮中口风</div>
              <div className="mt-2 text-[11px] leading-[1.8] text-[#463424]">{data.playerLens.pressure}</div>
            </div>
            <div className="rounded-[18px] bg-[rgba(255,250,242,0.9)] px-4 py-3">
              <div className="text-[10px] tracking-[0.16em] text-[#8a6a45]">下一拍</div>
              <div className="mt-2 text-[11px] leading-[1.7] text-[#3f2f20]">{data.playerLens.nextPulse}</div>
            </div>
            {data.missionBrief ? (
              <div className="rounded-[18px] bg-[rgba(63,43,23,0.92)] px-4 py-3 text-[#f6ead2]">
                <div className="text-[10px] tracking-[0.16em] text-[#d5c099]">门中密简</div>
                <div className="mt-2 text-[13px]">{data.missionBrief.title}</div>
                <div className="mt-2 text-[10px] leading-[1.7] text-[#e0cfaf]">
                  {data.missionBrief.progressHint}
                </div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={onOpenWorld}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[11px] tracking-[0.12em] text-[#f2dfbc]"
            >
              前往天下势力图
              <span>›</span>
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FactionPortalCard({
  data,
  onOpenWorld,
}: {
  data: FactionUiPayload;
  onOpenWorld: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpenWorld}
      className="relative w-full overflow-hidden rounded-[24px] border border-[rgba(137,103,54,0.24)] px-4 py-4 text-left shadow-[0_14px_30px_rgba(54,32,12,0.12)]"
      style={panelSurface()}
    >
      <div className="absolute inset-0 opacity-[0.12]" style={{ background: `url(${$img("mask-repect")}) center/32% repeat` }} />
      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">帮派密简</div>
          <div className={`rounded-full px-3 py-1 text-[10px] ${tagClass("soft")}`}>
            {data.world.season} · {data.world.timePhase}
          </div>
        </div>
        <div className="mt-2 text-[15px] text-[#2f2217]">{data.playerLens.currentTheater}</div>
        <div className="mt-2 text-[11px] leading-[1.7] text-[#5b4327]">{data.playerLens.pressure}</div>
        <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[11px] tracking-[0.12em] text-[#f2dfbc]">
          打开天下势力图
          <span>›</span>
        </div>
      </div>
    </button>
  );
}

export function FactionNodeReportCard({
  node,
  lens,
}: {
  node?: FactionNodeView;
  lens: FactionPlayerLensView;
}) {
  const tagLine = useMemo(() => {
    if (!node) {
      return [];
    }
    return [
      node.terrain,
      nodePressure(node),
      nodeProsperity(node),
      ...(node.resourceTags.slice(0, 2) || []),
    ];
  }, [node]);

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]" style={panelSurface()}>
      <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("mask-repect")}) center/36% repeat` }} />
      <div className="relative z-10">
        <PanelHeader eyebrow="驻点纪要" title={node?.name || "未知地界"} />
        <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
          {tagLine.map((tag) => (
            <div key={tag} className={`rounded-full px-3 py-1 ${tagClass("soft")}`}>
              {tag}
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-[20px] bg-[rgba(255,250,242,0.9)] px-4 py-4">
          <div className="text-[10px] tracking-[0.16em] text-[#8a6a45]">眼下局势</div>
          <div className="mt-2 text-[12px] leading-[1.8] text-[#3f2f20]">{lens.currentClimate}</div>
        </div>
        <div className="mt-3 rounded-[20px] bg-[rgba(63,43,23,0.92)] px-4 py-4 text-[#f6ead2]">
          <div className="text-[10px] tracking-[0.16em] text-[#d5c099]">可借之机</div>
          <div className="mt-2 text-[11px] leading-[1.8]">{lens.opportunity}</div>
        </div>
      </div>
    </section>
  );
}

export function FactionMissionFieldNote({
  mission,
}: {
  mission?: FactionMissionBriefView;
}) {
  if (!mission) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]" style={panelSurface()}>
      <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("share-item-bg")}) center/cover no-repeat` }} />
      <div className="relative z-10">
        <PanelHeader eyebrow="门中密令" title={mission.title} />
        {mission.targetLabel ? (
          <div className="mt-2 text-[10px] text-[#7a5f3d]">落点：{mission.targetLabel}</div>
        ) : null}
        <div className="mt-3 text-[12px] leading-[1.8] text-[#3f2f20]">{mission.summary}</div>
        <div className="mt-3 rounded-[18px] bg-[rgba(255,250,242,0.9)] px-4 py-3">
          <div className="text-[10px] tracking-[0.16em] text-[#8a6a45]">局势判断</div>
          <div className="mt-2 text-[11px] leading-[1.7] text-[#4b3928]">{mission.urgency}</div>
        </div>
        <div className="mt-3 flex flex-col gap-2 rounded-[18px] bg-[rgba(63,43,23,0.92)] px-4 py-3 text-[#f6ead2]">
          <div className="text-[11px] leading-[1.7]">{mission.progressHint}</div>
          <div className="text-[10px] leading-[1.7] text-[#d9c7a7]">{mission.suggestedApproach}</div>
        </div>
      </div>
    </section>
  );
}

export function FactionSignalCluster({
  signals,
}: {
  signals: FactionSignalView[];
}) {
  if (!signals.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]" style={panelSurface()}>
      <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("bg")}) center/cover no-repeat` }} />
      <div className="relative z-10">
        <PanelHeader eyebrow="势力征兆" title="几股风向" />
        <div className="mt-3 space-y-3">
          {signals.map((signal) => (
            <div key={signal.factionId} className="rounded-[22px] bg-[rgba(255,250,242,0.88)] px-4 py-4 shadow-[0_10px_24px_rgba(54,35,16,0.06)]">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="h-[12px] w-[12px] rounded-full"
                    style={{ background: signal.palette.primary, boxShadow: `0 0 16px ${signal.palette.glow}` }}
                  />
                  <div>
                    <div className="text-[14px] text-[#2f2217]">{signal.name}</div>
                    <div className="mt-1 text-[10px] text-[#8a6a45]">{signal.posture}</div>
                  </div>
                </div>
                <div className={`rounded-full px-3 py-1 text-[10px] ${tagClass(threatTone(signal.threat))}`}>
                  风险 {signal.threat}
                </div>
              </div>
              <div className="mt-3 text-[11px] leading-[1.7] text-[#4a3828]">{signal.read}</div>
              <div className="mt-2 text-[10px] leading-[1.7] text-[#7a5f3d]">{signal.leverage}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FactionRumorLedger({
  clues,
}: {
  clues: FactionClueView[];
}) {
  if (!clues.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]" style={panelSurface()}>
      <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("share-item-bg")}) center/cover no-repeat` }} />
      <div className="relative z-10">
        <PanelHeader eyebrow="风闻簿" title="近来风声" />
        <div className="mt-3 space-y-3">
          {clues.map((clue) => (
            <div key={clue.id} className="rounded-[20px] bg-[rgba(255,250,242,0.88)] px-4 py-4 shadow-[0_10px_24px_rgba(54,35,16,0.06)]">
              <div className="flex items-center justify-between gap-3">
                <div className="text-[13px] text-[#2f2217]">{clue.title}</div>
                <div className="flex gap-2">
                  <div className={`rounded-full px-3 py-1 text-[10px] ${tagClass(certaintyTone(clue.certainty))}`}>
                    {clue.certainty}
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] ${tagClass("soft")}`}>
                    {clue.heat}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] leading-[1.7] text-[#4a3828]">{clue.summary}</div>
              <div className="mt-2 text-[10px] tracking-[0.12em] text-[#8a6a45]">{clue.source}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FactionRankingLedger({
  factions,
  playerFactionId,
}: {
  factions: FactionView[];
  playerFactionId: number;
}) {
  if (!factions.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]" style={panelSurface()}>
      <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("share-item-bg")}) center/cover no-repeat` }} />
      <div className="relative z-10">
        <PanelHeader eyebrow="天下势力榜" title="诸家位次" />
        <div className="mt-3 space-y-3">
          {factions.slice(0, 5).map((faction, index) => {
            const isPlayerFaction = faction.id === playerFactionId;
            return (
              <div key={faction.id} className={`rounded-[20px] px-4 py-4 shadow-[0_10px_24px_rgba(54,35,16,0.06)] ${isPlayerFaction ? "bg-[rgba(72,46,25,0.92)] text-[#f6ead2]" : "bg-[rgba(255,250,242,0.88)] text-[#2f2217]"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-[24px] w-[24px] items-center justify-center rounded-full text-[11px] text-white"
                      style={toneStyle(faction.palette.primary)}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <div className="text-[14px]">{faction.name}</div>
                      <div className={`mt-1 text-[10px] ${isPlayerFaction ? "text-[#dcc8a5]" : "text-[#8a6a45]"}`}>
                        {faction.title} · {rankingAura(index)}
                      </div>
                    </div>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] ${isPlayerFaction ? tagClass("warn") : tagClass("soft")}`}>
                    {isPlayerFaction ? "本帮" : faction.styleTags[0] || faction.type}
                  </div>
                </div>
                <div className={`mt-3 text-[11px] leading-[1.7] ${isPlayerFaction ? "text-[#f1e2c4]" : "text-[#4a3828]"}`}>
                  {trimPanelText(faction.currentPlan || faction.playerFacingSummary || faction.goal, `${faction.name}暂未露出更多口风。`)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function FactionChroniclePanel({
  events,
  playerFactionId,
}: {
  events: WorldEventView[];
  playerFactionId: number;
}) {
  if (!events.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]" style={panelSurface()}>
      <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("bg")}) center/cover no-repeat` }} />
      <div className="relative z-10">
        <PanelHeader eyebrow="世界事件时间线" title="近几轮纪要" />
        <div className="mt-3 space-y-3">
          {events.slice(0, 6).map((event) => {
            const touchesPlayer = event.factionId === playerFactionId || event.secondaryFactionId === playerFactionId;
            return (
              <div key={event.id} className={`rounded-[20px] px-4 py-4 shadow-[0_10px_24px_rgba(54,35,16,0.06)] ${touchesPlayer ? "bg-[rgba(72,46,25,0.92)] text-[#f6ead2]" : "bg-[rgba(255,250,242,0.88)] text-[#2f2217]"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[10px] tracking-[0.12em]">
                    第{event.turn}轮
                  </div>
                  <div className={`rounded-full px-3 py-1 text-[10px] ${touchesPlayer ? tagClass("warn") : tagClass(event.importance >= 2 ? "dark" : "soft")}`}>
                    {touchesPlayer ? "牵涉本帮" : eventImportanceLabel(event.importance)}
                  </div>
                </div>
                <div className="mt-2 text-[13px]">{event.title}</div>
                <div className={`mt-2 text-[11px] leading-[1.7] ${touchesPlayer ? "text-[#eadab8]" : "text-[#4a3828]"}`}>
                  {trimPanelText(event.summary, "这一轮的风声还没完全落定。")}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

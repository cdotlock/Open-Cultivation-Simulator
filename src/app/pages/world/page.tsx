"use client";

import { useEffect, useMemo, useState } from "react";
import { useRecoilValue } from "recoil";
import { useSearchParams, useRouter } from "next/navigation";
import { characterState } from "@/app/store";
import { FactionUiPayload } from "@/interfaces/faction";
import { FactionMapCanvas } from "@/app/components/faction/FactionMapCanvas";
import {
  FactionChroniclePanel,
  FactionMissionFieldNote,
  FactionNodeReportCard,
  FactionRankingLedger,
  FactionRumorLedger,
  FactionSignalCluster,
} from "@/app/components/faction/FactionPanels";
import { $img } from "@/utils";

function surfaceStyle() {
  return {
    background: `linear-gradient(140deg, rgba(252,247,238,0.96), rgba(240,229,209,0.94)), url(${$img("share-item-bg")}) center/cover no-repeat`,
  };
}

export default function WorldPage() {
  const char = useRecoilValue(characterState);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [payload, setPayload] = useState<FactionUiPayload | undefined>(char?.factionData);
  const [loading, setLoading] = useState(!char?.factionData);
  const [expandedMap, setExpandedMap] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(char?.factionData?.playerState.currentNodeId || null);

  const characterId = useMemo(() => {
    const fromQuery = Number(searchParams.get("characterId") || "");
    if (Number.isFinite(fromQuery) && fromQuery > 0) {
      return fromQuery;
    }
    return char?.id;
  }, [char?.id, searchParams]);

  useEffect(() => {
    if (!characterId) {
      router.push("/");
      return;
    }

    setLoading(true);
    fetch(`/api/faction-snapshot?characterId=${characterId}`)
      .then((response) => response.json())
      .then((result) => setPayload(result || undefined))
      .finally(() => setLoading(false));
  }, [characterId, router]);

  useEffect(() => {
    if (!payload) {
      return;
    }

    setSelectedNodeId((current) => current ?? (payload.playerState.currentNodeId || payload.mapNodes[0]?.id || null));
  }, [payload]);

  useEffect(() => {
    if (!expandedMap) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [expandedMap]);

  if (loading || !payload) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2EBD9] text-[#5f4525]">
        天下势力图正在铺陈...
      </div>
    );
  }

  const selectedNode =
    payload.mapNodes.find((node) => node.id === selectedNodeId) ||
    payload.mapNodes.find((node) => node.id === payload.playerState.currentNodeId) ||
    payload.mapNodes[0];

  return (
    <div className="min-h-screen bg-[#F2EBD9] pb-10">
      <div className="relative min-h-full w-full">
        <img className="pointer-events-none absolute left-0 top-0 w-full mix-blend-overlay" src={$img("bg")} alt="bg" />

        <div className="relative z-10 mx-auto w-full max-w-[1280px] px-4 py-5 xl:px-6">
          <section
            className="relative overflow-hidden rounded-[30px] border border-[rgba(142,109,63,0.22)] px-5 py-5 shadow-[0_20px_48px_rgba(54,35,16,0.12)]"
            style={surfaceStyle()}
          >
            <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("mask-repect")}) center/36% repeat` }} />
            <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] tracking-[0.24em] text-[#8a6a45]">天下沙盘</div>
                <div className="mt-1 text-[24px] text-[#2f2217]">{payload.world.name}</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#7b5d3a]">
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">{payload.playerFaction.name}</div>
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">{payload.playerState.rank}</div>
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">{payload.world.season} · {payload.world.timePhase}</div>
                </div>
                <div className="mt-4 text-[12px] leading-[1.8] text-[#6a5234]">{payload.world.newsSummary}</div>
                <div className="mt-4 rounded-[20px] bg-[rgba(255,250,242,0.9)] px-4 py-4">
                  <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">眼下最该记住的一句</div>
                  <div className="mt-2 text-[12px] leading-[1.8] text-[#3f2f20]">{payload.playerLens.nextPulse}</div>
                </div>
              </div>

              <div className="flex shrink-0 gap-2 self-start">
                <button
                  type="button"
                  onClick={() => router.push("/")}
                  className="rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[12px] tracking-[0.14em] text-[#f2dfbc]"
                >
                  回到当前剧情
                </button>
              </div>
            </div>
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.18fr,0.82fr]">
            <section
              className="relative overflow-hidden rounded-[30px] border border-[rgba(137,103,54,0.22)] px-4 py-4 shadow-[0_18px_42px_rgba(54,35,16,0.10)]"
              style={surfaceStyle()}
            >
              <div className="absolute inset-0 opacity-[0.10]" style={{ background: `url(${$img("bg")}) center/cover no-repeat` }} />
              <div className="relative z-10">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-[10px] tracking-[0.22em] text-[#8a6a45]">横向缩略沙盘</div>
                    <div className="mt-1 text-[15px] text-[#2f2217]">当前落子</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {payload.factionSignals.map((signal) => (
                      <div
                        key={signal.factionId}
                        className="rounded-full border border-[rgba(255,245,220,0.34)] px-3 py-1 text-[10px] text-[#fff2d8] shadow-[0_8px_18px_rgba(39,26,12,0.12)]"
                        style={{ background: `linear-gradient(135deg, ${signal.palette.primary}, rgba(43,30,18,0.88))` }}
                      >
                        {signal.name}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <FactionMapCanvas
                    data={payload}
                    mode="preview"
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                  />
                </div>

                <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex flex-wrap gap-2 text-[10px] text-[#7a5e3e]">
                    <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">
                      当前焦点：{selectedNode?.name || "未知地界"}
                    </div>
                    <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">
                      {selectedNode?.ownerFactionName || "无主势力"} · {selectedNode?.terrain || "未定"}
                    </div>
                    {selectedNode?.resourceTags.slice(0, 2).map((tag) => (
                      <div key={tag} className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">
                        {tag}
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => setExpandedMap(true)}
                    className="rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[11px] tracking-[0.12em] text-[#f2dfbc]"
                  >
                    展开大沙盘
                  </button>
                </div>
              </div>
            </section>

            <div className="grid gap-4">
              <FactionNodeReportCard node={selectedNode} lens={payload.playerLens} />
              <FactionMissionFieldNote mission={payload.missionBrief} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[0.94fr,1.06fr]">
            <FactionSignalCluster signals={payload.factionSignals} />
            <FactionRumorLedger clues={payload.intelRumors} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.02fr,0.98fr]">
            <FactionChroniclePanel events={payload.recentEvents} playerFactionId={payload.playerFaction.id} />
            <FactionRankingLedger factions={payload.factions} playerFactionId={payload.playerFaction.id} />
          </div>
        </div>
      </div>

      {expandedMap ? (
        <div className="fixed inset-0 z-50 bg-[rgba(17,12,8,0.56)] backdrop-blur-[6px]">
          <div className="flex h-full items-start justify-center overflow-y-auto p-3 lg:p-6">
            <div className="w-full max-w-[1440px] overflow-hidden rounded-[32px] border border-[rgba(152,119,72,0.24)] bg-[rgba(246,238,219,0.96)] shadow-[0_36px_90px_rgba(24,16,10,0.34)]">
              <div className="flex items-center justify-between gap-3 border-b border-[rgba(145,110,63,0.14)] px-4 py-3">
                <div>
                  <div className="text-[10px] tracking-[0.22em] text-[#8a6a45]">横向沙盘</div>
                  <div className="mt-1 text-[16px] text-[#2f2217]">{payload.world.name} · 势力疆界详览</div>
                </div>
                <button
                  type="button"
                  onClick={() => setExpandedMap(false)}
                  className="rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[12px] tracking-[0.12em] text-[#f2dfbc]"
                >
                  收起沙盘
                </button>
              </div>
              <div className="grid gap-4 px-3 py-3 xl:grid-cols-[1.34fr,0.66fr]">
                <div className="overflow-x-auto">
                  <FactionMapCanvas
                    data={payload}
                    mode="immersive"
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                  />
                </div>
                <div className="max-h-[72vh] overflow-y-auto pr-1">
                  <div className="space-y-4">
                    <FactionNodeReportCard node={selectedNode} lens={payload.playerLens} />
                    <FactionMissionFieldNote mission={payload.missionBrief} />
                    <FactionSignalCluster signals={payload.factionSignals} />
                    <FactionChroniclePanel events={payload.recentEvents} playerFactionId={payload.playerFaction.id} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

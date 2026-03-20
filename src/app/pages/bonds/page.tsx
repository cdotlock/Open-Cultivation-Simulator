"use client";

import { useEffect, useMemo, useState } from "react";
import { useRecoilState } from "recoil";
import { useRouter, useSearchParams } from "next/navigation";
import { characterState } from "@/app/store";
import { BondUiPayload, CharacterBondView } from "@/interfaces/bond";
import { makeDaoLyuWish, recruitDisciple, rejectDisciple } from "@/app/actions/bond/action";
import { $img } from "@/utils";

function BondCard({
  bond,
  action,
  secondaryAction,
}: {
  bond: CharacterBondView;
  action?: { label: string; onClick: () => void };
  secondaryAction?: { label: string; onClick: () => void };
}) {
  return (
    <section className="rounded-[24px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">{bond.label}</div>
          <div className="mt-1 text-[20px] text-[#2f2217]">{bond.actor.name}</div>
          <div className="mt-1 text-[12px] text-[#6f5535]">
            {bond.actor.title || "未定称谓"} · {bond.actor.realm} · {bond.mood}
          </div>
        </div>
        <div className="rounded-full bg-[rgba(244,234,207,0.92)] px-3 py-1 text-[11px] text-[#7b5d3a]">
          亲密 {bond.intimacy} / 信任 {bond.trust}
        </div>
      </div>

      <div className="mt-3 text-[13px] leading-[1.8] text-[#4b3928]">{bond.summary || bond.actor.originSummary}</div>

      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[#6f5535]">
        {bond.actor.personalityTags.slice(0, 3).map((item) => (
          <div key={item} className="rounded-full bg-[rgba(244,234,207,0.86)] px-3 py-1">{item}</div>
        ))}
        {bond.actor.publicTraits.slice(0, 3).map((item) => (
          <div key={item} className="rounded-full border border-[rgba(142,109,63,0.18)] px-3 py-1">{item}</div>
        ))}
      </div>

      {action || secondaryAction ? (
        <div className="mt-4 flex gap-2">
          {action ? (
            <button
              type="button"
              onClick={action.onClick}
              className="flex-1 rounded-full bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[12px] tracking-[0.12em] text-[#f2dfbc]"
            >
              {action.label}
            </button>
          ) : null}
          {secondaryAction ? (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-full border border-[rgba(137,103,54,0.22)] px-4 py-2 text-[12px] tracking-[0.12em] text-[#6f5535]"
            >
              {secondaryAction.label}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export default function BondsPage() {
  const [char, setChar] = useRecoilState(characterState);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [payload, setPayload] = useState<BondUiPayload | undefined>(char?.bondData);
  const [loading, setLoading] = useState(!char?.bondData);
  const [wishText, setWishText] = useState("");
  const [submittingWish, setSubmittingWish] = useState(false);

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
    fetch(`/api/bond-snapshot?characterId=${characterId}`)
      .then((response) => response.json())
      .then((result) => setPayload(result || undefined))
      .finally(() => setLoading(false));
  }, [characterId, router]);

  const syncPayload = (nextPayload: BondUiPayload | undefined) => {
    setPayload(nextPayload);
    setChar((previous) => previous ? { ...previous, bondData: nextPayload } : previous);
  };

  if (loading || !payload || !characterId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2EBD9] text-[#5f4525]">
        缘簿正在翻开...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2EBD9] pb-10">
      <div className="relative min-h-full w-full">
        <img className="pointer-events-none absolute left-0 top-0 w-full mix-blend-overlay" src={$img("bg")} alt="bg" />

        <div className="relative z-10 mx-auto w-full max-w-[1120px] px-4 py-5 xl:px-6">
          <section className="rounded-[30px] border border-[rgba(142,109,63,0.22)] bg-[linear-gradient(140deg,rgba(252,247,238,0.96),rgba(240,229,209,0.94))] px-5 py-5 shadow-[0_20px_48px_rgba(54,35,16,0.12)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] tracking-[0.24em] text-[#8a6a45]">缘簿</div>
                <div className="mt-1 text-[26px] text-[#2f2217]">关系与门墙</div>
                <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-[#7b5d3a]">
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">
                    道侣：{payload.activeDaoLyu ? payload.activeDaoLyu.actor.name : payload.activeWish ? "愿已许下" : "未定"}
                  </div>
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">
                    弟子：{payload.overview.disciplesUsed}/{payload.overview.discipleSlots}
                  </div>
                </div>
                <div className="mt-4 text-[13px] leading-[1.9] text-[#6a5234]">{payload.overview.nextMajorEvent}</div>
              </div>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[12px] tracking-[0.14em] text-[#f2dfbc]"
              >
                回到当前剧情
              </button>
            </div>
          </section>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.02fr,0.98fr]">
            <div className="grid gap-4">
              {payload.activeDaoLyu ? (
                <BondCard
                  bond={payload.activeDaoLyu}
                  action={{
                    label: "去私语",
                    onClick: () => router.push(`/pages/bond-chat?characterId=${characterId}&bondId=${payload.activeDaoLyu!.id}`),
                  }}
                />
              ) : payload.overview.canWishForDaoLyu ? (
                <section className="rounded-[24px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
                  <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">道侣愿</div>
                  <div className="mt-1 text-[20px] text-[#2f2217]">向天道说一个人</div>
                  <div className="mt-3 text-[13px] leading-[1.8] text-[#4b3928]">
                    你刚踏进筑基，正是道缘最容易被天命听见的时候。把想要的人写下来，后面的因果会替你圆。
                  </div>
                  <textarea
                    className="mt-3 min-h-[140px] w-full rounded-[18px] border border-[rgba(130,89,56,0.16)] bg-[rgba(255,255,255,0.76)] px-4 py-3 text-[14px] leading-[1.8] text-[#3f3123] focus:outline-none"
                    placeholder="例如：我想要一个清冷、护短、嘴硬心软，肯在雨夜替我守灯的人。"
                    value={wishText}
                    onChange={(event) => setWishText(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!wishText.trim()) {
                        return;
                      }
                      setSubmittingWish(true);
                      try {
                        const nextPayload = await makeDaoLyuWish(characterId, wishText.trim());
                        syncPayload(nextPayload || undefined);
                        setWishText("");
                      } finally {
                        setSubmittingWish(false);
                      }
                    }}
                    disabled={!wishText.trim() || submittingWish}
                    className="mt-3 w-full rounded-full bg-[rgba(63,43,23,0.92)] px-4 py-3 text-[12px] tracking-[0.14em] text-[#f2dfbc] disabled:opacity-50"
                  >
                    {submittingWish ? "天道推演中..." : "许下道侣愿"}
                  </button>
                </section>
              ) : payload.activeWish ? (
                <section className="rounded-[24px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
                  <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">道侣愿</div>
                  <div className="mt-1 text-[20px] text-[#2f2217]">愿已投向因果</div>
                  <div className="mt-3 text-[13px] leading-[1.8] text-[#4b3928]">
                    {payload.activeWish.rawWish}
                  </div>
                  <div className="mt-3 rounded-[18px] bg-[rgba(244,234,207,0.86)] px-4 py-3 text-[12px] leading-[1.8] text-[#6f5535]">
                    第{payload.activeWish.targetEncounterTurn ?? "?"}回合前后，命里那个人会来。
                  </div>
                </section>
              ) : null}

              <section className="rounded-[24px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
                <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">门下记要</div>
                <div className="mt-1 text-[20px] text-[#2f2217]">当前弟子</div>
                <div className="mt-3 grid gap-3">
                  {payload.activeDisciples.length ? payload.activeDisciples.map((bond) => (
                    <BondCard key={bond.id} bond={bond} />
                  )) : (
                    <div className="rounded-[18px] bg-[rgba(244,234,207,0.72)] px-4 py-4 text-[13px] leading-[1.8] text-[#6f5535]">
                      {payload.overview.discipleSlots
                        ? "门下暂时还没有真正收下的人。"
                        : "金丹后才会真正撑起师门门槛。"}
                    </div>
                  )}
                </div>
              </section>
            </div>

            <div className="grid gap-4">
              <section className="rounded-[24px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
                <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">候选弟子</div>
                <div className="mt-1 text-[20px] text-[#2f2217]">门外来人</div>
                <div className="mt-3 grid gap-3">
                  {payload.discipleCandidates.length ? payload.discipleCandidates.map((bond) => (
                    <BondCard
                      key={bond.id}
                      bond={bond}
                      action={{
                        label: "收为门下",
                        onClick: async () => {
                          const nextPayload = await recruitDisciple(characterId, bond.id);
                          syncPayload(nextPayload || undefined);
                        },
                      }}
                      secondaryAction={{
                        label: "暂不点头",
                        onClick: async () => {
                          const nextPayload = await rejectDisciple(characterId, bond.id);
                          syncPayload(nextPayload || undefined);
                        },
                      }}
                    />
                  )) : (
                    <div className="rounded-[18px] bg-[rgba(244,234,207,0.72)] px-4 py-4 text-[13px] leading-[1.8] text-[#6f5535]">
                      眼下还没有新人来到门外。{payload.overview.nextRefreshHint}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[24px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
                <div className="text-[10px] tracking-[0.18em] text-[#8a6a45]">近况</div>
                <div className="mt-1 text-[20px] text-[#2f2217]">风声与因果</div>
                <div className="mt-3 space-y-3">
                  {payload.recentHighlights.map((item) => (
                    <div key={item} className="rounded-[18px] bg-[rgba(244,234,207,0.72)] px-4 py-3 text-[13px] leading-[1.8] text-[#6f5535]">
                      {item}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

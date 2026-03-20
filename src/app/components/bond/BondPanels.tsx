"use client";

import { BondUiPayload } from "@/interfaces/bond";

function panelSurface() {
  return "rounded-[26px] border border-[rgba(242,228,195,0.16)] bg-[linear-gradient(180deg,rgba(87,48,31,0.76),rgba(45,25,16,0.88))] shadow-[0_18px_40px_rgba(20,10,6,0.18)]";
}

export function BondPortalCard({
  data,
  onOpenBonds,
  onOpenChat,
}: {
  data: BondUiPayload;
  onOpenBonds: () => void;
  onOpenChat?: () => void;
}) {
  const daoLyuLabel = data.activeDaoLyu
    ? `${data.activeDaoLyu.actor.name} · ${data.activeDaoLyu.mood}`
    : data.activeWish
      ? "道缘未至"
      : data.overview.canWishForDaoLyu
        ? "可许道侣愿"
        : "道侣未开";
  const canOpenChat = Boolean(data.activeDaoLyu || data.activeDisciples.length);

  return (
    <section className={`${panelSurface()} overflow-hidden px-4 py-4 text-[#F2E7D0]`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[10px] tracking-[0.22em] text-[#E9D7B1]">缘簿</div>
          <div className="mt-1 text-[18px] text-[#FFF8ED]">关系与门墙</div>
        </div>
        <div className="rounded-full border border-[rgba(242,228,195,0.2)] px-3 py-1 text-[11px] text-[#E9D7B1]">
          {daoLyuLabel}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-[12px]">
        <div className="rounded-[18px] bg-[rgba(255,247,229,0.08)] px-3 py-3">
          <div className="text-[10px] tracking-[0.14em] text-[#EBDAB9]">道侣</div>
          <div className="mt-2 text-[13px] leading-[1.7]">
            {data.activeDaoLyu
              ? `${data.activeDaoLyu.actor.name}常伴左右`
              : data.activeWish
                ? `愿已许下，静候兑现`
                : data.overview.canWishForDaoLyu
                  ? "筑基已成，可向天道许愿"
                  : "缘线尚未真正松动"}
          </div>
        </div>
        <div className="rounded-[18px] bg-[rgba(255,247,229,0.08)] px-3 py-3">
          <div className="text-[10px] tracking-[0.14em] text-[#EBDAB9]">弟子</div>
          <div className="mt-2 text-[13px] leading-[1.7]">
            {data.overview.disciplesUsed}/{data.overview.discipleSlots} 槽位
            <span className="block text-[11px] text-[#DCC59E]">
              {data.overview.discipleSlots ? data.overview.nextRefreshHint : "金丹后方可开门收徒"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 text-[12px] leading-[1.8] text-[#E8D8BA]">
        {data.featuredEvent
          ? `${data.featuredEvent.actorName}：${data.featuredEvent.title}`
          : data.recentHighlights[0]}
      </div>

      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={onOpenBonds}
          className="flex-1 rounded-full border border-[rgba(242,228,195,0.24)] bg-[rgba(255,247,229,0.08)] px-4 py-2 text-[12px] tracking-[0.12em] text-[#FFF4DE]"
        >
          打开缘簿
        </button>
        {canOpenChat && onOpenChat ? (
          <button
            type="button"
            onClick={onOpenChat}
            className="rounded-full border border-[rgba(242,228,195,0.24)] bg-[rgba(215,197,118,0.16)] px-4 py-2 text-[12px] tracking-[0.12em] text-[#FFF4DE]"
          >
            私语
          </button>
        ) : null}
      </div>
    </section>
  );
}

export function BondStoryStrip({
  data,
  onOpenBonds,
  onOpenChat,
}: {
  data: BondUiPayload;
  onOpenBonds: () => void;
  onOpenChat?: () => void;
}) {
  const headline = data.activeDaoLyu
    ? data.featuredEvent
      ? `${data.featuredEvent.actorName}：${data.featuredEvent.title}`
      : `${data.activeDaoLyu.actor.name}在旁，气氛偏${data.activeDaoLyu.mood}`
    : data.activeWish
      ? `你已许下道侣愿，缘分将在第${data.activeWish.targetEncounterTurn ?? "?"}回合前后兑现`
      : data.featuredEvent
        ? `${data.featuredEvent.actorName}：${data.featuredEvent.title}`
      : data.overview.disciplesUsed
        ? `门下已有${data.overview.disciplesUsed}名弟子跟着你见世面`
        : data.recentHighlights[0];
  const canOpenChat = Boolean(data.activeDaoLyu || data.activeDisciples.length);

  return (
    <section className={`${panelSurface()} flex items-center gap-3 px-4 py-3 text-[#F2E7D0]`}>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] tracking-[0.18em] text-[#E8D2AB]">关系动向</div>
        <div className="mt-1 truncate text-[12px] text-[#FFF5E1]">{headline}</div>
      </div>
      <button
        type="button"
        onClick={onOpenBonds}
        className="rounded-full border border-[rgba(242,228,195,0.24)] px-3 py-2 text-[11px] text-[#FFF4DE]"
      >
        缘簿
      </button>
      {canOpenChat && onOpenChat ? (
        <button
          type="button"
          onClick={onOpenChat}
          className="rounded-full border border-[rgba(242,228,195,0.24)] bg-[rgba(215,197,118,0.16)] px-3 py-2 text-[11px] text-[#FFF4DE]"
        >
          私语
        </button>
      ) : null}
    </section>
  );
}

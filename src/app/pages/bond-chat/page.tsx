"use client";

import { useEffect, useMemo, useState } from "react";
import { useRecoilState } from "recoil";
import { useRouter, useSearchParams } from "next/navigation";
import { characterState } from "@/app/store";
import { BondUiPayload } from "@/interfaces/bond";
import { sendBondChat, renameBond } from "@/app/actions/bond/action";
import { $img } from "@/utils";

type ChatMessage = {
  id: string;
  role: "user" | "bond" | "system";
  content: string;
};

function buildMessages(payload: BondUiPayload | undefined, bondId: number): ChatMessage[] {
  const bond = payload?.activeDaoLyu?.id === bondId
    ? payload.activeDaoLyu
    : payload?.activeDisciples.find((item) => item.id === bondId);

  if (!bond) {
    return [];
  }

  const messages: ChatMessage[] = [];
  bond.memories
    .slice()
    .reverse()
    .forEach((memory) => {
      if (memory.payload?.user) {
        messages.push({ id: `u-${memory.id}`, role: "user", content: memory.payload.user });
      }
      if (memory.payload?.bond) {
        messages.push({ id: `b-${memory.id}`, role: "bond", content: memory.payload.bond });
      } else {
        messages.push({ id: `s-${memory.id}`, role: "system", content: memory.summary });
      }
    });

  if (!messages.length) {
    messages.push({
      id: "intro",
      role: "system",
      content: bond.summary || `${bond.actor.name}此刻正站在你身边，像是在等你先开口。`,
    });
  }

  return messages;
}

export default function BondChatPage() {
  const [char, setChar] = useRecoilState(characterState);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [renamingBond, setRenamingBond] = useState(false);

  const characterId = useMemo(() => {
    const fromQuery = Number(searchParams.get("characterId") || "");
    if (Number.isFinite(fromQuery) && fromQuery > 0) {
      return fromQuery;
    }
    return char?.id;
  }, [char?.id, searchParams]);

  const bondId = useMemo(() => Number(searchParams.get("bondId") || ""), [searchParams]);
  const [payload, setPayload] = useState<BondUiPayload | undefined>(
    char?.id === characterId ? char?.bondData : undefined,
  );
  const [loading, setLoading] = useState(!(char?.id === characterId && char?.bondData));

  useEffect(() => {
    if (!characterId || !bondId) {
      router.push("/");
      return;
    }

    setLoading(true);
    // 传入 bondId 让 API 在找不到时自动重试一次
    fetch(`/api/bond-snapshot?characterId=${characterId}&bondId=${bondId}`)
      .then((response) => response.json())
      .then((result) => setPayload(result || undefined))
      .finally(() => setLoading(false));
  }, [bondId, characterId, router]);

  const bond = payload?.activeDaoLyu?.id === bondId
    ? payload.activeDaoLyu
    : payload?.activeDisciples.find((item) => item.id === bondId);
  const messages = buildMessages(payload, bondId);

  // 加载中
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F2EBD9] text-[#5f4525]">
        私语尚未接通...
      </div>
    );
  }

  // 加载完成但 bond 仍找不到，说明关系尚未建立或数据异常
  if (!bond) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#F2EBD9] text-[#5f4525]">
        <div className="text-[15px]">此段因果尚未落定，暂时无法私语。</div>
        <button
          type="button"
          onClick={() => router.push(`/pages/bonds?characterId=${characterId}`)}
          className="rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-5 py-2 text-[12px] tracking-[0.14em] text-[#f2dfbc]"
        >
          返回缘簿
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F2EBD9] pb-8">
      <div className="relative min-h-full w-full">
        <img className="pointer-events-none absolute left-0 top-0 w-full mix-blend-overlay" src={$img("bg")} alt="bg" />

        <div className="relative z-10 mx-auto w-full max-w-[960px] px-4 py-5 xl:px-6">
          <section className="rounded-[30px] border border-[rgba(142,109,63,0.22)] bg-[linear-gradient(140deg,rgba(252,247,238,0.96),rgba(240,229,209,0.94))] px-5 py-5 shadow-[0_20px_48px_rgba(54,35,16,0.12)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[10px] tracking-[0.24em] text-[#8a6a45]">私语</div>
                <div className="mt-1 flex items-center gap-2">
                  {editingName ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!nameInput.trim() || renamingBond) return;
                        setRenamingBond(true);
                        try {
                          const next = await renameBond(characterId!, bondId, nameInput.trim());
                          setPayload(next || undefined);
                          setChar((prev) => (prev && prev.id === characterId)
                            ? { ...prev, bondData: next }
                            : prev);
                          setEditingName(false);
                        } finally {
                          setRenamingBond(false);
                        }
                      }}
                    >
                      <input
                        autoFocus
                        className="rounded-xl border border-[#ccb181] bg-[#fff9ef] px-3 py-1 text-[20px] text-[#2f2217] outline-none w-[140px]"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        maxLength={20}
                      />
                      <button
                        type="submit"
                        disabled={renamingBond}
                        className="rounded-full bg-[rgba(63,43,23,0.92)] px-3 py-1 text-[11px] text-[#f2dfbc] disabled:opacity-50"
                      >
                        确定
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingName(false)}
                        className="rounded-full border border-[rgba(137,103,54,0.22)] px-3 py-1 text-[11px] text-[#6f5535]"
                      >
                        取消
                      </button>
                    </form>
                  ) : (
                    <>
                      <span className="text-[26px] text-[#2f2217]">{bond.actor.name}</span>
                      <button
                        type="button"
                        onClick={() => { setNameInput(bond.actor.name); setEditingName(true); }}
                        className="rounded-full border border-[rgba(137,103,54,0.22)] px-2 py-0.5 text-[11px] text-[#8a6a45] hover:bg-[rgba(244,234,207,0.6)]"
                      >
                        改名
                      </button>
                    </>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] text-[#7b5d3a]">
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">{bond.label}</div>
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">{bond.actor.realm}</div>
                  <div className="rounded-full bg-[rgba(255,250,242,0.92)] px-3 py-1">心绪：{bond.mood}</div>
                </div>
                <div className="mt-4 text-[13px] leading-[1.8] text-[#6a5234]">{bond.summary || bond.actor.originSummary}</div>
              </div>

              <button
                type="button"
                onClick={() => router.push(`/pages/bonds?characterId=${characterId}`)}
                className="rounded-full border border-[rgba(137,103,54,0.22)] bg-[rgba(63,43,23,0.92)] px-4 py-2 text-[12px] tracking-[0.14em] text-[#f2dfbc]"
              >
                返回缘簿
              </button>
            </div>
          </section>

          <section className="mt-4 rounded-[30px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
            <div className="space-y-3">
              {messages.map((item) => (
                <div
                  key={item.id}
                  className={
                    item.role === "user"
                      ? "ml-auto max-w-[78%] rounded-[22px] bg-[rgba(63,43,23,0.92)] px-4 py-3 text-[13px] leading-[1.8] text-[#f2dfbc]"
                      : item.role === "bond"
                        ? "mr-auto max-w-[78%] rounded-[22px] bg-[rgba(244,234,207,0.92)] px-4 py-3 text-[13px] leading-[1.8] text-[#3f3123]"
                        : "mx-auto max-w-[88%] rounded-[18px] bg-[rgba(233,221,193,0.78)] px-4 py-3 text-[12px] leading-[1.8] text-[#6f5535]"
                  }
                >
                  {item.content}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-4 rounded-[30px] border border-[rgba(142,109,63,0.22)] bg-[rgba(255,250,242,0.94)] px-4 py-4 shadow-[0_16px_40px_rgba(53,34,15,0.10)]">
            <div className="grid gap-3 lg:grid-cols-[1fr,240px]">
              <textarea
                className="min-h-[140px] rounded-[22px] border border-[rgba(130,89,56,0.16)] bg-[rgba(255,255,255,0.76)] px-4 py-3 text-[14px] leading-[1.8] text-[#3f3123] focus:outline-none"
                placeholder="把你现在最想说的话告诉对方。"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              <div className="rounded-[22px] bg-[rgba(244,234,207,0.72)] px-4 py-4 text-[12px] leading-[1.9] text-[#6f5535]">
                <div>亲密：{bond.intimacy}</div>
                <div>信任：{bond.trust}</div>
                <div>忠诚：{bond.loyalty}</div>
                <div>道缘：{bond.destiny}</div>
                <div className="mt-3 text-[11px] text-[#7a6040]">{bond.actor.speakingStyle}</div>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (!message.trim()) {
                  return;
                }
                setSending(true);
                try {
                  const result = await sendBondChat(characterId, bondId, message.trim());
                  setPayload(result.bondData || undefined);
                  setChar((previous) => (previous && previous.id === characterId)
                    ? { ...previous, bondData: result.bondData }
                    : previous);
                  setMessage("");
                } finally {
                  setSending(false);
                }
              }}
              disabled={!message.trim() || sending}
              className="mt-3 w-full rounded-full bg-[rgba(63,43,23,0.92)] px-4 py-3 text-[12px] tracking-[0.14em] text-[#f2dfbc] disabled:opacity-50"
            >
              {sending ? "回音抵达中..." : "送出这句话"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { $img } from "@/utils";
import { getSettingsSnapshot, savePromptTemplate } from "@/app/actions/settings/action";

type PromptItem = {
  name: string;
  description: string;
  systemPrompt: string;
  userPrompt: string;
};

export default function PromptSettingsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [prompts, setPrompts] = useState<PromptItem[]>([]);
  const [activePromptName, setActivePromptName] = useState("");

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const snapshot = await getSettingsSnapshot();
      if (cancelled) {
        return;
      }

      setPrompts(snapshot.prompts);
      setActivePromptName((current) => current || snapshot.prompts[0]?.name || "");
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updatePrompt = (name: string, field: "systemPrompt" | "userPrompt", value: string) => {
    setPrompts((current) =>
      current.map((prompt) => (prompt.name === name ? { ...prompt, [field]: value } : prompt)),
    );
  };

  const handleSavePrompt = (prompt: PromptItem) => {
    startTransition(async () => {
      await savePromptTemplate({
        name: prompt.name,
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
      });
      setNotice(`${prompt.name} 已保存。`);
    });
  };

  const activePrompt = prompts.find((prompt) => prompt.name === activePromptName) ?? prompts[0] ?? null;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F2EBD9] flex items-center justify-center font-family-song">
        <div className="text-[#5f4a28] text-lg">正在装载本地提示词包...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-[#F2EBD9] font-family-song text-[#2a2116]"
      style={{ backgroundImage: `url(${$img("bg")})`, backgroundBlendMode: "overlay" }}
    >
      <div className="mx-auto max-w-[860px] px-4 py-6">
        <div className="rounded-[26px] border border-[#9a7b4f] bg-[rgba(250,242,226,0.94)] shadow-[0_16px_48px_rgba(83,55,18,0.12)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#c9ae7f] px-5 py-4">
            <div>
              <div className="text-[26px]">高级提示词</div>
              <div className="mt-1 text-[12px] tracking-[0.12em] text-[#7a6542]">PROMPT PACK</div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                onClick={() => router.push("/pages/settings")}
                className="whitespace-nowrap rounded-full border border-[#8e6a38] px-3 py-2 text-[11px] text-[#5f4525] hover:bg-[#f6ead3] md:text-[12px]"
              >
                设置
              </button>
              <button
                onClick={() => router.push("/")}
                className="whitespace-nowrap rounded-full border border-[#8e6a38] px-3 py-2 text-[11px] text-[#5f4525] hover:bg-[#f6ead3] md:text-[12px]"
              >
                返回
              </button>
            </div>
          </div>

          <div className="border-b border-[#d9c39a] px-5 py-4">
            <div className="rounded-[24px] border border-[#decaa1] bg-[rgba(255,249,239,0.78)] px-4 py-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-[18px] text-[#3e2d16]">按模板逐项校对 Prompt</div>
                  <div className="mt-2 text-[13px] leading-[1.7] text-[#7a6542]">
                    当前共 {prompts.length} 组模板。左侧切换模板，右侧专注编辑，避免整页巨量文本同时展开。
                  </div>
                </div>
                <div className="rounded-full border border-[#d3bb8d] bg-[#fffaf2] px-4 py-2 text-[12px] text-[#6f5939]">
                  当前编辑：{activePrompt?.name || "未选择"}
                </div>
              </div>

              <div className="mt-4 flex gap-2 overflow-x-auto pb-1 xl:hidden">
                {prompts.map((prompt) => {
                  const active = prompt.name === activePrompt?.name;

                  return (
                    <button
                      key={prompt.name}
                      type="button"
                      onClick={() => setActivePromptName(prompt.name)}
                      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-2 text-[11px] transition-colors md:px-4 md:text-[12px] ${
                        active
                          ? "border-[#7f6336] bg-[#5c4422] text-[#f8edd6]"
                          : "border-[#d3bb8d] bg-[#fffaf2] text-[#6f5939]"
                      }`}
                    >
                      {prompt.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid gap-5 px-5 py-5 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="hidden xl:block">
              <div className="sticky top-5 rounded-[24px] border border-[#decaa1] bg-[rgba(255,249,239,0.82)] p-3 shadow-[0_12px_30px_rgba(72,48,16,0.08)]">
                <div className="px-2 pb-3 text-[12px] tracking-[0.16em] text-[#8b7146]">模板索引</div>
                <div className="space-y-2">
                  {prompts.map((prompt) => {
                    const active = prompt.name === activePrompt?.name;

                    return (
                      <button
                        key={prompt.name}
                        type="button"
                        onClick={() => setActivePromptName(prompt.name)}
                        className={`w-full rounded-[18px] border px-3 py-3 text-left transition-colors ${
                          active
                            ? "border-[#8b6b3a] bg-[rgba(93,69,35,0.96)] text-[#f8ecd3]"
                            : "border-[#dfcb9f] bg-[#fffaf2] text-[#4d3a1f]"
                        }`}
                      >
                        <div className="text-[13px]">{prompt.name}</div>
                        <div className={`mt-1 line-clamp-2 text-[11px] leading-[1.5] ${active ? "text-[#ead9b6]" : "text-[#7a6542]"}`}>
                          {prompt.description}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            <div>
              {activePrompt ? (
                <div className="rounded-[24px] border border-[#d8c59f] bg-[#fffaf2] shadow-[0_14px_32px_rgba(72,48,16,0.08)]">
                  <div className="flex flex-col gap-3 border-b border-[#ead7b1] px-5 py-5 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="text-[18px] text-[#2f2212]">{activePrompt.name}</div>
                      <div className="mt-2 max-w-[720px] text-[13px] leading-[1.7] text-[#7a6542]">
                        {activePrompt.description}
                      </div>
                    </div>
                    <button
                      onClick={() => handleSavePrompt(activePrompt)}
                      className="whitespace-nowrap rounded-full border border-[#8b6b3a] bg-[#fff6e7] px-4 py-2 text-[11px] text-[#5d4523] md:text-xs"
                    >
                      保存当前模板
                    </button>
                  </div>

                  <div className="grid gap-4 p-5 lg:grid-cols-2">
                    <label className="grid gap-2 text-xs">
                      <span className="text-[#7a6542]">System Prompt</span>
                      <textarea
                        className="min-h-[280px] rounded-[22px] border border-[#d9c9a6] bg-[#fffdf8] px-4 py-3 outline-none"
                        value={activePrompt.systemPrompt}
                        onChange={(event) => updatePrompt(activePrompt.name, "systemPrompt", event.target.value)}
                      />
                    </label>
                    <label className="grid gap-2 text-xs">
                      <span className="text-[#7a6542]">User Prompt</span>
                      <textarea
                        className="min-h-[280px] rounded-[22px] border border-[#d9c9a6] bg-[#fffdf8] px-4 py-3 outline-none"
                        value={activePrompt.userPrompt}
                        onChange={(event) => updatePrompt(activePrompt.name, "userPrompt", event.target.value)}
                      />
                    </label>
                  </div>
                </div>
              ) : (
                <div className="rounded-[24px] border border-[#d8c59f] bg-[#fffaf2] px-5 py-8 text-sm text-[#6d5838]">
                  当前没有可编辑的 Prompt 模板。
                </div>
              )}
            </div>
          </div>

          <div className="min-h-[52px] border-t border-[#c9ae7f] px-5 py-4 text-sm text-[#6d5838]">
            {isPending ? "正在写入本地 Prompt..." : notice || "默认模板已经同步为仓库内置版本。"}
          </div>
        </div>
      </div>
    </div>
  );
}

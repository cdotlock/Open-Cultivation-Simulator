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

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const snapshot = await getSettingsSnapshot();
      if (cancelled) {
        return;
      }

      setPrompts(snapshot.prompts);
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

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-48px)] bg-[#F2EBD9] flex items-center justify-center font-family-song">
        <div className="text-[#5f4a28] text-lg">正在装载本地提示词包...</div>
      </div>
    );
  }

  return (
    <div
      className="min-h-[calc(100vh-48px)] bg-[#F2EBD9] font-family-song text-[#2a2116]"
      style={{ backgroundImage: `url(${$img("bg")})`, backgroundBlendMode: "overlay" }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="rounded-[28px] border border-[#9a7b4f] bg-[rgba(250,242,226,0.92)] shadow-[0_20px_60px_rgba(83,55,18,0.12)]">
          <div className="border-b border-[#c9ae7f] px-6 py-5 flex items-center justify-between gap-4">
            <div>
              <div className="text-[28px]">高级提示词</div>
              <div className="text-[13px] text-[#6f5a3b] mt-1">维护菜单。这里只调整本地 Prompt，不面向普通玩家直接暴露。</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/pages/settings")}
                className="rounded-full border border-[#8e6a38] px-4 py-2 text-sm text-[#5f4525] hover:bg-[#f6ead3]"
              >
                返回设置
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-full border border-[#8e6a38] px-4 py-2 text-sm text-[#5f4525] hover:bg-[#f6ead3]"
              >
                返回主界面
              </button>
            </div>
          </div>

          <div className="px-6 py-6 space-y-4">
            {prompts.map((prompt) => (
              <div key={prompt.name} className="rounded-[22px] border border-[#d8c59f] bg-[#fffaf2] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[16px]">{prompt.name}</div>
                    <div className="text-[12px] text-[#7a6542] mt-1">{prompt.description}</div>
                  </div>
                  <button
                    onClick={() => handleSavePrompt(prompt)}
                    className="rounded-full border border-[#8b6b3a] px-4 py-2 text-xs text-[#5d4523]"
                  >
                    保存模板
                  </button>
                </div>
                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <label className="grid gap-2 text-xs">
                    <span>System Prompt</span>
                    <textarea
                      className="min-h-[240px] rounded-2xl border border-[#d9c9a6] bg-[#fffdf8] px-4 py-3 outline-none"
                      value={prompt.systemPrompt}
                      onChange={(event) => updatePrompt(prompt.name, "systemPrompt", event.target.value)}
                    />
                  </label>
                  <label className="grid gap-2 text-xs">
                    <span>User Prompt</span>
                    <textarea
                      className="min-h-[240px] rounded-2xl border border-[#d9c9a6] bg-[#fffdf8] px-4 py-3 outline-none"
                      value={prompt.userPrompt}
                      onChange={(event) => updatePrompt(prompt.name, "userPrompt", event.target.value)}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-[#c9ae7f] px-6 py-4 text-sm text-[#6d5838] min-h-[56px]">
            {isPending ? "正在写入本地 Prompt..." : notice || "默认模板已经同步为仓库内置版本。"}
          </div>
        </div>
      </div>
    </div>
  );
}

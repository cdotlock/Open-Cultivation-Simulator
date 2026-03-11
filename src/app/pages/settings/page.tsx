"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { $img } from "@/utils";
import { getSettingsSnapshot, saveSettings, testActiveModelConnection } from "@/app/actions/settings/action";

type SettingsState = {
  provider: "openai-compatible" | "openai" | "deepseek" | "qwen" | "doubao";
  modelName: string;
  apiUrl: string;
  apiKey: string;
  imageGenerationEnabled: boolean;
  avatarGenerationEnabled: boolean;
};

export default function SettingsPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [settings, setSettings] = useState<SettingsState>({
    provider: "deepseek",
    modelName: "deepseek-chat",
    apiUrl: "https://api.deepseek.com/v1",
    apiKey: "",
    imageGenerationEnabled: false,
    avatarGenerationEnabled: false,
  });

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const snapshot = await getSettingsSnapshot();
      if (cancelled) {
        return;
      }

      setSettings({
        provider: snapshot.activeModel.provider,
        modelName: snapshot.activeModel.name,
        apiUrl: snapshot.activeModel.apiUrl,
        apiKey: snapshot.activeModel.apiKey,
        imageGenerationEnabled: snapshot.features.imageGenerationEnabled,
        avatarGenerationEnabled: snapshot.features.avatarGenerationEnabled,
      });
      setLoading(false);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSetting = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const handleSaveSettings = () => {
    startTransition(async () => {
      await saveSettings(settings);
      setNotice("设置已保存到本地。");
    });
  };

  const handleTestConnection = () => {
    startTransition(async () => {
      try {
        const result = await testActiveModelConnection(settings);
        setNotice(`模型测试成功：${result.message}`);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "连接测试失败");
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-[calc(100vh-48px)] bg-[#F2EBD9] flex items-center justify-center font-family-song">
        <div className="text-[#5f4a28] text-lg">正在装载本地洞府设置...</div>
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
              <div className="text-[28px]">洞府设置</div>
              <div className="text-[13px] text-[#6f5a3b] mt-1">本地模型、功能开关与默认提示词都保存在本机。</div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/pages/settings/prompts")}
                className="rounded-full border border-[#8e6a38] px-4 py-2 text-sm text-[#5f4525] hover:bg-[#f6ead3]"
              >
                高级提示词
              </button>
              <button
                onClick={() => router.push("/")}
                className="rounded-full border border-[#8e6a38] px-4 py-2 text-sm text-[#5f4525] hover:bg-[#f6ead3]"
              >
                返回主界面
              </button>
            </div>
          </div>

          <div className="px-6 py-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[24px] border border-[#d5bf97] bg-[rgba(255,250,241,0.88)] p-5">
              <div className="text-[20px] mb-4">模型连接</div>
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm">
                  <span>Provider</span>
                  <select
                    className="rounded-2xl border border-[#ccb181] bg-[#fff9ef] px-4 py-3 outline-none"
                    value={settings.provider}
                    onChange={(event) => updateSetting("provider", event.target.value as SettingsState["provider"])}
                  >
                    <option value="deepseek">DeepSeek</option>
                    <option value="openai-compatible">OpenAI Compatible</option>
                    <option value="openai">OpenAI</option>
                    <option value="qwen">Qwen</option>
                    <option value="doubao">Doubao</option>
                  </select>
                </label>
                <label className="grid gap-2 text-sm">
                  <span>模型名称</span>
                  <input
                    className="rounded-2xl border border-[#ccb181] bg-[#fff9ef] px-4 py-3 outline-none"
                    value={settings.modelName}
                    onChange={(event) => updateSetting("modelName", event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>Base URL</span>
                  <input
                    className="rounded-2xl border border-[#ccb181] bg-[#fff9ef] px-4 py-3 outline-none"
                    value={settings.apiUrl}
                    onChange={(event) => updateSetting("apiUrl", event.target.value)}
                  />
                </label>
                <label className="grid gap-2 text-sm">
                  <span>API Key</span>
                  <input
                    className="rounded-2xl border border-[#ccb181] bg-[#fff9ef] px-4 py-3 outline-none"
                    value={settings.apiKey}
                    type="password"
                    onChange={(event) => updateSetting("apiKey", event.target.value)}
                  />
                </label>
              </div>

              <div className="mt-6 text-[20px] mb-4">功能开关</div>
              <div className="grid gap-3 text-sm">
                <label className="flex items-center justify-between rounded-2xl border border-[#d8c59f] bg-[#fffaf2] px-4 py-3">
                  <span>图像生成功能</span>
                  <input
                    checked={settings.imageGenerationEnabled}
                    type="checkbox"
                    onChange={(event) => updateSetting("imageGenerationEnabled", event.target.checked)}
                  />
                </label>
                <label className="flex items-center justify-between rounded-2xl border border-[#d8c59f] bg-[#fffaf2] px-4 py-3">
                  <span>角色头像生成</span>
                  <input
                    checked={settings.avatarGenerationEnabled}
                    type="checkbox"
                    onChange={(event) => updateSetting("avatarGenerationEnabled", event.target.checked)}
                  />
                </label>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleSaveSettings}
                  className="rounded-full bg-[#4f3b1d] px-5 py-3 text-sm text-[#f8ecd3]"
                >
                  保存设置
                </button>
                <button
                  onClick={handleTestConnection}
                  className="rounded-full border border-[#7c5d32] px-5 py-3 text-sm text-[#5c4422]"
                >
                  测试连接
                </button>
              </div>
            </section>

            <section className="rounded-[24px] border border-[#d5bf97] bg-[rgba(255,250,241,0.72)] p-5">
              <div className="text-[20px]">洞府说明</div>
              <div className="mt-3 space-y-3 text-[13px] leading-6 text-[#6f5a3b]">
                <p>主流程默认使用仓库内置的原始提示词包，玩家不需要也不建议直接修改。</p>
                <p>若你需要校对或微调 Prompt，请从右上角进入“高级提示词”。该入口属于维护菜单，不会在主设置页直接暴露全部模板。</p>
                <p>桌面与移动端共用同一套本地配置文件；这里保存后立即生效，不依赖远程配置中心。</p>
              </div>

              <div className="mt-6 rounded-[22px] border border-[#d8c59f] bg-[#fffaf2] p-4">
                <div className="text-[16px]">当前运行模式</div>
                <div className="mt-3 grid gap-3 text-sm text-[#5a482f]">
                  <div className="flex items-center justify-between">
                    <span>MCP Server</span>
                    <span className="text-[#87653a]">/mcp</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>生图功能</span>
                    <span>{settings.imageGenerationEnabled ? "已启用" : "未启用"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>角色头像生成</span>
                    <span>{settings.avatarGenerationEnabled ? "已启用" : "未启用"}</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <div className="border-t border-[#c9ae7f] px-6 py-4 text-sm text-[#6d5838] min-h-[56px]">
            {isPending ? "正在落盘本地设置..." : notice || "单机版默认使用本地配置文件；不依赖远程配置中心。"}
          </div>
        </div>
      </div>
    </div>
  );
}

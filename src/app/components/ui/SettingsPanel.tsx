import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { ServerConfig, SkillItem } from "../../../types";
import { BotIcon, ChevronDownIcon, FolderIcon, RefreshCwIcon, XIcon } from "./icons";

type ModelOption = {
  value: string;
  label: string;
};

function splitOptionLabel(option: ModelOption) {
  const separatorIndex = option.label.indexOf(" / ");
  if (separatorIndex < 0) {
    return { provider: "Model", model: option.label, detail: option.value };
  }

  return {
    provider: option.label.slice(0, separatorIndex),
    model: option.label.slice(separatorIndex + 3),
    detail: option.value,
  };
}

export function SettingsPanel({
  config,
  modelOptions,
  isLoadingModels,
  modelError,
  skills,
  isLoadingSkills,
  skillsError,
  onModelChange,
  onCompactContext,
  isCompactingContext,
  canCompactContext,
  onClose,
}: {
  config: ServerConfig;
  modelOptions: ModelOption[];
  isLoadingModels: boolean;
  modelError: string | null;
  skills: SkillItem[];
  isLoadingSkills: boolean;
  skillsError: string | null;
  onModelChange: (model: string) => void;
  onCompactContext: () => void;
  isCompactingContext: boolean;
  canCompactContext: boolean;
  onClose: () => void;
}) {
  const [isModelsOpen, setIsModelsOpen] = useState(true);
  const [isContextOpen, setIsContextOpen] = useState(true);
  const [isSkillsOpen, setIsSkillsOpen] = useState(false);
  const availableModelCount = modelOptions.length;

  useEffect(() => {
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    document.documentElement.classList.add("overflow-hidden", "touch-none");

    return () => {
      document.body.style.overflow = overflow;
      document.documentElement.classList.remove("overflow-hidden", "touch-none");
    };
  }, []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-stone-900/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 24 }}
        transition={{ type: "spring", damping: 24, stiffness: 240 }}
        className="fixed inset-x-4 top-16 bottom-4 z-50 flex max-h-[calc(100dvh-5rem)] w-auto max-w-2xl flex-col overflow-hidden overscroll-contain rounded-2xl border border-stone-200 bg-[#FCFCFA] shadow-2xl md:right-4 md:left-auto md:bottom-auto md:w-[calc(100vw-2rem)]"
      >
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-stone-900">Settings</h2>
            <p className="mt-1 text-xs text-stone-500">调整默认发送模型和当前连接配置。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-900"
            title="Close settings"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 touch-pan-y">
          <section className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
            <button
              type="button"
              onClick={() => setIsModelsOpen((current) => !current)}
              className="flex w-full items-start justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-700">
                  <BotIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                   <h3 className="text-sm font-medium text-stone-900">默认模型</h3>
                   <p className="mt-1 text-xs leading-5 text-stone-500">
                     前端会读取后端当前默认模型；选择后会直接写回 OpenCode 的默认模型配置。
                   </p>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 text-xs text-stone-400">
                <span>{availableModelCount} items</span>
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${isModelsOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">Current</div>
                  <div className="mt-1 truncate text-sm font-medium text-stone-900">
                    {splitOptionLabel(
                      modelOptions.find((option) => option.value === config.model) || {
                        value: config.model,
                        label: config.model || "No model selected",
                      },
                    ).provider}
                  </div>
                </div>
                <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-500 shadow-sm">
                  {config.model || "not configured"}
                </div>
              </div>
            </div>

            {isModelsOpen ? (
              <>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <label className="block text-[13px] font-medium text-stone-500">Models</label>
                  <p className="text-[11px] text-stone-400">
                    {isLoadingModels ? "Loading..." : `${availableModelCount} available`}
                  </p>
                </div>

                <div className="mt-3 max-h-[320px] overflow-y-auto pr-1">
                  <div className="grid gap-2 sm:grid-cols-2">
                    {modelOptions.map((option) => {
                      const active = option.value === config.model;
                      const parsed = splitOptionLabel(option);

                      return (
                        <button
                          key={option.value || "default"}
                          type="button"
                          onClick={() => onModelChange(option.value)}
                          className={`group rounded-2xl border px-4 py-3 text-left transition-all ${
                            active
                              ? "border-stone-900 bg-stone-900 text-white shadow-lg shadow-stone-900/10"
                              : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-[11px] font-medium uppercase tracking-[0.14em] ${active ? "text-stone-300" : "text-stone-400"}`}>
                                {parsed.provider}
                              </div>
                              <div className="mt-1 truncate text-sm font-semibold">{parsed.model}</div>
                            </div>
                            <div
                              className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                                active ? "bg-white" : "bg-stone-300 group-hover:bg-stone-500"
                              }`}
                            />
                          </div>
                          <div className={`mt-3 truncate text-xs ${active ? "text-stone-300" : "text-stone-500"}`}>
                            {parsed.detail}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <p className="mt-3 text-xs text-stone-500">
                  {isLoadingModels
                    ? "正在从 OpenCode 读取可用模型..."
                    : modelError || "模型列表来自 OpenCode /config/providers 接口。"}
                </p>
              </>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
            <button
              type="button"
              onClick={() => setIsContextOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-700">
                  <RefreshCwIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-stone-900">上下文压缩</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-500">对当前会话执行一次 `/compact`，压缩上下文并保留关键信息。</p>
                </div>
              </div>
              <ChevronDownIcon className={`h-4 w-4 text-stone-400 transition-transform ${isContextOpen ? "rotate-180" : ""}`} />
            </button>

            {isContextOpen ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3 text-xs leading-5 text-stone-500">
                  该操作会调用 OpenCode 的会话总结接口，用当前模型或服务端默认模型来压缩上下文，适合长会话接近 context limit 时使用。
                </div>

                <button
                  type="button"
                  onClick={onCompactContext}
                  disabled={!canCompactContext || isCompactingContext}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium transition-colors ${
                    canCompactContext && !isCompactingContext
                      ? "bg-stone-900 text-white hover:bg-stone-800"
                      : "bg-stone-100 text-stone-400"
                  }`}
                >
                  <RefreshCwIcon className={`h-4 w-4 ${isCompactingContext ? "animate-spin" : ""}`} />
                  {isCompactingContext ? "正在压缩上下文..." : "压缩当前上下文"}
                </button>

                {!canCompactContext ? <p className="text-xs text-stone-400">请先选择一个 session。</p> : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
            <button
              type="button"
              onClick={() => setIsSkillsOpen((current) => !current)}
              className="flex w-full items-center justify-between gap-3 text-left"
            >
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-700">
                  <FolderIcon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-medium text-stone-900">Skills</h3>
                  <p className="mt-1 text-xs leading-5 text-stone-500">查看 OpenCode 当前可用的技能列表。</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-stone-400">
                <span>{skills.length} items</span>
                <ChevronDownIcon className={`h-4 w-4 transition-transform ${isSkillsOpen ? "rotate-180" : ""}`} />
              </div>
            </button>

            {isSkillsOpen ? (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-stone-500">
                  {isLoadingSkills ? "正在从 OpenCode 读取 skills..." : skillsError || "以下列表来自 OpenCode /skill 接口。"}
                </p>

                {skills.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-stone-200 bg-stone-50/60 px-4 py-5 text-sm text-stone-400">
                    No skills available.
                  </div>
                ) : (
                  <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                    {skills.map((skill) => (
                      <div key={skill.name} className="rounded-xl border border-stone-200 bg-stone-50/60 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-stone-900">{skill.name}</div>
                            <div className="mt-1 text-xs leading-5 text-stone-600">{skill.description}</div>
                          </div>
                          <div className="shrink-0 rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] text-stone-500">
                            skill
                          </div>
                        </div>
                        <div className="mt-2 break-all text-[11px] text-stone-400">{skill.location}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
          </section>
        </div>
      </motion.aside>
    </>
  );
}

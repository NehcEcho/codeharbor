import { motion } from "motion/react";
import type { ServerConfig } from "../../../types";
import { BotIcon, XIcon } from "./icons";

type ModelOption = {
  value: string;
  label: string;
};

function splitOptionLabel(option: ModelOption) {
  if (!option.value) {
    return { provider: "OpenCode", model: "Server default", detail: option.label };
  }

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
  onConfigChange,
  onClose,
}: {
  config: ServerConfig;
  modelOptions: ModelOption[];
  isLoadingModels: boolean;
  modelError: string | null;
  onConfigChange: (next: ServerConfig) => void;
  onClose: () => void;
}) {
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
        className="fixed right-4 top-16 z-50 w-[calc(100vw-2rem)] max-w-2xl rounded-2xl border border-stone-200 bg-[#FCFCFA] shadow-2xl"
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

        <div className="space-y-5 px-5 py-5">
          <section className="rounded-2xl border border-stone-200 bg-white px-4 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-stone-200 bg-stone-50 p-2 text-stone-700">
                <BotIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-medium text-stone-900">默认模型</h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  选择后会写入每次发送请求。留空则跟随 OpenCode 服务端默认模型。
                </p>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-stone-200 bg-stone-50/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-400">Current</div>
                  <div className="mt-1 truncate text-sm font-medium text-stone-900">
                    {splitOptionLabel(modelOptions.find((option) => option.value === config.model) || modelOptions[0]).provider}
                  </div>
                </div>
                <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-medium text-stone-500 shadow-sm">
                  {config.model || "server default"}
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <label className="block text-[13px] font-medium text-stone-500">Models</label>
              <p className="text-[11px] text-stone-400">
                {isLoadingModels ? "Loading..." : `${modelOptions.length - 1} available`}
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
                      onClick={() => onConfigChange({ ...config, model: option.value })}
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
          </section>
        </div>
      </motion.aside>
    </>
  );
}

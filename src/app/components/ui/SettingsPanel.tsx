import { motion } from "motion/react";
import type { ServerConfig } from "../../../types";
import { BotIcon, XIcon } from "./icons";

const MODEL_OPTIONS = [
  { value: "", label: "跟随后端默认模型" },
  { value: "gpt-5.4", label: "gpt-5.4" },
  { value: "gpt-5.4-mini", label: "gpt-5.4-mini" },
  { value: "claude-sonnet-4.5", label: "claude-sonnet-4.5" },
  { value: "gemini-2.5-pro", label: "gemini-2.5-pro" },
];

export function SettingsPanel({
  config,
  onConfigChange,
  onClose,
}: {
  config: ServerConfig;
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
        className="fixed right-4 top-16 z-50 w-[calc(100vw-2rem)] max-w-md rounded-2xl border border-stone-200 bg-[#FCFCFA] shadow-2xl"
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
                  这里选择的模型会在发送消息时写入请求。留空时使用 OpenCode 服务端默认模型。
                </p>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1.5 block text-[13px] font-medium text-stone-500">Model</label>
              <select
                value={config.model}
                onChange={(event) => onConfigChange({ ...config, model: event.target.value })}
                className="w-full rounded-xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-700 shadow-sm outline-none transition-all focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5"
              >
                {MODEL_OPTIONS.map((option) => (
                  <option key={option.value || "default"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </section>
        </div>
      </motion.aside>
    </>
  );
}

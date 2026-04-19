import { motion } from "motion/react";
import { clsx } from "clsx";
import type { ChatMessage } from "../../../types";
import {
  AlertTriangleIcon,
  CheckIcon,
  ShieldAlertIcon,
  TerminalIcon,
  XIcon,
} from "../ui/icons";

function permissionMeta(message: ChatMessage) {
  const commandPart = message.parts.find((part) => part.type === "permission-command");
  const explanationPart = message.parts.find((part) => part.type === "permission-explanation");
  const riskPart = message.parts.find((part) => part.type === "permission-risk");

  return {
    command: typeof commandPart?.text === "string" ? commandPart.text : "Unknown command",
    explanation:
      typeof explanationPart?.text === "string"
        ? explanationPart.text
        : "OpenCode is requesting approval to continue.",
    risk: typeof riskPart?.text === "string" ? riskPart.text : "Medium",
  };
}

export function PermissionCard({
  message,
  onAction,
}: {
  message: ChatMessage;
  onAction: (action: "approved" | "denied") => void;
}) {
  const { command, explanation, risk } = permissionMeta(message);

  if (message.status && message.status !== "pending") {
    return (
      <motion.div
        className={clsx(
          "flex items-center gap-3 p-3 rounded-xl border text-sm",
          message.status === "approved"
            ? "bg-emerald-50/50 border-emerald-100/50 text-emerald-800"
            : "bg-rose-50/50 border-rose-100/50 text-rose-800",
        )}
      >
        {message.status === "approved" ? <CheckIcon className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
        <span className="font-semibold">{message.status === "approved" ? "Approved" : "Denied"}</span>
        <span className="font-mono text-xs opacity-75 truncate">{command}</span>
      </motion.div>
    );
  }

  return (
    <motion.div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mt-4 mb-4 relative">
      <div className="absolute top-0 left-0 w-1 h-full bg-amber-400" />
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div className="shrink-0 pt-1 flex sm:flex-col items-center sm:items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 border border-amber-100">
            <ShieldAlertIcon className="w-5 h-5" />
          </div>
          <div className="flex sm:flex-col items-center sm:items-start gap-1">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Risk</span>
            <span className="flex items-center gap-1 text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-xs font-medium border border-amber-200/50">
              <AlertTriangleIcon className="w-3 h-3" />
              {risk}
            </span>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div>
            <h3 className="font-semibold text-stone-900 text-[15px] mb-1">Permission Required</h3>
            <p className="text-stone-600 text-sm leading-relaxed">{explanation}</p>
          </div>

          <div className="bg-[#1A1A1A] rounded-xl p-3 sm:p-4 border border-stone-800 shadow-inner">
            <div className="flex items-center gap-2 mb-2 text-stone-400 text-xs font-medium uppercase tracking-wider">
              <TerminalIcon className="w-3.5 h-3.5" />
              Command
            </div>
            <code className="text-sm font-mono text-amber-200 break-all">{command}</code>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-stone-100">
            <button
              onClick={() => onAction("approved")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors shadow-sm focus:ring-4 focus:ring-stone-900/10 active:scale-95"
              type="button"
            >
              <CheckIcon className="w-4 h-4" /> Allow
            </button>
            <button
              onClick={() => onAction("denied")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-white text-rose-600 rounded-lg font-medium hover:bg-rose-50 border border-rose-200/50 transition-colors shadow-sm focus:ring-4 focus:ring-rose-500/10 active:scale-95"
              type="button"
            >
              <XIcon className="w-4 h-4" /> Deny
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

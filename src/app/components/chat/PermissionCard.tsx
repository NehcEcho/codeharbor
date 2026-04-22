import { motion } from "motion/react";
import { clsx } from "clsx";
import type { PermissionRequest } from "../../../types";
import {
  CheckIcon,
  ShieldAlertIcon,
  TerminalIcon,
  XIcon,
} from "../ui/icons";

function formatPermissionTitle(permission: string) {
  return permission
    .split(/[.:/_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function permissionMeta(request: PermissionRequest) {
  const primaryPattern = request.patterns[0];
  const command = typeof primaryPattern === "string" && primaryPattern.trim() ? primaryPattern : request.permission;
  const explanation = `OpenCode requests permission to run ${request.permission}${request.patterns.length > 0 ? ` on ${request.patterns.join(", ")}` : ""}.`;
  const risk = request.always.length > 0 ? "Can persist" : "One-time";
  return {
    title: formatPermissionTitle(request.permission),
    command,
    explanation,
    risk,
  };
}

export function PermissionCard({
  request,
  isResponding,
  onAction,
}: {
  request: PermissionRequest;
  isResponding?: boolean;
  onAction: (action: "once" | "always" | "reject") => void;
}) {
  const { title, command, explanation, risk } = permissionMeta(request);

  return (
    <motion.div
      className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/95 shadow-[0_20px_50px_rgba(28,25,23,0.06)]"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 22, stiffness: 280 }}
    >
      <div className="flex flex-col gap-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 via-white to-stone-50/60 px-4 py-3.5 sm:flex-row sm:items-center">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700 shadow-sm">
          <ShieldAlertIcon className="h-4 w-4" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight text-stone-900 break-words">
            {title || "Permission required"}
          </div>
          <div className="mt-0.5 text-xs text-stone-500">{risk}</div>
        </div>

        <div className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-center shadow-sm sm:w-auto sm:shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">Scope</div>
          <div className="mt-0.5 text-xs font-semibold text-stone-900">{risk.split(" ")[0]}</div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="leading-relaxed text-sm text-stone-600">{explanation}</div>

        <div className="rounded-3xl border border-stone-900 bg-[#141414] px-4 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.16)]">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
            <TerminalIcon className="h-3.5 w-3.5 text-stone-500" />
            Command
          </div>
          <code className="block break-all font-mono text-sm leading-relaxed text-amber-200">{command}</code>
        </div>

        <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center">
          <button
            onClick={() => onAction("once")}
            disabled={isResponding}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-stone-800 focus:ring-4 focus:ring-stone-900/10 active:scale-[0.98] disabled:opacity-60 sm:flex-1"
            type="button"
          >
            <CheckIcon className="h-4 w-4" />
            <span>Allow once</span>
          </button>

          <button
            onClick={() => onAction("always")}
            disabled={isResponding || request.always.length === 0}
            className={clsx(
              "flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium shadow-sm transition-colors active:scale-[0.98] sm:flex-1",
              request.always.length > 0
                ? "border-stone-200 bg-white text-stone-900 hover:bg-stone-50 focus:ring-4 focus:ring-stone-200/40"
                : "cursor-not-allowed border-stone-200 bg-stone-50 text-stone-400 opacity-60",
            )}
            type="button"
          >
            <CheckIcon className="h-4 w-4" />
            <span>Always allow</span>
          </button>

          <button
            onClick={() => onAction("reject")}
            disabled={isResponding}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/70 bg-white px-4 py-3 text-sm font-medium text-rose-600 shadow-sm transition-colors hover:bg-rose-50 focus:ring-4 focus:ring-rose-200/40 active:scale-[0.98] disabled:opacity-60 sm:flex-1"
            type="button"
          >
            <XIcon className="h-4 w-4" />
            <span>Deny</span>
          </button>
        </div>
      </div>
    </motion.div>
  );
}

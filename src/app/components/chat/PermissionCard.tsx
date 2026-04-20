import { motion } from "motion/react";
import { clsx } from "clsx";
import type { PermissionRequest } from "../../../types";
import {
  AlertTriangleIcon,
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
  const risk = request.always.length > 0 ? "Persistent" : "One-time";
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
            <h3 className="font-semibold text-stone-900 text-[15px] mb-1">{title || "Permission Required"}</h3>
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
              onClick={() => onAction("once")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-stone-900 text-white rounded-lg font-medium hover:bg-stone-800 transition-colors shadow-sm focus:ring-4 focus:ring-stone-900/10 active:scale-95 disabled:opacity-60"
              type="button"
              disabled={isResponding}
            >
              <CheckIcon className="w-4 h-4" /> Allow once
            </button>
            <button
              onClick={() => onAction("always")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-emerald-700 rounded-lg font-medium hover:bg-emerald-50 border border-emerald-200/70 transition-colors shadow-sm focus:ring-4 focus:ring-emerald-500/10 active:scale-95 disabled:opacity-60"
              type="button"
              disabled={isResponding || request.always.length === 0}
            >
              <CheckIcon className="w-4 h-4" /> Always allow
            </button>
            <button
              onClick={() => onAction("reject")}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-rose-600 rounded-lg font-medium hover:bg-rose-50 border border-rose-200/50 transition-colors shadow-sm focus:ring-4 focus:ring-rose-500/10 active:scale-95 disabled:opacity-60"
              type="button"
              disabled={isResponding}
            >
              <XIcon className="w-4 h-4" /> Deny
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import type { ChatMessage } from "../../../types";
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TerminalIcon,
  UserIcon,
} from "../ui/icons";

function extractBody(message: ChatMessage) {
  if (message.role === "permission") return "";
  return message.parts
    .map((part) => {
      if (typeof part.text === "string") return part.text;
      if (part.type) return `[${part.type}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function extractToolCommand(message: ChatMessage) {
  const commandPart = message.parts.find((part) => part.type === "tool-command");
  return typeof commandPart?.text === "string" ? commandPart.text : "Tool execution";
}

function extractToolOutput(message: ChatMessage) {
  const outputPart = message.parts.find((part) => part.type === "tool-output");
  return typeof outputPart?.text === "string" ? outputPart.text : "";
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const [isToolExpanded, setIsToolExpanded] = useState(false);
  const content = extractBody(message);
  const command = extractToolCommand(message);
  const output = extractToolOutput(message);
  const time = message.timestampLabel;

  return (
    <div className="flex gap-4 sm:gap-5 group">
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 text-stone-600">
            <UserIcon className="w-4 h-4" />
          </div>
        ) : (
          <div
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center border",
              isTool ? "bg-stone-800 text-white border-stone-900" : "bg-amber-100/50 text-amber-700 border-amber-200/50",
            )}
          >
            {isTool ? <TerminalIcon className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4 -mt-1 mb-2">
          <div className="font-semibold text-[15px] text-stone-900 flex items-center gap-2">
            {isUser ? "You" : isTool ? "Tool Execution" : "OpenCode"}
          </div>
          <span className="text-xs text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:inline-block">
            {time}
          </span>
        </div>

        {content ? (
          <div className="text-[15px] text-stone-700 leading-relaxed font-sans max-w-none whitespace-pre-wrap">
            {content}
          </div>
        ) : null}

        {isTool ? (
          <div className="mt-2 rounded-xl border border-stone-200 overflow-hidden bg-stone-50/50">
            <button
              onClick={() => setIsToolExpanded(!isToolExpanded)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-stone-100/50 transition-colors group/btn focus:outline-none"
              type="button"
            >
              <div className="text-stone-400 group-hover/btn:text-stone-600 transition-colors">
                {isToolExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
              </div>
              <div className="flex-1 font-mono text-sm text-stone-700 truncate">$ {command}</div>
              <div className="flex items-center gap-1.5 text-xs">
                {message.status === "success" ? (
                  <span className="flex items-center gap-1 text-emerald-600 font-medium">
                    <CheckCircleIcon className="w-3.5 h-3.5" /> Completed
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-rose-600 font-medium">
                    <AlertCircleIcon className="w-3.5 h-3.5" /> Attention
                  </span>
                )}
              </div>
            </button>

            <AnimatePresence>
              {isToolExpanded && output ? (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-stone-200 bg-[#1A1A1A]"
                >
                  <pre className="p-4 text-sm font-mono text-stone-300 overflow-x-auto m-0 leading-relaxed">
                    <code>{output}</code>
                  </pre>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        ) : null}
      </div>
    </div>
  );
}

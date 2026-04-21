import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import {
  ArrowUpIcon,
  LightbulbIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  RefreshCwIcon,
  Settings2Icon,
  SquareIcon,
  WrenchIcon,
} from "../ui/icons";

interface CommandInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  agent: "build" | "plan";
  onAgentChange: (agent: "build" | "plan") => void;
  isSending: boolean;
  queuedCount: number;
  isBusy: boolean;
  canRetryLastMessage: boolean;
  isRetryingLastMessage: boolean;
  isAbortingSession: boolean;
  onRetryLastMessage: () => void;
  onAbortSession: () => void;
}

export function CommandInput({
  value,
  onChange,
  onSend,
  agent,
  onAgentChange,
  isSending,
  queuedCount,
  isBusy,
  canRetryLastMessage,
  isRetryingLastMessage,
  isAbortingSession,
  onRetryLastMessage,
  onAbortSession,
}: CommandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!value.trim()) return;
      onSend();
    }
  };

  return (
    <div className="relative w-full mx-auto">
      <div className="bg-white border border-stone-300 shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-2xl flex flex-col focus-within:ring-4 focus-within:ring-stone-900/5 focus-within:border-stone-400 transition-all overflow-visible relative z-20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
            placeholder={
              isSending
                ? "Sending message..."
                : queuedCount > 0
                  ? `Queueing enabled. ${queuedCount} message${queuedCount === 1 ? "" : "s"} waiting...`
                : isBusy
                  ? "OpenCode is still working. You can keep typing or send another instruction if needed..."
                  : `Message OpenCode ${agent === "build" ? "(Build Mode)" : "(Plan Mode)"}...`
            }
          className="w-full bg-transparent px-4 py-4 min-h-[56px] max-h-[200px] resize-none focus:outline-none text-[15px] text-stone-800 placeholder-stone-400 font-sans leading-relaxed"
          rows={1}
          disabled={false}
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <button className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer active:scale-95" title="Attach file">
              <PaperclipIcon className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-stone-200 mx-1" />

            <div className="relative">
              <button
                onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  agent === "build"
                    ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "text-blue-700 bg-blue-50 hover:bg-blue-100",
                )}
                type="button"
              >
                {agent === "build" ? <WrenchIcon className="w-4 h-4" /> : <LightbulbIcon className="w-4 h-4" />}
                {agent === "build" ? "Build" : "Plan"}
                <Settings2Icon className="w-3.5 h-3.5 opacity-60 ml-1" />
              </button>

              <AnimatePresence>
                {isAgentMenuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAgentMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", duration: 0.3 }}
                      className="absolute bottom-full left-0 mb-2 w-52 bg-white border border-stone-200 rounded-xl shadow-xl z-50 p-1.5 overflow-hidden"
                    >
                      <button
                        onClick={() => {
                          onAgentChange("build");
                          setIsAgentMenuOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors",
                          agent === "build" ? "bg-stone-50" : "hover:bg-stone-50",
                        )}
                        type="button"
                      >
                        <div className="mt-0.5 bg-amber-100/50 p-1.5 rounded-md text-amber-600 border border-amber-200/50 shrink-0">
                          <WrenchIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-stone-900">Build Agent</div>
                          <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                            Executes terminal commands and edits files directly.
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          onAgentChange("plan");
                          setIsAgentMenuOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors mt-1",
                          agent === "plan" ? "bg-stone-50" : "hover:bg-stone-50",
                        )}
                        type="button"
                      >
                        <div className="mt-0.5 bg-blue-100/50 p-1.5 rounded-md text-blue-600 border border-blue-200/50 shrink-0">
                          <LightbulbIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-stone-900">Plan Agent</div>
                          <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                            Analyzes context and proposes changes safely.
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setIsActionMenuOpen((current) => !current)}
                className={clsx(
                  "relative inline-flex h-10 items-center justify-center rounded-xl border px-3 transition-all",
                  isActionMenuOpen
                    ? "border-stone-300 bg-stone-100 text-stone-700"
                    : isBusy
                      ? "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100"
                      : canRetryLastMessage
                        ? "border-stone-300 bg-stone-100 text-stone-700 hover:border-stone-400 hover:bg-stone-200/70"
                    : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700",
                )}
                type="button"
                title="Session actions"
              >
                <MoreHorizontalIcon className="h-4 w-4" />
                {canRetryLastMessage && !isBusy ? (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-stone-500" />
                ) : null}
                {isBusy ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-rose-100" />
                ) : null}
              </button>

              <AnimatePresence>
                {isActionMenuOpen ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsActionMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", duration: 0.25 }}
                      className="absolute bottom-full right-0 z-50 mb-2 w-44 overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl"
                    >
                      <button
                        onClick={() => {
                          onRetryLastMessage();
                          setIsActionMenuOpen(false);
                        }}
                        disabled={!canRetryLastMessage || isRetryingLastMessage || isAbortingSession}
                        className={clsx(
                          "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                          canRetryLastMessage && !isRetryingLastMessage && !isAbortingSession
                            ? "text-stone-700 hover:bg-stone-50"
                            : "text-stone-400",
                        )}
                        type="button"
                      >
                        <RefreshCwIcon className={clsx("h-4 w-4 shrink-0", isRetryingLastMessage ? "animate-spin" : "")} />
                        <div>
                          <div className="font-medium">Retry</div>
                          <div className="text-[11px] text-stone-400">Resend last message</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onAbortSession();
                          setIsActionMenuOpen(false);
                        }}
                        disabled={!isBusy || isAbortingSession}
                        className={clsx(
                          "mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                          isBusy && !isAbortingSession
                            ? "text-rose-700 hover:bg-rose-50"
                            : "text-stone-400",
                        )}
                        type="button"
                      >
                        <SquareIcon className="h-4 w-4 shrink-0 fill-current" />
                        <div>
                          <div className="font-medium">{isAbortingSession ? "Stopping" : "Stop"}</div>
                          <div className="text-[11px] text-stone-400">Abort current run</div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              onClick={onSend}
              disabled={!value.trim()}
              className={clsx(
                "p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center",
                value.trim()
                  ? "bg-stone-900 text-white hover:bg-stone-800 shadow-sm active:scale-95"
                  : "bg-stone-100 text-stone-400",
              )}
              type="button"
              title={isSending ? "Sending message" : queuedCount > 0 ? "Add message to queue" : "Send message"}
            >
              <ArrowUpIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="text-center mt-3 text-[11px] text-stone-400 font-medium tracking-wide flex items-center justify-center gap-1.5">
        {isSending
          ? "Sending your message..."
          : queuedCount > 0
            ? `${queuedCount} queued message${queuedCount === 1 ? "" : "s"} waiting for this session.`
            : isBusy
              ? "OpenCode is still working on the current task. New sends will be queued."
              : "OpenCode can read and modify your local environment. Press"}
        {!isSending && queuedCount === 0 && !isBusy ? (
          <>
        <kbd className="font-sans px-1.5 py-0.5 bg-stone-100 rounded border border-stone-200 shadow-sm ml-0.5 text-stone-500">
          Enter
        </kbd>
        to send.
          </>
        ) : null}
      </div>
    </div>
  );
}

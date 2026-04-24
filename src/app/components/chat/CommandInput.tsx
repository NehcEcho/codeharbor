import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import type { CommandItem } from "../../../types";
import {
  ArrowUpIcon,
  ChevronDownIcon,
  ClockIcon,
  CornerUpLeftIcon,
  GitBranchIcon,
  LightbulbIcon,
  MoreHorizontalIcon,
  PaperclipIcon,
  RefreshCwIcon,
  CheckIcon,
  SearchIcon,
  Settings2Icon,
  TerminalIcon,
  WrenchIcon,
} from "../ui/icons";

interface CommandInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  agent: "build" | "plan";
  commands: CommandItem[];
  isLoadingCommands: boolean;
  commandsError: string | null;
  onAgentChange: (agent: "build" | "plan") => void;
  isSending: boolean;
  queuedCount: number;
  isBusy: boolean;
  canUndoLastMessage: boolean;
  canRedoLastMessage: boolean;
  canForkLastMessage: boolean;
  isUndoingLastMessage: boolean;
  isRedoingLastMessage: boolean;
  isForkingLastMessage: boolean;
  runningCommandName: string | null;
  onRunCommand: (commandName: string, argumentsText: string) => void;
  onUndoLastMessage: () => void;
  onRedoLastMessage: () => void;
  onForkLastMessage: () => void;
}

export function CommandInput({
  value,
  onChange,
  onSend,
  agent,
  commands,
  isLoadingCommands,
  commandsError,
  onAgentChange,
  isSending,
  queuedCount,
  isBusy,
  canUndoLastMessage,
  canRedoLastMessage,
  canForkLastMessage,
  isUndoingLastMessage,
  isRedoingLastMessage,
  isForkingLastMessage,
  runningCommandName,
  onRunCommand,
  onUndoLastMessage,
  onRedoLastMessage,
  onForkLastMessage,
}: CommandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [selectedCommandName, setSelectedCommandName] = useState("");
  const [commandArguments, setCommandArguments] = useState("");

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!value.trim() || isSending) return;
      onSend();
    }
  };

  const selectedCommand = commands.find((item) => item.name === selectedCommandName) || null;
  const filteredCommands = commands.filter((item) => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return true;
    return `${item.name} ${item.description || ""} ${item.source || ""}`.toLowerCase().includes(query);
  });

  const handleRunCommandClick = () => {
    if (!selectedCommandName || runningCommandName || isBusy || isSending) return;
    onRunCommand(selectedCommandName, commandArguments.trim());
    setCommandArguments("");
    setCommandQuery("");
    setIsCommandMenuOpen(false);
  };

  return (
    <div className="relative mx-auto w-full">
      <div className="relative z-20 flex flex-col overflow-visible rounded-2xl border border-stone-300 bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)] transition-all focus-within:border-stone-400 focus-within:ring-4 focus-within:ring-stone-900/5">
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
          className="min-h-[56px] max-h-[200px] w-full resize-none bg-transparent px-4 py-3.5 text-[15px] leading-relaxed text-stone-800 placeholder-stone-400 focus:outline-none sm:py-4"
          rows={1}
          disabled={Boolean(runningCommandName)}
        />

        <div className="flex flex-col gap-2 px-3 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto whitespace-nowrap pb-1 sm:pb-0 md:overflow-visible">
            <button
              className="rounded-lg p-1.5 text-stone-300 transition-colors cursor-not-allowed"
              title="Attachments are not available yet"
              type="button"
              disabled
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-stone-200 mx-1" />

            <div className="relative">
              <button
                onClick={() => setIsCommandMenuOpen((current) => !current)}
                className={clsx(
                  "flex h-8 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition-colors cursor-pointer",
                  runningCommandName
                    ? "border-stone-900 bg-stone-900 text-white hover:bg-stone-800"
                    : "border-stone-200 bg-white text-stone-600 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900",
                )}
                type="button"
                title="Run OpenCode command"
              >
                {runningCommandName ? <ClockIcon className="w-4 h-4 animate-pulse" /> : <TerminalIcon className="w-4 h-4" />}
                <span className="hidden sm:inline">/</span>
                <ChevronDownIcon className={clsx("w-3.5 h-3.5 opacity-60", isCommandMenuOpen ? "rotate-180" : "")} />
              </button>

              <AnimatePresence>
                {isCommandMenuOpen ? (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsCommandMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", duration: 0.25 }}
                      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-50 flex max-h-[min(30rem,65dvh)] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white p-2.5 shadow-xl sm:inset-x-4 md:inset-x-auto md:absolute md:bottom-full md:left-0 md:right-auto md:top-auto md:mb-2 md:w-[22rem] md:max-h-[28rem]"
                    >
                      <div className="flex shrink-0 items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <div className="rounded-lg border border-stone-200 bg-stone-50 p-1.5 text-stone-700">
                            <TerminalIcon className="h-3.5 w-3.5" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-stone-900">Slash Command</div>
                            <div className="text-[11px] text-stone-500">执行 OpenCode 内置命令</div>
                          </div>
                        </div>
                        <div className="rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-stone-400">
                          {isLoadingCommands ? "loading" : `${commands.length} cmds`}
                        </div>
                      </div>

                      <div className="mt-2.5 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain">
                        <div className="relative">
                          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                          <input
                            type="text"
                            value={commandQuery}
                            onChange={(event) => setCommandQuery(event.target.value)}
                            placeholder="Search commands"
                            className="w-full rounded-xl border border-stone-200 bg-white py-2 pl-9 pr-3 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5"
                          />
                        </div>

                        <div className="min-h-[8rem] max-h-52 overflow-y-auto rounded-xl border border-stone-200 bg-stone-50/40 p-1 md:max-h-40">
                          {filteredCommands.length === 0 ? (
                            <div className="px-3 py-6 text-center text-xs text-stone-400">No matching commands.</div>
                          ) : (
                            filteredCommands.map((command) => {
                              const active = command.name === selectedCommandName;
                              return (
                                <button
                                  key={command.name}
                                  type="button"
                                  onClick={() => setSelectedCommandName(command.name)}
                                  className={clsx(
                                    "w-full rounded-lg px-3 py-2 text-left transition-colors",
                                    active ? "bg-white shadow-sm ring-1 ring-stone-200" : "hover:bg-white/80",
                                  )}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="truncate text-sm font-medium text-stone-900">/{command.name}</div>
                                    <div className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] text-stone-500 ring-1 ring-stone-200">
                                      {command.source || "command"}
                                    </div>
                                  </div>
                                  {command.description ? (
                                    <div className="mt-1 line-clamp-1 text-[11px] text-stone-500">{command.description}</div>
                                  ) : null}
                                </button>
                              );
                            })
                          )}
                        </div>

                        {selectedCommand ? (
                          <div className="rounded-xl border border-stone-200 bg-stone-50/80 px-3 py-2 text-xs text-stone-600">
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate font-medium text-stone-900">/{selectedCommand.name}</div>
                              <div className="shrink-0 rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[10px] text-stone-500">
                                {selectedCommand.source || "command"}
                              </div>
                            </div>
                            {selectedCommand.description ? <div className="mt-1.5 line-clamp-2 leading-5">{selectedCommand.description}</div> : null}
                            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-stone-500">
                              {selectedCommand.agent ? <span className="rounded-full bg-white px-2 py-0.5">{selectedCommand.agent}</span> : null}
                              {selectedCommand.subtask ? <span className="rounded-full bg-white px-2 py-0.5">subtask</span> : null}
                              {selectedCommand.hints.slice(0, 2).map((hint) => (
                                <span key={hint} className="rounded-full bg-white px-2 py-0.5 font-mono text-[10px]">
                                  {hint}
                                </span>
                              ))}
                            </div>
                          </div>
                        ) : null}

                        {commandsError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] text-rose-700">{commandsError}</div> : null}
                      </div>

                      <div className="mt-2 shrink-0 space-y-2 border-t border-stone-100 pt-2">
                        <input
                          type="text"
                          value={commandArguments}
                          onChange={(event) => setCommandArguments(event.target.value)}
                          placeholder={selectedCommand?.hints.length ? selectedCommand.hints.join(" ") : "Arguments"}
                          className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none transition placeholder:text-stone-400 focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5"
                        />

                        <button
                          type="button"
                          onClick={handleRunCommandClick}
                          disabled={!selectedCommandName || Boolean(runningCommandName) || isBusy || isSending}
                          className={clsx(
                            "flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                            selectedCommandName && !runningCommandName
                              ? "bg-stone-900 text-white hover:bg-stone-800"
                              : "bg-stone-100 text-stone-400",
                          )}
                        >
                          {runningCommandName ? <RefreshCwIcon className="h-4 w-4 animate-spin" /> : <TerminalIcon className="h-4 w-4" />}
                          {runningCommandName ? `Running /${runningCommandName}` : "Run command"}
                        </button>
                      </div>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative">
              <button
                onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                className={clsx(
                  "flex h-8 min-w-0 max-w-full items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors cursor-pointer sm:max-w-none",
                  agent === "build"
                    ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "text-blue-700 bg-blue-50 hover:bg-blue-100",
                )}
                type="button"
              >
                {agent === "build" ? <WrenchIcon className="h-3.5 w-3.5 shrink-0" /> : <LightbulbIcon className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{agent === "build" ? "Build Agent" : "Plan Agent"}</span>
                <Settings2Icon className="h-2.5 w-2.5 shrink-0 opacity-60" />
              </button>

              <AnimatePresence>
                {isAgentMenuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50"
                      onClick={() => setIsAgentMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", duration: 0.3 }}
                      className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[60] overflow-hidden rounded-2xl border border-stone-200 bg-white p-1.5 shadow-xl sm:inset-x-4 md:inset-x-auto md:absolute md:bottom-full md:left-0 md:right-auto md:top-auto md:mb-2 md:w-64"
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

          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <div className="relative">
              <button
                onClick={() => setIsActionMenuOpen((current) => !current)}
                className={clsx(
                  "relative inline-flex h-8 items-center justify-center rounded-lg border px-2.5 transition-all",
                  isActionMenuOpen
                    ? "border-stone-300 bg-stone-100 text-stone-700"
                    : isBusy
                      ? "border-stone-300 bg-stone-100 text-stone-700 hover:border-stone-400 hover:bg-stone-200/70"
                      : canUndoLastMessage || canRedoLastMessage || canForkLastMessage
                        ? "border-stone-300 bg-stone-100 text-stone-700 hover:border-stone-400 hover:bg-stone-200/70"
                        : "border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:bg-stone-50 hover:text-stone-700",
                )}
                type="button"
                title="Session actions"
              >
                <MoreHorizontalIcon className="h-4 w-4" />
                {canUndoLastMessage || canRedoLastMessage || (canForkLastMessage && !isBusy) ? (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-stone-500" />
                ) : null}
                {isBusy ? <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-stone-500" /> : null}
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
                      className="absolute bottom-full right-0 z-50 mb-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-stone-200 bg-white p-1.5 shadow-xl sm:w-40"
                    >
                      <button
                        onClick={() => {
                          onUndoLastMessage();
                          setIsActionMenuOpen(false);
                        }}
                        disabled={!canUndoLastMessage || isUndoingLastMessage || isForkingLastMessage}
                        className={clsx(
                            "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                          canUndoLastMessage && !isUndoingLastMessage && !isForkingLastMessage
                            ? "text-stone-700 hover:bg-stone-50"
                            : "text-stone-400",
                        )}
                        type="button"
                      >
                        <CornerUpLeftIcon className={clsx("h-4 w-4 shrink-0", isUndoingLastMessage ? "animate-pulse" : "")} />
                        <div>
                          <div className="font-medium">{isUndoingLastMessage ? "Undoing" : "Undo"}</div>
                          <div className="text-[11px] text-stone-400">Reset the last message</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onRedoLastMessage();
                          setIsActionMenuOpen(false);
                        }}
                        disabled={!canRedoLastMessage || isUndoingLastMessage || isRedoingLastMessage || isForkingLastMessage}
                        className={clsx(
                            "mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                          canRedoLastMessage && !isUndoingLastMessage && !isRedoingLastMessage && !isForkingLastMessage
                            ? "text-stone-700 hover:bg-stone-50"
                            : "text-stone-400",
                        )}
                        type="button"
                      >
                        <CheckIcon className={clsx("h-4 w-4 shrink-0", isRedoingLastMessage ? "animate-pulse" : "")} />
                        <div>
                          <div className="font-medium">{isRedoingLastMessage ? "Redoing" : "Redo"}</div>
                          <div className="text-[11px] text-stone-400">Restore reverted messages</div>
                        </div>
                      </button>

                      <button
                        onClick={() => {
                          onForkLastMessage();
                          setIsActionMenuOpen(false);
                        }}
                        disabled={!canForkLastMessage || isUndoingLastMessage || isRedoingLastMessage || isForkingLastMessage}
                        className={clsx(
                            "mt-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs transition-colors",
                            canForkLastMessage && !isUndoingLastMessage && !isRedoingLastMessage && !isForkingLastMessage
                              ? "text-stone-700 hover:bg-stone-50"
                              : "text-stone-400",
                        )}
                        type="button"
                      >
                        <GitBranchIcon className={clsx("h-4 w-4 shrink-0", isForkingLastMessage ? "animate-pulse" : "")} />
                        <div>
                          <div className="font-medium">{isForkingLastMessage ? "Forking" : "Fork"}</div>
                          <div className="text-[11px] text-stone-400">Start a new session from the last prompt</div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                ) : null}
              </AnimatePresence>
            </div>

            <button
              onClick={onSend}
              disabled={!value.trim() || Boolean(runningCommandName) || isSending}
              className={clsx(
                "flex items-center justify-center rounded-lg px-2.5 py-2 transition-all cursor-pointer",
                value.trim() && !isSending
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

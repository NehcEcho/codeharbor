import { useEffect, useMemo, useRef, useState } from "react";
import { CommandInput } from "../chat/CommandInput";
import { MessageFeed } from "../chat/MessageFeed";
import type { ChatMessage, CommandItem, Session } from "../../../types";
import { ArrowDownIcon, BotIcon } from "../ui/icons";

export function WorkspacePage({
  session,
  messages,
  canLoadOlderMessages,
  isLoadingOlderMessages,
  draft,
  agent,
  commands,
  isLoadingCommands,
  commandsError,
  isPreparingSend,
  isSending,
  isSendLocked,
  queuedCount,
  isBusy,
  isStalled,
  canUndoLastMessage,
  canRedoLastMessage,
  canForkLastMessage,
  isUndoingLastMessage,
  isRedoingLastMessage,
  isForkingLastMessage,
  runningCommandName,
  onDraftChange,
  onLoadOlderMessages,
  onAgentChange,
  onSend,
  onRunCommand,
  onUndoLastMessage,
  onRedoLastMessage,
  onForkLastMessage,
  serverLabel,
  hasSidePanel,
}: {
  session: Session | null;
  messages: ChatMessage[];
  canLoadOlderMessages: boolean;
  isLoadingOlderMessages: boolean;
  draft: string;
  agent: "build" | "plan";
  commands: CommandItem[];
  isLoadingCommands: boolean;
  commandsError: string | null;
  isPreparingSend: boolean;
  isSending: boolean;
  isSendLocked: boolean;
  queuedCount: number;
  isBusy: boolean;
  isStalled: boolean;
  canUndoLastMessage: boolean;
  canRedoLastMessage: boolean;
  canForkLastMessage: boolean;
  isUndoingLastMessage: boolean;
  isRedoingLastMessage: boolean;
  isForkingLastMessage: boolean;
  runningCommandName: string | null;
  onDraftChange: (value: string) => void;
  onLoadOlderMessages: () => void;
  onAgentChange: (agent: "build" | "plan") => void;
  onSend: () => void;
  onRunCommand: (commandName: string, argumentsText: string) => void;
  onUndoLastMessage: () => void;
  onRedoLastMessage: () => void;
  onForkLastMessage: () => void;
  serverLabel: string;
  hasSidePanel: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const updateScrollState = (node: HTMLDivElement) => {
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    const isNearBottom = distanceFromBottom <= 160;
    shouldAutoScrollRef.current = isNearBottom;
    setShowScrollToBottom(!isNearBottom);
  };

  const scrollToBottom = () => {
    if (!feedRef.current) return;
    feedRef.current.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
  };

  useEffect(() => {
    const node = feedRef.current;
    if (!node || !shouldAutoScrollRef.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const node = feedRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    shouldAutoScrollRef.current = true;
    setShowScrollToBottom(false);
  }, [session?.id]);

  useEffect(() => {
    const node = feedRef.current;
    if (!node) return;

    const handleScroll = () => updateScrollState(node);

    updateScrollState(node);
    node.addEventListener("scroll", handleScroll);

    return () => node.removeEventListener("scroll", handleScroll);
  }, []);

  const sessionTitle = useMemo(() => session?.title || "OpenCode Session", [session]);

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-white">
      <div className="shrink-0 px-4 sm:px-8 pt-4 pb-3 bg-white/95 border-b border-stone-100/80">
        <div className={`mx-auto flex items-center gap-3 ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-2xl bg-stone-50 border border-stone-200/60 shadow-sm text-stone-900 shrink-0">
            <BotIcon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-medium text-stone-900 tracking-tight truncate">{sessionTitle}</h2>
            <p className="text-xs sm:text-sm text-stone-500 truncate">{serverLabel || "OpenCode server"}</p>
          </div>
        </div>
        {isStalled ? (
          <div className={`mx-auto mt-3 ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              This session looks stuck. OpenCode has stayed busy without new activity for a while. You can keep typing, but starting a new session is likely the fastest recovery path.
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative flex-1 min-h-0">
        <div className="h-full overflow-y-auto px-4 sm:px-8 py-6" ref={feedRef}>
        <div className={`mx-auto space-y-8 ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
          {messages.length > 0 && canLoadOlderMessages ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onLoadOlderMessages}
                disabled={isLoadingOlderMessages}
                className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm text-stone-700 transition hover:bg-stone-100 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingOlderMessages ? "Loading older messages..." : "Load older messages"}
              </button>
            </div>
          ) : null}
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 p-10 text-center text-stone-500">
              No messages yet. Send the first remote coding instruction to begin.
            </div>
          ) : (
            <MessageFeed messages={messages} />
          )}
        </div>
        </div>
        {showScrollToBottom ? (
          <button
            type="button"
            onClick={scrollToBottom}
            className="absolute bottom-5 right-5 inline-flex h-11 w-11 items-center justify-center rounded-full border border-stone-200 bg-white/95 text-stone-700 shadow-lg shadow-stone-300/30 backdrop-blur transition hover:bg-stone-50 hover:text-stone-900"
            title="Scroll to bottom"
          >
            <ArrowDownIcon className="h-5 w-5" />
          </button>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-stone-200/70 bg-white/95 backdrop-blur px-4 sm:px-8 py-4">
        <div className={`mx-auto ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
          <CommandInput
            value={draft}
            onChange={onDraftChange}
            onSend={onSend}
            commands={commands}
            isLoadingCommands={isLoadingCommands}
            commandsError={commandsError}
            agent={agent}
            onAgentChange={onAgentChange}
            isPreparingSend={isPreparingSend}
            isSending={isSending}
            isSendLocked={isSendLocked}
            queuedCount={queuedCount}
            isBusy={isBusy}
            canUndoLastMessage={canUndoLastMessage}
            canRedoLastMessage={canRedoLastMessage}
            canForkLastMessage={canForkLastMessage}
            isUndoingLastMessage={isUndoingLastMessage}
            isRedoingLastMessage={isRedoingLastMessage}
            isForkingLastMessage={isForkingLastMessage}
            runningCommandName={runningCommandName}
            onRunCommand={onRunCommand}
            onUndoLastMessage={onUndoLastMessage}
            onRedoLastMessage={onRedoLastMessage}
            onForkLastMessage={onForkLastMessage}
          />
        </div>
      </div>
    </div>
  );
}

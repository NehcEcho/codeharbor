import { useEffect, useMemo, useRef } from "react";
import { CommandInput } from "../chat/CommandInput";
import { MessageFeed } from "../chat/MessageFeed";
import type { ChatMessage, Session } from "../../../types";
import { BotIcon } from "../ui/icons";

export function WorkspacePage({
  session,
  messages,
  draft,
  agent,
  isSending,
  isBusy,
  isStalled,
  onDraftChange,
  onAgentChange,
  onSend,
  onPermissionAction,
  serverLabel,
  hasSidePanel,
}: {
  session: Session | null;
  messages: ChatMessage[];
  draft: string;
  agent: "build" | "plan";
  isSending: boolean;
  isBusy: boolean;
  isStalled: boolean;
  onDraftChange: (value: string) => void;
  onAgentChange: (agent: "build" | "plan") => void;
  onSend: () => void;
  onPermissionAction: (id: string, action: "approved" | "denied") => void;
  serverLabel: string;
  hasSidePanel: boolean;
}) {
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [messages]);

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
        ) : isBusy ? (
          <div className={`mx-auto mt-3 ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              OpenCode is still processing this session. If nothing new appears, it may be waiting on a long-running tool or stuck server-side.
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-8 py-6" ref={feedRef}>
        <div className={`mx-auto space-y-8 ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
          {messages.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50/70 p-10 text-center text-stone-500">
              No messages yet. Send the first remote coding instruction to begin.
            </div>
          ) : (
            <MessageFeed messages={messages} onPermissionAction={onPermissionAction} />
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-stone-200/70 bg-white/95 backdrop-blur px-4 sm:px-8 py-4">
        <div className={`mx-auto ${hasSidePanel ? "max-w-3xl xl:max-w-[52rem]" : "max-w-4xl"}`}>
          <CommandInput
            value={draft}
            onChange={onDraftChange}
            onSend={onSend}
            agent={agent}
            onAgentChange={onAgentChange}
            isSending={isSending}
            isBusy={isBusy}
          />
        </div>
      </div>
    </div>
  );
}

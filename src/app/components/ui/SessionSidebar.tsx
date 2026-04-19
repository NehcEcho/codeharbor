import { clsx } from "clsx";
import type { Session, SessionStatusMap } from "../../../types";
import {
  AlertTriangleIcon,
  ClockIcon,
  MessageSquareIcon,
  PlusIcon,
  SearchIcon,
  ZapIcon,
} from "./icons";

function formatUpdated(session: Session) {
  const updated = session.time?.updated || session.time?.created;
  if (!updated) return "Unknown";

  const diff = Date.now() - updated;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(updated).toLocaleDateString();
}

export function SessionSidebar({
  sessions,
  statusMap,
  selectedId,
  onSelect,
  onCreate,
}: {
  sessions: Session[];
  statusMap: SessionStatusMap;
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
}) {
  return (
    <div className="flex flex-col h-full bg-inherit">
      <div className="p-4 flex flex-col gap-4 sticky top-0 bg-[#FAFAEE]/95 backdrop-blur-sm z-10 border-b border-stone-100/50 pb-3 shadow-[0_4px_10px_rgba(0,0,0,0.01)] shrink-0">
        <button className="flex items-center gap-2 justify-center w-full py-2.5 bg-stone-100 text-stone-900 border border-stone-200/50 rounded-lg text-sm font-medium hover:bg-stone-200/50 transition-colors shadow-sm active:scale-[0.98]" onClick={onCreate} type="button">
          <PlusIcon className="w-4 h-4 text-stone-600" />
          New Session
        </button>

        <div className="relative group">
          <SearchIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
          <input
            type="text"
            placeholder="Search sessions..."
            className="w-full pl-9 pr-3 py-2 bg-white/60 border border-stone-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-400 transition-all text-stone-700 placeholder-stone-400"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overflow-x-hidden pt-2 pb-4">
        <div className="px-3 space-y-1">
          <div className="px-3 pb-2 pt-1 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">Recent</div>
          {sessions.length === 0 ? (
            <div className="px-3 py-6 text-sm text-stone-400">No sessions yet. Start one to begin a remote coding task.</div>
          ) : null}
          {sessions.map((session) => {
            const isActive = selectedId === session.id;
            const status = statusMap[session.id] || "idle";

            return (
              <button
                key={session.id}
                onClick={() => onSelect(session.id)}
                className={clsx(
                  "group flex flex-col gap-1 p-3 rounded-xl transition-all border border-transparent w-full text-left",
                  isActive ? "bg-white border-stone-200 shadow-sm" : "hover:bg-stone-100/80 hover:border-stone-200/30",
                )}
                type="button"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MessageSquareIcon className={clsx("w-4 h-4 shrink-0 mt-0.5", isActive ? "text-stone-800" : "text-stone-400 group-hover:text-stone-600")} />
                    <span className={clsx("text-sm truncate font-medium", isActive ? "text-stone-900" : "text-stone-700")}>
                      {session.title || "Untitled Session"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pl-6 mt-1 text-[11px]">
                  <span className="flex items-center gap-1 text-stone-400">
                    <ClockIcon className="w-3 h-3" />
                    {formatUpdated(session)}
                  </span>

                  {status === "running" ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-medium bg-emerald-50/50 px-1.5 py-0.5 rounded border border-emerald-100/50">
                      <ZapIcon className="w-3 h-3 fill-current" /> Running
                    </span>
                  ) : null}
                  {status === "error" ? (
                    <span className="flex items-center gap-1 text-rose-600 font-medium bg-rose-50/50 px-1.5 py-0.5 rounded border border-rose-100/50">
                      <AlertTriangleIcon className="w-3 h-3" /> Error
                    </span>
                  ) : null}
                  {status === "idle" ? (
                    <span className="flex items-center gap-1 text-stone-400 px-1.5 py-0.5 rounded border border-transparent">Idle</span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

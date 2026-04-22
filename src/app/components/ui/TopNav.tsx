import { ActivityIcon, ChevronRightIcon, MenuIcon, RefreshCwIcon, SettingsIcon, TerminalIcon } from "./icons";

interface TopNavProps {
  isConnected: boolean;
  onMenuClick: () => void;
  onStatusClick: () => void;
  onRefreshClick: () => void;
  isRefreshing: boolean;
  onSettingsClick: () => void;
  serverLabel: string;
  sessionLabel: string;
  pendingActionCount: number;
}

export function TopNav({
  isConnected,
  onMenuClick,
  onStatusClick,
  onRefreshClick,
  isRefreshing,
  onSettingsClick,
  serverLabel,
  sessionLabel,
  pendingActionCount,
}: TopNavProps) {
  const hasPendingActions = pendingActionCount > 0;

  return (
    <header className="h-14 border-b border-stone-200 bg-[#FCFCFA]/90 backdrop-blur-md sticky top-0 z-30 px-4 flex items-center justify-between font-medium text-stone-700 text-sm shrink-0">
      <div className="flex items-center gap-4">
        {isConnected ? (
          <button onClick={onMenuClick} className="md:hidden p-1.5 hover:bg-stone-100 rounded-md text-stone-500" type="button">
            <MenuIcon className="w-5 h-5" />
          </button>
        ) : null}

        <div className="flex items-center gap-2 text-stone-900 transition-colors group">
          <div className="bg-stone-900 text-white p-1 rounded-md shadow-sm group-hover:bg-stone-800 transition-colors">
            <TerminalIcon className="w-4 h-4" />
          </div>
          <span className="font-semibold tracking-tight">OpenCode Remote</span>
        </div>

        {isConnected ? (
          <div className="hidden sm:flex items-center gap-2 text-stone-500 text-xs ml-4">
            <div className="h-4 w-[1px] bg-stone-200" />
            <div className="flex items-center gap-1.5 px-2 py-1 bg-stone-100 rounded-md border border-stone-200/50 hover:bg-stone-200/50 transition-colors">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ring-2 ring-emerald-500/20" />
              <span>{serverLabel || "OpenCode server"}</span>
            </div>
            <ChevronRightIcon className="w-3.5 h-3.5 text-stone-300" />
            <span className="text-stone-700 truncate max-w-[150px]">{sessionLabel || "No active session"}</span>
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        {isConnected ? (
          <>
            <button
              onClick={onRefreshClick}
              className="flex items-center gap-1.5 p-1.5 px-3 hover:bg-stone-100 rounded-md text-stone-600 transition-colors border border-transparent hover:border-stone-200/50 disabled:opacity-60"
              type="button"
              title="Refresh current session"
              disabled={isRefreshing}
            >
              <RefreshCwIcon className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
              <span className="text-xs hidden sm:inline-block">{isRefreshing ? "Refreshing" : "Refresh"}</span>
            </button>
            <button
              onClick={onStatusClick}
              className={`lg:hidden flex items-center gap-1.5 p-1.5 px-3 rounded-md transition-colors border ${
                hasPendingActions
                  ? "bg-red-50 text-red-700 border-red-200 shadow-[0_0_0_1px_rgba(239,68,68,0.08)]"
                  : "hover:bg-stone-100 text-stone-600 border-transparent hover:border-stone-200/50"
              }`}
              type="button"
              title={hasPendingActions ? `${pendingActionCount} pending approvals or questions` : "Status"}
            >
              <span className="relative flex items-center">
                <ActivityIcon className="w-4 h-4" />
                {hasPendingActions ? <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> : null}
              </span>
              <span className="text-xs hidden sm:inline-block">{hasPendingActions ? "Needs attention" : "Status"}</span>
            </button>
            {hasPendingActions ? (
              <button
                onClick={onStatusClick}
                className="hidden sm:flex items-center gap-2 px-3 py-1 bg-red-50 text-red-700 rounded-full border border-red-200 text-[11px] font-medium tracking-wide animate-pulse"
                type="button"
                title={`${pendingActionCount} pending approvals or questions`}
              >
                <span className="h-2 w-2 rounded-full bg-red-500" />
                {pendingActionCount === 1 ? "1 PENDING ACTION" : `${pendingActionCount} PENDING ACTIONS`}
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100/50 text-[11px] font-medium tracking-wide">
                CONNECTED
              </div>
            )}
          </>
        ) : (
          <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-stone-100 text-stone-600 rounded-full border border-stone-200/50 text-[11px] font-medium tracking-wide">
            OFFLINE
          </div>
        )}
        <button
          className="p-1.5 hover:bg-stone-100 rounded-md text-stone-500 transition-colors"
          title="Settings"
          type="button"
          onClick={onSettingsClick}
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

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
}: TopNavProps) {
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
              className="lg:hidden flex items-center gap-1.5 p-1.5 px-3 hover:bg-stone-100 rounded-md text-stone-600 transition-colors border border-transparent hover:border-stone-200/50"
              type="button"
            >
              <ActivityIcon className="w-4 h-4" />
              <span className="text-xs hidden sm:inline-block">Status</span>
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-100/50 text-[11px] font-medium tracking-wide">
              CONNECTED
            </div>
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

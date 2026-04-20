import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TopNav } from "../ui/TopNav";
import { SessionSidebar } from "../ui/SessionSidebar";
import { StatusPanel } from "../ui/StatusPanel";
import { ConnectPage } from "../pages/ConnectPage";
import { WorkspacePage } from "../pages/WorkspacePage";
import type {
  ChatMessage,
  ConnectionState,
  ServerConfig,
  Session,
  SessionStatusMap,
} from "../../../types";

export function MainLayout({
  isConnected,
  config,
  connectStatus,
  connectionState,
  isConnecting,
  sessions,
  statusMap,
  selectedSessionId,
  selectedSession,
  messages,
  draft,
  agent,
  isSending,
  queuedCount,
  isRefreshingSession,
  isBusy,
  isStalled,
  diffCount,
  events,
  onConfigChange,
  onConnect,
  onSessionSelect,
  onCreateSession,
  onRefreshCurrentSession,
  onDraftChange,
  onAgentChange,
  onSend,
  onRefreshDiff,
  onPermissionAction,
}: {
  isConnected: boolean;
  config: ServerConfig;
  connectStatus: string;
  connectionState: ConnectionState;
  isConnecting: boolean;
  sessions: Session[];
  statusMap: SessionStatusMap;
  selectedSessionId: string | null;
  selectedSession: Session | null;
  messages: ChatMessage[];
  draft: string;
  agent: "build" | "plan";
  isSending: boolean;
  queuedCount: number;
  isRefreshingSession: boolean;
  isBusy: boolean;
  isStalled: boolean;
  diffCount: number;
  events: string[];
  onConfigChange: (next: ServerConfig) => void;
  onConnect: () => void;
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => void;
  onRefreshCurrentSession: () => void;
  onDraftChange: (value: string) => void;
  onAgentChange: (agent: "build" | "plan") => void;
  onSend: () => void;
  onRefreshDiff: () => void;
  onPermissionAction: (id: string, action: "approved" | "denied") => void;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
    setIsMobileStatusOpen(false);
  }, [selectedSessionId, isConnected]);

  const serverLabel = useMemo(() => {
    if (!config.baseUrl) return "OpenCode server";
    return config.baseUrl.replace(/^https?:\/\//, "");
  }, [config.baseUrl]);

  const permissionMessages = useMemo(
    () => messages.filter((message) => message.role === "permission" && message.status !== "approved" && message.status !== "denied"),
    [messages],
  );

  return (
    <div className="flex h-screen flex-col bg-[#FCFCFA] text-stone-800 font-sans overflow-hidden selection:bg-stone-200 selection:text-stone-900">
      <TopNav
        isConnected={isConnected}
        onMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        onStatusClick={() => setIsMobileStatusOpen(!isMobileStatusOpen)}
        onRefreshClick={onRefreshCurrentSession}
        isRefreshing={isRefreshingSession}
        onSettingsClick={() => {}}
        serverLabel={serverLabel}
        sessionLabel={selectedSession?.title || "No active session"}
      />

      <div className="flex flex-1 overflow-hidden relative">
        {isConnected ? (
          <>
            <div className="hidden md:block w-72 border-r border-stone-200/60 bg-[#FAFAEE]/30 flex-shrink-0">
              <SessionSidebar
                sessions={sessions}
                statusMap={statusMap}
                selectedId={selectedSessionId}
                onSelect={onSessionSelect}
                onCreate={onCreateSession}
              />
            </div>

            <AnimatePresence>
              {isMobileSidebarOpen ? (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-stone-900/20 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileSidebarOpen(false)}
                  />
                  <motion.div
                    initial={{ x: "-100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "-100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-y-0 left-0 w-72 bg-[#FCFCFA] border-r border-stone-200 z-50 md:hidden flex flex-col pt-14"
                  >
                    <SessionSidebar
                      sessions={sessions}
                      statusMap={statusMap}
                      selectedId={selectedSessionId}
                      onSelect={onSessionSelect}
                      onCreate={onCreateSession}
                    />
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}

        <main className="flex-1 flex flex-col min-w-0 bg-white shadow-[0_0_40px_rgba(0,0,0,0.01)] rounded-tl-2xl border-t border-l border-stone-200/50">
          {isConnected ? (
              <WorkspacePage
                session={selectedSession}
                messages={messages}
                draft={draft}
                agent={agent}
                isSending={isSending}
                queuedCount={queuedCount}
                isBusy={isBusy}
                isStalled={isStalled}
                onDraftChange={onDraftChange}
                onAgentChange={onAgentChange}
                onSend={onSend}
                onPermissionAction={onPermissionAction}
                serverLabel={serverLabel}
                hasSidePanel={permissionMessages.length > 0}
              />
          ) : (
            <ConnectPage
              config={config}
              status={connectStatus}
              state={connectionState}
              isBusy={isConnecting}
              onChange={onConfigChange}
              onConnect={onConnect}
            />
          )}
        </main>

        {isConnected ? (
          <>
            <div className="hidden lg:block w-80 border-l border-stone-200/60 bg-[#FAFAEE]/30 flex-shrink-0">
              <StatusPanel permissionMessages={permissionMessages} onPermissionAction={onPermissionAction} />
            </div>

            <AnimatePresence>
              {isMobileStatusOpen ? (
                <>
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-stone-900/20 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setIsMobileStatusOpen(false)}
                  />
                  <motion.div
                    initial={{ x: "100%" }}
                    animate={{ x: 0 }}
                    exit={{ x: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 200 }}
                    className="fixed inset-y-0 right-0 w-80 bg-[#FCFCFA] border-l border-stone-200 z-50 lg:hidden flex flex-col pt-14"
                  >
                    <StatusPanel permissionMessages={permissionMessages} onPermissionAction={onPermissionAction} />
                  </motion.div>
                </>
              ) : null}
            </AnimatePresence>
          </>
        ) : null}
      </div>
    </div>
  );
}

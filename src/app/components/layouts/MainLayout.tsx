import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { TopNav } from "../ui/TopNav";
import { SessionSidebar } from "../ui/SessionSidebar";
import { StatusPanel } from "../ui/StatusPanel";
import { SettingsPanel } from "../ui/SettingsPanel";
import { ConnectPage } from "../pages/ConnectPage";
import { WorkspacePage } from "../pages/WorkspacePage";
import type {
  ChatMessage,
  CommandItem,
  ConfigProvider,
  ConnectionState,
  PermissionRequest,
  QuestionRequest,
  SkillItem,
  ServerConfig,
  Session,
  SessionStatusMap,
} from "../../../types";

export function MainLayout({
  isConnected,
  config,
  modelProviders,
  isLoadingModels,
  modelError,
  commands,
  isLoadingCommands,
  commandsError,
  skills,
  isLoadingSkills,
  skillsError,
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
  canRetryLastMessage,
  isRetryingLastMessage,
  isAbortingSession,
  runningCommandName,
  diffCount,
  events,
  permissionRequests,
  questionRequests,
  onConfigChange,
  onCompactContext,
  isCompactingContext,
  canCompactContext,
  onConnect,
  onSessionSelect,
  onCreateSession,
  onRefreshCurrentSession,
  onDraftChange,
  onAgentChange,
  onSend,
  onRunCommand,
  onRetryLastMessage,
  onAbortSession,
  onRefreshDiff,
  onPermissionAction,
  respondingPermissionId,
  onQuestionReply,
  onQuestionReject,
}: {
  isConnected: boolean;
  config: ServerConfig;
  modelProviders: ConfigProvider[];
  isLoadingModels: boolean;
  modelError: string | null;
  commands: CommandItem[];
  isLoadingCommands: boolean;
  commandsError: string | null;
  skills: SkillItem[];
  isLoadingSkills: boolean;
  skillsError: string | null;
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
  canRetryLastMessage: boolean;
  isRetryingLastMessage: boolean;
  isAbortingSession: boolean;
  runningCommandName: string | null;
  diffCount: number;
  events: string[];
  permissionRequests: PermissionRequest[];
  questionRequests: QuestionRequest[];
  onConfigChange: (next: ServerConfig) => void;
  onCompactContext: () => void;
  isCompactingContext: boolean;
  canCompactContext: boolean;
  onConnect: () => void;
  onSessionSelect: (sessionId: string) => void;
  onCreateSession: () => void;
  onRefreshCurrentSession: () => void;
  onDraftChange: (value: string) => void;
  onAgentChange: (agent: "build" | "plan") => void;
  onSend: () => void;
  onRunCommand: (commandName: string, argumentsText: string) => void;
  onRetryLastMessage: () => void;
  onAbortSession: () => void;
  onRefreshDiff: () => void;
  onPermissionAction: (id: string, action: "once" | "always" | "reject") => Promise<void>;
  respondingPermissionId: string | null;
  onQuestionReply: (id: string, answers: string[][]) => Promise<void>;
  onQuestionReject: (id: string) => Promise<void>;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isMobileStatusOpen, setIsMobileStatusOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    setIsMobileSidebarOpen(false);
    setIsMobileStatusOpen(false);
  }, [selectedSessionId, isConnected]);

  useEffect(() => {
    if (!isConnected) {
      setIsSettingsOpen(false);
    }
    if (isConnected) {
      setIsSettingsOpen(false);
    }
  }, [isConnected]);

  const serverLabel = useMemo(() => {
    if (!config.baseUrl) return "OpenCode server";
    return config.baseUrl.replace(/^https?:\/\//, "");
  }, [config.baseUrl]);

  const modelOptions = useMemo(() => {
    const options = [{ value: "", label: "跟随后端默认模型" }];

    for (const provider of modelProviders) {
      const models = Object.values(provider.models)
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((model) => ({
          value: `${provider.id}/${model.id}`,
          label: `${provider.name} / ${model.name}`,
        }));

      options.push(...models);
    }

    if (config.model && !options.some((option) => option.value === config.model)) {
      options.push({ value: config.model, label: `${config.model} (当前值)` });
    }

    return options;
  }, [config.model, modelProviders]);

  const pendingActionCount = permissionRequests.length + questionRequests.length;

  return (
    <div className="flex h-screen flex-col bg-[#FCFCFA] text-stone-800 font-sans overflow-hidden selection:bg-stone-200 selection:text-stone-900">
      <TopNav
        isConnected={isConnected}
        onMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        onStatusClick={() => setIsMobileStatusOpen(!isMobileStatusOpen)}
        onRefreshClick={onRefreshCurrentSession}
        isRefreshing={isRefreshingSession}
        onSettingsClick={() => setIsSettingsOpen((current) => !current)}
        serverLabel={serverLabel}
        sessionLabel={selectedSession?.title || "No active session"}
        pendingActionCount={pendingActionCount}
      />

      <AnimatePresence>
        {isConnected && isSettingsOpen ? (
          <SettingsPanel
            config={config}
            modelOptions={modelOptions}
            isLoadingModels={isLoadingModels}
            modelError={modelError}
            skills={skills}
            isLoadingSkills={isLoadingSkills}
            skillsError={skillsError}
            onConfigChange={onConfigChange}
            onCompactContext={onCompactContext}
            isCompactingContext={isCompactingContext}
            canCompactContext={canCompactContext}
            onClose={() => setIsSettingsOpen(false)}
          />
        ) : null}
      </AnimatePresence>

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
                commands={commands}
                isLoadingCommands={isLoadingCommands}
                commandsError={commandsError}
                isSending={isSending}
                queuedCount={queuedCount}
                isBusy={isBusy}
                isStalled={isStalled}
                canRetryLastMessage={canRetryLastMessage}
                isRetryingLastMessage={isRetryingLastMessage}
                isAbortingSession={isAbortingSession}
                runningCommandName={runningCommandName}
                onDraftChange={onDraftChange}
                onAgentChange={onAgentChange}
                onSend={onSend}
                onRunCommand={onRunCommand}
                onRetryLastMessage={onRetryLastMessage}
                onAbortSession={onAbortSession}
                serverLabel={serverLabel}
                hasSidePanel={permissionRequests.length > 0 || questionRequests.length > 0}
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
              <StatusPanel
                permissionRequests={permissionRequests}
                questionRequests={questionRequests}
                respondingPermissionId={respondingPermissionId}
                onPermissionAction={onPermissionAction}
                onQuestionReply={onQuestionReply}
                onQuestionReject={onQuestionReject}
              />
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
                    <StatusPanel
                      permissionRequests={permissionRequests}
                      questionRequests={questionRequests}
                      respondingPermissionId={respondingPermissionId}
                      onPermissionAction={onPermissionAction}
                      onQuestionReply={onQuestionReply}
                      onQuestionReject={onQuestionReject}
                    />
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

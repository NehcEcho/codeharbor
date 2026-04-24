import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "./app/components/layouts/MainLayout";
import { opencodeApi } from "./lib/opencode";
import {
  findPermissionSessionId,
  findQuestionSessionId,
  getSessionCursor,
  isLatestSessionRequest,
  isLatestSessionMessageRequest,
  nextSessionRequestSeq,
  nextSessionMessageRequestSeq,
  pruneSessionRecord,
  setSessionCursor,
  shouldBlockDuplicateSend,
  shouldClearSendSubmissionGuard,
  shouldRestoreFailedDraft,
  type MessageRequestKind,
  type SendSubmissionGuard,
} from "./lib/appController";
import {
  appendMessageDelta,
  confirmOptimisticMessage,
  formatTimestamp,
  getLatestUserMessageTarget,
  getVisibleMessages,
  mapMessageEnvelope,
  markMessageDeliveryFailed,
  normalizeBaseUrl,
  normalizeSessionStatus,
  prependOlderMessages,
  sortMessages,
  upsertMessagesById,
  upsertMessageInfo,
  upsertMessagePart,
  upsertPermissionRequest,
  upsertQuestionRequest,
  upsertSession,
  removePermissionRequest,
  removeQuestionRequest,
} from "./lib/appState";
import { loadServerConfig, saveServerConfig } from "./lib/storage";
import type {
  ChatMessage,
  CommandItem,
  ConfigProvider,
  ConnectionState,
  MessageEnvelope,
  MessagePage,
  PermissionRequest,
  QuestionActionResult,
  QuestionRequest,
  SkillItem,
  ServerConfig,
  Session,
  SessionStatusMap,
} from "./types";

type SessionActivityMap = Record<string, { busySince?: number; lastActivityAt?: number }>;

type QueuedMessage = {
  id: string;
  sessionId: string;
  text: string;
  agent: "build" | "plan";
  model: string;
  optimisticMessageId: string;
  createdAt: number;
};

type SentMessageDraft = {
  text: string;
  agent: "build" | "plan";
  model: string;
};

type SessionActionTarget = {
  id: string;
  text: string;
};

type AwaitingSessionCompletion = {
  sessionId: string;
  seenBusy: boolean;
  startedAt: number;
};

const INITIAL_MESSAGE_PAGE_SIZE = 30;
const OLDER_MESSAGE_PAGE_SIZE = 30;

function markSessionActivity(current: SessionActivityMap, sessionID: string, timestamp = Date.now()) {
  const next = current[sessionID] || {};
  return {
    ...current,
    [sessionID]: {
      ...next,
      lastActivityAt: timestamp,
    },
  };
}

function normalizeModelValue(model: string, providers: ConfigProvider[]) {
  const trimmed = model.trim();
  if (!trimmed) return "";

  const available = new Set(
    providers.flatMap((provider) => Object.keys(provider.models).map((modelId) => `${provider.id}/${modelId}`)),
  );

  return available.has(trimmed) ? trimmed : "";
}

function splitProviderModel(model: string) {
  const slashIndex = model.indexOf("/");
  if (slashIndex <= 0 || slashIndex === model.length - 1) return null;

  return {
    providerID: model.slice(0, slashIndex),
    modelID: model.slice(slashIndex + 1),
  };
}

function resolveCompactionModel(selectedModel: string, providers: ConfigProvider[], providerDefaults: Record<string, string>) {
  const explicit = splitProviderModel(selectedModel);
  if (explicit) return explicit;

  for (const provider of providers) {
    const defaultModelID = providerDefaults[provider.id];
    if (defaultModelID && provider.models[defaultModelID]) {
      return { providerID: provider.id, modelID: defaultModelID };
    }
  }

  for (const provider of providers) {
    const firstModelID = Object.keys(provider.models)[0];
    if (firstModelID) {
      return { providerID: provider.id, modelID: firstModelID };
    }
  }

  return null;
}

function removeSessionKey<T>(current: Record<string, T>, sessionId: string) {
  const { [sessionId]: _removed, ...rest } = current;
  return rest;
}

function App() {
  const [config, setConfig] = useState<ServerConfig>(() => loadServerConfig());
  const [connectStatus, setConnectStatus] = useState("尚未连接");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [statusMap, setStatusMap] = useState<SessionStatusMap>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messagesBySession, setMessagesBySession] = useState<Record<string, ChatMessage[]>>({});
  const [messagesNextCursorBySession, setMessagesNextCursorBySession] = useState<Record<string, string | null>>({});
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [draft, setDraft] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("build");
  const [isSending, setIsSending] = useState(false);
  const [sendSubmissionGuard, setSendSubmissionGuard] = useState<SendSubmissionGuard | null>(null);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [diffCountBySession, setDiffCountBySession] = useState<Record<string, number>>({});
  const [events, setEvents] = useState<string[]>([]);
  const [modelProviders, setModelProviders] = useState<ConfigProvider[]>([]);
  const [providerDefaults, setProviderDefaults] = useState<Record<string, string>>({});
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [commands, setCommands] = useState<CommandItem[]>([]);
  const [isLoadingCommands, setIsLoadingCommands] = useState(false);
  const [commandsError, setCommandsError] = useState<string | null>(null);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [isLoadingSkills, setIsLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [runningCommandName, setRunningCommandName] = useState<string | null>(null);
  const [permissionRequestsBySession, setPermissionRequestsBySession] = useState<Record<string, PermissionRequest[]>>({});
  const [respondingPermissionId, setRespondingPermissionId] = useState<string | null>(null);
  const [questionRequestsBySession, setQuestionRequestsBySession] = useState<Record<string, QuestionRequest[]>>({});
  const [sessionActivity, setSessionActivity] = useState<SessionActivityMap>({});
  const [lastSentDraftBySession, setLastSentDraftBySession] = useState<Record<string, SentMessageDraft>>({});
  const [queuedMessagesBySession, setQueuedMessagesBySession] = useState<Record<string, QueuedMessage[]>>({});
  const [inFlightSessions, setInFlightSessions] = useState<Record<string, true>>({});
  const [awaitingSessionCompletionBySession, setAwaitingSessionCompletionBySession] = useState<Record<string, AwaitingSessionCompletion>>({});
  const [undoingSessionId, setUndoingSessionId] = useState<string | null>(null);
  const [redoingSessionId, setRedoingSessionId] = useState<string | null>(null);
  const [forkingSessionId, setForkingSessionId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const refreshTimeoutsRef = useRef<Record<string, number>>({});
  const reconnectTimeoutRef = useRef<number | null>(null);
  const selectedSessionIdRef = useRef<string | null>(null);
  const knownSessionIdsRef = useRef<string[]>([]);
  const configRef = useRef(config);
  const messageRequestSeqRef = useRef<Record<string, Record<MessageRequestKind, number>>>({});
  const remoteConfigRequestSeqRef = useRef(0);
  const modelProvidersRequestSeqRef = useRef(0);
  const diffRequestSeqRef = useRef<Record<string, number>>({});
  const questionsRequestSeqRef = useRef<Record<string, number>>({});
  const permissionsRequestSeqRef = useRef<Record<string, number>>({});
  const reconnectAttemptRef = useRef(0);
  const healthFailureCountRef = useRef(0);
  const inFlightSessionsRef = useRef<Set<string>>(new Set());
  const permissionRequestsBySessionRef = useRef<Record<string, PermissionRequest[]>>({});
  const questionRequestsBySessionRef = useRef<Record<string, QuestionRequest[]>>({});

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  selectedSessionIdRef.current = selectedSessionId;
  configRef.current = config;
  permissionRequestsBySessionRef.current = permissionRequestsBySession;
  questionRequestsBySessionRef.current = questionRequestsBySession;
  knownSessionIdsRef.current = sessions.map((session) => session.id);

  const selectedSessionStatus = selectedSessionId ? statusMap[selectedSessionId] : undefined;
  const isSessionBusy = selectedSessionStatus === "busy";
  const queuedMessages = selectedSessionId ? queuedMessagesBySession[selectedSessionId] || [] : [];
  const queuedCount = queuedMessages.length;
  const messages = selectedSessionId ? messagesBySession[selectedSessionId] || [] : [];
  const messagesNextCursor = useMemo(
    () => getSessionCursor(messagesNextCursorBySession, selectedSessionId),
    [messagesNextCursorBySession, selectedSessionId],
  );
  const diffCount = selectedSessionId ? diffCountBySession[selectedSessionId] || 0 : 0;
  const permissionRequests = selectedSessionId ? permissionRequestsBySession[selectedSessionId] || [] : [];
  const questionRequests = selectedSessionId ? questionRequestsBySession[selectedSessionId] || [] : [];
  const selectedModel = useMemo(() => normalizeModelValue(config.model, modelProviders), [config.model, modelProviders]);
  const selectedActivity = selectedSessionId ? sessionActivity[selectedSessionId] : undefined;
  const canRedoLastMessage = Boolean(selectedSession?.revert?.messageID);
  const visibleMessages = useMemo(
    () => getVisibleMessages(messages, selectedSession?.revert?.messageID),
    [messages, selectedSession?.revert?.messageID],
  );
  const latestUserMessageTarget = useMemo(() => getLatestUserMessageTarget(visibleMessages), [visibleMessages]);
  const isSessionStalled = Boolean(
    isSessionBusy &&
      selectedActivity?.busySince &&
      clock - selectedActivity.busySince > 15000 &&
      clock - (selectedActivity.lastActivityAt || selectedActivity.busySince) > 15000,
  );

  const refreshSessions = useCallback(async (targetConfig: ServerConfig = config) => {
    const [sessionList, nextStatusMap] = await Promise.all([
      opencodeApi.listSessions(targetConfig),
      opencodeApi.getSessionStatus(targetConfig),
    ]);
    const sorted = [...sessionList].sort(
      (left, right) => (right.time?.updated || 0) - (left.time?.updated || 0),
    );
    const validSessionIds = new Set(sorted.map((session) => session.id));

    setSessions(sorted);
    setStatusMap(nextStatusMap);
    setMessagesBySession((current) => pruneSessionRecord(current, validSessionIds));
    setMessagesNextCursorBySession((current) => pruneSessionRecord(current, validSessionIds));
    setDiffCountBySession((current) => pruneSessionRecord(current, validSessionIds));
    setPermissionRequestsBySession((current) => pruneSessionRecord(current, validSessionIds));
    setQuestionRequestsBySession((current) => pruneSessionRecord(current, validSessionIds));
    setSessionActivity((current) => pruneSessionRecord(current, validSessionIds));
    setLastSentDraftBySession((current) => pruneSessionRecord(current, validSessionIds));
    setQueuedMessagesBySession((current) => pruneSessionRecord(current, validSessionIds));
    setInFlightSessions((current) => pruneSessionRecord(current, validSessionIds));
    setAwaitingSessionCompletionBySession((current) => pruneSessionRecord(current, validSessionIds));

    messageRequestSeqRef.current = pruneSessionRecord(messageRequestSeqRef.current, validSessionIds);
    diffRequestSeqRef.current = pruneSessionRecord(diffRequestSeqRef.current, validSessionIds);
    questionsRequestSeqRef.current = pruneSessionRecord(questionsRequestSeqRef.current, validSessionIds);
    permissionsRequestSeqRef.current = pruneSessionRecord(permissionsRequestSeqRef.current, validSessionIds);
    inFlightSessionsRef.current = new Set(
      [...inFlightSessionsRef.current].filter((sessionId) => validSessionIds.has(sessionId)),
    );

    setSelectedSessionId((current) => {
      if (current && sorted.some((session) => session.id === current)) {
        return current;
      }
      return sorted[0]?.id || null;
    });
  }, [config]);

  const resetSelectedSessionState = useCallback(() => {
    setIsLoadingOlderMessages(false);
  }, []);

  const handleSessionSelect = useCallback((sessionId: string) => {
    if (sessionId === selectedSessionIdRef.current) return;
    resetSelectedSessionState();
    setSelectedSessionId(sessionId);
  }, [resetSelectedSessionState]);

  useEffect(() => {
    if (!selectedSessionId) return;

    const failedDraft = lastSentDraftBySession[selectedSessionId];
    const sessionMessages = messagesBySession[selectedSessionId] || [];
    if (!shouldRestoreFailedDraft(failedDraft, sessionMessages, draft)) return;

    setDraft((current) => (current.trim() ? current : failedDraft.text));
  }, [draft, lastSentDraftBySession, messagesBySession, selectedSessionId]);

  const refreshMessages = useCallback(async (options?: { sessionId?: string; before?: string; appendOlder?: boolean; limit?: number }) => {
    const sessionId = options?.sessionId ?? selectedSessionIdRef.current;
    if (!sessionId) return;

    const kind: MessageRequestKind = options?.appendOlder ? "older" : "latest";
    const nextSeq = nextSessionMessageRequestSeq(messageRequestSeqRef.current, sessionId, kind);
    messageRequestSeqRef.current = nextSeq.nextState;
    const requestSeq = nextSeq.requestSeq;

    const page: MessagePage = await opencodeApi.listMessages(config, sessionId, {
      limit: options?.limit ?? INITIAL_MESSAGE_PAGE_SIZE,
      before: options?.before,
    });

    if (!isLatestSessionMessageRequest(messageRequestSeqRef.current, sessionId, kind, requestSeq)) {
      return;
    }

    const mapped = page.items.map(mapMessageEnvelope);
    setMessagesBySession((current) => ({
      ...current,
      [sessionId]: options?.appendOlder
        ? prependOlderMessages(current[sessionId] || [], mapped)
        : upsertMessagesById(current[sessionId] || [], mapped),
    }));
    setMessagesNextCursorBySession((current) => setSessionCursor(current, sessionId, page.nextCursor));
  }, [config]);

  const handleLoadOlderMessages = useCallback(async () => {
    if (!selectedSessionId || !messagesNextCursor || isLoadingOlderMessages) return;

    setIsLoadingOlderMessages(true);
    try {
      await refreshMessages({
        before: messagesNextCursor,
        appendOlder: true,
        limit: OLDER_MESSAGE_PAGE_SIZE,
      });
    } finally {
      setIsLoadingOlderMessages(false);
    }
  }, [isLoadingOlderMessages, messagesNextCursor, refreshMessages, selectedSessionId]);

  const refreshDiff = useCallback(async (sessionId = selectedSessionIdRef.current) => {
    if (!sessionId) return;

    const nextSeq = nextSessionRequestSeq(diffRequestSeqRef.current, sessionId);
    diffRequestSeqRef.current = nextSeq.nextState;
    const requestSeq = nextSeq.requestSeq;

    const diff = await opencodeApi.getDiff(config, sessionId);
    if (!isLatestSessionRequest(diffRequestSeqRef.current, sessionId, requestSeq)) return;
    setDiffCountBySession((current) => ({ ...current, [sessionId]: diff.length }));
  }, [config]);

  const refreshQuestions = useCallback(async (sessionId = selectedSessionIdRef.current) => {
    if (!sessionId) return;
    const requestSeq = (questionsRequestSeqRef.current[sessionId] || 0) + 1;
    questionsRequestSeqRef.current = { ...questionsRequestSeqRef.current, [sessionId]: requestSeq };
    const requests = await opencodeApi.listQuestions(config);
    if (requestSeq !== questionsRequestSeqRef.current[sessionId]) return;
    setQuestionRequestsBySession((current) => ({
      ...current,
      [sessionId]: requests.filter((item) => item.sessionID === sessionId),
    }));
  }, [config]);

  const refreshPermissions = useCallback(async (sessionId = selectedSessionIdRef.current) => {
    if (!sessionId) return;
    const requestSeq = (permissionsRequestSeqRef.current[sessionId] || 0) + 1;
    permissionsRequestSeqRef.current = { ...permissionsRequestSeqRef.current, [sessionId]: requestSeq };
    const requests = await opencodeApi.listPermissions(config);
    if (requestSeq !== permissionsRequestSeqRef.current[sessionId]) return;
    setPermissionRequestsBySession((current) => ({
      ...current,
      [sessionId]: requests.filter((item) => item.sessionID === sessionId),
    }));
  }, [config]);

  const refreshSessionData = useCallback(
    async (sessionId = selectedSessionIdRef.current) => {
      if (!sessionId) return;
      await Promise.all([
        refreshMessages({ sessionId }),
        refreshDiff(sessionId),
        refreshPermissions(sessionId),
        refreshQuestions(sessionId),
      ]);
    },
    [refreshDiff, refreshMessages, refreshPermissions, refreshQuestions],
  );

  const refreshRemoteConfig = useCallback(async (targetConfig: ServerConfig = configRef.current) => {
    const requestSeq = ++remoteConfigRequestSeqRef.current;
    if (!targetConfig.password) {
      const nextConfig = { ...targetConfig, model: "" };
      setConfig((current) => nextConfig.baseUrl === current.baseUrl ? { ...current, model: "" } : current);
      saveServerConfig(nextConfig);
      return null;
    }

    const remoteConfig = await opencodeApi.getGlobalConfig(targetConfig);
    const nextModel = typeof remoteConfig.model === "string" ? remoteConfig.model : "";
    setConfig((current) => {
      if (requestSeq !== remoteConfigRequestSeqRef.current) return current;
      if (
        current.baseUrl !== targetConfig.baseUrl ||
        current.username !== targetConfig.username ||
        current.password !== targetConfig.password
      ) {
        return current;
      }
      if (current.model !== targetConfig.model) {
        return current;
      }
      const nextConfig = { ...current, model: nextModel };
      saveServerConfig(nextConfig);
      return nextConfig;
    });
    return remoteConfig;
  }, []);

  const refreshModelProviders = useCallback(async (targetConfig: ServerConfig = configRef.current) => {
    const requestSeq = ++modelProvidersRequestSeqRef.current;
    if (!targetConfig.password) {
      setModelProviders([]);
      setProviderDefaults({});
      setModelError(null);
      return;
    }

    setIsLoadingModels(true);

    try {
      const response = await opencodeApi.listConfigProviders(targetConfig);
      if (requestSeq !== modelProvidersRequestSeqRef.current) return;
      setModelProviders(response.providers);
      setProviderDefaults(response.default);
      setModelError(null);
    } catch (error) {
      if (requestSeq !== modelProvidersRequestSeqRef.current) return;
      const message = error instanceof Error ? error.message : "failed to load models";
      setModelProviders([]);
      setProviderDefaults({});
      setModelError(`模型列表加载失败: ${message}`);
    } finally {
      if (requestSeq === modelProvidersRequestSeqRef.current) {
        setIsLoadingModels(false);
      }
    }
  }, []);

  const refreshCommands = useCallback(async (targetConfig: ServerConfig = configRef.current) => {
    if (!targetConfig.password) {
      setCommands([]);
      setCommandsError(null);
      return;
    }

    setIsLoadingCommands(true);

    try {
      const response = await opencodeApi.listCommands(targetConfig);
      setCommands(response.sort((left, right) => left.name.localeCompare(right.name)));
      setCommandsError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to load commands";
      setCommands([]);
      setCommandsError(`命令列表加载失败: ${message}`);
    } finally {
      setIsLoadingCommands(false);
    }
  }, []);

  const refreshSkills = useCallback(async (targetConfig: ServerConfig = configRef.current) => {
    if (!targetConfig.password) {
      setSkills([]);
      setSkillsError(null);
      return;
    }

    setIsLoadingSkills(true);

    try {
      const response = await opencodeApi.listSkills(targetConfig);
      setSkills(response);
      setSkillsError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to load skills";
      setSkills([]);
      setSkillsError(`Skills 加载失败: ${message}`);
    } finally {
      setIsLoadingSkills(false);
    }
  }, []);

  const handleRefreshCurrentSession = useCallback(async () => {
    if (isRefreshingSession) return;

    setIsRefreshingSession(true);
    try {
      const targetConfig = configRef.current;
      await Promise.allSettled([
        refreshRemoteConfig(targetConfig),
        refreshCommands(targetConfig),
        refreshModelProviders(targetConfig),
        refreshSkills(targetConfig),
        refreshSessions(targetConfig),
      ]);
      const sessionId = selectedSessionIdRef.current;
      if (sessionId) {
        await refreshSessionData(sessionId);
      }
      setEvents((current) => ["Manual refresh completed", ...current].slice(0, 20));
    } catch (error) {
      const message = error instanceof Error ? error.message : "refresh failed";
      setEvents((current) => [`Manual refresh failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setIsRefreshingSession(false);
    }
  }, [isRefreshingSession, refreshCommands, refreshModelProviders, refreshRemoteConfig, refreshSessionData, refreshSessions, refreshSkills]);

  const handleConnect = useCallback(async () => {
    const normalized = {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl),
    };

    if (!normalized.baseUrl || !normalized.username || !normalized.password) {
      setConnectionState("error");
      setConnectStatus("请填写 Server URL、Username 和 Password");
      return;
    }

    setIsConnecting(true);
    setConnectionState("idle");
    setConnectStatus("正在连接 OpenCode Server...");

    try {
      const health = await opencodeApi.health(normalized);
      healthFailureCountRef.current = 0;
      setConfig((current) => ({ ...current, ...normalized }));
      saveServerConfig(normalized);
      setConnectionState("success");
      setConnectStatus(`已连接 ${normalized.baseUrl} · v${health.version}`);
      await refreshRemoteConfig(normalized);
      await refreshCommands(normalized);
      await refreshModelProviders(normalized);
      await refreshSkills(normalized);
      await refreshSessions(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setConnectionState("error");
      setConnectStatus(`连接失败: ${message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [config, refreshCommands, refreshModelProviders, refreshRemoteConfig, refreshSessions, refreshSkills]);

  const handleCreateSession = useCallback(async () => {
    const title = window.prompt("给新的远程会话取个名字", "Remote coding task");
    if (!title) return;

    const created = await opencodeApi.createSession(config, { title });
    setSessions((current) => upsertSession(current, created));
    handleSessionSelect(created.id);
    window.setTimeout(() => {
      void refreshSessions();
    }, 600);
  }, [config, handleSessionSelect, refreshSessions]);

  const handleConfigChange = useCallback((next: ServerConfig) => {
    setConfig(next);
    saveServerConfig(next);
  }, []);

  const handleModelChange = useCallback(
    async (model: string) => {
      if (!model || model === configRef.current.model) return;

      const requestConfig = { ...configRef.current };
      const previousModel = requestConfig.model;
      setConfig((current) => {
        const nextConfig = { ...current, model };
        saveServerConfig(nextConfig);
        return nextConfig;
      });

      try {
        const nextRemoteConfig = await opencodeApi.updateGlobalConfig(requestConfig, { model });

        setConfig((current) => {
          if (
            current.baseUrl !== requestConfig.baseUrl ||
            current.username !== requestConfig.username ||
            current.password !== requestConfig.password
          ) {
            return current;
          }
          const nextConfig = {
            ...current,
            model: typeof nextRemoteConfig.model === "string" ? nextRemoteConfig.model : model,
          };
          saveServerConfig(nextConfig);
          return nextConfig;
        });
        setEvents((current) => [`Default model updated - ${model}`, ...current].slice(0, 20));
      } catch (error) {
        const message = error instanceof Error ? error.message : "model update failed";
        setConfig((current) => {
          if (current.model !== model) return current;
          const nextConfig = { ...current, model: previousModel };
          saveServerConfig(nextConfig);
          return nextConfig;
        });
        setEvents((current) => [`Default model update failed - ${message}`, ...current].slice(0, 20));
      }
    },
    [],
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!selectedSessionId || !text) return;
    if (shouldBlockDuplicateSend(sendSubmissionGuard, selectedSessionId, text)) return;

    const now = Date.now();
    const revertMessageId = selectedSession?.revert?.messageID;

    setIsSending(true);

    try {
      if (revertMessageId) {
        setSessions((current) =>
          current.map((session) =>
            session.id === selectedSessionId
              ? {
                  ...session,
                  revert: null,
                }
              : session,
          ),
        );
        const restoredSession = await opencodeApi.unrevertSession(config, selectedSessionId);
        setSessions((current) => upsertSession(current, restoredSession));
      }

    const optimisticMessageId = `local-${now}`;
    const queueItem: QueuedMessage = {
      id: `queue-${now}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: selectedSessionId,
      text,
      agent: selectedAgent as "build" | "plan",
      model: selectedModel,
      optimisticMessageId,
      createdAt: now,
    };

    const optimisticMessage: ChatMessage = {
      id: optimisticMessageId,
      role: "user",
      parts: [{ type: "text", text }],
      timestampLabel: formatTimestamp(),
      createdAt: now,
      isPending: true,
    };

    setSendSubmissionGuard({ sessionId: selectedSessionId, text });

    setQueuedMessagesBySession((current) => ({
      ...current,
      [selectedSessionId]: [...(current[selectedSessionId] || []), queueItem],
    }));
    setLastSentDraftBySession((current) => ({
      ...current,
      [selectedSessionId]: {
        text,
        agent: selectedAgent as "build" | "plan",
        model: selectedModel,
      },
    }));
    setMessagesBySession((current) => ({
      ...current,
      [selectedSessionId]: [...getVisibleMessages(current[selectedSessionId] || [], revertMessageId), optimisticMessage],
    }));
    setDraft("");
    setEvents((current) => {
      const queueSize = queuedCount + 1;
      const label = queueSize > 1 ? `Queued message ${queueSize} for session` : "Queued message for session";
      return [label, ...current].slice(0, 20);
    });
    } catch (error) {
      const message = error instanceof Error ? error.message : "send preparation failed";
      setEvents((current) => [`Send failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setIsSending(false);
    }
  }, [config, draft, queuedCount, selectedAgent, selectedModel, selectedSession, selectedSessionId, sendSubmissionGuard]);

  useEffect(() => {
    if (!shouldClearSendSubmissionGuard(sendSubmissionGuard, selectedSessionId, draft)) return;
    setSendSubmissionGuard(null);
  }, [draft, selectedSessionId, sendSubmissionGuard]);

  const handleUndoLastMessage = useCallback(async () => {
    if (!selectedSessionId || !latestUserMessageTarget || undoingSessionId === selectedSessionId) return;

    setUndoingSessionId(selectedSessionId);

    try {
      if (selectedSessionStatus && selectedSessionStatus !== "idle") {
        await opencodeApi.abortSession(config, selectedSessionId);
        setAwaitingSessionCompletionBySession((current) => removeSessionKey(current, selectedSessionId));
        setEvents((current) => [`Abort requested before undo - ${selectedSessionId}`, ...current].slice(0, 20));
      }

      await opencodeApi.revertSession(config, selectedSessionId, { messageID: latestUserMessageTarget.id });
      setDraft(latestUserMessageTarget.text);
      setEvents((current) => [`Undid last message - ${selectedSessionId}`, ...current].slice(0, 20));
      await Promise.all([refreshSessions(), refreshSessionData(selectedSessionId)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "undo failed";
      setEvents((current) => [`Undo failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setUndoingSessionId((current) => (current === selectedSessionId ? null : current));
    }
  }, [config, latestUserMessageTarget, refreshSessionData, refreshSessions, selectedSessionId, selectedSessionStatus, undoingSessionId]);

  const handleForkLastMessage = useCallback(async () => {
    if (!selectedSessionId || !latestUserMessageTarget || forkingSessionId === selectedSessionId) return;

    setForkingSessionId(selectedSessionId);

    try {
      const forked = await opencodeApi.forkSession(config, selectedSessionId, { messageID: latestUserMessageTarget.id });
      setDraft(latestUserMessageTarget.text);
      setEvents((current) => [`Forked from last message - ${selectedSessionId}`, ...current].slice(0, 20));
      setSessions((current) => upsertSession(current, forked));
      handleSessionSelect(forked.id);
      window.setTimeout(() => {
        void refreshSessions();
      }, 600);
    } catch (error) {
      const message = error instanceof Error ? error.message : "fork failed";
      setEvents((current) => [`Fork failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setForkingSessionId((current) => (current === selectedSessionId ? null : current));
    }
  }, [config, forkingSessionId, handleSessionSelect, latestUserMessageTarget, refreshSessions, selectedSessionId]);

  const handleRedoLastMessage = useCallback(async () => {
    if (!selectedSessionId || !selectedSession?.revert?.messageID || redoingSessionId === selectedSessionId) return;

    setRedoingSessionId(selectedSessionId);

    try {
      await opencodeApi.unrevertSession(config, selectedSessionId);
      setDraft("");
      setEvents((current) => [`Redid reverted messages - ${selectedSessionId}`, ...current].slice(0, 20));
      await Promise.all([refreshSessions(), refreshSessionData(selectedSessionId)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "redo failed";
      setEvents((current) => [`Redo failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setRedoingSessionId((current) => (current === selectedSessionId ? null : current));
    }
  }, [config, redoingSessionId, refreshSessionData, refreshSessions, selectedSession, selectedSessionId]);

  const handleCompactContext = useCallback(async () => {
    if (!selectedSessionId || runningCommandName) return;

    const targetModel = resolveCompactionModel(selectedModel, modelProviders, providerDefaults);
    if (!targetModel) {
      setEvents((current) => ["Compact failed - no available model", ...current].slice(0, 20));
      return;
    }

    setRunningCommandName("compact");
    setIsSending(true);
    setEvents((current) => ["Running command - /compact", ...current].slice(0, 20));

    try {
      await opencodeApi.summarizeSession(config, selectedSessionId, {
        providerID: targetModel.providerID,
        modelID: targetModel.modelID,
      });

      setAwaitingSessionCompletionBySession((current) => ({
        ...current,
        [selectedSessionId]: {
          sessionId: selectedSessionId,
          seenBusy: false,
          startedAt: Date.now(),
        },
      }));

      await Promise.all([refreshSessions(), refreshSessionData(selectedSessionId)]);

      window.setTimeout(() => {
        void refreshSessions();
        void refreshSessionData(selectedSessionId);
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "compact failed";
      setEvents((current) => [`Compact failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setRunningCommandName(null);
      setIsSending(false);
    }
  }, [config, modelProviders, providerDefaults, refreshSessionData, refreshSessions, runningCommandName, selectedModel, selectedSessionId]);

  const handleRunCommand = useCallback(
    async (commandName: string, argumentsText: string) => {
      if (!selectedSessionId || !commandName.trim() || runningCommandName) return;

      setRunningCommandName(commandName);
      setIsSending(true);
      setEvents((current) => [`Running command - /${commandName} ${argumentsText}`.trim(), ...current].slice(0, 20));

      try {
        await opencodeApi.runCommand(config, selectedSessionId, {
          command: commandName,
          arguments: argumentsText,
          agent: selectedAgent,
          model: selectedModel || undefined,
        });

        setAwaitingSessionCompletionBySession((current) => ({
          ...current,
          [selectedSessionId]: {
            sessionId: selectedSessionId,
            seenBusy: false,
            startedAt: Date.now(),
          },
        }));

        await Promise.all([refreshSessions(), refreshSessionData(selectedSessionId)]);

        window.setTimeout(() => {
          void refreshSessions();
          void refreshSessionData(selectedSessionId);
        }, 1200);
      } catch (error) {
        const message = error instanceof Error ? error.message : "command failed";
        setEvents((current) => [`Command failed - ${message}`, ...current].slice(0, 20));
      } finally {
        setRunningCommandName(null);
        setIsSending(false);
      }
    },
    [config, refreshSessionData, refreshSessions, runningCommandName, selectedAgent, selectedModel, selectedSessionId],
  );

  const dispatchQueuedMessage = useCallback(
    async (item: QueuedMessage) => {
      inFlightSessionsRef.current.add(item.sessionId);
      setInFlightSessions((current) => ({ ...current, [item.sessionId]: true }));
      setIsSending(item.sessionId === selectedSessionIdRef.current);

      try {
        const requestModel = item.model ? splitProviderModel(item.model) || undefined : undefined;

        const sentMessage = await opencodeApi.sendMessage(config, item.sessionId, {
          agent: item.agent,
          model: requestModel,
          parts: [{ type: "text", text: item.text }],
        });

        setMessagesBySession((current) => ({
          ...current,
          [item.sessionId]: confirmOptimisticMessage(
            current[item.sessionId] || [],
            item.optimisticMessageId,
            mapMessageEnvelope(sentMessage),
          ),
        }));
        setLastSentDraftBySession((current) => removeSessionKey(current, item.sessionId));

        setQueuedMessagesBySession((current) => {
          const sessionQueue = current[item.sessionId] || [];
          const nextSessionQueue = sessionQueue.filter((queued) => queued.id !== item.id);

          if (nextSessionQueue.length === 0) {
            const { [item.sessionId]: _removed, ...rest } = current;
            return rest;
          }

          return { ...current, [item.sessionId]: nextSessionQueue };
        });
        setEvents((current) => [`Sent queued message - ${item.agent}`, ...current].slice(0, 20));

        void refreshSessions();
        void refreshMessages({ sessionId: item.sessionId });
        void refreshDiff(item.sessionId);
      } catch (error) {
        setQueuedMessagesBySession((current) => {
          const sessionQueue = current[item.sessionId] || [];
          const nextSessionQueue = sessionQueue.filter((queued) => queued.id !== item.id);

          if (nextSessionQueue.length === 0) {
            const { [item.sessionId]: _removed, ...rest } = current;
            return rest;
          }

          return { ...current, [item.sessionId]: nextSessionQueue };
        });
        const message = error instanceof Error ? error.message : "send failed";
        setMessagesBySession((current) => ({
          ...current,
          [item.sessionId]: markMessageDeliveryFailed(
            current[item.sessionId] || [],
            item.optimisticMessageId,
            `Failed to send: ${message}. You can edit and resend.`,
          ),
        }));
        setLastSentDraftBySession((current) => ({
          ...current,
          [item.sessionId]: {
            text: item.text,
            agent: item.agent,
            model: item.model,
          },
        }));
        if (item.sessionId === selectedSessionIdRef.current) {
          setDraft((current) => (current.trim() ? current : item.text));
        }
        setEvents((current) => [`Queued send failed - ${message}`, ...current].slice(0, 20));
      } finally {
        inFlightSessionsRef.current.delete(item.sessionId);
        setInFlightSessions((current) => removeSessionKey(current, item.sessionId));
        if (item.sessionId === selectedSessionIdRef.current) {
          setIsSending(false);
        }
      }
    },
    [config, refreshDiff, refreshMessages, refreshSessions],
  );

  useEffect(() => {
    const nextMessages = Object.values(queuedMessagesBySession)
      .map((queue) => queue[0])
      .filter((message): message is QueuedMessage => Boolean(message))
      .filter((message) => !inFlightSessions[message.sessionId])
      .sort((left, right) => left.createdAt - right.createdAt);

    if (nextMessages.length === 0) return;

    for (const nextMessage of nextMessages) {
      if (inFlightSessionsRef.current.has(nextMessage.sessionId)) continue;
      void dispatchQueuedMessage(nextMessage);
    }
  }, [dispatchQueuedMessage, inFlightSessions, queuedMessagesBySession]);

  useEffect(() => {
    const awaitingEntries = Object.values(awaitingSessionCompletionBySession);
    if (awaitingEntries.length === 0) return;

    for (const awaiting of awaitingEntries) {
      const nextStatus = statusMap[awaiting.sessionId];
      if (nextStatus === "busy" && !awaiting.seenBusy) {
        setAwaitingSessionCompletionBySession((current) => ({
          ...current,
          [awaiting.sessionId]: {
            sessionId: awaiting.sessionId,
            seenBusy: true,
            startedAt: awaiting.startedAt,
          },
        }));
        continue;
      }

      if (awaiting.seenBusy && nextStatus === "idle") {
        setAwaitingSessionCompletionBySession((current) => removeSessionKey(current, awaiting.sessionId));
      }
    }
  }, [awaitingSessionCompletionBySession, statusMap]);

  useEffect(() => {
    const timeouts = Object.values(awaitingSessionCompletionBySession)
      .filter((awaiting) => !awaiting.seenBusy)
      .map((awaiting) =>
        window.setTimeout(() => {
          setAwaitingSessionCompletionBySession((current) => {
            const existing = current[awaiting.sessionId];
            if (!existing || existing.seenBusy) return current;
            if (existing.startedAt !== awaiting.startedAt) return current;
            return removeSessionKey(current, awaiting.sessionId);
          });
        }, 15000),
      );

    return () => {
      for (const timeout of timeouts) {
        window.clearTimeout(timeout);
      }
    };
  }, [awaitingSessionCompletionBySession]);

  const handlePermissionAction = useCallback(
    async (id: string, action: "once" | "always" | "reject") => {
      setRespondingPermissionId(id);

      try {
        await opencodeApi.replyPermission(config, id, action);
        const targetSessionId = findPermissionSessionId(permissionRequestsBySessionRef.current, id);
        if (targetSessionId) {
          setPermissionRequestsBySession((current) => ({
            ...current,
            [targetSessionId]: removePermissionRequest(current[targetSessionId] || [], id),
          }));
        }
        await Promise.all([refreshSessions(), refreshSessionData(targetSessionId)]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "permission response failed";
        setEvents((current) => [`Permission action failed - ${message}`, ...current].slice(0, 20));
      } finally {
        setRespondingPermissionId((current) => (current === id ? null : current));
      }
    },
    [config, refreshSessionData, refreshSessions],
  );

  const handleQuestionReply = useCallback(
    async (id: string, answers: string[][]): Promise<QuestionActionResult> => {
      const targetSessionId = findQuestionSessionId(questionRequestsBySessionRef.current, id);

      try {
        await opencodeApi.replyQuestion(config, id, answers);
        if (targetSessionId) {
          setQuestionRequestsBySession((current) => ({
            ...current,
            [targetSessionId]: removeQuestionRequest(current[targetSessionId] || [], id),
          }));
        }
        await Promise.all([refreshSessions(), refreshSessionData(targetSessionId)]);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "question reply failed";
        setEvents((current) => [`Question reply failed - ${message}`, ...current].slice(0, 20));
        return { ok: false, error: message };
      }
    },
    [config, refreshSessionData, refreshSessions],
  );

  const handleQuestionReject = useCallback(
    async (id: string): Promise<QuestionActionResult> => {
      const targetSessionId = findQuestionSessionId(questionRequestsBySessionRef.current, id);

      try {
        await opencodeApi.rejectQuestion(config, id);
        if (targetSessionId) {
          setQuestionRequestsBySession((current) => ({
            ...current,
            [targetSessionId]: removeQuestionRequest(current[targetSessionId] || [], id),
          }));
        }
        await Promise.all([refreshSessions(), refreshSessionData(targetSessionId)]);
        return { ok: true };
      } catch (error) {
        const message = error instanceof Error ? error.message : "question reject failed";
        setEvents((current) => [`Question reject failed - ${message}`, ...current].slice(0, 20));
        return { ok: false, error: message };
      }
    },
    [config, refreshSessionData, refreshSessions],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 2000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      resetSelectedSessionState();
      return;
    }

    void refreshSessionData(selectedSessionId);
  }, [refreshSessionData, resetSelectedSessionState, selectedSessionId]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshRemoteConfig();
  }, [connectionState]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshModelProviders();
  }, [connectionState]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshCommands();
  }, [connectionState]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshSkills();
  }, [connectionState]);

  useEffect(() => {
    if (!config.model || modelProviders.length === 0) return;

    const normalizedModel = normalizeModelValue(config.model, modelProviders);
    if (normalizedModel === config.model) return;

    setConfig((current) => {
      const nextConfig = { ...current, model: normalizedModel };
      saveServerConfig(nextConfig);
      return nextConfig;
    });
  }, [config.model, modelProviders]);

  useEffect(() => {
    if (connectionState !== "success" || !config.password) return;

    const controller = new AbortController();
    let isDisposed = false;

    const clearReconnectTimer = () => {
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const scheduleRefresh = (sessionId?: string) => {
      const refreshKey = sessionId || "__sessions__";
      const existingTimeout = refreshTimeoutsRef.current[refreshKey];
      if (existingTimeout) {
        window.clearTimeout(existingTimeout);
      }

      refreshTimeoutsRef.current[refreshKey] = window.setTimeout(() => {
        delete refreshTimeoutsRef.current[refreshKey];
        void refreshSessions();
        if (sessionId) {
          void refreshSessionData(sessionId);
        }
      }, 250);
    };

    const connectStream = () => {
      void opencodeApi
        .streamEvents(
          config,
          (event) => {
            reconnectAttemptRef.current = 0;
            const payload =
              event.data && typeof event.data === "object" && "type" in (event.data as Record<string, unknown>)
                ? (event.data as { type?: string; properties?: Record<string, unknown> })
                : null;

            const payloadType = payload?.type || event.type;
            const properties = payload?.properties || {};

            if (payloadType === "server.connected" || payloadType === "server.heartbeat") {
              return;
            }

            if (payloadType === "message.updated") {
              const info = properties.info as MessageEnvelope["info"] | undefined;
              if (info?.sessionID) {
                const sessionID = info.sessionID;
                setMessagesBySession((current) => ({
                  ...current,
                  [sessionID]: upsertMessageInfo(current[sessionID] || [], info),
                }));
                setSessionActivity((current) => markSessionActivity(current, sessionID));
              }
            }

            if (payloadType === "message.part.updated") {
              const part = properties.part as Record<string, unknown> | undefined;
              if (part?.sessionID) {
                const sessionID = part.sessionID as string;
                setMessagesBySession((current) => ({
                  ...current,
                  [sessionID]: upsertMessagePart(current[sessionID] || [], part as { messageID?: string; id?: string; type?: string; text?: string }),
                }));
              }
              const partSessionID = typeof part?.sessionID === "string" ? part.sessionID : undefined;
              if (partSessionID) {
                setSessionActivity((current) => markSessionActivity(current, partSessionID));
              }
            }

            if (payloadType === "message.part.delta") {
              const sessionID = properties.sessionID as string | undefined;
              if (sessionID) {
                setMessagesBySession((current) => ({
                  ...current,
                  [sessionID]: appendMessageDelta(current[sessionID] || [], {
                    messageID: properties.messageID as string | undefined,
                    partID: properties.partID as string | undefined,
                    field: properties.field as string | undefined,
                    delta: properties.delta as string | undefined,
                  }),
                }));
              }
              if (sessionID) {
                setSessionActivity((current) => markSessionActivity(current, sessionID));
              }
            }

            if (payloadType === "session.updated") {
              const info = properties.info as Session | undefined;
              if (info?.id) {
                setSessions((current) => upsertSession(current, info));
              }
            }

            if (payloadType === "question.asked") {
              const request = properties as QuestionRequest;
              if (request.sessionID) {
                setQuestionRequestsBySession((current) => ({
                  ...current,
                  [request.sessionID]: upsertQuestionRequest(current[request.sessionID] || [], request),
                }));
                setSessionActivity((current) => markSessionActivity(current, request.sessionID));
              }
              scheduleRefresh(request.sessionID);
            }

            if (payloadType === "permission.asked") {
              const request = properties as PermissionRequest;
              if (request.sessionID) {
                setPermissionRequestsBySession((current) => ({
                  ...current,
                  [request.sessionID]: upsertPermissionRequest(current[request.sessionID] || [], request),
                }));
                setSessionActivity((current) => markSessionActivity(current, request.sessionID));
              }
              scheduleRefresh(request.sessionID);
            }

            if (payloadType === "permission.replied") {
              const sessionID = properties.sessionID as string | undefined;
              const requestID = properties.requestID as string | undefined;
              if (sessionID && requestID) {
                setPermissionRequestsBySession((current) => ({
                  ...current,
                  [sessionID]: removePermissionRequest(current[sessionID] || [], requestID),
                }));
              }
              if (sessionID) {
                setSessionActivity((current) => markSessionActivity(current, sessionID));
              }
              scheduleRefresh(sessionID);
            }

            if (payloadType === "question.replied" || payloadType === "question.rejected") {
              const sessionID = properties.sessionID as string | undefined;
              const requestID = properties.requestID as string | undefined;
              if (sessionID && requestID) {
                setQuestionRequestsBySession((current) => ({
                  ...current,
                  [sessionID]: removeQuestionRequest(current[sessionID] || [], requestID),
                }));
              }
              if (sessionID) {
                setSessionActivity((current) => markSessionActivity(current, sessionID));
              }
              scheduleRefresh(sessionID);
            }

            if (payloadType === "session.status") {
              const sessionID = properties.sessionID as string | undefined;
              const status = properties.status as { type?: string; message?: string } | string | undefined;
              const nextStatus = normalizeSessionStatus(status);
              const statusMessage =
                status && typeof status === "object" && "message" in status ? (status as { message?: string }).message : undefined;
              if (sessionID) {
                setStatusMap((current) => ({ ...current, [sessionID]: nextStatus }));
                setSessionActivity((current) => {
                  const existing = current[sessionID] || {};
                  if (nextStatus === "busy") {
                    return {
                      ...current,
                      [sessionID]: {
                        busySince: existing.busySince || Date.now(),
                        lastActivityAt: existing.lastActivityAt || Date.now(),
                      },
                    };
                  }

                  return {
                    ...current,
                    [sessionID]: {
                      busySince: undefined,
                      lastActivityAt: Date.now(),
                    },
                  };
                });
                if (sessionID === selectedSessionIdRef.current && statusMessage) {
                  setEvents((current) => [`${nextStatus} - ${statusMessage}`, ...current].slice(0, 20));
                }

                setAwaitingSessionCompletionBySession((current) => {
                  const awaiting = current[sessionID];
                  if (!awaiting) return current;
                  if (nextStatus === "busy") {
                    return {
                      ...current,
                      [sessionID]: { ...awaiting, seenBusy: true },
                    };
                  }
                  return nextStatus === "idle" && awaiting.seenBusy ? removeSessionKey(current, sessionID) : current;
                });
              }
            }

            if (payloadType === "session.error") {
              const sessionID = properties.sessionID as string | undefined;
              const error = properties.error as { message?: string } | undefined;
              if (sessionID) {
                setStatusMap((current) => ({ ...current, [sessionID]: "idle" }));
                setSessionActivity((current) => ({
                  ...current,
                  [sessionID]: {
                    busySince: undefined,
                    lastActivityAt: Date.now(),
                  },
                }));
              }
              if (sessionID) {
                setAwaitingSessionCompletionBySession((current) => removeSessionKey(current, sessionID));
              }
              if (sessionID === selectedSessionIdRef.current || !sessionID) {
                setEvents((current) => [`session.error - ${error?.message || "Unknown session error"}`, ...current].slice(0, 20));
              }
              scheduleRefresh(sessionID);
              return;
            }

            if (payloadType === "session.diff") {
              const sessionID = properties.sessionID as string | undefined;
              const diff = properties.diff as unknown[] | undefined;
              if (sessionID && Array.isArray(diff)) {
                setDiffCountBySession((current) => ({ ...current, [sessionID]: diff.length }));
              }
            }

            setEvents((current) => {
              const label = `${payloadType}${event.raw ? ` - ${String(event.raw).slice(0, 120)}` : ""}`;
              return [label, ...current].slice(0, 20);
            });

            if (payloadType === "session.idle") {
              const sessionID = properties.sessionID as string | undefined;
              if (sessionID) {
                setStatusMap((current) => ({ ...current, [sessionID]: "idle" }));
                setSessionActivity((current) => ({
                  ...current,
                  [sessionID]: {
                    busySince: undefined,
                    lastActivityAt: Date.now(),
                  },
                }));
              }
              scheduleRefresh(sessionID);
              return;
            }
          },
          controller.signal,
        )
        .catch((error) => {
          if (controller.signal.aborted || isDisposed) return;
          const message = error instanceof Error ? error.message : "stream unavailable";
          setEvents((current) => [`Event stream disconnected - ${message}`, ...current].slice(0, 20));
          clearReconnectTimer();
          reconnectAttemptRef.current += 1;
          const reconnectDelay = Math.min(1500 * 2 ** (reconnectAttemptRef.current - 1), 15000);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            void refreshSessions();
            for (const sessionId of knownSessionIdsRef.current) {
              void refreshSessionData(sessionId);
            }
            connectStream();
          }, reconnectDelay);
        });
    };

    connectStream();

    return () => {
      isDisposed = true;
      controller.abort();
      clearReconnectTimer();
      for (const timeout of Object.values(refreshTimeoutsRef.current)) {
        window.clearTimeout(timeout);
      }
      refreshTimeoutsRef.current = {};
    };
  }, [config, connectionState, refreshSessionData, refreshSessions]);

  useEffect(() => {
    if (!selectedSessionId || !config.password || !isSessionBusy) return;

    const interval = window.setInterval(() => {
      void refreshMessages();
      void refreshDiff();
      void refreshSessions();
      void refreshPermissions();
      void refreshQuestions();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [config.password, isSessionBusy, refreshDiff, refreshMessages, refreshPermissions, refreshQuestions, refreshSessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId || !config.password) return;

    const interval = window.setInterval(() => {
      void refreshPermissions();
      void refreshQuestions();
    }, 5000);

    return () => window.clearInterval(interval);
  }, [config.password, refreshPermissions, refreshQuestions, selectedSessionId]);

  useEffect(() => {
    if (!config.password) return;

    let timer: number | undefined;
    const poll = async () => {
      try {
        await refreshSessions();
      } catch (error) {
        const message = error instanceof Error ? error.message : "session refresh failed";
        setEvents((current) => [`Session poll failed - ${message}`, ...current].slice(0, 20));
      } finally {
        timer = window.setTimeout(poll, 15000);
      }
    };
    timer = window.setTimeout(poll, 15000);

    return () => {
      if (timer) window.clearTimeout(timer);
    };
  }, [config.password, refreshSessions]);

  useEffect(() => {
    if (!config.password) return;

    const interval = window.setInterval(async () => {
      try {
        await opencodeApi.health(config);
        healthFailureCountRef.current = 0;
      } catch (error) {
        const message = error instanceof Error ? error.message : "event unavailable";
        healthFailureCountRef.current += 1;
        if (healthFailureCountRef.current >= 2) {
          setConnectionState("error");
          setConnectStatus(`连接中断: ${message}`);
        }
        setEvents((current) => [`Health check failed - ${message}`, ...current].slice(0, 20));
      }
    }, 20000);

    return () => window.clearInterval(interval);
  }, [config]);

  return (
    <MainLayout
      isConnected={connectionState === "success"}
      config={config}
      modelProviders={modelProviders}
      isLoadingModels={isLoadingModels}
      modelError={modelError}
      commands={commands}
      isLoadingCommands={isLoadingCommands}
      commandsError={commandsError}
      skills={skills}
      isLoadingSkills={isLoadingSkills}
      skillsError={skillsError}
      connectStatus={connectStatus}
      connectionState={connectionState}
      isConnecting={isConnecting}
      sessions={sessions}
      statusMap={statusMap}
      selectedSessionId={selectedSessionId}
      selectedSession={selectedSession}
      messages={visibleMessages}
      canLoadOlderMessages={Boolean(messagesNextCursor)}
      isLoadingOlderMessages={isLoadingOlderMessages}
      draft={draft}
      agent={selectedAgent as "build" | "plan"}
      isSending={isSending}
      queuedCount={queuedCount}
      isRefreshingSession={isRefreshingSession}
      isBusy={isSessionBusy}
      diffCount={diffCount}
      events={events}
      permissionRequests={permissionRequests}
      questionRequests={questionRequests}
      isStalled={isSessionStalled}
      canUndoLastMessage={Boolean(latestUserMessageTarget)}
      canRedoLastMessage={canRedoLastMessage}
      canForkLastMessage={Boolean(latestUserMessageTarget)}
      isUndoingLastMessage={undoingSessionId === selectedSessionId}
      isRedoingLastMessage={redoingSessionId === selectedSessionId}
      isForkingLastMessage={forkingSessionId === selectedSessionId}
      runningCommandName={runningCommandName}
      onConfigChange={handleConfigChange}
      onModelChange={(model) => void handleModelChange(model)}
      onCompactContext={() => void handleCompactContext()}
      isCompactingContext={runningCommandName === "compact"}
      canCompactContext={Boolean(selectedSessionId)}
      onConnect={handleConnect}
      onSessionSelect={handleSessionSelect}
      onCreateSession={handleCreateSession}
      onRefreshCurrentSession={() => void handleRefreshCurrentSession()}
      onDraftChange={setDraft}
      onLoadOlderMessages={() => void handleLoadOlderMessages()}
      onAgentChange={(value) => setSelectedAgent(value)}
      onSend={handleSend}
      onRunCommand={(commandName, argumentsText) => void handleRunCommand(commandName, argumentsText)}
      onUndoLastMessage={() => void handleUndoLastMessage()}
      onRedoLastMessage={() => void handleRedoLastMessage()}
      onForkLastMessage={() => void handleForkLastMessage()}
      onRefreshDiff={() => void refreshDiff()}
      respondingPermissionId={respondingPermissionId}
      onPermissionAction={handlePermissionAction}
      onQuestionReply={handleQuestionReply}
      onQuestionReject={handleQuestionReject}
    />
  );
}

export default App;

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "./app/components/layouts/MainLayout";
import { opencodeApi } from "./lib/opencode";
import { loadServerConfig, saveServerConfig } from "./lib/storage";
import type {
  ChatMessage,
  CommandItem,
  ConfigProvider,
  ConnectionState,
  MessageEnvelope,
  OpenCodeConfig,
  PermissionRequest,
  QuestionRequest,
  SkillItem,
  ServerConfig,
  Session,
  SessionStatusMap,
} from "./types";

function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function formatTimestamp(timestamp?: number) {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function mapMessageEnvelope(message: MessageEnvelope): ChatMessage {
  const role = (message.info.role || "assistant") as ChatMessage["role"];
  return {
    id: message.info.id,
    role,
    parts: message.parts,
    timestampLabel: formatTimestamp(message.info.time?.created || message.info.time?.updated),
    status: role === "tool" ? "success" : undefined,
  };
}

function messageSignature(message: ChatMessage) {
  return message.parts
    .map((part) => (typeof part.text === "string" ? `${part.type || "text"}:${part.text}` : ""))
    .join("|");
}

function mergeMessages(current: ChatMessage[], next: ChatMessage[]) {
  const pending = current.filter((message) => message.isPending);
  const nextIds = new Set(next.map((message) => message.id));

  const pendingWithText = new Set(pending.map(messageSignature));

  const confirmed = next.map((message) => {
    const signature = messageSignature(message);

    if (message.role === "user" && pendingWithText.has(signature)) {
      return { ...message, isPending: false };
    }

    return message;
  });

  const confirmedText = new Set(confirmed.map(messageSignature));

  return [
    ...confirmed,
    ...pending.filter((message) => {
      if (nextIds.has(message.id)) return false;
      const signature = messageSignature(message);
      return !confirmedText.has(signature);
    }),
  ];
}

function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => left.id.localeCompare(right.id));
}

function upsertMessageInfo(current: ChatMessage[], info: MessageEnvelope["info"]) {
  const role = (info.role || "assistant") as ChatMessage["role"];
  const existing = current.find((message) => message.id === info.id);

  if (existing) {
    return current.map((message) =>
      message.id === info.id
        ? {
            ...message,
            role,
            timestampLabel: formatTimestamp(info.time?.created || info.time?.updated),
            isPending: false,
          }
        : message,
    );
  }

  return sortMessages([
    ...current,
    {
      id: info.id,
      role,
      parts: [],
      timestampLabel: formatTimestamp(info.time?.created || info.time?.updated),
      status: role === "tool" ? "success" : undefined,
    },
  ]);
}

function upsertMessagePart(current: ChatMessage[], part: { messageID?: string; id?: string; type?: string; text?: string }) {
  if (!part.messageID || !part.id) return current;

  return current.map((message) => {
    if (message.id !== part.messageID) return message;

    const nextParts = [...message.parts];
    const partIndex = nextParts.findIndex((item) => item.id === part.id);
    if (partIndex >= 0) {
      nextParts[partIndex] = { ...nextParts[partIndex], ...part };
    } else {
      nextParts.push({ ...part });
    }

    return { ...message, parts: nextParts };
  });
}

function appendMessageDelta(
  current: ChatMessage[],
  payload: { messageID?: string; partID?: string; field?: string; delta?: string },
) {
  if (!payload.messageID || !payload.partID || payload.field !== "text") return current;

  return current.map((message) => {
    if (message.id !== payload.messageID) return message;

    const nextParts = [...message.parts];
    const partIndex = nextParts.findIndex((item) => item.id === payload.partID);

    if (partIndex >= 0) {
      const currentText = typeof nextParts[partIndex].text === "string" ? nextParts[partIndex].text : "";
      nextParts[partIndex] = {
        ...nextParts[partIndex],
        text: `${currentText}${payload.delta || ""}`,
      };
    } else {
      nextParts.push({ id: payload.partID, type: "text", text: payload.delta || "" });
    }

    return { ...message, parts: nextParts };
  });
}

function reconcilePending(current: ChatMessage[]) {
  const confirmedUserSignatures = new Set(
    current.filter((message) => message.role === "user" && !message.isPending).map(messageSignature),
  );

  return current.filter((message) => !(message.isPending && confirmedUserSignatures.has(messageSignature(message))));
}

function upsertSession(current: Session[], nextSession: Session) {
  const found = current.some((session) => session.id === nextSession.id);
  const next = found
    ? current.map((session) => (session.id === nextSession.id ? { ...session, ...nextSession } : session))
    : [...current, nextSession];

  return [...next].sort((left, right) => (right.time?.updated || 0) - (left.time?.updated || 0));
}

function upsertQuestionRequest(current: QuestionRequest[], nextRequest: QuestionRequest) {
  const existingIndex = current.findIndex((item) => item.id === nextRequest.id);
  if (existingIndex >= 0) {
    const next = [...current];
    next[existingIndex] = nextRequest;
    return next;
  }
  return [...current, nextRequest].sort((left, right) => left.id.localeCompare(right.id));
}

function removeQuestionRequest(current: QuestionRequest[], requestId: string) {
  return current.filter((item) => item.id !== requestId);
}

function upsertPermissionRequest(current: PermissionRequest[], nextRequest: PermissionRequest) {
  const existingIndex = current.findIndex((item) => item.id === nextRequest.id);
  if (existingIndex >= 0) {
    const next = [...current];
    next[existingIndex] = nextRequest;
    return next;
  }
  return [...current, nextRequest].sort((left, right) => left.id.localeCompare(right.id));
}

function removePermissionRequest(current: PermissionRequest[], requestId: string) {
  return current.filter((item) => item.id !== requestId);
}

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

type AwaitingSessionCompletion = {
  sessionId: string;
  seenBusy: boolean;
  startedAt: number;
};

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

function App() {
  const [config, setConfig] = useState<ServerConfig>(() => loadServerConfig());
  const [connectStatus, setConnectStatus] = useState("尚未连接");
  const [connectionState, setConnectionState] = useState<ConnectionState>("idle");
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [statusMap, setStatusMap] = useState<SessionStatusMap>({});
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [selectedAgent, setSelectedAgent] = useState("build");
  const [isSending, setIsSending] = useState(false);
  const [isRefreshingSession, setIsRefreshingSession] = useState(false);
  const [diffCount, setDiffCount] = useState(0);
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
  const [retryingSessionId, setRetryingSessionId] = useState<string | null>(null);
  const [abortingSessionId, setAbortingSessionId] = useState<string | null>(null);
  const [permissionRequests, setPermissionRequests] = useState<PermissionRequest[]>([]);
  const [respondingPermissionId, setRespondingPermissionId] = useState<string | null>(null);
  const [questionRequests, setQuestionRequests] = useState<QuestionRequest[]>([]);
  const [sessionActivity, setSessionActivity] = useState<SessionActivityMap>({});
  const [lastSentDraftBySession, setLastSentDraftBySession] = useState<Record<string, SentMessageDraft>>({});
  const [queuedMessagesBySession, setQueuedMessagesBySession] = useState<Record<string, QueuedMessage[]>>({});
  const [dispatchingMessage, setDispatchingMessage] = useState<QueuedMessage | null>(null);
  const [awaitingSessionCompletion, setAwaitingSessionCompletion] = useState<AwaitingSessionCompletion | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const refreshTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) || null,
    [sessions, selectedSessionId],
  );

  const selectedSessionStatus = selectedSessionId ? statusMap[selectedSessionId] : undefined;
  const isSessionBusy = selectedSessionStatus === "busy";
  const queuedMessages = selectedSessionId ? queuedMessagesBySession[selectedSessionId] || [] : [];
  const queuedCount = queuedMessages.length;
  const selectedModel = useMemo(() => normalizeModelValue(config.model, modelProviders), [config.model, modelProviders]);
  const selectedLastSentDraft = selectedSessionId ? lastSentDraftBySession[selectedSessionId] || null : null;
  const selectedActivity = selectedSessionId ? sessionActivity[selectedSessionId] : undefined;
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
    setSessions(sorted);
    setStatusMap(nextStatusMap);
    setSelectedSessionId((current) => current || sorted[0]?.id || null);
  }, [config]);

  const refreshMessages = useCallback(async () => {
    if (!selectedSessionId) return;
    const nextMessages = await opencodeApi.listMessages(config, selectedSessionId);
    setMessages((current) => mergeMessages(current, nextMessages.map(mapMessageEnvelope)));
  }, [config, selectedSessionId]);

  const refreshDiff = useCallback(async () => {
    if (!selectedSessionId) return;
    const diff = await opencodeApi.getDiff(config, selectedSessionId);
    setDiffCount(diff.length);
  }, [config, selectedSessionId]);

  const refreshQuestions = useCallback(async () => {
    if (!selectedSessionId) return;
    const requests = await opencodeApi.listQuestions(config);
    setQuestionRequests(requests.filter((item) => item.sessionID === selectedSessionId));
  }, [config, selectedSessionId]);

  const refreshPermissions = useCallback(async () => {
    if (!selectedSessionId) return;
    const requests = await opencodeApi.listPermissions(config);
    setPermissionRequests(requests.filter((item) => item.sessionID === selectedSessionId));
  }, [config, selectedSessionId]);

  const refreshRemoteConfig = useCallback(async (targetConfig: ServerConfig = config) => {
    if (!targetConfig.password) {
      setConfig((current) => ({ ...current, model: "" }));
      return null;
    }

    const remoteConfig = await opencodeApi.getConfig(targetConfig);
    const nextModel = typeof remoteConfig.model === "string" ? remoteConfig.model : "";
    setConfig((current) => ({ ...current, model: nextModel }));
    return remoteConfig;
  }, [config]);

  const refreshModelProviders = useCallback(async (targetConfig: ServerConfig = config) => {
    if (!targetConfig.password) {
      setModelProviders([]);
      setProviderDefaults({});
      setModelError(null);
      return;
    }

    setIsLoadingModels(true);

    try {
      const response = await opencodeApi.listConfigProviders(targetConfig);
      setModelProviders(response.providers);
      setProviderDefaults(response.default);
      setModelError(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "failed to load models";
      setModelProviders([]);
      setProviderDefaults({});
      setModelError(`模型列表加载失败: ${message}`);
    } finally {
      setIsLoadingModels(false);
    }
  }, [config]);

  const refreshCommands = useCallback(async (targetConfig: ServerConfig = config) => {
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
  }, [config]);

  const refreshSkills = useCallback(async (targetConfig: ServerConfig = config) => {
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
  }, [config]);

  const handleRefreshCurrentSession = useCallback(async () => {
    if (isRefreshingSession) return;

    setIsRefreshingSession(true);
    try {
      await refreshSessions();
      if (!selectedSessionId) return;
      await Promise.all([refreshMessages(), refreshDiff(), refreshQuestions(), refreshPermissions()]);
    } finally {
      setIsRefreshingSession(false);
    }
  }, [isRefreshingSession, refreshDiff, refreshMessages, refreshPermissions, refreshQuestions, refreshSessions, selectedSessionId]);

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
    await refreshSessions();
    setSelectedSessionId(created.id);
  }, [config, refreshSessions]);

  const handleConfigChange = useCallback((next: ServerConfig) => {
    setConfig(next);
  }, []);

  const handleModelChange = useCallback(
    async (model: string) => {
      const previousModel = config.model;
      setConfig((current) => ({ ...current, model }));

      try {
        const currentRemoteConfig = (await opencodeApi.getConfig(config)) as OpenCodeConfig;
        const nextRemoteConfig = await opencodeApi.updateConfig(config, {
          ...currentRemoteConfig,
          model,
        });

        setConfig((current) => ({
          ...current,
          model: typeof nextRemoteConfig.model === "string" ? nextRemoteConfig.model : model,
        }));
        setEvents((current) => [`Default model updated - ${model || "server default"}`, ...current].slice(0, 20));
      } catch (error) {
        const message = error instanceof Error ? error.message : "model update failed";
        setConfig((current) => ({ ...current, model: previousModel }));
        setEvents((current) => [`Default model update failed - ${message}`, ...current].slice(0, 20));
      }
    },
    [config],
  );

  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!selectedSessionId || !text) return;

    const now = Date.now();
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
      isPending: true,
    };

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
    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");
    setEvents((current) => {
      const queueSize = queuedCount + 1;
      const label = queueSize > 1 ? `Queued message ${queueSize} for session` : "Queued message for session";
      return [label, ...current].slice(0, 20);
    });
  }, [draft, queuedCount, selectedAgent, selectedModel, selectedSessionId]);

  const handleRetryLastMessage = useCallback(async () => {
    if (!selectedSessionId) return;

    const previous = lastSentDraftBySession[selectedSessionId];
    if (!previous?.text.trim()) return;

    const now = Date.now();
    const optimisticMessageId = `local-${now}`;
    const queueItem: QueuedMessage = {
      id: `queue-${now}-${Math.random().toString(36).slice(2, 8)}`,
      sessionId: selectedSessionId,
      text: previous.text,
      agent: previous.agent,
      model: previous.model,
      optimisticMessageId,
      createdAt: now,
    };

    setRetryingSessionId(selectedSessionId);
    setQueuedMessagesBySession((current) => ({
      ...current,
      [selectedSessionId]: [...(current[selectedSessionId] || []), queueItem],
    }));
    setMessages((current) => [
      ...current,
      {
        id: optimisticMessageId,
        role: "user",
        parts: [{ type: "text", text: previous.text }],
        timestampLabel: formatTimestamp(),
        isPending: true,
      },
    ]);
    setEvents((current) => [`Retried last message - ${previous.agent}`, ...current].slice(0, 20));
  }, [lastSentDraftBySession, selectedSessionId]);

  const handleAbortSession = useCallback(async () => {
    if (!selectedSessionId || abortingSessionId === selectedSessionId) return;

    setAbortingSessionId(selectedSessionId);

    try {
      await opencodeApi.abortSession(config, selectedSessionId);
      setAwaitingSessionCompletion(null);
      setDispatchingMessage(null);
      setEvents((current) => [`Aborted session run - ${selectedSessionId}`, ...current].slice(0, 20));
      await Promise.all([refreshSessions(), refreshMessages(), refreshDiff(), refreshPermissions(), refreshQuestions()]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "abort failed";
      setEvents((current) => [`Abort failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setAbortingSessionId((current) => (current === selectedSessionId ? null : current));
    }
  }, [abortingSessionId, config, refreshDiff, refreshMessages, refreshPermissions, refreshQuestions, refreshSessions, selectedSessionId]);

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

      setAwaitingSessionCompletion({
        sessionId: selectedSessionId,
        seenBusy: false,
        startedAt: Date.now(),
      });

      await Promise.all([refreshSessions(), refreshMessages(), refreshDiff(), refreshPermissions(), refreshQuestions()]);

      window.setTimeout(() => {
        void refreshSessions();
        void refreshMessages();
        void refreshDiff();
        void refreshPermissions();
        void refreshQuestions();
      }, 1200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "compact failed";
      setEvents((current) => [`Compact failed - ${message}`, ...current].slice(0, 20));
    } finally {
      setRunningCommandName(null);
      setIsSending(false);
    }
  }, [config, modelProviders, providerDefaults, refreshDiff, refreshMessages, refreshPermissions, refreshQuestions, refreshSessions, runningCommandName, selectedModel, selectedSessionId]);

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

        setAwaitingSessionCompletion({
          sessionId: selectedSessionId,
          seenBusy: false,
          startedAt: Date.now(),
        });

        await Promise.all([refreshSessions(), refreshMessages(), refreshDiff(), refreshPermissions(), refreshQuestions()]);

        window.setTimeout(() => {
          void refreshSessions();
          void refreshMessages();
          void refreshDiff();
          void refreshPermissions();
          void refreshQuestions();
        }, 1200);
      } catch (error) {
        const message = error instanceof Error ? error.message : "command failed";
        setEvents((current) => [`Command failed - ${message}`, ...current].slice(0, 20));
      } finally {
        setRunningCommandName(null);
        setIsSending(false);
      }
    },
    [
      config,
      refreshDiff,
      refreshMessages,
      refreshPermissions,
      refreshQuestions,
      refreshSessions,
      runningCommandName,
      selectedAgent,
      selectedModel,
      selectedSessionId,
    ],
  );

  const dispatchQueuedMessage = useCallback(
    async (item: QueuedMessage) => {
      setDispatchingMessage(item);
      setIsSending(item.sessionId === selectedSessionId);

      try {
        await opencodeApi.sendMessage(config, item.sessionId, {
          agent: item.agent,
          model: item.model || undefined,
          parts: [{ type: "text", text: item.text }],
        });

        setQueuedMessagesBySession((current) => {
          const sessionQueue = current[item.sessionId] || [];
          const nextSessionQueue = sessionQueue.filter((queued) => queued.id !== item.id);

          if (nextSessionQueue.length === 0) {
            const { [item.sessionId]: _removed, ...rest } = current;
            return rest;
          }

          return { ...current, [item.sessionId]: nextSessionQueue };
        });
        setAwaitingSessionCompletion({
          sessionId: item.sessionId,
          seenBusy: false,
          startedAt: Date.now(),
        });
        setEvents((current) => [`Sent queued message - ${item.agent}`, ...current].slice(0, 20));

        void refreshSessions();
        if (item.sessionId === selectedSessionId) {
          void refreshMessages();
          void refreshDiff();
        }
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
        if (item.sessionId === selectedSessionId) {
          setMessages((current) => current.filter((message) => message.id !== item.optimisticMessageId));
        }
        const message = error instanceof Error ? error.message : "send failed";
        setEvents((current) => [`Queued send failed - ${message}`, ...current].slice(0, 20));
      } finally {
        setDispatchingMessage((current) => (current?.id === item.id ? null : current));
        setRetryingSessionId((current) => (current === item.sessionId ? null : current));
        if (item.sessionId === selectedSessionId) {
          setIsSending(false);
        }
      }
    },
    [config, refreshDiff, refreshMessages, refreshSessions, selectedSessionId],
  );

  useEffect(() => {
    if (dispatchingMessage || awaitingSessionCompletion) return;

    const nextMessage = Object.values(queuedMessagesBySession)
      .map((queue) => queue[0])
      .filter((message): message is QueuedMessage => Boolean(message))
      .filter((message) => statusMap[message.sessionId] !== "busy")
      .sort((left, right) => left.createdAt - right.createdAt)[0];

    if (!nextMessage) return;

    void dispatchQueuedMessage(nextMessage);
  }, [awaitingSessionCompletion, dispatchQueuedMessage, dispatchingMessage, queuedMessagesBySession, statusMap]);

  useEffect(() => {
    if (!awaitingSessionCompletion) return;

    const nextStatus = statusMap[awaitingSessionCompletion.sessionId];
    if (nextStatus === "busy" && !awaitingSessionCompletion.seenBusy) {
      setAwaitingSessionCompletion({
        sessionId: awaitingSessionCompletion.sessionId,
        seenBusy: true,
        startedAt: awaitingSessionCompletion.startedAt,
      });
      return;
    }

    if (awaitingSessionCompletion.seenBusy && nextStatus && nextStatus !== "busy") {
      setAwaitingSessionCompletion(null);
    }
  }, [awaitingSessionCompletion, statusMap]);

  useEffect(() => {
    if (!awaitingSessionCompletion || awaitingSessionCompletion.seenBusy) return;

    const timeout = window.setTimeout(() => {
      setAwaitingSessionCompletion((current) => {
        if (!current || current.seenBusy) return current;
        if (current.startedAt !== awaitingSessionCompletion.startedAt) return current;
        return null;
      });
    }, 2000);

    return () => window.clearTimeout(timeout);
  }, [awaitingSessionCompletion]);

  const handlePermissionAction = useCallback(
    async (id: string, action: "once" | "always" | "reject") => {
      setRespondingPermissionId(id);

      try {
        await opencodeApi.replyPermission(config, id, action);
        setPermissionRequests((current) => removePermissionRequest(current, id));
        await Promise.all([refreshMessages(), refreshSessions(), refreshDiff(), refreshPermissions()]);
      } catch (error) {
        const message = error instanceof Error ? error.message : "permission response failed";
        setEvents((current) => [`Permission action failed - ${message}`, ...current].slice(0, 20));
      } finally {
        setRespondingPermissionId((current) => (current === id ? null : current));
      }
    },
    [config, refreshDiff, refreshMessages, refreshPermissions, refreshSessions],
  );

  const handleQuestionReply = useCallback(
    async (id: string, answers: string[][]) => {
      await opencodeApi.replyQuestion(config, id, answers);
      setQuestionRequests((current) => removeQuestionRequest(current, id));
      await Promise.all([refreshMessages(), refreshSessions(), refreshDiff(), refreshQuestions()]);
    },
    [config, refreshDiff, refreshMessages, refreshQuestions, refreshSessions],
  );

  const handleQuestionReject = useCallback(
    async (id: string) => {
      await opencodeApi.rejectQuestion(config, id);
      setQuestionRequests((current) => removeQuestionRequest(current, id));
      await Promise.all([refreshMessages(), refreshSessions(), refreshDiff(), refreshQuestions()]);
    },
    [config, refreshDiff, refreshMessages, refreshQuestions, refreshSessions],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 2000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      setDiffCount(0);
      setPermissionRequests([]);
      setQuestionRequests([]);
      return;
    }

    void refreshMessages();
    void refreshDiff();
    void refreshPermissions();
    void refreshQuestions();
  }, [refreshDiff, refreshMessages, refreshPermissions, refreshQuestions, selectedSessionId]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshRemoteConfig();
  }, [connectionState, refreshRemoteConfig]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshModelProviders();
  }, [connectionState, refreshModelProviders]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshCommands();
  }, [connectionState, refreshCommands]);

  useEffect(() => {
    if (connectionState !== "success") return;
    void refreshSkills();
  }, [connectionState, refreshSkills]);

  useEffect(() => {
    if (!config.model) return;

    const normalizedModel = normalizeModelValue(config.model, modelProviders);
    if (normalizedModel === config.model) return;

    setConfig((current) => ({ ...current, model: normalizedModel }));
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

    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }

      refreshTimeoutRef.current = window.setTimeout(() => {
        void refreshSessions();
        if (selectedSessionId) {
          void refreshMessages();
          void refreshDiff();
          void refreshPermissions();
          void refreshQuestions();
        }
      }, 250);
    };

    const connectStream = () => {
      void opencodeApi
        .streamEvents(
          config,
          (event) => {
            const payload =
              event.data && typeof event.data === "object" && "type" in (event.data as Record<string, unknown>)
                ? (event.data as { type?: string; properties?: Record<string, unknown> })
                : null;

            const payloadType = payload?.type || event.type;
            const properties = payload?.properties || {};

            if (payloadType === "message.updated") {
              const info = properties.info as MessageEnvelope["info"] | undefined;
              if (info?.sessionID === selectedSessionId) {
                setMessages((current) => reconcilePending(upsertMessageInfo(current, info)));
              }
              if (info?.sessionID) {
                setSessionActivity((current) => markSessionActivity(current, info.sessionID as string));
              }
            }

            if (payloadType === "message.part.updated") {
              const part = properties.part as Record<string, unknown> | undefined;
              if (part?.sessionID === selectedSessionId) {
                setMessages((current) =>
                  reconcilePending(upsertMessagePart(current, part as { messageID?: string; id?: string; type?: string; text?: string })),
                );
              }
              const partSessionID = typeof part?.sessionID === "string" ? part.sessionID : undefined;
              if (partSessionID) {
                setSessionActivity((current) => markSessionActivity(current, partSessionID));
              }
            }

            if (payloadType === "message.part.delta") {
              const sessionID = properties.sessionID as string | undefined;
              if (sessionID === selectedSessionId) {
                setMessages((current) =>
                  appendMessageDelta(current, {
                    messageID: properties.messageID as string | undefined,
                    partID: properties.partID as string | undefined,
                    field: properties.field as string | undefined,
                    delta: properties.delta as string | undefined,
                  }),
                );
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
              if (request.sessionID === selectedSessionId) {
                setQuestionRequests((current) => upsertQuestionRequest(current, request));
              }
              if (request.sessionID) {
                setSessionActivity((current) => markSessionActivity(current, request.sessionID));
              }
              scheduleRefresh();
            }

            if (payloadType === "permission.asked") {
              const request = properties as PermissionRequest;
              if (request.sessionID === selectedSessionId) {
                setPermissionRequests((current) => upsertPermissionRequest(current, request));
              }
              if (request.sessionID) {
                setSessionActivity((current) => markSessionActivity(current, request.sessionID));
              }
              scheduleRefresh();
            }

            if (payloadType === "permission.replied") {
              const sessionID = properties.sessionID as string | undefined;
              const requestID = properties.requestID as string | undefined;
              if (sessionID === selectedSessionId && requestID) {
                setPermissionRequests((current) => removePermissionRequest(current, requestID));
              }
              if (sessionID) {
                setSessionActivity((current) => markSessionActivity(current, sessionID));
              }
              scheduleRefresh();
            }

            if (payloadType === "question.replied" || payloadType === "question.rejected") {
              const sessionID = properties.sessionID as string | undefined;
              const requestID = properties.requestID as string | undefined;
              if (sessionID === selectedSessionId && requestID) {
                setQuestionRequests((current) => removeQuestionRequest(current, requestID));
              }
              if (sessionID) {
                setSessionActivity((current) => markSessionActivity(current, sessionID));
              }
              scheduleRefresh();
            }

            if (payloadType === "session.status") {
              const sessionID = properties.sessionID as string | undefined;
              const status = properties.status as { type?: string; message?: string } | undefined;
              if (sessionID && status?.type) {
                const nextStatus = status.type;
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
                if (sessionID === selectedSessionId && status.message) {
                  setEvents((current) => [`${status.type} - ${status.message}`, ...current].slice(0, 20));
                }

                setAwaitingSessionCompletion((current) => {
                  if (!current || current.sessionId !== sessionID) return current;
                  if (nextStatus === "busy") {
                    return { ...current, seenBusy: true };
                  }
                  return current.seenBusy ? null : current;
                });
              }
            }

            if (payloadType === "session.diff") {
              const sessionID = properties.sessionID as string | undefined;
              const diff = properties.diff as unknown[] | undefined;
              if (sessionID === selectedSessionId && Array.isArray(diff)) {
                setDiffCount(diff.length);
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
                setAwaitingSessionCompletion((current) =>
                  current?.sessionId === sessionID && current.seenBusy ? null : current,
                );
              }
              scheduleRefresh();
            }
          },
          controller.signal,
        )
        .catch((error) => {
          if (controller.signal.aborted || isDisposed) return;
          const message = error instanceof Error ? error.message : "stream unavailable";
          setEvents((current) => [`Event stream disconnected - ${message}`, ...current].slice(0, 20));
          clearReconnectTimer();
          reconnectTimeoutRef.current = window.setTimeout(() => {
            void refreshSessions();
            if (selectedSessionId) {
              void refreshMessages();
              void refreshDiff();
              void refreshPermissions();
              void refreshQuestions();
            }
            connectStream();
          }, 1500);
        });
    };

    connectStream();

    return () => {
      isDisposed = true;
      controller.abort();
      clearReconnectTimer();
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [config, connectionState, refreshDiff, refreshMessages, refreshPermissions, refreshQuestions, refreshSessions, selectedSessionId]);

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
      } catch {
        return;
      }
      timer = window.setTimeout(poll, 15000);
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
        const health = await opencodeApi.health(config);
        setEvents((current) => [
          `Health OK - ${health.version} - ${new Date().toLocaleTimeString()}`,
          ...current,
        ].slice(0, 20));
      } catch (error) {
        const message = error instanceof Error ? error.message : "event unavailable";
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
      messages={messages}
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
      canRetryLastMessage={Boolean(selectedLastSentDraft?.text.trim())}
      isRetryingLastMessage={retryingSessionId === selectedSessionId}
      isAbortingSession={abortingSessionId === selectedSessionId}
      runningCommandName={runningCommandName}
      onConfigChange={handleConfigChange}
      onModelChange={(model) => void handleModelChange(model)}
      onCompactContext={() => void handleCompactContext()}
      isCompactingContext={runningCommandName === "compact"}
      canCompactContext={Boolean(selectedSessionId)}
      onConnect={handleConnect}
      onSessionSelect={setSelectedSessionId}
      onCreateSession={handleCreateSession}
      onRefreshCurrentSession={() => void handleRefreshCurrentSession()}
      onDraftChange={setDraft}
      onAgentChange={(value) => setSelectedAgent(value)}
      onSend={handleSend}
      onRunCommand={(commandName, argumentsText) => void handleRunCommand(commandName, argumentsText)}
      onRetryLastMessage={() => void handleRetryLastMessage()}
      onAbortSession={() => void handleAbortSession()}
      onRefreshDiff={() => void refreshDiff()}
      respondingPermissionId={respondingPermissionId}
      onPermissionAction={handlePermissionAction}
      onQuestionReply={handleQuestionReply}
      onQuestionReject={handleQuestionReject}
    />
  );
}

export default App;

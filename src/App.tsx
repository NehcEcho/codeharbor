import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "./app/components/layouts/MainLayout";
import { opencodeApi } from "./lib/opencode";
import { loadServerConfig, saveServerConfig } from "./lib/storage";
import type {
  ChatMessage,
  ConnectionState,
  MessageEnvelope,
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

type SessionActivityMap = Record<string, { busySince?: number; lastActivityAt?: number }>;

type QueuedMessage = {
  id: string;
  sessionId: string;
  text: string;
  agent: "build" | "plan";
  optimisticMessageId: string;
  createdAt: number;
};

type AwaitingSessionCompletion = {
  sessionId: string;
  seenBusy: boolean;
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
  const [sessionActivity, setSessionActivity] = useState<SessionActivityMap>({});
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

  const handleRefreshCurrentSession = useCallback(async () => {
    if (isRefreshingSession) return;

    setIsRefreshingSession(true);
    try {
      await refreshSessions();
      if (!selectedSessionId) return;
      await Promise.all([refreshMessages(), refreshDiff()]);
    } finally {
      setIsRefreshingSession(false);
    }
  }, [isRefreshingSession, refreshDiff, refreshMessages, refreshSessions, selectedSessionId]);

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
      setConfig(normalized);
      saveServerConfig(normalized);
      setConnectionState("success");
      setConnectStatus(`已连接 ${normalized.baseUrl} · v${health.version}`);
      await refreshSessions(normalized);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setConnectionState("error");
      setConnectStatus(`连接失败: ${message}`);
    } finally {
      setIsConnecting(false);
    }
  }, [config, refreshSessions]);

  const handleCreateSession = useCallback(async () => {
    const title = window.prompt("给新的远程会话取个名字", "Remote coding task");
    if (!title) return;

    const created = await opencodeApi.createSession(config, { title });
    await refreshSessions();
    setSelectedSessionId(created.id);
  }, [config, refreshSessions]);

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
    setMessages((current) => [...current, optimisticMessage]);
    setDraft("");
    setEvents((current) => {
      const queueSize = queuedCount + 1;
      const label = queueSize > 1 ? `Queued message ${queueSize} for session` : "Queued message for session";
      return [label, ...current].slice(0, 20);
    });
  }, [draft, queuedCount, selectedAgent, selectedSessionId]);

  const dispatchQueuedMessage = useCallback(
    async (item: QueuedMessage) => {
      setDispatchingMessage(item);
      setIsSending(item.sessionId === selectedSessionId);

      try {
        await opencodeApi.sendMessage(config, item.sessionId, {
          agent: item.agent,
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
        setAwaitingSessionCompletion({ sessionId: item.sessionId, seenBusy: false });
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
      });
      return;
    }

    if (awaitingSessionCompletion.seenBusy && nextStatus && nextStatus !== "busy") {
      setAwaitingSessionCompletion(null);
    }
  }, [awaitingSessionCompletion, statusMap]);

  const handlePermissionAction = useCallback(
    async (id: string, action: "approved" | "denied") => {
      if (!selectedSessionId) return;

      setMessages((current) =>
        current.map((message) => (message.id === id ? { ...message, status: action } : message)),
      );

      try {
        await opencodeApi.respondPermission(
          config,
          selectedSessionId,
          id,
          action === "approved" ? "allow" : "deny",
        );
        await Promise.all([refreshMessages(), refreshSessions(), refreshDiff()]);
      } catch (error) {
        setMessages((current) =>
          current.map((message) => (message.id === id ? { ...message, status: "pending" } : message)),
        );
        const message = error instanceof Error ? error.message : "permission response failed";
        setEvents((current) => [`Permission action failed - ${message}`, ...current].slice(0, 20));
      }
    },
    [config, refreshDiff, refreshMessages, refreshSessions, selectedSessionId],
  );

  useEffect(() => {
    const interval = window.setInterval(() => setClock(Date.now()), 2000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      setMessages([]);
      setDiffCount(0);
      return;
    }

    void refreshMessages();
    void refreshDiff();
  }, [refreshDiff, refreshMessages, selectedSessionId]);

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
  }, [config, connectionState, refreshDiff, refreshMessages, refreshSessions, selectedSessionId]);

  useEffect(() => {
    if (!selectedSessionId || !config.password || !isSessionBusy) return;

    const interval = window.setInterval(() => {
      void refreshMessages();
      void refreshDiff();
      void refreshSessions();
    }, 3000);

    return () => window.clearInterval(interval);
  }, [config.password, isSessionBusy, refreshDiff, refreshMessages, refreshSessions, selectedSessionId]);

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
      isStalled={isSessionStalled}
      onConfigChange={setConfig}
      onConnect={handleConnect}
      onSessionSelect={setSelectedSessionId}
      onCreateSession={handleCreateSession}
      onRefreshCurrentSession={() => void handleRefreshCurrentSession()}
      onDraftChange={setDraft}
      onAgentChange={(value) => setSelectedAgent(value)}
      onSend={handleSend}
      onRefreshDiff={() => void refreshDiff()}
      onPermissionAction={handlePermissionAction}
    />
  );
}

export default App;

import type {
  AppEvent,
  CommandItem,
  ConfigProvidersResponse,
  CreateSessionRequest,
  HealthResponse,
  MessageEnvelope,
  MessagePage,
  OpenCodeConfig,
  PermissionRequest,
  QuestionRequest,
  SendMessageRequest,
  SkillItem,
  ServerConfig,
  Session,
  SessionStatusMap,
} from "../types";

const PROXY_BASE = "/api/opencode";

function trimTrailingSlash(value: string) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function withAuthHeaders(config: ServerConfig, headers?: HeadersInit) {
  return {
    "Content-Type": "application/json",
    "x-opencode-base-url": trimTrailingSlash(config.baseUrl),
    "x-opencode-username": config.username,
    "x-opencode-password": config.password,
    ...headers,
  };
}

async function parseErrorResponse(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      const data = (await response.json()) as { error?: string; message?: string };
      if (typeof data.error === "string" && data.error) return data.error;
      if (typeof data.message === "string" && data.message) return data.message;
    } catch {
      return fallback;
    }
  }

  try {
    const text = await response.text();
    return text || fallback;
  } catch {
    return fallback;
  }
}

async function request<T>(
  config: ServerConfig,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${PROXY_BASE}${path}`, {
    ...init,
    headers: withAuthHeaders(config, init?.headers),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, `Request failed: ${response.status}`);
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function requestPage<T>(
  config: ServerConfig,
  path: string,
  init?: RequestInit,
): Promise<{ items: T; nextCursor: string | null }> {
  const response = await fetch(`${PROXY_BASE}${path}`, {
    ...init,
    headers: withAuthHeaders(config, init?.headers),
  });

  if (!response.ok) {
    const errorText = await parseErrorResponse(response, `Request failed: ${response.status}`);
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  return {
    items: (await response.json()) as T,
    nextCursor: response.headers.get("x-next-cursor"),
  };
}

async function streamRequest(
  config: ServerConfig,
  path: string,
  onEvent: (event: AppEvent) => void,
  signal?: AbortSignal,
) {
  const response = await fetch(`${PROXY_BASE}${path}`, {
    method: "GET",
    headers: withAuthHeaders(config, {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
    }),
    signal,
  });

  if (!response.ok || !response.body) {
    const errorText = await parseErrorResponse(response, `Stream failed: ${response.status}`);
    throw new Error(errorText || `Stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const emitChunk = (chunk: string) => {
    const lines = chunk.split(/\r?\n/);
    let type = "message";
    const dataLines: string[] = [];

    for (const line of lines) {
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        type = line.slice(6).trim() || "message";
        continue;
      }
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    }

    const raw = dataLines.join("\n");
    let data: unknown = raw;
    if (raw) {
      try {
        data = JSON.parse(raw);
      } catch {
        data = raw;
      }
    }

    onEvent({ type, data, raw });
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      emitChunk(chunk);
    }
  }

  const finalChunk = `${buffer}${decoder.decode()}`.trim();
  if (finalChunk) {
    emitChunk(finalChunk);
  }
}

export const opencodeApi = {
  health(config: ServerConfig) {
    return request<HealthResponse>(config, "/global/health");
  },

  getConfig(config: ServerConfig) {
    return request<OpenCodeConfig>(config, "/config");
  },

  getGlobalConfig(config: ServerConfig) {
    return request<OpenCodeConfig>(config, "/global/config");
  },

  updateConfig(config: ServerConfig, body: OpenCodeConfig) {
    return request<OpenCodeConfig>(config, "/config", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  updateGlobalConfig(config: ServerConfig, body: OpenCodeConfig) {
    return request<OpenCodeConfig>(config, "/global/config", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  listConfigProviders(config: ServerConfig) {
    return request<ConfigProvidersResponse>(config, "/config/providers");
  },

  listCommands(config: ServerConfig) {
    return request<CommandItem[]>(config, "/command");
  },

  listSessions(config: ServerConfig) {
    return request<Session[]>(config, "/session");
  },

  getSessionStatus(config: ServerConfig) {
    return request<SessionStatusMap>(config, "/session/status");
  },

  abortSession(config: ServerConfig, sessionId: string) {
    return request<boolean>(config, `/session/${sessionId}/abort`, {
      method: "POST",
    });
  },

  forkSession(config: ServerConfig, sessionId: string, body?: { messageID?: string }) {
    return request<Session>(config, `/session/${sessionId}/fork`, {
      method: "POST",
      body: JSON.stringify(body || {}),
    });
  },

  revertSession(config: ServerConfig, sessionId: string, body: { messageID: string }) {
    return request<Session>(config, `/session/${sessionId}/revert`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  unrevertSession(config: ServerConfig, sessionId: string) {
    return request<Session>(config, `/session/${sessionId}/unrevert`, {
      method: "POST",
    });
  },

  createSession(config: ServerConfig, body: CreateSessionRequest) {
    return request<Session>(config, "/session", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listMessages(config: ServerConfig, sessionId: string, options?: { limit?: number; before?: string }) {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set("limit", String(options.limit));
    }
    if (options?.before) {
      params.set("before", options.before);
    }

    const query = params.toString();
    const path = `/session/${sessionId}/message${query ? `?${query}` : ""}`;

    return requestPage<MessageEnvelope[]>(config, path).then<MessagePage>(({ items, nextCursor }) => ({
      items,
      nextCursor,
    }));
  },

  sendMessage(config: ServerConfig, sessionId: string, body: SendMessageRequest) {
    return request<MessageEnvelope>(config, `/session/${sessionId}/message`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  runCommand(
    config: ServerConfig,
    sessionId: string,
    body: {
      command: string;
      arguments: string;
      agent?: string;
      model?: string;
    },
  ) {
    return request<MessageEnvelope>(config, `/session/${sessionId}/command`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  summarizeSession(
    config: ServerConfig,
    sessionId: string,
    body: {
      providerID: string;
      modelID: string;
      auto?: boolean;
    },
  ) {
    return request<boolean>(config, `/session/${sessionId}/summarize`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  getDiff(config: ServerConfig, sessionId: string) {
    return request<unknown[]>(config, `/session/${sessionId}/diff`);
  },

  respondPermission(
    config: ServerConfig,
    sessionId: string,
    permissionId: string,
    response: "allow" | "deny",
  ) {
    return request<boolean>(config, `/session/${sessionId}/permissions/${permissionId}`, {
      method: "POST",
      body: JSON.stringify({ response }),
    });
  },

  listPermissions(config: ServerConfig) {
    return request<PermissionRequest[]>(config, "/permission");
  },

  replyPermission(config: ServerConfig, requestId: string, reply: "once" | "always" | "reject", message?: string) {
    return request<boolean>(config, `/permission/${requestId}/reply`, {
      method: "POST",
      body: JSON.stringify(message ? { reply, message } : { reply }),
    });
  },

  listQuestions(config: ServerConfig) {
    return request<QuestionRequest[]>(config, "/question");
  },

  listSkills(config: ServerConfig) {
    return request<SkillItem[]>(config, "/skill");
  },

  replyQuestion(config: ServerConfig, requestId: string, answers: string[][]) {
    return request<boolean>(config, `/question/${requestId}/reply`, {
      method: "POST",
      body: JSON.stringify({ answers }),
    });
  },

  rejectQuestion(config: ServerConfig, requestId: string) {
    return request<boolean>(config, `/question/${requestId}/reject`, {
      method: "POST",
    });
  },

  streamEvents(config: ServerConfig, onEvent: (event: AppEvent) => void, signal?: AbortSignal) {
    return streamRequest(config, "/event", onEvent, signal);
  },
};

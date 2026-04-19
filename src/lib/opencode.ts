import type {
  AppEvent,
  CreateSessionRequest,
  HealthResponse,
  MessageEnvelope,
  SendMessageRequest,
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
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
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
    const errorText = await response.text();
    throw new Error(errorText || `Stream failed: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const lines = chunk.split(/\r?\n/);
      let type = "message";
      const dataLines: string[] = [];

      for (const line of lines) {
        if (line.startsWith("event:")) {
          type = line.slice(6).trim() || "message";
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
    }
  }
}

export const opencodeApi = {
  health(config: ServerConfig) {
    return request<HealthResponse>(config, "/global/health");
  },

  listSessions(config: ServerConfig) {
    return request<Session[]>(config, "/session");
  },

  getSessionStatus(config: ServerConfig) {
    return request<SessionStatusMap>(config, "/session/status");
  },

  createSession(config: ServerConfig, body: CreateSessionRequest) {
    return request<Session>(config, "/session", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  listMessages(config: ServerConfig, sessionId: string) {
    return request<MessageEnvelope[]>(config, `/session/${sessionId}/message?limit=100`);
  },

  sendMessage(config: ServerConfig, sessionId: string, body: SendMessageRequest) {
    return request<MessageEnvelope>(config, `/session/${sessionId}/message`, {
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

  streamEvents(config: ServerConfig, onEvent: (event: AppEvent) => void, signal?: AbortSignal) {
    return streamRequest(config, "/event", onEvent, signal);
  },
};

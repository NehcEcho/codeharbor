export type ServerConfig = {
  baseUrl: string;
  username: string;
  password: string;
};

export type ConnectionState = "idle" | "success" | "error";

export type HealthResponse = {
  healthy: boolean;
  version: string;
};

export type SessionStatusMap = Record<string, string>;

export type Session = {
  id: string;
  title?: string;
  parentID?: string | null;
  share?: unknown;
  time?: {
    created?: number;
    updated?: number;
  };
};

export type MessagePart = {
  id?: string;
  type?: string;
  text?: string;
  [key: string]: unknown;
};

export type MessageEnvelope = {
  info: {
    id: string;
    role?: string;
    sessionID?: string;
    time?: {
      created?: number;
      updated?: number;
    };
  };
  parts: MessagePart[];
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "permission";
  parts: MessagePart[];
  timestampLabel: string;
  status?: "success" | "approved" | "denied" | "pending" | "running";
  isPending?: boolean;
};

export type CreateSessionRequest = {
  title?: string;
  parentID?: string;
};

export type SendMessageRequest = {
  agent?: string;
  model?: string;
  noReply?: boolean;
  parts: Array<{
    type: string;
    text: string;
  }>;
};

export type PermissionRequest = {
  id: string;
  sessionID: string;
  command?: string;
  tool?: string;
  message?: string;
};

export type AppEvent = {
  type: string;
  data: unknown;
  raw?: string;
};

export type ServerConfig = {
  baseUrl: string;
  username: string;
  password: string;
  model: string;
};

export type OpenCodeConfig = {
  model?: string;
  [key: string]: unknown;
};

export type QuestionOption = {
  label: string;
  description: string;
};

export type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

export type PermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

export type ConnectionState = "idle" | "success" | "error";

export type HealthResponse = {
  healthy: boolean;
  version: string;
};

export type ConfigProviderModel = {
  id: string;
  name: string;
};

export type ConfigProvider = {
  id: string;
  name: string;
  models: Record<string, ConfigProviderModel>;
};

export type ConfigProvidersResponse = {
  providers: ConfigProvider[];
  default: Record<string, string>;
};

export type SkillItem = {
  name: string;
  description: string;
  location: string;
  content: string;
};

export type CommandItem = {
  name: string;
  description?: string;
  agent?: string;
  model?: string;
  source?: "command" | "mcp" | "skill";
  template: string;
  subtask?: boolean;
  hints: string[];
};

export type SessionStatusMap = Record<string, string>;

export type Session = {
  id: string;
  title?: string;
  parentID?: string | null;
  share?: unknown;
  revert?: {
    messageID: string;
    partID?: string;
    snapshot?: string;
    diff?: string;
  } | null;
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
    cost?: number;
    tokens?: {
      total?: number;
      input: number;
      output: number;
      reasoning: number;
      cache: {
        read: number;
        write: number;
      };
    };
    time?: {
      created?: number;
      updated?: number;
    };
  };
  parts: MessagePart[];
};

export type MessagePage = {
  items: MessageEnvelope[];
  nextCursor: string | null;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "tool" | "permission";
  parts: MessagePart[];
  timestampLabel: string;
  createdAt?: number;
  usage?: {
    contextInput: number;
    output: number;
    reasoning: number;
    cacheRead: number;
    cacheWrite: number;
    total?: number;
  };
  status?: "success" | "approved" | "denied" | "pending" | "running";
  isPending?: boolean;
  deliveryError?: string;
};

export type CreateSessionRequest = {
  title?: string;
  parentID?: string;
};

export type SendMessageRequest = {
  agent?: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  noReply?: boolean;
  parts: Array<{
    type: string;
    text: string;
  }>;
};

export type AppEvent = {
  type: string;
  data: unknown;
  raw?: string;
};

export type QuestionActionResult = {
  ok: boolean;
  error?: string;
};

import type {
  ChatMessage,
  MessageEnvelope,
  PermissionRequest,
  QuestionRequest,
  Session,
} from "../types";

export function normalizeBaseUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

export function formatTimestamp(timestamp?: number) {
  if (!timestamp) return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function mapMessageUsage(info: MessageEnvelope["info"]): ChatMessage["usage"] | undefined {
  if (!info.tokens) return undefined;

  return {
    contextInput: info.tokens.input,
    output: info.tokens.output,
    reasoning: info.tokens.reasoning,
    cacheRead: info.tokens.cache.read,
    cacheWrite: info.tokens.cache.write,
    total: info.tokens.total,
  };
}

export function mapMessageEnvelope(message: MessageEnvelope): ChatMessage {
  const role = (message.info.role || "assistant") as ChatMessage["role"];
  const createdAt = message.info.time?.created || message.info.time?.updated;
  return {
    id: message.info.id,
    role,
    parts: message.parts,
    timestampLabel: formatTimestamp(createdAt),
    createdAt,
    usage: mapMessageUsage(message.info),
    status: role === "tool" ? "success" : undefined,
  };
}

function mergePartLists(currentParts: ChatMessage["parts"], nextParts: ChatMessage["parts"]) {
  const merged = [...currentParts];

  for (const nextPart of nextParts) {
    const nextPartId = typeof nextPart.id === "string" ? nextPart.id : undefined;
    const partIndex = nextPartId ? merged.findIndex((item) => item.id === nextPartId) : -1;

    if (partIndex >= 0) {
      merged[partIndex] = { ...merged[partIndex], ...nextPart };
    } else {
      merged.push({ ...nextPart });
    }
  }

  return merged;
}

export function upsertMessagesById(current: ChatMessage[], next: ChatMessage[]) {
  const merged = [...current];

  for (const message of next) {
    const messageIndex = merged.findIndex((item) => item.id === message.id);

    if (messageIndex >= 0) {
      const existing = merged[messageIndex];
      merged[messageIndex] = {
        ...existing,
        ...message,
        isPending: message.isPending ?? false,
        deliveryError: message.deliveryError,
        parts: mergePartLists(existing.parts, message.parts),
      };
      continue;
    }

    merged.push(message);
  }

  return sortMessages(merged);
}

export function prependOlderMessages(current: ChatMessage[], olderPage: ChatMessage[]) {
  const knownIds = new Set(current.map((message) => message.id));
  const olderOnly = olderPage.filter((message) => !knownIds.has(message.id));
  return sortMessages([...olderOnly, ...current]);
}

export function confirmOptimisticMessage(
  current: ChatMessage[],
  optimisticMessageId: string,
  confirmedMessage: ChatMessage,
) {
  const withoutOptimistic = current.filter((message) => message.id !== optimisticMessageId && message.id !== confirmedMessage.id);
  return sortMessages([...withoutOptimistic, { ...confirmedMessage, isPending: false, deliveryError: undefined }]);
}

function trimMessagePartsBeforePart(message: ChatMessage, partID?: string) {
  if (!partID) return message;
  const partIndex = message.parts.findIndex((part) => part.id === partID);
  if (partIndex < 0) return message;
  return {
    ...message,
    parts: message.parts.slice(0, partIndex),
  };
}

export function applyRevertCleanup(current: ChatMessage[], revert?: Session["revert"] | null) {
  if (!revert?.messageID) return sortMessages(current);

  const sorted = sortMessages(current);
  const revertIndex = sorted.findIndex((message) => message.id === revert.messageID);
  if (revertIndex < 0) return sorted;

  if (!revert.partID) {
    return sorted.slice(0, revertIndex);
  }

  const boundary = trimMessagePartsBeforePart(sorted[revertIndex], revert.partID);
  return boundary.parts.length > 0
    ? [...sorted.slice(0, revertIndex), boundary]
    : sorted.slice(0, revertIndex);
}

function getMessageText(message: ChatMessage) {
  return message.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");
}

function canReplaceOptimisticWithFetched(optimistic: ChatMessage | undefined, fetched: ChatMessage) {
  if (!optimistic || optimistic.role !== "user" || !optimistic.isPending || fetched.role !== "user") return false;

  const optimisticText = getMessageText(optimistic);
  const fetchedText = getMessageText(fetched);
  if (!optimisticText || optimisticText !== fetchedText) return false;

  if (optimistic.createdAt !== undefined && fetched.createdAt !== undefined) {
    return fetched.createdAt >= optimistic.createdAt && fetched.createdAt - optimistic.createdAt <= 15_000;
  }

  return true;
}

export function mergeFetchedMessages(
  current: ChatMessage[],
  fetched: ChatMessage[],
  optimisticMessageId?: string | null,
) {
  let merged = current;
  let replacedOptimistic = false;

  for (const message of fetched) {
    const alreadyConfirmed = merged.some((item) => item.id === message.id);
    if (alreadyConfirmed) {
      merged = upsertMessagesById(merged, [message]);
      continue;
    }

    const optimistic = optimisticMessageId
      ? merged.find((item) => item.id === optimisticMessageId)
      : undefined;

    const hasAmbiguousPendingMatch = optimisticMessageId
      ? merged.some(
          (item) =>
            item.id !== optimisticMessageId &&
            item.role === "user" &&
            item.isPending &&
            getMessageText(item) === getMessageText(message),
        )
      : false;

    if (!replacedOptimistic && optimisticMessageId && !hasAmbiguousPendingMatch && canReplaceOptimisticWithFetched(optimistic, message)) {
      merged = confirmOptimisticMessage(merged, optimisticMessageId, message);
      replacedOptimistic = true;
      continue;
    }

    merged = upsertMessagesById(merged, [message]);
  }

  return merged;
}

export function mergeMessages(current: ChatMessage[], next: ChatMessage[]) {
  return upsertMessagesById(current, next);
}

export function sortMessages(messages: ChatMessage[]) {
  return [...messages].sort((left, right) => {
    const leftTime = left.createdAt || 0;
    const rightTime = right.createdAt || 0;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id.localeCompare(right.id);
  });
}

export function upsertMessageInfo(current: ChatMessage[], info: MessageEnvelope["info"]) {
  const role = (info.role || "assistant") as ChatMessage["role"];
  const existing = current.find((message) => message.id === info.id);

  if (existing) {
    return current.map((message) =>
      message.id === info.id
        ? {
            ...message,
            role,
            timestampLabel: formatTimestamp(info.time?.created || info.time?.updated),
            createdAt: info.time?.created || info.time?.updated || message.createdAt,
            usage: mapMessageUsage(info),
            isPending: false,
            deliveryError: undefined,
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
      createdAt: info.time?.created || info.time?.updated,
      usage: mapMessageUsage(info),
      status: role === "tool" ? "success" : undefined,
    },
  ]);
}

export function replaceOptimisticMessageInfo(
  current: ChatMessage[],
  optimisticMessageId: string,
  info: MessageEnvelope["info"],
) {
  const role = (info.role || "assistant") as ChatMessage["role"];
  if (role !== "user") {
    return upsertMessageInfo(current, info);
  }

  const existing = current.find((message) => message.id === info.id);
  if (existing) {
    return upsertMessageInfo(current, info);
  }

  const optimistic = current.find((message) => message.id === optimisticMessageId);
  if (!optimistic || optimistic.role !== "user") {
    return upsertMessageInfo(current, info);
  }

  const createdAt = info.time?.created || info.time?.updated;
  return current.map((message) =>
    message.id === optimisticMessageId
      ? {
          ...message,
          id: info.id,
          role,
          timestampLabel: formatTimestamp(createdAt),
          createdAt: createdAt || message.createdAt,
          usage: mapMessageUsage(info),
          isPending: false,
          deliveryError: undefined,
        }
      : message,
  );
}

export function upsertMessagePart(
  current: ChatMessage[],
  part: { messageID?: string; id?: string; type?: string; text?: string },
) {
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

export function appendMessageDelta(
  current: ChatMessage[],
  payload: { messageID?: string; partID?: string; field?: string; delta?: string },
) {
  const field = payload.field;
  if (!payload.messageID || !payload.partID || !field) return current;

  return current.map((message) => {
    if (message.id !== payload.messageID) return message;

    const nextParts = [...message.parts];
    const partIndex = nextParts.findIndex((item) => item.id === payload.partID);

    if (partIndex >= 0) {
      const currentValue = nextParts[partIndex][field];
      if (typeof currentValue === "string" || currentValue === undefined) {
        nextParts[partIndex] = {
          ...nextParts[partIndex],
          [field]: `${typeof currentValue === "string" ? currentValue : ""}${payload.delta || ""}`,
        };
      }
      return { ...message, parts: nextParts };
    }

    nextParts.push({ id: payload.partID, [field]: payload.delta || "" });

    return { ...message, parts: nextParts };
  });
}

export function upsertSession(current: Session[], nextSession: Session) {
  const found = current.some((session) => session.id === nextSession.id);
  const next = found
    ? current.map((session) => (session.id === nextSession.id ? { ...session, ...nextSession } : session))
    : [...current, nextSession];

  return [...next].sort((left, right) => (right.time?.updated || 0) - (left.time?.updated || 0));
}

export function upsertQuestionRequest(current: QuestionRequest[], nextRequest: QuestionRequest) {
  const existingIndex = current.findIndex((item) => item.id === nextRequest.id);
  if (existingIndex >= 0) {
    const next = [...current];
    next[existingIndex] = nextRequest;
    return next;
  }
  return [...current, nextRequest];
}

export function removeQuestionRequest(current: QuestionRequest[], requestId: string) {
  return current.filter((item) => item.id !== requestId);
}

export function upsertPermissionRequest(current: PermissionRequest[], nextRequest: PermissionRequest) {
  const existingIndex = current.findIndex((item) => item.id === nextRequest.id);
  if (existingIndex >= 0) {
    const next = [...current];
    next[existingIndex] = nextRequest;
    return next;
  }
  return [...current, nextRequest];
}

export function removePermissionRequest(current: PermissionRequest[], requestId: string) {
  return current.filter((item) => item.id !== requestId);
}

export function markMessageDeliveryFailed(current: ChatMessage[], optimisticMessageId: string, error: string) {
  return current.map((message) =>
    message.id === optimisticMessageId
      ? {
          ...message,
          isPending: false,
          deliveryError: error,
        }
      : message,
  );
}

export function getLatestUserMessageTarget(messages: ChatMessage[]) {
  const userMessage = [...messages].reverse().find((message) => message.role === "user" && !message.isPending);
  if (!userMessage) return null;

  const text = userMessage.parts
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("");

  return {
    id: userMessage.id,
    text,
  };
}

export function getVisibleMessages(messages: ChatMessage[], revert?: Session["revert"] | null) {
  if (!revert?.messageID) return sortMessages(messages);

  const sorted = sortMessages(messages);
  const revertIndex = sorted.findIndex((message) => message.id === revert.messageID);
  if (revertIndex < 0) return sorted;

  if (!revert.partID) {
    return sorted.slice(0, revertIndex);
  }

  const boundary = trimMessagePartsBeforePart(sorted[revertIndex], revert.partID);
  return boundary.parts.length > 0
    ? [...sorted.slice(0, revertIndex), boundary]
    : sorted.slice(0, revertIndex);
}

export function removeMessageById(current: ChatMessage[], messageID: string) {
  return current.filter((message) => message.id !== messageID);
}

export function removeMessagePart(current: ChatMessage[], messageID: string, partID: string) {
  return current.flatMap((message) => {
    if (message.id !== messageID) return [message];
    const nextParts = message.parts.filter((part) => part.id !== partID);
    return nextParts.length > 0 ? [{ ...message, parts: nextParts }] : [];
  });
}

export function normalizeSessionStatus(status: unknown) {
  if (typeof status === "string") return status;
  if (status && typeof status === "object" && "type" in status) {
    const type = (status as { type?: unknown }).type;
    if (typeof type === "string") return type;
  }
  return "idle";
}

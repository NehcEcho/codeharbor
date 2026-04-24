import type { PermissionRequest, QuestionRequest } from "../types";

export type MessageRequestKind = "latest" | "older";

export type SessionCursorMap = Record<string, string | null>;

export type SessionMessageRequestSeqMap = Record<string, Record<MessageRequestKind, number>>;

export type SessionRequestSeqMap = Record<string, number>;

export type AwaitingSessionCompletionMap = Record<string, { sessionId: string; seenBusy: boolean; startedAt: number }>;

export type FailedDraftLike = {
  text: string;
  agent: string;
  model: string;
};

export type SendSubmissionGuard = {
  sessionId: string;
  text: string;
};

export function getSessionCursor(cursors: SessionCursorMap, sessionId: string | null | undefined) {
  if (!sessionId) return null;
  return cursors[sessionId] ?? null;
}

export function setSessionCursor(cursors: SessionCursorMap, sessionId: string, nextCursor: string | null) {
  const nextState: SessionCursorMap = {
    ...cursors,
    [sessionId]: nextCursor,
  };
  return nextState;
}

export function nextSessionMessageRequestSeq(
  current: SessionMessageRequestSeqMap,
  sessionId: string,
  kind: MessageRequestKind,
) {
  const sessionState = current[sessionId] || { latest: 0, older: 0 };
  const next = sessionState[kind] + 1;

  return {
    requestSeq: next,
    nextState: {
      ...current,
      [sessionId]: {
        ...sessionState,
        [kind]: next,
      },
    },
  };
}

export function isLatestSessionMessageRequest(
  current: SessionMessageRequestSeqMap,
  sessionId: string,
  kind: MessageRequestKind,
  requestSeq: number,
) {
  return current[sessionId]?.[kind] === requestSeq;
}

export function nextSessionRequestSeq(current: SessionRequestSeqMap, sessionId: string) {
  const requestSeq = (current[sessionId] || 0) + 1;
  return {
    requestSeq,
    nextState: {
      ...current,
      [sessionId]: requestSeq,
    },
  };
}

export function isLatestSessionRequest(current: SessionRequestSeqMap, sessionId: string, requestSeq: number) {
  return current[sessionId] === requestSeq;
}

export function pruneSessionRecord<T>(current: Record<string, T>, validSessionIds: Iterable<string>) {
  const valid = new Set(validSessionIds);
  const next: Record<string, T> = {};

  for (const [sessionId, value] of Object.entries(current)) {
    if (valid.has(sessionId)) {
      next[sessionId] = value;
    }
  }

  return next;
}

export function shouldRestoreFailedDraft(
  failedDraft: FailedDraftLike | undefined,
  messages: Array<{ deliveryError?: string }>,
  currentDraft: string,
) {
  if (!failedDraft) return false;
  if (currentDraft.trim()) return false;
  return messages.some((message) => Boolean(message.deliveryError));
}

export function shouldBlockDuplicateSend(
  guard: SendSubmissionGuard | null | undefined,
  sessionId: string,
  text: string,
) {
  return guard?.sessionId === sessionId && guard.text === text;
}

export function shouldClearSendSubmissionGuard(
  guard: SendSubmissionGuard | null | undefined,
  sessionId: string | null,
  draft: string,
) {
  if (!guard) return false;
  return guard.sessionId !== sessionId || guard.text !== draft.trim();
}

export function getRequestSessionIdByQuestionId(requests: QuestionRequest[], id: string) {
  return requests.find((item) => item.id === id)?.sessionID || null;
}

export function getRequestSessionIdByPermissionId(requests: PermissionRequest[], id: string) {
  return requests.find((item) => item.id === id)?.sessionID || null;
}

export function findQuestionSessionId(
  requestsBySession: Record<string, QuestionRequest[]>,
  id: string,
) {
  for (const [sessionId, requests] of Object.entries(requestsBySession)) {
    if (requests.some((item) => item.id === id)) return sessionId;
  }
  return null;
}

export function findPermissionSessionId(
  requestsBySession: Record<string, PermissionRequest[]>,
  id: string,
) {
  for (const [sessionId, requests] of Object.entries(requestsBySession)) {
    if (requests.some((item) => item.id === id)) return sessionId;
  }
  return null;
}

export function isSessionAwaitingCompletion(
  awaitingBySession: AwaitingSessionCompletionMap,
  sessionId: string,
) {
  return Boolean(awaitingBySession[sessionId]);
}

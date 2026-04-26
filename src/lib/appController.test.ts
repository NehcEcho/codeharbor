import test from "node:test";
import assert from "node:assert/strict";
import type { PermissionRequest, QuestionRequest } from "../types";
import {
  findPermissionSessionId,
  findQuestionSessionId,
  getRequestSessionIdByPermissionId,
  getRequestSessionIdByQuestionId,
  getSessionCursor,
  isLatestSessionRequest,
  isLatestSessionMessageRequest,
  isSessionSendLocked,
  isSessionAwaitingCompletion,
  nextSessionRequestSeq,
  nextSessionMessageRequestSeq,
  pruneSessionRecord,
  pruneSessionRecordPreserving,
  setSessionCursor,
  shouldRestoreFailedDraft,
} from "./appController";

function removeSessionKey<T>(current: Record<string, T>, sessionId: string) {
  const { [sessionId]: _removed, ...rest } = current;
  return rest;
}

test("stores message cursors per session instead of a shared global slot", () => {
  let cursors: Record<string, string | null> = {};

  cursors = setSessionCursor(cursors, "session-a", "cursor-a-1");
  cursors = setSessionCursor(cursors, "session-b", "cursor-b-1");
  cursors = setSessionCursor(cursors, "session-a", "cursor-a-2");

  assert.equal(getSessionCursor(cursors, "session-a"), "cursor-a-2");
  assert.equal(getSessionCursor(cursors, "session-b"), "cursor-b-1");
  assert.equal(getSessionCursor(cursors, "session-c"), null);
});

test("message request sequencing is isolated by session and request kind", () => {
  let state: Record<string, { latest: number; older: number }> = {};

  const aLatest1 = nextSessionMessageRequestSeq(state, "session-a", "latest");
  state = aLatest1.nextState;
  const bLatest1 = nextSessionMessageRequestSeq(state, "session-b", "latest");
  state = bLatest1.nextState;
  const aOlder1 = nextSessionMessageRequestSeq(state, "session-a", "older");
  state = aOlder1.nextState;
  const aLatest2 = nextSessionMessageRequestSeq(state, "session-a", "latest");

  assert.equal(aLatest1.requestSeq, 1);
  assert.equal(bLatest1.requestSeq, 1);
  assert.equal(aOlder1.requestSeq, 1);
  assert.equal(aLatest2.requestSeq, 2);
  assert.deepEqual(aLatest2.nextState, {
    "session-a": { latest: 2, older: 1 },
    "session-b": { latest: 1, older: 0 },
  });
});

test("question action refresh targets the originating session by request id", () => {
  const requests: QuestionRequest[] = [
    { id: "q-1", sessionID: "session-a", questions: [] },
    { id: "q-2", sessionID: "session-b", questions: [] },
  ];

  assert.equal(getRequestSessionIdByQuestionId(requests, "q-2"), "session-b");
  assert.equal(getRequestSessionIdByQuestionId(requests, "missing"), null);
});

test("permission action refresh targets the originating session by request id", () => {
  const requests: PermissionRequest[] = [
    { id: "p-1", sessionID: "session-a", permission: "exec", patterns: [], metadata: {}, always: [] },
    { id: "p-2", sessionID: "session-c", permission: "read", patterns: [], metadata: {}, always: [] },
  ];

  assert.equal(getRequestSessionIdByPermissionId(requests, "p-2"), "session-c");
  assert.equal(getRequestSessionIdByPermissionId(requests, "missing"), null);
});

test("question lookup finds the correct session from per-session request maps", () => {
  const requestsBySession: Record<string, QuestionRequest[]> = {
    "session-a": [{ id: "q-1", sessionID: "session-a", questions: [] }],
    "session-b": [{ id: "q-2", sessionID: "session-b", questions: [] }],
  };

  assert.equal(findQuestionSessionId(requestsBySession, "q-2"), "session-b");
  assert.equal(findQuestionSessionId(requestsBySession, "missing"), null);
});

test("permission lookup finds the correct session from per-session request maps", () => {
  const requestsBySession: Record<string, PermissionRequest[]> = {
    "session-a": [{ id: "p-1", sessionID: "session-a", permission: "exec", patterns: [], metadata: {}, always: [] }],
    "session-c": [{ id: "p-2", sessionID: "session-c", permission: "read", patterns: [], metadata: {}, always: [] }],
  };

  assert.equal(findPermissionSessionId(requestsBySession, "p-2"), "session-c");
  assert.equal(findPermissionSessionId(requestsBySession, "missing"), null);
});

test("latest message requests are tracked independently per session and request kind", () => {
  let state: Record<string, { latest: number; older: number }> = {};

  const aLatest1 = nextSessionMessageRequestSeq(state, "session-a", "latest");
  state = aLatest1.nextState;
  const aOlder1 = nextSessionMessageRequestSeq(state, "session-a", "older");
  state = aOlder1.nextState;
  const bLatest1 = nextSessionMessageRequestSeq(state, "session-b", "latest");
  state = bLatest1.nextState;

  assert.equal(isLatestSessionMessageRequest(state, "session-a", "latest", aLatest1.requestSeq), true);
  assert.equal(isLatestSessionMessageRequest(state, "session-a", "older", aOlder1.requestSeq), true);
  assert.equal(isLatestSessionMessageRequest(state, "session-b", "latest", bLatest1.requestSeq), true);
  assert.equal(isLatestSessionMessageRequest(state, "session-a", "latest", 999), false);
  assert.equal(isLatestSessionMessageRequest(state, "session-b", "older", 1), false);
});

test("awaiting completion is isolated per session", () => {
  const awaiting = {
    "session-a": { sessionId: "session-a", seenBusy: false, startedAt: 10 },
    "session-c": { sessionId: "session-c", seenBusy: true, startedAt: 20 },
  };

  assert.equal(isSessionAwaitingCompletion(awaiting, "session-a"), true);
  assert.equal(isSessionAwaitingCompletion(awaiting, "session-b"), false);
  assert.equal(isSessionAwaitingCompletion(awaiting, "session-c"), true);
});

test("generic per-session request sequencing rejects stale diff responses", () => {
  let state: Record<string, number> = {};

  const a1 = nextSessionRequestSeq(state, "session-a");
  state = a1.nextState;
  const b1 = nextSessionRequestSeq(state, "session-b");
  state = b1.nextState;
  const a2 = nextSessionRequestSeq(state, "session-a");
  state = a2.nextState;

  assert.equal(isLatestSessionRequest(state, "session-a", a1.requestSeq), false);
  assert.equal(isLatestSessionRequest(state, "session-a", a2.requestSeq), true);
  assert.equal(isLatestSessionRequest(state, "session-b", b1.requestSeq), true);
});

test("pruneSessionRecord drops ghost session cache entries", () => {
  const current = {
    "session-a": ["keep"],
    "session-b": ["drop"],
    "session-c": ["keep-too"],
  };

  assert.deepEqual(pruneSessionRecord(current, ["session-a", "session-c"]), {
    "session-a": ["keep"],
    "session-c": ["keep-too"],
  });
});

test("pruneSessionRecordPreserving keeps active send locks during transient session list gaps", () => {
  const current = {
    "session-a": true,
    "session-b": true,
  };

  assert.deepEqual(pruneSessionRecordPreserving(current, ["session-b"], ["session-a"]), {
    "session-a": true,
    "session-b": true,
  });
});

test("failed draft restore only repopulates text when the user is not already editing", () => {
  const failedDraft = {
    text: "retry this",
    agent: "plan",
    model: "provider/model",
    optimisticMessageId: "local-1",
  };

  assert.equal(
    shouldRestoreFailedDraft(failedDraft, [{ id: "local-1", deliveryError: "send failed" }], ""),
    true,
  );
  assert.equal(
    shouldRestoreFailedDraft(failedDraft, [{ id: "local-1", deliveryError: "send failed" }], "already typing"),
    false,
  );
  assert.equal(
    shouldRestoreFailedDraft(failedDraft, [{ id: "local-1", deliveryError: undefined }], ""),
    false,
  );
  assert.equal(shouldRestoreFailedDraft(failedDraft, [{ id: "local-2", deliveryError: "send failed" }], ""), false);
  assert.equal(shouldRestoreFailedDraft(undefined, [{ id: "local-1", deliveryError: "send failed" }], ""), false);
});

test("failed draft restore can be cleared after the first repopulation", () => {
  const failedDrafts = {
    "session-a": { text: "retry this", agent: "plan", model: "provider/model", optimisticMessageId: "local-1" },
  };

  const shouldRestore = shouldRestoreFailedDraft(
    failedDrafts["session-a"],
    [{ id: "local-1", deliveryError: "send failed" }],
    "",
  );
  assert.equal(shouldRestore, true);

  const cleared = removeSessionKey(failedDrafts, "session-a");
  assert.deepEqual(cleared, {});
  assert.equal(shouldRestoreFailedDraft(cleared["session-a"], [{ id: "local-1", deliveryError: "send failed" }], ""), false);
});

test("session send lock covers both preparing and in-flight windows", () => {
  assert.equal(isSessionSendLocked({}, {}, "session-a"), false);
  assert.equal(isSessionSendLocked({ "session-a": true }, {}, "session-a"), true);
  assert.equal(isSessionSendLocked({}, { "session-a": true }, "session-a"), true);
  assert.equal(isSessionSendLocked({ "session-b": true }, { "session-c": true }, "session-a"), false);
});


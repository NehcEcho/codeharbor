import test from "node:test";
import assert from "node:assert/strict";
import type { ChatMessage } from "../types";
import {
  applyRevertCleanup,
  appendMessageDelta,
  confirmOptimisticMessage,
  getVisibleMessages,
  mergeMessages,
  mergeFetchedMessages,
  normalizeSessionStatus,
  prependOlderMessages,
  replaceOptimisticMessageInfo,
  removeMessageById,
  removeMessagePart,
  sortMessages,
  upsertMessagesById,
} from "./appState";

function message(id: string, text: string, options?: Partial<ChatMessage>): ChatMessage {
  return {
    id,
    role: "user",
    parts: [{ type: "text", text }],
    timestampLabel: "10:00",
    ...options,
  };
}

test("mergeMessages upserts by id without collapsing duplicate pending text", () => {
  const pendingA = message("local-1", "same", { isPending: true, createdAt: 10 });
  const pendingB = message("local-2", "same", { isPending: true, createdAt: 20 });
  const confirmed = message("server-1", "same", { createdAt: 30 });

  const merged = mergeMessages([pendingA, pendingB], [confirmed]);

  assert.equal(merged.length, 3);
  assert.equal(merged.filter((item) => item.isPending).length, 2);
  assert.deepEqual(merged.map((item) => item.id), ["local-1", "local-2", "server-1"]);
});

test("sortMessages orders by createdAt before id", () => {
  const sorted = sortMessages([
    message("z", "later", { createdAt: 200 }),
    message("a", "earlier", { createdAt: 100 }),
    message("b", "same-time", { createdAt: 100 }),
  ]);

  assert.deepEqual(sorted.map((item) => item.id), ["a", "b", "z"]);
});

test("getVisibleMessages respects sorted revert boundary", () => {
  const visible = getVisibleMessages(
    [
      message("m-3", "third", { createdAt: 300 }),
      message("m-1", "first", { createdAt: 100 }),
      message("m-2", "second", { createdAt: 200 }),
    ],
    { messageID: "m-3" },
  );

  assert.deepEqual(visible.map((item) => item.id), ["m-1", "m-2"]);
});

test("getVisibleMessages lets new optimistic messages show after revert boundary is cleared from source list", () => {
  const source = [
    message("m-1", "first", { createdAt: 100 }),
    message("m-2", "second", { createdAt: 200 }),
    message("local-1", "replacement", { createdAt: 300, isPending: true }),
  ];

  const visible = getVisibleMessages(source, null);

  assert.deepEqual(visible.map((item) => item.id), ["m-1", "m-2", "local-1"]);
});

test("getVisibleMessages keeps restored messages visible after unrevert clears the boundary", () => {
  const source = [
    message("m-1", "first", { createdAt: 100 }),
    message("m-2", "second", { createdAt: 200 }),
    message("m-3", "restored", { createdAt: 300 }),
    message("local-1", "replacement", { createdAt: 400, isPending: true }),
  ];

  const visible = getVisibleMessages(source, null);

  assert.deepEqual(visible.map((item) => item.id), ["m-1", "m-2", "m-3", "local-1"]);
});

test("getVisibleMessages hides optimistic resend while revert boundary is still active", () => {
  const source = [
    message("m-1", "first", { createdAt: 100 }),
    message("m-2", "second", { createdAt: 200 }),
    message("local-1", "replacement", { createdAt: 300, isPending: true }),
  ];

  const visible = getVisibleMessages(source, { messageID: "m-2" });

  assert.deepEqual(visible.map((item) => item.id), ["m-1"]);
});

test("getVisibleMessages preserves parts before a reverted part boundary", () => {
  const visible = getVisibleMessages(
    [
      {
        id: "m-1",
        role: "assistant",
        timestampLabel: "10:00",
        createdAt: 100,
        parts: [
          { id: "p-1", type: "text", text: "keep" },
          { id: "p-2", type: "tool", text: "trim" },
        ],
      },
    ],
    { messageID: "m-1", partID: "p-2" },
  );

  assert.equal(visible.length, 1);
  assert.deepEqual(visible[0].parts.map((part) => part.id), ["p-1"]);
});

test("applyRevertCleanup removes reverted messages from cached source", () => {
  const current = [
    message("m-1", "first", { createdAt: 100 }),
    message("m-2", "second", { createdAt: 200 }),
    message("local-1", "replacement", { createdAt: 300, isPending: true }),
  ];

  const next = applyRevertCleanup(current, { messageID: "m-2" });

  assert.deepEqual(next.map((item) => item.id), ["m-1"]);
});

test("removeMessageById drops the targeted message", () => {
  const next = removeMessageById([
    message("m-1", "first"),
    message("m-2", "second"),
  ], "m-2");

  assert.deepEqual(next.map((item) => item.id), ["m-1"]);
});

test("removeMessagePart drops only the targeted part", () => {
  const next = removeMessagePart([
    {
      id: "m-1",
      role: "assistant",
      timestampLabel: "10:00",
      parts: [
        { id: "p-1", type: "text", text: "a" },
        { id: "p-2", type: "tool", text: "b" },
      ],
    },
  ], "m-1", "p-2");

  assert.deepEqual(next[0].parts.map((part) => part.id), ["p-1"]);
});

test("removeMessagePart drops the whole message when no parts remain", () => {
  const next = removeMessagePart([
    {
      id: "m-1",
      role: "assistant",
      timestampLabel: "10:00",
      parts: [{ id: "p-1", type: "tool", text: "a" }],
    },
  ], "m-1", "p-1");

  assert.deepEqual(next, []);
});

test("appendMessageDelta appends to existing non-text part fields", () => {
  const current: ChatMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      timestampLabel: "10:00",
      parts: [{ id: "part-1", type: "reasoning", text: "hello" }],
    },
  ];

  const next = appendMessageDelta(current, {
    messageID: "assistant-1",
    partID: "part-1",
    field: "text",
    delta: " world",
  });

  assert.equal(next[0].parts[0].text, "hello world");
});

test("appendMessageDelta creates placeholder for non-text fields", () => {
  const current: ChatMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      timestampLabel: "10:00",
      parts: [],
    },
  ];

  const next = appendMessageDelta(current, {
    messageID: "assistant-1",
    partID: "part-2",
    field: "reasoning",
    delta: "step 1",
  });

  assert.deepEqual(next[0].parts[0], { id: "part-2", reasoning: "step 1" });
});

test("confirmOptimisticMessage replaces exact optimistic id without text matching", () => {
  const current = [
    message("local-1", "same", { isPending: true, createdAt: 10 }),
    message("local-2", "same", { isPending: true, createdAt: 20 }),
  ];

  const next = confirmOptimisticMessage(current, "local-2", message("server-2", "same", { createdAt: 30 }));

  assert.deepEqual(next.map((item) => item.id), ["local-1", "server-2"]);
  assert.equal(next.find((item) => item.id === "local-1")?.isPending, true);
});

test("replaceOptimisticMessageInfo upgrades the targeted pending user message when server info arrives first", () => {
  const current = [message("local-1", "same", { isPending: true, createdAt: 1_000 })];

  const next = replaceOptimisticMessageInfo(current, "local-1", {
    id: "server-1",
    role: "user",
    sessionID: "session-a",
    time: { created: 1_005 },
  });

  assert.deepEqual(next.map((item) => item.id), ["server-1"]);
  assert.equal(next[0].isPending, false);
  assert.equal(next[0].role, "user");
});

test("replaceOptimisticMessageInfo leaves other optimistic messages untouched", () => {
  const current = [
    message("local-1", "first", { isPending: true, createdAt: 1_000 }),
    message("local-2", "second", { isPending: true, createdAt: 2_000 }),
  ];

  const next = replaceOptimisticMessageInfo(current, "local-1", {
    id: "server-1",
    role: "user",
    sessionID: "session-a",
    time: { created: 1_005 },
  });

  assert.deepEqual(next.map((item) => item.id), ["server-1", "local-2"]);
  assert.equal(next.find((item) => item.id === "local-2")?.isPending, true);
});

test("replaceOptimisticMessageInfo falls back to upsert when target optimistic message is missing", () => {
  const current = [message("local-2", "second", { isPending: true, createdAt: 2_000 })];

  const next = replaceOptimisticMessageInfo(current, "local-1", {
    id: "server-1",
    role: "user",
    sessionID: "session-a",
    time: { created: 1_005 },
  });

  assert.deepEqual(next.map((item) => item.id), ["server-1", "local-2"]);
  assert.equal(next.find((item) => item.id === "local-2")?.isPending, true);
});

test("replaceOptimisticMessageInfo does not replace optimistic user message with assistant info", () => {
  const current = [message("local-1", "same", { isPending: true, createdAt: 1_000 })];

  const next = replaceOptimisticMessageInfo(current, "local-1", {
    id: "assistant-1",
    role: "assistant",
    sessionID: "session-a",
    time: { created: 1_005 },
  });

  assert.deepEqual(next.map((item) => item.id), ["local-1", "assistant-1"]);
  assert.equal(next.find((item) => item.id === "local-1")?.isPending, true);
  assert.equal(next.find((item) => item.id === "assistant-1")?.role, "assistant");
});

test("replaceOptimisticMessageInfo does not replace non-user optimistic target", () => {
  const current = [
    {
      id: "local-tool",
      role: "tool" as const,
      parts: [],
      timestampLabel: "10:00",
      createdAt: 1_000,
      isPending: true,
    },
  ];

  const next = replaceOptimisticMessageInfo(current, "local-tool", {
    id: "server-1",
    role: "user",
    sessionID: "session-a",
    time: { created: 1_005 },
  });

  assert.deepEqual(next.map((item) => item.id), ["local-tool", "server-1"]);
  assert.equal(next.find((item) => item.id === "local-tool")?.role, "tool");
  assert.equal(next.find((item) => item.id === "server-1")?.role, "user");
});

test("mergeFetchedMessages upgrades matching optimistic user message during refresh", () => {
  const current = [message("local-1", "same", { isPending: true, createdAt: 1_000 })];
  const fetched = [message("server-1", "same", { createdAt: 1_005 })];

  const next = mergeFetchedMessages(current, fetched, "local-1");

  assert.deepEqual(next.map((item) => item.id), ["server-1"]);
  assert.equal(next[0].isPending, false);
});

test("mergeFetchedMessages preserves unrelated optimistic messages during refresh", () => {
  const current = [message("local-1", "first", { isPending: true, createdAt: 1_000 })];
  const fetched = [message("server-1", "different", { createdAt: 1_005 })];

  const next = mergeFetchedMessages(current, fetched, "local-1");

  assert.deepEqual(next.map((item) => item.id), ["local-1", "server-1"]);
  assert.equal(next.find((item) => item.id === "local-1")?.isPending, true);
});

test("mergeFetchedMessages does not collapse repeated identical optimistic messages without explicit target", () => {
  const current = [
    message("local-1", "continue", { isPending: true, createdAt: 1_000 }),
    message("local-2", "continue", { isPending: true, createdAt: 2_000 }),
  ];
  const fetched = [message("server-2", "continue", { createdAt: 2_005 })];

  const next = mergeFetchedMessages(current, fetched);

  assert.deepEqual(next.map((item) => item.id), ["local-1", "local-2", "server-2"]);
  assert.equal(next.filter((item) => item.isPending).length, 2);
});

test("mergeFetchedMessages does not replace targeted optimistic message when another pending message has identical text", () => {
  const current = [
    message("local-1", "continue", { isPending: true, createdAt: 1_000 }),
    message("local-2", "continue", { isPending: true, createdAt: 2_000 }),
  ];
  const fetched = [message("server-2", "continue", { createdAt: 2_005 })];

  const next = mergeFetchedMessages(current, fetched, "local-2");

  assert.deepEqual(next.map((item) => item.id), ["local-1", "local-2", "server-2"]);
  assert.equal(next.find((item) => item.id === "local-2")?.isPending, true);
});

test("prependOlderMessages keeps strict pagination order and ignores duplicates", () => {
  const current = [
    message("m-2", "second", { createdAt: 200 }),
    message("m-3", "third", { createdAt: 300 }),
  ];

  const next = prependOlderMessages(current, [
    message("m-1", "first", { createdAt: 100 }),
    message("m-2", "duplicate", { createdAt: 200 }),
  ]);

  assert.deepEqual(next.map((item) => item.id), ["m-1", "m-2", "m-3"]);
  assert.equal(next[1].parts[0].text, "second");
});

test("upsertMessagesById merges streamed parts into existing message by id", () => {
  const current: ChatMessage[] = [
    {
      id: "assistant-1",
      role: "assistant",
      timestampLabel: "10:00",
      parts: [{ id: "part-1", type: "text", text: "hello" }],
      createdAt: 100,
    },
  ];

  const next = upsertMessagesById(current, [
    {
      id: "assistant-1",
      role: "assistant",
      timestampLabel: "10:01",
      parts: [{ id: "part-2", type: "reasoning", text: "thinking" }],
      createdAt: 100,
    },
  ]);

  assert.deepEqual(next[0].parts.map((item) => item.id), ["part-1", "part-2"]);
});

test("normalizeSessionStatus handles both string and object payloads", () => {
  assert.equal(normalizeSessionStatus("busy"), "busy");
  assert.equal(normalizeSessionStatus({ type: "retry", next: 1 }), "retry");
  assert.equal(normalizeSessionStatus(null), "idle");
});

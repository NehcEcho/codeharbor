import test from "node:test";
import assert from "node:assert/strict";
import type { ChatMessage } from "../types";
import {
  appendMessageDelta,
  confirmOptimisticMessage,
  getVisibleMessages,
  mergeMessages,
  normalizeSessionStatus,
  prependOlderMessages,
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
    "m-3",
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

test("getVisibleMessages hides optimistic resend while revert boundary is still active", () => {
  const source = [
    message("m-1", "first", { createdAt: 100 }),
    message("m-2", "second", { createdAt: 200 }),
    message("local-1", "replacement", { createdAt: 300, isPending: true }),
  ];

  const visible = getVisibleMessages(source, "m-2");

  assert.deepEqual(visible.map((item) => item.id), ["m-1"]);
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

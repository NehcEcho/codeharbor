import { useMemo } from "react";
import type { MessageEnvelope } from "../types";

type ChatPanelProps = {
  messages: MessageEnvelope[];
  draft: string;
  selectedAgent: string;
  isSending: boolean;
  onDraftChange: (value: string) => void;
  onAgentChange: (value: string) => void;
  onSend: () => void;
};

function messageText(message: MessageEnvelope) {
  return message.parts
    .map((part) => {
      if (typeof part.text === "string") return part.text;
      if (part.type) return `[${part.type}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function ChatPanel({
  messages,
  draft,
  selectedAgent,
  isSending,
  onDraftChange,
  onAgentChange,
  onSend,
}: ChatPanelProps) {
  const renderedMessages = useMemo(
    () => messages.map((message) => ({ ...message, body: messageText(message) })),
    [messages],
  );

  return (
    <section className="panel chat-panel">
      <div className="section-header">
        <div>
          <div className="eyebrow">Chat</div>
          <h2>会话控制台</h2>
        </div>
        <label className="agent-picker">
          <span>Agent</span>
          <select value={selectedAgent} onChange={(event) => onAgentChange(event.target.value)}>
            <option value="build">build</option>
            <option value="plan">plan</option>
          </select>
        </label>
      </div>

      <div className="message-stream">
        {renderedMessages.length === 0 ? (
          <div className="empty-state">选择一个 session，然后发出第一条任务指令。</div>
        ) : null}

        {renderedMessages.map((message) => (
          <article key={message.info.id} className={`message-bubble ${message.info.role || "assistant"}`}>
            <div className="message-role">{message.info.role || "assistant"}</div>
            <pre>{message.body || "[empty message]"}</pre>
          </article>
        ))}
      </div>

      <div className="composer">
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="比如：修复 auth middleware 的 bug，并解释修改原因。"
          rows={5}
        />
        <div className="composer-actions">
          <button type="button" className="primary-button" onClick={onSend} disabled={isSending || !draft.trim()}>
            {isSending ? "发送中..." : "发送任务"}
          </button>
        </div>
      </div>
    </section>
  );
}

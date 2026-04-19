import type { Session, SessionStatusMap } from "../types";

type SessionListProps = {
  sessions: Session[];
  statusMap: SessionStatusMap;
  selectedId: string | null;
  onSelect: (sessionId: string) => void;
  onCreate: () => void;
};

function formatUpdated(session: Session) {
  const updated = session.time?.updated || session.time?.created;
  if (!updated) return "Unknown update time";
  return new Date(updated).toLocaleString();
}

export function SessionList({
  sessions,
  statusMap,
  selectedId,
  onSelect,
  onCreate,
}: SessionListProps) {
  return (
    <section className="panel list-panel">
      <div className="section-header">
        <div>
          <div className="eyebrow">Sessions</div>
          <h2>工作会话</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onCreate}>
          新建
        </button>
      </div>

      <div className="session-list">
        {sessions.length === 0 ? (
          <div className="empty-state">还没有 session，先创建一个远程工作流。</div>
        ) : null}

        {sessions.map((session) => {
          const isSelected = selectedId === session.id;
          const status = statusMap[session.id] || "idle";
          return (
            <button
              key={session.id}
              type="button"
              className={`session-card ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(session.id)}
            >
              <div className="session-card-top">
                <strong>{session.title || "Untitled Session"}</strong>
                <span className={`status-pill ${status}`}>{status}</span>
              </div>
              <span className="session-meta">{session.id}</span>
              <span className="session-meta">{formatUpdated(session)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

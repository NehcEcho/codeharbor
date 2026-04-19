type ActivityPanelProps = {
  diffCount: number;
  events: string[];
  onRefreshDiff: () => void;
};

export function ActivityPanel({ diffCount, events, onRefreshDiff }: ActivityPanelProps) {
  return (
    <section className="panel activity-panel">
      <div className="section-header">
        <div>
          <div className="eyebrow">Activity</div>
          <h2>运行状态</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onRefreshDiff}>
          刷新 Diff
        </button>
      </div>

      <div className="metric-card">
        <span>未提交改动</span>
        <strong>{diffCount}</strong>
      </div>

      <div className="event-log">
        {events.length === 0 ? (
          <div className="empty-state">连接事件流后，这里会显示最新的运行日志。</div>
        ) : null}
        {events.map((event, index) => (
          <div key={`${event}-${index}`} className="event-item">
            {event}
          </div>
        ))}
      </div>
    </section>
  );
}

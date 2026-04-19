import { useState } from "react";
import type { ConnectionState, ServerConfig } from "../types";

type ConnectPanelProps = {
  value: ServerConfig;
  status: string;
  state: ConnectionState;
  isBusy: boolean;
  onChange: (next: ServerConfig) => void;
  onConnect: () => void;
};

export function ConnectPanel({
  value,
  status,
  state,
  isBusy,
  onChange,
  onConnect,
}: ConnectPanelProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <section className="panel hero-panel">
      <div className="eyebrow">OpenCode Remote</div>
      <h1>远程操控你的 OpenCode</h1>
      <p className="hero-copy">
        连接你局域网里的 OpenCode Server，在手机或浏览器里发起编码任务、继续会话并确认权限请求。
      </p>

      <div className="form-grid">
        <label>
          <span>Server URL</span>
          <input
            value={value.baseUrl}
            onChange={(event) => onChange({ ...value, baseUrl: event.target.value })}
            placeholder="http://192.168.1.10:4096"
          />
        </label>
        <label>
          <span>Username</span>
          <input
            value={value.username}
            onChange={(event) => onChange({ ...value, username: event.target.value })}
          />
        </label>
        <label>
          <span>Password</span>
          <div className="password-row">
            <input
              type={showPassword ? "text" : "password"}
              value={value.password}
              onChange={(event) => onChange({ ...value, password: event.target.value })}
            />
            <button
              type="button"
              className="ghost-button"
              onClick={() => setShowPassword((current) => !current)}
            >
              {showPassword ? "隐藏" : "显示"}
            </button>
          </div>
        </label>
      </div>

      <div className="hero-actions">
        <button className="primary-button" type="button" onClick={onConnect} disabled={isBusy}>
          {isBusy ? "连接中..." : "连接服务器"}
        </button>
        <p className={`status-copy status-${state}`}>{status}</p>
      </div>
    </section>
  );
}

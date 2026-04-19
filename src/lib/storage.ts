import type { ServerConfig } from "../types";

const STORAGE_KEY = "opencode-remote-config";

export function loadServerConfig(): ServerConfig {
  const fallback: ServerConfig = {
    baseUrl: "http://127.0.0.1:1656",
    username: "opencode",
    password: "",
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<ServerConfig>;
    return {
      baseUrl: parsed.baseUrl || fallback.baseUrl,
      username: parsed.username || fallback.username,
      password: parsed.password || fallback.password,
    };
  } catch {
    return fallback;
  }
}

export function saveServerConfig(config: ServerConfig) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

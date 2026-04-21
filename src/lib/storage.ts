import type { ServerConfig } from "../types";

const STORAGE_KEY = "opencode-remote-config";
const SESSION_MODEL_KEY = "opencode-session-model";

export function loadServerConfig(): ServerConfig {
  const fallback: ServerConfig = {
    baseUrl: "http://127.0.0.1:1656",
    username: "opencode",
    password: "",
    model: "",
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<Omit<ServerConfig, "model">>;
    return {
      baseUrl: parsed.baseUrl || fallback.baseUrl,
      username: parsed.username || fallback.username,
      password: parsed.password || fallback.password,
      model: fallback.model,
    };
  } catch {
    return fallback;
  }
}

export function saveServerConfig(config: ServerConfig) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      baseUrl: config.baseUrl,
      username: config.username,
      password: config.password,
    }),
  );
}

export function loadSessionModel() {
  try {
    return window.sessionStorage.getItem(SESSION_MODEL_KEY) || "";
  } catch {
    return "";
  }
}

export function saveSessionModel(model: string) {
  try {
    if (model) {
      window.sessionStorage.setItem(SESSION_MODEL_KEY, model);
      return;
    }

    window.sessionStorage.removeItem(SESSION_MODEL_KEY);
  } catch {
    // Ignore session storage failures and keep config in memory.
  }
}

import type { ServerConfig } from "../types";

const STORAGE_KEY = "opencode-remote-config";
const MODEL_STORAGE_KEY = "opencode-remote-model";

export function loadServerConfig(): ServerConfig {
  const fallback: ServerConfig = {
    baseUrl: "http://127.0.0.1:1656",
    username: "opencode",
    password: "",
    model: "",
  };

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const savedModel = window.sessionStorage.getItem(MODEL_STORAGE_KEY) || "";
    if (!raw) {
      return { ...fallback, model: savedModel };
    }
    const parsed = JSON.parse(raw) as Partial<Omit<ServerConfig, "model">>;
    return {
      baseUrl: parsed.baseUrl || fallback.baseUrl,
      username: parsed.username || fallback.username,
      password: parsed.password || fallback.password,
      model: savedModel,
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

  if (config.model) {
    window.sessionStorage.setItem(MODEL_STORAGE_KEY, config.model);
    return;
  }

  window.sessionStorage.removeItem(MODEL_STORAGE_KEY);
}

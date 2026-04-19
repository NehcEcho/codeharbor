import { useState } from "react";
import { motion } from "motion/react";
import type { ConnectionState, ServerConfig } from "../../../types";
import { AlertCircleIcon, GlobeIcon, LockIcon, ServerIcon, TerminalIcon } from "../ui/icons";

export function ConnectPage({
  config,
  status,
  state,
  isBusy,
  onChange,
  onConnect,
}: {
  config: ServerConfig;
  status: string;
  state: ConnectionState;
  isBusy: boolean;
  onChange: (next: ServerConfig) => void;
  onConnect: () => void;
}) {
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConnect();
  };

  return (
    <div className="flex-1 flex flex-col items-center justify-center min-h-full bg-[#FCFCFA] p-6 relative overflow-hidden">
      <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-stone-100/40 rounded-full blur-[100px] -z-10 animate-pulse mix-blend-multiply pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-amber-50/30 rounded-full blur-[80px] -z-10 animate-pulse pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-10 space-y-3">
          <div className="inline-flex bg-stone-900 text-white p-3 rounded-xl shadow-lg ring-1 ring-black/5 mx-auto mb-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-tr from-stone-800 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <TerminalIcon className="w-8 h-8 relative z-10" />
          </div>
          <h1 className="text-3xl font-serif tracking-tight text-stone-800 font-semibold">OpenCode Remote</h1>
          <p className="text-stone-500 text-[15px] font-medium leading-relaxed max-w-xs mx-auto">
            Connect to your local agent server to monitor and manage coding sessions.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-4">
            <div className="relative group">
              <label className="text-[13px] font-medium text-stone-500 mb-1.5 block">Server URL</label>
              <div className="relative">
                <GlobeIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
                <input
                  type="text"
                  value={config.baseUrl}
                  onChange={(e) => onChange({ ...config, baseUrl: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-400 transition-all text-stone-700 shadow-sm"
                  placeholder="http://192.168.1.10:4096"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="relative group">
                <label className="text-[13px] font-medium text-stone-500 mb-1.5 block">Username</label>
                <div className="relative">
                  <ServerIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
                  <input
                    type="text"
                    value={config.username}
                    onChange={(e) => onChange({ ...config, username: e.target.value })}
                    className="w-full pl-9 pr-3 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-400 transition-all text-stone-700 shadow-sm text-sm"
                    required
                  />
                </div>
              </div>

              <div className="relative group">
                <label className="text-[13px] font-medium text-stone-500 mb-1.5 block">Password</label>
                <div className="relative">
                  <LockIcon className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-stone-600 transition-colors" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={config.password}
                    onChange={(e) => onChange({ ...config, password: e.target.value })}
                    className="w-full pl-9 pr-14 py-3 bg-white border border-stone-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-stone-900/5 focus:border-stone-400 transition-all text-stone-700 shadow-sm text-sm"
                    required
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-stone-500 hover:text-stone-800 px-2 py-1"
                    onClick={() => setShowPassword((current) => !current)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {state === "error" ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="flex items-start gap-2 text-rose-600 bg-rose-50/50 p-3 rounded-lg border border-rose-100/50 text-sm"
            >
              <AlertCircleIcon className="w-5 h-5 shrink-0 mt-0.5 text-rose-500" />
              <p>{status}</p>
            </motion.div>
          ) : null}

          {state === "success" ? (
            <div className="text-sm text-emerald-700 bg-emerald-50/70 border border-emerald-100 rounded-lg p-3">{status}</div>
          ) : null}

          {state === "idle" && status !== "尚未连接" && status !== "正在连接 OpenCode Server..." ? (
            <div className="text-sm text-stone-500 bg-stone-50 border border-stone-200 rounded-lg p-3">{status}</div>
          ) : null}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full py-3.5 bg-stone-900 text-white rounded-xl font-medium shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_rgba(0,0,0,0.06)] hover:bg-stone-800 focus:outline-none focus:ring-4 focus:ring-stone-900/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:active:scale-100 flex items-center justify-center gap-2 mt-4"
          >
            {isBusy ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white/70" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Connecting...
              </>
            ) : (
              "Connect to Server"
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-stone-200/60 text-center">
          <p className="text-stone-400 text-xs">Recent connections are stored locally in your browser.</p>
        </div>
      </motion.div>
    </div>
  );
}

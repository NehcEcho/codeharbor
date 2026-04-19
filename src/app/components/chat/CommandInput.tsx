import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import {
  ArrowUpIcon,
  GlobeIcon,
  LightbulbIcon,
  PaperclipIcon,
  Settings2Icon,
  TerminalIcon,
  WrenchIcon,
} from "../ui/icons";

interface CommandInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  agent: "build" | "plan";
  onAgentChange: (agent: "build" | "plan") => void;
  serverLabel: string;
}

export function CommandInput({
  value,
  onChange,
  onSend,
  agent,
  onAgentChange,
  serverLabel,
}: CommandInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="relative w-full mx-auto">
      <div className="absolute -top-12 left-0 right-0 flex justify-center pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1.5 px-3 py-1.5 bg-white border border-stone-200/60 rounded-full shadow-sm text-xs font-medium text-stone-600 mb-3 backdrop-blur-md bg-white/80">
          <TerminalIcon className="w-3.5 h-3.5 text-emerald-500" />
          <span>Connected: {serverLabel || "OpenCode server"}</span>
        </div>
      </div>

      <div className="bg-white border border-stone-300 shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-2xl flex flex-col focus-within:ring-4 focus-within:ring-stone-900/5 focus-within:border-stone-400 transition-all overflow-visible relative z-20">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Message OpenCode ${agent === "build" ? "(Build Mode)" : "(Plan Mode)"}...`}
          className="w-full bg-transparent px-4 py-4 min-h-[56px] max-h-[200px] resize-none focus:outline-none text-[15px] text-stone-800 placeholder-stone-400 font-sans leading-relaxed"
          rows={1}
        />

        <div className="flex items-center justify-between px-3 pb-3">
          <div className="flex items-center gap-1">
            <button className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer active:scale-95" title="Attach file">
              <PaperclipIcon className="w-5 h-5" />
            </button>
            <div className="h-4 w-[1px] bg-stone-200 mx-1" />

            <div className="relative">
              <button
                onClick={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                  agent === "build"
                    ? "text-amber-700 bg-amber-50 hover:bg-amber-100"
                    : "text-blue-700 bg-blue-50 hover:bg-blue-100",
                )}
                type="button"
              >
                {agent === "build" ? <WrenchIcon className="w-4 h-4" /> : <LightbulbIcon className="w-4 h-4" />}
                {agent === "build" ? "Build" : "Plan"}
                <Settings2Icon className="w-3.5 h-3.5 opacity-60 ml-1" />
              </button>

              <AnimatePresence>
                {isAgentMenuOpen && (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-40"
                      onClick={() => setIsAgentMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      transition={{ type: "spring", duration: 0.3 }}
                      className="absolute bottom-full left-0 mb-2 w-52 bg-white border border-stone-200 rounded-xl shadow-xl z-50 p-1.5 overflow-hidden"
                    >
                      <button
                        onClick={() => {
                          onAgentChange("build");
                          setIsAgentMenuOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors",
                          agent === "build" ? "bg-stone-50" : "hover:bg-stone-50",
                        )}
                        type="button"
                      >
                        <div className="mt-0.5 bg-amber-100/50 p-1.5 rounded-md text-amber-600 border border-amber-200/50 shrink-0">
                          <WrenchIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-stone-900">Build Agent</div>
                          <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                            Executes terminal commands and edits files directly.
                          </div>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          onAgentChange("plan");
                          setIsAgentMenuOpen(false);
                        }}
                        className={clsx(
                          "w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors mt-1",
                          agent === "plan" ? "bg-stone-50" : "hover:bg-stone-50",
                        )}
                        type="button"
                      >
                        <div className="mt-0.5 bg-blue-100/50 p-1.5 rounded-md text-blue-600 border border-blue-200/50 shrink-0">
                          <LightbulbIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-stone-900">Plan Agent</div>
                          <div className="text-[11px] text-stone-500 leading-tight mt-0.5">
                            Analyzes context and proposes changes safely.
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>

          <button
            onClick={onSend}
            disabled={!value.trim()}
            className={clsx(
              "p-2 rounded-xl transition-all cursor-pointer flex items-center justify-center",
              value.trim()
                ? "bg-stone-900 text-white hover:bg-stone-800 shadow-sm active:scale-95"
                : "bg-stone-100 text-stone-400",
            )}
            type="button"
          >
            <ArrowUpIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="text-center mt-3 text-[11px] text-stone-400 font-medium tracking-wide flex items-center justify-center gap-1.5">
        <GlobeIcon className="w-3.5 h-3.5" />
        OpenCode can read and modify your local environment. Press
        <kbd className="font-sans px-1.5 py-0.5 bg-stone-100 rounded border border-stone-200 shadow-sm ml-0.5 text-stone-500">
          Enter
        </kbd>
        to send.
      </div>
    </div>
  );
}

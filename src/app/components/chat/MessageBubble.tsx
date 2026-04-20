import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { clsx } from "clsx";
import type { ChatMessage } from "../../../types";
import {
  AlertCircleIcon,
  BotIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  TerminalIcon,
  UserIcon,
} from "../ui/icons";

type ContentSection =
  | { type: "text"; value: string }
  | { type: "collapsible"; children: ContentSection[] };

function extractBody(message: ChatMessage) {
  if (message.role === "permission") return "";
  return message.parts
    .map((part) => {
      if (part.type === "tool") return "";
      if (typeof part.text === "string") return part.text;
      if (part.type) return `[${part.type}]`;
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

function splitContentSections(content: string): ContentSection[] {
  if (!content.trim()) return [];

  const startToken = "[step-start]";
  const endToken = "[step-finish]";
  const tokenPattern = /\[step-start\]|\[step-finish\]/g;
  const root: ContentSection[] = [];
  const sectionStack: ContentSection[][] = [root];
  let cursor = 0;

  const appendText = (value: string) => {
    if (!value.trim()) return;
    sectionStack[sectionStack.length - 1].push({ type: "text", value: value.trim() });
  };

  for (const match of content.matchAll(tokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    appendText(content.slice(cursor, index));

    if (token === startToken) {
      const section: ContentSection = { type: "collapsible", children: [] };
      sectionStack[sectionStack.length - 1].push(section);
      sectionStack.push(section.children);
    } else if (sectionStack.length > 1) {
      sectionStack.pop();
    } else {
      appendText(token);
    }

    cursor = index + token.length;
  }

  appendText(content.slice(cursor));

  while (sectionStack.length > 1) {
    const orphanChildren = sectionStack.pop();
    if (!orphanChildren) break;
    const parent = sectionStack[sectionStack.length - 1];
    const lastSection = parent[parent.length - 1];
    if (lastSection?.type === "collapsible" && lastSection.children === orphanChildren) {
      parent[parent.length - 1] = {
        type: "text",
        value: `${startToken}\n${flattenContentSections(orphanChildren)}`.trim(),
      };
    }
  }

  return root;
}

function flattenContentSections(sections: ContentSection[]): string {
  return sections
    .map((section) =>
      section.type === "text"
        ? section.value
        : `[step-start]\n${flattenContentSections(section.children)}\n[step-finish]`,
    )
    .join("\n\n")
    .trim();
}

function renderContentSections({
  sections,
  messageId,
  expandedContent,
  setExpandedContent,
  depth = 0,
  pathPrefix = "content",
}: {
  sections: ContentSection[];
  messageId: string;
  expandedContent: Record<string, boolean>;
  setExpandedContent: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  depth?: number;
  pathPrefix?: string;
}) {
  return sections.map((section, index) => {
    if (section.type === "text") {
      return (
        <div
          key={`${pathPrefix}-text-${index}`}
          className="text-[15px] text-stone-700 leading-relaxed font-sans max-w-none whitespace-pre-wrap"
        >
          {section.value}
        </div>
      );
    }

    const sectionId = `${messageId}-${pathPrefix}-${index}`;
    const isExpanded = expandedContent[sectionId] || false;

    return (
      <div
        key={sectionId}
        className={clsx(
          "rounded-xl border border-stone-200 overflow-hidden bg-stone-50/60",
          depth > 0 && "mt-3 ml-4",
        )}
      >
        <button
          onClick={() => setExpandedContent((current) => ({ ...current, [sectionId]: !isExpanded }))}
          className="w-full flex items-center gap-3 p-3 text-left hover:bg-stone-100/60 transition-colors"
          type="button"
        >
          <div className="text-stone-400">
            {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-stone-800">Step details</div>
            <div className="text-xs text-stone-500 mt-1">Nested step block</div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-stone-200 bg-white"
            >
              <div className="p-4 space-y-3">
                {renderContentSections({
                  sections: section.children,
                  messageId,
                  expandedContent,
                  setExpandedContent,
                  depth: depth + 1,
                  pathPrefix: `${pathPrefix}-${index}`,
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  });
}

function extractToolParts(message: ChatMessage) {
  return message.parts
    .filter((part) => part.type === "tool")
    .map((part, index) => {
      const state = part.state as
        | {
            status?: string;
            input?: { command?: string };
            output?: string;
            metadata?: { output?: string; description?: string };
            title?: string;
          }
        | undefined;

      return {
        id: part.id || `tool-${index}`,
        name: typeof part.tool === "string" ? part.tool : "tool",
        command:
          typeof state?.input?.command === "string"
            ? state.input.command
            : typeof state?.title === "string"
              ? state.title
              : typeof state?.metadata?.description === "string"
                ? state.metadata.description
                : "Tool execution",
        output:
          typeof state?.output === "string"
            ? state.output
            : typeof state?.metadata?.output === "string"
              ? state.metadata.output
              : "",
        status: state?.status || "pending",
      };
    });
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [expandedContent, setExpandedContent] = useState<Record<string, boolean>>({});
  const content = extractBody(message);
  const contentSections = splitContentSections(content);
  const toolParts = extractToolParts(message);
  const time = message.timestampLabel;

  return (
    <div className="flex gap-4 sm:gap-5 group">
      <div className="shrink-0 pt-0.5">
        {isUser ? (
          <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 text-stone-600">
            <UserIcon className="w-4 h-4" />
          </div>
        ) : (
          <div
            className={clsx(
              "w-8 h-8 rounded-full flex items-center justify-center border",
              isTool ? "bg-stone-800 text-white border-stone-900" : "bg-amber-100/50 text-amber-700 border-amber-200/50",
            )}
          >
            {isTool ? <TerminalIcon className="w-4 h-4" /> : <BotIcon className="w-4 h-4" />}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4 -mt-1 mb-2">
          <div className="font-semibold text-[15px] text-stone-900 flex items-center gap-2">
            {isUser ? "You" : isTool ? "Tool Execution" : "OpenCode"}
          </div>
          <span className="text-xs text-stone-400 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap hidden sm:inline-block">
            {time}
          </span>
        </div>

        {renderContentSections({
          sections: contentSections,
          messageId: message.id,
          expandedContent,
          setExpandedContent,
        })}

        {(isTool || toolParts.length > 0) &&
          toolParts.map((tool) => {
            const hasExplicitState = Object.prototype.hasOwnProperty.call(expandedTools, tool.id);
            const isExpanded = hasExplicitState ? expandedTools[tool.id] : tool.status === "running";
            const isCompleted = tool.status === "completed";
            const isRunning = tool.status === "running" || tool.status === "pending";

            return (
              <div key={tool.id} className="mt-2 rounded-xl border border-stone-200 overflow-hidden bg-stone-50/50">
                <button
                  onClick={() => setExpandedTools((current) => ({ ...current, [tool.id]: !isExpanded }))}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-stone-100/50 transition-colors group/btn focus:outline-none"
                  type="button"
                >
                  <div className="text-stone-400 group-hover/btn:text-stone-600 transition-colors">
                    {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-stone-700 truncate">$ {tool.command}</div>
                    <div className="text-xs text-stone-500 mt-1">Tool: {tool.name}</div>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    {isCompleted ? (
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <CheckCircleIcon className="w-3.5 h-3.5" /> Completed
                      </span>
                    ) : isRunning ? (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <AlertCircleIcon className="w-3.5 h-3.5" /> Running
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-rose-600 font-medium">
                        <AlertCircleIcon className="w-3.5 h-3.5" /> Attention
                      </span>
                    )}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-stone-200 bg-[#1A1A1A]"
                    >
                      <pre className="p-4 text-sm font-mono text-stone-300 overflow-x-auto m-0 leading-relaxed whitespace-pre-wrap">
                        <code>{tool.output || (isRunning ? "Waiting for tool output..." : "No tool output.")}</code>
                      </pre>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
      </div>
    </div>
  );
}

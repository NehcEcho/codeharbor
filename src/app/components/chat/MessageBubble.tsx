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

type TextSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language: string };

function formatCompactThousands(value: number) {
  const compact = value / 1000;

  if (compact >= 100) return `${compact.toFixed(0)}k`;
  if (compact >= 10) return `${compact.toFixed(1)}k`;
  return `${compact.toFixed(1)}k`;
}

function formatUsageSummary(message: ChatMessage) {
  if (!message.usage) return null;

  const totalContext = message.usage.contextInput + message.usage.cacheRead + message.usage.cacheWrite;
  const totalCache = message.usage.cacheRead + message.usage.cacheWrite;
  const parts = [`${formatCompactThousands(totalContext)} ctx`];

  if (totalCache > 0) {
    parts.push(`${formatCompactThousands(totalCache)} cache`);
  }

  if (message.usage.output > 0) {
    parts.push(`${formatCompactThousands(message.usage.output)} out`);
  }

  if (message.usage.reasoning > 0) {
    parts.push(`${formatCompactThousands(message.usage.reasoning)} think`);
  }

  return {
    compact: `${formatCompactThousands(totalContext)} ctx`,
    detail: parts.join(" · "),
  };
}

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

function parseTextSegments(content: string, allowOpenCodeBlock: boolean): TextSegment[] {
  if (!content.trim()) return [];

  const fencePattern = /```([^\n`]*)\n/g;
  const segments: TextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(content)) !== null) {
    const fenceStart = match.index;
    const blockStart = fencePattern.lastIndex;
    const closingFence = content.indexOf("\n```", blockStart);

    if (fenceStart > cursor) {
      segments.push({ type: "text", value: content.slice(cursor, fenceStart) });
    }

    if (closingFence >= 0) {
      segments.push({
        type: "code",
        language: match[1].trim(),
        value: content.slice(blockStart, closingFence),
      });
      cursor = closingFence + 4;
      fencePattern.lastIndex = cursor;
      continue;
    }

    if (allowOpenCodeBlock) {
      segments.push({
        type: "code",
        language: match[1].trim(),
        value: content.slice(blockStart),
      });
      cursor = content.length;
    } else {
      segments.push({ type: "text", value: content.slice(fenceStart) });
      cursor = content.length;
    }

    break;
  }

  if (cursor < content.length) {
    segments.push({ type: "text", value: content.slice(cursor) });
  }

  return segments.filter((segment) => segment.value.length > 0);
}

function renderTextSegments(content: string, allowOpenCodeBlock: boolean, highlightLastCodeBlock: boolean) {
  const segments = parseTextSegments(content, allowOpenCodeBlock);
  const lastCodeIndex = [...segments].reverse().findIndex((segment) => segment.type === "code");
  const lastCodeSegmentIndex = lastCodeIndex < 0 ? -1 : segments.length - 1 - lastCodeIndex;

  return segments.map((segment, index) => {
    if (segment.type === "code") {
      const isHighlightedCode = highlightLastCodeBlock && index === lastCodeSegmentIndex;

      return (
        <div
          key={`code-${index}`}
          className={clsx(
            "overflow-hidden rounded-xl border",
            isHighlightedCode ? "border-emerald-300 bg-[#1A1A1A] shadow-[0_0_0_1px_rgba(16,185,129,0.15)]" : "border-stone-200 bg-[#1A1A1A]",
          )}
        >
          {segment.language ? (
            <div className="border-b border-stone-800 bg-stone-950/40 px-4 py-2 text-[11px] font-mono uppercase tracking-wide text-stone-400">
              {segment.language}
            </div>
          ) : null}
          <pre className="m-0 overflow-x-auto p-4 text-sm leading-relaxed text-stone-200">
            <code>{segment.value}</code>
          </pre>
        </div>
      );
    }

    return (
      <div
        key={`text-${index}`}
        className="text-[15px] text-stone-700 leading-relaxed font-sans max-w-none whitespace-pre-wrap"
      >
        {segment.value}
      </div>
    );
  });
}

function renderContentSections({
  sections,
  messageId,
  expandedContent,
  setExpandedContent,
  allowOpenCodeBlock,
  highlightLastTopLevelCollapsible,
  depth = 0,
  pathPrefix = "content",
}: {
  sections: ContentSection[];
  messageId: string;
  expandedContent: Record<string, boolean>;
  setExpandedContent: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  allowOpenCodeBlock: boolean;
  highlightLastTopLevelCollapsible: boolean;
  depth?: number;
  pathPrefix?: string;
}) {
  return sections.map((section, index) => {
    if (section.type === "text") {
      const isLastTopLevelText = depth === 0 && index === sections.length - 1;
      return (
        <div key={`${pathPrefix}-text-${index}`} className="space-y-4">
          {renderTextSegments(section.value, allowOpenCodeBlock && isLastTopLevelText, allowOpenCodeBlock && isLastTopLevelText)}
        </div>
      );
    }

    const sectionId = `${messageId}-${pathPrefix}-${index}`;
    const isExpanded = expandedContent[sectionId] || false;
    const isHighlightedCollapsible = highlightLastTopLevelCollapsible && depth === 0 && index === sections.length - 1;

    return (
      <div
        key={sectionId}
        className={clsx(
          "rounded-xl border overflow-hidden",
          isHighlightedCollapsible
            ? "border-amber-200 bg-amber-50/70"
            : "border-stone-200 bg-stone-50/60",
          depth > 0 && "mt-3 ml-4",
        )}
      >
        <button
          onClick={() => setExpandedContent((current) => ({ ...current, [sectionId]: !isExpanded }))}
          className={clsx(
            "w-full flex items-center gap-3 p-3 text-left transition-colors",
            isHighlightedCollapsible ? "hover:bg-amber-100/70" : "hover:bg-stone-100/60",
          )}
          type="button"
        >
          <div className={clsx(isHighlightedCollapsible ? "text-amber-500" : "text-stone-400")}>
            {isExpanded ? <ChevronDownIcon className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className={clsx("text-sm font-medium", isHighlightedCollapsible ? "text-amber-900" : "text-stone-800")}>Step details</div>
              {isHighlightedCollapsible ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium tracking-normal text-emerald-700">
                  <CheckCircleIcon className="h-3 w-3" /> Last block
                </span>
              ) : null}
            </div>
            <div className={clsx("text-xs mt-1", isHighlightedCollapsible ? "text-amber-700" : "text-stone-500")}>Nested step block</div>
          </div>
        </button>

        <AnimatePresence initial={false}>
          {isExpanded ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={clsx(
                "border-t",
                isHighlightedCollapsible ? "border-amber-200 bg-amber-50/40" : "border-stone-200 bg-white",
              )}
            >
              <div className="p-4 space-y-3">
                {renderContentSections({
                  sections: section.children,
                  messageId,
                  expandedContent,
                  setExpandedContent,
                  allowOpenCodeBlock: false,
                  highlightLastTopLevelCollapsible: false,
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

export function MessageBubble({ message, isLatest = false }: { message: ChatMessage; isLatest?: boolean }) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [expandedContent, setExpandedContent] = useState<Record<string, boolean>>({});
  const content = extractBody(message);
  const contentSections = splitContentSections(content);
  const toolParts = extractToolParts(message);
  const time = message.timestampLabel;
  const usageSummary = !isUser && !isTool ? formatUsageSummary(message) : null;

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
            <div className="font-semibold text-[15px] text-stone-900 flex flex-wrap items-center gap-2">
              {isUser ? "You" : isTool ? "Tool Execution" : "OpenCode"}
              {message.deliveryError ? (
                <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                  Send failed
                </span>
              ) : null}
              {usageSummary ? (
                <span className="inline-flex sm:hidden items-center rounded-full border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-500">
                  {usageSummary.compact}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-400 whitespace-nowrap hidden sm:flex">
            {usageSummary ? <span>{usageSummary.detail}</span> : null}
            <span className="opacity-0 group-hover:opacity-100 transition-opacity">{time}</span>
          </div>
        </div>

        {renderContentSections({
          sections: contentSections,
          messageId: message.id,
          expandedContent,
          setExpandedContent,
          allowOpenCodeBlock: isLatest && !isUser && !isTool,
          highlightLastTopLevelCollapsible: isLatest && !isUser && !isTool,
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
        {message.deliveryError ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {message.deliveryError}
          </div>
        ) : null}
      </div>
    </div>
  );
}

import { useMemo, useState } from "react";
import { clsx } from "clsx";
import type { QuestionRequest } from "../../../types";
import { BotIcon, CheckIcon, XIcon } from "../ui/icons";

type AnswersMap = Record<number, string[]>;

export function QuestionCard({
  request,
  onReply,
  onReject,
}: {
  request: QuestionRequest;
  onReply: (answers: string[][]) => Promise<void>;
  onReject: () => Promise<void>;
}) {
  const [answers, setAnswers] = useState<AnswersMap>({});
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedAnswers = useMemo(
    () =>
      request.questions.map((item, index) => {
        const picked = answers[index] || [];
        const customValue = (customAnswers[index] || "").trim();

        if (!customValue) {
          return picked.filter(Boolean);
        }

        return picked.includes(customValue) ? picked.filter(Boolean) : [...picked.filter(Boolean), customValue];
      }),
    [answers, customAnswers, request.questions],
  );

  const isComplete = normalizedAnswers.every((item) => item.length > 0);

  const toggleAnswer = (questionIndex: number, label: string, multiple: boolean) => {
    setAnswers((current) => {
      const existing = current[questionIndex] || [];
      if (!multiple) {
        return { ...current, [questionIndex]: [label] };
      }

      return existing.includes(label)
        ? { ...current, [questionIndex]: existing.filter((item) => item !== label) }
        : { ...current, [questionIndex]: [...existing, label] };
    });
  };

  const handleCustomChange = (questionIndex: number, value: string, multiple: boolean) => {
    const trimmed = value.trim();
    setCustomAnswers((current) => ({ ...current, [questionIndex]: value }));

    if (!multiple) {
      setAnswers((current) => ({ ...current, [questionIndex]: trimmed ? [trimmed] : [] }));
    }
  };

  const handleReply = async () => {
    if (!isComplete || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onReply(normalizedAnswers);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onReject();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-stone-200/80 bg-white/95 shadow-[0_20px_50px_rgba(28,25,23,0.06)]">
      <div className="flex items-center gap-3 border-b border-stone-100 bg-gradient-to-r from-stone-50 via-white to-stone-50/60 px-4 py-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700 shadow-sm">
          <BotIcon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold tracking-tight text-stone-900">OpenCode 正在等待你的回答</div>
          <div className="mt-0.5 text-xs text-stone-500">{request.questions.length} 个问题</div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {request.questions.map((item, index) => {
          const picked = answers[index] || [];
          const customValue = customAnswers[index] || "";

          return (
            <div
              key={`${request.id}-${index}`}
              className="rounded-3xl border border-stone-200/80 bg-stone-50/70 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]"
            >
              <div className="break-words text-sm font-semibold text-stone-900">{item.header}</div>
              <div className="mt-1 text-sm leading-relaxed text-stone-600">{item.question}</div>
              <div className="mt-2 text-xs text-stone-500">{item.multiple ? "可多选" : "单选"}</div>

              <div className="mt-3 space-y-2">
                {item.options.map((option) => {
                  const selected = picked.includes(option.label);
                  return (
                    <button
                      key={option.label}
                      type="button"
                      onClick={() => toggleAnswer(index, option.label, item.multiple === true)}
                      className={clsx(
                        "w-full rounded-2xl border px-3 py-3 text-left transition-colors",
                        selected
                          ? "border-stone-900 bg-stone-900 text-white"
                          : "border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50",
                      )}
                    >
                      <div className="break-words text-sm font-medium">{option.label}</div>
                      <div className={clsx("mt-1 text-xs leading-relaxed", selected ? "text-stone-200" : "text-stone-500")}>
                        {option.description}
                      </div>
                    </button>
                  );
                })}
              </div>

              {item.custom !== false ? (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(event) => handleCustomChange(index, event.target.value, item.multiple === true)}
                    placeholder="输入你的答案..."
                    className="w-full rounded-2xl border border-stone-200 bg-white px-3 py-3 text-sm text-stone-700 shadow-sm outline-none transition-all focus:border-stone-400 focus:ring-4 focus:ring-stone-900/5"
                  />
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="flex flex-col gap-2 border-t border-stone-100 pt-3 sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => void handleReply()}
            disabled={!isComplete || isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-stone-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60 sm:flex-1"
          >
            <CheckIcon className="h-4 w-4" />
            提交回答
          </button>
          <button
            type="button"
            onClick={() => void handleReject()}
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium text-stone-700 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <XIcon className="h-4 w-4" />
            忽略
          </button>
        </div>
      </div>
    </div>
  );
}

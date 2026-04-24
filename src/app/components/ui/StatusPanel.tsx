import { BotIcon, ShieldAlertIcon } from "./icons";
import { PermissionCard } from "../chat/PermissionCard";
import { QuestionCard } from "../chat/QuestionCard";
import type { PermissionRequest, QuestionActionResult, QuestionRequest } from "../../../types";

export function StatusPanel({
  permissionRequests,
  questionRequests,
  respondingPermissionId,
  onPermissionAction,
  onQuestionReply,
  onQuestionReject,
}: {
  permissionRequests: PermissionRequest[];
  questionRequests: QuestionRequest[];
  respondingPermissionId?: string | null;
  onPermissionAction: (id: string, action: "once" | "always" | "reject") => Promise<void>;
  onQuestionReply: (id: string, answers: string[][]) => Promise<QuestionActionResult>;
  onQuestionReject: (id: string) => Promise<QuestionActionResult>;
}) {
  const totalCount = permissionRequests.length + questionRequests.length;
  const hasPendingActions = totalCount > 0;

  return (
    <div className="flex h-full flex-col bg-[linear-gradient(180deg,rgba(250,250,238,0.42),rgba(252,252,250,0.96))]">
      <div className="sticky top-0 z-10 shrink-0 border-b border-stone-200/60 bg-[#FAFAEE]/92 px-3 pb-3 pt-4 backdrop-blur-sm sm:px-4 sm:pb-4 sm:pt-5">
        <div className="rounded-3xl border border-stone-200/70 bg-white/80 px-4 py-4 shadow-[0_18px_50px_rgba(28,25,23,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="relative flex h-9 w-9 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-700 shadow-sm">
                  <ShieldAlertIcon className="h-4 w-4" />
                  {hasPendingActions ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" /> : null}
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold tracking-tight text-stone-900">
                    {hasPendingActions ? "Pending approvals and questions" : "Action queue"}
                  </h3>
                  <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
                    {hasPendingActions
                      ? "Review permission prompts and questions here before the active session proceeds."
                      : "Approvals, questions, and other interactive requests will appear here."}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-left shadow-sm sm:shrink-0 sm:text-right">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-stone-400">Open</div>
              <div className="mt-0.5 text-base font-semibold text-stone-900">{totalCount}</div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3 py-2.5">
              <div className="font-medium text-stone-500">Questions</div>
              <div className="mt-1 text-sm font-semibold text-stone-900">{questionRequests.length}</div>
            </div>
            <div className="rounded-2xl border border-stone-200/80 bg-stone-50/80 px-3 py-2.5">
              <div className="font-medium text-stone-500">Permissions</div>
              <div className="mt-1 text-sm font-semibold text-stone-900">{permissionRequests.length}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-3 pb-5 pt-3 sm:space-y-5 sm:px-4 sm:pb-6 sm:pt-4">
        {questionRequests.length === 0 && permissionRequests.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-stone-200 bg-white/80 px-6 py-10 text-center shadow-[0_20px_40px_rgba(28,25,23,0.04)]">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-stone-200 bg-stone-50 text-stone-500">
              <BotIcon className="h-5 w-5" />
            </div>
            <div className="mt-4 text-sm font-medium text-stone-700">Everything is clear</div>
            <div className="mt-1 text-sm leading-relaxed text-stone-500">
              No pending approvals or questions right now.
            </div>
          </div>
        ) : null}

        {questionRequests.map((request) => (
          <QuestionCard
            key={request.id}
            request={request}
            onReply={(answers) => onQuestionReply(request.id, answers)}
            onReject={() => onQuestionReject(request.id)}
          />
        ))}

        {questionRequests.length > 0 && permissionRequests.length > 0 ? (
          <div className="flex items-center gap-3 px-1 pt-1">
            <div className="h-px flex-1 bg-stone-200" />
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
              <BotIcon className="h-3.5 w-3.5" />
              Permissions
            </div>
            <div className="h-px flex-1 bg-stone-200" />
          </div>
        ) : null}

        {permissionRequests.map((request) => (
          <PermissionCard
            key={request.id}
            request={request}
            isResponding={respondingPermissionId === request.id}
            onAction={(action) => void onPermissionAction(request.id, action)}
          />
        ))}
      </div>
    </div>
  );
}

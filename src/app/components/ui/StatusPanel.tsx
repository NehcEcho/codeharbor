import { BotIcon, ShieldAlertIcon } from "./icons";
import { PermissionCard } from "../chat/PermissionCard";
import { QuestionCard } from "../chat/QuestionCard";
import type { PermissionRequest, QuestionRequest } from "../../../types";

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
  onQuestionReply: (id: string, answers: string[][]) => Promise<void>;
  onQuestionReject: (id: string) => Promise<void>;
}) {
  const totalCount = permissionRequests.length + questionRequests.length;
  const hasPendingActions = totalCount > 0;

  return (
    <div className="flex flex-col h-full bg-inherit">
      <div className="p-4 border-b border-stone-200/60 sticky top-0 bg-[#FAFAEE]/95 backdrop-blur-sm z-10 shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.01)] flex items-center justify-between">
        <div className="min-w-0">
          <h3 className={`font-semibold tracking-tight flex items-center gap-2 ${hasPendingActions ? "text-red-700" : "text-stone-900"}`}>
            <span className="relative flex items-center justify-center">
              <ShieldAlertIcon className={`w-4 h-4 ${hasPendingActions ? "text-red-600" : "text-amber-600"}`} />
              {hasPendingActions ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" /> : null}
            </span>
            {hasPendingActions ? "Pending approvals and questions" : "Action Queue"}
          </h3>
          <p className="mt-1 text-xs text-stone-500">
            {hasPendingActions ? "Review these before the session can fully continue." : "No items need confirmation right now."}
          </p>
        </div>
        <span className={`text-xs font-medium ${hasPendingActions ? "text-red-600" : "text-stone-400"}`}>{totalCount}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {questionRequests.length === 0 && permissionRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-400 text-center">
            No pending approvals or questions right now.
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
          <div className="flex items-center gap-2 px-1 pt-1 text-xs font-medium uppercase tracking-wide text-stone-400">
            <BotIcon className="h-3.5 w-3.5" />
            Permissions
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

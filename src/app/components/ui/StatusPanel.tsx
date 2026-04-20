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

  return (
    <div className="flex flex-col h-full bg-inherit">
      <div className="p-4 border-b border-stone-200/60 sticky top-0 bg-[#FAFAEE]/95 backdrop-blur-sm z-10 shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.01)] flex items-center justify-between">
        <h3 className="font-semibold text-stone-900 tracking-tight flex items-center gap-2">
          <ShieldAlertIcon className="w-4 h-4 text-amber-600" />
          Action Queue
        </h3>
        <span className="text-xs text-stone-400">{totalCount}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {questionRequests.length === 0 && permissionRequests.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-400 text-center">
            No pending questions or approvals right now.
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

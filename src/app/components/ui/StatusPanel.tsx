import { ShieldAlertIcon } from "./icons";
import { PermissionCard } from "../chat/PermissionCard";
import type { ChatMessage } from "../../../types";

export function StatusPanel({
  permissionMessages,
  onPermissionAction,
}: {
  permissionMessages: ChatMessage[];
  onPermissionAction: (id: string, action: "approved" | "denied") => void;
}) {
  return (
    <div className="flex flex-col h-full bg-inherit">
      <div className="p-4 border-b border-stone-200/60 sticky top-0 bg-[#FAFAEE]/95 backdrop-blur-sm z-10 shrink-0 shadow-[0_4px_10px_rgba(0,0,0,0.01)] flex items-center justify-between">
        <h3 className="font-semibold text-stone-900 tracking-tight flex items-center gap-2">
          <ShieldAlertIcon className="w-4 h-4 text-amber-600" />
          Permission Queue
        </h3>
        <span className="text-xs text-stone-400">{permissionMessages.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {permissionMessages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-400 text-center">
            No pending approvals right now.
          </div>
        ) : null}

        {permissionMessages.map((message) => (
          <PermissionCard
            key={message.id}
            message={message}
            onAction={(action) => onPermissionAction(message.id, action)}
          />
        ))}
      </div>
    </div>
  );
}

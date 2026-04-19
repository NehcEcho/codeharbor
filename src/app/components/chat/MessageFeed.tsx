import { AnimatePresence, motion } from "motion/react";
import { MessageBubble } from "./MessageBubble";
import { PermissionCard } from "./PermissionCard";
import type { ChatMessage } from "../../../types";

export function MessageFeed({
  messages,
  onPermissionAction,
}: {
  messages: ChatMessage[];
  onPermissionAction: (id: string, action: "approved" | "denied") => void;
}) {
  return (
    <div className="space-y-8 min-h-0">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            layout
          >
            {message.role === "permission" ? (
              <PermissionCard message={message} onAction={(action) => onPermissionAction(message.id, action)} />
            ) : (
              <MessageBubble message={message} />
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

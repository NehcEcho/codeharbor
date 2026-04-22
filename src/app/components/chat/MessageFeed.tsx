import { AnimatePresence, motion } from "motion/react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../../../types";

export function MessageFeed({
  messages,
}: {
  messages: ChatMessage[];
}) {
  const lastMessageId = [...messages].reverse().find((message) => message.role !== "permission")?.id;

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
            <MessageBubble message={message} isLatest={message.id === lastMessageId} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

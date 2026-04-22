import { memo, useMemo } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageBubble } from "./MessageBubble";
import type { ChatMessage } from "../../../types";

function MessageFeedComponent({
  messages,
}: {
  messages: ChatMessage[];
}) {
  const lastMessageId = useMemo(
    () => [...messages].reverse().find((message) => message.role !== "permission")?.id,
    [messages],
  );

  return (
    <div className="space-y-8 min-h-0">
      <AnimatePresence initial={false}>
        {messages.map((message) => (
          <motion.div
            key={message.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <MessageBubble message={message} isLatest={message.id === lastMessageId} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export const MessageFeed = memo(MessageFeedComponent);

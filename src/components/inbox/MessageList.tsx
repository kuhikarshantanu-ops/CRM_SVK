import React, { useEffect, useRef } from 'react';
import { Message } from '../../types/crm';
import MessageBubble from './MessageBubble';

interface MessageListProps {
  messages: Message[];
  loading: boolean;
  onRetryFailed?: (message: Message) => void;
}

export default function MessageList({
  messages,
  loading,
  onRetryFailed
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, messages[messages.length - 1]?.status]);

  if (loading) {
    return (
      <div className="flex-1 p-6 space-y-4 overflow-y-auto bg-slate-50/50">
        {[1, 2, 3].map((n) => (
          <div
            key={n}
            className={`h-16 w-2/3 rounded-lg bg-slate-200/70 animate-pulse ${
              n % 2 === 0 ? 'ml-auto' : ''
            }`}
          />
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-slate-50/50">
        <p className="text-sm font-medium text-slate-700">
          No messages in this conversation yet
        </p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Outbound messages are validated against the 24-hour Customer Care Window and dispatched via Cloud Functions.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
      {messages.map((msg) => (
        <MessageBubble
          key={msg.id}
          message={msg}
          onRetry={onRetryFailed}
        />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}

import React from 'react';
import { Message } from '../../types/crm';

interface MessageBubbleProps {
  message: Message;
  onRetry?: (message: Message) => void;
}

function formatMessageTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

export default function MessageBubble({ message, onRetry }: MessageBubbleProps) {
  const isOutgoing = message.direction === 'OUTGOING';

  const renderReceiptTicks = () => {
    if (!isOutgoing) return null;
    if (message.status === 'PENDING') {
      return <span className="font-mono text-slate-400">⏳ PENDING</span>;
    }
    if (message.status === 'SENT') {
      return <span className="font-mono text-slate-500">✓ SENT</span>;
    }
    if (message.status === 'DELIVERED') {
      return <span className="font-mono text-slate-600">✓✓ DELIVERED</span>;
    }
    if (message.status === 'READ') {
      return <span className="font-mono font-semibold text-emerald-700">✓✓ READ</span>;
    }
    if (message.status === 'FAILED') {
      return <span className="font-mono font-semibold text-red-600">✕ FAILED</span>;
    }
    return null;
  };

  return (
    <div
      className={`flex flex-col ${
        isOutgoing ? 'items-end' : 'items-start'
      } space-y-1`}
    >
      <div
        className={`max-w-xl rounded-lg px-4 py-2.5 border ${
          isOutgoing
            ? message.status === 'FAILED'
              ? 'bg-red-50/80 border-red-200 text-slate-900'
              : 'bg-emerald-50/70 border-emerald-200/80 text-slate-900'
            : 'bg-white border-slate-200 text-slate-900'
        }`}
      >
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1">
          <span className="font-medium text-slate-700">
            {isOutgoing ? 'Outbound Dispatch' : message.senderPhone}
          </span>
          <span aria-hidden="true">·</span>
          <span>{message.messageType}</span>
          {message.templateName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-emerald-800">
                HSM: {message.templateName}
              </span>
            </>
          )}
          {message.demo !== false && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-500">[DEMO SIMULATED]</span>
            </>
          )}
        </div>

        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
          {message.text}
        </p>

        {message.status === 'FAILED' && (
          <div className="mt-2 pt-2 border-t border-red-200/80 flex items-center justify-between gap-4 text-xs text-red-700">
            <span>
              {message.errorCode ? `[${message.errorCode}] ` : ''}
              {message.errorMessage || 'Delivery failed'}
            </span>
            {onRetry && (
              <button
                type="button"
                onClick={() => onRetry(message)}
                className="px-2.5 py-1 bg-white border border-red-300 rounded text-xs font-medium text-red-700 hover:bg-red-50 whitespace-nowrap"
              >
                Retry with Template
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-slate-500 px-1">
        <span className="font-mono tabular-nums">
          {formatMessageTime(message.createdAt)}
        </span>
        {message.externalMessageId && (
          <>
            <span aria-hidden="true">·</span>
            <span
              className="font-mono text-[10px] text-slate-400 truncate max-w-[180px]"
              title={message.externalMessageId}
            >
              {message.externalMessageId}
            </span>
          </>
        )}
        {isOutgoing && (
          <>
            <span aria-hidden="true">·</span>
            {renderReceiptTicks()}
          </>
        )}
      </div>
    </div>
  );
}

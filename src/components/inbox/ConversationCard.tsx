import React from 'react';
import { Conversation } from '../../types/crm';

interface ConversationCardProps {
  conversation: Conversation;
  selected: boolean;
  hasFailedMessage?: boolean;
  onClick: () => void;
}

function formatRelativeTime(timestamp: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export default function ConversationCard({
  conversation,
  selected,
  hasFailedMessage,
  onClick
}: ConversationCardProps) {
  const now = Date.now();
  const lastInbound = conversation.lastIncomingMessageAt || 0;
  const cswActive = lastInbound > 0 && now - lastInbound <= 24 * 60 * 60 * 1000;

  const crmLabel =
    conversation.crmRecordType === 'CONTACT'
      ? `Contact ${conversation.crmRecordId || ''}`
      : conversation.crmRecordType === 'LEAD'
      ? `Lead ${conversation.crmRecordId || ''}`
      : 'Unmatched';

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left px-4 py-3.5 border-b border-slate-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
        selected
          ? 'bg-slate-100/90 border-l-2 border-l-emerald-600'
          : 'bg-white hover:bg-slate-50'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-semibold text-sm text-slate-900 truncate">
          {conversation.customerName}
        </span>
        <span className="text-xs font-mono tabular-nums text-slate-500 shrink-0">
          {formatRelativeTime(conversation.lastMessageAt)}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 truncate">
        <span className="font-mono tabular-nums text-slate-600">
          {conversation.phoneNumber}
        </span>
        <span aria-hidden="true">·</span>
        <span
          className={
            conversation.crmRecordType === 'CONTACT'
              ? 'text-emerald-700 font-medium'
              : conversation.crmRecordType === 'LEAD'
              ? 'text-amber-700 font-medium'
              : 'text-slate-500'
          }
        >
          {crmLabel}
        </span>
        <span aria-hidden="true">·</span>
        <span className={cswActive ? 'text-emerald-700' : 'text-amber-700'}>
          {cswActive ? '24h Open' : 'CSW Expired'}
        </span>
      </div>

      <div className="mt-1.5 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-600 truncate">
          {conversation.lastMessageDirection === 'OUTGOING' ? 'You: ' : ''}
          {conversation.lastMessage}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          {hasFailedMessage && (
            <span className="text-xs font-medium text-red-600">
              Delivery Failed
            </span>
          )}
          {conversation.unreadCount > 0 && (
            <span className="text-xs font-mono tabular-nums font-semibold text-emerald-700">
              {conversation.unreadCount} unread
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

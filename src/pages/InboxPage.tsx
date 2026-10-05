import React, { useState, useEffect } from 'react';
import { useConversations } from '../hooks/useConversations';
import ConversationList from '../components/inbox/ConversationList';
import ChatArea from '../components/inbox/ChatArea';
import CustomerProfile from '../components/inbox/CustomerProfile';
import DemoSandboxModal from '../components/demo/DemoSandboxModal';

interface InboxPageProps {
  initialPhoneFilter?: string | null;
}

export default function InboxPage({ initialPhoneFilter }: InboxPageProps) {
  const { conversations, loading } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [showDemoSandbox, setShowDemoSandbox] = useState(false);

  useEffect(() => {
    if (conversations.length === 0) return;

    if (initialPhoneFilter) {
      const match = conversations.find(
        (c) =>
          c.phoneNumber === initialPhoneFilter ||
          c.normalizedPhoneNumber === initialPhoneFilter
      );
      if (match) {
        setSelectedConversationId(match.id);
        return;
      }
    }

    if (!selectedConversationId) {
      setSelectedConversationId(conversations[0].id);
    }
  }, [conversations, initialPhoneFilter, selectedConversationId]);

  const selectedConversation = conversations.find(
    (c) => c.id === selectedConversationId
  );

  return (
    <div className="flex flex-1 min-h-0 bg-slate-50 overflow-hidden">
      <div className="w-88 border-r border-slate-200 bg-white flex flex-col shrink-0">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Active Conversations
            </h2>
            <p className="text-[11px] text-slate-500 font-mono tabular-nums">
              {conversations.length} deterministic threads
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDemoSandbox(true)}
            className="px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-800 rounded border border-emerald-200 hover:bg-emerald-100 whitespace-nowrap"
          >
            Simulate Webhook
          </button>
        </div>
        <ConversationList
          conversations={conversations}
          selectedId={selectedConversationId}
          onSelect={setSelectedConversationId}
          loading={loading}
        />
      </div>

      {selectedConversation ? (
        <ChatArea conversation={selectedConversation} />
      ) : (
        <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
          <p>Select a conversation to start messaging</p>
        </div>
      )}

      {selectedConversation && (
        <CustomerProfile conversation={selectedConversation} />
      )}

      {showDemoSandbox && (
        <DemoSandboxModal onClose={() => setShowDemoSandbox(false)} />
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Conversation } from '../../types/crm';
import { useMessages } from '../../hooks/useMessages';
import { useAuth } from '../../context/AuthContext';
import { updateFirestoreDoc } from '../../lib/firebase';
import MessageList from './MessageList';
import MessageComposer from './MessageComposer';
import TemplateSelector from './TemplateSelector';

interface ChatAreaProps {
  conversation: Conversation;
}

export default function ChatArea({ conversation }: ChatAreaProps) {
  const { messages, loading } = useMessages(conversation.id);
  const { user } = useAuth();
  const [showRetryTemplate, setShowRetryTemplate] = useState(false);

  useEffect(() => {
    if (conversation.unreadCount > 0) {
      updateFirestoreDoc('conversations', conversation.id, {
        unreadCount: 0
      }).catch(() => {});
    }
  }, [conversation.id, conversation.unreadCount]);

  const dispatchMessage = async (payload: {
    messageType: 'TEXT' | 'TEMPLATE';
    text?: string;
    templateName?: string;
    templateLanguage?: string;
  }) => {
    const res = await fetch('/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user?.uid || 'usr_admin_01'}`
      },
      body: JSON.stringify({
        conversationId: conversation.id,
        ...payload
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        data.message || data.error || `HTTP ${res.status} Dispatch Failed`
      );
    }
    return data;
  };

  const handleSendText = async (text: string) => {
    await dispatchMessage({
      messageType: 'TEXT',
      text
    });
  };

  const handleSendTemplate = async (templateName: string, language: string) => {
    await dispatchMessage({
      messageType: 'TEMPLATE',
      templateName,
      templateLanguage: language
    });
  };

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-white">
      <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900 truncate">
              {conversation.customerName}
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
            <span className="font-mono tabular-nums text-slate-700">
              {conversation.phoneNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono text-slate-500">
              ID: {conversation.id}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-emerald-700">
              {conversation.crmRecordType === 'UNMATCHED'
                ? 'Vtiger Unmatched'
                : `Vtiger ${conversation.crmRecordType} (${conversation.crmRecordId})`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs text-slate-500">
          <span className="font-mono">[DEMO SIMULATED]</span>
        </div>
      </div>

      <MessageList
        messages={messages}
        loading={loading}
        onRetryFailed={() => setShowRetryTemplate(true)}
      />

      <MessageComposer
        conversationId={conversation.id}
        customerName={conversation.customerName}
        onSend={handleSendText}
        onSendTemplate={handleSendTemplate}
      />

      {showRetryTemplate && (
        <TemplateSelector
          customerName={conversation.customerName}
          onSelectTemplate={handleSendTemplate}
          onClose={() => setShowRetryTemplate(false)}
        />
      )}
    </div>
  );
}

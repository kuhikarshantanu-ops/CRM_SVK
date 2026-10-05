import React, { useState, useEffect } from 'react';
import { Conversation, Message } from '../../types/crm';
import ConversationCard from './ConversationCard';
import { Search } from 'lucide-react';
import { collection, db, onSnapshot } from '../../lib/firebase';

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
}

type FilterTab = 'ALL' | 'LEADS' | 'CONTACTS' | 'FAILED';

export default function ConversationList({
  conversations,
  selectedId,
  onSelect,
  loading
}: ConversationListProps) {
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [search, setSearch] = useState('');
  const [failedConvIds, setFailedConvIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'messages'), (snap) => {
      const failedSet = new Set<string>();
      snap.docs.forEach((d: any) => {
        const m = d.data() as Message;
        if (m.status === 'FAILED') {
          failedSet.add(m.conversationId);
        }
      });
      setFailedConvIds(failedSet);
    });
    return unsub;
  }, []);

  const filteredConversations = conversations.filter((c) => {
    if (filter === 'LEADS' && c.crmRecordType !== 'LEAD') return false;
    if (filter === 'CONTACTS' && c.crmRecordType !== 'CONTACT') return false;
    if (filter === 'FAILED' && !failedConvIds.has(c.id)) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchName = c.customerName.toLowerCase().includes(q);
      const matchPhone = c.phoneNumber.toLowerCase().includes(q);
      const matchCrm = (c.crmRecordId || '').toLowerCase().includes(q);
      const matchMsg = c.lastMessage.toLowerCase().includes(q);
      return matchName || matchPhone || matchCrm || matchMsg;
    }

    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 border-b border-slate-200 space-y-2.5 bg-slate-50/60">
        <div className="relative">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, +91 phone, or 12x ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
          />
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md">
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'CONTACTS', label: 'Contacts' },
              { id: 'LEADS', label: 'Leads' },
              { id: 'FAILED', label: 'Failed' }
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`flex-1 py-1 px-2 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
        {loading ? (
          <div className="p-4 space-y-3">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 bg-slate-100 animate-pulse rounded" />
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm font-medium text-slate-700">
              No conversations match filter
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Try clearing your search query or switching filter tabs.
            </p>
          </div>
        ) : (
          filteredConversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conversation={conv}
              selected={conv.id === selectedId}
              hasFailedMessage={failedConvIds.has(conv.id)}
              onClick={() => onSelect(conv.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

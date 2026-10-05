import { useEffect, useState } from 'react';
import { collection, db, onSnapshot } from '../lib/firebase';
import { Conversation } from '../types/crm';
import { useAuth } from '../context/AuthContext';

export function useConversations() {
  const { workspaceId } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'conversations'), (snap) => {
      const all = snap.docs
        .map((d: any) => d.data() as Conversation)
        .filter((c: Conversation) => c.workspaceId === workspaceId)
        .sort((a: Conversation, b: Conversation) => b.lastMessageAt - a.lastMessageAt);
      setConversations(all);
      setLoading(false);
    });
    return unsub;
  }, [workspaceId]);

  return { conversations, loading };
}

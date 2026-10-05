import { useEffect, useState } from 'react';
import { collection, db, onSnapshot } from '../lib/firebase';
import { Message } from '../types/crm';

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsub = onSnapshot(collection(db, 'messages'), (snap) => {
      const filtered = snap.docs
        .map((d: any) => d.data() as Message)
        .filter((m: Message) => m.conversationId === conversationId)
        .sort((a: Message, b: Message) => a.createdAt - b.createdAt);
      setMessages(filtered);
      setLoading(false);
    });

    return unsub;
  }, [conversationId]);

  return { messages, loading };
}

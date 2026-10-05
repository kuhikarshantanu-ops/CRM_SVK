import { useEffect, useState } from 'react';
import { db, doc as clientDoc, onSnapshot as clientOnSnapshot } from '../lib/firebase';
import { Conversation } from '../types/crm';

export function use24hWindow(conversationId: string) {
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!conversationId) return;

    const unsubscribe = clientOnSnapshot(
      clientDoc(db, 'conversations', conversationId),
      (snap) => {
        if (snap.exists()) {
          setConversation(snap.data() as Conversation);
        }
      }
    );

    return unsubscribe;
  }, [conversationId]);

  if (!conversation) {
    return {
      isInsideWindow: true,
      expiresIn: 0,
      isExpired: false,
      lastIncomingMessageAt: null
    };
  }

  const lastInbound = conversation.lastIncomingMessageAt || 0;
  const deltaMs = now - lastInbound;
  const windowMs = 24 * 60 * 60 * 1000;
  const isInsideWindow = lastInbound > 0 && deltaMs <= windowMs;
  const expiresIn = isInsideWindow ? Math.max(0, windowMs - deltaMs) : 0;

  return {
    isInsideWindow,
    expiresIn,
    isExpired: !isInsideWindow,
    lastIncomingMessageAt: conversation.lastIncomingMessageAt
  };
}

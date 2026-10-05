import { firestoreStore } from '../utils/firestoreEngine';

export async function cleanupStaleWebhooks(): Promise<{ deletedCount: number }> {
  const now = Date.now();
  const olderThan24h = now - 24 * 60 * 60 * 1000;

  const allEvents = firestoreStore.getAll('webhookEvents');
  const staleDocs = allEvents
    .filter((doc) => doc.processed === false && doc.receivedAt < olderThan24h)
    .slice(0, 100);

  staleDocs.forEach((doc) => {
    firestoreStore.deleteDoc('webhookEvents', doc.id);
  });

  return { deletedCount: staleDocs.length };
}

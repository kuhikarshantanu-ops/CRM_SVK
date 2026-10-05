import { firestoreStore } from '../utils/firestoreEngine';
import { WEBHOOK_LEASE_TTL_MS, MAX_REPROCESS_RETRIES } from '../webhooks/whatsapp';

export async function acquireWebhookLease(
  eventKey: string,
  workspaceId: string,
  type: 'MESSAGE' | 'STATUS',
  extra: Record<string, any> = {}
): Promise<{ acquired: boolean; alreadyProcessed: boolean }> {
  try {
    firestoreStore.createDoc('webhookEvents', eventKey, {
      id: eventKey,
      workspaceId,
      type,
      processed: false,
      processedAt: null,
      leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
      receivedAt: Date.now(),
      retryCount: 0,
      ...extra
    });
    return { acquired: true, alreadyProcessed: false };
  } catch (err: any) {
    if (err.code === 'ALREADY_EXISTS') {
      const existing = firestoreStore.getDoc('webhookEvents', eventKey);
      if (existing?.processed) {
        return { acquired: false, alreadyProcessed: true };
      }
      if (existing?.leaseUntil && Date.now() < existing.leaseUntil) {
        return { acquired: false, alreadyProcessed: false };
      }
      if (
        existing?.leaseUntil &&
        Date.now() >= existing.leaseUntil &&
        (existing?.retryCount || 0) < MAX_REPROCESS_RETRIES
      ) {
        firestoreStore.updateDoc('webhookEvents', eventKey, {
          leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
          retryCount: { __op: 'increment', by: 1 }
        });
        return { acquired: true, alreadyProcessed: false };
      }
      return { acquired: false, alreadyProcessed: false };
    }
    throw err;
  }
}

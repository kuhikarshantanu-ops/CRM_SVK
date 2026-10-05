import { firestoreStore } from '../utils/firestoreEngine';

const MAX_LIFECYCLE_RETRIES = 5;

export interface LifecycleQueueItem {
  id?: string;
  messageId: string;
  workspaceId: string;
  stage: number; // 0=SENT, 1=DELIVERED, 2=READ
  nextStageAt: number;
  createdAt?: number;
  retryCount: number;
  error?: string;
}

export async function scheduleDemoLifecycleTask(item: LifecycleQueueItem): Promise<void> {
  const docId = `lc_${item.messageId}_stage_${item.stage}_${Date.now()}`;
  const payload: LifecycleQueueItem = {
    ...item,
    id: docId,
    createdAt: Date.now()
  };

  firestoreStore.setDoc('messageLifecycleQueue', docId, payload);
  setImmediate(() => {
    processLifecycleDocument(docId).catch((e) =>
      console.error('Lifecycle trigger error:', e)
    );
  });
}

export async function processLifecycleDocument(docId: string): Promise<void> {
  const queueDoc = firestoreStore.getDoc('messageLifecycleQueue', docId) as
    | LifecycleQueueItem
    | undefined;
  if (!queueDoc) return;

  const { messageId, workspaceId, stage, nextStageAt, retryCount = 0 } = queueDoc;
  const now = Date.now();

  if (nextStageAt > now) {
    const delayMs = Math.min(nextStageAt - now, 30000);
    await new Promise((resolve) => setTimeout(resolve, delayMs));

    await scheduleDemoLifecycleTask({
      messageId,
      workspaceId,
      stage,
      nextStageAt,
      retryCount: retryCount + 1
    });

    firestoreStore.deleteDoc('messageLifecycleQueue', docId);
    return;
  }

  const stages = [
    { status: 'SENT', delayMs: 800, updateFields: { sentAt: Date.now() } },
    {
      status: 'DELIVERED',
      delayMs: 1200,
      updateFields: { deliveredAt: Date.now() }
    },
    { status: 'READ', delayMs: 1800, updateFields: { readAt: Date.now() } }
  ];

  if (stage < stages.length) {
    const nextStage = stages[stage];

    try {
      const msg = firestoreStore.getDoc('messages', messageId);
      if (!msg) {
        throw new Error(`Message ${messageId} not found`);
      }

      firestoreStore.updateDoc('messages', messageId, {
        status: nextStage.status,
        ...nextStage.updateFields,
        updatedAt: Date.now()
      });

      if (msg.externalMessageId) {
        const statusKey = `${workspaceId}_status_${msg.externalMessageId}_${nextStage.status}`;
        firestoreStore.setDoc('webhookEvents', statusKey, {
          id: statusKey,
          workspaceId,
          type: 'STATUS',
          processed: true,
          processedAt: Date.now(),
          leaseUntil: Date.now() + 300000,
          messageId: msg.externalMessageId,
          messageStatus: nextStage.status,
          error: null,
          receivedAt: Date.now(),
          retryCount: 0
        });
      }

      if (stage < stages.length - 1) {
        await scheduleDemoLifecycleTask({
          messageId,
          workspaceId,
          stage: stage + 1,
          nextStageAt: Date.now() + nextStage.delayMs,
          retryCount: 0
        });
      }
    } catch (err) {
      if (retryCount < MAX_LIFECYCLE_RETRIES) {
        await scheduleDemoLifecycleTask({
          messageId,
          workspaceId,
          stage,
          nextStageAt: Date.now() + 5000,
          retryCount: retryCount + 1,
          error: (err as Error).message
        });
      } else {
        console.error(
          `Message ${messageId} lifecycle update failed after ${MAX_LIFECYCLE_RETRIES} retries, giving up:`,
          err
        );
      }
    }
  }

  firestoreStore.deleteDoc('messageLifecycleQueue', docId);
}

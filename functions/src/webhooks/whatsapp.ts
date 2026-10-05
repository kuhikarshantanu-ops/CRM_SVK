import * as crypto from 'crypto';
import { z } from 'zod';
import { webhookPayloadSchema } from '../schemas/messages';
import {
  normalizePhoneNumber,
  buildDeterministicConversationId
} from '../services/phone';
import { VtigerClient } from '../integrations/vtiger/vtigerProvider';
import { demoVtigerProvider } from '../integrations/vtiger/demoVtigerProvider';
import { resolveWorkspaceFromMetaWebhook } from '../services/workspaceResolver';
import { firestoreStore } from '../utils/firestoreEngine';
import { CRMRecordType, MessageType } from '../../../src/types/crm';

export function timingSafeStringCompare(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return crypto.timingSafeEqual(aBuffer, bBuffer);
}

export function verifyMetaSignature(
  rawBody: Buffer | string,
  signature: string,
  appSecret: string
): boolean {
  const hmac = crypto.createHmac('sha256', appSecret);
  const computed = 'sha256=' + hmac.update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const compBuffer = Buffer.from(computed);

  if (sigBuffer.length !== compBuffer.length) return false;
  return crypto.timingSafeEqual(sigBuffer, compBuffer);
}

export const WEBHOOK_LEASE_TTL_MS = 5 * 60 * 1000;
export const MAX_REPROCESS_RETRIES = 10;

export async function handleWhatsAppWebhookRequest(req: any, res: any): Promise<void> {
  try {
    if (req.method === 'GET') {
      const mode = req.query['hub.mode'];
      const token = String(req.query['hub.verify_token'] || '');
      const challenge = req.query['hub.challenge'];
      const expectedToken =
        process.env.WHATSAPP_VERIFY_TOKEN || 'demo_token';

      if (mode === 'subscribe' && timingSafeStringCompare(token, expectedToken)) {
        res.status(200).send(challenge);
        return;
      }
      res.status(403).send('Forbidden');
      return;
    }

    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined;
    const appSecret = process.env.META_APP_SECRET;

    if (appSecret && signature) {
      const rawBody = req.rawBody || JSON.stringify(req.body);
      if (!rawBody) {
        res.status(400).send('Bad Request: Raw Body Missing');
        return;
      }

      if (!verifyMetaSignature(rawBody, signature, appSecret)) {
        res.status(401).send('Unauthorized');
        return;
      }
    }

    let payload: z.infer<typeof webhookPayloadSchema>;
    try {
      payload = webhookPayloadSchema.parse(req.body);
    } catch (validationErr) {
      res.status(400).json({
        error: 'Bad Request: Invalid Webhook Payload',
        details: validationErr
      });
      return;
    }

    if (payload.object !== 'whatsapp_business_account') {
      res.status(404).send('Not Found');
      return;
    }

    res.status(200).send('EVENT_RECEIVED');

    setImmediate(async () => {
      try {
        await processWebhookPayload(payload);
      } catch (err) {
        console.error('Webhook processing error:', err);
      }
    });
  } catch (err) {
    console.error('Webhook handler exception:', err);
    res.status(500).send('Internal Server Error');
  }
}

export async function processWebhookPayload(
  payload: z.infer<typeof webhookPayloadSchema>
): Promise<{
  processedMessages: number;
  deduplicatedMessages: number;
  processedStatuses: number;
  deduplicatedStatuses: number;
}> {
  let processedMessages = 0;
  let deduplicatedMessages = 0;
  let processedStatuses = 0;
  let deduplicatedStatuses = 0;

  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value;

      const workspace = await resolveWorkspaceFromMetaWebhook(
        value.metadata?.business_account_id || 'default'
      );

      if (!workspace) {
        console.warn('Webhook for unregistered workspace, ignoring');
        continue;
      }

      if (value.statuses && value.statuses.length > 0) {
        for (const st of value.statuses) {
          const res = await processStatusUpdate(workspace.workspaceId, st);
          if (res.deduplicated) deduplicatedStatuses++;
          else if (res.processed) processedStatuses++;
        }
      }

      if (value.messages && value.messages.length > 0) {
        for (const msg of value.messages) {
          const contactMeta = value.contacts?.[0];
          const res = await processIncomingMessage(
            workspace.workspaceId,
            msg,
            contactMeta
          );
          if (res.deduplicated) deduplicatedMessages++;
          else if (res.processed) processedMessages++;
        }
      }
    }
  }

  return {
    processedMessages,
    deduplicatedMessages,
    processedStatuses,
    deduplicatedStatuses
  };
}

export async function processIncomingMessage(
  workspaceId: string,
  msg: any,
  contactMeta: any
): Promise<{ processed: boolean; deduplicated: boolean; conversationId?: string; messageId?: string }> {
  const externalMessageId = msg.id;
  const eventKey = `${workspaceId}_${externalMessageId}`;

  try {
    firestoreStore.createDoc('webhookEvents', eventKey, {
      id: eventKey,
      workspaceId,
      type: 'MESSAGE',
      processed: false,
      processedAt: null,
      leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
      receivedAt: Date.now(),
      messageId: null,
      error: null,
      retryCount: 0
    });
  } catch (err: any) {
    if (err.code === 'ALREADY_EXISTS') {
      const data = firestoreStore.getDoc('webhookEvents', eventKey);

      if (data?.processed) {
        return { processed: false, deduplicated: true };
      }

      if (data?.leaseUntil && Date.now() < data.leaseUntil) {
        return { processed: false, deduplicated: true };
      }

      if (
        data?.leaseUntil &&
        Date.now() >= data.leaseUntil &&
        data?.retryCount < MAX_REPROCESS_RETRIES
      ) {
        firestoreStore.updateDoc('webhookEvents', eventKey, {
          leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
          retryCount: { __op: 'increment', by: 1 }
        });
      } else {
        return { processed: false, deduplicated: true };
      }
    } else {
      throw err;
    }
  }

  const timestampMs = msg.timestamp
    ? parseInt(String(msg.timestamp), 10) * (String(msg.timestamp).length <= 10 ? 1000 : 1)
    : Date.now();

  let extractedText = '';
  let messageType: MessageType = 'TEXT';

  if (msg.type === 'text') {
    extractedText = msg.text?.body || '';
  } else if (msg.type === 'interactive') {
    messageType = 'INTERACTIVE';
    extractedText =
      msg.interactive?.button_reply?.title ||
      msg.interactive?.list_reply?.title ||
      '[Interactive Response]';
  } else if (msg.type === 'button') {
    extractedText = msg.button?.text || '';
  } else if (['image', 'document', 'audio', 'video'].includes(msg.type)) {
    const msgType = msg.type.toUpperCase();
    messageType = (msgType === 'IMAGE' || msgType === 'DOCUMENT' ? msgType : 'TEXT') as MessageType;
    extractedText = msg[msg.type]?.caption || `[Incoming ${msgType}]`;
  } else {
    extractedText = `[Unsupported: ${msg.type || 'unknown'}]`;
  }

  const normalized = normalizePhoneNumber(msg.from);
  if (!normalized.isValid) {
    firestoreStore.updateDoc('webhookEvents', eventKey, {
      processed: false,
      error: `Invalid phone number: ${msg.from}`
    });
    return { processed: false, deduplicated: false };
  }

  const conversationId = buildDeterministicConversationId(workspaceId, normalized);

  let crmRecordId: string | null = null;
  let crmRecordType: CRMRecordType = 'UNMATCHED';
  let customerName = contactMeta?.profile?.name || normalized.nationalNumber;

  const useLiveVtiger = Boolean(
    process.env.VTIGER_BASE_URL &&
      process.env.VTIGER_ACCESS_KEY &&
      process.env.DEMO_MODE !== 'true'
  );

  const vtigerAdapter = useLiveVtiger
    ? new VtigerClient(
        process.env.VTIGER_BASE_URL!,
        process.env.VTIGER_USERNAME || 'admin',
        process.env.VTIGER_ACCESS_KEY!
      )
    : demoVtigerProvider;

  try {
    const match = await vtigerAdapter.findEntityByPhone(normalized.nationalNumber);
    if (match) {
      crmRecordId = match.compoundId;
      crmRecordType = match.moduleName === 'Contacts' ? 'CONTACT' : 'LEAD';
      customerName = match.fullName;
    } else if (msg.autoCreateLead !== false) {
      const profileName = contactMeta?.profile?.name || 'WhatsApp Prospect';
      const nameParts = profileName.trim().split(' ');
      const firstName = nameParts[0] || 'WhatsApp';
      const lastName = nameParts.slice(1).join(' ') || normalized.nationalNumber;

      const newLeadId = await vtigerAdapter.createLead({
        firstName,
        lastName,
        mobile: normalized.e164,
        source: 'WhatsApp'
      });
      crmRecordId = newLeadId;
      crmRecordType = 'LEAD';
      customerName = `${firstName} ${lastName}`.trim();
    }
  } catch (crmErr) {
    console.error('Vtiger resolution failed:', crmErr);
  }

  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    await firestoreStore.runTransaction(async (t) => {
      const convSnap = t.get('conversations', conversationId);

      if (!convSnap.exists) {
        t.set('conversations', conversationId, {
          id: conversationId,
          workspaceId,
          crmRecordId,
          crmRecordType,
          customerName,
          phoneNumber: normalized.e164,
          normalizedPhoneNumber: normalized.nationalNumber,
          assignedUserId: 'usr_admin_01',
          lastMessage: extractedText,
          lastMessageAt: timestampMs,
          lastIncomingMessageAt: timestampMs,
          lastMessageDirection: 'INCOMING' as const,
          unreadCount: 1,
          status: 'ACTIVE' as const,
          createdAt: Date.now(),
          updatedAt: Date.now()
        });
      } else {
        const existingConv = convSnap.data();
        t.update('conversations', conversationId, {
          crmRecordId: existingConv.crmRecordId || crmRecordId,
          crmRecordType:
            existingConv.crmRecordType !== 'UNMATCHED'
              ? existingConv.crmRecordType
              : crmRecordType,
          customerName:
            existingConv.customerName && existingConv.customerName !== existingConv.normalizedPhoneNumber
              ? existingConv.customerName
              : customerName,
          lastMessage: extractedText,
          lastMessageAt: timestampMs,
          lastIncomingMessageAt: timestampMs,
          lastMessageDirection: 'INCOMING' as const,
          unreadCount: { __op: 'increment', by: 1 },
          updatedAt: Date.now()
        });
      }

      t.set('messages', msgId, {
        id: msgId,
        workspaceId,
        conversationId,
        externalMessageId,
        direction: 'INCOMING' as const,
        messageType,
        text: extractedText,
        senderPhone: normalized.e164,
        recipientPhone: 'SYSTEM',
        status: 'DELIVERED' as const,
        retryCount: 0,
        sentAt: timestampMs,
        deliveredAt: timestampMs,
        readAt: null,
        failedAt: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        demo: !useLiveVtiger
      });

      t.update('webhookEvents', eventKey, {
        processed: true,
        processedAt: Date.now(),
        messageId: msgId,
        updatedAt: Date.now()
      });
    });

    return { processed: true, deduplicated: false, conversationId, messageId: msgId };
  } catch (txErr) {
    firestoreStore.updateDoc('webhookEvents', eventKey, {
      processed: false,
      leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
      error: (txErr as Error).message,
      retryCount: { __op: 'increment', by: 1 },
      updatedAt: Date.now()
    });
    throw txErr;
  }
}

export async function processStatusUpdate(
  workspaceId: string,
  st: any
): Promise<{ processed: boolean; deduplicated: boolean }> {
  const externalMessageId = st.id;
  const newStatus = String(st.status || '').toUpperCase();
  const timestampMs = st.timestamp
    ? parseInt(String(st.timestamp), 10) * (String(st.timestamp).length <= 10 ? 1000 : 1)
    : Date.now();

  const eventKey = `${workspaceId}_status_${externalMessageId}_${newStatus}`;

  try {
    firestoreStore.createDoc('webhookEvents', eventKey, {
      id: eventKey,
      workspaceId,
      type: 'STATUS',
      processed: false,
      processedAt: null,
      leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
      receivedAt: Date.now(),
      messageId: externalMessageId,
      messageStatus: newStatus,
      error: null,
      retryCount: 0
    });
  } catch (err: any) {
    if (err.code === 'ALREADY_EXISTS') {
      const data = firestoreStore.getDoc('webhookEvents', eventKey);

      if (data?.processed) {
        return { processed: false, deduplicated: true };
      }

      if (data?.leaseUntil && Date.now() < data.leaseUntil) {
        return { processed: false, deduplicated: true };
      }

      if (
        data?.leaseUntil &&
        Date.now() >= data.leaseUntil &&
        data?.retryCount < MAX_REPROCESS_RETRIES
      ) {
        firestoreStore.updateDoc('webhookEvents', eventKey, {
          leaseUntil: Date.now() + WEBHOOK_LEASE_TTL_MS,
          retryCount: { __op: 'increment', by: 1 }
        });
      } else {
        return { processed: false, deduplicated: true };
      }
    } else {
      throw err;
    }
  }

  const priority: Record<string, number> = {
    PENDING: 0,
    SENT: 1,
    DELIVERED: 2,
    READ: 3,
    FAILED: 99
  };

  const allMessages = firestoreStore.getAll('messages');
  const doc = allMessages.find(
    (m) => m.workspaceId === workspaceId && m.externalMessageId === externalMessageId
  );

  if (!doc) {
    firestoreStore.updateDoc('webhookEvents', eventKey, {
      processed: false,
      error: 'Message not found'
    });
    return { processed: false, deduplicated: false };
  }

  const currentStatus = doc.status;

  if (priority[currentStatus] >= priority[newStatus] && newStatus !== 'FAILED') {
    firestoreStore.updateDoc('webhookEvents', eventKey, {
      processed: true,
      processedAt: Date.now()
    });
    return { processed: true, deduplicated: false };
  }

  const updates: Record<string, any> = {
    status: newStatus,
    updatedAt: Date.now()
  };

  if (newStatus === 'SENT') updates.sentAt = timestampMs;
  if (newStatus === 'DELIVERED') updates.deliveredAt = timestampMs;
  if (newStatus === 'READ') updates.readAt = timestampMs;
  if (newStatus === 'FAILED') {
    updates.failedAt = timestampMs;
    updates.errorCode = st.errors?.[0]?.code || 'UNKNOWN';
    updates.errorMessage = st.errors?.[0]?.title || 'Delivery Failed';
  }

  firestoreStore.updateDoc('messages', doc.id, updates);

  firestoreStore.updateDoc('webhookEvents', eventKey, {
    processed: true,
    processedAt: Date.now()
  });

  return { processed: true, deduplicated: false };
}

import { z } from 'zod';
import { sendMessageRequestSchema } from '../schemas/messages';
import { rateLimiter } from '../services/rateLimiter';
import { circuitBreaker } from '../services/circuitBreaker';
import { resolveUserWorkspace } from '../services/workspaceResolver';
import { firestoreStore } from '../utils/firestoreEngine';
import { MetaWhatsAppProvider } from '../integrations/whatsapp/metaProvider';
import { demoWhatsAppProvider } from '../integrations/whatsapp/demoProvider';

export async function handleSendWhatsAppMessage(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        error: 'unauthenticated',
        message: 'Missing Bearer token'
      });
      return;
    }

    const token = authHeader.split('Bearer ')[1].trim();
    const userDoc = firestoreStore.getDoc('users', token);
    if (!userDoc || !userDoc.active) {
      res.status(401).json({
        error: 'unauthenticated',
        message: 'Invalid or inactive session token'
      });
      return;
    }

    let payload: z.infer<typeof sendMessageRequestSchema>;
    try {
      payload = sendMessageRequestSchema.parse(req.body);
    } catch (validationErr) {
      if (validationErr instanceof z.ZodError) {
        res.status(400).json({
          error: 'VALIDATION_ERROR',
          details: validationErr.issues
        });
        return;
      }
      throw validationErr;
    }

    const rateLimitKey = `user_${userDoc.uid}`;
    const isRateLimited = await rateLimiter.isLimited(rateLimitKey, 100, 60000);
    if (isRateLimited) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many messages. Max 100 per minute.',
        retryAfter: 60
      });
      return;
    }

    const workspace = await resolveUserWorkspace(userDoc.uid);
    if (!workspace) {
      res.status(404).json({
        error: 'not-found',
        message: 'Workspace not found'
      });
      return;
    }

    const conv = firestoreStore.getDoc('conversations', payload.conversationId);
    if (!conv || conv.workspaceId !== workspace.workspaceId) {
      res.status(404).json({
        error: 'not-found',
        message: 'Conversation not found'
      });
      return;
    }

    const now = Date.now();
    const lastInbound = conv.lastIncomingMessageAt || 0;
    const deltaMs = now - lastInbound;
    const isInsideWindow = lastInbound > 0 && deltaMs <= 24 * 60 * 60 * 1000;

    if (!isInsideWindow && payload.messageType === 'TEXT') {
      const windowExpiryTime =
        lastInbound > 0 ? lastInbound + 24 * 60 * 60 * 1000 : null;

      res.status(422).json({
        error: 'OUTSIDE_24H_WINDOW',
        message:
          'Cannot send TEXT outside 24-hour window. Use TEMPLATE to initiate.',
        lastIncomingMessageAt: lastInbound,
        currentTime: now,
        windowExpiryTime,
        secondsUntilExpired: Math.floor(deltaMs / 1000),
        suggestedAction: 'SELECT_TEMPLATE'
      });
      return;
    }

    let displayText = payload.text || '';
    if (payload.messageType === 'TEMPLATE') {
      const tpl = firestoreStore
        .getAll('templates')
        .find((t) => t.name === payload.templateName);
      if (tpl) {
        displayText = tpl.bodyText.replace('{{1}}', conv.customerName || 'Customer');
      } else {
        displayText = payload.text || `[Template: ${payload.templateName}]`;
      }
    }

    const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const isDemo =
      process.env.DEMO_MODE === 'true' || !process.env.WHATSAPP_ACCESS_TOKEN;

    const messageData = {
      id: msgId,
      workspaceId: workspace.workspaceId,
      conversationId: payload.conversationId,
      externalMessageId: null,
      direction: 'OUTGOING' as const,
      messageType: payload.messageType,
      text: displayText,
      senderPhone: 'SYSTEM',
      recipientPhone: conv.phoneNumber,
      senderUserId: userDoc.uid,
      status: 'PENDING' as const,
      templateName: payload.templateName || null,
      templateLanguage: payload.templateLanguage,
      errorCode: null,
      errorMessage: null,
      retryCount: payload.retryCount,
      sentAt: null,
      deliveredAt: null,
      readAt: null,
      failedAt: null,
      createdAt: now,
      updatedAt: now,
      demo: isDemo
    };

    firestoreStore.setDoc('messages', msgId, messageData);

    firestoreStore.updateDoc('conversations', payload.conversationId, {
      lastMessage: displayText,
      lastMessageAt: now,
      lastMessageDirection: 'OUTGOING',
      unreadCount: 0,
      updatedAt: now
    });

    try {
      await circuitBreaker.execute('whatsapp_send', async () => {
        if (isDemo) {
          await demoWhatsAppProvider.sendMessage({
            messageId: msgId,
            toPhoneNumber: conv.phoneNumber,
            messageType: payload.messageType,
            text: displayText,
            templateName: payload.templateName,
            templateLanguage: payload.templateLanguage,
            workspaceId: workspace.workspaceId,
            phoneNumberId: workspace.phoneNumberId
          });
        } else {
          const liveProvider = new MetaWhatsAppProvider(
            process.env.WHATSAPP_ACCESS_TOKEN!
          );
          await liveProvider.sendMessage({
            messageId: msgId,
            toPhoneNumber: conv.phoneNumber,
            messageType: payload.messageType,
            text: displayText,
            templateName: payload.templateName,
            templateLanguage: payload.templateLanguage,
            workspaceId: workspace.workspaceId,
            phoneNumberId: workspace.phoneNumberId
          });
        }
      });
    } catch (dispatchErr: any) {
      firestoreStore.updateDoc('messages', msgId, {
        status: 'FAILED',
        failedAt: Date.now(),
        errorCode: 'CIRCUIT_OR_DISPATCH_ERR',
        errorMessage: dispatchErr.message || 'Dispatch failed',
        updatedAt: Date.now()
      });
      res.status(503).json({
        error: 'DISPATCH_FAILED',
        message: dispatchErr.message
      });
      return;
    }

    res.status(200).json({
      success: true,
      messageId: msgId,
      status: 'PENDING',
      demo: isDemo,
      csw: {
        isInsideWindow,
        expiresIn: Math.max(0, 24 * 60 * 60 * 1000 - deltaMs)
      }
    });
  } catch (err: any) {
    console.error('sendWhatsAppMessage error:', err);
    res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'Server error'
    });
  }
}

import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  firestoreStore,
  CollectionName
} from './functions/src/utils/firestoreEngine';
import { handleWhatsAppWebhookRequest } from './functions/src/webhooks/whatsapp';
import { handleSendWhatsAppMessage } from './functions/src/api/messages';
import {
  handleSimulateInbound,
  handleCreateVtigerLeadForConversation,
  handleExpireWindowForDemo
} from './functions/src/api/demo';
import {
  handleSystemHealth,
  handleCircuitControl,
  handleRunTestSuite
} from './functions/src/api/health';
import { getMaskedIntegrationSummary } from './functions/src/config/environment';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(
    express.json({
      verify: (req: any, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );

  app.get('/api/webhooks/whatsapp', handleWhatsAppWebhookRequest);
  app.post('/api/webhooks/whatsapp', handleWhatsAppWebhookRequest);

  app.post('/api/messages/send', handleSendWhatsAppMessage);

  app.post('/api/demo/simulate-inbound', handleSimulateInbound);
  app.post('/api/demo/create-vtiger-lead', handleCreateVtigerLeadForConversation);
  app.post('/api/demo/toggle-csw', handleExpireWindowForDemo);

  app.get('/api/health', handleSystemHealth);
  app.post('/api/health/circuit', handleCircuitControl);
  app.post('/api/health/run-tests', handleRunTestSuite);

  const ALLOWED_COLLECTIONS: CollectionName[] = [
    'users',
    'conversations',
    'messages',
    'webhookEvents',
    'integrationSettings',
    'rateLimitBuckets',
    'circuitBreakerStates',
    'messageLifecycleQueue',
    'vtigerRecords',
    'templates',
    'auditLogs'
  ];

  app.get('/api/firestore/stream/:collection', (req, res) => {
    const col = req.params.collection as CollectionName;
    if (!ALLOWED_COLLECTIONS.includes(col)) {
      res.status(400).json({ error: 'Unknown collection' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders?.();

    const unsubscribe = firestoreStore.subscribe(col, (docs) => {
      const safeDocs =
        col === 'integrationSettings'
          ? docs.map((d) => getMaskedIntegrationSummary(d.workspaceId) || d)
          : docs;
      res.write(`data: ${JSON.stringify(safeDocs)}\n\n`);
    });

    req.on('close', () => {
      unsubscribe();
    });
  });

  app.get('/api/firestore/collection/:collection', (req, res) => {
    const col = req.params.collection as CollectionName;
    if (!ALLOWED_COLLECTIONS.includes(col)) {
      res.status(400).json({ error: 'Unknown collection' });
      return;
    }
    const docs = firestoreStore.getAll(col);
    const safeDocs =
      col === 'integrationSettings'
        ? docs.map((d) => getMaskedIntegrationSummary(d.workspaceId) || d)
        : docs;
    res.json({ docs: safeDocs });
  });

  app.patch('/api/firestore/doc/:collection/:id', (req, res) => {
    const col = req.params.collection as CollectionName;
    const id = req.params.id;
    const updates = req.body || {};

    if (col === 'messages') {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message:
          'firestore.rules violation: Messages are read-only for clients. Use /api/messages/send.'
      });
      return;
    }

    if (col === 'conversations') {
      const protectedFields = [
        'id',
        'workspaceId',
        'createdAt',
        'phoneNumber',
        'normalizedPhoneNumber',
        'lastIncomingMessageAt',
        'lastMessageAt',
        'lastMessageDirection'
      ];
      const attemptedProtected = Object.keys(updates).filter((k) =>
        protectedFields.includes(k)
      );
      if (attemptedProtected.length > 0) {
        res.status(403).json({
          error: 'PERMISSION_DENIED',
          message: `firestore.rules violation: Cannot mutate protected conversation fields: ${attemptedProtected.join(', ')}`
        });
        return;
      }
    }

    try {
      const existing = firestoreStore.getDoc(col, id);
      if (!existing) {
        firestoreStore.setDoc(col, id, { ...updates, id, updatedAt: Date.now() });
      } else {
        firestoreStore.updateDoc(col, id, { ...updates, updatedAt: Date.now() });
      }
      res.json({ success: true, doc: firestoreStore.getDoc(col, id) });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/firestore/doc/:collection', (req, res) => {
    const col = req.params.collection as CollectionName;
    if (col === 'messages' || col === 'webhookEvents') {
      res.status(403).json({
        error: 'PERMISSION_DENIED',
        message: 'Direct client creation prohibited by zero-trust firestore.rules'
      });
      return;
    }

    const data = req.body || {};
    const id = data.id || data.compoundId || `${col}_${Date.now()}`;
    firestoreStore.setDoc(col, id, {
      ...data,
      id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });
    res.json({ success: true, id, doc: firestoreStore.getDoc(col, id) });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Enterprise Vtiger WhatsApp CRM Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

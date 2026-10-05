import {
  UserProfile,
  Conversation,
  Message,
  WebhookEventRecord,
  IntegrationSettings,
  VtigerRecord,
  WhatsAppTemplate,
  CircuitStateRecord,
  RateLimitBucketRecord
} from '../../../src/types/crm';

type CollectionName =
  | 'users'
  | 'conversations'
  | 'messages'
  | 'webhookEvents'
  | 'integrationSettings'
  | 'rateLimitBuckets'
  | 'circuitBreakerStates'
  | 'messageLifecycleQueue'
  | 'vtigerRecords'
  | 'templates'
  | 'auditLogs';

type ListenerCallback = (docs: any[]) => void;

class TransactionalFirestoreStore {
  private collections: Map<CollectionName, Map<string, any>> = new Map();
  private listeners: Map<CollectionName, Set<ListenerCallback>> = new Map();

  constructor() {
    const names: CollectionName[] = [
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
    names.forEach((n) => {
      this.collections.set(n, new Map());
      this.listeners.set(n, new Set());
    });
    this.seedEnterpriseWorkspace();
  }

  public getCollectionMap(name: CollectionName): Map<string, any> {
    let col = this.collections.get(name);
    if (!col) {
      col = new Map();
      this.collections.set(name, col);
    }
    return col;
  }

  public getAll(name: CollectionName): any[] {
    return Array.from(this.getCollectionMap(name).values()).map((d) => ({ ...d }));
  }

  public getDoc(name: CollectionName, id: string): any | undefined {
    const item = this.getCollectionMap(name).get(id);
    return item ? { ...item } : undefined;
  }

  public setDoc(name: CollectionName, id: string, data: any): void {
    const col = this.getCollectionMap(name);
    col.set(id, { ...data, id: data.id || id });
    this.notify(name);
  }

  public createDoc(name: CollectionName, id: string, data: any): void {
    const col = this.getCollectionMap(name);
    if (col.has(id)) {
      const err: any = new Error(`Document ${name}/${id} already exists`);
      err.code = 'ALREADY_EXISTS';
      throw err;
    }
    col.set(id, { ...data, id: data.id || id });
    this.notify(name);
  }

  public updateDoc(name: CollectionName, id: string, updates: Record<string, any>): void {
    const col = this.getCollectionMap(name);
    const existing = col.get(id);
    if (!existing) {
      const err: any = new Error(`Document ${name}/${id} not found`);
      err.code = 'NOT_FOUND';
      throw err;
    }
    const next = { ...existing };
    for (const [k, v] of Object.entries(updates)) {
      if (v && typeof v === 'object' && v.__op === 'increment') {
        next[k] = (typeof next[k] === 'number' ? next[k] : 0) + v.by;
      } else {
        next[k] = v;
      }
    }
    col.set(id, next);
    this.notify(name);
  }

  public deleteDoc(name: CollectionName, id: string): void {
    const col = this.getCollectionMap(name);
    col.delete(id);
    this.notify(name);
  }

  public subscribe(name: CollectionName, cb: ListenerCallback): () => void {
    const set = this.listeners.get(name) || new Set();
    set.add(cb);
    this.listeners.set(name, set);
    cb(this.getAll(name));
    return () => {
      set.delete(cb);
    };
  }

  private notify(name: CollectionName): void {
    const set = this.listeners.get(name);
    if (!set) return;
    const docs = this.getAll(name);
    set.forEach((cb) => {
      try {
        cb(docs);
      } catch (e) {
        console.error('Store listener error:', e);
      }
    });
  }

  public async runTransaction<T>(
    updateFn: (tx: {
      get: (col: CollectionName, id: string) => { exists: boolean; data: () => any };
      set: (col: CollectionName, id: string, data: any) => void;
      update: (col: CollectionName, id: string, updates: Record<string, any>) => void;
      delete: (col: CollectionName, id: string) => void;
    }) => Promise<T>
  ): Promise<T> {
    const stagedOps: Array<() => void> = [];
    const tx = {
      get: (col: CollectionName, id: string) => {
        const d = this.getDoc(col, id);
        return {
          exists: Boolean(d),
          data: () => d
        };
      },
      set: (col: CollectionName, id: string, data: any) => {
        stagedOps.push(() => this.setDoc(col, id, data));
      },
      update: (col: CollectionName, id: string, updates: Record<string, any>) => {
        stagedOps.push(() => this.updateDoc(col, id, updates));
      },
      delete: (col: CollectionName, id: string) => {
        stagedOps.push(() => this.deleteDoc(col, id));
      }
    };

    const result = await updateFn(tx);
    stagedOps.forEach((op) => op());
    return result;
  }

  public seedEnterpriseWorkspace(): void {
    const now = Date.now();
    const workspaceId = 'ws_enterprise_hq';

    // 1. Users
    const users: UserProfile[] = [
      {
        uid: 'usr_admin_01',
        workspaceId,
        email: 'arjun.mehta@vtiger-enterprise.io',
        displayName: 'Arjun Mehta',
        role: 'ADMIN',
        active: true,
        createdAt: now - 30 * 86400000,
        updatedAt: now
      },
      {
        uid: 'usr_manager_02',
        workspaceId,
        email: 'priya.nair@vtiger-enterprise.io',
        displayName: 'Priya Nair',
        role: 'MANAGER',
        active: true,
        createdAt: now - 25 * 86400000,
        updatedAt: now
      },
      {
        uid: 'usr_agent_03',
        workspaceId,
        email: 'rohan.kapoor@vtiger-enterprise.io',
        displayName: 'Rohan Kapoor',
        role: 'AGENT',
        active: true,
        createdAt: now - 15 * 86400000,
        updatedAt: now
      }
    ];
    users.forEach((u) => this.setDoc('users', u.uid, u));

    // 2. Integration Settings
    const settings: IntegrationSettings = {
      workspaceId,
      metaBusinessAccountId: 'waba_994827164501',
      metaPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '9371872013',
      metaAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'demo',
      vtigerBaseUrl: process.env.VTIGER_BASE_URL || 'https://your-instance.vtiger.com',
      vtigerUsername: process.env.VTIGER_USERNAME || 'admin',
      vtigerAccessKey: process.env.VTIGER_ACCESS_KEY || 'demo_key',
      active: true,
      createdAt: now - 30 * 86400000,
      updatedAt: now
    };
    this.setDoc('integrationSettings', workspaceId, settings);

    // 3. Vtiger CRM Records (Contacts 12x... and Leads 10x...)
    const vtigerRecords: VtigerRecord[] = [
      {
        compoundId: '12x456',
        moduleId: '12',
        recordId: '456',
        moduleName: 'Contacts',
        firstName: 'Vikram',
        lastName: 'Deshmukh',
        fullName: 'Vikram Deshmukh',
        phone: '+919371872013',
        mobile: '9371872013',
        email: 'v.deshmukh@tata-logistics.in',
        company: 'Tata Supply Chain Systems',
        assignedUserId: '19x1',
        assignedUserName: 'Arjun Mehta',
        dealValue: 48500,
        notes: 'Enterprise SLA tier renewal in Q4. Prefers WhatsApp updates for shipment API webhooks.',
        createdAt: now - 14 * 86400000,
        updatedAt: now - 3600000
      },
      {
        compoundId: '10x789',
        moduleId: '10',
        recordId: '789',
        moduleName: 'Leads',
        firstName: 'Ananya',
        lastName: 'Krishnan',
        fullName: 'Ananya Krishnan',
        phone: '+919820451120',
        mobile: '9820451120',
        email: 'ananya@finverse-capital.com',
        company: 'Finverse Capital',
        leadStatus: 'Qualified',
        leadSource: 'WhatsApp',
        assignedUserId: '19x2',
        assignedUserName: 'Priya Nair',
        dealValue: 19200,
        notes: 'Inbound inquiry regarding multi-tenant WhatsApp Cloud API compliance and Vtiger VQL sync.',
        createdAt: now - 5 * 86400000,
        updatedAt: now - 7200000
      },
      {
        compoundId: '12x812',
        moduleId: '12',
        recordId: '812',
        moduleName: 'Contacts',
        firstName: 'Siddharth',
        lastName: 'Malhotra',
        fullName: 'Siddharth Malhotra',
        phone: '+919811223344',
        mobile: '9811223344',
        email: 'siddharth@cloudscale.io',
        company: 'CloudScale Infrastructure',
        assignedUserId: '19x3',
        assignedUserName: 'Rohan Kapoor',
        dealValue: 74000,
        notes: 'Customer Care Window expired 27h ago. Requires approved HSM template to re-engage.',
        createdAt: now - 20 * 86400000,
        updatedAt: now - 27 * 3600000
      },
      {
        compoundId: '10x904',
        moduleId: '10',
        recordId: '904',
        moduleName: 'Leads',
        firstName: 'Meera',
        lastName: 'Rajagopal',
        fullName: 'Meera Rajagopal',
        phone: '+919765432109',
        mobile: '9765432109',
        email: 'meera.r@medisync-health.org',
        company: 'MediSync Diagnostics',
        leadStatus: 'Contacted',
        leadSource: 'WhatsApp',
        assignedUserId: '19x1',
        assignedUserName: 'Arjun Mehta',
        dealValue: 31000,
        notes: 'Evaluating patient appointment reminders via Meta HSM templates.',
        createdAt: now - 3 * 86400000,
        updatedAt: now - 1800000
      }
    ];
    vtigerRecords.forEach((r) => this.setDoc('vtigerRecords', r.compoundId, r));

    // 4. Conversations
    const conv1Id = `conv_${workspaceId}_91_9371872013`;
    const conv2Id = `conv_${workspaceId}_91_9820451120`;
    const conv3Id = `conv_${workspaceId}_91_9811223344`;
    const conv4Id = `conv_${workspaceId}_91_9900112233`;

    const conversations: Conversation[] = [
      {
        id: conv1Id,
        workspaceId,
        crmRecordId: '12x456',
        crmRecordType: 'CONTACT',
        customerName: 'Vikram Deshmukh',
        phoneNumber: '+919371872013',
        normalizedPhoneNumber: '9371872013',
        assignedUserId: 'usr_admin_01',
        lastMessage: 'Can we confirm the webhook HMAC-SHA256 verification spec before Friday?',
        lastMessageAt: now - 22 * 60 * 1000,
        lastIncomingMessageAt: now - 22 * 60 * 1000,
        lastMessageDirection: 'INCOMING',
        unreadCount: 2,
        status: 'ACTIVE',
        createdAt: now - 7 * 86400000,
        updatedAt: now - 22 * 60 * 1000
      },
      {
        id: conv2Id,
        workspaceId,
        crmRecordId: '10x789',
        crmRecordType: 'LEAD',
        customerName: 'Ananya Krishnan',
        phoneNumber: '+919820451120',
        normalizedPhoneNumber: '9820451120',
        assignedUserId: 'usr_manager_02',
        lastMessage: 'We reviewed the Vtiger WebServices compound ID mapping. Ready for pilot.',
        lastMessageAt: now - 54 * 60 * 1000,
        lastIncomingMessageAt: now - 54 * 60 * 1000,
        lastMessageDirection: 'INCOMING',
        unreadCount: 1,
        status: 'ACTIVE',
        createdAt: now - 3 * 86400000,
        updatedAt: now - 54 * 60 * 1000
      },
      {
        id: conv3Id,
        workspaceId,
        crmRecordId: '12x812',
        crmRecordType: 'CONTACT',
        customerName: 'Siddharth Malhotra',
        phoneNumber: '+919811223344',
        normalizedPhoneNumber: '9811223344',
        assignedUserId: 'usr_agent_03',
        lastMessage: 'Please share the updated enterprise security audit PDF when ready.',
        lastMessageAt: now - 27 * 3600 * 1000,
        lastIncomingMessageAt: now - 27 * 3600 * 1000, // 27 hours ago -> CSW EXPIRED
        lastMessageDirection: 'INCOMING',
        unreadCount: 0,
        status: 'ACTIVE',
        createdAt: now - 12 * 86400000,
        updatedAt: now - 27 * 3600 * 1000
      },
      {
        id: conv4Id,
        workspaceId,
        crmRecordId: null,
        crmRecordType: 'UNMATCHED',
        customerName: 'Karanveer Oberoi',
        phoneNumber: '+919900112233',
        normalizedPhoneNumber: '9900112233',
        assignedUserId: null,
        lastMessage: 'Hello team, we need 40 agent seats for our Mumbai & Bengaluru ops centers.',
        lastMessageAt: now - 4 * 3600 * 1000,
        lastIncomingMessageAt: now - 4 * 3600 * 1000,
        lastMessageDirection: 'INCOMING',
        unreadCount: 1,
        status: 'ACTIVE',
        createdAt: now - 4 * 3600 * 1000,
        updatedAt: now - 4 * 3600 * 1000
      }
    ];
    conversations.forEach((c) => this.setDoc('conversations', c.id, c));

    // 5. Messages
    const messages: Message[] = [
      {
        id: 'msg_seed_101',
        workspaceId,
        conversationId: conv1Id,
        externalMessageId: 'wamid.HBgMOTE5MzcxODcyMDEzFQIAERgSRkM4N0I1RTlBMjBGNEMxAA==',
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'Hi Arjun, we are configuring our Meta Graph v21.0 webhook endpoint.',
        senderPhone: '+919371872013',
        recipientPhone: 'SYSTEM',
        status: 'DELIVERED',
        retryCount: 0,
        sentAt: now - 45 * 60 * 1000,
        deliveredAt: now - 45 * 60 * 1000,
        readAt: now - 40 * 60 * 1000,
        failedAt: null,
        createdAt: now - 45 * 60 * 1000,
        updatedAt: now - 40 * 60 * 1000,
        demo: true
      },
      {
        id: 'msg_seed_102',
        workspaceId,
        conversationId: conv1Id,
        externalMessageId: 'wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=',
        direction: 'OUTGOING',
        messageType: 'TEXT',
        text: 'Hello Vikram! Our receiver enforces timingSafeEqual HMAC-SHA256 validation on rawBody and atomic idempotency keys.',
        senderPhone: 'SYSTEM',
        recipientPhone: '+919371872013',
        senderUserId: 'usr_admin_01',
        status: 'READ',
        retryCount: 0,
        sentAt: now - 35 * 60 * 1000,
        deliveredAt: now - 35 * 60 * 1000 + 800,
        readAt: now - 34 * 60 * 1000,
        failedAt: null,
        createdAt: now - 35 * 60 * 1000,
        updatedAt: now - 34 * 60 * 1000,
        demo: true
      },
      {
        id: 'msg_seed_103',
        workspaceId,
        conversationId: conv1Id,
        externalMessageId: 'wamid.HBgMOTE5MzcxODcyMDEzFQIAERgSOUUxRjJBM0I0QzVENkU3RgA=',
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'Can we confirm the webhook HMAC-SHA256 verification spec before Friday?',
        senderPhone: '+919371872013',
        recipientPhone: 'SYSTEM',
        status: 'DELIVERED',
        retryCount: 0,
        sentAt: now - 22 * 60 * 1000,
        deliveredAt: now - 22 * 60 * 1000,
        readAt: null,
        failedAt: null,
        createdAt: now - 22 * 60 * 1000,
        updatedAt: now - 22 * 60 * 1000,
        demo: true
      },
      {
        id: 'msg_seed_201',
        workspaceId,
        conversationId: conv2Id,
        externalMessageId: 'wamid.HBgMOTE5ODIwNDUxMTIwFQIAERgSMUEyQjNDNEQ1RTZGN0E4QgA=',
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'We reviewed the Vtiger WebServices compound ID mapping. Ready for pilot.',
        senderPhone: '+919820451120',
        recipientPhone: 'SYSTEM',
        status: 'DELIVERED',
        retryCount: 0,
        sentAt: now - 54 * 60 * 1000,
        deliveredAt: now - 54 * 60 * 1000,
        readAt: null,
        failedAt: null,
        createdAt: now - 54 * 60 * 1000,
        updatedAt: now - 54 * 60 * 1000,
        demo: true
      },
      {
        id: 'msg_seed_301',
        workspaceId,
        conversationId: conv3Id,
        externalMessageId: 'wamid.HBgMOTE5ODExMjIzMzQ0FQIAERgSNUY2RjdIOUk5SjBLMUwyTQA=',
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'Please share the updated enterprise security audit PDF when ready.',
        senderPhone: '+919811223344',
        recipientPhone: 'SYSTEM',
        status: 'DELIVERED',
        retryCount: 0,
        sentAt: now - 27 * 3600 * 1000,
        deliveredAt: now - 27 * 3600 * 1000,
        readAt: now - 26 * 3600 * 1000,
        failedAt: null,
        createdAt: now - 27 * 3600 * 1000,
        updatedAt: now - 26 * 3600 * 1000,
        demo: true
      },
      {
        id: 'msg_seed_302',
        workspaceId,
        conversationId: conv3Id,
        externalMessageId: null,
        direction: 'OUTGOING',
        messageType: 'TEXT',
        text: 'Hi Siddharth, following up on the audit report.',
        senderPhone: 'SYSTEM',
        recipientPhone: '+919811223344',
        senderUserId: 'usr_agent_03',
        status: 'FAILED',
        errorCode: '131047',
        errorMessage: 'Re-engagement message failed: 24h Customer Care Window expired',
        retryCount: 1,
        sentAt: null,
        deliveredAt: null,
        readAt: null,
        failedAt: now - 2 * 3600 * 1000,
        createdAt: now - 2 * 3600 * 1000,
        updatedAt: now - 2 * 3600 * 1000,
        demo: true
      },
      {
        id: 'msg_seed_401',
        workspaceId,
        conversationId: conv4Id,
        externalMessageId: 'wamid.HBgMOTE5OTAwMTEyMjMzFQIAERgSOFA5UTBSMVMydDNVNFY1VwA=',
        direction: 'INCOMING',
        messageType: 'TEXT',
        text: 'Hello team, we need 40 agent seats for our Mumbai & Bengaluru ops centers.',
        senderPhone: '+919900112233',
        recipientPhone: 'SYSTEM',
        status: 'DELIVERED',
        retryCount: 0,
        sentAt: now - 4 * 3600 * 1000,
        deliveredAt: now - 4 * 3600 * 1000,
        readAt: null,
        failedAt: null,
        createdAt: now - 4 * 3600 * 1000,
        updatedAt: now - 4 * 3600 * 1000,
        demo: true
      }
    ];
    messages.forEach((m) => this.setDoc('messages', m.id, m));

    // 6. Webhook Events
    const webhookEvents: WebhookEventRecord[] = [
      {
        id: `${workspaceId}_wamid.HBgMOTE5MzcxODcyMDEzFQIAERgSOUUxRjJBM0I0QzVENkU3RgA=`,
        workspaceId,
        type: 'MESSAGE',
        processed: true,
        processedAt: now - 22 * 60 * 1000 + 45,
        leaseUntil: now - 17 * 60 * 1000,
        messageId: 'msg_seed_103',
        receivedAt: now - 22 * 60 * 1000,
        retryCount: 0
      },
      {
        id: `${workspaceId}_status_wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=_SENT`,
        workspaceId,
        type: 'STATUS',
        processed: true,
        processedAt: now - 35 * 60 * 1000 + 120,
        leaseUntil: now - 30 * 60 * 1000,
        messageId: 'wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=',
        messageStatus: 'SENT',
        receivedAt: now - 35 * 60 * 1000 + 100,
        retryCount: 0
      },
      {
        id: `${workspaceId}_status_wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=_DELIVERED`,
        workspaceId,
        type: 'STATUS',
        processed: true,
        processedAt: now - 35 * 60 * 1000 + 820,
        leaseUntil: now - 30 * 60 * 1000,
        messageId: 'wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=',
        messageStatus: 'DELIVERED',
        receivedAt: now - 35 * 60 * 1000 + 800,
        retryCount: 0
      },
      {
        id: `${workspaceId}_status_wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=_READ`,
        workspaceId,
        type: 'STATUS',
        processed: true,
        processedAt: now - 34 * 60 * 1000 + 30,
        leaseUntil: now - 29 * 60 * 1000,
        messageId: 'wamid.HBgMOTE5MzcxODcyMDEzFQIAGBgSN0E5QjJDMUQ0RTZGN0E4QgA=',
        messageStatus: 'READ',
        receivedAt: now - 34 * 60 * 1000,
        retryCount: 0
      }
    ];
    webhookEvents.forEach((e) => this.setDoc('webhookEvents', e.id, e));

    // 7. Approved Meta HSM Templates
    const templates: WhatsAppTemplate[] = [
      {
        id: 'tpl_01',
        name: 'enterprise_session_reopen',
        language: 'en',
        category: 'UTILITY',
        status: 'APPROVED',
        headerText: 'Vtiger Enterprise Support',
        bodyText: 'Hello {{1}}, we have an update regarding your open request with our engineering team. Reply to this message to resume our live conversation.',
        footerText: 'Reply STOP to opt out',
        variables: ['customer_name'],
        updatedAt: now - 10 * 86400000
      },
      {
        id: 'tpl_02',
        name: 'sla_audit_report_ready',
        language: 'en',
        category: 'UTILITY',
        status: 'APPROVED',
        headerText: 'Compliance & Security Documentation',
        bodyText: 'Hi {{1}}, your requested SOC2 & Zero-Trust WhatsApp CRM integration dossier is ready for review. Please reply YES to receive the secure link.',
        footerText: 'Vtiger Enterprise Security',
        variables: ['customer_name'],
        updatedAt: now - 8 * 86400000
      },
      {
        id: 'tpl_03',
        name: 'deployment_milestone_check',
        language: 'en',
        category: 'MARKETING',
        status: 'APPROVED',
        headerText: 'Production Rollout',
        bodyText: 'Greetings {{1}}, your workspace webhook verification and Vtiger VQL sync passed all pre-flight checks. Let us know when you would like to schedule cutover.',
        footerText: 'Enterprise Onboarding',
        variables: ['customer_name'],
        updatedAt: now - 5 * 86400000
      },
      {
        id: 'tpl_04',
        name: 'invoice_payment_confirmation',
        language: 'en',
        category: 'UTILITY',
        status: 'APPROVED',
        headerText: 'Billing & Subscriptions',
        bodyText: 'Thank you {{1}}. We have confirmed receipt of your enterprise annual license payment. Your multi-tenant rate limits have been upgraded.',
        footerText: 'Vtiger Finance Ops',
        variables: ['customer_name'],
        updatedAt: now - 15 * 86400000
      }
    ];
    templates.forEach((t) => this.setDoc('templates', t.id, t));

    // 8. Circuit Breakers
    const breakers: CircuitStateRecord[] = [
      {
        name: 'whatsapp_send',
        status: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0
      },
      {
        name: 'vtiger_webservice',
        status: 'CLOSED',
        failureCount: 0,
        lastFailureTime: 0
      }
    ];
    breakers.forEach((b) => this.setDoc('circuitBreakerStates', b.name, b));
  }
}

export const firestoreStore = new TransactionalFirestoreStore();
export type { CollectionName };

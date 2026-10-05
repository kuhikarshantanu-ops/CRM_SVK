export type UserRole = 'ADMIN' | 'MANAGER' | 'AGENT';

export interface UserProfile {
  uid: string;
  workspaceId: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export type CRMRecordType = 'CONTACT' | 'LEAD' | 'UNMATCHED';

export interface Conversation {
  id: string; // conv_{workspaceId}_{countryCode}_{nationalNumber}
  workspaceId: string;
  crmRecordId: string | null; // Vtiger Compound ID: "12x456" (Contacts) or "10x789" (Leads)
  crmRecordType: CRMRecordType;
  customerName: string;
  phoneNumber: string; // E.164: "+919371872013"
  normalizedPhoneNumber: string; // 10-digit: "9371872013"
  assignedUserId: string | null;
  lastMessage: string;
  lastMessageAt: number; // Milliseconds UTC
  lastIncomingMessageAt: number | null; // Crucial for 24h CSW tracking
  lastMessageDirection: 'INCOMING' | 'OUTGOING';
  unreadCount: number;
  status: 'ACTIVE' | 'ARCHIVED' | 'BLOCKED';
  createdAt: number;
  updatedAt: number;
}

export type MessageStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type MessageDirection = 'INCOMING' | 'OUTGOING';
export type MessageType = 'TEXT' | 'TEMPLATE' | 'IMAGE' | 'DOCUMENT' | 'INTERACTIVE';

export interface Message {
  id: string;
  workspaceId: string;
  conversationId: string;
  externalMessageId: string | null; // Meta wamid.HBg...
  direction: MessageDirection;
  messageType: MessageType;
  text: string;
  senderPhone: string;
  recipientPhone: string;
  senderUserId?: string; // Captured on OUTGOING
  status: MessageStatus;
  templateName?: string | null;
  templateLanguage?: string;
  errorCode?: string | null;
  errorMessage?: string | null;
  retryCount: number;
  sentAt: number | null;
  deliveredAt: number | null;
  readAt: number | null;
  failedAt: number | null;
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export interface WebhookEventRecord {
  id: string; // {workspaceId}_{eventId}_{status?}
  workspaceId: string;
  type: 'MESSAGE' | 'STATUS';
  processed: boolean;
  processedAt: number | null;
  leaseUntil: number; // Lease expiry for crash recovery
  messageId?: string | null;
  messageStatus?: string; // For STATUS updates
  error?: string | null;
  receivedAt: number;
  retryCount: number;
  updatedAt?: number;
}

export interface IntegrationSettings {
  workspaceId: string;
  metaBusinessAccountId: string;
  metaPhoneNumberId: string;
  metaAccessToken: string; // Encrypted at rest in Firestore
  vtigerBaseUrl: string;
  vtigerUsername: string;
  vtigerAccessKey: string; // Encrypted at rest
  active: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface VtigerRecord {
  compoundId: string; // "12x456" or "10x789"
  moduleId: string;   // "12" (Contacts) or "10" (Leads)
  recordId: string;
  moduleName: 'Contacts' | 'Leads';
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string;
  mobile: string;
  email: string;
  company?: string;
  leadStatus?: 'New' | 'Contacted' | 'Qualified' | 'Converted' | 'Lost';
  leadSource?: string;
  assignedUserId: string;
  assignedUserName: string;
  dealValue?: number;
  notes?: string;
  createdAt: number;
  updatedAt: number;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  language: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  bodyText: string;
  variables: string[];
  headerText?: string;
  footerText?: string;
  updatedAt: number;
}

export interface CircuitStateRecord {
  name: string;
  status: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  lastFailureTime: number;
}

export interface RateLimitBucketRecord {
  key: string;
  count: number;
  resetAt: number;
}

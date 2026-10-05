export interface VtigerMatch {
  compoundId: string; // "12x456" or "10x789"
  moduleId: string;   // "12" (Contacts) or "10" (Leads)
  recordId: string;   // "456" or "789"
  moduleName: 'Contacts' | 'Leads';
  fullName: string;
  phone: string;
  email: string;
  assignedUserId: string;
}

export interface IVtigerProvider {
  findEntityByPhone(nationalNumber: string): Promise<VtigerMatch | null>;
  createLead(data: {
    firstName: string;
    lastName: string;
    mobile: string;
    email?: string;
    company?: string;
    source?: string;
  }): Promise<string>;
}

export interface IWhatsAppProvider {
  sendMessage(params: {
    messageId: string;
    toPhoneNumber: string;
    messageType: 'TEXT' | 'TEMPLATE' | 'INTERACTIVE';
    text?: string;
    templateName?: string;
    templateLanguage?: string;
    workspaceId: string;
    phoneNumberId: string;
  }): Promise<{ externalMessageId: string; demo: boolean }>;
}

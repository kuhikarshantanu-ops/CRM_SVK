import { IVtigerProvider, VtigerMatch } from '../interfaces';
import { firestoreStore } from '../../utils/firestoreEngine';
import { normalizePhoneNumber } from '../../services/phone';

export class DemoVtigerProvider implements IVtigerProvider {
  public async findEntityByPhone(nationalNumber: string): Promise<VtigerMatch | null> {
    const records = firestoreStore.getAll('vtigerRecords');

    const contact = records.find(
      (r) =>
        r.moduleName === 'Contacts' &&
        (r.mobile?.includes(nationalNumber) || r.phone?.includes(nationalNumber))
    );

    if (contact) {
      return {
        compoundId: contact.compoundId,
        moduleId: contact.moduleId,
        recordId: contact.recordId,
        moduleName: 'Contacts',
        fullName: contact.fullName,
        phone: contact.phone,
        email: contact.email,
        assignedUserId: contact.assignedUserId
      };
    }

    const lead = records.find(
      (r) =>
        r.moduleName === 'Leads' &&
        (r.mobile?.includes(nationalNumber) || r.phone?.includes(nationalNumber))
    );

    if (lead) {
      return {
        compoundId: lead.compoundId,
        moduleId: lead.moduleId,
        recordId: lead.recordId,
        moduleName: 'Leads',
        fullName: lead.fullName,
        phone: lead.phone,
        email: lead.email,
        assignedUserId: lead.assignedUserId
      };
    }

    return null;
  }

  public async createLead(data: {
    firstName: string;
    lastName: string;
    mobile: string;
    email?: string;
    company?: string;
    source?: string;
  }): Promise<string> {
    const numericId = Math.floor(910 + Math.random() * 8900).toString();
    const compoundId = `10x${numericId}`;
    const normalized = normalizePhoneNumber(data.mobile);
    const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'WhatsApp Lead';

    firestoreStore.setDoc('vtigerRecords', compoundId, {
      compoundId,
      moduleId: '10',
      recordId: numericId,
      moduleName: 'Leads',
      firstName: data.firstName || 'WhatsApp',
      lastName: data.lastName || 'Lead',
      fullName,
      phone: normalized.e164 || data.mobile,
      mobile: normalized.nationalNumber || data.mobile,
      email: data.email || `${normalized.nationalNumber || 'lead'}@whatsapp-inbound.org`,
      company: data.company || 'Inbound WhatsApp Prospect',
      leadStatus: 'New',
      leadSource: data.source || 'WhatsApp',
      assignedUserId: '19x1',
      assignedUserName: 'Arjun Mehta',
      dealValue: 15000,
      notes: 'Auto-created via Vtiger WebServices Adapter on incoming WhatsApp message.',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    return compoundId;
  }
}

export const demoVtigerProvider = new DemoVtigerProvider();

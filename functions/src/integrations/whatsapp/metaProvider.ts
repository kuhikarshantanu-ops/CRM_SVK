import { IWhatsAppProvider } from '../interfaces';
import { firestoreStore } from '../../utils/firestoreEngine';

export class MetaWhatsAppProvider implements IWhatsAppProvider {
  constructor(private readonly accessToken: string) {}

  async sendMessage(params: {
    messageId: string;
    toPhoneNumber: string;
    messageType: 'TEXT' | 'TEMPLATE' | 'INTERACTIVE';
    text?: string;
    templateName?: string;
    templateLanguage?: string;
    workspaceId: string;
    phoneNumberId: string;
  }): Promise<{ externalMessageId: string; demo: boolean }> {
    if (!this.accessToken || !params.phoneNumberId) {
      throw new Error('WhatsApp credentials not configured');
    }

    const url = `https://graph.facebook.com/v21.0/${params.phoneNumberId}/messages`;

    const body =
      params.messageType === 'TEXT'
        ? {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: params.toPhoneNumber,
            type: 'text',
            text: { body: params.text }
          }
        : {
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: params.toPhoneNumber,
            type: 'template',
            template: {
              name: params.templateName,
              language: { code: params.templateLanguage || 'en' }
            }
          };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const result: any = await response.json();

    if (!response.ok) {
      throw new Error(
        `Meta API Error: ${result.error?.message || response.statusText}`
      );
    }

    const wamid = result.messages?.[0]?.id || `wamid.${Date.now()}`;
    firestoreStore.updateDoc('messages', params.messageId, {
      externalMessageId: wamid,
      status: 'SENT',
      sentAt: Date.now(),
      updatedAt: Date.now()
    });

    return { externalMessageId: wamid, demo: false };
  }
}

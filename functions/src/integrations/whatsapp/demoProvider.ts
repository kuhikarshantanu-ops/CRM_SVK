import { IWhatsAppProvider } from '../interfaces';
import { firestoreStore } from '../../utils/firestoreEngine';
import { scheduleDemoLifecycleTask } from '../../triggers/messageLifecycle';

export class DemoWhatsAppProvider implements IWhatsAppProvider {
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
    const wamid = `wamid.HBgM_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    firestoreStore.updateDoc('messages', params.messageId, {
      externalMessageId: wamid,
      demo: true,
      updatedAt: Date.now()
    });

    await scheduleDemoLifecycleTask({
      messageId: params.messageId,
      workspaceId: params.workspaceId,
      stage: 0,
      nextStageAt: Date.now() + 800,
      retryCount: 0
    });

    return { externalMessageId: wamid, demo: true };
  }
}

export const demoWhatsAppProvider = new DemoWhatsAppProvider();

import { processWebhookPayload } from '../webhooks/whatsapp';
import { firestoreStore } from '../utils/firestoreEngine';
import { demoVtigerProvider } from '../integrations/vtiger/demoVtigerProvider';

export async function handleSimulateInbound(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const {
      fromPhone = '+919371872013',
      profileName = 'Vikram Deshmukh',
      text = 'Hello, we are testing the enterprise webhook pipeline.',
      messageType = 'text',
      customWamid,
      duplicateDeliveryCount = 1,
      autoCreateLead = true
    } = req.body || {};

    const wamid =
      customWamid ||
      `wamid.HBgM_${Date.now()}_${Math.random().toString(36).slice(2, 9).toUpperCase()}`;

    const timestampSec = Math.floor(Date.now() / 1000).toString();

    const messageObj: Record<string, any> = {
      from: fromPhone,
      id: wamid,
      timestamp: timestampSec,
      type: messageType,
      autoCreateLead
    };

    if (messageType === 'text') {
      messageObj.text = { body: text };
    } else if (messageType === 'interactive') {
      messageObj.interactive = {
        type: 'button_reply',
        button_reply: { id: 'btn_confirm', title: text || 'Approve Proposal' }
      };
    }

    const webhookPayload = {
      object: 'whatsapp_business_account' as const,
      entry: [
        {
          id: 'waba_994827164501',
          changes: [
            {
              field: 'messages' as const,
              value: {
                messaging_product: 'whatsapp' as const,
                metadata: {
                  phone_number_id:
                    process.env.WHATSAPP_PHONE_NUMBER_ID || '9371872013',
                  business_account_id: 'waba_994827164501'
                },
                contacts: [
                  {
                    profile: { name: profileName },
                    wa_id: fromPhone.replace(/[^\d]/g, '')
                  }
                ],
                messages: [messageObj]
              }
            }
          ]
        }
      ]
    };

    const count = Math.min(Math.max(1, Number(duplicateDeliveryCount) || 1), 10);
    let totalProcessed = 0;
    let totalDeduplicated = 0;

    for (let i = 0; i < count; i++) {
      const result = await processWebhookPayload(webhookPayload);
      totalProcessed += result.processedMessages;
      totalDeduplicated += result.deduplicatedMessages;
    }

    res.status(200).json({
      success: true,
      wamid,
      deliveriesAttempted: count,
      processedMessages: totalProcessed,
      deduplicatedMessages: totalDeduplicated,
      demoSimulated: true
    });
  } catch (err: any) {
    console.error('Demo simulation error:', err);
    res.status(500).json({
      error: 'SIMULATION_FAILED',
      message: err.message
    });
  }
}

export async function handleCreateVtigerLeadForConversation(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const { conversationId, firstName, lastName, email, company } = req.body || {};
    const conv = firestoreStore.getDoc('conversations', conversationId);
    if (!conv) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    const compoundId = await demoVtigerProvider.createLead({
      firstName: firstName || conv.customerName.split(' ')[0] || 'WhatsApp',
      lastName: lastName || conv.customerName.split(' ').slice(1).join(' ') || conv.normalizedPhoneNumber,
      mobile: conv.phoneNumber,
      email,
      company,
      source: 'WhatsApp'
    });

    const fullName = `${firstName || ''} ${lastName || ''}`.trim() || conv.customerName;

    firestoreStore.updateDoc('conversations', conversationId, {
      crmRecordId: compoundId,
      crmRecordType: 'LEAD',
      customerName: fullName,
      updatedAt: Date.now()
    });

    const record = firestoreStore.getDoc('vtigerRecords', compoundId);

    res.status(200).json({
      success: true,
      compoundId,
      record
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function handleExpireWindowForDemo(req: any, res: any): Promise<void> {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const { conversationId, mode } = req.body || {};
  const conv = firestoreStore.getDoc('conversations', conversationId);
  if (!conv) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  const targetTime =
    mode === 'restore'
      ? Date.now() - 15 * 60 * 1000
      : Date.now() - 26 * 3600 * 1000;

  firestoreStore.updateDoc('conversations', conversationId, {
    lastIncomingMessageAt: targetTime,
    updatedAt: Date.now()
  });

  res.status(200).json({
    success: true,
    conversationId,
    lastIncomingMessageAt: targetTime
  });
}

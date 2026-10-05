import { z } from 'zod';

export const sendMessageRequestSchema = z
  .object({
    conversationId: z
      .string()
      .min(1, 'Conversation ID required')
      .max(200),
    text: z.string().max(4096, 'Message exceeds 4096 characters').optional(),
    messageType: z
      .enum(['TEXT', 'TEMPLATE', 'INTERACTIVE'])
      .default('TEXT'),
    templateName: z.string().max(255).optional(),
    templateLanguage: z.string().max(5).default('en'),
    retryCount: z.number().int().min(0).max(3).default(0)
  })
  .refine(
    (data) => {
      if (data.messageType === 'TEXT' && !data.text?.trim()) {
        return false;
      }
      if (data.messageType === 'TEMPLATE' && !data.templateName) {
        return false;
      }
      return true;
    },
    {
      message:
        'TEXT messages require text body; TEMPLATE messages require templateName',
      path: ['text', 'templateName']
    }
  );

export type SendMessageRequest = z.infer<typeof sendMessageRequestSchema>;

export const webhookPayloadSchema = z.object({
  object: z.literal('whatsapp_business_account'),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.enum(['messages', 'message_template_status_update']),
          value: z.object({
            messaging_product: z.literal('whatsapp').optional(),
            messages: z.array(z.record(z.string(), z.any())).optional(),
            statuses: z.array(z.record(z.string(), z.any())).optional(),
            contacts: z.array(z.record(z.string(), z.any())).optional(),
            metadata: z
              .object({
                phone_number_id: z.string().optional(),
                business_account_id: z.string().optional()
              })
              .optional()
          })
        })
      )
    })
  )
});

export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

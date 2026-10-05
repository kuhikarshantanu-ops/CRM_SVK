import { firestoreStore } from '../utils/firestoreEngine';

export const environmentConfig = {
  demoMode: process.env.DEMO_MODE !== 'false',
  whatsappVerifyToken: process.env.WHATSAPP_VERIFY_TOKEN || 'demo_token',
  whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '9371872013',
  whatsappAccessToken: process.env.WHATSAPP_ACCESS_TOKEN || 'demo',
  metaAppSecret: process.env.META_APP_SECRET || 'demo_secret',
  vtigerBaseUrl: process.env.VTIGER_BASE_URL || 'https://your-instance.vtiger.com',
  vtigerUsername: process.env.VTIGER_USERNAME || 'admin',
  vtigerAccessKey: process.env.VTIGER_ACCESS_KEY || 'demo_key',
  hasLiveMetaToken: Boolean(
    process.env.WHATSAPP_ACCESS_TOKEN &&
    process.env.WHATSAPP_ACCESS_TOKEN !== 'demo' &&
    process.env.WHATSAPP_ACCESS_TOKEN.length > 10
  ),
  hasLiveVtigerCreds: Boolean(
    process.env.VTIGER_BASE_URL &&
    process.env.VTIGER_ACCESS_KEY &&
    process.env.VTIGER_ACCESS_KEY !== 'demo_key' &&
    !process.env.VTIGER_BASE_URL.includes('your-instance.vtiger.com')
  )
};

export function getMaskedIntegrationSummary(workspaceId: string) {
  const settings = firestoreStore.getDoc('integrationSettings', workspaceId);
  if (!settings) return null;

  return {
    workspaceId: settings.workspaceId,
    metaBusinessAccountId: settings.metaBusinessAccountId,
    metaPhoneNumberId: settings.metaPhoneNumberId,
    metaAccessTokenMasked: settings.metaAccessToken === 'demo' ? 'demo (Demo Engine active)' : 'EAAGm0PX4ZCpsBA••••••••••••••••••••',
    vtigerBaseUrl: settings.vtigerBaseUrl,
    vtigerUsername: settings.vtigerUsername,
    vtigerAccessKeyMasked: settings.vtigerAccessKey === 'demo_key' ? 'demo_key (Demo Engine active)' : 'vt_md5_••••••••••••••••••••••••',
    active: settings.active,
    updatedAt: settings.updatedAt
  };
}

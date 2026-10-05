import { firestoreStore } from '../utils/firestoreEngine';

export interface WorkspaceContext {
  workspaceId: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
}

export async function resolveWorkspaceFromMetaWebhook(
  businessAccountId: string
): Promise<WorkspaceContext | null> {
  const allSettings = firestoreStore.getAll('integrationSettings');
  const match =
    allSettings.find(
      (s) => s.metaBusinessAccountId === businessAccountId && s.active === true
    ) ||
    (businessAccountId === 'default'
      ? allSettings.find((s) => s.active === true)
      : undefined);

  if (!match) {
    return null;
  }

  return {
    workspaceId: match.workspaceId,
    phoneNumberId: match.metaPhoneNumberId,
    businessAccountId: match.metaBusinessAccountId,
    accessToken: match.metaAccessToken
  };
}

export async function resolveUserWorkspace(
  userId: string
): Promise<WorkspaceContext | null> {
  const user = firestoreStore.getDoc('users', userId);
  if (!user) return null;

  const workspaceId = user.workspaceId;
  const settings = firestoreStore.getDoc('integrationSettings', workspaceId);
  if (!settings) return null;

  return {
    workspaceId,
    phoneNumberId: settings.metaPhoneNumberId,
    businessAccountId: settings.metaBusinessAccountId,
    accessToken: settings.metaAccessToken
  };
}

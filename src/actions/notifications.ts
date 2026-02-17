'use client';

import { apiFetch } from '@/lib/api-client';

export type NotificationSettings = {
  emailNotifications: boolean;
  pushNotifications: boolean;
};

export async function updateNotificationSettings(
  _userId: string,
  settings: NotificationSettings
): Promise<{ success: boolean; error?: string }> {
  try {
    await apiFetch('/users/me', {
      method: 'PATCH',
      body: JSON.stringify({
        emailNotifications: settings.emailNotifications,
        pushNotifications: settings.pushNotifications,
      }),
    });
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to update notification settings' };
  }
}

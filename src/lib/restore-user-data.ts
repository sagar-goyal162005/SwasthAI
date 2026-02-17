'use client';

import { initialChallenges, initialDailyVibes } from '@/lib/data';
import { apiFetch } from '@/lib/api-client';

export async function restoreUserData(_userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const current = await apiFetch<{ challenges: any[]; dailyVibes: any[] }>('/user-data/me');
    const challenges = current.challenges?.length ? current.challenges : initialChallenges;
    const dailyVibes = current.dailyVibes?.length ? current.dailyVibes : initialDailyVibes;

    await apiFetch('/user-data/me', {
      method: 'PUT',
      body: JSON.stringify({ challenges, dailyVibes }),
    });

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e?.message || 'Failed to restore user data' };
  }
}

export async function safeRefreshDailyTasks(_userId: string): Promise<{ success: boolean; error?: string }> {
  // Daily refresh/reset is not implemented in backend yet.
  return { success: true };
}

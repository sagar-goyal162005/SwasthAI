'use client';

import type { BuddyPersona, User } from '@/lib/user-store';
import { apiFetch } from '@/lib/api-client';
import type { Challenge, DailyVibe } from '@/lib/data';

async function getUserData(): Promise<{ challenges: Challenge[]; dailyVibes: DailyVibe[] }> {
  return apiFetch('/user-data/me');
}

async function putUserData(payload: { challenges: Challenge[]; dailyVibes: DailyVibe[] }) {
  return apiFetch('/user-data/me', { method: 'PUT', body: JSON.stringify(payload) });
}

// Kept for backward compatibility with existing imports.
export async function createUserInFirestore(_uid: string, _data: Omit<User, 'uid'>) {
  // User creation now happens via backend /auth/signup.
  return;
}

export async function getUserFromFirestore(_uid: string): Promise<User | null> {
  try {
    return await apiFetch<User>('/auth/me');
  } catch {
    return null;
  }
}

// Dashboard persistence (now SQLite-backed)
export async function updateDailyVibes(_userId: string, vibes: DailyVibe[]) {
  const existing = await getUserData();
  await putUserData({ ...existing, dailyVibes: vibes });
}

export async function removeDailyVibe(_userId: string, vibeId: string) {
  const existing = await getUserData();
  const filtered = (existing.dailyVibes || []).filter((v: any) => v.id !== vibeId);
  await putUserData({ ...existing, dailyVibes: filtered });
}

export async function updateChallenge(_userId: string, challenge: Challenge) {
  const existing = await getUserData();
  const updated = (existing.challenges || []).map((c: any) => (c.id === challenge.id ? challenge : c));
  await putUserData({ ...existing, challenges: updated });
}

export async function addChallenge(_userId: string, newChallenge: Challenge) {
  const existing = await getUserData();
  const next = [...(existing.challenges || []), newChallenge];
  await putUserData({ ...existing, challenges: next });
}

export async function removeChallenge(_userId: string, challengeId: string) {
  const existing = await getUserData();
  const filtered = (existing.challenges || []).filter((c: any) => c.id !== challengeId);
  await putUserData({ ...existing, challenges: filtered });
}

// Profile management (now SQLite-backed)
export async function updateUserProfile(_uid: string, updates: Partial<Omit<User, 'uid'>>) {
  await apiFetch<User>('/users/me', { method: 'PATCH', body: JSON.stringify(updates) });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = () => resolve(String(reader.result || ''));
    reader.readAsDataURL(file);
  });
}

export async function uploadProfileImage(_uid: string, file: File): Promise<string> {
  const dataUrl = await fileToDataUrl(file);
  await updateUserProfile(_uid, { avatarUrl: dataUrl });
  return dataUrl;
}

export async function updateBuddyPersona(_uid: string, buddyPersona: BuddyPersona) {
  await updateUserProfile(_uid, { buddyPersona });
}

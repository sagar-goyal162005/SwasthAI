'use client';

export type DailyActivity = {
  userId: string;
  date: string;
  waterIntake: number;
  waterGoal: number;
  sleepHours: number;
  gymMinutes: number;
  medicationTaken: boolean;
  customActivities: { [key: string]: any };
  tasksCompleted: number;
  pointsEarned: number;
};

// These functions used to persist to a cloud backend and award points.
// For now, we keep the API surface so the UI continues to work.
// Persistence/points can be reintroduced via backend endpoints later.

export async function updateWaterIntake(_userId: string, _glasses: number): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  return { success: true, pointsEarned: 0 };
}

export async function getTodayActivity(userId: string): Promise<DailyActivity> {
  const today = new Date().toLocaleDateString('en-CA');

  return {
    userId,
    date: today,
    waterIntake: 0,
    waterGoal: 8,
    sleepHours: 0,
    gymMinutes: 0,
    medicationTaken: false,
    customActivities: {},
    tasksCompleted: 0,
    pointsEarned: 0,
  };
}

export async function updateSleepHours(_userId: string, _hours: number): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  return { success: true, pointsEarned: 0 };
}

export async function updateGymMinutes(_userId: string, _minutes: number): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  return { success: true, pointsEarned: 0 };
}

export async function updateMedicationStatus(_userId: string, _taken: boolean): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  return { success: true, pointsEarned: 0 };
}

export async function completeCustomTask(_userId: string, _taskName: string): Promise<{ success: boolean; pointsEarned?: number; error?: string }> {
  return { success: true, pointsEarned: 0 };
}

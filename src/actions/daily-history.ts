'use client';

export type DailyHistoricalData = {
  userId: string;
  date: string;
  points: number;
  dailyPoints: number;
  streak: number;
  totalTasksCompleted: number;
  activities: {
    waterIntake: number;
    waterGoal: number;
    sleepHours: number;
    gymMinutes: number;
    medicationTaken: boolean;
    tasksCompleted: number;
    pointsEarned: number;
    customActivities: { [key: string]: any };
  };
  dailyVibes: any[];
  challenges: any[];
  savedAt: string;
  resetAt: string;
};

export async function getDailyHistoricalData(_userId: string, _date: string): Promise<DailyHistoricalData | null> {
  return null;
}

export async function getWeeklyHistoricalData(_userId: string, dates: string[]): Promise<{ [date: string]: DailyHistoricalData | null }> {
  const out: { [date: string]: DailyHistoricalData | null } = {};
  for (const d of dates) out[d] = null;
  return out;
}

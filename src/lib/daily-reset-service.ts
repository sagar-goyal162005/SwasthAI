'use client';

export interface DailyResetService {
  scheduleDaily: () => void;
  performDailyReset: (_userId: string) => Promise<void>;
  incrementDailyStreak: (_userId: string) => Promise<void>;
  saveDailyData: (_userId: string) => Promise<void>;
  resetDailyMetrics: (_userId: string) => Promise<void>;
  checkAndTriggerResetIfNeeded: (_userId: string) => Promise<boolean>;
}

class DailyResetServiceImpl implements DailyResetService {
  private userId: string | null = null;

  setUserId(userId: string) {
    this.userId = userId;
  }

  async manualReset() {
    if (!this.userId) return;
    await this.performDailyReset(this.userId);
  }

  scheduleDaily() {
    // no-op
  }
  async performDailyReset(_userId: string) {
    return;
  }
  async incrementDailyStreak(_userId: string) {
    return;
  }
  async saveDailyData(_userId: string) {
    return;
  }
  async resetDailyMetrics(_userId: string) {
    return;
  }
  async checkAndTriggerResetIfNeeded(_userId: string): Promise<boolean> {
    return false;
  }
}

export const dailyResetService = new DailyResetServiceImpl();
export default dailyResetService;

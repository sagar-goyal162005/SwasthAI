'use client';

import { type DailyVibe } from '@/lib/data';

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function WaterCard({ waterVibe }: { waterVibe?: DailyVibe }) {
  const progress = clamp(waterVibe?.progress ?? 0, 0, 100);
  const value = waterVibe?.value || '0/8 glasses';

  return (
    <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5">
      <h2 className="text-lg font-medium mb-4 text-[var(--text-primary)]">Water Intake</h2>

      <div className="w-full bg-white/5 h-3 rounded-full overflow-hidden">
        <div className="bg-primary h-3 rounded-full" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-2 flex items-center justify-between text-sm">
        <p className="text-[var(--text-secondary)]">{value.replace('/', ' / ')}</p>
        <p className="text-[var(--text-secondary)]">{Math.round(progress)}%</p>
      </div>
    </div>
  );
}

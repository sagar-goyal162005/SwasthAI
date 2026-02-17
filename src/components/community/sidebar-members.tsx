'use client';

import { cn } from '@/lib/utils';

type Props = {
  members?: string[];
};

export default function SidebarMembers({ members = ['Sunil', 'Aarohi', 'Ananya'] }: Props) {
  return (
    <div className={cn('bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5', 'transition duration-200 hover:bg-[var(--card-hover)]')}>
      <h2 className="font-medium mb-4 text-[var(--text-primary)]">Active Members</h2>

      <div className="space-y-4">
        {members.map((name) => (
          <div key={name} className="flex items-center justify-between">
            <span className="text-[var(--text-primary)]">{name}</span>
            <div className="w-2 h-2 bg-primary rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

'use client';

import { Balancer } from 'react-wrap-balancer';

export function DashboardHeader({ name }: { name?: string | null }) {
  const firstName = name?.trim() ? name.trim().split(' ')[0] : 'friend';

  return (
    <div>
      <h1 className="text-3xl font-semibold text-[var(--text-primary)]">
        Welcome back, <span className="text-primary">{firstName}!</span>
      </h1>
      <p className="text-[var(--text-secondary)] mt-1">
        <Balancer>Here&apos;s your wellness snapshot for today.</Balancer>
      </p>
    </div>
  );
}

'use client';

import { Balancer } from 'react-wrap-balancer';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

type Props = {
  title?: string;
  subtitle?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  rightSlot?: React.ReactNode;
};

export default function CommunityHeader({
  title = 'Community',
  subtitle = 'Connect, share, and grow together.',
  onRefresh,
  refreshing,
  rightSlot,
}: Props) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold text-[var(--text-primary)]">{title}</h1>
        <p className="text-[var(--text-secondary)] mt-1">
          <Balancer>{subtitle}</Balancer>
        </p>
      </div>

      <div className="flex flex-col items-stretch sm:items-end gap-2">
        {rightSlot}
        {onRefresh ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={!!refreshing}
            className={cn(
              'rounded-xl bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/5',
              'transition duration-200'
            )}
          >
            <RotateCcw className={cn('h-4 w-4 mr-2', refreshing && 'animate-spin')} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        ) : null}
      </div>
    </div>
  );
}

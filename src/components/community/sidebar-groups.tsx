'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Group = {
  slug: string;
  name: string;
};

type Props = {
  groups: Group[];
  onOpen: (slug: string) => void;
  activeSlug?: string;
};

export default function SidebarGroups({ groups, onOpen, activeSlug }: Props) {
  const top = groups.slice(0, 2);

  return (
    <div className={cn('bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5', 'transition duration-200 hover:bg-[var(--card-hover)]')}>
      <h2 className="font-medium mb-4 text-[var(--text-primary)]">Recommended Groups</h2>

      <div className="space-y-4">
        {top.length ? (
          top.map((g) => (
            <div key={g.slug} className="flex justify-between items-center gap-3">
              <span className="text-[var(--text-primary)] truncate">{g.name}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpen(g.slug)}
                className={cn(
                  'text-primary hover:text-primary',
                  'hover:bg-white/5 rounded-xl px-3'
                )}
              >
                {activeSlug === g.slug ? 'Open' : 'Join'}
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--text-secondary)]">No groups available.</p>
        )}
      </div>
    </div>
  );
}

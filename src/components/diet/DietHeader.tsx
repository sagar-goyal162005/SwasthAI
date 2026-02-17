'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type DietHeaderProps = {
  title?: string;
  subtitle?: string;
  dateLabel?: string;
  isGenerating?: boolean;
  onGenerate?: () => void;
  className?: string;
};

export default function DietHeader({
  title = 'Diet Plan',
  subtitle = 'Your personalized meal plan for today.',
  dateLabel = 'Today',
  isGenerating,
  onGenerate,
  className,
}: DietHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between', className)}>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center gap-3">
        <div className="rounded-lg border bg-card px-3 py-2 text-sm text-muted-foreground">
          {dateLabel}
        </div>
        <Button className="glass-button" onClick={onGenerate} disabled={isGenerating || !onGenerate}>
          {isGenerating ? 'Generating…' : 'Generate New Plan'}
        </Button>
      </div>
    </div>
  );
}

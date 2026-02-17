'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type MacroTarget = {
  label: string;
  current: number;
  target: number;
  colorVar: '--chart-1' | '--chart-2' | '--chart-3' | '--chart-4' | '--chart-5';
  unit?: string;
};

type NutritionCardProps = {
  caloriesCurrent: number;
  caloriesTarget: number;
  macros: MacroTarget[];
  className?: string;
};

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function CircularProgress({
  value,
  label,
}: {
  value: number;
  label: { primary: string; secondary: string };
}) {
  const size = 148;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="hsl(var(--muted))"
          strokeWidth={stroke}
          opacity={0.35}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="hsl(var(--chart-1))"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-2xl font-semibold tracking-tight">{label.primary}</div>
        <div className="text-xs text-muted-foreground">{label.secondary}</div>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  colorVar,
  right,
}: {
  label: string;
  value: number;
  colorVar: MacroTarget['colorVar'];
  right: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-sm text-muted-foreground">{right}</p>
      </div>
      <div className="h-2.5 w-full rounded-full bg-muted/35">
        <div
          className="h-2.5 rounded-full"
          style={{ width: `${clampPercent(value)}%`, backgroundColor: `hsl(var(${colorVar}))` }}
        />
      </div>
    </div>
  );
}

export default function NutritionCard({
  caloriesCurrent,
  caloriesTarget,
  macros,
  className,
}: NutritionCardProps) {
  const caloriesPercent = clampPercent((caloriesCurrent / Math.max(1, caloriesTarget)) * 100);

  return (
    <Card className={cn('glass-panel border-0', className)}>
      <CardHeader className="pb-4">
        <h2 className="text-lg font-medium">Nutritional Targets</h2>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid place-items-center rounded-xl bg-muted/15 p-4">
          <CircularProgress
            value={caloriesPercent}
            label={{
              primary: `${caloriesCurrent.toLocaleString()} / ${caloriesTarget.toLocaleString()}`,
              secondary: `${Math.round(caloriesPercent)}% kcal`,
            }}
          />
        </div>

        <div className="space-y-5">
          {macros.map((m) => (
            <ProgressRow
              key={m.label}
              label={m.label}
              value={clampPercent((m.current / Math.max(1, m.target)) * 100)}
              colorVar={m.colorVar}
              right={`${m.current}${m.unit ?? 'g'} / ${m.target}${m.unit ?? 'g'}`}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

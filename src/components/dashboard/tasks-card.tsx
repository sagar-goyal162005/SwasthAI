'use client';

import Link from 'next/link';
import { type Challenge, type DailyVibe } from '@/lib/data';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, Flame, PlusCircle, RefreshCcw, RotateCcw } from 'lucide-react';

type Props = {
  dailyVibes: DailyVibe[];
  challenges: Challenge[];
  onRestore: () => void;
  onRefresh: () => void;
  onAddVibe: () => void;
  onEditVibe: (vibe: DailyVibe) => void;
  onMarkVibeAsDone: (id: string) => void;
  onMarkChallengeAsDone: (challengeId: string) => void;
  isSleepLoggingActive: boolean;
  timeToUnlockSleep: number;
  timeToUnlockWater: number;
  isPending: boolean;
};

function formatTime(ms: number) {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export function TasksCard({
  dailyVibes,
  challenges,
  onRestore,
  onRefresh,
  onAddVibe,
  onEditVibe,
  onMarkVibeAsDone,
  onMarkChallengeAsDone,
  isSleepLoggingActive,
  timeToUnlockSleep,
  timeToUnlockWater,
  isPending,
}: Props) {
  const tasks = dailyVibes.filter(
    (v) => v.id !== 'streak' && v.id !== 'water' && v.id !== 'sleep' && v.id !== 'gym'
  );
  const topChallenges = challenges.slice(0, 1);

  return (
    <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-[var(--text-primary)]">Today&apos;s Tasks &amp; Challenges</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onRestore}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            aria-label="Restore tasks"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRefresh}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            aria-label="Refresh day"
          >
            <RefreshCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onAddVibe}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition"
            aria-label="Add task"
          >
            <PlusCircle className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {/* Tasks */}
        <div className="space-y-2">
          {tasks.length ? (
            tasks.map((vibe) => {
              const isCompleted = vibe.id === 'medication' ? vibe.progress === 100 : !!vibe.completedAt;

              let isMedicationDisabled = false;
              if (vibe.id === 'medication' && vibe.medicationConfig) {
                const config = vibe.medicationConfig;
                if (config.lastDoseTime) {
                  const now = new Date();
                  const timeSinceLastDose = now.getTime() - new Date(config.lastDoseTime).getTime();
                  const intervalMs = config.intervalHours * 60 * 60 * 1000;
                  isMedicationDisabled = timeSinceLastDose < intervalMs && config.dosesTaken < config.dailyDoses;
                }
              }

              const disabled = isMedicationDisabled || isPending;
              const disableMark = ((isCompleted && vibe.id !== 'medication') || isPending || isMedicationDisabled);

              const status = isCompleted
                ? 'Completed'
                : isMedicationDisabled
                  ? 'Pending'
                  : 'Pending';

              return (
                <div
                  key={vibe.id}
                  className="rounded-xl bg-white/5 border border-white/5 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => !disabled && onEditVibe(vibe)}
                      className={cn('text-left flex-1', disabled && 'cursor-not-allowed opacity-70')}
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-2.5 w-2.5 rounded-full bg-white/30" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{vibe.title}</p>
                          <p className="text-xs text-[var(--text-secondary)]">{status}</p>
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => !disabled && onMarkVibeAsDone(vibe.id)}
                      disabled={disableMark}
                      className={cn(
                        'h-8 px-3 rounded-lg text-xs bg-white/5 text-[var(--text-primary)] transition',
                        disableMark ? 'opacity-60 cursor-not-allowed' : 'hover:bg-primary/20'
                      )}
                    >
                      {isCompleted ? 'Done' : 'Mark'}
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="rounded-xl bg-white/5 border border-white/5 px-4 py-3">
              <p className="text-sm text-[var(--text-secondary)]">No tasks yet.</p>
            </div>
          )}
        </div>

        {/* Challenge */}
        {topChallenges.length ? (
          <div className="space-y-2">
            {topChallenges.map((challenge) => {
              const ratio = challenge.goalDays > 0 ? Math.min(100, Math.round((challenge.currentDay / challenge.goalDays) * 100)) : 0;
              const daysLeft = Math.max(0, challenge.goalDays - challenge.currentDay);

              return (
                <div
                  key={challenge.id}
                  className="rounded-xl bg-white/5 border border-white/5 px-4 py-3"
                >
                  <button
                    type="button"
                    onClick={() => onMarkChallengeAsDone(challenge.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <Flame className="h-4 w-4 text-primary" />
                        <div>
                          <p className="text-sm font-medium text-[var(--text-primary)]">{challenge.title}</p>
                          <p className="text-xs text-[var(--text-secondary)]">
                            {challenge.isCompletedToday ? 'Completed today' : 'In progress'}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-[var(--text-secondary)]" />
                    </div>

                    <div className="mt-3">
                      <Progress value={ratio} className="h-2 bg-white/10" />
                      <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                        <span>
                          {challenge.currentDay} / {challenge.goalDays} days
                        </span>
                        <span>{daysLeft} days left</span>
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}

            <Button
              asChild
              variant="secondary"
              size="sm"
              className="w-full rounded-full bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/5"
            >
              <Link href="/challenges">View All</Link>
            </Button>
          </div>
        ) : (
          <Button
            asChild
            variant="secondary"
            size="sm"
            className="w-full rounded-full bg-white/5 hover:bg-white/10 text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-white/5"
          >
            <Link href="/challenges">View All</Link>
          </Button>
        )}
      </div>
    </div>
  );
}

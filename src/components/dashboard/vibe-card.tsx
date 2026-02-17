'use client';

import { useMemo, useState } from 'react';

type VibeOption = 'Low' | 'Okay' | 'Great';

export function VibeCard() {
  const [selected, setSelected] = useState<VibeOption | null>(null);

  const emoji = useMemo(() => {
    if (!selected) return '';
    switch (selected) {
      case 'Low':
        return '😔';
      case 'Okay':
        return '🙂';
      case 'Great':
        return '😄';
      default:
        return '';
    }
  }, [selected]);

  return (
    <div className="bg-[var(--card-bg)] p-6 rounded-2xl border border-white/5">
      <h2 className="text-lg font-medium mb-3 text-[var(--text-primary)]">Vibe</h2>

      <p className="text-primary font-medium flex items-center gap-2">
        {selected ? `Feeling ${selected}!` : 'How are you feeling?'}
        {emoji ? <span className="text-lg leading-none">{emoji}</span> : null}
      </p>

      <div className="flex gap-3 mt-4">
        {(['Low', 'Okay', 'Great'] as const).map((vibe) => {
          const isSelected = selected === vibe;
          return (
          <button
            key={vibe}
            type="button"
            aria-pressed={isSelected}
            onClick={() => setSelected(vibe)}
            className={
              "px-3 py-1 text-sm rounded-lg transition " +
              (isSelected
                ? 'bg-primary/20 text-primary'
                : 'bg-white/5 hover:bg-primary/10 text-[var(--text-primary)]')
            }
          >
            {vibe}
          </button>
          );
        })}
      </div>
    </div>
  );
}

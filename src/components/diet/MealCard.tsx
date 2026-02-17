'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type MealItem = {
  name: string;
  calories?: number;
};

type MealCardProps = {
  title: string;
  items?: MealItem[];
  onAddItem?: (name: string) => void;
  onTrackItem?: (item: MealItem) => void;
  className?: string;
};

export default function MealCard({ title, items = [], onAddItem, onTrackItem, className }: MealCardProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');
  const canAdd = useMemo(() => !!newName.trim() && !!onAddItem, [newName, onAddItem]);

  const submit = () => {
    const name = newName.trim();
    if (!name || !onAddItem) return;
    onAddItem(name);
    setNewName('');
    setIsAdding(false);
  };

  return (
    <Card className={cn('glass-panel border-0', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-lg font-medium">{title}</h2>
          {items.length > 0 ? (
            <span className="text-xs text-muted-foreground">{items.length} item{items.length === 1 ? '' : 's'}</span>
          ) : null}
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="text-primary hover:text-primary"
          onClick={() => setIsAdding((v) => !v)}
          disabled={!onAddItem}
        >
          + Add Item
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {isAdding ? (
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Add a food item…"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  submit();
                }
                if (e.key === 'Escape') {
                  setIsAdding(false);
                  setNewName('');
                }
              }}
              autoFocus
            />
            <Button onClick={submit} disabled={!canAdd}>
              Add
            </Button>
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-background/40 p-4 text-sm text-muted-foreground">
            No items added yet.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                {typeof item.calories === 'number' ? (
                  <p className="text-xs text-muted-foreground">{item.calories} kcal</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-primary"
                onClick={() => onTrackItem?.(item)}
              >
                Track
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

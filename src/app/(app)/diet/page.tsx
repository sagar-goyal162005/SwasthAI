'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { generateDietPlanAction } from '@/actions/ai-diet';
import DietHeader from '@/components/diet/DietHeader';
import MealCard, { type MealItem } from '@/components/diet/MealCard';
import NutritionCard from '@/components/diet/NutritionCard';

type MealKey = 'breakfast' | 'lunch' | 'snack' | 'dinner';

type GeneratedDietPlan = {
    dailyCalories?: number;
    macros?: { protein?: string; carbs?: string; fats?: string };
    meals?: Array<{ type?: string; name?: string; calories?: number }>; // backend/flow may include more fields
};

function toMealKey(value: string): MealKey | null {
    const v = (value || '').trim().toLowerCase();
    if (v === 'breakfast') return 'breakfast';
    if (v === 'lunch') return 'lunch';
    if (v === 'snack') return 'snack';
    if (v === 'dinner') return 'dinner';
    return null;
}

function parseMacroValue(value: string | undefined): number {
    if (!value) return 0;
    const match = String(value).match(/([0-9]+(?:\.[0-9]+)?)/);
    return match ? Number(match[1]) : 0;
}

export default function DietPlannerPage() {
  const { toast } = useToast();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedDietPlan | null>(null);
  const [mealsState, setMealsState] = useState<Record<MealKey, MealItem[]>>({
    breakfast: [{ name: 'Oats with Berries' }, { name: 'Green Tea' }],
    lunch: [{ name: 'Quinoa Salad', calories: 320 }, { name: 'Grilled Chicken Wrap', calories: 380 }],
    snack: [{ name: 'Greek Yogurt with Honey', calories: 100 }, { name: 'Almonds', calories: 130 }],
    dinner: [{ name: 'Vegetable Soup', calories: 220 }, { name: 'Paneer Tikka', calories: 250 }],
  });

  useEffect(() => {
    if (!generated?.meals?.length) return;
    const next: Record<MealKey, MealItem[]> = {
      breakfast: [],
      lunch: [],
      snack: [],
      dinner: [],
    };
    for (const m of generated.meals) {
      const key = toMealKey(m.type || '');
      if (!key) continue;
      const name = (m.name || '').trim();
      if (!name) continue;
      next[key].push({ name, calories: typeof m.calories === 'number' ? m.calories : undefined });
    }
    setMealsState(next);
  }, [generated]);

  const caloriesTarget = generated?.dailyCalories ? Math.max(1, generated.dailyCalories) : 1800;
  const caloriesCurrent = useMemo(() => {
    // naive: sum known item calories (fallback has partial data)
    const sum = (items: MealItem[]) => items.reduce((acc, it) => acc + (it.calories ?? 0), 0);
    return (
      sum(mealsState.breakfast) +
      sum(mealsState.lunch) +
      sum(mealsState.snack) +
      sum(mealsState.dinner)
    );
  }, [mealsState]);

  const macroTargets = useMemo(() => {
    const protein = parseMacroValue(generated?.macros?.protein) || 100;
    const carbs = parseMacroValue(generated?.macros?.carbs) || 150;
    const fats = parseMacroValue(generated?.macros?.fats) || 45;
    return [
      { label: 'Protein', current: protein, target: 130, colorVar: '--chart-2' as const },
      { label: 'Carbs', current: carbs, target: 200, colorVar: '--chart-3' as const },
      { label: 'Fats', current: fats, target: 50, colorVar: '--chart-4' as const },
    ];
  }, [generated?.macros?.carbs, generated?.macros?.fats, generated?.macros?.protein]);

  const handleAddItem = (meal: MealKey, name: string) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    setMealsState((prev) => ({
      ...prev,
      [meal]: [...prev[meal], { name: trimmed }],
    }));
  };

  const handleTrackItem = (meal: MealKey, item: MealItem) => {
    toast({
      title: 'Tracked',
      description: `${item.name} added to your log (demo).`,
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      // Keep it simple for now; later we can wire user preferences.
      const payload = {
        age: 30,
        weight: 70,
        height: 170,
        gender: 'Male',
        goal: 'healthy_living' as const,
        activityLevel: 'moderate' as const,
        dietaryRestrictions: '',
        cuisinePreferences: '',
      };
      const result = (await generateDietPlanAction(payload)) as GeneratedDietPlan;
      setGenerated(result);
      toast({ title: 'Plan Ready', description: 'Your diet plan is ready.' });
    } catch (e) {
      // Even if generation fails, the UI remains usable with the current plan.
      const msg = e instanceof Error ? e.message : 'Could not generate diet plan. Showing your current plan.';
      toast({ title: 'AI Unavailable', description: msg });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="mx-auto w-full max-w-6xl">
        <DietHeader dateLabel="Today" isGenerating={isGenerating} onGenerate={handleGenerate} />

        <div className="mt-6 grid grid-cols-12 gap-6">
          <div className="col-span-12 lg:col-span-8 space-y-6">
            <MealCard
              title="Breakfast"
              items={mealsState.breakfast}
              onAddItem={(name) => handleAddItem('breakfast', name)}
              onTrackItem={(item) => handleTrackItem('breakfast', item)}
            />
            <MealCard
              title="Lunch"
              items={mealsState.lunch}
              onAddItem={(name) => handleAddItem('lunch', name)}
              onTrackItem={(item) => handleTrackItem('lunch', item)}
            />
            <MealCard
              title="Snack"
              items={mealsState.snack}
              onAddItem={(name) => handleAddItem('snack', name)}
              onTrackItem={(item) => handleTrackItem('snack', item)}
            />
            <MealCard
              title="Dinner"
              items={mealsState.dinner}
              onAddItem={(name) => handleAddItem('dinner', name)}
              onTrackItem={(item) => handleTrackItem('dinner', item)}
            />
          </div>

          <div className="col-span-12 lg:col-span-4">
            <NutritionCard
              caloriesCurrent={caloriesCurrent}
              caloriesTarget={caloriesTarget}
              macros={macroTargets}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

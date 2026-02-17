'use server';

import { dietPlannerFlow } from '@/ai/flows/diet-planner';

type DietPlannerInput = {
    age: number;
    weight: number;
    height: number;
    gender: string;
    goal: 'weight_loss' | 'gain_muscle' | 'maintain' | 'healthy_living';
    dietaryRestrictions?: string;
    cuisinePreferences?: string;
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
};

type DietPlannerOutput = {
    dailyCalories: number;
    macros: { protein: string; carbs: string; fats: string };
    meals: Array<{
        type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
        name: string;
        calories: number;
        protein: string;
        description: string;
        ingredients: string[];
    }>;
};

function mockDietPlan(): DietPlannerOutput {
    return {
        dailyCalories: 1800,
        macros: { protein: '130g', carbs: '200g', fats: '50g' },
        meals: [
            {
                type: 'Breakfast',
                name: 'Overnight Oats with Berries',
                calories: 450,
                protein: '20g',
                description: 'Oats soaked overnight with yogurt, chia, and mixed berries.',
                ingredients: ['Oats', 'Greek yogurt', 'Chia seeds', 'Berries', 'Honey'],
            },
            {
                type: 'Lunch',
                name: 'Quinoa Salad Bowl',
                calories: 520,
                protein: '28g',
                description: 'Quinoa with vegetables, chickpeas, and a lemon-olive oil dressing.',
                ingredients: ['Quinoa', 'Chickpeas', 'Cucumber', 'Tomato', 'Lemon', 'Olive oil'],
            },
            {
                type: 'Snack',
                name: 'Greek Yogurt + Almonds',
                calories: 250,
                protein: '18g',
                description: 'High-protein yogurt with a handful of almonds.',
                ingredients: ['Greek yogurt', 'Almonds'],
            },
            {
                type: 'Dinner',
                name: 'Paneer Tikka + Veggies',
                calories: 580,
                protein: '35g',
                description: 'Grilled paneer with seasonal vegetables and spices.',
                ingredients: ['Paneer', 'Bell pepper', 'Onion', 'Yogurt', 'Spices'],
            },
        ],
    };
}

export async function generateDietPlanAction(input: DietPlannerInput): Promise<DietPlannerOutput> {
    try {
        // Invoke the Genkit flow directly
        return (await dietPlannerFlow(input)) as DietPlannerOutput;
    } catch (error) {
        console.error('Error generating diet plan:', error);

        // Keep the UI unblocked in local dev/demo scenarios.
        if (process.env.NODE_ENV !== 'production') {
            return mockDietPlan();
        }

        throw new Error(error instanceof Error ? error.message : 'Failed to generate diet plan');
    }
}


'use server';

import { symptomCheck, type SymptomCheckInput, type SymptomCheckOutput } from "@/ai/flows/symptom-check-with-ai";
import { ensureGeminiEnv } from "@/lib/gemini-env";
import { z } from "zod";

const SymptomCheckActionInputSchema = z.object({
  symptoms: z.string().min(3, "Please describe your symptoms in a bit more detail."),
});

type State = {
  data: SymptomCheckOutput | null;
  error: string | null;
  form: {
    symptoms: string;
  }
}

export type SymptomChatResponse = {
  response?: string;
  error?: string;
  data?: SymptomCheckOutput;
};

export async function symptomCheckChatAction(formData: FormData): Promise<SymptomChatResponse> {
  try {
    ensureGeminiEnv();
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Gemini API key is missing.' };
  }

  const raw = (formData.get('message') ?? formData.get('symptoms') ?? '').toString();
  const validatedFields = SymptomCheckActionInputSchema.safeParse({
    symptoms: raw,
  });

  if (!validatedFields.success) {
    return {
      error: validatedFields.error.flatten().fieldErrors.symptoms?.[0] ?? 'Invalid input.',
    };
  }

  try {
    const input: SymptomCheckInput = {
      symptoms: validatedFields.data.symptoms,
    };
    const result = await symptomCheck(input);

    const formatAdvice = (text: string) => text.replace(/[•*]/g, '-');
    const formattedResult: SymptomCheckOutput = {
      homeopathyAdvice: formatAdvice(result.homeopathyAdvice),
      ayurvedicAdvice: formatAdvice(result.ayurvedicAdvice),
      remedies: formatAdvice(result.remedies),
    };

    const response = [
      'Disclaimer: This is informational only and not a medical diagnosis.',
      '',
      'Homeopathy advice:',
      formattedResult.homeopathyAdvice,
      '',
      'Ayurvedic advice:',
      formattedResult.ayurvedicAdvice,
      '',
      'Remedies:',
      formattedResult.remedies,
      '',
      'If symptoms are severe, worsening, or you feel unsafe, please consult a doctor or local emergency services.',
    ].join('\n');

    return {
      response,
      data: formattedResult,
    };
  } catch (error) {
    console.error(error);
    return {
      error: 'An unexpected error occurred. Please check your API key and try again.',
    };
  }
}

export async function symptomCheckAction(prevState: State, formData: FormData): Promise<State> {
  try {
    ensureGeminiEnv();
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e.message : 'Gemini API key is missing.',
      form: {
        symptoms: formData.get('symptoms')?.toString() ?? '',
      },
    };
  }

  const validatedFields = SymptomCheckActionInputSchema.safeParse({
    symptoms: formData.get('symptoms'),
  });

  if (!validatedFields.success) {
    return {
      data: null,
      error: validatedFields.error.flatten().fieldErrors.symptoms?.[0] ?? "Invalid input.",
      form: {
        symptoms: formData.get('symptoms')?.toString() ?? ''
      }
    };
  }

  try {
    const input: SymptomCheckInput = {
        symptoms: validatedFields.data.symptoms,
    };
    const result = await symptomCheck(input);

    // Standardize bullet points for consistent display
    const formatAdvice = (text: string) => text.replace(/[•*]/g, '-');

    const formattedResult: SymptomCheckOutput = {
      homeopathyAdvice: formatAdvice(result.homeopathyAdvice),
      ayurvedicAdvice: formatAdvice(result.ayurvedicAdvice),
      remedies: formatAdvice(result.remedies),
    }

    return {
      data: formattedResult,
      error: null,
      form: {
        symptoms: validatedFields.data.symptoms
      }
    };
  } catch (error) {
    console.error(error);
    return {
      data: null,
      error: "An unexpected error occurred. Please check your API key and try again.",
      form: {
        symptoms: validatedFields.data.symptoms
      }
    };
  }
}

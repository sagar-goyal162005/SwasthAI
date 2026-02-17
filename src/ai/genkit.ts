import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';
import { getGeminiApiKey } from '@/lib/gemini-env';

// Map the configured Gemini key to the env var(s) expected by Genkit/GoogleAI.
// Do not throw here; missing keys are handled by the calling server actions.
const key = getGeminiApiKey();
if (key) {
  process.env.GEMINI_API_KEY ||= key;
  process.env.GOOGLE_GENAI_API_KEY ||= key;
}

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash',
});

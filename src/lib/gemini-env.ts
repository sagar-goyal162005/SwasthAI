export function getGeminiApiKey(): string | undefined {
  return (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
}

export function requireGeminiApiKey(): string {
  const key = getGeminiApiKey();
  if (!key) {
    throw new Error(
      'Gemini API key is missing. Set GEMINI_API_KEY (or GOOGLE_GENAI_API_KEY) in your server environment and restart/redeploy.'
    );
  }
  return key;
}

/**
 * Ensures Genkit's Google AI plugin can see the key regardless of which env var name was provided.
 */
export function ensureGeminiEnv(): string {
  const key = requireGeminiApiKey();

  if (!process.env.GEMINI_API_KEY) {
    process.env.GEMINI_API_KEY = key;
  }
  if (!process.env.GOOGLE_GENAI_API_KEY) {
    process.env.GOOGLE_GENAI_API_KEY = key;
  }

  return key;
}

import { GoogleGenAI } from '@google/genai';

interface EditEvaluationParams {
  field: string;
  oldValue: string | null;
  newValue: string;
  reason: string | null;
}

export interface AIModerationResult {
  aiStatus: 'passed' | 'flagged' | 'rejected';
  aiConfidence: number;
  aiReasoning: string;
}

export async function evaluateEditWithAI(
  params: EditEvaluationParams,
  apiKey?: string
): Promise<AIModerationResult> {
  const key = apiKey || (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.GOOGLE_GENAI_API_KEY : undefined);

  if (!key) {
    return {
      aiStatus: 'passed',
      aiConfidence: 0.5,
      aiReasoning: 'AI evaluation skipped (No GEMINI_API_KEY configured)',
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: key });

    const prompt = `You are a strict community content moderator for game database hoGAMEGATA.
Evaluate the following proposed edit to a video game metadata field.

Field Being Edited: "${params.field}"
Current Value: "${params.oldValue || '(Empty)'}"
Proposed New Value: "${params.newValue}"
User Reason: "${params.reason || '(None)'}"

Analyze if this proposed edit contains:
1. Profanity, hate speech, or offensive content.
2. Spam, vandalism, promo links, or nonsense (e.g. "Skibidi Toilet", gibberish text).
3. Obvious joke edits or malicious changes.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "isSpamOrVandalism": boolean,
  "confidenceScore": number (0.0 to 1.0),
  "reasoning": string (short 1-sentence explanation)
}`;

    const fetchPromise = ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI moderation timeout')), 3500)
    );

    const response = await Promise.race([fetchPromise, timeoutPromise]);

    const text = response.text;
    if (!text) {
      throw new Error('Empty AI response');
    }

    const parsed = JSON.parse(text);
    const isSpam = Boolean(parsed.isSpamOrVandalism);
    const confidence = typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.8;
    const reasoning = parsed.reasoning || (isSpam ? 'Flagged by AI safety filter' : 'Passed AI safety filter');

    let aiStatus: 'passed' | 'flagged' | 'rejected' = 'passed';
    if (isSpam && confidence >= 0.85) {
      aiStatus = 'rejected';
    } else if (isSpam || confidence < 0.6) {
      aiStatus = 'flagged';
    }

    return {
      aiStatus,
      aiConfidence: confidence,
      aiReasoning: reasoning,
    };
  } catch (error) {
    console.warn('⚠️ AI moderation check error:', error instanceof Error ? error.message : error);
    return {
      aiStatus: 'passed',
      aiConfidence: 0.5,
      aiReasoning: 'AI evaluation fallback due to error',
    };
  }
}

import { supabase } from '@/integrations/supabase/client';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface SessionContext {
  sessionId: string;
  mood: string | null;
  messageCount: number;
  startedAt: Date;
}

const CRISIS_KEYWORDS = [
  'hurt myself', 'kill myself', 'end it', 'end my life',
  'suicide', 'want to die', 'don\'t want to live',
  'self harm', 'self-harm', 'cutting myself',
];

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function detectCrisisLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return CRISIS_KEYWORDS.some(kw => lower.includes(kw));
}

/**
 * Sends a user message to the FastAPI backend first, with a controlled
 * fallback to the legacy StackAI edge function if the new backend is down.
 */
export async function sendMessageToStackAI(
  message: string,
  sessionContext: SessionContext,
  userId: string
): Promise<ReadableStream<Uint8Array> | null> {
  const backendBaseUrl = (import.meta.env.VITE_BLOOM_BACKEND_URL || 'http://localhost:8000').replace(/\/$/, '');
  const backendUrl = `${backendBaseUrl}/chat`;
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new Error('Your session is not available yet. Please sign in again.');
  }

  try {
    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message,
        session_id: sessionContext.sessionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const backendError = errorData?.detail || errorData?.error || `Request failed: ${response.status}`;
      throw new Error(backendError);
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (contentType.includes('text/plain') && response.body) {
      return response.body;
    }

    const data = await response.json();
    const output = data.response || 'No response received.';

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(output));
        controller.close();
      },
    });
    return stream;
  } catch (backendError) {
    // Only fall back to the legacy StackAI edge function on genuine outage conditions
    // (network failure, 502 Bad Gateway, 503 Service Unavailable).
    // Do NOT fall back on auth errors (401) or validation errors (400/422) — those
    // are real problems that would produce equally wrong results on the legacy path.
    const isOutage =
      backendError instanceof TypeError || // network failure (fetch failed)
      (backendError instanceof Error && /502|503|504/.test(backendError.message));

    if (!isOutage) {
      throw backendError;
    }
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/stackai-chat`;
    const legacyResponse = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        message,
        session_id: sessionContext.sessionId,
        user_id: userId,
      }),
    });

    if (!legacyResponse.ok) {
      throw backendError instanceof Error ? backendError : new Error('Unable to reach the chat service.');
    }

    const legacyContentType = legacyResponse.headers.get('Content-Type') || '';
    if (legacyContentType.includes('text/plain') && legacyResponse.body) {
      return legacyResponse.body;
    }

    const legacyData = await legacyResponse.json();
    const legacyOutput = legacyData.response || legacyData.outputs?.['out-0'] || 'No response received.';
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(legacyOutput));
        controller.close();
      },
    });
    return stream;
  }
}

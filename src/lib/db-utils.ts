import { supabase } from '@/integrations/supabase/client';
import type { Message } from './chat-utils';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function ensureSessionExists(sessionId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to verify the current conversation: ${error.message}`);
  }

  if (data?.id) {
    return true;
  }

  const { error: insertError } = await supabase
    .from('sessions')
    .insert({ id: sessionId, user_id: userId });

  if (insertError) {
    throw new Error(`Unable to create the conversation: ${insertError.message}`);
  }

  return true;
}

// --- Chat History ---
export async function saveMessage(sessionId: string, message: Message) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You need to be signed in to save messages.');

  const sessionReady = await ensureSessionExists(sessionId, user.id);
  if (!sessionReady) {
    return;
  }

  const { error } = await supabase
    .from('messages')
    .upsert({
      id: message.id,
      session_id: sessionId,
      user_id: user.id,
      role: message.role,
      content: message.content,
      created_at: message.timestamp.toISOString()
    }, { onConflict: 'id' });

  if (error) {
    throw new Error(`Unable to save your message: ${error.message}`);
  }
}

export async function getChatHistory(sessionId: string): Promise<Message[]> {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Unable to load this conversation: ${error.message}`);
  }

  return data.map((msg: any) => ({
    id: msg.id,
    role: msg.role as 'user' | 'assistant',
    content: msg.content,
    timestamp: new Date(msg.created_at)
  }));
}

export async function getOrCreateTodaySession(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You need to be signed in to start a conversation.');

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  
  // Find a session created today (local time)
  const { data, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('user_id', user.id)
    .gte('created_at', startOfDay)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load today's conversation: ${error.message}`);
  }

  if (data?.id) return data.id;

  // Otherwise create a new one
  const newId = `sess_${Date.now()}`;
  const { error: insertError } = await supabase.from('sessions').insert({ id: newId, user_id: user.id });
  if (insertError) {
    throw new Error(`Unable to create a new conversation: ${insertError.message}`);
  }
  
  return newId;
}

// --- Session Management (Chat Memory) ---

export interface SessionInfo {
  id: string;
  created_at: string;
  preview: string;
}

export async function getAllSessions(): Promise<SessionInfo[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch all sessions for the user
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error || !sessions || sessions.length === 0) {
    if (error) {
      throw new Error(`Unable to load conversation history: ${error.message}`);
    }
    return [];
  }

  // Batch-fetch the first user message for ALL sessions in a single query
  const sessionIds = sessions.map(s => s.id);
  const { data: allMessages } = await supabase
    .from('messages')
    .select('session_id, content, created_at')
    .in('session_id', sessionIds)
    .eq('role', 'user')
    .order('created_at', { ascending: true });

  // Build a lookup: session_id -> first message content
  const previewMap: Record<string, string> = {};
  if (allMessages) {
    for (const msg of allMessages) {
      // Only keep the first message per session (they're ordered ascending)
      if (!previewMap[msg.session_id]) {
        previewMap[msg.session_id] = msg.content?.slice(0, 60) || 'New conversation';
      }
    }
  }

  return sessions.map(session => ({
    id: session.id,
    created_at: session.created_at,
    preview: previewMap[session.id] || 'New conversation',
  }));
}

export async function createNewSession(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You need to be signed in to start a conversation.');

  const newId = `sess_${Date.now()}`;
  const { error } = await supabase.from('sessions').insert({ id: newId, user_id: user.id });
  if (error) {
    throw new Error(`Unable to create a new conversation: ${error.message}`);
  }
  return newId;
}

export async function deleteSession(sessionId: string) {
  const { error } = await supabase
    .from('sessions')
    .delete()
    .eq('id', sessionId);
  
  if (error) {
    throw new Error(`Unable to clear this conversation: ${error.message}`);
  }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// --- Mood History ---
export async function saveMood(mood: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You need to be signed in to save your mood.');

  const today = formatLocalDate(new Date());
  
  const { error } = await supabase
    .from('mood_logs')
    .upsert(
      { user_id: user.id, date: today, mood: mood },
      { onConflict: 'user_id, date' }
    );

  if (error) {
    throw new Error(`Unable to save your mood: ${error.message}`);
  }
}

export async function getTodayMood(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const today = formatLocalDate(new Date());

  const { data, error } = await supabase
    .from('mood_logs')
    .select('mood')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load today's mood: ${error.message}`);
  }

  return data?.mood || null;
}

export interface MoodLogEntry {
  date: string;
  mood: string;
}

const MOOD_TO_SCORE: Record<string, number> = {
  'Awful': 1, 'Bad': 2, 'Okay': 3, 'Good': 4, 'Great': 5,
  'Anxious': 2, 'Overwhelmed': 2, 'Sad': 2, 'Numb': 2,
  'Exhausted': 2, "I'm okay": 3, 'Hopeful': 4, 'Grateful': 5,
};

export function moodToScore(mood: string): number {
  return MOOD_TO_SCORE[mood] ?? 3;
}

export async function getMoodHistory(days: number = 7): Promise<MoodLogEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = formatLocalDate(startDate);

  const { data, error } = await supabase
    .from('mood_logs')
    .select('date, mood')
    .eq('user_id', user.id)
    .gte('date', startStr)
    .order('date', { ascending: true });

  if (error) {
    throw new Error(`Unable to load mood insights: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    date: row.date,
    mood: row.mood,
  }));
}

// --- Thought Records ---
export interface ThoughtRecordInput {
  situation: string;
  thoughts: string;
  emotions: string;
  reframe: string;
}

export interface ThoughtRecordEntry {
  id: string;
  created_at: string;
  situation: string;
  thoughts: string;
  emotions: string;
  reframe: string;
}

export async function saveThoughtRecord(record: ThoughtRecordInput) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('You need to be signed in to save a thought record.');

  const { error } = await supabase
    .from('thought_records')
    .insert({
      user_id: user.id,
      situation: record.situation,
      thoughts: record.thoughts,
      emotions: record.emotions,
      reframe: record.reframe
    });

  if (error) {
    throw new Error(`Unable to save the thought record: ${error.message}`);
  }
}

export async function getThoughtRecords(): Promise<ThoughtRecordEntry[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('thought_records')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Unable to load thought records: ${error.message}`);
  }

  return (data || []).map((r: any) => ({
    id: r.id,
    created_at: r.created_at,
    situation: r.situation || '',
    thoughts: r.thoughts || '',
    emotions: r.emotions || '',
    reframe: r.reframe || '',
  }));
}

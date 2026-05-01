import { Message } from "./chat-utils";

const KEYS = {
  CHAT_HISTORY: "bloom_chat_history",
  MOOD_HISTORY: "bloom_mood_history",
  THOUGHT_RECORDS: "bloom_thought_records"
};

// --- Chat History ---
export function saveChatHistory(messages: Message[]) {
  try {
    localStorage.setItem(KEYS.CHAT_HISTORY, JSON.stringify(messages));
  } catch (e) {
    console.error("Failed to save chat history", e);
  }
}

export function getChatHistory(): Message[] {
  try {
    const data = localStorage.getItem(KEYS.CHAT_HISTORY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load chat history", e);
    return [];
  }
}

// --- Mood History ---
export function saveMood(mood: string) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = getMoodHistory();
    data[today] = mood;
    localStorage.setItem(KEYS.MOOD_HISTORY, JSON.stringify(data));
  } catch (e) {
    console.error("Failed to save mood", e);
  }
}

export function getMoodHistory(): Record<string, string> {
  try {
    const data = localStorage.getItem(KEYS.MOOD_HISTORY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error("Failed to load mood history", e);
    return {};
  }
}

export function getTodayMood(): string | null {
  const today = new Date().toISOString().split('T')[0];
  return getMoodHistory()[today] || null;
}

// --- Thought Records ---
export interface ThoughtRecord {
  id: string;
  date: string;
  situation: string;
  thoughts: string;
  emotions: string;
  reframe: string;
}

export function saveThoughtRecord(record: Omit<ThoughtRecord, 'id' | 'date'>) {
  try {
    const records = getThoughtRecords();
    records.push({
      ...record,
      id: Math.random().toString(36).substring(7),
      date: new Date().toISOString()
    });
    localStorage.setItem(KEYS.THOUGHT_RECORDS, JSON.stringify(records));
  } catch (e) {
    console.error("Failed to save thought record", e);
  }
}

export function getThoughtRecords(): ThoughtRecord[] {
  try {
    const data = localStorage.getItem(KEYS.THOUGHT_RECORDS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load thought records", e);
    return [];
  }
}

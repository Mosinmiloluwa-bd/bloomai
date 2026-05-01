export interface PilotMetrics {
  date: string;
  chatRequestFailures: number;
  messageSaveFailures: number;
  moodSaveFailures: number;
  thoughtRecordSaveFailures: number;
  authFailures: number;
  sessionSwitchFailures: number;
  firstResponseCount: number;
  totalFirstResponseLatencyMs: number;
}

const STORAGE_KEY = 'bloom.pilot-metrics.v1';

type CounterMetric =
  | 'chatRequestFailures'
  | 'messageSaveFailures'
  | 'moodSaveFailures'
  | 'thoughtRecordSaveFailures'
  | 'authFailures'
  | 'sessionSwitchFailures';

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createEmptyMetrics(date: string): PilotMetrics {
  return {
    date,
    chatRequestFailures: 0,
    messageSaveFailures: 0,
    moodSaveFailures: 0,
    thoughtRecordSaveFailures: 0,
    authFailures: 0,
    sessionSwitchFailures: 0,
    firstResponseCount: 0,
    totalFirstResponseLatencyMs: 0,
  };
}

function readMetricsStore(): Record<string, PilotMetrics> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, PilotMetrics>;
  } catch {
    return {};
  }
}

function writeMetricsStore(store: Record<string, PilotMetrics>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

function updateMetrics(mutator: (metrics: PilotMetrics) => void): PilotMetrics {
  const today = formatLocalDate(new Date());
  const store = readMetricsStore();
  const metrics = store[today] ?? createEmptyMetrics(today);
  mutator(metrics);
  store[today] = metrics;
  writeMetricsStore(store);
  return metrics;
}

export function getTodayPilotMetrics(): PilotMetrics {
  const today = formatLocalDate(new Date());
  return readMetricsStore()[today] ?? createEmptyMetrics(today);
}

export function incrementPilotMetric(metric: CounterMetric): PilotMetrics {
  return updateMetrics((metrics) => {
    metrics[metric] += 1;
  });
}

export function recordPilotFirstResponseLatency(durationMs: number): PilotMetrics {
  return updateMetrics((metrics) => {
    metrics.firstResponseCount += 1;
    metrics.totalFirstResponseLatencyMs += Math.max(0, Math.round(durationMs));
  });
}

export function getAverageFirstResponseMs(metrics: PilotMetrics): number | null {
  if (metrics.firstResponseCount === 0) return null;
  return Math.round(metrics.totalFirstResponseLatencyMs / metrics.firstResponseCount);
}

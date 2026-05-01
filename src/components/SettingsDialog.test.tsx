import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { SettingsDialog } from './SettingsDialog';
import { deleteSession, getCurrentUser } from '@/lib/db-utils';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/lib/pilot-metrics', () => ({
  getTodayPilotMetrics: vi.fn().mockReturnValue({
    date: '2026-04-23',
    chatRequestFailures: 0,
    messageSaveFailures: 0,
    moodSaveFailures: 0,
    thoughtRecordSaveFailures: 0,
    authFailures: 0,
    sessionSwitchFailures: 0,
    firstResponseCount: 0,
    totalFirstResponseLatencyMs: 0,
  }),
  getAverageFirstResponseMs: vi.fn().mockReturnValue(null),
  incrementPilotMetric: vi.fn(),
}));

vi.mock('@/lib/db-utils', () => ({
  getCurrentUser: vi.fn(),
  deleteSession: vi.fn(),
}));

describe('SettingsDialog', () => {
  it('shows an error and keeps the session when clear chat fails', async () => {
    const onSessionDeleted = vi.fn();
    vi.mocked(getCurrentUser).mockResolvedValue({ email: 'pilot@example.com', created_at: '2026-04-23T00:00:00Z' } as any);
    vi.mocked(deleteSession).mockRejectedValueOnce(new Error('delete failed'));
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<SettingsDialog currentSessionId="sess_123" onSessionDeleted={onSessionDeleted} />);

    fireEvent.click(screen.getByRole('button', { name: /clear chat/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onSessionDeleted).not.toHaveBeenCalled();
  });
});

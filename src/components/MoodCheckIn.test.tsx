import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { MoodCheckIn } from './MoodCheckIn';
import { saveMood } from '@/lib/db-utils';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/lib/pilot-metrics', () => ({
  incrementPilotMetric: vi.fn(),
}));

vi.mock('@/lib/db-utils', () => ({
  saveMood: vi.fn(),
}));

describe('MoodCheckIn', () => {
  it('does not complete the flow when saving the mood fails', async () => {
    const onComplete = vi.fn();
    vi.mocked(saveMood).mockRejectedValueOnce(new Error('save failed'));

    render(<MoodCheckIn onComplete={onComplete} />);

    fireEvent.click(screen.getByRole('button', { name: /awful/i }));
    fireEvent.click(screen.getByRole('button', { name: /log mood/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onComplete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /log mood/i })).toBeEnabled();
  });
});

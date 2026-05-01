import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { toast } from 'sonner';
import { ThoughtRecordDrawer } from './ThoughtRecordDrawer';
import { saveThoughtRecord } from '@/lib/db-utils';

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
  saveThoughtRecord: vi.fn(),
  getThoughtRecords: vi.fn().mockResolvedValue([]),
}));

describe('ThoughtRecordDrawer', () => {
  it('keeps the form values when saving fails', async () => {
    vi.mocked(saveThoughtRecord).mockRejectedValueOnce(new Error('save failed'));

    render(<ThoughtRecordDrawer open onClose={vi.fn()} />);

    const situation = screen.getByLabelText(/situation/i);
    fireEvent.change(screen.getByLabelText(/automatic thoughts/i), { target: { value: 'Everyone noticed.' } });
    fireEvent.change(screen.getByLabelText(/emotions/i), { target: { value: 'Anxious 80' } });
    fireEvent.change(screen.getByLabelText(/balanced reframe/i), { target: { value: 'I can recover and keep going.' } });
    fireEvent.change(situation, { target: { value: 'I froze during class.' } });
    fireEvent.click(screen.getByRole('button', { name: /save thought record/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(situation).toHaveValue('I froze during class.');
    expect(screen.getByRole('button', { name: /save thought record/i })).toBeEnabled();
  });
});

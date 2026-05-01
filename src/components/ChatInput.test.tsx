import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ChatInput } from './ChatInput';

describe('ChatInput', () => {
  it('preserves the draft when send fails', async () => {
    const onSend = vi.fn().mockResolvedValue(false);

    render(
      <ChatInput
        onSend={onSend}
        onOpenThoughtRecord={vi.fn()}
        disabled={false}
        crisisLock={false}
      />,
    );

    const textbox = screen.getByLabelText(/message input/i);
    fireEvent.change(textbox, { target: { value: 'Need a retry' } });
    fireEvent.click(screen.getByRole('button', { name: /send message/i }));

    await waitFor(() => expect(onSend).toHaveBeenCalledWith('Need a retry'));
    expect(textbox).toHaveValue('Need a retry');
  });
});

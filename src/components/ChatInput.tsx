import { Send, BookOpen } from 'lucide-react';
import { useState, useRef, KeyboardEvent } from 'react';

interface ChatInputProps {
  onSend: (message: string) => Promise<boolean>;
  onOpenThoughtRecord: () => void;
  disabled: boolean;
  crisisLock: boolean;
}

export function ChatInput({ onSend, onOpenThoughtRecord, disabled, crisisLock }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    // Clear input immediately so the user gets instant feedback
    setValue('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    
    const success = await onSend(trimmed);
    if (!success) {
      // If sending failed (e.g. crisis lock or error), restore the text
      setValue(trimmed);
      setTimeout(handleInput, 0); // Restore height
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 120) + 'px';
    }
  };

  return (
    <div className="border-t border-border bg-card p-2.5 sm:p-3" style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
      {crisisLock && (
        <div className="mb-2 text-xs sm:text-sm text-safety-foreground bg-safety rounded-lg px-3 py-2 animate-fade-in-up" role="alert">
          Before you continue — we see you. Please reach out to a counselor or call{' '}
          <a href="tel:988" className="font-semibold underline">988</a>.
        </div>
      )}
      <div className="flex items-end gap-1.5 sm:gap-2 max-w-3xl mx-auto">
        <button
          onClick={onOpenThoughtRecord}
          className="p-2 sm:p-2.5 rounded-full hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Open thought record"
          title="Thought Record"
        >
          <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { setValue(e.target.value); handleInput(); }}
          onKeyDown={handleKeyDown}
          placeholder="Share what's on your mind…"
          className="flex-1 resize-none rounded-xl border border-input bg-background px-3 sm:px-4 py-2 sm:py-2.5 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 transition-shadow"
          rows={1}
          disabled={disabled}
          aria-label="Message input"
        />
        <button
          onClick={() => void handleSend()}
          disabled={disabled || !value.trim()}
          className="p-2 sm:p-2.5 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 flex-shrink-0"
          aria-label="Send message"
        >
          <Send className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>
      </div>
    </div>
  );
}

import ReactMarkdown from 'react-markdown';
import type { Message } from '@/lib/chat-utils';

interface ChatMessageProps {
  message: Message;
  index: number;
}

export function ChatMessage({ message, index }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex animate-fade-in-up ${isUser ? 'justify-end' : 'justify-start'}`}
      style={{ animationDelay: `${index * 50}ms` }}
      role="article"
      aria-label={`${isUser ? 'You' : 'Wellness companion'} said`}
    >
      <div className={`max-w-[80%] sm:max-w-[70%] ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
        {isUser ? (
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="prose prose-sm max-w-none text-card-foreground prose-strong:text-card-foreground prose-blockquote:border-sage prose-blockquote:text-muted-foreground">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

export function TypingIndicator() {
  return (
    <div className="flex justify-start animate-fade-in-up" role="status" aria-label="Companion is typing">
      <div className="chat-bubble-ai flex items-center gap-1.5 px-5 py-4">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-2 h-2 rounded-full bg-muted-foreground/50 animate-pulse-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { MessageSquarePlus, MessageSquare, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getAllSessions, type SessionInfo } from '@/lib/db-utils';
import { cn } from '@/lib/utils';

interface ChatHistoryListProps {
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  refreshKey?: number;
}

export function ChatHistoryList({ activeSessionId, onSelectSession, onNewChat, refreshKey }: ChatHistoryListProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      if (sessions.length === 0) setLoading(true);
      try {
        const data = await getAllSessions();
        if (mounted) {
          setSessions(data);
        }
      } catch (error) {
        if (mounted) {
          setSessions([]);
        }
        toast.error(error instanceof Error ? error.message : 'Unable to load conversation history.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    load();
    return () => { mounted = false; };
  }, [refreshKey]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    const isSameDay = (d1: Date, d2: Date) => 
      d1.getFullYear() === d2.getFullYear() && 
      d1.getMonth() === d2.getMonth() && 
      d1.getDate() === d2.getDate();

    if (isSameDay(date, now)) return 'Today';
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (isSameDay(date, yesterday)) return 'Yesterday';
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Group sessions by date
  const grouped: Record<string, SessionInfo[]> = {};
  for (const s of sessions) {
    const key = formatDate(s.created_at);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Conversations</p>
        <button
          onClick={onNewChat}
          className="flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors px-2 py-1 rounded-md hover:bg-primary/10"
          aria-label="Start new conversation"
        >
          <MessageSquarePlus className="w-3.5 h-3.5" />
          New
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : sessions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">No conversations yet.</p>
      ) : (
        <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1 -mr-1">
          {Object.entries(grouped).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-1.5 px-1">
                {dateLabel}
              </p>
              <div className="space-y-0.5">
                {items.map(session => (
                  <button
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={cn(
                      "w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all duration-150",
                      activeSessionId === session.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                    )}
                    aria-current={activeSessionId === session.id ? 'true' : undefined}
                  >
                    <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 opacity-60" />
                    <span className="truncate">{session.preview}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

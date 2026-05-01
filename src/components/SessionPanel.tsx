import { MoodTracker } from './MoodTracker';
import { Leaf, PanelLeftClose } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { DailyAffirmation } from './DailyAffirmation';
import { ChatHistoryList } from './ChatHistoryList';

interface SessionPanelProps {
  mood: string | null;
  onCollapse: () => void;
  activeSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewChat: () => void;
  historyRefreshKey?: number;
}

export function SessionPanel({ mood, onCollapse, activeSessionId, onSelectSession, onNewChat, historyRefreshKey }: SessionPanelProps) {

  return (
    <aside className="w-[85vw] sm:w-72 bg-sidebar border-r border-sidebar-border flex flex-col h-full" aria-label="Session panel">
      <div className="p-3 sm:p-4 flex items-center justify-between border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Leaf className="w-5 h-5 text-primary" aria-hidden="true" />
          <h1 className="font-display text-lg font-semibold text-sidebar-foreground">Bloom</h1>
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <button onClick={onCollapse} className="p-1.5 rounded-full hover:bg-muted transition-colors" aria-label="Collapse panel">
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-3 sm:p-4 space-y-5 sm:space-y-6 overflow-y-auto">
        <MoodTracker mood={mood} />
        
        <DailyAffirmation />

        {/* Chat History */}
        <ChatHistoryList
          activeSessionId={activeSessionId}
          onSelectSession={onSelectSession}
          onNewChat={onNewChat}
          refreshKey={historyRefreshKey}
        />

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">About This Space</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            This is a safe, judgment-free space for reflection. Your conversations help you explore thoughts and feelings at your own pace.
          </p>
        </div>
      </div>
    </aside>
  );
}

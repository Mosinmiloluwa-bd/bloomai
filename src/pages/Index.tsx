import { useState, useRef, useEffect, useCallback } from 'react';
import { PanelLeftOpen } from 'lucide-react';
import { toast } from 'sonner';
import { SessionPanel } from '@/components/SessionPanel';
import { ChatMessage, TypingIndicator } from '@/components/ChatMessage';
import { ChatInput } from '@/components/ChatInput';
import { QuickReplyChips } from '@/components/QuickReplyChips';
import { BreathingExercise } from '@/components/BreathingExercise';
import { ThoughtRecordDrawer } from '@/components/ThoughtRecordDrawer';
import { OrganicBackground } from '@/components/OrganicBackground';
import { CrisisBanner } from '@/components/CrisisBanner';
import { MoodCheckIn } from '@/components/MoodCheckIn';
import { SettingsDialog } from '@/components/SettingsDialog';
import { WellnessTip } from '@/components/WellnessTip';
import {
  type Message,
  type SessionContext,
  detectCrisisLanguage,
  sendMessageToStackAI,
} from '@/lib/chat-utils';
import {
  getChatHistory,
  getTodayMood,
  getOrCreateTodaySession,
  createNewSession,
  getCurrentUser,
} from '@/lib/db-utils';
import { incrementPilotMetric, recordPilotFirstResponseLatency } from '@/lib/pilot-metrics';
import { Loader2 } from 'lucide-react';

export default function Index() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showChips, setShowChips] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth >= 1024 : true);
  const [thoughtRecordOpen, setThoughtRecordOpen] = useState(false);
  const [crisisLock, setCrisisLock] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [session, setSession] = useState<SessionContext | null>(null);
  const [mood, setMood] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [showMoodCheckIn, setShowMoodCheckIn] = useState(false);

  // Chat history refresh key (incremented when sessions change)
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  // Wellness tip state
  const [showTip, setShowTip] = useState(false);
  const [tipDismissedAt, setTipDismissedAt] = useState(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);

    inactivityTimerRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - tipDismissedAt > 5 * 60 * 1000 && !showTip) {
        setShowTip(true);
      }
    }, 3 * 60 * 1000);
  }, [tipDismissedAt, showTip]);

  // Load user data on mount
  useEffect(() => {
    async function loadData() {
      try {
        const u = await getCurrentUser();
        setUser(u);

        const sessionId = await getOrCreateTodaySession();
        const history = await getChatHistory(sessionId);
        let todayMood: string | null = null;

        try {
          todayMood = await getTodayMood();
        } catch (err) {
          console.error("Error loading mood data:", err);
          toast.error(err instanceof Error ? err.message : 'Unable to load your latest mood check-in.');
        }

        setSession({
          sessionId,
          mood: todayMood,
          messageCount: history.length,
          startedAt: new Date(),
        });
        setMessages(history);
        setMood(todayMood);
        if (!todayMood) setShowMoodCheckIn(true);
        setShowChips(history.length === 0);
      } catch (err) {
        console.error("Error loading initial data:", err);
        incrementPilotMetric('sessionSwitchFailures');
        toast.error(err instanceof Error ? err.message : 'Unable to load your conversation right now.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Inactivity timer for wellness tips
  useEffect(() => {
    resetInactivityTimer();

    const handleActivity = () => {
      resetInactivityTimer();
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        resetInactivityTimer();
      }
    };

    window.addEventListener('pointerdown', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity, true);
    window.addEventListener('touchstart', handleActivity, { passive: true });
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('pointerdown', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity, true);
      window.removeEventListener('touchstart', handleActivity);
      document.removeEventListener('visibilitychange', handleVisibility);
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 50);
  }, []);

  useEffect(scrollToBottom, [messages, isTyping, scrollToBottom]);

  const aiMessageCount = messages.filter(m => m.role === 'assistant').length;
  const showBreathing = aiMessageCount > 0 && aiMessageCount % 6 === 0 && !isTyping;

  // Show a tip after every 6th AI response (alternating with breathing)
  useEffect(() => {
    if (aiMessageCount > 0 && aiMessageCount % 6 === 3 && !isTyping) {
      const now = Date.now();
      if (now - tipDismissedAt > 5 * 60 * 1000) {
        setShowTip(true);
      }
    }
  }, [aiMessageCount, isTyping, tipDismissedAt]);

  const handleDismissTip = useCallback(() => {
    setShowTip(false);
    setTipDismissedAt(Date.now());
  }, []);

  const handleSend = async (content: string): Promise<boolean> => {
    if (!session) {
      toast.error('Your conversation is still loading. Please try again in a moment.');
      return false;
    }
    if (!user?.id) {
      toast.error('Your account details are still loading. Please try again in a moment.');
      return false;
    }
    resetInactivityTimer();

    if (detectCrisisLanguage(content)) {
      setCrisisLock(true);
      setTimeout(() => setCrisisLock(false), 3000);
      return false;
    }

    const userMsg: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const requestStartedAt = performance.now();
    const hadNoMessages = messages.length === 0;
    let responseStarted = false;

    setMessages(prev => [...prev, userMsg]);
    setShowChips(false);
    setShowTip(false);
    setIsTyping(true);

    try {
      const stream = await sendMessageToStackAI(content, session, user.id);
      if (!stream) throw new Error('No response stream');

      setSession(prev => prev ? { ...prev, messageCount: prev.messageCount + 1 } : null);

      const reader = stream.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      const assistantId = `msg_${Date.now()}_ai`;

      setIsTyping(false);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!responseStarted) {
          responseStarted = true;
          recordPilotFirstResponseLatency(performance.now() - requestStartedAt);
        }
        fullText += decoder.decode(value, { stream: true });

        setMessages(prev => {
          const existing = prev.find(m => m.id === assistantId);
          if (existing) {
            return prev.map(m => m.id === assistantId ? { ...m, content: fullText } : m);
          }
          return [...prev, { id: assistantId, role: 'assistant', content: fullText, timestamp: new Date() }];
        });
      }
      
      return true;
    } catch (err) {
      console.error('Chat error:', err);
      setIsTyping(false);
      incrementPilotMetric('chatRequestFailures');

      if (!responseStarted) {
        setMessages(prev => prev.filter(message => message.id !== userMsg.id));
        if (hadNoMessages) {
          setShowChips(true);
        }
        toast.error(err instanceof Error ? err.message : 'Unable to send that message right now.');
        return false;
      }

      const errMsg: Message = { id: `msg_${Date.now()}_err`, role: 'assistant', content: "I'm sorry, I wasn't able to respond. Please try again in a moment.", timestamp: new Date() };
      setMessages(prev => [...prev, errMsg]);
      toast.error('The response was interrupted. Please try again.');
      return true;
    }
  };

  const handleMoodCheckInComplete = (selectedMood: string) => {
    setMood(selectedMood);
    setSession(prev => prev ? { ...prev, mood: selectedMood } : prev);
    setShowMoodCheckIn(false);
    
    // Only send the mood as the first message if the conversation is empty
    // This prevents duplication if history was already loaded or saved
    if (messages.length === 0) {
      void handleSend(selectedMood);
    }
  };

  const handleMoodSelect = (selectedMood: string) => {
    setMood(selectedMood);
    setSession(prev => prev ? { ...prev, mood: selectedMood } : prev);
    void handleSend(selectedMood);
  };

  // --- Session switching (chat memory) ---
  const handleSelectSession = async (sessionId: string) => {
    if (session?.sessionId === sessionId) return;
    setSwitching(true);

    try {
      const history = await getChatHistory(sessionId);
      setSession(prev => prev ? {
        ...prev,
        sessionId,
        messageCount: history.length,
        startedAt: new Date(),
      } : null);
      setMessages(history);
      setShowChips(history.length === 0);
      setShowTip(false);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setPanelOpen(false);
      }
    } catch (err) {
      incrementPilotMetric('sessionSwitchFailures');
      toast.error(err instanceof Error ? err.message : 'Unable to switch conversations right now.');
    } finally {
      setSwitching(false);
    }
  };

  const handleNewChat = async () => {
    setSwitching(true);
    try {
      const newSessionId = await createNewSession();
      setSession(prev => prev ? {
        ...prev,
        sessionId: newSessionId,
        messageCount: 0,
        startedAt: new Date(),
      } : {
        sessionId: newSessionId,
        mood: mood,
        messageCount: 0,
        startedAt: new Date(),
      });
      setMessages([]);
      setShowChips(true);
      setShowTip(false);
      setHistoryRefreshKey(prev => prev + 1);
      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
        setPanelOpen(false);
      }
    } catch (err) {
      incrementPilotMetric('sessionSwitchFailures');
      toast.error(err instanceof Error ? err.message : 'Unable to start a new conversation right now.');
    } finally {
      setSwitching(false);
    }
  };

  const handleSessionDeleted = () => {
    void handleNewChat();
    setHistoryRefreshKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] w-full bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "there";

  return (
    <div className="flex h-[100dvh] w-full relative overflow-hidden bg-background">
      <OrganicBackground />

      {switching && (
        <div className="absolute inset-0 z-[60] bg-background/20 backdrop-blur-[2px] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      )}

      {showMoodCheckIn && (
        <div className="absolute inset-0 z-[100] bg-background/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md animate-fade-in-up">
            <MoodCheckIn onComplete={handleMoodCheckInComplete} />
          </div>
        </div>
      )}

      {/* Desktop panel */}
      {panelOpen && (
        <div className="hidden lg:block relative z-10 flex-shrink-0 border-r border-border bg-sidebar/50 backdrop-blur-sm">
          <SessionPanel
            mood={mood}
            onCollapse={() => setPanelOpen(false)}
            activeSessionId={session?.sessionId || null}
            onSelectSession={handleSelectSession}
            onNewChat={handleNewChat}
            historyRefreshKey={historyRefreshKey}
          />
        </div>
      )}

      {/* Mobile panel overlay */}
      {panelOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm transition-opacity" onClick={() => setPanelOpen(false)} />
          <div className="relative z-10 h-full w-[85vw] bg-sidebar/95 backdrop-blur-md border-r border-border">
            <SessionPanel
              mood={mood}
              onCollapse={() => setPanelOpen(false)}
              activeSessionId={session?.sessionId || null}
              onSelectSession={handleSelectSession}
              onNewChat={handleNewChat}
              historyRefreshKey={historyRefreshKey}
            />
          </div>
        </div>
      )}

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 relative z-10 pb-[env(safe-area-inset-bottom)]" style={{ paddingBottom: '110px' }}>
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm pt-[env(safe-area-inset-top)] min-h-[56px]">
          <div className="flex items-center">
            {!panelOpen && (
              <button onClick={() => setPanelOpen(true)} className="p-2 rounded-full hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="Open sidebar">
                <PanelLeftOpen className="w-5 h-5 text-muted-foreground" />
              </button>
            )}
            <span className="ml-2 font-display text-lg font-semibold text-foreground lg:hidden">Bloom</span>
          </div>
          <SettingsDialog 
            currentSessionId={session?.sessionId} 
            onSessionDeleted={handleSessionDeleted} 
          />
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-3xl mx-auto space-y-3 sm:space-y-4">
            {/* Welcome */}
            {messages.length === 0 && (
              <div className="text-center py-8 sm:py-12 space-y-3 sm:space-y-4 animate-fade-in-up">
                <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground">Welcome to Bloom, {userName}</h2>
                <p className="text-muted-foreground text-xs sm:text-sm max-w-md mx-auto leading-relaxed px-4">
                  A gentle space for reflection, support, and self-discovery. Take a breath — you're welcome here.
                </p>
              </div>
            )}

            {showChips && messages.length === 0 && (
              <div className="flex justify-center px-2">
                <QuickReplyChips onSelect={handleMoodSelect} />
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessage key={msg.id} message={msg} index={i} />
            ))}

            {isTyping && <TypingIndicator />}

            {showBreathing && (
              <div className="flex justify-center py-2 animate-fade-in-up">
                <BreathingExercise />
              </div>
            )}

            {showTip && (
              <div className="py-2">
                <WellnessTip mood={mood} onDismiss={handleDismissTip} />
              </div>
            )}
          </div>
        </div>

        <div className="bg-gradient-to-t from-background via-background to-transparent pb-[env(safe-area-inset-bottom)]">
          <ChatInput
            onSend={handleSend}
            onOpenThoughtRecord={() => setThoughtRecordOpen(true)}
            disabled={isTyping}
            crisisLock={crisisLock}
          />
        </div>
      </div>

      <ThoughtRecordDrawer open={thoughtRecordOpen} onClose={() => setThoughtRecordOpen(false)} />
      <CrisisBanner />
    </div>
  );
}

import { useState } from 'react';
import { X, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { saveThoughtRecord } from '@/lib/db-utils';
import { incrementPilotMetric } from '@/lib/pilot-metrics';
import { ThoughtRecordHistory } from './ThoughtRecordHistory';
import { cn } from '@/lib/utils';

interface ThoughtRecordDrawerProps {
  open: boolean;
  onClose: () => void;
}

type Tab = 'new' | 'history';

export function ThoughtRecordDrawer({ open, onClose }: ThoughtRecordDrawerProps) {
  const [situation, setSituation] = useState('');
  const [thoughts, setThoughts] = useState('');
  const [emotions, setEmotions] = useState('');
  const [reframe, setReframe] = useState('');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('new');
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
  const isFormComplete = [situation, thoughts, emotions, reframe].every((value) => value.trim().length > 0);

  if (!open) return null;

  const handleSave = async () => {
    setLoading(true);
    try {
      await saveThoughtRecord({ situation, thoughts, emotions, reframe });
      setSaved(true);
      setHistoryRefreshKey(prev => prev + 1);
      toast.success('Thought record saved.');

      setTimeout(() => {
        setSaved(false);
        setSituation('');
        setThoughts('');
        setEmotions('');
        setReframe('');
        setActiveTab('history');
      }, 1200);
    } catch (error) {
      console.error('Failed to save thought record:', error);
      incrementPilotMetric('thoughtRecordSaveFailures');
      toast.error(error instanceof Error ? error.message : 'Failed to save your thought record.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-label="Thought Record">
      <div className="absolute inset-0 bg-foreground/20" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full sm:max-w-md bg-card shadow-xl animate-fade-in-up flex flex-col overflow-hidden h-full">
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-foreground">Thought Record</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted transition-colors" aria-label="Close thought record">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('new')}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === 'new'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            New Record
            {activeTab === 'new' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === 'history'
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Past Records
            {activeTab === 'history' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        </div>

        {activeTab === 'new' ? (
          <>
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4 sm:space-y-5">
              <p className="text-xs sm:text-sm text-muted-foreground italic font-display">
                A thought record helps you notice, challenge, and reframe unhelpful thinking patterns.
              </p>

              <Field label="Situation" hint="What happened? Where were you?">
                <textarea value={situation} onChange={e => setSituation(e.target.value)} className="field-textarea" rows={2} aria-label="Situation" />
              </Field>

              <Field label="Automatic Thoughts" hint="What went through your mind?">
                <textarea value={thoughts} onChange={e => setThoughts(e.target.value)} className="field-textarea" rows={3} aria-label="Automatic thoughts" />
              </Field>

              <Field label="Emotions" hint="What did you feel? Rate intensity (0-100)">
                <textarea value={emotions} onChange={e => setEmotions(e.target.value)} className="field-textarea" rows={2} aria-label="Emotions" />
              </Field>

              <Field label="Balanced Reframe" hint="What's a more balanced way to see this?">
                <textarea value={reframe} onChange={e => setReframe(e.target.value)} className="field-textarea" rows={3} aria-label="Balanced reframe" />
              </Field>
            </div>

            <div className="p-3 sm:p-4 border-t border-border" style={{ paddingBottom: 'max(3.5rem, calc(env(safe-area-inset-bottom) + 3rem))' }}>
              <button
                onClick={handleSave}
                disabled={loading || !isFormComplete}
                className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Saving...' : saved ? 'Saved' : 'Save Thought Record'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            <ThoughtRecordHistory refreshKey={historyRefreshKey} />
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-foreground">{label}</label>
      <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>
      {children}
    </div>
  );
}

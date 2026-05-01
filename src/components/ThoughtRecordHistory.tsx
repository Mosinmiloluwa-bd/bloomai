import { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, BookOpen, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getThoughtRecords, type ThoughtRecordEntry } from '@/lib/db-utils';
import { cn } from '@/lib/utils';

interface ThoughtRecordHistoryProps {
  refreshKey?: number;
}

export function ThoughtRecordHistory({ refreshKey }: ThoughtRecordHistoryProps) {
  const [records, setRecords] = useState<ThoughtRecordEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      try {
        const data = await getThoughtRecords();
        if (mounted) {
          setRecords(data);
        }
      } catch (error) {
        if (mounted) {
          setRecords([]);
        }
        toast.error(error instanceof Error ? error.message : 'Unable to load thought records.');
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
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="text-center py-8 space-y-2">
        <BookOpen className="w-8 h-8 text-muted-foreground/40 mx-auto" />
        <p className="text-sm text-muted-foreground">No thought records yet.</p>
        <p className="text-xs text-muted-foreground/70">Records you save will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {records.map(record => {
        const isExpanded = expandedId === record.id;
        return (
          <div
            key={record.id}
            className="bg-background rounded-xl border border-border overflow-hidden transition-all duration-200"
          >
            <button
              onClick={() => setExpandedId(isExpanded ? null : record.id)}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-secondary/50 transition-colors"
              aria-expanded={isExpanded}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">
                  {record.situation || 'Untitled record'}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {formatDate(record.created_at)}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 ml-2" />
              )}
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 animate-fade-in-up">
                <RecordField label="Situation" value={record.situation} />
                <RecordField label="Automatic Thoughts" value={record.thoughts} />
                <RecordField label="Emotions" value={record.emotions} />
                <RecordField label="Balanced Reframe" value={record.reframe} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RecordField({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

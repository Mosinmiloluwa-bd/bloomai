import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { ArrowLeft, Loader2, Frown, Meh, Smile } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { getMoodHistory, moodToScore, type MoodLogEntry } from '@/lib/db-utils';

interface ChartPoint {
  day: string;
  mood: number;
  label: string;
}

const SCORE_LABELS = ['', 'Awful', 'Bad', 'Okay', 'Good', 'Great'];

const Insights = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const history = await getMoodHistory(7);
        const points: ChartPoint[] = history.map((entry: MoodLogEntry) => {
          const date = new Date(entry.date + 'T00:00:00');
          return {
            day: date.toLocaleDateString('en-US', { weekday: 'short' }),
            mood: moodToScore(entry.mood),
            label: entry.mood,
          };
        });
        setData(points);
      } catch (error) {
        setData([]);
        toast.error(error instanceof Error ? error.message : 'Unable to load mood insights.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="min-h-[100dvh] bg-background p-6 space-y-8 pb-24 max-w-md mx-auto relative animate-fade-in-up">
      <header className="flex items-center pt-[env(safe-area-inset-top)]">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="min-h-[44px] min-w-[44px]">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="flex-1 text-center font-display text-2xl font-semibold mr-10">Mood Insights</h1>
      </header>

      <main className="space-y-6">
        <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
          <h2 className="text-sm font-medium text-muted-foreground mb-6">Last 7 Days</h2>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <Meh className="w-10 h-10 text-muted-foreground/40 mx-auto" />
              <p className="text-sm text-muted-foreground">No mood data yet.</p>
              <p className="text-xs text-muted-foreground/70">Complete your daily check-in to start seeing trends here.</p>
            </div>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="day" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis 
                    domain={[1, 5]} 
                    ticks={[1, 2, 3, 4, 5]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                    tickFormatter={(v: number) => SCORE_LABELS[v] || ''}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, _name: string, props: any) => {
                      return [props.payload.label, 'Mood'];
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="mood" 
                    stroke="hsl(var(--sage))" 
                    strokeWidth={3}
                    dot={{ fill: 'hsl(var(--sage))', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, fill: 'hsl(var(--sage))', stroke: '#fff', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Summary card */}
        {data.length > 0 && (
          <div className="bg-card p-5 rounded-2xl border border-border shadow-sm space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Weekly Summary</h2>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Average Mood</p>
                <p className="text-lg font-display font-semibold text-foreground">
                  {SCORE_LABELS[Math.round(data.reduce((sum, d) => sum + d.mood, 0) / data.length)] || 'N/A'}
                </p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Check-ins</p>
                <p className="text-lg font-display font-semibold text-foreground">{data.length} day{data.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Trend</p>
                <div className="flex items-center gap-1.5">
                  {data.length >= 2 && data[data.length - 1].mood > data[0].mood ? (
                    <><Smile className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-600">Improving</span></>
                  ) : data.length >= 2 && data[data.length - 1].mood < data[0].mood ? (
                    <><Frown className="w-4 h-4 text-amber-500" /><span className="text-sm font-medium text-amber-600">Declining</span></>
                  ) : (
                    <><Meh className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium text-muted-foreground">Steady</span></>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Insights;

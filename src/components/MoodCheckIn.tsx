import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { saveMood } from '@/lib/db-utils';
import { incrementPilotMetric } from '@/lib/pilot-metrics';

const MOODS = [
  { value: 1, emoji: '😢', label: 'Awful' },
  { value: 2, emoji: '😕', label: 'Bad' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
];

interface MoodCheckInProps {
  onComplete?: (moodLabel: string) => void;
}

export const MoodCheckIn = ({ onComplete }: MoodCheckInProps) => {
  const [selectedMood, setSelectedMood] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedMood) return;

    const moodEntry = MOODS.find(m => m.value === selectedMood);
    if (!moodEntry) return;

    setIsSubmitting(true);
    try {
      await saveMood(moodEntry.label);
      toast.success('Mood logged successfully!');
      if (onComplete) onComplete(moodEntry.label);
    } catch (error) {
      console.error('Failed to save mood:', error);
      incrementPilotMetric('moodSaveFailures');
      toast.error('Failed to log mood. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm space-y-6">
      <div className="text-center space-y-2">
        <h3 className="font-display text-xl text-foreground">How are you feeling today?</h3>
        <p className="text-muted-foreground text-sm">Take a moment to check in with yourself.</p>
      </div>

      <div className="flex justify-between items-center px-2 sm:px-4">
        {MOODS.map((mood) => (
          <button
            key={mood.value}
            onClick={() => setSelectedMood(mood.value)}
            className={cn(
              "flex flex-col items-center p-2 rounded-xl transition-all duration-200 ease-out transform",
              selectedMood === mood.value 
                ? "bg-sage-light scale-110 shadow-sm" 
                : "hover:bg-secondary hover:scale-105 opacity-70 hover:opacity-100"
            )}
            aria-label={mood.label}
            aria-pressed={selectedMood === mood.value}
          >
            <span className="text-3xl sm:text-4xl mb-1">{mood.emoji}</span>
            <span className={cn(
              "text-[10px] sm:text-xs font-medium",
              selectedMood === mood.value ? "text-sage" : "text-muted-foreground"
            )}>
              {mood.label}
            </span>
          </button>
        ))}
      </div>

      <div className="pt-2">
        <Button 
          className="w-full bg-accent hover:bg-accent/90 text-white transition-all"
          onClick={handleSubmit}
          disabled={!selectedMood || isSubmitting}
        >
          {isSubmitting ? 'Saving...' : 'Log Mood'}
        </Button>
      </div>
    </div>
  );
};

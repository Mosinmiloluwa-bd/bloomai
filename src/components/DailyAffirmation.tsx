import React, { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fallback affirmations if the RAG backend isn't available
const FALLBACK_AFFIRMATIONS = [
  "You are capable of handling whatever comes your way today.",
  "Your feelings are valid, and it's okay to take space for yourself.",
  "Small steps forward are still steps. Be gentle with your progress.",
  "You do not have to have it all figured out right now.",
  "Rest is productive. You deserve time to recharge.",
  "Your worth is not defined by your productivity or academic success.",
  "Breathe in peace, breathe out tension. You are safe here."
];

export const DailyAffirmation = ({ className }: { className?: string }) => {
  // Use today's date as a seed to pick an affirmation, so it stays consistent all day
  const affirmation = useMemo(() => {
    const today = new Date();
    const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
    return FALLBACK_AFFIRMATIONS[seed % FALLBACK_AFFIRMATIONS.length];
  }, []);

  return (
    <div className={cn("relative overflow-hidden rounded-2xl bg-gradient-to-br from-sage-light/50 to-sage/10 p-6 border border-sage/20", className)}>
      <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-sage/10 rounded-full blur-2xl" />
      
      <div className="relative flex items-start space-x-4">
        <div className="flex-shrink-0 mt-1">
          <div className="p-2 bg-sage/20 rounded-full text-sage">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-sage mb-2">Daily Affirmation</h4>
          <p className="text-foreground font-display text-lg leading-relaxed italic">
            "{affirmation}"
          </p>
        </div>
      </div>
    </div>
  );
};

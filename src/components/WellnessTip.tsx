import { useState, useCallback } from 'react';
import { X, Lightbulb, RefreshCw } from 'lucide-react';

const WELLNESS_TIPS = [
  { category: 'grounding', text: 'Try the 5-4-3-2-1 grounding technique: name 5 things you see, 4 you can touch, 3 you hear, 2 you smell, and 1 you taste.' },
  { category: 'grounding', text: 'Place both feet flat on the ground. Notice the texture beneath you. You are anchored here, in this moment.' },
  { category: 'grounding', text: 'Imagine your thoughts as leaves floating on a stream. You do not have to follow them; just watch them pass.' },
  { category: 'self-compassion', text: 'Speak to yourself the way you would speak to a friend who is hurting. What would you say to them right now?' },
  { category: 'self-compassion', text: 'Place your hand on your chest. Feel your heartbeat. You are here, you are alive, and that is enough.' },
  { category: 'self-compassion', text: 'You do not have to earn rest. Your body and mind deserve care simply because you exist.' },
  { category: 'physical', text: 'Have you had water recently? Even a small sip can help your body and mind feel more grounded.' },
  { category: 'physical', text: 'A short 5-minute walk, even around the room, can shift your emotional state more than you would expect.' },
  { category: 'physical', text: 'Roll your shoulders back three times. Unclench your jaw. Let the tension go with a slow exhale.' },
  { category: 'physical', text: 'If possible, step near a window or outside for a moment. Natural light helps regulate your mood.' },
  { category: 'cognitive', text: 'Feeling stuck? Try asking yourself: "Will this matter in a week? A month? A year?"' },
  { category: 'cognitive', text: 'Write down one thing, just one, that went okay today. Even tiny wins count.' },
  { category: 'cognitive', text: 'You do not have to solve everything at once. What is the smallest next step you can take?' },
  { category: 'connection', text: 'Consider sending a short message to someone you trust. Connection, even brief, can lighten a heavy moment.' },
  { category: 'connection', text: 'If you have a pet nearby, spend a moment just being with them. Animals can be wonderful co-regulators.' },
  { category: 'reflection', text: 'Name three things you are grateful for right now; they can be as simple as warm socks or a safe space.' },
  { category: 'reflection', text: 'Remember: storms pass. You have survived 100% of your hardest days so far.' },
  { category: 'reflection', text: 'You are not your worst thought. Thoughts are visitors; you get to choose which ones you invite to stay.' },
  { category: 'evening', text: 'If it is late, consider putting screens away 30 minutes before bed. Your mind will thank you in the morning.' },
  { category: 'evening', text: 'A warm drink without caffeine can signal to your body that it is time to wind down.' },
];

interface WellnessTipProps {
  mood?: string | null;
  onDismiss: () => void;
}

export function WellnessTip({ mood, onDismiss }: WellnessTipProps) {
  const getContextualTip = useCallback(() => {
    let pool = [...WELLNESS_TIPS];

    if (mood) {
      const lowerMood = mood.toLowerCase();
      if (['anxious', 'overwhelmed', 'awful'].includes(lowerMood)) {
        pool = pool.filter((tip) => ['grounding', 'physical'].includes(tip.category));
      } else if (['sad', 'numb', 'bad'].includes(lowerMood)) {
        pool = pool.filter((tip) => ['self-compassion', 'connection', 'reflection'].includes(tip.category));
      } else if (['exhausted'].includes(lowerMood)) {
        pool = pool.filter((tip) => ['physical', 'evening', 'self-compassion'].includes(tip.category));
      } else if (['okay'].includes(lowerMood)) {
        pool = pool.filter((tip) => ['cognitive', 'reflection', 'grounding'].includes(tip.category));
      }

      if (pool.length === 0) pool = [...WELLNESS_TIPS];
    }

    return pool[Math.floor(Math.random() * pool.length)];
  }, [mood]);

  const [tip, setTip] = useState(() => getContextualTip());

  return (
    <div className="animate-fade-in-up mx-auto max-w-lg">
      <div className="relative rounded-2xl border border-sage/20 bg-gradient-to-br from-sage-light/60 to-clay-light/40 px-4 py-3.5 shadow-sm dark:from-sage-light/30 dark:to-clay-light/20">
        <div className="absolute -top-2 -right-2 h-16 w-16 rounded-full bg-sage/10 blur-xl pointer-events-none" />

        <div className="relative flex items-start gap-3">
          <div className="mt-0.5 flex-shrink-0">
            <div className="rounded-full bg-sage/20 p-1.5 text-sage">
              <Lightbulb className="w-4 h-4" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-sage">Wellness Tip</p>
            <p className="text-sm leading-relaxed text-foreground">{tip.text}</p>
          </div>
          <div className="flex flex-shrink-0 flex-col gap-1">
            <button
              onClick={() => setTip(getContextualTip())}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-sage/10 hover:text-foreground"
              aria-label="Show another tip"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onDismiss}
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-sage/10 hover:text-foreground"
              aria-label="Dismiss tip"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

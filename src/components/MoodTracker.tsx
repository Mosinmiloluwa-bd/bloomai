interface MoodTrackerProps {
  mood: string | null;
}

const MOOD_COLORS: Record<string, string> = {
  // QuickReplyChips moods
  'Anxious': '#D4A574',
  'Overwhelmed': '#C49A6C',
  'Sad': '#8FA4B0',
  'Numb': '#A0A0A0',
  'Exhausted': '#9B8EA0',
  "I'm okay": '#7A9E7E',
  'Hopeful': '#7EBF8E',
  'Grateful': '#E8C170',
  // MoodCheckIn moods
  'Awful': '#B07A7A',
  'Bad': '#C49A8C',
  'Okay': '#A0A0A0',
  'Good': '#7A9E7E',
  'Great': '#5DAE72',
};

export function MoodTracker({ mood }: MoodTrackerProps) {
  const color = mood ? MOOD_COLORS[mood] || 'hsl(var(--sage))' : 'hsl(var(--muted))';
  const filled = mood ? 0.7 : 0.1;

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const filledLength = arcLength * filled;

  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`Today's mood: ${mood || 'Not checked in yet'}`}>
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Today's Check-in</p>
      <div className="relative" style={{ width: 88, height: 66 }}>
        <svg viewBox="0 0 88 66" className="w-full h-full">
          <circle
            cx="44" cy="50" r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference - arcLength}`}
            strokeDashoffset={-circumference * 0.125}
            transform="rotate(0, 44, 50)"
          />
          <circle
            cx="44" cy="50" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${circumference - filledLength}`}
            strokeDashoffset={-circumference * 0.125}
            className="transition-all duration-700 ease-out"
          />
        </svg>
      </div>
      <p className="text-sm font-display italic text-foreground">
        {mood || 'Not yet'}
      </p>
    </div>
  );
}

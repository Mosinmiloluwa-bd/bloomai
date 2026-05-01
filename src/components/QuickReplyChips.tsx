interface QuickReplyChipsProps {
  onSelect: (mood: string) => void;
}

const MOODS = [
  { label: 'Anxious', emoji: '😰' },
  { label: 'Overwhelmed', emoji: '🌊' },
  { label: 'Sad', emoji: '😢' },
  { label: 'Numb', emoji: '😶' },
  { label: 'Exhausted', emoji: '🔋' },
  { label: "I'm okay", emoji: '🙂' },
  { label: 'Hopeful', emoji: '🌱' },
  { label: 'Grateful', emoji: '✨' },
];

export function QuickReplyChips({ onSelect }: QuickReplyChipsProps) {
  return (
    <div className="animate-fade-in-up w-full" role="group" aria-label="How are you feeling?">
      <p className="text-xs sm:text-sm text-muted-foreground mb-3 font-display italic text-center">
        How are you feeling today?
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {MOODS.map(mood => (
          <button
            key={mood.label}
            onClick={() => onSelect(mood.label)}
            className="chip text-xs sm:text-sm"
            aria-label={`I'm feeling ${mood.label}`}
          >
            <span aria-hidden="true">{mood.emoji}</span> {mood.label}
          </button>
        ))}
      </div>
    </div>
  );
}

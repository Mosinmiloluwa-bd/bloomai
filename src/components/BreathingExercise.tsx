import { useState, useEffect, useCallback, useRef } from 'react';
import { Wind } from 'lucide-react';

type Phase = 'inhale' | 'hold' | 'exhale' | 'idle';

const PHASES: { phase: Phase; duration: number; label: string }[] = [
  { phase: 'inhale', duration: 4, label: 'Breathe in…' },
  { phase: 'hold', duration: 7, label: 'Hold gently…' },
  { phase: 'exhale', duration: 8, label: 'Slowly release…' },
];

export function BreathingExercise() {
  const [active, setActive] = useState(false);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [cycles, setCycles] = useState(0);

  // Use refs to avoid stale closures in the interval callback
  const phaseIndexRef = useRef(phaseIndex);
  const cyclesRef = useRef(cycles);

  useEffect(() => { phaseIndexRef.current = phaseIndex; }, [phaseIndex]);
  useEffect(() => { cyclesRef.current = cycles; }, [cycles]);

  const currentPhase = PHASES[phaseIndex];

  const start = useCallback(() => {
    setActive(true);
    setPhaseIndex(0);
    phaseIndexRef.current = 0;
    setCountdown(PHASES[0].duration);
    setCycles(0);
    cyclesRef.current = 0;
  }, []);

  useEffect(() => {
    if (!active) return;
    if (cyclesRef.current >= 3) {
      setActive(false);
      return;
    }

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          const currentIdx = phaseIndexRef.current;
          const nextIdx = (currentIdx + 1) % PHASES.length;
          if (nextIdx === 0) {
            const newCycles = cyclesRef.current + 1;
            setCycles(newCycles);
            cyclesRef.current = newCycles;
            if (newCycles >= 3) {
              setActive(false);
              return 0;
            }
          }
          setPhaseIndex(nextIdx);
          phaseIndexRef.current = nextIdx;
          return PHASES[nextIdx].duration;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [active]);

  if (!active) {
    return (
      <div className="animate-fade-in-up">
        <button
          onClick={start}
          className="flex items-center gap-2 chip"
          aria-label="Start 4-7-8 breathing exercise"
        >
          <Wind className="w-4 h-4" aria-hidden="true" />
          Take a breathing break
        </button>
      </div>
    );
  }

  const progress = 1 - countdown / currentPhase.duration;
  const ringSize = 80 + progress * 30;

  return (
    <div className="animate-fade-in-up flex flex-col items-center py-4" role="timer" aria-live="polite">
      <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
        <div
          className="rounded-full bg-sage-light absolute transition-all duration-1000 ease-in-out"
          style={{
            width: ringSize,
            height: ringSize,
            opacity: 0.5 + progress * 0.3,
          }}
        />
        <div
          className="rounded-full bg-sage/20 absolute transition-all duration-1000 ease-in-out"
          style={{
            width: ringSize + 20,
            height: ringSize + 20,
            opacity: 0.2 + progress * 0.2,
          }}
        />
        <span className="text-2xl font-display text-foreground relative z-10">{countdown}</span>
      </div>
      <p className="mt-3 text-sm font-display italic text-muted-foreground">{currentPhase.label}</p>
      <p className="text-xs text-muted-foreground mt-1">Cycle {Math.min(cycles + 1, 3)} of 3</p>
    </div>
  );
}

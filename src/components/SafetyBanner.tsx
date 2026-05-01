import { AlertTriangle, Phone, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const HOTLINES = [
  { name: 'Suicide & Crisis Lifeline', number: '988', description: 'Call or text 24/7' },
  { name: 'Crisis Text Line', number: 'Text HOME to 741741', description: 'Free 24/7 support' },
  { name: 'SAMHSA Helpline', number: '1-800-662-4357', description: 'Free referral service' },
  { name: 'Trevor Project (LGBTQ+)', number: '1-866-488-7386', description: '24/7 crisis support' },
];

interface SafetyBannerProps {
  expanded?: boolean;
}

export function SafetyBanner({ expanded: forceExpanded }: SafetyBannerProps) {
  const [expanded, setExpanded] = useState(forceExpanded ?? false);

  return (
    <div className="safety-banner px-3 sm:px-4 py-2.5 sm:py-3" role="alert" aria-live="polite">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start gap-2 sm:gap-3">
          <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 mt-0.5 flex-shrink-0 text-amber-700" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-xs sm:text-sm leading-relaxed">
              This is an AI wellness companion for reflection and support — not a crisis service.
              If you're in danger, call or text{' '}
              <a href="tel:988" className="font-semibold underline">
                Suicide &amp; Crisis Lifeline (988)
              </a>{' '}
              immediately.
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-full bg-amber-200/50 hover:bg-amber-200/80 transition-colors flex-shrink-0"
            aria-expanded={expanded}
            aria-label="Emergency resources"
          >
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Resources</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
        {expanded && (
          <div className="mt-3 pt-3 border-t border-amber-300/40 grid gap-2 sm:grid-cols-2" role="list">
            {HOTLINES.map(h => (
              <div key={h.name} className="flex items-center gap-2 text-sm" role="listitem">
                <Phone className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                <div>
                  <span className="font-medium">{h.name}</span>
                  <span className="text-muted-foreground"> — {h.number}</span>
                  <span className="text-xs text-muted-foreground block">{h.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

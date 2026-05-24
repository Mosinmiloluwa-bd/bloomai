import { AlertTriangle, Phone, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

const HOTLINES = [
  { name: 'Asido Crisis Line', number: '+234 902 808 0416', description: 'Call 24/7 — Nigeria', tel: '+2349028080416' },
  { name: 'SURPIN', number: '0811 190 9909', description: 'Suicide research & prevention', tel: '08111909909' },
  { name: 'Nigeria Emergency Services', number: '112', description: 'Nationwide emergency line', tel: '112' },
  { name: 'Befrienders Worldwide', number: 'www.befrienders.org', description: 'International crisis support', link: 'https://www.befrienders.org' },
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
              If you're in danger, call{' '}
              <a href="tel:+2349028080416" className="font-semibold underline">
                Asido (+234 902 808 0416)
              </a>{' '}
              or emergency services on{' '}
              <a href="tel:112" className="font-semibold underline">112</a> immediately.
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
                {h.link
                  ? <Globe className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                  : <Phone className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
                }
                <div>
                  <span className="font-medium">{h.name}</span>
                  <span className="text-muted-foreground">
                    {' '}— {h.link
                      ? <a href={h.link} target="_blank" rel="noreferrer" className="underline">{h.number}</a>
                      : h.tel
                        ? <a href={`tel:${h.tel}`} className="underline">{h.number}</a>
                        : h.number
                    }
                  </span>
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

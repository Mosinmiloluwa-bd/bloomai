import React from 'react';
import { PhoneCall } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

// We route this to the AI chat with a crisis command or an explicit page
export const CrisisBanner = ({ className }: { className?: string }) => {
  return (
    <div className={cn("fixed bottom-0 left-0 right-0 z-50 p-2 sm:p-3 bg-red-50 dark:bg-red-950/40 border-t border-red-200 dark:border-red-900", className)} style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
      <div className="max-w-screen-md mx-auto flex items-center justify-center space-x-3 text-red-800 dark:text-red-200">
        <PhoneCall className="w-4 h-4 animate-pulse" />
        <p className="text-xs sm:text-sm font-medium">
          Need help right now? <Link to="/crisis" className="underline font-bold hover:text-red-600 dark:hover:text-red-100 cursor-pointer min-h-[44px] min-w-[44px] inline-flex items-center">Tap here for crisis support.</Link>
        </p>
      </div>
    </div>
  );
};

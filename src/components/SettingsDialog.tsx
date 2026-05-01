import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Settings, User, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { getCurrentUser, deleteSession } from "@/lib/db-utils";
import { getAverageFirstResponseMs, getTodayPilotMetrics, incrementPilotMetric, type PilotMetrics } from "@/lib/pilot-metrics";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SettingsDialogProps {
  currentSessionId?: string | null;
  onSessionDeleted?: () => void;
}

export const SettingsDialog = ({ currentSessionId, onSessionDeleted }: SettingsDialogProps) => {
  const [user, setUser] = useState<any>(null);
  const [metrics, setMetrics] = useState<PilotMetrics>(() => getTodayPilotMetrics());
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const pilotFeedbackUrl = import.meta.env.VITE_PILOT_FEEDBACK_URL?.trim();

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  useEffect(() => {
    if (open) {
      setMetrics(getTodayPilotMetrics());
    }
  }, [open]);

  const handleReportProblem = () => {
    if (!pilotFeedbackUrl) return;

    if (pilotFeedbackUrl.startsWith('mailto:')) {
      window.location.href = pilotFeedbackUrl;
      return;
    }

    window.open(pilotFeedbackUrl, '_blank', 'noopener,noreferrer');
  };

  const handleClearChat = async () => {
    if (!currentSessionId) return;
    if (!confirm("Are you sure you want to clear this conversation? This cannot be undone.")) return;
    
    setLoading(true);
    try {
      await deleteSession(currentSessionId);
    } catch (error) {
      setLoading(false);
      toast.error(error instanceof Error ? error.message : "Couldn't clear this conversation. Please try again.");
      return;
    }

    setLoading(false);

    setOpen(false);
    toast.success("Conversation cleared");
    if (onSessionDeleted) onSessionDeleted();
  };

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      window.location.reload();
    } catch (error) {
      incrementPilotMetric('authFailures');
      toast.error(error instanceof Error ? error.message : 'Unable to sign out right now.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="min-h-[44px] min-w-[44px] rounded-full text-muted-foreground hover:bg-secondary/80">
          <Settings className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-background border-border">
        <DialogHeader>
          <DialogTitle className="font-display">Your Profile & Settings</DialogTitle>
          <DialogDescription>
            Manage your account and privacy preferences.
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-6">
          {/* User Profile Info */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border">
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <User className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">
                {user?.email || "Guest User"}
              </p>
              <p className="text-xs text-muted-foreground">
                Joined {user?.created_at ? new Date(user.created_at).toLocaleDateString() : "recently"}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign Out">
              <LogOut className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5 text-left">
              <label className="text-sm font-medium">Appearance</label>
              <p className="text-[0.8rem] text-muted-foreground">Toggle dark and light mode.</p>
            </div>
            <ThemeToggle />
          </div>

          <div className="border-t border-border pt-6 space-y-3">
            <div className="space-y-1 text-left">
              <label className="text-sm font-medium">Pilot Support</label>
              <p className="text-[0.8rem] text-muted-foreground">
                Bloom is supportive reflection support for the pilot and not emergency care. For urgent help, open crisis support. For app issues, report a problem below.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm">
                <a href="/crisis">Open Crisis Support</a>
              </Button>
              {pilotFeedbackUrl ? (
                <Button size="sm" onClick={handleReportProblem}>
                  Report a Problem
                </Button>
              ) : (
                <div className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Pilot feedback link not configured. Contact your pilot coordinator for app issues.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-6 space-y-3">
            <div className="space-y-1 text-left">
              <label className="text-sm font-medium">Today's Pilot Diagnostics</label>
              <p className="text-[0.8rem] text-muted-foreground">
                Use this during the pilot to spot backend instability and failed saves quickly.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <MetricCard label="Chat failures" value={metrics.chatRequestFailures} />
              <MetricCard label="Save failures" value={metrics.messageSaveFailures + metrics.moodSaveFailures + metrics.thoughtRecordSaveFailures} />
              <MetricCard label="Auth issues" value={metrics.authFailures} />
              <MetricCard label="Switch issues" value={metrics.sessionSwitchFailures} />
            </div>
            <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm text-foreground">
              Average first response time:{' '}
              <span className="font-semibold">
                {getAverageFirstResponseMs(metrics) === null ? 'No chat responses yet' : `${getAverageFirstResponseMs(metrics)} ms`}
              </span>
            </div>
          </div>

          <div className="border-t border-border pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5 text-left">
                  <label className="text-sm font-medium text-destructive">Data Privacy</label>
                  <p className="text-[0.8rem] text-muted-foreground">Delete your current conversation data.</p>
                </div>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={handleClearChat}
                  disabled={loading || !currentSessionId}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear Chat
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

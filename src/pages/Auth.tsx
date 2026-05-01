import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Leaf, Mail, Lock, Loader2 } from 'lucide-react';
import { OrganicBackground } from '@/components/OrganicBackground';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSignUp, setIsSignUp] = useState(false);
  const navigate = useNavigate();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        // Supabase might require email verification, but we'll try to log in immediately
        // if auto-confirm is enabled, otherwise we show a message
        setError("Account created! You can now sign in.");
        setIsSignUp(false);
        setPassword('');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate('/');
      }
    } catch (err: any) {
      const isNetworkError = err.message === 'Failed to fetch';
      // @ts-ignore - accessing internal URL for debugging
      const attemptedUrl = supabase.auth?.config?.url || 'Unknown';
      setError(
        isNetworkError 
          ? `Connection error: Failed to reach ${attemptedUrl}. Please check your internet or if the project is paused.`
          : (err.message || 'An error occurred during authentication')
      );
      console.error("[Bloom] Auth error:", err, "Attempted URL:", attemptedUrl);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background relative overflow-hidden">
      <OrganicBackground />
      
      <div className="relative z-10 w-full max-w-md px-4 sm:px-6">
        <div className="bg-card/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-6 sm:p-8 shadow-xl border border-border">
          <div className="flex flex-col items-center mb-6 sm:mb-8">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
              <Leaf className="w-6 h-6" />
            </div>
            <h1 className="font-display text-3xl font-semibold text-foreground">Bloom</h1>
            <p className="text-muted-foreground text-sm mt-2 text-center">
              Your private space for reflection and support.
            </p>
            <p className="text-muted-foreground/80 text-xs mt-3 text-center max-w-xs">
              Bloom is supportive, but not emergency care. During the pilot, urgent wellbeing support stays available on the crisis page and app issues can be reported from Settings after sign-in.
            </p>
          </div>

          {error && (
            <div className={`p-3 rounded-lg text-sm mb-6 ${error.includes('created') ? 'bg-sage-light text-sage' : 'bg-destructive/10 text-destructive'}`}>
              {error}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="********"
                  required
                  minLength={6}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50 mt-6"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? "Already have an account? " : "Don't have an account? "}
            <button
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
              }}
              className="text-primary font-medium hover:underline focus:outline-none"
            >
              {isSignUp ? 'Sign in' : 'Create one'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

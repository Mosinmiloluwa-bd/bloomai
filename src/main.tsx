import { createRoot } from "react-dom/client";
import "./index.css";

const root = createRoot(document.getElementById("root")!);

// Wrap the entire app bootstrap in a try/catch so that ANY error
// (including module-level throws from lazy-loaded chunks) produces
// a visible message instead of a blank white screen.
async function bootstrap() {
  try {
    const { ErrorBoundary } = await import("./components/ErrorBoundary.tsx");
    const { default: App } = await import("./App.tsx");
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err: any) {
    console.error("[Bloom] Fatal bootstrap error:", err);
    root.render(
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#F5F3EC',
        fontFamily: '"DM Sans", system-ui, sans-serif',
        padding: '1.5rem',
      }}>
        <div style={{
          maxWidth: 420,
          width: '100%',
          background: '#fff',
          borderRadius: 16,
          padding: '2rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🌱</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#2d3a2e', marginBottom: 8 }}>
            Bloom couldn't start
          </h1>
          <p style={{ fontSize: 14, color: '#6b7c6e', lineHeight: 1.5, marginBottom: 16 }}>
            {err?.message || 'An unexpected error occurred while loading the application.'}
          </p>
          <p style={{ fontSize: 12, color: '#9aa89c', lineHeight: 1.5 }}>
            If you're the site owner, check that <code>VITE_SUPABASE_URL</code> and{' '}
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> are set in your Netlify environment variables, then redeploy.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 20,
              padding: '10px 24px',
              background: '#7A9E7E',
              color: '#fff',
              border: 'none',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}

bootstrap();

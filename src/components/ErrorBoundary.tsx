import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-4">
          <div className="max-w-md w-full bg-card shadow-lg rounded-2xl p-8 flex flex-col items-center text-center space-y-4 border border-border">
            <div className="w-16 h-16 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mb-2">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-display font-semibold text-card-foreground">
              Something went wrong
            </h1>
            <p className="text-muted-foreground text-sm">
              We encountered an unexpected error. Please refresh the page to try again.
            </p>
            {this.state.error && (
              <div className="w-full bg-muted/50 p-3 rounded-lg text-left overflow-x-auto border border-border/50">
                <code className="text-xs text-muted-foreground break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

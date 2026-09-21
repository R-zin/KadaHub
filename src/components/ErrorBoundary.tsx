import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, Home, RotateCcw } from "lucide-react";
import { Button } from "./ui";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary caught an unhandled error]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
          <div className="rounded-full bg-rose-50 p-4 text-rose-600">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-slate-900 sm:text-3xl">Something went wrong</h1>
          <p className="mt-2 max-w-md text-sm text-slate-600">
            An unexpected error occurred while loading this page. Your session, cart, and orders remain safe.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={this.handleReset} className="inline-flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Try Again
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                window.location.href = "/";
              }}
              className="inline-flex items-center gap-2"
            >
              <Home className="h-4 w-4" /> Return to Home
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

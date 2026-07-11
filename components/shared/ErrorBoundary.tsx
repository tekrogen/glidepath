"use client";

import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { componentLogger } from "@/lib/logger";

const log = componentLogger("ErrorBoundary");

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary Component
 *
 * Catches React component errors and displays a fallback UI instead of crashing the entire app.
 *
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 *
 * @example With custom fallback
 * ```tsx
 * <ErrorBoundary fallback={<CustomErrorUI />}>
 *   <YourComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
    };
  }

  override componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error using logger (only outputs in development by default)
    log.error("ErrorBoundary caught an error", error, { componentStack: errorInfo.componentStack });

    // Update state with error details
    this.setState({
      error,
      errorInfo,
    });

    // Call optional error handler (for error reporting services like Sentry)
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Sentry integration: set SENTRY_DSN env var to enable (see lib/logger.ts)
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  override render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
          <div className="max-w-2xl w-full bg-card border border-border rounded-xl shadow-lg p-8">
            {/* Error Icon */}
            <div className="flex items-center justify-center w-16 h-16 mx-auto mb-6 rounded-full bg-destructive/10">
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>

            {/* Error Title */}
            <h1 className="text-2xl font-bold text-center text-foreground mb-2">
              Something went wrong
            </h1>

            {/* Error Message */}
            <p className="text-center text-muted-foreground mb-6">
              An unexpected error occurred. Please try refreshing the page or contact support if the
              problem persists.
            </p>

            {/* Error Details (Development Only) */}
            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 p-4 bg-muted rounded-lg border border-border">
                <p className="text-sm font-semibold text-foreground mb-2">Error Details:</p>
                <p className="text-xs text-destructive font-mono mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="text-xs text-muted-foreground font-mono">
                    <summary className="cursor-pointer hover:text-foreground">
                      Component Stack
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 px-6 py-3 bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors font-medium"
              >
                <Home className="w-4 h-4" />
                Go Home
              </Link>
            </div>

            {/* Support Link */}
            <p className="text-center text-sm text-muted-foreground mt-6">
              If this problem continues,{" "}
              <Link href="/support" className="text-accent hover:underline">
                contact support
              </Link>
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

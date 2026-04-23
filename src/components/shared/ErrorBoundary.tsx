'use client'

import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  retryCount: number
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, retryCount: 0 }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState((prev) => ({
        hasError: false,
        error: null,
        retryCount: prev.retryCount + 1,
      }))
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8">
          <p className="text-[var(--text-secondary)]">Une erreur est survenue</p>
          {this.state.retryCount < 3 && (
            <button
              onClick={this.handleRetry}
              className="rounded-xl bg-[var(--cyan)]/10 px-4 py-2 text-sm text-[var(--cyan)] transition hover:bg-[var(--cyan)]/20"
            >
              Reessayer
            </button>
          )}
        </div>
      )
    }
    return this.props.children
  }
}

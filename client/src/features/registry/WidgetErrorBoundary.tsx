import { Component, type ErrorInfo, type ReactNode } from 'react'
import { FallbackWidget } from './FallbackWidget'

interface Props {
  /** Archetype name, for the fallback copy. */
  type: string
  title?: string
  /** Changing this resets the boundary — see note on componentDidUpdate. */
  resetKey: string
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Per-widget error isolation.
 *
 * One boundary wraps ONE widget, which is the entire point. A single boundary
 * around the grid would satisfy "does not crash" while still blanking the whole
 * workspace when one widget throws. Scoping it per widget means a failure costs
 * exactly one card.
 *
 * Error boundaries remain class-only in React 19 — there is no hook equivalent,
 * because the mechanism depends on lifecycle methods the reconciler calls during
 * the commit phase.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Stands in for a real telemetry sink. Kept explicit so a swallowed render
    // error is never invisible during development.
    console.error(`[widget:${this.props.type}] render failed`, error, info.componentStack)
  }

  componentDidUpdate(prev: Props) {
    // Without this, a widget that fails once stays failed forever: the boundary
    // has no idea the payload underneath it was replaced with a good one.
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  private handleRetry = () => this.setState({ error: null })

  render() {
    const { error } = this.state
    if (error) {
      return (
        <FallbackWidget
          title={this.props.title}
          reason={{ kind: 'render-error', type: this.props.type, message: error.message }}
          onRetry={this.handleRetry}
        />
      )
    }
    return this.props.children
  }
}

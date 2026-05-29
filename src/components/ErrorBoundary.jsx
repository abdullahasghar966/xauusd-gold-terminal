import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (typeof console !== 'undefined' && console.error) {
      console.error(`[ErrorBoundary:${this.props.section || 'unknown'}]`, error, info?.componentStack);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    const { section = 'section', children, fallback } = this.props;

    if (!error) return children;

    if (typeof fallback === 'function') return fallback(error, this.reset);

    return (
      <div className="card error-boundary" role="alert">
        <div className="error-boundary-eyebrow serif">{section} unavailable</div>
        <div className="error-boundary-message mono">
          {error?.message || 'Unexpected error rendering this section.'}
        </div>
        <button type="button" className="error-boundary-retry" onClick={this.reset}>
          Retry
        </button>
      </div>
    );
  }
}

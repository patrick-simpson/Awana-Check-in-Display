import React from 'react';

/**
 * Per-view crash isolation with an on-brand fallback. Deliberately
 * dependency-free (plain divs + CSS keyframes only) so the fallback
 * itself can't fail.
 */
export class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, errorInfo) {
    console.error(`View crashed (${this.props.label}):`, error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="w-full h-full flex flex-col items-center justify-center gap-6"
          style={{ background: '#000000' }}
        >
          <h1
            className="gradient-text-amber"
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-h1)',
              lineHeight: 1,
            }}
          >
            OOPS!
          </h1>
          <p
            className="text-white/70 text-center"
            style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-body-lg)' }}
          >
            The {this.props.label} screen hit a snag — the show goes on.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-8 py-3 rounded-full border-2 text-white uppercase transition-transform hover:scale-105"
            style={{
              fontFamily: 'var(--font-condensed)',
              fontWeight: 800,
              letterSpacing: '0.15em',
              borderColor: '#FFC107',
              boxShadow: '0 0 18px rgba(255,193,7,0.45)',
              background: 'rgba(10,10,10,0.72)',
            }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

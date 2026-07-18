import { Component } from 'react';

// Generic render-crash fence. The fallback defaults to null (an inert
// gap) so a broken widget simply vanishes instead of taking the whole
// stage down — on a signage display an empty corner beats a white
// screen every time. Keep fallbacks dependency-free so they can't fail.
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error(`ErrorBoundary${this.props.label ? ` (${this.props.label})` : ''}:`, error);
    this.props.onError?.();
  }

  componentDidUpdate(prevProps) {
    // Reset when the keyed content changes so the next render gets a clean slate.
    if (prevProps.eventKey !== this.props.eventKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) return this.props.fallback ?? null;
    return this.props.children;
  }
}

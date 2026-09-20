import { Component } from 'react';

/** A render crash must not leave a blank page.
 *
 *  Gate 1 §1.5 requires a readable message and a working retry when
 *  something goes wrong. A white screen is the worst possible outcome in
 *  front of a client. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Render error:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="text-xl font-medium">Something broke on this page.</h1>
        <p className="mt-2 text-ink-muted">
          That is our fault, not yours. Reloading usually fixes it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover"
        >
          Reload the page
        </button>
      </div>
    );
  }
}

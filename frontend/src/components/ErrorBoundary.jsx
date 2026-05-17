import { Component } from 'react';
import { BookOpen } from 'lucide-react';

/**
 * ErrorBoundary — catches rendering errors in child components
 * and shows a recovery UI instead of crashing the entire app.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught rendering error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8 animate-slide-up">
          <div className="w-20 h-20 rounded-full bg-error-container/10 border border-error-container/30 flex items-center justify-center mb-6">
            <BookOpen size={36} className="text-error-container" />
          </div>
          <h2 className="font-serif text-2xl font-bold text-on-surface mb-2">
            The Archives Encountered an Error
          </h2>
          <p className="font-body text-on-surface-variant text-sm italic mb-6 max-w-md">
            Something went wrong rendering this page. This has been logged.
          </p>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <pre className="text-xs text-error-container bg-surface-container p-4 rounded-sm border border-error-container/20 mb-6 max-w-lg overflow-auto text-left">
              {this.state.error.toString()}
            </pre>
          )}
          <div className="flex gap-3">
            <button
              onClick={this.handleReset}
              className="px-6 py-3 border border-primary text-primary font-serif hover:bg-primary/10 transition-colors rounded-sm"
            >
              Try Again
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-3 bg-primary text-on-primary font-serif rounded-sm hover:brightness-110 transition-all"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

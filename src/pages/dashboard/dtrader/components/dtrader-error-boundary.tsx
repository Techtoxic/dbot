import React, { Component, ReactNode } from 'react';
import { isDevelopment, shouldSuppressErrorModal } from '../utils/environment-config';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class DTraderErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): State {
        // Check if we should suppress this error
        if (shouldSuppressErrorModal(error)) {
            console.warn('Suppressing error modal for:', error.message);
            return { hasError: false }; // Don't show error UI for suppressible errors
        }

        // Update state so the next render will show the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log the error but don't let it bubble up to the global error boundary
        console.warn('DTrader Error Boundary caught an error:', error, errorInfo);

        // In development, also log to console for debugging
        if (isDevelopment()) {
            console.error('Full error details:', { error, errorInfo });
        }
    }

    render() {
        if (this.state.hasError) {
            // Render fallback UI instead of showing the global error modal
            return (
                <div className='dtrader__error-fallback'>
                    <div className='dtrader__error-message'>
                        <h3>Trading interface temporarily unavailable</h3>
                        <p>We&apos;re working to restore full functionality. You can still access other features.</p>
                        <button onClick={() => this.setState({ hasError: false })} className='dtrader__retry-button'>
                            Try Again
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default DTraderErrorBoundary;

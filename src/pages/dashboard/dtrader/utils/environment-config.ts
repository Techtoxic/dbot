// Simple configuration to suppress error modals in DTrader
export const shouldSuppressErrorModal = (): boolean => {
    // Always suppress error modals in DTrader - we handle errors gracefully
    return true;
};

// Helper to check if we're in development
export const isDevelopment = (): boolean => {
    return process.env.NODE_ENV === 'development';
};

// Helper to check if we're on localhost
export const isLocalhost = (): boolean => {
    return (
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1' ||
        window.location.hostname.includes('localhost')
    );
};

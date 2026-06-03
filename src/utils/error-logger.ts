export const ErrorLogger = {
    error: (context: string, message: string, error?: unknown): void => {
        console.error(`[${context}] ${message}`, error);
    },
    warn: (context: string, message: string, data?: unknown): void => {
        console.warn(`[${context}] ${message}`, data);
    },
    info: (context: string, message: string, data?: unknown): void => {
        console.info(`[${context}] ${message}`, data);
    },
};

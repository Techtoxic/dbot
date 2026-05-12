import { useCallback, useEffect, useState } from 'react';
import derivCopyTradingService, {
    CopyTradingSettings,
    CopyTradingTrader,
    DerivAccount,
    TradeSignal,
} from '../services/deriv-copy-trading';

export interface UseCopyTradingReturn {
    // State
    traders: CopyTradingTrader[];
    selectedTrader: CopyTradingTrader | null;
    copySettings: CopyTradingSettings | null;
    isCopyTradingActive: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    loadTraders: () => Promise<void>;
    selectTrader: (trader: CopyTradingTrader) => void;
    updateCopySettings: (settings: Partial<CopyTradingSettings>) => void;
    startCopyTrading: (account: DerivAccount) => Promise<boolean>;
    stopCopyTrading: () => Promise<boolean>;
    clearError: () => void;

    // Trade handling
    onTradeSignal: (callback: (signal: TradeSignal) => void) => void;
    offTradeSignal: (callback: (signal: TradeSignal) => void) => void;
}

export const useCopyTrading = (): UseCopyTradingReturn => {
    const [traders, setTraders] = useState<CopyTradingTrader[]>([]);
    const [selectedTrader, setSelectedTrader] = useState<CopyTradingTrader | null>(null);
    const [copySettings, setCopySettings] = useState<CopyTradingSettings | null>(null);
    const [isCopyTradingActive, setIsCopyTradingActive] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load available traders
    const loadTraders = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const availableTraders = await derivCopyTradingService.getAvailableTraders();
            setTraders(availableTraders);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load traders');
            console.error('Error loading traders:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    // Select a trader
    const selectTrader = useCallback((trader: CopyTradingTrader) => {
        setSelectedTrader(trader);

        // Initialize copy settings with default values
        setCopySettings({
            trader_id: trader.trader_id,
            copy_amount: 10, // 10% of original trade amount
            max_risk: 100, // Maximum $100 per trade
            stop_loss: 0, // No stop loss by default
            take_profit: 0, // No take profit by default
            is_active: false,
        });
    }, []);

    // Update copy settings
    const updateCopySettings = useCallback((settings: Partial<CopyTradingSettings>) => {
        setCopySettings(prev => (prev ? { ...prev, ...settings } : null));
    }, []);

    // Start copy trading
    const startCopyTrading = useCallback(
        async (account: DerivAccount): Promise<boolean> => {
            if (!copySettings) {
                setError('No copy settings configured');
                return false;
            }

            setIsLoading(true);
            setError(null);

            try {
                // Authenticate with Deriv API
                await derivCopyTradingService.authenticate(account);

                // Start copy trading
                const success = await derivCopyTradingService.startCopyTrading(copySettings);

                if (success) {
                    setIsCopyTradingActive(true);
                    updateCopySettings({ is_active: true });
                }

                return success;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to start copy trading');
                console.error('Error starting copy trading:', err);
                return false;
            } finally {
                setIsLoading(false);
            }
        },
        [copySettings, updateCopySettings]
    );

    // Stop copy trading
    const stopCopyTrading = useCallback(async (): Promise<boolean> => {
        setIsLoading(true);
        setError(null);

        try {
            const success = await derivCopyTradingService.stopCopyTrading();

            if (success) {
                setIsCopyTradingActive(false);
                updateCopySettings({ is_active: false });
            }

            return success;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to stop copy trading');
            console.error('Error stopping copy trading:', err);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [updateCopySettings]);

    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);

    // Trade signal handlers
    const onTradeSignal = useCallback((callback: (signal: TradeSignal) => void) => {
        derivCopyTradingService.onTradeSignal(callback);
    }, []);

    const offTradeSignal = useCallback((callback: (signal: TradeSignal) => void) => {
        derivCopyTradingService.offTradeSignal(callback);
    }, []);

    // Load traders on mount
    useEffect(() => {
        loadTraders();
    }, [loadTraders]);

    // Check copy trading status on mount
    useEffect(() => {
        const status = derivCopyTradingService.getCopyTradingStatus();
        setIsCopyTradingActive(status.enabled);
        if (status.settings) {
            setCopySettings(status.settings);
        }
    }, []);

    return {
        // State
        traders,
        selectedTrader,
        copySettings,
        isCopyTradingActive,
        isLoading,
        error,

        // Actions
        loadTraders,
        selectTrader,
        updateCopySettings,
        startCopyTrading,
        stopCopyTrading,
        clearError,

        // Trade handling
        onTradeSignal,
        offTradeSignal,
    };
};

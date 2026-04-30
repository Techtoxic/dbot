/**
 * Deriv Copy Trading API Service
 * Handles all copy trading operations with Deriv API
 */

import { getAppId } from '@/components/shared';

export interface DerivAccount {
    account_id: string;
    account_type: 'demo' | 'real';
    balance: number;
    currency: string;
    token: string;
}

export interface CopyTradingTrader {
    trader_id: string;
    name: string;
    performance: {
        total_trades: number;
        win_rate: number;
        profit_loss: number;
        max_drawdown: number;
    };
    risk_score: number;
    is_active: boolean;
    allow_copiers: boolean;
}

export interface CopyTradingSettings {
    trader_id: string;
    copy_amount: number;
    max_risk: number;
    stop_loss: number;
    take_profit: number;
    is_active: boolean;
}

export interface TradeSignal {
    trade_id: string;
    symbol: string;
    action: 'buy' | 'sell';
    amount: number;
    duration: number;
    duration_unit: 't' | 's' | 'm' | 'h' | 'd';
    basis: 'stake' | 'payout';
    contract_type: string;
    timestamp: number;
}

class DerivCopyTradingService {
    private apiUrl = 'https://api.deriv.com';
    private appId = getAppId();
    private wsConnection: WebSocket | null = null;
    private isConnected = false;
    private copyTradingEnabled = false;
    private currentSettings: CopyTradingSettings | null = null;
    private tradeListeners: ((signal: TradeSignal) => void)[] = [];

    constructor() {
        this.initializeWebSocket();
    }

    /**
     * Initialize WebSocket connection to Deriv API
     */
    private initializeWebSocket(): void {
        try {
            this.wsConnection = new WebSocket(`wss://ws.derivws.com/websockets/v3?app_id=${this.appId}`);

            this.wsConnection.onopen = () => {
                console.log('Deriv Copy Trading WebSocket connected');
                this.isConnected = true;
            };

            this.wsConnection.onmessage = event => {
                this.handleWebSocketMessage(event);
            };

            this.wsConnection.onerror = error => {
                console.error('Deriv Copy Trading WebSocket error:', error);
                this.isConnected = false;
            };

            this.wsConnection.onclose = () => {
                console.log('Deriv Copy Trading WebSocket disconnected');
                this.isConnected = false;
                // Attempt to reconnect after 5 seconds
                setTimeout(() => this.initializeWebSocket(), 5000);
            };
        } catch (error) {
            console.error('Failed to initialize Deriv Copy Trading WebSocket:', error);
        }
    }

    /**
     * Handle incoming WebSocket messages
     */
    private handleWebSocketMessage(event: MessageEvent): void {
        try {
            const data = JSON.parse(event.data);

            if (data.msg_type === 'trade') {
                this.handleTradeUpdate(data.trade);
            } else if (data.msg_type === 'copy_trading_start') {
                console.log('Copy trading started:', data);
            } else if (data.msg_type === 'copy_trading_stop') {
                console.log('Copy trading stopped:', data);
            }
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
        }
    }

    /**
     * Handle trade updates from the trader being copied
     */
    private handleTradeUpdate(trade: Record<string, unknown>): void {
        if (!this.copyTradingEnabled || !this.currentSettings) {
            return;
        }

        const signal: TradeSignal = {
            trade_id: trade.trade_id || trade.id,
            symbol: trade.symbol,
            action: trade.action || (trade.buy_price ? 'buy' : 'sell'),
            amount: this.calculateCopyAmount(trade.amount || trade.stake),
            duration: trade.duration,
            duration_unit: trade.duration_unit || 't',
            basis: trade.basis || 'stake',
            contract_type: trade.contract_type || 'CALL',
            timestamp: Date.now(),
        };

        // Notify all listeners about the new trade signal
        this.tradeListeners.forEach(listener => listener(signal));
    }

    /**
     * Calculate the amount to copy based on settings
     */
    private calculateCopyAmount(originalAmount: number): number {
        if (!this.currentSettings) return originalAmount;

        // Scale the amount based on copy_amount setting
        const scaledAmount = (originalAmount * this.currentSettings.copy_amount) / 100;

        // Apply max risk limit
        const maxAmount = this.currentSettings.max_risk;
        return Math.min(scaledAmount, maxAmount);
    }

    /**
     * Authenticate with Deriv API
     */
    async authenticate(account: DerivAccount): Promise<boolean> {
        if (!this.isConnected) {
            throw new Error('WebSocket not connected');
        }

        const authRequest = {
            authorize: account.token,
            account: account.account_id,
        };

        return new Promise((resolve, reject) => {
            if (!this.wsConnection) {
                reject(new Error('WebSocket not available'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Authentication timeout'));
            }, 10000);

            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.msg_type === 'authorize') {
                        clearTimeout(timeout);
                        this.wsConnection?.removeEventListener('message', handleMessage);

                        if (data.error) {
                            reject(new Error(data.error.message));
                        } else {
                            resolve(true);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing auth response:', error);
                }
            };

            this.wsConnection.addEventListener('message', handleMessage);
            this.wsConnection.send(JSON.stringify(authRequest));
        });
    }

    /**
     * Get available traders for copying
     */
    async getAvailableTraders(): Promise<CopyTradingTrader[]> {
        // In a real implementation, this would call the Deriv API
        // For now, return mock data
        return [
            {
                trader_id: 'trader_001',
                name: 'Expert Trader Alpha',
                performance: {
                    total_trades: 1250,
                    win_rate: 78.5,
                    profit_loss: 15420.5,
                    max_drawdown: 5.2,
                },
                risk_score: 3,
                is_active: true,
                allow_copiers: true,
            },
            {
                trader_id: 'trader_002',
                name: 'Strategy Master Beta',
                performance: {
                    total_trades: 890,
                    win_rate: 82.1,
                    profit_loss: 22350.75,
                    max_drawdown: 3.8,
                },
                risk_score: 2,
                is_active: true,
                allow_copiers: true,
            },
            {
                trader_id: 'trader_003',
                name: 'Risk Manager Gamma',
                performance: {
                    total_trades: 2100,
                    win_rate: 71.3,
                    profit_loss: 18950.25,
                    max_drawdown: 2.1,
                },
                risk_score: 1,
                is_active: true,
                allow_copiers: true,
            },
        ];
    }

    /**
     * Start copying a trader
     */
    async startCopyTrading(settings: CopyTradingSettings): Promise<boolean> {
        if (!this.isConnected) {
            throw new Error('WebSocket not connected');
        }

        const copyStartRequest = {
            copy_start: {
                trader_id: settings.trader_id,
                copy_amount: settings.copy_amount,
                max_risk: settings.max_risk,
                stop_loss: settings.stop_loss,
                take_profit: settings.take_profit,
            },
        };

        return new Promise((resolve, reject) => {
            if (!this.wsConnection) {
                reject(new Error('WebSocket not available'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Copy start timeout'));
            }, 10000);

            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.msg_type === 'copy_trading_start') {
                        clearTimeout(timeout);
                        this.wsConnection?.removeEventListener('message', handleMessage);

                        if (data.error) {
                            reject(new Error(data.error.message));
                        } else {
                            this.copyTradingEnabled = true;
                            this.currentSettings = settings;
                            resolve(true);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing copy start response:', error);
                }
            };

            this.wsConnection.addEventListener('message', handleMessage);
            this.wsConnection.send(JSON.stringify(copyStartRequest));
        });
    }

    /**
     * Stop copying trades
     */
    async stopCopyTrading(): Promise<boolean> {
        if (!this.isConnected) {
            throw new Error('WebSocket not connected');
        }

        const copyStopRequest = {
            copy_stop: {},
        };

        return new Promise((resolve, reject) => {
            if (!this.wsConnection) {
                reject(new Error('WebSocket not available'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Copy stop timeout'));
            }, 10000);

            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.msg_type === 'copy_trading_stop') {
                        clearTimeout(timeout);
                        this.wsConnection?.removeEventListener('message', handleMessage);

                        if (data.error) {
                            reject(new Error(data.error.message));
                        } else {
                            this.copyTradingEnabled = false;
                            this.currentSettings = null;
                            resolve(true);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing copy stop response:', error);
                }
            };

            this.wsConnection.addEventListener('message', handleMessage);
            this.wsConnection.send(JSON.stringify(copyStopRequest));
        });
    }

    /**
     * Place a trade based on copy trading signal
     */
    async placeCopyTrade(signal: TradeSignal): Promise<boolean> {
        if (!this.isConnected) {
            throw new Error('WebSocket not connected');
        }

        const tradeRequest = {
            buy: {
                contract_type: signal.contract_type,
                symbol: signal.symbol,
                amount: signal.amount,
                duration: signal.duration,
                duration_unit: signal.duration_unit,
                basis: signal.basis,
            },
        };

        return new Promise((resolve, reject) => {
            if (!this.wsConnection) {
                reject(new Error('WebSocket not available'));
                return;
            }

            const timeout = setTimeout(() => {
                reject(new Error('Trade placement timeout'));
            }, 10000);

            const handleMessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.msg_type === 'buy') {
                        clearTimeout(timeout);
                        this.wsConnection?.removeEventListener('message', handleMessage);

                        if (data.error) {
                            reject(new Error(data.error.message));
                        } else {
                            console.log('Copy trade placed successfully:', data);
                            resolve(true);
                        }
                    }
                } catch (error) {
                    console.error('Error parsing trade response:', error);
                }
            };

            this.wsConnection.addEventListener('message', handleMessage);
            this.wsConnection.send(JSON.stringify(tradeRequest));
        });
    }

    /**
     * Subscribe to trade signals
     */
    onTradeSignal(callback: (signal: TradeSignal) => void): void {
        this.tradeListeners.push(callback);
    }

    /**
     * Unsubscribe from trade signals
     */
    offTradeSignal(callback: (signal: TradeSignal) => void): void {
        this.tradeListeners = this.tradeListeners.filter(listener => listener !== callback);
    }

    /**
     * Get current copy trading status
     */
    getCopyTradingStatus(): { enabled: boolean; settings: CopyTradingSettings | null } {
        return {
            enabled: this.copyTradingEnabled,
            settings: this.currentSettings,
        };
    }

    /**
     * Cleanup resources
     */
    destroy(): void {
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
        this.tradeListeners = [];
        this.isConnected = false;
        this.copyTradingEnabled = false;
        this.currentSettings = null;
    }
}

// Export singleton instance
export const derivCopyTradingService = new DerivCopyTradingService();
export default derivCopyTradingService;

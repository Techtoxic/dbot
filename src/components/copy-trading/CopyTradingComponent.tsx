import React, { useEffect,useState } from 'react';
import { Localize } from '@deriv/translations';
import { TradeSignal,useCopyTrading } from '../../hooks/useCopyTrading';
import { DerivAccount } from '../../services/deriv-copy-trading';
import './CopyTradingComponent.scss';

interface CopyTradingComponentProps {
    demoAccount: DerivAccount;
    realAccount: DerivAccount;
    onTradeSignal?: (signal: TradeSignal) => void;
}

const CopyTradingComponent: React.FC<CopyTradingComponentProps> = ({ demoAccount, realAccount, onTradeSignal }) => {
    const {
        traders,
        selectedTrader,
        copySettings,
        isCopyTradingActive,
        isLoading,
        error,
        selectTrader,
        updateCopySettings,
        startCopyTrading,
        stopCopyTrading,
        clearError,
        onTradeSignal: subscribeToTradeSignals,
        offTradeSignal: unsubscribeFromTradeSignals,
    } = useCopyTrading();

    const [showTraderSelection, setShowTraderSelection] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [recentTrades, setRecentTrades] = useState<TradeSignal[]>([]);

    // Handle trade signals
    useEffect(() => {
        const handleTradeSignal = (signal: TradeSignal) => {
            setRecentTrades(prev => [signal, ...prev.slice(0, 9)]); // Keep last 10 trades
            onTradeSignal?.(signal);
        };

        subscribeToTradeSignals(handleTradeSignal);
        return () => unsubscribeFromTradeSignals(handleTradeSignal);
    }, [subscribeToTradeSignals, unsubscribeFromTradeSignals, onTradeSignal]);

    const handleStartCopyTrading = async () => {
        if (!selectedTrader || !copySettings) return;

        const success = await startCopyTrading(realAccount);
        if (success) {
            setShowTraderSelection(false);
            setShowSettings(false);
        }
    };

    const handleStopCopyTrading = async () => {
        await stopCopyTrading();
    };

    const handleSettingsChange = (field: keyof typeof copySettings, value: number) => {
        if (copySettings) {
            updateCopySettings({ [field]: value });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const formatPercentage = (value: number) => {
        return `${value.toFixed(1)}%`;
    };

    return (
        <div className='copy-trading-component'>
            {/* Header */}
            <div className='copy-trading-component__header'>
                <h2 className='copy-trading-component__title'>
                    <Localize i18n_default_text='Copy Trading' />
                </h2>
                <div className='copy-trading-component__status'>
                    <div className={`status-indicator ${isCopyTradingActive ? 'active' : 'inactive'}`}>
                        {isCopyTradingActive ? 'ACTIVE' : 'INACTIVE'}
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className='copy-trading-component__error'>
                    <span>{error}</span>
                    <button onClick={clearError} className='error-close'>
                        ×
                    </button>
                </div>
            )}

            {/* Account Balances */}
            <div className='copy-trading-component__accounts'>
                <div className='account-card demo'>
                    <h3>Demo Account</h3>
                    <div className='account-balance'>{formatCurrency(demoAccount.balance)}</div>
                    <div className='account-status'>Demo Mode</div>
                </div>
                <div className='account-card real'>
                    <h3>Real Account</h3>
                    <div className='account-balance'>{formatCurrency(realAccount.balance)}</div>
                    <div className='account-status'>{realAccount.balance > 0 ? 'Active' : 'Inactive'}</div>
                </div>
            </div>

            {/* Main Controls */}
            <div className='copy-trading-component__controls'>
                {!isCopyTradingActive ? (
                    <div className='controls-section'>
                        <button
                            className='btn btn-primary'
                            onClick={() => setShowTraderSelection(true)}
                            disabled={realAccount.balance === 0}
                        >
                            <Localize i18n_default_text='Select Trader to Copy' />
                        </button>
                        {realAccount.balance === 0 && (
                            <p className='warning-text'>
                                <Localize i18n_default_text='Add funds to your real account to start copy trading' />
                            </p>
                        )}
                    </div>
                ) : (
                    <div className='controls-section'>
                        <div className='active-trader-info'>
                            <h4>Copying: {selectedTrader?.name}</h4>
                            <p>
                                Copy Amount: {copySettings?.copy_amount}% | Max Risk:{' '}
                                {formatCurrency(copySettings?.max_risk || 0)}
                            </p>
                        </div>
                        <button className='btn btn-danger' onClick={handleStopCopyTrading} disabled={isLoading}>
                            <Localize i18n_default_text='Stop Copy Trading' />
                        </button>
                    </div>
                )}
            </div>

            {/* Trader Selection Modal */}
            {showTraderSelection && (
                <div className='modal-overlay'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <h3>Select Trader to Copy</h3>
                            <button onClick={() => setShowTraderSelection(false)} className='modal-close'>
                                ×
                            </button>
                        </div>
                        <div className='modal-body'>
                            {isLoading ? (
                                <div className='loading'>Loading traders...</div>
                            ) : (
                                <div className='traders-list'>
                                    {traders.map(trader => (
                                        <div
                                            key={trader.trader_id}
                                            className={`trader-card ${selectedTrader?.trader_id === trader.trader_id ? 'selected' : ''}`}
                                            onClick={() => selectTrader(trader)}
                                        >
                                            <div className='trader-info'>
                                                <h4>{trader.name}</h4>
                                                <div className='trader-stats'>
                                                    <div className='stat'>
                                                        <span className='label'>Win Rate:</span>
                                                        <span className='value'>
                                                            {formatPercentage(trader.performance.win_rate)}
                                                        </span>
                                                    </div>
                                                    <div className='stat'>
                                                        <span className='label'>Total Trades:</span>
                                                        <span className='value'>{trader.performance.total_trades}</span>
                                                    </div>
                                                    <div className='stat'>
                                                        <span className='label'>P&L:</span>
                                                        <span
                                                            className={`value ${trader.performance.profit_loss >= 0 ? 'positive' : 'negative'}`}
                                                        >
                                                            {formatCurrency(trader.performance.profit_loss)}
                                                        </span>
                                                    </div>
                                                    <div className='stat'>
                                                        <span className='label'>Max Drawdown:</span>
                                                        <span className='value'>
                                                            {formatPercentage(trader.performance.max_drawdown)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className='risk-score'>Risk Score: {trader.risk_score}/5</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className='modal-footer'>
                            <button className='btn btn-secondary' onClick={() => setShowTraderSelection(false)}>
                                Cancel
                            </button>
                            <button
                                className='btn btn-primary'
                                onClick={() => setShowSettings(true)}
                                disabled={!selectedTrader}
                            >
                                Configure Settings
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Settings Modal */}
            {showSettings && copySettings && (
                <div className='modal-overlay'>
                    <div className='modal-content'>
                        <div className='modal-header'>
                            <h3>Copy Trading Settings</h3>
                            <button onClick={() => setShowSettings(false)} className='modal-close'>
                                ×
                            </button>
                        </div>
                        <div className='modal-body'>
                            <div className='settings-form'>
                                <div className='form-group'>
                                    <label>Copy Amount (%)</label>
                                    <input
                                        type='number'
                                        min='1'
                                        max='100'
                                        value={copySettings.copy_amount}
                                        onChange={e => handleSettingsChange('copy_amount', Number(e.target.value))}
                                    />
                                    <small>Percentage of original trade amount to copy</small>
                                </div>

                                <div className='form-group'>
                                    <label>Max Risk per Trade ($)</label>
                                    <input
                                        type='number'
                                        min='1'
                                        max='10000'
                                        value={copySettings.max_risk}
                                        onChange={e => handleSettingsChange('max_risk', Number(e.target.value))}
                                    />
                                    <small>Maximum amount to risk per copied trade</small>
                                </div>

                                <div className='form-group'>
                                    <label>Stop Loss (%)</label>
                                    <input
                                        type='number'
                                        min='0'
                                        max='100'
                                        value={copySettings.stop_loss}
                                        onChange={e => handleSettingsChange('stop_loss', Number(e.target.value))}
                                    />
                                    <small>Stop loss percentage (0 = disabled)</small>
                                </div>

                                <div className='form-group'>
                                    <label>Take Profit (%)</label>
                                    <input
                                        type='number'
                                        min='0'
                                        max='1000'
                                        value={copySettings.take_profit}
                                        onChange={e => handleSettingsChange('take_profit', Number(e.target.value))}
                                    />
                                    <small>Take profit percentage (0 = disabled)</small>
                                </div>
                            </div>
                        </div>
                        <div className='modal-footer'>
                            <button className='btn btn-secondary' onClick={() => setShowSettings(false)}>
                                Back
                            </button>
                            <button className='btn btn-primary' onClick={handleStartCopyTrading} disabled={isLoading}>
                                {isLoading ? 'Starting...' : 'Start Copy Trading'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Trades */}
            {recentTrades.length > 0 && (
                <div className='copy-trading-component__recent-trades'>
                    <h3>Recent Copy Trades</h3>
                    <div className='trades-list'>
                        {recentTrades.map((trade, index) => (
                            <div key={`${trade.trade_id}-${index}`} className='trade-item'>
                                <div className='trade-symbol'>{trade.symbol}</div>
                                <div className={`trade-action ${trade.action}`}>{trade.action.toUpperCase()}</div>
                                <div className='trade-amount'>{formatCurrency(trade.amount)}</div>
                                <div className='trade-time'>{new Date(trade.timestamp).toLocaleTimeString()}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* How it Works */}
            <div className='copy-trading-component__info'>
                <h4>How Copy Trading Works:</h4>
                <ul>
                    <li>✅ Select an experienced trader from our verified list</li>
                    <li>✅ Configure your copy settings (amount, risk limits)</li>
                    <li>✅ All trades from the selected trader are automatically copied to your real account</li>
                    <li>✅ Monitor performance and adjust settings as needed</li>
                    <li>✅ Stop copying anytime with one click</li>
                </ul>
            </div>
        </div>
    );
};

export default CopyTradingComponent;

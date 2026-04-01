import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

interface TradeParams {
    amount: string;
    duration: string;
}

interface DigitStats {
    digit: number;
    percentage: number;
    payout: number;
}

const TradingPanel: React.FC = observer(() => {
    const store = useStore();
    const chart_store = store?.chart_store;

    // Show loading state if store is not ready
    if (!store) {
        return (
            <div className='trading-panel'>
                <div className='trading-panel__loading'>
                    <div className='loading-message'>Loading trading panel...</div>
                </div>
            </div>
        );
    }
    const [tradeParams, setTradeParams] = useState<TradeParams>({
        amount: '10',
        duration: '5',
    });

    const [isTrading, setIsTrading] = useState(false);
    const [digitStats, setDigitStats] = useState<DigitStats[]>([]);
    const [isUsingRealData, setIsUsingRealData] = useState(false);
    const [selectedDigit, setSelectedDigit] = useState<number>(5); // Default selected digit

    // Listen for real-time digit statistics and last digit updates
    useEffect(() => {
        const handleDigitStatsUpdate = (event: CustomEvent) => {
            const { digitStats: realStats, totalTicks } = event.detail;

            if (realStats && totalTicks > 0) {
                console.log(`📊 Received real digit stats from ${totalTicks} ticks`);

                // Convert real stats to component format
                const formattedStats = Object.keys(realStats).map(digitStr => {
                    const digit = parseInt(digitStr);
                    const count = realStats[digit] || 0;
                    const percentage = (count / totalTicks) * 100;

                    return {
                        digit,
                        percentage,
                        payout: 10 / (percentage / 100), // Calculate payout based on real probability
                    };
                });

                // Sort by digit for consistent display
                formattedStats.sort((a, b) => a.digit - b.digit);

                setDigitStats(formattedStats);
                setIsUsingRealData(true);

                console.log(
                    `✅ Updated with real data:`,
                    formattedStats.map(s => `${s.digit}: ${s.percentage.toFixed(1)}%`)
                );
            }
        };

        const handleLastDigitUpdate = (event: CustomEvent) => {
            const { lastDigit } = event.detail;
            // Auto-select the current last digit for trading
            setSelectedDigit(lastDigit);
        };

        // Add event listeners
        window.addEventListener('digitStatsUpdate', handleDigitStatsUpdate as EventListener);
        window.addEventListener('lastDigitUpdate', handleLastDigitUpdate as EventListener);

        // Cleanup on unmount
        return () => {
            window.removeEventListener('digitStatsUpdate', handleDigitStatsUpdate as EventListener);
            window.removeEventListener('lastDigitUpdate', handleLastDigitUpdate as EventListener);
        };
    }, []);

    // Initialize with default values if no real data is received within 3 seconds
    useEffect(() => {
        const initializeFallback = () => {
            setTimeout(() => {
                if (digitStats.length === 0) {
                    console.log('⚠️ No real data received, initializing with default values');

                    const defaultStats = Array.from({ length: 10 }, (_, index) => ({
                        digit: index,
                        percentage: 10.0, // Equal probability as fallback
                        payout: 9.5, // Standard payout
                    }));

                    setDigitStats(defaultStats);
                    setIsUsingRealData(false);
                }
            }, 3000);
        };

        initializeFallback();
    }, [digitStats.length]);

    const handleParamChange = (key: keyof TradeParams, value: string) => {
        setTradeParams(prev => ({ ...prev, [key]: value }));
    };

    // Handle trade execution (real trading - not implemented)
    const handleTrade = async (type: 'OVER' | 'UNDER') => {
        setIsTrading(true);

        try {
            console.log('Trade request:', {
                ...tradeParams,
                trade_type: type,
                symbol: chart_store?.symbol,
            });

            // Real trading API integration would go here
            // For now, show that real trading is not implemented
            alert('Real trading is not implemented yet. This interface is for market data visualization only.');
        } catch (error) {
            console.error('Trade failed:', error);
            alert('Trade failed. Please try again.');
        } finally {
            setIsTrading(false);
        }
    };

    const calculatePayout = (multiplier: number) => {
        const amount = parseFloat(tradeParams.amount) || 0;
        return (amount * multiplier).toFixed(2);
    };

    const adjustStake = (increment: boolean) => {
        const currentAmount = parseFloat(tradeParams.amount) || 0;
        const newAmount = increment ? currentAmount + 1 : Math.max(1, currentAmount - 1);
        handleParamChange('amount', String(newAmount));
    };

    const getDigitPayout = (digit: number) => {
        const stat = digitStats.find(s => s.digit === digit);
        return stat ? stat.payout : 9.5;
    };

    // const getDigitPercentage = (digit: number) => {
    //     const stat = digitStats.find(s => s.digit === digit);
    //     return stat ? stat.percentage.toFixed(1) : '10.0';
    // };

    return (
        <div className='trading-panel'>
            <div className='trading-panel__header'>
                <div className='trading-panel__nav'>
                    <button className='nav-btn'>←</button>
                    <div className='nav-icons'>
                        <span className='nav-icon'>📊</span>
                        <span className='nav-icon active'>🎯</span>
                    </div>
                    <span className='nav-text'>Even/Odd</span>
                </div>
                <div className='learn-link'>
                    <span>Learn about this trade type</span>
                </div>
            </div>

            <div className='trading-panel__content'>
                {/* Ticks Section */}
                <div className='ticks-section'>
                    <div className='ticks-header'>
                        <span className='ticks-title'>Ticks</span>
                    </div>
                    <div className='ticks-duration'>
                        <span className='duration-value'>{tradeParams.duration} Ticks</span>
                    </div>
                </div>

                {/* Digit analysis now shown in chart area */}
                <div className='digit-info'>
                    <div className='digit-info__title'>
                        Last Digit Analysis
                        <span className={`data-source ${isUsingRealData ? 'real' : 'fallback'}`}>
                            {isUsingRealData ? '🟢 Live (1000 ticks)' : '🟡 Default'}
                        </span>
                    </div>
                    <div className='digit-info__note'>View real-time digit statistics in the chart area below</div>
                </div>

                {/* Stake and Payout Section */}
                <div className='stake-payout-section'>
                    <div className='stake-section'>
                        <div className='section-label'>Stake</div>
                        <div className='stake-controls'>
                            <button className='stake-btn' onClick={() => adjustStake(false)}>
                                −
                            </button>
                            <input
                                type='number'
                                className='stake-input'
                                value={tradeParams.amount}
                                onChange={e => handleParamChange('amount', e.target.value)}
                                min='1'
                            />
                            <button className='stake-btn' onClick={() => adjustStake(true)}>
                                +
                            </button>
                            <span className='currency'>USD</span>
                        </div>
                    </div>

                    <div className='payout-section'>
                        <div className='section-label'>Payout</div>
                        <div className='payout-info'>
                            <div className='payout-value'>{calculatePayout(getDigitPayout(selectedDigit))} USD</div>
                            <div className='payout-info-icon'>ℹ️</div>
                        </div>
                    </div>
                </div>

                {/* Over/Under Buttons */}
                <div className='trade-buttons'>
                    <button className='trade-btn over-btn' onClick={() => handleTrade('OVER')} disabled={isTrading}>
                        <div className='btn-content'>
                            <div className='btn-icon'>📈</div>
                            <div className='btn-label'>Over</div>
                            <div className='btn-percentage'>
                                {((getDigitPayout(selectedDigit) / parseFloat(tradeParams.amount)) * 100).toFixed(1)}%
                            </div>
                        </div>
                    </button>

                    <div className='payout-display'>
                        <div className='payout-item'>
                            <span>Payout</span>
                            <span className='payout-amount'>{calculatePayout(getDigitPayout(selectedDigit))} USD</span>
                            <span className='payout-info-icon'>ℹ️</span>
                        </div>
                    </div>

                    <button className='trade-btn under-btn' onClick={() => handleTrade('UNDER')} disabled={isTrading}>
                        <div className='btn-content'>
                            <div className='btn-icon'>📉</div>
                            <div className='btn-label'>Under</div>
                            <div className='btn-percentage'>
                                {(
                                    ((getDigitPayout(selectedDigit) * 0.95) / parseFloat(tradeParams.amount)) *
                                    100
                                ).toFixed(1)}
                                %
                            </div>
                        </div>
                    </button>

                    <div className='payout-display'>
                        <div className='payout-item'>
                            <span>Payout</span>
                            <span className='payout-amount'>
                                {calculatePayout(getDigitPayout(selectedDigit) * 0.95)} USD
                            </span>
                            <span className='payout-info-icon'>ℹ️</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TradingPanel;

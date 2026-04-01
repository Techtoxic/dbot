import React, { useCallback, useEffect, useRef, useState } from 'react';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import './dtrader.scss';

interface MarketData {
    symbol: string;
    name: string;
}

const DTrader: React.FC = () => {
    console.log('DTrader component rendering...');

    // Add error state
    const [hasError, setHasError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const [selectedMarket, setSelectedMarket] = useState<MarketData>({
        symbol: '1HZ10V',
        name: 'Volatility 10 (1s) Index',
    });
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [lastDigit, setLastDigit] = useState<number>(0);
    const [digitStats, setDigitStats] = useState<{ [key: number]: number }>({});
    const [priceHistory, setPriceHistory] = useState<number[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const subscriptionIdRef = useRef<string>('');

    const markets: MarketData[] = [
        { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
        { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index' },
        { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index' },
        { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index' },
        { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
        { symbol: 'R_10', name: 'Volatility 10 Index' },
        { symbol: 'R_25', name: 'Volatility 25 Index' },
        { symbol: 'R_50', name: 'Volatility 50 Index' },
        { symbol: 'R_75', name: 'Volatility 75 Index' },
        { symbol: 'R_100', name: 'Volatility 100 Index' },
    ];

    // Initialize API and subscribe to market data
    useEffect(() => {
        const initializeAPI = async () => {
            try {
                setConnectionStatus('Initializing API...');
                console.log('🔄 Initializing Deriv API for DTrader...');

                if (!chart_api?.api) {
                    await chart_api.init();
                }

                if (chart_api?.api && chart_api.api.connection) {
                    setConnectionStatus('Connected to Deriv');
                    setIsConnected(true);
                    console.log('✅ Deriv API connected successfully');

                    // Subscribe to market data
                    subscribeToMarketData(selectedMarket.symbol);
                } else {
                    setConnectionStatus('Demo Mode - No API');
                    console.warn('❌ API not available, running in demo mode');
                }
            } catch (error) {
                setConnectionStatus('Demo Mode - API Error');
                setErrorMessage(String(error));
                console.error('❌ API initialization error:', error);
            }
        };

        // Wrap in try-catch to prevent component crash
        try {
            initializeAPI();
        } catch (error) {
            setHasError(true);
            setErrorMessage('Failed to initialize DTrader');
            console.error('Component initialization error:', error);
        }

        // Cleanup on unmount
        return () => {
            try {
                if (subscriptionIdRef.current && chart_api?.api) {
                    chart_api.api.forget(subscriptionIdRef.current);
                }
            } catch (error) {
                console.warn('Cleanup error:', error);
            }
        };
    }, [selectedMarket.symbol, subscribeToMarketData]);

    // Subscribe to market data when symbol changes
    useEffect(() => {
        if (isConnected && selectedMarket.symbol) {
            subscribeToMarketData(selectedMarket.symbol);
        }
    }, [selectedMarket.symbol, isConnected, subscribeToMarketData]);

    const subscribeToMarketData = useCallback(async (symbol: string) => {
        try {
            // Clean up previous subscription
            if (subscriptionIdRef.current && chart_api.api) {
                chart_api.api.forget(subscriptionIdRef.current);
            }

            console.log(`📊 Subscribing to ${symbol} market data...`);

            const request = {
                ticks_history: symbol,
                end: 'latest',
                count: 1000,
                subscribe: 1,
            };

            const response = await chart_api.api.send(request);

            if (response.subscription?.id) {
                subscriptionIdRef.current = response.subscription.id;
                console.log(`✅ Subscribed to ${symbol} with ID: ${response.subscription.id}`);
            }

            // Process initial historical data
            if (response.history?.prices) {
                const prices = response.history.prices.map((p: string) => parseFloat(p));
                setPriceHistory(prices);

                const latestPrice = prices[prices.length - 1];
                setCurrentPrice(latestPrice);

                // Calculate digit statistics
                const stats: { [key: number]: number } = {};
                prices.forEach((price: number) => {
                    const digit = getLastDigit(price, symbol);
                    stats[digit] = (stats[digit] || 0) + 1;
                });
                setDigitStats(stats);
                setLastDigit(getLastDigit(latestPrice, symbol));
            }

            // Set up real-time subscription
            chart_api.api.onMessage()?.subscribe(({ data }: { data: any }) => {
                if (data.tick && data.tick.symbol === symbol) {
                    const price = parseFloat(data.tick.quote);

                    setCurrentPrice(prevPrice => {
                        const change = prevPrice ? price - prevPrice : 0;
                        setPriceChange(change);
                        return price;
                    });

                    const digit = getLastDigit(price, symbol);
                    setLastDigit(digit);

                    // Update price history and digit stats
                    setPriceHistory(prev => {
                        const newHistory = [...prev, price].slice(-1000);

                        // Recalculate digit stats
                        const newStats: { [key: number]: number } = {};
                        newHistory.forEach((p: number) => {
                            const d = getLastDigit(p, symbol);
                            newStats[d] = (newStats[d] || 0) + 1;
                        });
                        setDigitStats(newStats);

                        return newHistory;
                    });
                }
            });
        } catch (error) {
            console.error('❌ Failed to subscribe to market data:', error);
            setConnectionStatus('Subscription failed');
        }
    }, []);

    const getLastDigit = (price: number, symbol: string): number => {
        // Use appropriate decimal precision for each symbol
        let multiplier = 100; // Default for 2 decimal places

        if (['R_25', 'R_10', '1HZ30V', '1HZ90V', '1HZ15V'].includes(symbol)) {
            multiplier = 1000; // 3 decimal places
        } else if (['R_50', 'R_75'].includes(symbol)) {
            multiplier = 10000; // 4 decimal places
        }

        const scaledPrice = Math.round(price * multiplier);
        return scaledPrice % 10;
    };

    const formatPrice = (price: number): string => {
        const decimalPlaces: { [key: string]: number } = {
            '1HZ50V': 2,
            '1HZ25V': 2,
            '1HZ10V': 2,
            '1HZ75V': 2,
            '1HZ100V': 2,
            R_100: 2,
            R_25: 3,
            R_10: 3,
            '1HZ30V': 3,
            '1HZ90V': 3,
            '1HZ15V': 3,
            R_50: 4,
            R_75: 4,
        };

        const places = decimalPlaces[selectedMarket.symbol] || 5;
        return price.toFixed(places);
    };

    const getDigitPercentage = (digit: number): string => {
        const totalTicks = Object.values(digitStats).reduce((sum, count) => sum + count, 0);
        if (totalTicks > 0 && digitStats[digit]) {
            return ((digitStats[digit] / totalTicks) * 100).toFixed(1);
        }
        return '10.0';
    };

    // Show error fallback if component has crashed
    if (hasError) {
        return (
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '400px',
                            flexDirection: 'column',
                            gap: '20px',
                            color: '#666',
                        }}
                    >
                        <div style={{ fontSize: '2rem' }}>⚠️</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>DTrader Error</div>
                        <div style={{ fontSize: '1rem', textAlign: 'center', maxWidth: '400px' }}>
                            {errorMessage || 'Something went wrong. Please refresh the page and try again.'}
                        </div>
                        <button
                            onClick={() => {
                                setHasError(false);
                                setErrorMessage('');
                                window.location.reload();
                            }}
                            style={{
                                padding: '10px 20px',
                                background: '#ff444f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    try {
        return (
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div className='dtrader__chart-section'>
                        <div className='dtrader__chart-header'>
                            <div className='market-selector'>
                                <div
                                    className='market-selector__current'
                                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                >
                                    <span className='market-selector__name'>{selectedMarket.name}</span>
                                    <span className={`market-selector__arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
                                </div>

                                {isDropdownOpen && (
                                    <div className='market-selector__dropdown'>
                                        {markets.map(market => (
                                            <div
                                                key={market.symbol}
                                                className={`market-selector__option ${market.symbol === selectedMarket.symbol ? 'selected' : ''}`}
                                                onClick={() => {
                                                    setSelectedMarket(market);
                                                    setIsDropdownOpen(false);
                                                }}
                                            >
                                                <span className='market-option__name'>{market.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className='dtrader__chart-info'>
                                <span className='dtrader__current-price'>
                                    {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                                </span>
                                <span className={`dtrader__price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                                    {currentPrice > 0 ? (
                                        <>
                                            {priceChange >= 0 ? '+' : ''}
                                            {priceChange.toFixed(3)} ({((priceChange / currentPrice) * 100).toFixed(3)}
                                            %)
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </span>
                                <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '4px' }}>
                                    {connectionStatus} • {selectedMarket.symbol}
                                </div>
                            </div>
                        </div>
                        <div className='trading-chart'>
                            <div className='trading-chart__container'>
                                <div className='trading-chart__placeholder'>
                                    <div className='trading-chart__price-display'>
                                        <div className='trading-chart__current-price'>
                                            {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                                        </div>
                                        <div
                                            className={`trading-chart__price-change ${priceChange >= 0 ? 'positive' : 'negative'}`}
                                        >
                                            {currentPrice > 0 ? (
                                                <>
                                                    {priceChange >= 0 ? '+' : ''}
                                                    {priceChange.toFixed(3)} (
                                                    {((priceChange / currentPrice) * 100).toFixed(3)}%)
                                                </>
                                            ) : (
                                                '--'
                                            )}
                                        </div>
                                    </div>

                                    {/* Real-time Digit Circles */}
                                    {isConnected && currentPrice > 0 ? (
                                        <div className='main-digit-circles'>
                                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => {
                                                const percentage = getDigitPercentage(digit);
                                                const isCurrentLastDigit = digit === lastDigit;

                                                // Find highest and lowest percentages
                                                const totalTicks = Object.values(digitStats).reduce(
                                                    (sum, count) => sum + count,
                                                    0
                                                );
                                                const allPercentages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => {
                                                    const count = digitStats[d] || 0;
                                                    return totalTicks > 0 ? (count / totalTicks) * 100 : 0;
                                                });

                                                const maxPercentage = Math.max(...allPercentages);
                                                const minPercentage = Math.min(...allPercentages.filter(p => p > 0));
                                                const currentPercentage = parseFloat(percentage);

                                                const isHighest =
                                                    Math.abs(currentPercentage - maxPercentage) < 0.1 &&
                                                    maxPercentage > 0 &&
                                                    totalTicks > 100;
                                                const isLowest =
                                                    Math.abs(currentPercentage - minPercentage) < 0.1 &&
                                                    minPercentage > 0 &&
                                                    totalTicks > 100;

                                                return (
                                                    <div key={digit} className='main-digit-item'>
                                                        <div
                                                            className={`main-digit-circle ${isCurrentLastDigit ? 'main-digit-circle--current' : ''} ${isHighest ? 'main-digit-circle--highest' : ''} ${isLowest ? 'main-digit-circle--lowest' : ''}`}
                                                        >
                                                            <div className='main-digit-circle__number'>{digit}</div>
                                                            <div className='main-digit-circle__percentage'>
                                                                {percentage}%
                                                            </div>
                                                        </div>
                                                        {isCurrentLastDigit && (
                                                            <div className='main-digit-cursor'>
                                                                <div className='main-digit-cursor__arrow'>▲</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                height: '100px',
                                                color: '#666',
                                                fontSize: '1rem',
                                            }}
                                        >
                                            {connectionStatus}...
                                        </div>
                                    )}

                                    <div
                                        style={{
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            height: '200px',
                                            background: '#f8f9fa',
                                            borderRadius: '8px',
                                            color: '#666',
                                            fontSize: '1.1rem',
                                            marginTop: '1rem',
                                            gap: '10px',
                                        }}
                                    >
                                        <div>
                                            📈 Live Price Data: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
                                        </div>
                                        <div style={{ fontSize: '0.9rem' }}>
                                            {priceHistory.length > 0
                                                ? `${priceHistory.length} ticks received`
                                                : 'Waiting for data...'}
                                        </div>
                                        {isConnected && currentPrice > 0 && (
                                            <div style={{ fontSize: '0.9rem', textAlign: 'center' }}>
                                                <div>
                                                    Last Digit: <strong>{lastDigit}</strong>
                                                </div>
                                                <div>
                                                    Total Ticks:{' '}
                                                    <strong>
                                                        {Object.values(digitStats).reduce(
                                                            (sum, count) => sum + count,
                                                            0
                                                        )}
                                                    </strong>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className='dtrader__trading-section'>
                        <div className='trading-panel'>
                            <div className='trading-panel__header'>
                                <div className='trading-panel__nav'>
                                    <span className='nav-text'>DTrader</span>
                                </div>
                            </div>
                            <div className='trading-panel__content'>
                                <div className='trading-panel__section'>
                                    <label className='trading-panel__label'>Trade Type</label>
                                    <select className='trading-panel__select'>
                                        <option>Rise/Fall</option>
                                        <option>Higher/Lower</option>
                                        <option>Touch/No Touch</option>
                                    </select>
                                </div>

                                <div className='trading-panel__section'>
                                    <label className='trading-panel__label'>Duration</label>
                                    <div className='trading-panel__input-group'>
                                        <input
                                            type='number'
                                            className='trading-panel__input trading-panel__input--duration'
                                            defaultValue='5'
                                        />
                                        <select className='trading-panel__select trading-panel__select--duration'>
                                            <option>Ticks</option>
                                            <option>Seconds</option>
                                            <option>Minutes</option>
                                        </select>
                                    </div>
                                </div>

                                <div className='trading-panel__section'>
                                    <label className='trading-panel__label'>Stake</label>
                                    <div className='trading-panel__input-group'>
                                        <input type='number' className='trading-panel__input' defaultValue='10' />
                                        <span className='trading-panel__currency'>USD</span>
                                    </div>
                                </div>

                                <div className='trading-panel__payout'>
                                    <div className='trading-panel__payout-row'>
                                        <span>Payout</span>
                                        <span>19.50 USD</span>
                                    </div>
                                    <div className='trading-panel__payout-row'>
                                        <span>Profit</span>
                                        <span>9.50 USD</span>
                                    </div>
                                </div>

                                <div className='trading-panel__trade-buttons'>
                                    <button className='trading-panel__trade-btn call'>
                                        <div className='trading-panel__btn-content'>
                                            <div className='trading-panel__btn-label'>Rise</div>
                                            <div className='trading-panel__btn-payout'>19.50 USD</div>
                                        </div>
                                    </button>
                                    <button className='trading-panel__trade-btn put'>
                                        <div className='trading-panel__btn-content'>
                                            <div className='trading-panel__btn-label'>Fall</div>
                                            <div className='trading-panel__btn-payout'>19.50 USD</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    } catch (renderError) {
        console.error('DTrader render error:', renderError);
        return (
            <div className='dtrader'>
                <div className='dtrader__main-content'>
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '400px',
                            flexDirection: 'column',
                            gap: '20px',
                            color: '#666',
                        }}
                    >
                        <div style={{ fontSize: '2rem' }}>🔧</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>DTrader Render Error</div>
                        <div style={{ fontSize: '1rem', textAlign: 'center', maxWidth: '400px' }}>
                            The component failed to render. Please refresh the page.
                        </div>
                        <button
                            onClick={() => window.location.reload()}
                            style={{
                                padding: '10px 20px',
                                background: '#ff444f',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                            }}
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            </div>
        );
    }
};

export default DTrader;

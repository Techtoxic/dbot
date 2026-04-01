import React, { useCallback, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import { useStore } from '@/hooks/useStore';
import { TicksHistoryResponse, TicksStreamRequest } from '@deriv/api-types';

type TSubscription = {
    [key: string]: null | {
        unsubscribe?: () => void;
    };
};

type TError = null | {
    error?: {
        code?: string;
        message?: string;
    };
};

const subscriptions: TSubscription = {};

const TradingChart: React.FC = observer(() => {
    const store = useStore();
    const chart_store = store?.chart_store;

    // Add error logging for debugging
    useEffect(() => {
        console.log('TradingChart mounted, store:', !!store, 'chart_store:', !!chart_store);
    }, [store, chart_store]);

    // Show loading state if store is not ready
    if (!store || !chart_store) {
        return (
            <div className='trading-chart'>
                <div className='trading-chart__loading'>
                    <div className='loading-message'>Loading chart...</div>
                </div>
            </div>
        );
    }
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [lastDigit, setLastDigit] = useState<number>(0);
    const [priceHistory, setPriceHistory] = useState<number[]>([]);
    const [digitStats, setDigitStats] = useState<{ [key: number]: number }>({});
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string>('');
    const chartSubscriptionIdRef = useRef<string>(chart_store?.chart_subscription_id || '');

    // Initialize symbol if not set
    useEffect(() => {
        if (!chart_store?.symbol) {
            // Set a default symbol if none is set
            chart_store?.onSymbolChange?.('1HZ10V'); // Default to Volatility 10 (1s) Index
        }
    }, [chart_store]);

    // Sync chartSubscriptionIdRef with MobX store
    useEffect(() => {
        chartSubscriptionIdRef.current = chart_store?.chart_subscription_id || '';
    }, [chart_store?.chart_subscription_id]);

    // Initialize chart API with robust error handling
    useEffect(() => {
        const initializeAPI = async () => {
            try {
                console.log('🔄 Attempting to initialize chart API...');

                // Try to initialize the API
                if (!chart_api.api) {
                    await chart_api.init();
                }

                // Check if API is actually ready
                if (chart_api.api && chart_api.api.connection) {
                    console.log('✅ Chart API initialized successfully');
                    setIsConnected(true);
                } else {
                    console.warn('API connection not established');
                    setIsConnected(false);
                }
            } catch (error) {
                console.warn('⚠️ Chart API initialization failed:', error);
                setIsConnected(false);
            }
        };

        // Initialize with timeout
        const timeoutId = setTimeout(() => {
            console.warn('API initialization timeout');
            setIsConnected(false);
        }, 10000);

        initializeAPI()
            .catch(error => {
                console.warn('API initialization promise rejected:', error);
                setIsConnected(false);
            })
            .finally(() => {
                clearTimeout(timeoutId);
            });

        return () => {
            clearTimeout(timeoutId);
        };
    }, []);

    // Cleanup all tick subscriptions on unmount
    useEffect(() => {
        return () => {
            if (chart_api.api) {
                chart_api.api.forgetAll('ticks');
            }
        };
    }, []);

    // API request function (currently unused but kept for future use)
    // const requestAPI = (req: ServerTimeRequest | ActiveSymbolsRequest | TradingTimesRequest) => {
    //     return chart_api.api.send(req);
    // };

    // Subscribe to tick data with proper error handling
    const requestSubscribe = useCallback(
        async (req: TicksStreamRequest, callback: (data: unknown) => void) => {
            try {
                // Clean up previous subscription
                if (chartSubscriptionIdRef.current) {
                    chart_api.api.forget(chartSubscriptionIdRef.current);
                }

                const history = await chart_api.api.send(req);

                // Store subscription ID for cleanup
                if (history?.subscription?.id) {
                    chart_store?.setChartSubscriptionId(history.subscription.id);
                }

                // Process initial data
                if (history) callback(history);

                // Set up real-time subscription
                if (req.subscribe === 1) {
                    subscriptions[history?.subscription?.id] = chart_api.api
                        .onMessage()
                        ?.subscribe(({ data }: { data: TicksHistoryResponse }) => {
                            callback(data);
                        });
                }
            } catch (e) {
                const error = e as TError;
                if (error?.error?.code === 'MarketIsClosed') {
                    console.warn('Market is closed');
                    callback([]);
                } else {
                    console.warn('Subscription error:', error?.error?.message);
                }
                callback([]);
            }
        },
        [chart_store]
    );

    // Real Deriv market data integration with 1000 tick analysis
    useEffect(() => {
        const subscribeToRealData = async () => {
            try {
                setError('');

                // Validate prerequisites
                if (!chart_api.api) {
                    console.warn('API not initialized');
                    setIsConnected(false);
                    return;
                }

                if (!chart_store?.symbol) {
                    console.warn('No market symbol selected');
                    setIsConnected(false);
                    return;
                }

                // Check WebSocket connection state
                if (!chart_api.api.connection) {
                    console.warn('No API connection available');
                    setIsConnected(false);
                    return;
                }

                if (chart_api.api.connection.readyState !== WebSocket.OPEN) {
                    console.warn('API connection not ready');
                    setIsConnected(false);
                    return;
                }

                console.log(`📊 Attempting to connect to real Deriv data for ${chart_store.symbol}`);

                const historyRequest = {
                    ticks_history: chart_store.symbol,
                    end: 'latest',
                    count: 1000, // Last 1000 ticks for digit analysis
                    subscribe: 1,
                };

                await requestSubscribe(historyRequest, (data: unknown) => {
                    const tickData = data as { tick?: { quote: string }; history?: { prices: string[] } };
                    if (tickData.tick) {
                        // Handle real-time tick data
                        const price = parseFloat(tickData.tick.quote);

                        setCurrentPrice(prevPrice => {
                            const change = prevPrice ? price - prevPrice : 0;
                            setPriceChange(change);

                            // Calculate last digit using Deriv's exact method
                            const digit = getLastDigitFromPrice(price, chart_store?.symbol);
                            setLastDigit(digit);

                            // Update price history and digit statistics
                            setPriceHistory(prevHistory => {
                                const newHistory = [...prevHistory, price];
                                const recentHistory = newHistory.slice(-1000); // Keep last 1000 ticks

                                // Recalculate digit stats from the recent history for accuracy
                                const newStats: { [key: number]: number } = {};
                                recentHistory.forEach((histPrice: number) => {
                                    const d = getLastDigitFromPrice(histPrice, chart_store?.symbol);
                                    newStats[d] = (newStats[d] || 0) + 1;
                                });
                                setDigitStats(newStats);

                                // Emit digit statistics update to trading panel
                                window.dispatchEvent(
                                    new CustomEvent('digitStatsUpdate', {
                                        detail: { digitStats: newStats, totalTicks: recentHistory.length },
                                    })
                                );

                                return recentHistory;
                            });

                            // Emit price update to header
                            window.dispatchEvent(
                                new CustomEvent('priceUpdate', {
                                    detail: { price, change },
                                })
                            );

                            // Emit current last digit update
                            window.dispatchEvent(
                                new CustomEvent('lastDigitUpdate', {
                                    detail: { lastDigit: digit },
                                })
                            );

                            return price;
                        });
                    } else if (tickData.history) {
                        // Handle historical data
                        const { prices } = tickData.history;
                        if (prices && prices.length > 0) {
                            const latestPrice = parseFloat(prices[prices.length - 1]);
                            setCurrentPrice(latestPrice);

                            const digit = getLastDigitFromPrice(latestPrice, chart_store?.symbol);
                            setLastDigit(digit);

                            // Initialize price history with historical data
                            const historicalPrices = prices.map((p: string) => parseFloat(p));
                            setPriceHistory(historicalPrices);

                            // Initialize digit stats from historical data
                            const stats: { [key: number]: number } = {};
                            historicalPrices.forEach((price: number) => {
                                const d = getLastDigitFromPrice(price, chart_store?.symbol);
                                stats[d] = (stats[d] || 0) + 1;
                            });
                            setDigitStats(stats);

                            // Emit initial price to header
                            window.dispatchEvent(
                                new CustomEvent('priceUpdate', {
                                    detail: { price: latestPrice, change: 0 },
                                })
                            );

                            // Emit initial digit statistics to trading panel
                            window.dispatchEvent(
                                new CustomEvent('digitStatsUpdate', {
                                    detail: { digitStats: stats, totalTicks: historicalPrices.length },
                                })
                            );
                        }
                    }
                });

                setIsConnected(true);
                console.log('✅ Connected to real Deriv data');
            } catch (error) {
                console.warn('❌ Failed to connect to Deriv API:', error);
                setIsConnected(false);
            }
        };

        if (chart_store?.symbol) {
            subscribeToRealData().catch(error => {
                console.warn('Subscription failed:', error);
                setIsConnected(false);
            });
        }

        // Cleanup subscription on unmount or symbol change
        return () => {
            if (chartSubscriptionIdRef.current) {
                chart_api.api?.forget(chartSubscriptionIdRef.current);
                chartSubscriptionIdRef.current = '';
                chart_store?.setChartSubscriptionId('');
            }

            // Clean up all subscriptions
            Object.keys(subscriptions).forEach(id => {
                subscriptions[id]?.unsubscribe?.();
                delete subscriptions[id];
            });
        };
    }, [chart_store?.symbol, chart_store, getLastDigitFromPrice, requestSubscribe]);

    // Format price based on symbol-specific decimal places
    const formatPrice = (price: number, symbol?: string) => {
        const currentSymbol = symbol || chart_store?.symbol || '';

        // Define decimal places for each symbol
        const decimalPlaces: { [key: string]: number } = {
            // 2 decimal places
            '1HZ50V': 2, // Volatility 50 (1s)
            '1HZ25V': 2, // Volatility 25 (1s)
            '1HZ10V': 2, // Volatility 10 (1s)
            '1HZ75V': 2, // Volatility 75 (1s)
            '1HZ100V': 2, // Volatility 100 (1s)
            R_100: 2, // Volatility 100

            // 3 decimal places
            R_25: 3, // Volatility 25
            R_10: 3, // Volatility 10
            '1HZ30V': 3, // Volatility 30 (1s)
            '1HZ90V': 3, // Volatility 90 (1s)
            '1HZ15V': 3, // Volatility 15 (1s)

            // 4 decimal places
            R_50: 4, // Volatility 50
            R_75: 4, // Volatility 75
        };

        const places = decimalPlaces[currentSymbol] || 5; // Default to 5 decimal places for unknown symbols
        return price.toFixed(places);
    };

    // Calculate last digit exactly like Deriv does
    const getLastDigitFromPrice = useCallback(
        (price: number, symbol?: string) => {
            const currentSymbol = symbol || chart_store?.symbol || '';

            // Deriv's exact method: use the appropriate decimal precision for each symbol
            let multiplier = 100; // Default for 2 decimal places

            // Adjust multiplier based on symbol's decimal places
            if (['R_25', 'R_10', '1HZ30V', '1HZ90V', '1HZ15V'].includes(currentSymbol)) {
                multiplier = 1000; // 3 decimal places
            } else if (['R_50', 'R_75'].includes(currentSymbol)) {
                multiplier = 10000; // 4 decimal places
            }

            // Round to avoid floating point precision issues
            const scaledPrice = Math.round(price * multiplier);
            return scaledPrice % 10;
        },
        [chart_store]
    );

    // Calculate digit percentages from real data with smoothing
    const getDigitPercentage = (digit: number) => {
        const totalTicks = Object.values(digitStats).reduce((sum, count) => sum + count, 0);

        if (totalTicks > 100 && digitStats[digit]) {
            const rawPercentage = (digitStats[digit] / totalTicks) * 100;

            // Apply slight smoothing to match Deriv's behavior (they use weighted averages)
            const smoothingFactor = Math.min(totalTicks / 1000, 1); // More smoothing with more data
            const theoreticalPercentage = 10; // Each digit should theoretically be 10%
            const smoothedPercentage = rawPercentage * smoothingFactor + theoreticalPercentage * (1 - smoothingFactor);

            return smoothedPercentage.toFixed(1);
        }

        return '10.0'; // Default to theoretical 10% when insufficient data
    };

    const generateSVGPath = () => {
        if (priceHistory.length < 2) return '';

        const width = 800;
        const height = 300;
        const minPrice = Math.min(...priceHistory);
        const maxPrice = Math.max(...priceHistory);
        const priceRange = maxPrice - minPrice || 1;

        const points = priceHistory.map((price, index) => {
            const x = (index / (priceHistory.length - 1)) * width;
            const y = height - ((price - minPrice) / priceRange) * height;
            return `${x},${y}`;
        });

        return `M${points.join(' L')}`;
    };

    return (
        <div className='trading-chart'>
            <div className='trading-chart__header'>
                <div className='trading-chart__controls'>
                    <button className='trading-chart__timeframe active'>1m</button>
                    <button className='trading-chart__timeframe'>5m</button>
                    <button className='trading-chart__timeframe'>15m</button>
                    <button className='trading-chart__timeframe'>1h</button>
                    <button className='trading-chart__timeframe'>4h</button>
                    <button className='trading-chart__timeframe'>1d</button>
                </div>

                <div className='trading-chart__indicators'>
                    <button className='trading-chart__indicator'>MA</button>
                    <button className='trading-chart__indicator'>RSI</button>
                    <button className='trading-chart__indicator'>MACD</button>
                </div>
            </div>

            <div className='trading-chart__container'>
                {/* Chart Toolbar */}
                <div className='chart-toolbar'>
                    <button className='toolbar-btn'>📈</button>
                    <button className='toolbar-btn'>📊</button>
                    <button className='toolbar-btn'>📋</button>
                    <button className='toolbar-btn'>✏️</button>
                    <button className='toolbar-btn'>📥</button>
                    <button className='toolbar-btn'>⚙️</button>
                    <button className='toolbar-btn'>➕</button>
                    <button className='toolbar-btn'>➖</button>
                </div>

                <div className='trading-chart__placeholder'>
                    {error ? (
                        <div className='trading-chart__error'>
                            <div className='error-icon'>⚠️</div>
                            <div className='error-message'>{error}</div>
                            <div className='error-symbol'>Symbol: {chart_store?.symbol || '1HZ10V'}</div>
                        </div>
                    ) : !isConnected ? (
                        <div className='trading-chart__loading'>
                            <div className='loading-icon'>🔄</div>
                            <div className='loading-message'>Connecting to Deriv API...</div>
                            <div className='loading-symbol'>Symbol: {chart_store?.symbol || '1HZ10V'}</div>
                        </div>
                    ) : (
                        <>
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
                                            {priceChange.toFixed(3)} ({((priceChange / currentPrice) * 100).toFixed(3)}
                                            %)
                                        </>
                                    ) : (
                                        '--'
                                    )}
                                </div>
                            </div>

                            {/* Digit Circles - Moved to main chart area for better visibility */}
                            {isConnected && currentPrice > 0 && (
                                <div className='main-digit-circles'>
                                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => {
                                        const percentage = getDigitPercentage(digit);
                                        const isCurrentLastDigit = digit === lastDigit;

                                        // Find actual highest and lowest percentages from real data
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
                                                    className={`main-digit-circle ${
                                                        isHighest ? 'main-digit-circle--highest' : ''
                                                    } ${isLowest ? 'main-digit-circle--lowest' : ''} ${
                                                        isCurrentLastDigit ? 'main-digit-circle--current' : ''
                                                    }`}
                                                    title={`Digit ${digit}: ${percentage}%`}
                                                >
                                                    <div className='main-digit-circle__number'>{digit}</div>
                                                    <div className='main-digit-circle__percentage'>{percentage}%</div>
                                                </div>

                                                {/* Red cursor for current last digit */}
                                                {isCurrentLastDigit && (
                                                    <div className='main-digit-cursor'>
                                                        <div className='main-digit-cursor__arrow'>▲</div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    {isConnected && currentPrice > 0 && (
                        <>
                            <div className='trading-chart__mock-chart'>
                                <svg width='100%' height='300' viewBox='0 0 800 300'>
                                    <defs>
                                        <linearGradient id='priceGradient' x1='0%' y1='0%' x2='0%' y2='100%'>
                                            <stop
                                                offset='0%'
                                                stopColor={priceChange >= 0 ? '#4bb4b7' : '#ff444f'}
                                                stopOpacity='0.3'
                                            />
                                            <stop
                                                offset='100%'
                                                stopColor={priceChange >= 0 ? '#4bb4b7' : '#ff444f'}
                                                stopOpacity='0'
                                            />
                                        </linearGradient>
                                    </defs>

                                    {priceHistory.length > 1 && (
                                        <>
                                            <path
                                                d={generateSVGPath()}
                                                stroke={priceChange >= 0 ? '#4bb4b7' : '#ff444f'}
                                                strokeWidth='2'
                                                fill='none'
                                            />

                                            <path
                                                d={`${generateSVGPath()} L800,300 L0,300 Z`}
                                                fill='url(#priceGradient)'
                                            />
                                        </>
                                    )}

                                    {/* Current price line */}
                                    <line
                                        x1='0'
                                        y1='150'
                                        x2='800'
                                        y2='150'
                                        stroke='#666'
                                        strokeWidth='1'
                                        strokeDasharray='5,5'
                                        opacity='0.5'
                                    />

                                    {/* Current price indicator */}
                                    <circle cx='750' cy='150' r='4' fill='#333' />
                                    <rect x='720' y='140' width='60' height='20' fill='#333' rx='2' />
                                    <text
                                        x='750'
                                        y='152'
                                        textAnchor='middle'
                                        fill='white'
                                        fontSize='10'
                                        fontWeight='600'
                                    >
                                        {formatPrice(currentPrice)}
                                    </text>
                                </svg>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

export default TradingChart;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import './analysis.scss';

interface MarketData {
    symbol: string;
    name: string;
    market?: string;
    submarket?: string;
}

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

type TradeType = 'even_odd' | 'rise_fall' | 'over_under';
type OverUnderPrediction =
    | 'over_0'
    | 'over_1'
    | 'over_2'
    | 'over_3'
    | 'over_4'
    | 'over_5'
    | 'over_6'
    | 'over_7'
    | 'over_8'
    | 'under_1'
    | 'under_2'
    | 'under_3'
    | 'under_4'
    | 'under_5'
    | 'under_6'
    | 'under_7'
    | 'under_8'
    | 'under_9';

const subscriptions: TSubscription = {};

const AnalysistoolComponent: React.FC<{ isActive?: boolean }> = ({ isActive = true }) => {
    console.log('Analysis Tool component rendering...');

    // State management
    const [selectedMarket, setSelectedMarket] = useState<MarketData>({
        symbol: '1HZ10V',
        name: 'Volatility 10 (1s) Index',
    });
    const [selectedTradeType, setSelectedTradeType] = useState<TradeType>('over_under');
    const [selectedPrediction, setSelectedPrediction] = useState<OverUnderPrediction>('under_4');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [currentPrice, setCurrentPrice] = useState<number>(0);
    const [priceChange, setPriceChange] = useState<number>(0);
    const [lastDigit, setLastDigit] = useState<number>(0);
    const [digitStats, setDigitStats] = useState<{ [key: number]: number }>({});
    const [priceHistory, setPriceHistory] = useState<number[]>([]);
    const [lastDigitHistory, setLastDigitHistory] = useState<number[]>([]);
    const [showAllHistory, setShowAllHistory] = useState(false);
    const [tickCount, setTickCount] = useState<number>(1000);
    const [isConnected, setIsConnected] = useState(false);
    const [connectionStatus, setConnectionStatus] = useState('Connecting...');
    const subscriptionIdRef = useRef<string>('');
    const lastSubscriptionTimeRef = useRef<number>(0);
    const subscriptionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [availableMarkets, setAvailableMarkets] = useState<MarketData[]>([]);
    const [isLoadingMarkets, setIsLoadingMarkets] = useState(true);

    // Trade type options
    const tradeTypeOptions = [
        { value: 'over_under', label: 'Over/Under', description: 'Predict if last digit will be over or under 5' },
        { value: 'even_odd', label: 'Even/Odd', description: 'Predict if last digit will be even or odd' },
        { value: 'rise_fall', label: 'Rise/Fall', description: 'Predict if price will rise or fall' },
    ];

    // Tick count options
    const tickCountOptions = [
        { value: 100, label: '100 Ticks' },
        { value: 500, label: '500 Ticks' },
        { value: 1000, label: '1000 Ticks' },
        { value: 2000, label: '2000 Ticks' },
        { value: 5000, label: '5000 Ticks' },
    ];

    // Over/Under prediction options
    const overUnderPredictions = [
        { value: 'over_0', label: 'Over 0', description: '1-9 win' },
        { value: 'over_1', label: 'Over 1', description: '2-9 win' },
        { value: 'over_2', label: 'Over 2', description: '3-9 win' },
        { value: 'over_3', label: 'Over 3', description: '4-9 win' },
        { value: 'over_4', label: 'Over 4', description: '5-9 win' },
        { value: 'over_5', label: 'Over 5', description: '6-9 win' },
        { value: 'over_6', label: 'Over 6', description: '7-9 win' },
        { value: 'over_7', label: 'Over 7', description: '8-9 win' },
        { value: 'over_8', label: 'Over 8', description: 'Only 9 wins' },
        { value: 'under_1', label: 'Under 1', description: 'Only 0 wins' },
        { value: 'under_2', label: 'Under 2', description: '0-1 win' },
        { value: 'under_3', label: 'Under 3', description: '0-2 win' },
        { value: 'under_4', label: 'Under 4', description: '0-3 win' },
        { value: 'under_5', label: 'Under 5', description: '0-4 win' },
        { value: 'under_6', label: 'Under 6', description: '0-5 win' },
        { value: 'under_7', label: 'Under 7', description: '0-6 win' },
        { value: 'under_8', label: 'Under 8', description: '0-7 win' },
        { value: 'under_9', label: 'Under 9', description: '0-8 win' },
    ];

// Cleanup all subscriptions on unmount
useEffect(() => {
    return () => {
        try {
            if (subscriptionIdRef.current && chart_api?.api) {
                chart_api.api.forget(subscriptionIdRef.current);
            }
            const sub = subscriptions[subscriptionIdRef.current];
            sub?.unsubscribe?.();
            if (subscriptionIdRef.current) delete subscriptions[subscriptionIdRef.current];
        } catch {}
    };
}, []);

    // Fetch available markets from API with timeout and better error handling
    const fetchAvailableMarkets = useCallback(async () => {
        console.log('🔄 Fetching available markets for Analysis Tool...');
        setIsLoadingMarkets(true);

        // Always set fallback markets first to ensure UI works - prioritized by popularity
        const fallbackMarkets: MarketData[] = [
            // Most Popular: 1-second Volatility Indices (V10-V100)
            {
                symbol: '1HZ10V',
                name: 'Volatility 10 (1s) Index',
                market: 'synthetic_index',
                submarket: 'random_index',
            },
            {
                symbol: '1HZ25V',
                name: 'Volatility 25 (1s) Index',
                market: 'synthetic_index',
                submarket: 'random_index',
            },
            {
                symbol: '1HZ50V',
                name: 'Volatility 50 (1s) Index',
                market: 'synthetic_index',
                submarket: 'random_index',
            },
            {
                symbol: '1HZ75V',
                name: 'Volatility 75 (1s) Index',
                market: 'synthetic_index',
                submarket: 'random_index',
            },
            {
                symbol: '1HZ100V',
                name: 'Volatility 100 (1s) Index',
                market: 'synthetic_index',
                submarket: 'random_index',
            },

            // Regular Volatility Indices
            { symbol: 'R_10', name: 'Volatility 10 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_25', name: 'Volatility 25 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_50', name: 'Volatility 50 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_75', name: 'Volatility 75 Index', market: 'synthetic_index', submarket: 'random_index' },
            { symbol: 'R_100', name: 'Volatility 100 Index', market: 'synthetic_index', submarket: 'random_index' },

            // Jump Indices (Popular for advanced traders)
            { symbol: 'JD10', name: 'Jump 10 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD25', name: 'Jump 25 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD50', name: 'Jump 50 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD75', name: 'Jump 75 Index', market: 'synthetic_index', submarket: 'jump_index' },
            { symbol: 'JD100', name: 'Jump 100 Index', market: 'synthetic_index', submarket: 'jump_index' },
        ];

        // Set fallback markets immediately
        setAvailableMarkets(fallbackMarkets);
        if (!selectedMarket.symbol) {
            setSelectedMarket(fallbackMarkets[0]);
            console.log(`🎯 Set default market: ${fallbackMarkets[0].symbol}`);
        }

        try {
            // Try to fetch from API with timeout
            const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 5000));

            const apiPromise = (async () => {
                if (!chart_api?.api) {
                    await chart_api.init();
                }

                const activeSymbolsRequest = {
                    active_symbols: 'brief',
                    product_type: 'basic',
                };

                return await chart_api.api.send(activeSymbolsRequest);
            })();

            const response = await Promise.race([apiPromise, timeoutPromise]);

            if (response && (response as any).active_symbols) {
                const apiMarkets = (response as any).active_symbols
                    .filter((symbol: any) => {
                        return (
                            symbol.market === 'synthetic_index' ||
                            symbol.market === 'forex' ||
                            symbol.market === 'commodities' ||
                            symbol.market === 'stock_indices'
                        );
                    })
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        name: symbol.display_name,
                        market: symbol.market,
                        submarket: symbol.submarket,
                    }))
                    .sort((a: MarketData, b: MarketData) => {
                        // Custom sorting by popularity and type
                        const getMarketPriority = (market: MarketData) => {
                            // 1-second volatility indices (most popular)
                            if (market.symbol?.match(/^1HZ\d+V$/)) return 1;

                            // Regular volatility indices
                            if (market.symbol?.match(/^R_\d+$/)) return 2;

                            // Jump indices
                            if (market.submarket === 'jump_index' || market.symbol?.startsWith('JD')) return 3;

                            // Other synthetic indices
                            if (market.market === 'synthetic_index') return 4;

                            // Forex major pairs
                            if (market.market === 'forex' && market.submarket === 'major_pairs') return 5;

                            // Other forex
                            if (market.market === 'forex') return 6;

                            // Everything else
                            return 7;
                        };

                        const priorityA = getMarketPriority(a);
                        const priorityB = getMarketPriority(b);

                        if (priorityA !== priorityB) {
                            return priorityA - priorityB;
                        }

                        // Within same priority, sort alphabetically
                        return a.name.localeCompare(b.name);
                    });

                if (apiMarkets.length > 0) {
                    setAvailableMarkets(apiMarkets);
                    console.log(`✅ Loaded ${apiMarkets.length} markets from API`);
                }
            }
        } catch (error) {
            console.warn('⚠️ Using fallback markets:', error);
            // Fallback markets are already set above
        } finally {
            setIsLoadingMarkets(false);
        }
    }, [selectedMarket.symbol]);

    // Helper functions
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

    // Helper function to check if digit is winning for selected prediction
    const isWinningDigit = (digit: number): boolean => {
        switch (selectedPrediction) {
            case 'over_0':
                return digit > 0;
            case 'over_1':
                return digit > 1;
            case 'over_2':
                return digit > 2;
            case 'over_3':
                return digit > 3;
            case 'over_4':
                return digit > 4;
            case 'over_5':
                return digit > 5;
            case 'over_6':
                return digit > 6;
            case 'over_7':
                return digit > 7;
            case 'over_8':
                return digit > 8;
            case 'under_1':
                return digit < 1;
            case 'under_2':
                return digit < 2;
            case 'under_3':
                return digit < 3;
            case 'under_4':
                return digit < 4;
            case 'under_5':
                return digit < 5;
            case 'under_6':
                return digit < 6;
            case 'under_7':
                return digit < 7;
            case 'under_8':
                return digit < 8;
            case 'under_9':
                return digit < 9;
            default:
                return false;
        }
    };

    // Get analysis data based on trade type
    const getAnalysisData = () => {
        const totalTicks = Object.values(digitStats).reduce((sum, count) => sum + count, 0);

        if (selectedTradeType === 'even_odd') {
            const evenCount = [0, 2, 4, 6, 8].reduce((sum, digit) => sum + (digitStats[digit] || 0), 0);
            const oddCount = [1, 3, 5, 7, 9].reduce((sum, digit) => sum + (digitStats[digit] || 0), 0);

            return {
                even: {
                    count: evenCount,
                    percentage: totalTicks > 0 ? ((evenCount / totalTicks) * 100).toFixed(1) : '50.0',
                },
                odd: {
                    count: oddCount,
                    percentage: totalTicks > 0 ? ((oddCount / totalTicks) * 100).toFixed(1) : '50.0',
                },
            };
        } else if (selectedTradeType === 'over_under') {
            // Calculate based on selected prediction
            const winningCount = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].reduce((sum, digit) => {
                return sum + (isWinningDigit(digit) ? digitStats[digit] || 0 : 0);
            }, 0);
            const losingCount = totalTicks - winningCount;

            return {
                winning: {
                    count: winningCount,
                    percentage: totalTicks > 0 ? ((winningCount / totalTicks) * 100).toFixed(1) : '50.0',
                },
                losing: {
                    count: losingCount,
                    percentage: totalTicks > 0 ? ((losingCount / totalTicks) * 100).toFixed(1) : '50.0',
                },
            };
        } else if (selectedTradeType === 'rise_fall') {
            const riseCount = priceHistory.filter(
                (price, index) => index > 0 && price > priceHistory[index - 1]
            ).length;
            const fallCount = priceHistory.filter(
                (price, index) => index > 0 && price < priceHistory[index - 1]
            ).length;
            const totalMoves = riseCount + fallCount;

            return {
                rise: {
                    count: riseCount,
                    percentage: totalMoves > 0 ? ((riseCount / totalMoves) * 100).toFixed(1) : '50.0',
                },
                fall: {
                    count: fallCount,
                    percentage: totalMoves > 0 ? ((fallCount / totalMoves) * 100).toFixed(1) : '50.0',
                },
            };
        }

        return {};
    };

    // Request functions similar to Chart component
    const requestForgetStream = (subscription_id: string) => {
        if (subscription_id) {
            try {
                chart_api.api.forget(subscription_id);
            } catch {}
            const sub = subscriptions[subscription_id];
            sub?.unsubscribe?.();
            delete subscriptions[subscription_id];
        }
    };

    const requestSubscribe = useCallback(async (req: any, callback: (data: any) => void) => {
        try {
            requestForgetStream(subscriptionIdRef.current);
            const history = await chart_api.api.send(req);

            if (history?.subscription?.id) {
                subscriptionIdRef.current = history.subscription.id;
            }

            if (history) callback(history);

            if (req.subscribe === 1) {
                subscriptions[history?.subscription?.id] = chart_api.api
                    .onMessage()
                    ?.subscribe(({ data }: { data: any }) => {
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
    }, []);

    // Subscribe to market data - memoized to prevent infinite re-renders
    const subscribeToMarketData = useCallback(
        async (symbol: string) => {
            try {
                console.log(`📊 Analysis Tool subscribing to ${symbol} market data...`);

                // Clean up any existing subscriptions first
                if (subscriptionIdRef.current) {
                    console.log(`🧹 Cleaning up previous subscription: ${subscriptionIdRef.current}`);
                    requestForgetStream(subscriptionIdRef.current);
                    subscriptionIdRef.current = '';
                }

                const request = {
                    ticks_history: symbol,
                    end: 'latest',
                    count: tickCount,
                    subscribe: 1,
                };

                await requestSubscribe(request, (data: any) => {
                    if (data.tick && data.tick.symbol === symbol) {
                        // Handle real-time tick data
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
                            const newHistory = [...prev, price].slice(-tickCount);

                            // Recalculate digit stats
                            const newStats: { [key: number]: number } = {};
                            const newDigitHistory: number[] = [];
                            newHistory.forEach((p: number) => {
                                const d = getLastDigit(p, symbol);
                                newStats[d] = (newStats[d] || 0) + 1;
                                newDigitHistory.push(d);
                            });
                            setDigitStats(newStats);

                            // Update digit history - keep only last 100 digits
                            const newDigitHistorySlice = newDigitHistory.slice(-100);
                            setLastDigitHistory(newDigitHistorySlice);

                            return newHistory;
                        });

                        // Update connection status on first tick
                        setConnectionStatus(`Connected to ${symbol}`);
                    } else if (data.history?.prices) {
                        // Handle historical data
                        console.log(
                            `📈 Analysis Tool received ${data.history.prices.length} historical prices for ${symbol}`
                        );
                        const prices = data.history.prices.map((p: string) => parseFloat(p));
                        setPriceHistory(prices);

                        const latestPrice = prices[prices.length - 1];
                        setCurrentPrice(latestPrice);

                        // Calculate digit statistics and history
                        const stats: { [key: number]: number } = {};
                        const digitHistory: number[] = [];
                        prices.forEach((price: number) => {
                            const digit = getLastDigit(price, symbol);
                            stats[digit] = (stats[digit] || 0) + 1;
                            digitHistory.push(digit);
                        });
                        setDigitStats(stats);
                        setLastDigitHistory(digitHistory.slice(-100)); // Keep last 100 digits for history
                        setLastDigit(getLastDigit(latestPrice, symbol));

                        // Update connection status
                        setConnectionStatus(`Connected to ${symbol}`);
                        console.log(
                            `✅ Analysis Tool ${symbol} data loaded: Price ${latestPrice}, Last digit ${getLastDigit(latestPrice, symbol)}`
                        );
                    }
                });

                console.log(`✅ Analysis Tool subscribed to ${symbol} market data`);
            } catch (error) {
                console.error('❌ Analysis Tool failed to subscribe to market data:', error);
                setConnectionStatus('Subscription failed');
            }
        },
        [tickCount]
    ); // Include tickCount to re-create function when tick count changes

    // Initialize API and fetch markets once on mount
    useEffect(() => {
        const initializeAPI = async () => {
            try {
                setConnectionStatus('Initializing API...');
                console.log('🔄 Initializing Deriv API for Analysis Tool...');

                if (!chart_api?.api) {
                    await chart_api.init();
                }

                if (chart_api?.api && chart_api.api.connection) {
                    setConnectionStatus('Connected to Deriv');
                    setIsConnected(true);
                    console.log('✅ Analysis Tool Deriv API connected successfully');

                    // Fetch available markets after API is connected
                    await fetchAvailableMarkets();
                } else {
                    setConnectionStatus('Demo Mode - No API');
                    console.warn('❌ API not available, running in demo mode');
                    // Still fetch markets in demo mode
                    await fetchAvailableMarkets();
                }
            } catch (error) {
                setConnectionStatus('Demo Mode - API Error');
                console.error('❌ Analysis Tool API initialization error:', error);
                // Fallback to hardcoded markets
                await fetchAvailableMarkets();
            }
        };

        // Initialize markets first, then API
        fetchAvailableMarkets();

        // Only initialize API once
        if (!isConnected) {
            initializeAPI().catch(error => {
                console.error('Analysis Tool component initialization error:', error);
            });
        }

        // Cleanup on unmount
        return () => {
            try {
                if (subscriptionIdRef.current && chart_api?.api) {
                    chart_api.api.forget(subscriptionIdRef.current);
                }
            } catch (error) {
                console.warn('Analysis Tool cleanup error:', error);
            }
        };
    }, []); // Empty dependency array - only run once

    // Subscribe to market data when symbol, tick count changes or connection is established (with debouncing)
    useEffect(() => {
        if (!isActive) {
            // If not active, pause subscription
            if (subscriptionIdRef.current && chart_api?.api) {
                try {
                    chart_api.api.forget(subscriptionIdRef.current);
                } catch {}
            }
            return;
        }

        if (isConnected && selectedMarket.symbol) {
            console.log(`🔄 Analysis Tool market/tick count changed to: ${selectedMarket.symbol} (${tickCount} ticks)`);

            // Clear any existing timeout
            if (subscriptionTimeoutRef.current) {
                clearTimeout(subscriptionTimeoutRef.current);
            }

            // Check rate limiting (minimum 2 seconds between requests)
            const now = Date.now();
            const timeSinceLastRequest = now - lastSubscriptionTimeRef.current;
            const minInterval = 2000; // 2 seconds

            if (timeSinceLastRequest < minInterval) {
                const delay = minInterval - timeSinceLastRequest;
                console.log(`⏳ Analysis Tool rate limiting: waiting ${delay}ms before next subscription`);

                subscriptionTimeoutRef.current = setTimeout(() => {
                    performMarketSubscription();
                }, delay);
            } else {
                performMarketSubscription();
            }
        }

        function performMarketSubscription() {
            // Only reset data if we don't have any existing data or if market/settings actually changed
            const hasExistingData = Object.keys(digitStats).length > 0 || priceHistory.length > 0;
            const isNewMarket = !hasExistingData || currentPrice === 0;

            if (isNewMarket) {
                // Reset price data only when starting fresh
                setCurrentPrice(0);
                setPriceChange(0);
                setLastDigit(0);
                setDigitStats({});
                setPriceHistory([]);
                setLastDigitHistory([]);
                setShowAllHistory(false);
                setConnectionStatus(`Connecting to ${selectedMarket.symbol} (${tickCount} ticks)...`);
            } else {
                // Keep existing data, just update connection status
                setConnectionStatus(`Updating ${selectedMarket.symbol} (${tickCount} ticks)...`);
            }

            // Update last request time
            lastSubscriptionTimeRef.current = Date.now();

            // Subscribe to new market data with current tick count
            subscribeToMarketData(selectedMarket.symbol);
        }

        // Cleanup timeout on unmount or dependency change
        return () => {
            if (subscriptionTimeoutRef.current) {
                clearTimeout(subscriptionTimeoutRef.current);
            }
        };
    }, [selectedMarket.symbol, isConnected, tickCount, subscribeToMarketData, isActive]);

    const analysisData = getAnalysisData();

    return (
        <div className='analysis-tool'>
            <div className='analysis-tool__header'>
                <h2 className='analysis-tool__title'>Market Analysis Tool</h2>
                <div className='analysis-tool__status'>
                    <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
                        {connectionStatus}
                    </span>
                </div>
            </div>

            <div className='analysis-tool__controls'>
                <div className='controls-row'>
                    {/* Market Selector */}
                    <div className='control-group'>
                        <label className='control-label'>Market</label>
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
                                    {isLoadingMarkets ? (
                                        <div className='market-selector__loading'>
                                            <span>Loading markets...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {availableMarkets.map(market => (
                                                <div
                                                    key={market.symbol}
                                                    className={`market-selector__option ${market.symbol === selectedMarket.symbol ? 'selected' : ''}`}
                                                    onClick={() => {
                                                        console.log(
                                                            `🎯 Analysis Tool user selected market: ${market.symbol} (${market.name})`
                                                        );
                                                        setSelectedMarket(market);
                                                        setIsDropdownOpen(false);

                                                        // Show immediate feedback
                                                        setConnectionStatus(`Switching to ${market.symbol}...`);
                                                    }}
                                                >
                                                    <div className='market-option__info'>
                                                        <span className='market-option__name'>{market.name}</span>
                                                        <span className='market-option__symbol'>{market.symbol}</span>
                                                    </div>
                                                    {market.symbol === selectedMarket.symbol && (
                                                        <span className='market-option__selected'>✓</span>
                                                    )}
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Trade Type Selector */}
                    <div className='control-group'>
                        <label className='control-label'>Trade Type</label>
                        <select
                            className='dropdown-select'
                            value={selectedTradeType}
                            onChange={e => setSelectedTradeType(e.target.value as TradeType)}
                        >
                            {tradeTypeOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Tick Count Selector */}
                    <div className='control-group'>
                        <label className='control-label'>Ticks to Analyze</label>
                        <select
                            className='dropdown-select'
                            value={tickCount}
                            onChange={e => setTickCount(Number(e.target.value))}
                        >
                            {tickCountOptions.map(option => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Over/Under Prediction Selector */}
                    {selectedTradeType === 'over_under' && (
                        <div className='control-group'>
                            <label className='control-label'>Prediction</label>
                            <select
                                className='dropdown-select'
                                value={selectedPrediction}
                                onChange={e => setSelectedPrediction(e.target.value as OverUnderPrediction)}
                            >
                                {overUnderPredictions.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            </div>

            <div className='analysis-tool__content'>
                {/* Compact Price Display */}
                <div className='price-display-compact'>
                    <div className='price-info'>
                        <span className='price-info__current'>
                            {currentPrice > 0 ? formatPrice(currentPrice) : '--'}
                        </span>
                        <span className={`price-info__change ${priceChange >= 0 ? 'positive' : 'negative'}`}>
                            {currentPrice > 0 ? (
                                <>
                                    {priceChange >= 0 ? '+' : ''}
                                    {priceChange.toFixed(3)} ({((priceChange / currentPrice) * 100).toFixed(3)}%)
                                </>
                            ) : (
                                '--'
                            )}
                        </span>
                    </div>
                    <div className='last-digit-info'>
                        Last Digit: <span className='digit-highlight'>{lastDigit}</span>
                    </div>
                </div>

                {/* Analysis Results - Horizontal Bars */}
                <div className='analysis-results'>
                    <h3 className='analysis-results__title'>
                        {selectedTradeType === 'even_odd' && 'Even/Odd Analysis'}
                        {selectedTradeType === 'over_under' && 'Over/Under Analysis'}
                        {selectedTradeType === 'rise_fall' && 'Rise/Fall Analysis'}
                    </h3>

                    <div className='analysis-bars'>
                        {selectedTradeType === 'even_odd' && (
                            <>
                                <div className='analysis-bar even'>
                                    <div className='analysis-bar__label'>Even</div>
                                    <div className='analysis-bar__container'>
                                        <div
                                            className='analysis-bar__fill'
                                            style={{ width: `${(analysisData as any).even?.percentage || '50.0'}%` }}
                                        ></div>
                                    </div>
                                    <div className='analysis-bar__percentage'>
                                        {(analysisData as any).even?.percentage || '50.0'}%
                                    </div>
                                    <div className='analysis-bar__count'>{(analysisData as any).even?.count || 0}</div>
                                </div>
                                <div className='analysis-bar odd'>
                                    <div className='analysis-bar__label'>Odd</div>
                                    <div className='analysis-bar__container'>
                                        <div
                                            className='analysis-bar__fill'
                                            style={{ width: `${(analysisData as any).odd?.percentage || '50.0'}%` }}
                                        ></div>
                                    </div>
                                    <div className='analysis-bar__percentage'>
                                        {(analysisData as any).odd?.percentage || '50.0'}%
                                    </div>
                                    <div className='analysis-bar__count'>{(analysisData as any).odd?.count || 0}</div>
                                </div>
                            </>
                        )}

                        {selectedTradeType === 'over_under' && (
                            <>
                                <div className='analysis-bar over'>
                                    <div className='analysis-bar__label'>Over</div>
                                    <div className='analysis-bar__container'>
                                        <div
                                            className='analysis-bar__fill'
                                            style={{ width: `${(analysisData as any).winning?.percentage || '50.0'}%` }}
                                        ></div>
                                    </div>
                                    <div className='analysis-bar__percentage'>
                                        {(analysisData as any).winning?.percentage || '50.0'}%
                                    </div>
                                    <div className='analysis-bar__count'>
                                        {(analysisData as any).winning?.count || 0}
                                    </div>
                                </div>
                                <div className='analysis-bar under'>
                                    <div className='analysis-bar__label'>Under</div>
                                    <div className='analysis-bar__container'>
                                        <div
                                            className='analysis-bar__fill'
                                            style={{ width: `${(analysisData as any).losing?.percentage || '50.0'}%` }}
                                        ></div>
                                    </div>
                                    <div className='analysis-bar__percentage'>
                                        {(analysisData as any).losing?.percentage || '50.0'}%
                                    </div>
                                    <div className='analysis-bar__count'>
                                        {(analysisData as any).losing?.count || 0}
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedTradeType === 'rise_fall' && (
                            <>
                                <div className='analysis-bar rise'>
                                    <div className='analysis-bar__label'>Rise</div>
                                    <div className='analysis-bar__container'>
                                        <div
                                            className='analysis-bar__fill'
                                            style={{ width: `${(analysisData as any).rise?.percentage || '50.0'}%` }}
                                        ></div>
                                    </div>
                                    <div className='analysis-bar__percentage'>
                                        {(analysisData as any).rise?.percentage || '50.0'}%
                                    </div>
                                    <div className='analysis-bar__count'>{(analysisData as any).rise?.count || 0}</div>
                                </div>
                                <div className='analysis-bar fall'>
                                    <div className='analysis-bar__label'>Fall</div>
                                    <div className='analysis-bar__container'>
                                        <div
                                            className='analysis-bar__fill'
                                            style={{ width: `${(analysisData as any).fall?.percentage || '50.0'}%` }}
                                        ></div>
                                    </div>
                                    <div className='analysis-bar__percentage'>
                                        {(analysisData as any).fall?.percentage || '50.0'}%
                                    </div>
                                    <div className='analysis-bar__count'>{(analysisData as any).fall?.count || 0}</div>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Last Digit History */}
                <div className='digit-history'>
                    <div className='digit-history__header'>
                        <h4 className='digit-history__title'>Last Digit History</h4>
                        <div className='digit-history__controls'>
                            <div className='digit-history__info'>Total: {lastDigitHistory.length} digits</div>
                            {lastDigitHistory.length > 20 && (
                                <button
                                    className='digit-history__toggle-header'
                                    onClick={() => {
                                        console.log(
                                            `📊 Analysis Tool: Toggling history view from ${showAllHistory ? 'expanded' : 'collapsed'} to ${!showAllHistory ? 'expanded' : 'collapsed'}`
                                        );
                                        setShowAllHistory(!showAllHistory);
                                    }}
                                >
                                    {showAllHistory
                                        ? 'Show Less ▲'
                                        : `See More (${lastDigitHistory.length - 20} more) ▼`}
                                </button>
                            )}
                        </div>
                    </div>
                    <div className='digit-history__content'>
                        <div className={`digit-history__list ${showAllHistory ? 'expanded' : 'collapsed'}`}>
                            {(() => {
                                const displayHistory = showAllHistory ? lastDigitHistory : lastDigitHistory.slice(-20);
                                const reversedHistory = displayHistory.slice().reverse();

                                console.log(
                                    `📊 Analysis Tool: Displaying digit history. Total: ${lastDigitHistory.length}, Displaying: ${displayHistory.length}, Last 5:`,
                                    lastDigitHistory.slice(-5)
                                );

                                return reversedHistory.map((digit, index) => {
                                    // Create a unique key based on the original index in the full array
                                    const originalIndex = lastDigitHistory.length - 1 - index;
                                    const uniqueKey = `digit-${originalIndex}-${digit}`;

                                    // Only the first item (most recent) should be marked as current
                                    const isCurrent = index === 0 && digit === lastDigit;
                                    let displayValue = digit.toString();
                                    let itemClass = `digit-history__item ${isCurrent ? 'current' : ''}`;

                                    if (selectedTradeType === 'even_odd') {
                                        displayValue = digit % 2 === 0 ? 'E' : 'O';
                                        itemClass += digit % 2 === 0 ? ' even' : ' odd';
                                    } else if (selectedTradeType === 'over_under') {
                                        const isWinning = isWinningDigit(digit);
                                        itemClass += isWinning ? ' winning' : ' losing';
                                    }

                                    return (
                                        <span key={uniqueKey} className={itemClass}>
                                            {displayValue}
                                        </span>
                                    );
                                });
                            })()}
                        </div>
                    </div>
                </div>

                {/* Digit breakdown for Over/Under - moved below digit history */}
                {selectedTradeType === 'over_under' && (
                    <div className='digit-breakdown'>
                        <h4 className='digit-breakdown__title'>Digit Breakdown</h4>
                        <div className='digit-circles'>
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => {
                                const percentage = getDigitPercentage(digit);
                                const isCurrentLastDigit = digit === lastDigit;
                                const isWinning = isWinningDigit(digit);

                                return (
                                    <div key={digit} className='digit-item'>
                                        <div
                                            className={`digit-circle ${isCurrentLastDigit ? 'current' : ''} ${isWinning ? 'winning' : 'losing'}`}
                                        >
                                            <div className='digit-circle__number'>{digit}</div>
                                            <div className='digit-circle__percentage'>{percentage}%</div>
                                        </div>
                                        {isCurrentLastDigit && (
                                            <div className='digit-cursor'>
                                                <div className='digit-cursor__arrow'>▲</div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Compact Data Info */}
                <div className='data-info-compact'>
                    <span className='data-info-compact__item'>
                        <strong>{Object.values(digitStats).reduce((sum, count) => sum + count, 0)}</strong> Ticks
                    </span>
                    <span className='data-info-compact__item'>
                        <strong>{selectedMarket.symbol}</strong>
                    </span>
                    <span className='data-info-compact__item'>
                        <strong>{isConnected ? 'Live' : 'Demo'}</strong>
                    </span>
                </div>
            </div>
        </div>
    );
};

export default AnalysistoolComponent;

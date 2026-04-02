import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import chart_api from '@/external/bot-skeleton/services/api/chart-api';
import './dtrader.scss';

interface MarketData {
    symbol: string;
    name: string;
    market?: string;
    submarket?: string;
}

type TError = {
    error?: {
        code?: string;
        message?: string;
    };
};

const DTrader: React.FC = () => {
    // State management
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
    const [activeView, setActiveView] = useState<'dtrader' | 'tradingview'>('dtrader');
    const traderOrigin = 'https://ddtrader.netlify.app';
    const syncFrameRef = useRef<HTMLIFrameElement | null>(null);
    const [isSyncFrameLoaded, setIsSyncFrameLoaded] = useState(false);
    const pendingSyncPayloadRef = useRef('');
    const lastSyncedPayloadRef = useRef('');
    const [isTraderStorageReady, setIsTraderStorageReady] = useState(false);
    const [traderFrameVersion, setTraderFrameVersion] = useState(0);

    const syncTraderStorage = useCallback(() => {
        if (!isSyncFrameLoaded) return;

        const syncWindow = syncFrameRef.current?.contentWindow;
        if (!syncWindow) return;

        const clientAccounts = localStorage.getItem('clientAccounts') ?? '';
        const activeLoginid = localStorage.getItem('active_loginid') ?? '';
        const payload = JSON.stringify({ clientAccounts, activeLoginid });

        if (payload === lastSyncedPayloadRef.current || payload === pendingSyncPayloadRef.current) {
            return;
        }

        pendingSyncPayloadRef.current = payload;
        setIsTraderStorageReady(false);
        syncWindow.postMessage({ key: 'clientAccounts', value: clientAccounts }, traderOrigin);
        syncWindow.postMessage({ key: 'active_loginid', value: activeLoginid }, traderOrigin);
    }, [isSyncFrameLoaded]);

    useEffect(() => {
        const handleTraderSyncReady = (event: MessageEvent) => {
            if (event.origin !== traderOrigin) return;
            if (event.data?.key !== 'localstorage-sync-ready') return;
            if (event.data?.value !== pendingSyncPayloadRef.current) return;

            lastSyncedPayloadRef.current = event.data.value;
            pendingSyncPayloadRef.current = '';
            setIsTraderStorageReady(true);
            setTraderFrameVersion(version => version + 1);
        };

        window.addEventListener('message', handleTraderSyncReady);

        return () => {
            window.removeEventListener('message', handleTraderSyncReady);
        };
    }, []);

    useEffect(() => {
        syncTraderStorage();

        const intervalId = window.setInterval(syncTraderStorage, 1000);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [syncTraderStorage]);

    const frameUrl = 'https://ddtrader.netlify.app/dtrader';

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                width: 'calc(100% + 3.2rem)',
                height: 'var(--tab-content-height)',
                background: '#f2f3f4',
                margin: '-1.6rem',
                overflow: 'hidden',
                boxSizing: 'border-box',
            }}
        >
            <div
                style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    borderRadius: '0',
                    background: '#fff',
                    boxShadow: 'none',
                }}
            >
                    <iframe
                        ref={syncFrameRef}
                        src={`${traderOrigin}/localstorage-sync.html`}
                        title='DTrader storage sync'
                        loading='eager'
                        onLoad={() => {
                            setIsSyncFrameLoaded(true);
                            syncTraderStorage();
                        }}
                        aria-hidden='true'
                        tabIndex={-1}
                        style={{
                            position: 'absolute',
                            width: 0,
                            height: 0,
                            border: 0,
                            opacity: 0,
                            pointerEvents: 'none',
                        }}
                    />
                <iframe
                        key={traderFrameVersion}
                        src={isTraderStorageReady ? frameUrl : 'about:blank'}
                    title='Custom DTrader'
                    loading='eager'
                    allowFullScreen
                    style={{
                        display: 'block',
                        width: '100%',
                        height: 'calc(100% + 5rem)',
                        border: '0',
                        marginTop: '-5rem',
                    }}
                />
            </div>
        </div>
    );
    // Fallback markets - volatility indices first, then jump indices
    const fallbackMarkets: MarketData[] = useMemo(() => [
        // 1-second Volatility Indices (Most Popular)
        { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', market: 'synthetic_index', submarket: 'random_index' },
        
        // Regular Volatility Indices
        { symbol: 'R_10', name: 'Volatility 10 Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: 'R_25', name: 'Volatility 25 Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: 'R_50', name: 'Volatility 50 Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: 'R_75', name: 'Volatility 75 Index', market: 'synthetic_index', submarket: 'random_index' },
        { symbol: 'R_100', name: 'Volatility 100 Index', market: 'synthetic_index', submarket: 'random_index' },
        
        // Jump Indices
        { symbol: 'JD10', name: 'Jump 10 Index', market: 'synthetic_index', submarket: 'jump_index' },
        { symbol: 'JD25', name: 'Jump 25 Index', market: 'synthetic_index', submarket: 'jump_index' },
        { symbol: 'JD50', name: 'Jump 50 Index', market: 'synthetic_index', submarket: 'jump_index' },
        { symbol: 'JD75', name: 'Jump 75 Index', market: 'synthetic_index', submarket: 'jump_index' },
        { symbol: 'JD100', name: 'Jump 100 Index', market: 'synthetic_index', submarket: 'jump_index' },
        
        // Other Markets
        { symbol: 'BOOM1000', name: 'Boom 1000 Index', market: 'synthetic_index', submarket: 'crash_boom' },
        { symbol: 'CRASH1000', name: 'Crash 1000 Index', market: 'synthetic_index', submarket: 'crash_boom' },
        { symbol: 'frxEURUSD', name: 'EUR/USD', market: 'forex', submarket: 'major_pairs' },
    ], []);

    // Cleanup subscriptions on unmount
    useEffect(() => {
        return () => {
            if (chart_api.api) {
                chart_api.api.forgetAll('ticks');
            }
        };
    }, []);

    // Fetch available markets
    const fetchAvailableMarkets = useCallback(async () => {
        setIsLoadingMarkets(true);
        setAvailableMarkets(fallbackMarkets);
        
        if (!selectedMarket.symbol) {
            setSelectedMarket(fallbackMarkets[0]);
        }

        try {
            if (!chart_api?.api) {
                await chart_api.init();
            }

            const response = await Promise.race([
                chart_api.api.send({ active_symbols: 'brief', product_type: 'basic' }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('API timeout')), 5000))
            ]);
            
            if (response && (response as any).active_symbols) {
                const apiMarkets = (response as any).active_symbols
                    .filter((symbol: any) => ['synthetic_index', 'forex'].includes(symbol.market))
                    .map((symbol: any) => ({
                        symbol: symbol.symbol,
                        name: symbol.display_name,
                        market: symbol.market,
                        submarket: symbol.submarket,
                    }))
                    .sort((a: MarketData, b: MarketData) => {
                        // Custom sorting: Volatility indices first, then jump indices, then others
                        const getMarketPriority = (market: MarketData) => {
                            // 1-second volatility indices (highest priority)
                            if (market.symbol?.match(/^1HZ\d+V$/)) return 1;
                            // Regular volatility indices
                            if (market.symbol?.match(/^R_\d+$/)) return 2;
                            // Jump indices
                            if (market.submarket === 'jump_index' || market.symbol?.startsWith('JD')) return 3;
                            // Other synthetic indices
                            if (market.market === 'synthetic_index') return 4;
                            // Forex
                            if (market.market === 'forex') return 5;
                            // Everything else
                            return 6;
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
                }
            }
        } catch (error) {
            console.warn('Using fallback markets:', error);
        } finally {
            setIsLoadingMarkets(false);
        }
    }, [fallbackMarkets, selectedMarket.symbol]);

    // Helper functions
    const getLastDigit = useCallback((price: number, symbol: string): number => {
        const multiplierMap: { [key: string]: number } = {
            'R_25': 1000, 'R_10': 1000, '1HZ30V': 1000, '1HZ90V': 1000, '1HZ15V': 1000,
            'R_50': 10000, 'R_75': 10000
        };
        const multiplier = multiplierMap[symbol] || 100;
        return Math.round(price * multiplier) % 10;
    }, []);

    const formatPrice = useCallback((price: number): string => {
        const decimalPlaces: { [key: string]: number } = {
            '1HZ50V': 2, '1HZ25V': 2, '1HZ10V': 2, '1HZ75V': 2, '1HZ100V': 2, 'R_100': 2,
            'R_25': 3, 'R_10': 3, '1HZ30V': 3, '1HZ90V': 3, '1HZ15V': 3,
            'R_50': 4, 'R_75': 4,
        };
        return price.toFixed(decimalPlaces[selectedMarket.symbol] || 5);
    }, [selectedMarket.symbol]);

    // Memoized digit analysis
    const digitAnalysis = useMemo(() => {
        const totalTicks = Object.values(digitStats).reduce((sum, count) => sum + count, 0);
        const allPercentages = Array.from({ length: 10 }, (_, digit) => {
            const count = digitStats[digit] || 0;
            return totalTicks > 0 ? (count / totalTicks) * 100 : 10;
        });
        
        const maxPercentage = Math.max(...allPercentages);
        const minPercentage = Math.min(...allPercentages.filter(p => p > 0));
        
        return { totalTicks, allPercentages, maxPercentage, minPercentage };
    }, [digitStats]);

    const getDigitPercentage = useCallback((digit: number): string => {
        return digitAnalysis.allPercentages[digit]?.toFixed(1) || '10.0';
    }, [digitAnalysis]);

    // Render digit circle helper
    const renderDigitCircle = useCallback((digit: number) => {
        const percentage = getDigitPercentage(digit);
        const isCurrentLastDigit = digit === lastDigit;
        const currentPercentage = parseFloat(percentage);
        
        const isHighest = Math.abs(currentPercentage - digitAnalysis.maxPercentage) < 0.1 && 
                         digitAnalysis.maxPercentage > 0 && digitAnalysis.totalTicks > 100;
        const isLowest = Math.abs(currentPercentage - digitAnalysis.minPercentage) < 0.1 && 
                        digitAnalysis.minPercentage > 0 && digitAnalysis.totalTicks > 100;

        return (
            <div key={digit} className='main-digit-item'>
                <div className={`main-digit-circle ${isCurrentLastDigit ? 'main-digit-circle--current' : ''} ${isHighest ? 'main-digit-circle--highest' : ''} ${isLowest ? 'main-digit-circle--lowest' : ''}`}>
                    <div className='main-digit-circle__number'>{digit}</div>
                    <div className='main-digit-circle__percentage'>{percentage}%</div>
                </div>
                {isCurrentLastDigit && (
                    <div className='main-digit-cursor'>
                        <div className='main-digit-cursor__arrow'>▲</div>
                    </div>
                )}
            </div>
        );
    }, [lastDigit, getDigitPercentage, digitAnalysis]);

    // Simplified subscription handling
    const requestSubscribe = useCallback(async (req: any, callback: (data: any) => void) => {
        try {
            if (subscriptionIdRef.current && chart_api.api) {
                chart_api.api.forget(subscriptionIdRef.current);
            }
            
            const history = await chart_api.api.send(req);
            
            if (history?.subscription?.id) {
                subscriptionIdRef.current = history.subscription.id;
            }
            
            if (history) callback(history);
            
            if (req.subscribe === 1) {
                chart_api.api.onMessage()?.subscribe(({ data }: { data: any }) => {
                    callback(data);
                });
            }
        } catch (e) {
            const error = e as TError;
            console.warn('Subscription error:', error?.error?.message || 'Unknown error');
            callback([]);
        }
    }, []);

    // Subscribe to market data - memoized to prevent infinite re-renders
    const subscribeToMarketData = useCallback(async (symbol: string) => {
        try {
            console.log(`📊 Subscribing to ${symbol} market data...`);
            
            // Clean up any existing subscriptions first
            if (subscriptionIdRef.current && chart_api.api) {
                console.log(`🧹 Cleaning up previous subscription: ${subscriptionIdRef.current}`);
                chart_api.api.forget(subscriptionIdRef.current);
                subscriptionIdRef.current = '';
            }

            const request = {
                ticks_history: symbol,
                end: 'latest',
                count: 1000,
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
                    
                    // Update connection status on first tick
                    setConnectionStatus(`Connected to ${symbol}`);
                } else if (data.history?.prices) {
                    // Handle historical data
                    console.log(`📈 Received ${data.history.prices.length} historical prices for ${symbol}`);
                    const prices = data.history.prices.map((p: string) => parseFloat(p));
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
                    
                    // Update connection status
                    setConnectionStatus(`Connected to ${symbol}`);
                    console.log(`✅ ${symbol} data loaded: Price ${latestPrice}, Last digit ${getLastDigit(latestPrice, symbol)}`);
                }
            });

            console.log(`✅ Subscribed to ${symbol} market data`);
        } catch (error) {
            console.error('❌ Failed to subscribe to market data:', error);
            setConnectionStatus('Subscription failed');
        }
    }, []); // Empty dependency array to prevent recreation

    // The iframe now provides the DTrader experience, so the old market bootstrapping is disabled.
    useEffect(() => {}, []);

    // Subscribe to market data when symbol changes or connection is established (with debouncing)
    useEffect(() => {
        if (isConnected && selectedMarket.symbol) {
            console.log(`🔄 Market changed to: ${selectedMarket.symbol}`);
            
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
                console.log(`⏳ Rate limiting: waiting ${delay}ms before next subscription`);
                
                subscriptionTimeoutRef.current = setTimeout(() => {
                    performMarketSubscription();
                }, delay);
            } else {
                performMarketSubscription();
            }
        }
        
        function performMarketSubscription() {
            // Reset price data when switching markets
            setCurrentPrice(0);
            setPriceChange(0);
            setLastDigit(0);
            setDigitStats({});
            setPriceHistory([]);
            setConnectionStatus(`Connecting to ${selectedMarket.symbol}...`);
            
            // Update last request time
            lastSubscriptionTimeRef.current = Date.now();
            
            // Subscribe to new market data
            subscribeToMarketData(selectedMarket.symbol);
        }
        
        // Cleanup timeout on unmount or dependency change
        return () => {
            if (subscriptionTimeoutRef.current) {
                clearTimeout(subscriptionTimeoutRef.current);
            }
        };
    }, [selectedMarket.symbol, isConnected, subscribeToMarketData]);



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
            <div className='dtrader-simple'>
                {/* View Selection Buttons */}
                <div className='view-buttons-container' style={{ 
                    display: 'flex', 
                    gap: '10px', 
                    marginBottom: '1rem',
                    justifyContent: 'center'
                }}>
                    <button
                        className={`view-button ${activeView === 'dtrader' ? 'active' : ''}`}
                        onClick={() => setActiveView('dtrader')}
                        title='DTrader View'
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: activeView === 'dtrader' ? '#4bb4b7' : '#f0f0f0',
                            color: activeView === 'dtrader' ? 'white' : '#333',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            minWidth: '120px',
                            justifyContent: 'center'
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>📊</span>
                        <span>DTrader</span>
                    </button>
                    
                    <button
                        className={`view-button ${activeView === 'tradingview' ? 'active' : ''}`}
                        onClick={() => setActiveView('tradingview')}
                        title='TradingView Chart'
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '12px 20px',
                            background: activeView === 'tradingview' ? '#ff444f' : '#f0f0f0',
                            color: activeView === 'tradingview' ? 'white' : '#333',
                            border: '1px solid #ddd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                            minWidth: '120px',
                            justifyContent: 'center'
                        }}
                    >
                        <span style={{ fontSize: '16px' }}>📈</span>
                        <span>TradingView</span>
                    </button>
                </div>

                {/* TradingView Chart */}
                {activeView === 'tradingview' && (
                    <div className='tradingview-container' style={{ 
                        width: '100%', 
                        height: 'calc(100vh - 250px)', 
                        marginBottom: '1rem', 
                        borderRadius: '8px', 
                        overflow: 'hidden',
                        minHeight: '500px',
                        maxHeight: '700px'
                    }}>
                        <iframe 
                            id="tradingview_ada94" 
                            name="tradingview_ada94" 
                            src="https://charts.deriv.com/deriv?hide-signup=true" 
                            title="Financial Chart" 
                            frameBorder="0" 
                            allowTransparency={true} 
                            scrolling="no" 
                            allowFullScreen={true} 
                            style={{ display: 'block', width: '100%', height: '100%' }}
                        />
                    </div>
                )}

                {/* DTrader Content */}
                {activeView === 'dtrader' && (
                    <div
                        className='tradingview-container'
                        style={{
                            width: '100%',
                            height: 'calc(100vh - 250px)',
                            marginBottom: '1rem',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            minHeight: '500px',
                            maxHeight: '700px',
                        }}
                    >
                        <iframe
                            src={frameUrl}
                            title='Custom DTrader'
                            frameBorder='0'
                            allowFullScreen={true}
                            style={{ display: 'block', width: '100%', height: '100%' }}
                        />
                    </div>
                )}
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

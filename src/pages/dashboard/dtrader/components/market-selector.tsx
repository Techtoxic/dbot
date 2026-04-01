import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';

interface Market {
    symbol: string;
    display_name: string;
    market: string;
    submarket: string;
    volatility?: string;
    is_1s?: boolean;
}

const MarketSelector: React.FC = observer(() => {
    const store = useStore();
    const chart_store = store?.chart_store;
    
    // Show loading state if store is not ready
    if (!store || !chart_store) {
        return (
            <div className='market-selector'>
                <div className='market-selector__current'>
                    <span className='market-selector__symbol'>Loading markets...</span>
                </div>
            </div>
        );
    }
    const [availableMarkets, setAvailableMarkets] = useState<Market[]>([]);
    const [selectedMarket, setSelectedMarket] = useState<Market | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [favorites, setFavorites] = useState<string[]>([]);

    useEffect(() => {
        const loadMarkets = async () => {
            try {
                // Create Deriv-style volatility markets with correct API symbols
                const derivMarkets: Market[] = [
                    // 1-second volatility indices
                    {
                        symbol: '1HZ10V',
                        display_name: 'Volatility 10 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '10',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ15V',
                        display_name: 'Volatility 15 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '15',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ25V',
                        display_name: 'Volatility 25 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '25',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ30V',
                        display_name: 'Volatility 30 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '30',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ50V',
                        display_name: 'Volatility 50 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '50',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ75V',
                        display_name: 'Volatility 75 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '75',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ90V',
                        display_name: 'Volatility 90 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '90',
                        is_1s: true,
                    },
                    {
                        symbol: '1HZ100V',
                        display_name: 'Volatility 100 (1s) Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '100',
                        is_1s: true,
                    },

                    // Regular volatility indices
                    {
                        symbol: 'R_10',
                        display_name: 'Volatility 10 Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '10',
                        is_1s: false,
                    },
                    {
                        symbol: 'R_25',
                        display_name: 'Volatility 25 Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '25',
                        is_1s: false,
                    },
                    {
                        symbol: 'R_50',
                        display_name: 'Volatility 50 Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '50',
                        is_1s: false,
                    },
                    {
                        symbol: 'R_75',
                        display_name: 'Volatility 75 Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '75',
                        is_1s: false,
                    },
                    {
                        symbol: 'R_100',
                        display_name: 'Volatility 100 Index',
                        market: 'synthetic_index',
                        submarket: 'random_index',
                        volatility: '100',
                        is_1s: false,
                    },

                    // Step indices
                    {
                        symbol: 'STEPIDX',
                        display_name: 'Step Index',
                        market: 'synthetic_index',
                        submarket: 'step_index',
                        volatility: 'step',
                        is_1s: false,
                    },

                    // Crash and Boom indices
                    {
                        symbol: 'BOOM1000',
                        display_name: 'Boom 1000 Index',
                        market: 'synthetic_index',
                        submarket: 'crash_boom',
                        volatility: 'boom',
                        is_1s: false,
                    },
                    {
                        symbol: 'BOOM500',
                        display_name: 'Boom 500 Index',
                        market: 'synthetic_index',
                        submarket: 'crash_boom',
                        volatility: 'boom',
                        is_1s: false,
                    },
                    {
                        symbol: 'CRASH1000',
                        display_name: 'Crash 1000 Index',
                        market: 'synthetic_index',
                        submarket: 'crash_boom',
                        volatility: 'crash',
                        is_1s: false,
                    },
                    {
                        symbol: 'CRASH500',
                        display_name: 'Crash 500 Index',
                        market: 'synthetic_index',
                        submarket: 'crash_boom',
                        volatility: 'crash',
                        is_1s: false,
                    },

                    // Jump indices
                    {
                        symbol: 'JD10',
                        display_name: 'Jump 10 Index',
                        market: 'synthetic_index',
                        submarket: 'jump_index',
                        volatility: 'jump',
                        is_1s: false,
                    },
                    {
                        symbol: 'JD25',
                        display_name: 'Jump 25 Index',
                        market: 'synthetic_index',
                        submarket: 'jump_index',
                        volatility: 'jump',
                        is_1s: false,
                    },
                    {
                        symbol: 'JD50',
                        display_name: 'Jump 50 Index',
                        market: 'synthetic_index',
                        submarket: 'jump_index',
                        volatility: 'jump',
                        is_1s: false,
                    },
                    {
                        symbol: 'JD75',
                        display_name: 'Jump 75 Index',
                        market: 'synthetic_index',
                        submarket: 'jump_index',
                        volatility: 'jump',
                        is_1s: false,
                    },
                    {
                        symbol: 'JD100',
                        display_name: 'Jump 100 Index',
                        market: 'synthetic_index',
                        submarket: 'jump_index',
                        volatility: 'jump',
                        is_1s: false,
                    },
                ];

                setAvailableMarkets(derivMarkets);

                // Set initial selected market
                if (derivMarkets.length > 0 && !selectedMarket) {
                    const defaultMarket = derivMarkets[0]; // 1HZ10V - Volatility 10 (1s) Index
                    setSelectedMarket(defaultMarket);

                    // Also update the chart store with the correct symbol
                    if (chart_store?.onSymbolChange) {
                        chart_store.onSymbolChange(defaultMarket.symbol);
                    }
                }
            } catch (error) {
                console.error('Error loading markets:', error);
            }
        };

        loadMarkets();
    }, [selectedMarket, chart_store]);

    const handleMarketSelect = (market: Market) => {
        setSelectedMarket(market);
        setIsDropdownOpen(false);
        // Update the chart symbol safely
        try {
            if (chart_store?.onSymbolChange) {
                chart_store.onSymbolChange(market.symbol);
            }
        } catch (error) {
            console.log('Market selection:', market.symbol);
        }
    };

    const toggleFavorite = (symbol: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavorites(prev => (prev.includes(symbol) ? prev.filter(s => s !== symbol) : [...prev, symbol]));
    };

    const getMarketIcon = () => {
        return (
            <svg width='24' height='16' viewBox='0 0 24 16' className='market-icon'>
                <rect x='2' y='12' width='2' height='4' fill='#4bb4b7' />
                <rect x='5' y='10' width='2' height='6' fill='#4bb4b7' />
                <rect x='8' y='8' width='2' height='8' fill='#4bb4b7' />
                <rect x='11' y='6' width='2' height='10' fill='#4bb4b7' />
                <rect x='14' y='4' width='2' height='12' fill='#4bb4b7' />
                <rect x='17' y='2' width='2' height='14' fill='#4bb4b7' />
                <rect x='20' y='0' width='2' height='16' fill='#4bb4b7' />
            </svg>
        );
    };

    const getVolatilityBadge = (volatility: string, is_1s: boolean) => {
        let badgeColor = '#4bb4b7'; // Default teal
        let displayText = volatility;

        // Set colors and text based on market type
        if (volatility === 'boom') {
            badgeColor = '#4caf50'; // Green for boom
            displayText = 'BOOM';
        } else if (volatility === 'crash') {
            badgeColor = '#f44336'; // Red for crash
            displayText = 'CRASH';
        } else if (volatility === 'jump') {
            badgeColor = '#ff9800'; // Orange for jump
            displayText = 'JUMP';
        } else if (volatility === 'step') {
            badgeColor = '#9c27b0'; // Purple for step
            displayText = 'STEP';
        }

        return (
            <div className='volatility-badge' style={{ backgroundColor: badgeColor }}>
                <span className='volatility-number'>{displayText}</span>
                {is_1s && <span className='volatility-1s'>1s</span>}
            </div>
        );
    };

    if (!selectedMarket) {
        return (
            <div className='market-selector'>
                <div className='market-selector__current'>
                    <span className='market-selector__symbol'>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <div className='market-selector'>
            <div className='market-selector__current' onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                {getMarketIcon()}
                <span className='market-selector__name'>{selectedMarket.display_name}</span>
                <span className={`market-selector__arrow ${isDropdownOpen ? 'open' : ''}`}>▼</span>
            </div>

            {isDropdownOpen && (
                <div className='market-selector__dropdown'>
                    {availableMarkets.map(market => (
                        <div
                            key={`${market.symbol}-${market.is_1s ? '1s' : 'regular'}`}
                            className={`market-selector__option ${market.symbol === selectedMarket.symbol ? 'selected' : ''
                                }`}
                            onClick={() => handleMarketSelect(market)}
                        >
                            <div className='market-option__left'>
                                {getVolatilityBadge(market.volatility || '10', market.is_1s || false)}
                                {getMarketIcon()}
                                <span className='market-option__name'>{market.display_name}</span>
                            </div>
                            <button
                                className={`market-option__favorite ${favorites.includes(market.symbol) ? 'active' : ''}`}
                                onClick={e => toggleFavorite(market.symbol, e)}
                            >
                                ⭐
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

export default MarketSelector;

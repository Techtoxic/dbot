// ===== SMART SIGNALS SYSTEM =====
const DEBUG = false;
const logInfo = (...args) => { if (DEBUG) console.log(...args); };
const logError = (...args) => { if (DEBUG) console.error(...args); };
logInfo('🚀 Smart Signals System Loading...');

// Market data storage
let ticksStorage = {};
let availableMarkets = [];
let selectedMarket = '';
let currentSignals = [];
let ws;
let isConnecting = false;

// Prevent duplicate initialization if this script is included multiple times
if (window.__signalsInitialized) {
    // Already initialized elsewhere; avoid creating duplicate listeners/sockets
    // Exit early to prevent performance issues due to double subscriptions
    // eslint-disable-next-line no-undef
}
window.__signalsInitialized = true;

// Initialize WebSocket connection
function initializeWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING || isConnecting)) {
        return; // Prevent duplicate connections
    }
    isConnecting = true;
    try {
        ws = new WebSocket('wss://ws.derivws.com/websockets/v3?app_id=85159');
        logInfo('✅ WebSocket connection initiated');
        
        ws.onopen = function() {
            isConnecting = false;
            logInfo('🔗 WebSocket connected, fetching available markets...');
            fetchAvailableMarkets();
        };
        
        ws.onmessage = function(event) {
            try {
                const data = JSON.parse(event.data);
                
                if (data.active_symbols) {
                    processAvailableMarkets(data.active_symbols);
                } else if (data.history && data.history.prices) {
                    const symbol = data.echo_req.ticks_history;
                    ticksStorage[symbol] = data.history.prices.map(price => parseFloat(price));
                    logInfo(`📊 Loaded ${data.history.prices.length} ticks for ${symbol}`);
                } else if (data.tick) {
                    const symbol = data.tick.symbol;
                    if (ticksStorage[symbol]) {
                        ticksStorage[symbol].push(parseFloat(data.tick.quote));
                        if (ticksStorage[symbol].length > 500) {
                            ticksStorage[symbol].shift();
                        }
                    }
                }
            } catch (error) {
                logError('❌ Error processing WebSocket message:', error);
            }
        };
        
        ws.onerror = function(error) {
            logError('❌ WebSocket error:', error);
        };
        
        ws.onclose = function() {
            isConnecting = false;
            logInfo('🔌 WebSocket connection closed');
        };
        
    } catch (error) {
        isConnecting = false;
        logError('❌ WebSocket initialization failed:', error);
    }
}

// Fetch available markets from Deriv API
function fetchAvailableMarkets() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            active_symbols: "brief",
            product_type: "basic"
        }));
        logInfo('📡 Requesting available markets...');
    }
}

// Process available markets response
function processAvailableMarkets(symbols) {
    // Filter for volatility indices
    const volatilityMarkets = symbols.filter(function(symbol) {
        return symbol.market === 'synthetic_index' && 
               symbol.submarket === 'random_index' &&
               symbol.symbol_type === 'stockindex' &&
               !symbol.symbol.includes('1HZ') &&
               !symbol.is_trading_suspended;
    });

    // Sort markets
    volatilityMarkets.sort(function(a, b) {
        const aIsR = a.symbol.startsWith('R_');
        const bIsR = b.symbol.startsWith('R_');
        
        if (aIsR && !bIsR) return -1;
        if (!aIsR && bIsR) return 1;
        
        const aNum = parseInt(a.symbol.replace(/[^0-9]/g, '')) || 0;
        const bNum = parseInt(b.symbol.replace(/[^0-9]/g, '')) || 0;
        
        return aNum - bNum;
    });

    availableMarkets = volatilityMarkets;
    
    // Initialize storage for all markets
    availableMarkets.forEach(function(market) {
        ticksStorage[market.symbol] = [];
    });

    logInfo(`✅ Found ${availableMarkets.length} volatility markets`);
    
    // Set default market
    if (!selectedMarket && availableMarkets.length > 0) {
        const r100Market = availableMarkets.find(function(m) { return m.symbol === 'R_100'; });
        selectedMarket = r100Market ? r100Market.symbol : availableMarkets[0].symbol;
    }
    
    updateMarketSelector();
    
    // Subscribe to popular markets
    const popularMarkets = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100'];
    popularMarkets.forEach(function(symbol) {
        const market = availableMarkets.find(function(m) { return m.symbol === symbol; });
        if (market) {
            subscribeTicks(symbol);
        }
    });
}

// Subscribe to market ticks
function subscribeTicks(symbol) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            ticks_history: symbol,
            count: 500,
            end: 'latest',
            style: 'ticks',
            subscribe: 1
        }));
        logInfo(`📡 Subscribed to ${symbol}`);
    }
}

// ===== PATTERN ANALYSIS =====
class SmartSignalAnalyzer {
    constructor() {
        this.patterns = {
            repeating: /(\d)\1{2,}/g,
            sequential: /(?:012|123|234|345|456|567|678|789|987|876|765|654|543|432|321|210)/g,
            alternating: /(\d)(\d)\1\2/g
        };
    }

    getLastDigits(prices, count) {
        count = count || 100;
        return prices.slice(-count).map(function(price) {
            return parseInt(price.toString().split('.').pop().slice(-1));
        });
    }

    detectPatterns(digits) {
        const digitString = digits.join('');
        const foundPatterns = [];

        // Check for repeating patterns
        const repeating = digitString.match(this.patterns.repeating);
        if (repeating) {
            const self = this;
            repeating.forEach(function(pattern) {
                foundPatterns.push({
                    type: 'repeating',
                    pattern: pattern,
                    digit: pattern[0],
                    recommendation: self.getRepeatingRecommendation(pattern[0], pattern.length),
                    confidence: Math.min(95, 50 + (pattern.length * 15))
                });
            });
        }

        return foundPatterns;
    }

    analyzeDominance(digits) {
        const counts = new Array(10).fill(0);
        digits.forEach(function(digit) {
            counts[digit]++;
        });
        
        const total = digits.length;
        const percentages = counts.map(function(count) {
            return (count / total) * 100;
        });
        
        const maxPercentage = Math.max.apply(Math, percentages);
        const dominantDigit = percentages.indexOf(maxPercentage);
        
        const recommendations = [];

        if (maxPercentage > 15) {
            recommendations.push({
                type: 'dominant_digit',
                digit: dominantDigit,
                percentage: maxPercentage.toFixed(1),
                recommendation: `Trade MATCHES digit ${dominantDigit}`,
                reason: `Digit ${dominantDigit} appears ${maxPercentage.toFixed(1)}% of the time`,
                confidence: Math.min(95, Math.max(50, 50 + ((maxPercentage - 15) / 25) * 45))
            });
        }

        // Over/Under analysis
        const highDigits = [7, 8, 9];
        const lowDigits = [0, 1, 2];
        
        const highPercentage = highDigits.reduce(function(sum, digit) {
            return sum + percentages[digit];
        }, 0);
        
        const lowPercentage = lowDigits.reduce(function(sum, digit) {
            return sum + percentages[digit];
        }, 0);

        if (highPercentage < 25) {
            recommendations.push({
                type: 'over_under',
                recommendation: 'Trade OVER 6',
                reason: `High digits (7,8,9) only ${highPercentage.toFixed(1)}% - expect rebound`,
                confidence: Math.min(95, Math.max(50, 50 + ((30 - highPercentage) / 30) * 45))
            });
        }

        if (lowPercentage < 25) {
            recommendations.push({
                type: 'over_under',
                recommendation: 'Trade UNDER 3',
                reason: `Low digits (0,1,2) only ${lowPercentage.toFixed(1)}% - expect rebound`,
                confidence: Math.min(95, Math.max(50, 50 + ((30 - lowPercentage) / 30) * 45))
            });
        }

        return recommendations;
    }

    analyzeTrend(prices) {
        const recommendations = [];
        
        if (prices.length < 20) return recommendations;
        
        const shortTerm = this.calculateTrend(prices.slice(-20));
        const mediumTerm = this.calculateTrend(prices.slice(-50));
        
        if (shortTerm.direction === mediumTerm.direction && shortTerm.direction !== 'neutral') {
            recommendations.push({
                type: 'trend_alignment',
                recommendation: shortTerm.direction === 'up' ? 'Trade RISE' : 'Trade FALL',
                reason: `Short and medium term trends aligned ${shortTerm.direction}ward`,
                confidence: 75
            });
        }

        return recommendations;
    }

    calculateTrend(prices) {
        if (prices.length < 2) return { direction: 'neutral', strength: 0 };
        
        let upMoves = 0;
        let downMoves = 0;

        for (let i = 1; i < prices.length; i++) {
            const change = prices[i] - prices[i - 1];
            if (change > 0) upMoves++;
            else if (change < 0) downMoves++;
        }

        const upPercentage = (upMoves / (prices.length - 1)) * 100;
        const direction = upPercentage > 55 ? 'up' : upPercentage < 45 ? 'down' : 'neutral';
        const strength = Math.abs(upPercentage - 50);

        return { direction: direction, strength: strength, upPercentage: upPercentage };
    }

    getRepeatingRecommendation(digit, length) {
        if (length >= 4) {
            return `Strong pattern detected! Trade MATCHES digit ${digit}`;
        } else if (length === 3) {
            return `Trade DIFFERS from digit ${digit} (pattern may break)`;
        }
        return `Watch digit ${digit}`;
    }
}

// Initialize analyzer
const analyzer = new SmartSignalAnalyzer();

// Generate smart signals
function generateSmartSignals(market) {
    const prices = ticksStorage[market];
    if (!prices || prices.length < 100) {
        return [{
            type: 'insufficient_data',
            recommendation: 'Collecting data...',
            reason: 'Need more ticks for analysis',
            confidence: 0
        }];
    }

    const digits = analyzer.getLastDigits(prices, 100);
    const signals = [];

    // Pattern recognition
    const patterns = analyzer.detectPatterns(digits);
    signals.push.apply(signals, patterns);

    // Digit dominance analysis
    const dominance = analyzer.analyzeDominance(digits);
    signals.push.apply(signals, dominance);

    // Trend analysis
    const trends = analyzer.analyzeTrend(prices);
    signals.push.apply(signals, trends);

    // Sort by confidence
    return signals.sort(function(a, b) {
        return (b.confidence || 0) - (a.confidence || 0);
    });
}

// ===== UI FUNCTIONS =====
function updateMarketSelector() {
    const selector = document.getElementById('marketSelector');
    if (!selector || availableMarkets.length === 0) return;

    let optionsHTML = '<option value="">Select a Market...</option>';
    
    // Group R_ markets
    const rMarkets = availableMarkets.filter(function(m) {
        return m.symbol.startsWith('R_');
    });
    
    if (rMarkets.length > 0) {
        optionsHTML += '<optgroup label="📊 Volatility Indices">';
        rMarkets.forEach(function(market) {
            const displayName = `Volatility ${market.symbol.replace('R_', '')} Index`;
            const selected = market.symbol === selectedMarket ? 'selected' : '';
            optionsHTML += `<option value="${market.symbol}" ${selected}>${displayName}</option>`;
        });
        optionsHTML += '</optgroup>';
    }
    
    // Other markets
    const otherMarkets = availableMarkets.filter(function(m) {
        return !m.symbol.startsWith('R_');
    });
    
    if (otherMarkets.length > 0) {
        optionsHTML += '<optgroup label="🎯 Other Synthetic Indices">';
        otherMarkets.forEach(function(market) {
            const displayName = market.display_name || market.symbol;
            const selected = market.symbol === selectedMarket ? 'selected' : '';
            optionsHTML += `<option value="${market.symbol}" ${selected}>${displayName}</option>`;
        });
        optionsHTML += '</optgroup>';
    }

    selector.innerHTML = optionsHTML;
    logInfo(`🔄 Updated market selector with ${availableMarkets.length} markets`);
}

function displaySignals(signals) {
    const container = document.getElementById('signalsContainer');
    if (!container) return;

    if (signals.length === 0) {
        container.innerHTML = '<div class="no-signals">No strong signals detected. Keep monitoring...</div>';
        return;
    }

    let html = '';
    signals.forEach(function(signal) {
        const confidenceClass = signal.confidence > 70 ? 'high-confidence' : 
                               signal.confidence > 50 ? 'medium-confidence' : 'low-confidence';
        
        html += `
            <div class="signal-card ${confidenceClass}">
                <div class="signal-header">
                    <span class="signal-type">${signal.type.replace('_', ' ').toUpperCase()}</span>
                    <span class="confidence">${signal.confidence ? signal.confidence.toFixed(0) + '%' : 'N/A'}</span>
                </div>
                <div class="recommendation">${signal.recommendation}</div>
                ${signal.reason ? `<div class="reason">${signal.reason}</div>` : ''}
                ${signal.pattern ? `<div class="pattern">Pattern: ${signal.pattern}</div>` : ''}
            </div>
        `;
    });
    
    container.innerHTML = html;
}

function getSignals() {
    if (!selectedMarket) {
        alert('Please select a market first!');
        return;
    }
    
    const signals = generateSmartSignals(selectedMarket);
    currentSignals = signals;
    displaySignals(signals);
    
    // Update market info
    const marketInfo = document.getElementById('marketInfo');
    if (marketInfo && ticksStorage[selectedMarket]) {
        marketInfo.style.display = 'block';
        const prices = ticksStorage[selectedMarket];
        const currentPrice = prices[prices.length - 1];
        const digits = analyzer.getLastDigits(prices, 50);
        const lastDigit = digits[digits.length - 1];
        
        marketInfo.innerHTML = `
            <div class="market-stats">
                <div>Current Price: ${currentPrice}</div>
                <div>Last Digit: ${lastDigit}</div>
                <div>Data Points: ${prices.length}</div>
            </div>
        `;
    }
}

function subscribeToMarket(symbol) {
    if (!ticksStorage[symbol] || ticksStorage[symbol].length === 0) {
        console.log(`📡 Loading data for ${symbol}...`);
        subscribeTicks(symbol);
        
        const container = document.getElementById('signalsContainer');
        if (container) {
            container.innerHTML = '<div class="loading">Loading data for ' + symbol + '...</div>';
        }
    }
}

// ===== EVENT LISTENERS =====
document.addEventListener('DOMContentLoaded', function() {
    logInfo('📱 DOM loaded, initializing system...');
    
    // Initialize WebSocket
    if (!ws || ws.readyState === WebSocket.CLOSED) {
        initializeWebSocket();
    }
    
    const marketSelector = document.getElementById('marketSelector');
    if (marketSelector) {
        marketSelector.addEventListener('change', function(e) {
            selectedMarket = e.target.value;
            if (selectedMarket) {
                subscribeToMarket(selectedMarket);
                logInfo(`🎯 Selected market: ${selectedMarket}`);
            }
        });
    }

    const getSignalsBtn = document.getElementById('getSignalsBtn');
    if (getSignalsBtn) {
        getSignalsBtn.addEventListener('click', getSignals);
    }
});

// Remove periodic re-render to reduce CPU usage; the selector updates when markets list changes
logInfo('✅ Smart Signals System loaded successfully');
const API_TOKEN = 'n6rqpKj9hrdfbiM';
const APP_ID = '70549';
let tickHistory = [];
let rafPending = false;
let ws = null;
let isDarkMode = false;
let isPaused = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let isHistoryExpanded = false;
let currentMarket = '';
let isManualDisconnect = false;

const DOM = {
    market: document.getElementById('market'),
    tickCount: document.getElementById('ticks'),
    connectBtn: document.getElementById('connect-btn'),
    pauseBtn: document.getElementById('pause-btn'),
    resetBtn: document.getElementById('reset-btn'),
    lastTickValue: document.getElementById('last-tick-value'),
    lastTickTime: document.getElementById('last-tick-time'),
    totalTicks: document.getElementById('total-ticks'),
    currentMarket: document.getElementById('current-market'),
    evenBar: document.getElementById('even-bar'),
    oddBar: document.getElementById('odd-bar'),
    evenPercent: document.getElementById('even-%'),
    oddPercent: document.getElementById('odd-%'),
    riseBar: document.getElementById('rise-bar'),
    fallBar: document.getElementById('fall-bar'),
    risePercent: document.getElementById('rise-%'),
    fallPercent: document.getElementById('fall-%'),
    circleContainer: document.getElementById('circle-container'),
    historyContainer: document.getElementById('history-container'),
    seeMoreBtn: document.getElementById('see-more-btn'),
    themeToggle: document.getElementById('theme-toggle'),
};

function toggleTheme() {
    isDarkMode = !isDarkMode;
    document.body.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
    DOM.themeToggle.innerHTML = isDarkMode ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
    localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
}

function showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ${message}`;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 5000);
}

async function fetchHistoricalTicks(market, count) {
    const wsHistory = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);
    return new Promise((resolve, reject) => {
        wsHistory.onopen = () =>
            wsHistory.send(JSON.stringify({ ticks_history: market, count, end: 'latest', style: 'ticks' }));
        wsHistory.onmessage = event => {
            const data = JSON.parse(event.data);
            if (data.error) {
                showError(data.error.message);
                reject(data.error.message);
            } else if (data.history?.prices) {
                resolve(data.history.prices);
            }
            wsHistory.close();
        };
        wsHistory.onerror = () => {
            showError('Failed to fetch historical data');
            reject();
        };
    });
}

async function connectWebSocket() {
    const market = DOM.market.value;
    const tickLimit = parseInt(DOM.tickCount.value);
    localStorage.setItem('market', market);
    localStorage.setItem('tickCount', tickLimit);
    currentMarket = market;

    DOM.connectBtn.disabled = true;
    DOM.connectBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    isManualDisconnect = false;

    try {
        tickHistory = [];
        const historicalTicks = await fetchHistoricalTicks(market, tickLimit);
        tickHistory = historicalTicks.map(price => extractLastDigit(price, market));
        updateDisplay();

        if (ws) {
            ws.close();
        }

        ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${APP_ID}`);

        ws.onopen = () => {
            reconnectAttempts = 0;
            DOM.connectBtn.innerHTML = '<i class="fas fa-stop"></i> Stop';
            DOM.connectBtn.disabled = false;
            DOM.pauseBtn.disabled = false;
            ws.send(JSON.stringify({ authorize: API_TOKEN }));
            ws.send(JSON.stringify({ ticks: market, subscribe: 1 }));
        };

        ws.onmessage = event => {
            if (isPaused) return;
            const data = JSON.parse(event.data);
            if (data.error) showError(data.error.message);
            if (data.tick) processTick(data.tick);
        };

        ws.onclose = event => {
            if (!isManualDisconnect && !event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                setTimeout(connectWebSocket, 2000 * reconnectAttempts);
            } else {
                resetUI();
            }
        };

        ws.onerror = () => showError('WebSocket error');
    } catch (error) {
        showError('Connection failed: ' + error.message);
        resetUI();
    }
}

function switchMarket(newMarket) {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
        connectWebSocket();
        return;
    }

    reconnectAttempts = 0; // Reset reconnection attempts
    ws.send(JSON.stringify({ forget: currentMarket }));
    ws.send(JSON.stringify({ ticks: newMarket, subscribe: 1 }));
    currentMarket = newMarket;

    const tickLimit = parseInt(DOM.tickCount.value);
    fetchHistoricalTicks(newMarket, tickLimit)
        .then(historicalTicks => {
            tickHistory = historicalTicks.map(price => extractLastDigit(price, newMarket));
            updateDisplay();
        })
        .catch(() => showError('Failed to load history'));
}

function resetUI() {
    DOM.connectBtn.innerHTML = '<i class="fas fa-play"></i> Start';
    DOM.connectBtn.disabled = false;
    DOM.pauseBtn.disabled = true;
}

function togglePause() {
    isPaused = !isPaused;
    DOM.pauseBtn.innerHTML = isPaused ? '<i class="fas fa-play"></i> Resume' : '<i class="fas fa-pause"></i> Pause';
}

function resetAnalysis() {
    tickHistory = [];
    disconnectWebSocket();
    updateDisplay();
}

function disconnectWebSocket() {
    isManualDisconnect = true;
    if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ forget: currentMarket }));
        }
        ws.close();
        ws = null;
    }
    resetUI();
}

function processTick(tick) {
    const lastDigit = extractLastDigit(tick.quote, currentMarket);
    tickHistory.push(lastDigit);

    // Keep only the specified number of ticks
    const tickLimit = parseInt(DOM.tickCount.value);
    if (tickHistory.length > tickLimit) {
        tickHistory.shift();
    }

    if (!rafPending) {
        rafPending = true;
        requestAnimationFrame(() => {
            rafPending = false;
            updateDisplay();
        });
    }
}

function extractLastDigit(price, market) {
    const volatility = getVolatility(market);
    const decimalPlaces = getDecimalPlacesFromVolatility(volatility);
    const formattedPrice = formatPrice(price, decimalPlaces);
    return parseInt(formattedPrice.slice(-1));
}

function formatPrice(price, decimalPlaces) {
    return parseFloat(price).toFixed(decimalPlaces);
}

function getVolatility(market) {
    const volatilityMap = {
        R_10: 10,
        R_25: 25,
        R_50: 50,
        R_75: 75,
        R_100: 100,
        '1HZ10V': 10,
        '1HZ25V': 25,
        '1HZ50V': 50,
        '1HZ75V': 75,
        '1HZ100V': 100,
    };
    return volatilityMap[market] || 10;
}

function getDecimalPlacesFromVolatility(volatility) {
    return volatility >= 100 ? 2 : 3;
}

function calculateRiseFall() {
    if (tickHistory.length < 2) return { rise: 0, fall: 0 };

    let rise = 0,
        fall = 0;
    for (let i = 1; i < tickHistory.length; i++) {
        if (tickHistory[i] > tickHistory[i - 1]) rise++;
        else if (tickHistory[i] < tickHistory[i - 1]) fall++;
    }

    return { rise, fall };
}

function updateDisplay() {
    if (tickHistory.length === 0) return;

    // Update last tick info
    const lastTick = tickHistory[tickHistory.length - 1];
    DOM.lastTickValue.textContent = lastTick;
    DOM.lastTickTime.textContent = new Date().toLocaleTimeString();
    DOM.totalTicks.textContent = tickHistory.length;
    DOM.currentMarket.textContent = DOM.market.options[DOM.market.selectedIndex].text;

    // Calculate statistics
    const digitCounts = Array(10).fill(0);
    let evenCount = 0,
        oddCount = 0;

    tickHistory.forEach(digit => {
        digitCounts[digit]++;
        if (digit % 2 === 0) evenCount++;
        else oddCount++;
    });

    // Update even/odd bars
    const evenPercent = ((evenCount / tickHistory.length) * 100).toFixed(1);
    const oddPercent = ((oddCount / tickHistory.length) * 100).toFixed(1);
    DOM.evenBar.style.width = evenPercent + '%';
    DOM.oddBar.style.width = oddPercent + '%';
    DOM.evenPercent.textContent = evenPercent + '%';
    DOM.oddPercent.textContent = oddPercent + '%';

    // Update rise/fall bars
    const { rise, fall } = calculateRiseFall();
    const total = rise + fall;
    if (total > 0) {
        const risePercent = ((rise / total) * 100).toFixed(1);
        const fallPercent = ((fall / total) * 100).toFixed(1);
        DOM.riseBar.style.width = risePercent + '%';
        DOM.fallBar.style.width = fallPercent + '%';
        DOM.risePercent.textContent = risePercent + '%';
        DOM.fallPercent.textContent = fallPercent + '%';
    }

    // Update digit circles
    updateDigitCircles(digitCounts);

    // Update history display
    updateHistory();
}

function updateDigitCircles(digitCounts) {
    DOM.circleContainer.innerHTML = '';

    const maxCount = Math.max(...digitCounts);
    const minCount = Math.min(...digitCounts.filter(count => count > 0));
    const lastDigit = tickHistory[tickHistory.length - 1];

    for (let i = 0; i <= 9; i++) {
        const wrapper = document.createElement('div');
        wrapper.className = 'circle-wrapper';

        const circle = document.createElement('div');
        circle.className = 'circle';
        circle.textContent = i;

        // Highlight most/least frequent
        if (digitCounts[i] === maxCount && maxCount > 0) {
            circle.classList.add('most-frequent');
        } else if (digitCounts[i] === minCount && minCount > 0 && minCount < maxCount) {
            circle.classList.add('least-frequent');
        }

        // Highlight current tick
        if (i === lastDigit) {
            circle.classList.add('current-tick');
        }

        const stats = document.createElement('div');
        stats.className = 'stats';
        const percentage = tickHistory.length > 0 ? ((digitCounts[i] / tickHistory.length) * 100).toFixed(1) : '0.0';
        stats.textContent = `${digitCounts[i]} (${percentage}%)`;

        wrapper.appendChild(circle);
        wrapper.appendChild(stats);
        DOM.circleContainer.appendChild(wrapper);
    }
}

function updateHistory() {
    const displayCount = isHistoryExpanded ? tickHistory.length : Math.min(20, tickHistory.length);
    const recentTicks = tickHistory.slice(-displayCount).reverse();

    DOM.historyContainer.innerHTML = '';
    recentTicks.forEach(digit => {
        const item = document.createElement('div');
        item.className = 'history-item';
        item.textContent = digit;
        DOM.historyContainer.appendChild(item);
    });

    DOM.seeMoreBtn.textContent = isHistoryExpanded ? 'See Less' : `See More (Last ${tickHistory.length} Digits)`;
}

function toggleHistory() {
    isHistoryExpanded = !isHistoryExpanded;
    updateHistory();
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    DOM.themeToggle.addEventListener('click', toggleTheme);
    DOM.connectBtn.addEventListener('click', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            disconnectWebSocket();
        } else {
            connectWebSocket();
        }
    });
    DOM.pauseBtn.addEventListener('click', togglePause);
    DOM.resetBtn.addEventListener('click', resetAnalysis);
    DOM.seeMoreBtn.addEventListener('click', toggleHistory);

    DOM.market.addEventListener('change', () => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            switchMarket(DOM.market.value);
        }
    });

    const savedMarket = localStorage.getItem('market');
    const savedTickCount = localStorage.getItem('tickCount');
    if (savedMarket) DOM.market.value = savedMarket;
    if (savedTickCount) DOM.tickCount.value = savedTickCount;

    if (localStorage.getItem('theme') === 'dark') toggleTheme();
});

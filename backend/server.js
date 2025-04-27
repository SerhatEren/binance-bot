const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();
const { Spot, WebsocketStream } = require('@binance/connector');

const app = express();
app.use(cors()); // Enable CORS for all routes
const server = http.createServer(app);

// Initialize Socket.IO Server
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connections from any origin (adjust for production)
        methods: ["GET", "POST"]
    }
});

const apiKey = process.env.BINANCE_API_KEY;
const apiSecret = process.env.BINANCE_API_SECRET;
const baseURL = process.env.BINANCE_BASE_URL; // Testnet URL from .env

if (!apiKey || !apiSecret || !baseURL) {
    console.error('Error: Binance API Key, Secret, or Base URL not found in .env file.');
    process.exit(1);
}

// Initialize Binance Spot Testnet Client for REST API calls
const spotClient = new Spot(apiKey, apiSecret, { baseURL: baseURL });

// Initialize Binance Websocket Client for streams
// Note: The base URL for WebsocketStream needs to be explicitly set for testnet
const wsBaseURL = 'wss://stream.testnet.binance.vision'; // Explicit Testnet WebSocket Stream URL

// Store the active kline stream symbol and interval
let activeKlineSymbol = 'btcusdt'; // Default, lowercase for stream name
let activeKlineInterval = '1m';
let activeKlineStreamName = `${activeKlineSymbol}@kline_${activeKlineInterval}`;

const logger = {
  info: console.log, // You can customize logging
  error: console.error,
  warn: console.warn // Add warn method
};
const callbacks = {
  open: () => logger.info('Connected to Binance WebSocket Stream'),
  close: () => logger.info('Disconnected from Binance WebSocket Stream'),
  message: (data) => {
    try {
        const parsedData = JSON.parse(data);

        // Aggregate mini ticker stream
        if (parsedData.stream === '!miniTicker@arr') {
            io.emit('tickerUpdate', parsedData.data);
        }
        // Individual BTCUSDT mini ticker updates (keep for specific display if needed)
        else if (parsedData.stream === 'btcusdt@miniTicker') {
             logger.info('[Backend] Received btcusdt@miniTicker:', JSON.stringify(parsedData.data)); // Log received data
             io.emit('btcTickerUpdate', parsedData.data);
        }
        // Handle K-line stream updates
        else if (parsedData.stream === activeKlineStreamName) {
             const kline = parsedData.data.k;
            // Check if the kline is closed (kline.x === true)
            // For real-time updates, we often want the latest tick update, not just closed candles.
            // Lightweight charts can handle updates to the current candle.
            const formattedKline = {
                time: kline.t / 1000, // Kline open time (seconds)
                open: parseFloat(kline.o),
                high: parseFloat(kline.h),
                low: parseFloat(kline.l),
                close: parseFloat(kline.c),
                // volume: parseFloat(kline.v) // Optional
            };
            // Emit to clients listening for this specific symbol/interval combo
            // Use a dynamic event name based on the stream
            io.emit(`klineUpdate_${activeKlineSymbol}_${activeKlineInterval}`, formattedKline);
            // logger.info(`Sent kline update: ${JSON.stringify(formattedKline)}`); // Optional: Log sent updates
        }

    } catch (error) {
        // Handle errors when parsing WebSocket messages
        logger.error('Failed to parse WebSocket message or identify structure:', error);
        // Log the raw data if it's a JSON parsing error
        if (error instanceof SyntaxError) {
             logger.error('Raw message data causing parse error:', data);
        }
    }
  }
};
const wsStreamClient = new WebsocketStream({ logger, callbacks, wsURL: wsBaseURL });

// Subscribe to Mini Ticker stream for all symbols
logger.info('Subscribing to !miniTicker@arr');
wsStreamClient.subscribe('!miniTicker@arr');

// Subscribe specifically to BTCUSDT Mini Ticker stream
logger.info('Subscribing to btcusdt@miniTicker');
wsStreamClient.subscribe('btcusdt@miniTicker'); // Use lowercase symbol

// Subscribe to the default K-line stream
logger.info(`Subscribing to ${activeKlineStreamName}`);
wsStreamClient.subscribe(activeKlineStreamName);

// REST API Endpoints
app.get('/api/account', async (req, res) => {
    try {
        const accountInfo = await spotClient.account();
        res.json(accountInfo.data);
    } catch (error) {
        console.error('Error fetching account info:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to fetch account info', details: error.response ? error.response.data : error.message });
    }
});

// --- Backtesting Logic ---

// Helper to calculate SMA
function calculateSMA(data, period) {
    let sums = [];
    for (let i = 0; i <= data.length - period; i++) {
        let slice = data.slice(i, i + period);
        let sum = slice.reduce((a, b) => a + b, 0);
        sums.push(sum / period);
    }
    // Pad the start with nulls so the SMA array aligns with the data array index
    return Array(period - 1).fill(null).concat(sums);
}

async function runBacktest(symbol, interval, periods, initialCapital) {
    const limit = 7 * 24; // 7 days of 1h data
    const smaPeriod = 20;
    logger.info(`Running backtest for ${symbol} interval ${interval}, periods: ${limit}, SMA: ${smaPeriod}`);

    try {
        const klinesResponse = await spotClient.klines(symbol, interval, { limit: limit + smaPeriod }); // Fetch extra data for initial SMA calc
        const klines = klinesResponse.data;

        if (!klines || klines.length < limit + smaPeriod -1) {
            logger.error('Not enough kline data for backtest.');
            return { error: 'Not enough historical data.' };
        }

        // Extract closing prices (index 4)
        const closingPrices = klines.map(k => parseFloat(k[4]));

        // Calculate SMA
        const smaValues = calculateSMA(closingPrices, smaPeriod);

        // Simulation variables
        let usdtBalance = initialCapital;
        let btcBalance = 0;
        let position = 'USDT'; // or 'BTC'
        let trades = [];
        let tradeCount = 0;

        // Start simulation after initial SMA period
        for (let i = smaPeriod; i < klines.length; i++) {
            const currentClose = closingPrices[i];
            const previousClose = closingPrices[i - 1];
            const currentSMA = smaValues[i];
            const previousSMA = smaValues[i-1]; // SMA calculated up to the previous candle

            if (!currentSMA || !previousSMA) continue; // Skip if SMA not calculated yet

            const klineTime = new Date(klines[i][0]).toISOString(); // Open time of current kline

            // Buy Signal: Price crosses above SMA
            if (position === 'USDT' && previousClose <= previousSMA && currentClose > currentSMA) {
                btcBalance = usdtBalance / currentClose; // Buy with all USDT
                usdtBalance = 0;
                position = 'BTC';
                tradeCount++;
                trades.push({ time: klineTime, type: 'BUY', price: currentClose, btc: btcBalance });
                logger.info(`BUY at ${currentClose} on ${klineTime}`);
            }
            // Sell Signal: Price crosses below SMA
            else if (position === 'BTC' && previousClose >= previousSMA && currentClose < currentSMA) {
                usdtBalance = btcBalance * currentClose; // Sell all BTC
                btcBalance = 0;
                position = 'USDT'; // Correctly set position to USDT after selling BTC
                tradeCount++;
                trades.push({ time: klineTime, type: 'SELL', price: currentClose, usdt: usdtBalance });
                logger.info(`SELL at ${currentClose} on ${klineTime}`);
            }
        }

        // Calculate final portfolio value in USDT
        let finalPortfolioValue = usdtBalance;
        if (btcBalance > 0) {
            finalPortfolioValue += btcBalance * closingPrices[closingPrices.length - 1]; // Value BTC at last closing price
        }

        const profitLoss = finalPortfolioValue - initialCapital;
        const profitLossPercent = (profitLoss / initialCapital) * 100;

        logger.info(`Backtest Complete: Final Value=${finalPortfolioValue.toFixed(2)} USDT, P/L=${profitLoss.toFixed(2)} USDT (${profitLossPercent.toFixed(2)}%), Trades=${tradeCount}`);

        return {
            initialCapital,
            finalPortfolioValue: parseFloat(finalPortfolioValue.toFixed(2)),
            profitLoss: parseFloat(profitLoss.toFixed(2)),
            profitLossPercent: parseFloat(profitLossPercent.toFixed(2)),
            tradeCount,
            trades // Maybe shorten this or don't return full list for large tests
        };

    } catch (error) {
        logger.error('Backtest failed:', error.response ? error.response.data : error.message);
        return { error: 'Backtest failed', details: error.response ? error.response.data : error.message };
    }
}

app.get('/api/backtest', async (req, res) => {
    // Get parameters from query string, with defaults
    const symbol = req.query.symbol?.toUpperCase() || 'BTCUSDT'; // Default to BTCUSDT if not provided
    const interval = req.query.interval || '1h';          // Default to 1h if not provided
    const strategy = req.query.strategy || 'SMA_CROSSOVER'; // Default strategy
    const initialCapital = parseInt(req.query.capital) || 10000; // Default capital

    logger.info(`Received backtest request: Symbol=${symbol}, Interval=${interval}, Strategy=${strategy}, Capital=${initialCapital}`);

    // Currently, only SMA_CROSSOVER is implemented
    if (strategy !== 'SMA_CROSSOVER') {
        logger.warn(`Strategy '${strategy}' not implemented. Defaulting to SMA_CROSSOVER.`);
        // In a real scenario, you might return an error or implement the strategy
        // For now, we just proceed with the default
    }

    // TODO: Fetch appropriate number of periods based on strategy needs
    // Hardcoding periods for now
    const periods = 168; // Example: 7 days of 1h data

    const result = await runBacktest(symbol, interval, periods, initialCapital);
    res.json(result);
});

// New endpoint to fetch historical K-line data
app.get('/api/klines', async (req, res) => {
    const { symbol, interval, limit = 500 } = req.query; // Default limit to 500 candles

    if (!symbol || !interval) {
        return res.status(400).json({ error: 'Missing required query parameters: symbol and interval' });
    }

    try {
        logger.info(`Fetching klines for ${symbol}, interval ${interval}, limit ${limit}`);
        const klinesResponse = await spotClient.klines(symbol.toUpperCase(), interval, { limit: parseInt(limit) });

        // Format data for lightweight-charts
        // Binance kline format: [openTime, open, high, low, close, volume, closeTime, quoteAssetVolume, numberOfTrades, takerBuyBaseAssetVolume, takerBuyQuoteAssetVolume, ignore]
        // Lightweight charts format: { time: seconds, open, high, low, close }
        const formattedKlines = klinesResponse.data.map(k => ({
            time: k[0] / 1000, // Convert openTime milliseconds to seconds
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            // volume: parseFloat(k[5]) // Optional: include volume if needed later
        }));

        res.json(formattedKlines);

    } catch (error) {
        logger.error(`Error fetching klines for ${symbol} ${interval}:`, error.response ? error.response.data : error.message);
        res.status(error.response?.status || 500).json({ 
            error: 'Failed to fetch kline data', 
            details: error.response?.data || error.message 
        });
    }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected to Socket.IO:', socket.id);

    // **Future Enhancement Idea:**
    // Handle requests from frontend to change the active kline stream
    // socket.on('subscribeToKline', ({ symbol, interval }) => {
    //     // Unsubscribe from old stream
    //     wsStreamClient.unsubscribe(activeKlineStreamName);
    //     // Update active stream vars
    //     activeKlineSymbol = symbol.toLowerCase();
    //     activeKlineInterval = interval;
    //     activeKlineStreamName = `${activeKlineSymbol}@kline_${activeKlineInterval}`;
    //     // Subscribe to new stream
    //     wsStreamClient.subscribe(activeKlineStreamName);
    //     logger.info(`Switched subscription to ${activeKlineStreamName}`);
    // });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const port = process.env.PORT || 3001;
server.listen(port, () => {
    console.log(`Backend server listening on port ${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down WebSocket client...');
    wsStreamClient.disconnect();
    console.log('Closing server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
}); 
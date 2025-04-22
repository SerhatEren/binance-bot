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
const logger = {
  info: console.log, // You can customize logging
  error: console.error,
};
const callbacks = {
  open: () => logger.info('Connected to Binance WebSocket Stream'),
  close: () => logger.info('Disconnected from Binance WebSocket Stream'),
  message: (data) => {
    try {
        const parsedData = JSON.parse(data);

        // Check if it's the aggregate stream (has .stream property)
        if (parsedData.stream === '!miniTicker@arr') {
            // logger.info('Received aggregate ticker update');
            io.emit('tickerUpdate', parsedData.data); // Emit array of tickers
        }
        // Check if it LOOKS like a single miniTicker event (check for event type 'e')
        else if (parsedData.e === '24hrMiniTicker' && parsedData.s === 'BTCUSDT') {
             // Check if it is the BTCUSDT specific one we subscribed to
             io.emit('btcTickerUpdate', parsedData); // Emit the whole object
        }
        // Handle Kline updates for BTCUSDT 1h
        // else if (parsedData.stream === 'btcusdt@kline_1h') {
        //     // Data structure: { e: 'kline', E: ..., s: 'BTCUSDT', k: { t:..., T:..., ... } }
        //     const kline = parsedData.data.k;
        //     // Format for lightweight-charts: { time: candle.t / 1000, open: parseFloat(candle.o), high: parseFloat(candle.h), low: parseFloat(candle.l), close: parseFloat(candle.c) }
        //     const formattedKline = {
        //         time: kline.t / 1000, // Convert ms to seconds for lightweight-charts
        //         open: parseFloat(kline.o),
        //         high: parseFloat(kline.h),
        //         low: parseFloat(kline.l),
        //         close: parseFloat(kline.c),
        //         // volume: parseFloat(kline.v) // Optional volume data
        //     };
        //     io.emit('klineUpdate', formattedKline); // Emit the formatted kline update
        // }
        // Log anything else unexpected
        // else {
        //     logger.info(`Received unhandled message structure: ${JSON.stringify(parsedData).substring(0, 200)}...`);
        // }
    } catch (error) {
        logger.error('Failed to parse WebSocket message or identify structure:', error);
        // Log raw data only if parsing fails, as stringify might fail too on large/weird data
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
    // Simple fixed parameters for now
    const symbol = 'BTCUSDT';
    const interval = '1h';
    const initialCapital = 10000;
    const result = await runBacktest(symbol, interval, 168, initialCapital);
    res.json(result);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('A user connected to Socket.IO:', socket.id);
    // Optionally send initial data or welcome message
    // socket.emit('welcome', 'Connected to Binance Bot Backend');

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
    // Unsubscribe if needed, though disconnect should handle it
    wsStreamClient.unsubscribe('!miniTicker@arr');
    wsStreamClient.unsubscribe('btcusdt@miniTicker');
    wsStreamClient.disconnect();
    console.log('Closing server...');
    server.close(() => {
        console.log('Server closed.');
        process.exit(0);
    });
}); 
const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const cors = require('cors');
require('dotenv').config();
const { Spot, WebsocketStream } = require('@binance/connector');
const { spawn } = require('child_process');
const path = require('path');

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

// --- Helper function to run Python scripts ---
/**
 * Runs a Python script using spawn, sends data via stdin, and returns parsed JSON output.
 * @param {string} scriptName The name of the script in backend/scripts
 * @param {object|null} inputData Data to send to the script's stdin as JSON.
 * @returns {Promise<object>} A promise that resolves with the parsed JSON output from the script.
 */
function runPythonScript(scriptName, inputData = null) {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, 'scripts', scriptName);
        // Use 'python' or 'python3' depending on the system setup
        // Consider making this configurable or detecting it
        const pythonProcess = spawn('python', [scriptPath]);

        let stdoutData = '';
        let stderrData = '';

        pythonProcess.stdout.on('data', (data) => {
            stdoutData += data.toString();
        });

        pythonProcess.stderr.on('data', (data) => {
            stderrData += data.toString();
            console.error(`[${scriptName} stderr]: ${data}`); // Log stderr immediately
        });

        pythonProcess.on('close', (code) => {
            if (code !== 0) {
                console.error(`[${scriptName}] exited with code ${code}`);
                // Attempt to parse stderr as JSON for potential error messages from script
                try {
                    const errorJson = JSON.parse(stderrData);
                    if (errorJson.error) {
                        return reject(new Error(`${scriptName} Error: ${errorJson.error} (Exit code: ${code})`));
                    }
                } catch (e) { /* Ignore if stderr is not JSON */ }
                // Fallback generic error
                return reject(new Error(`${scriptName} failed with code ${code}. Stderr: ${stderrData.substring(0, 500)}`));
            }
            // Process finished successfully
            try {
                const result = JSON.parse(stdoutData);
                resolve(result);
            } catch (error) {
                console.error(`[${scriptName}] Failed to parse stdout JSON:`, stdoutData);
                reject(new Error(`${scriptName} produced invalid JSON output.`));
            }
        });

        pythonProcess.on('error', (error) => {
            console.error(`[${scriptName}] Failed to start Python process:`, error);
            reject(new Error(`Failed to start ${scriptName}: ${error.message}`));
        });

        // Send input data via stdin if provided
        if (inputData !== null) {
            try {
                const inputJson = JSON.stringify(inputData);
                pythonProcess.stdin.write(inputJson);
                pythonProcess.stdin.end();
            } catch (error) {
                reject(new Error(`Failed to stringify input data for ${scriptName}: ${error.message}`));
            }
        } else {
             pythonProcess.stdin.end(); // Close stdin even if no data is sent
        }
    });
}
// --- End Helper Function ---

// --- Stock and News Analysis ---

// TODO: Populate with actual BIST30 symbols and relevant keywords/names
const bist30Stocks = [
    { symbol: 'AKBNK', keywords: ['akbank'] },
    { symbol: 'GARAN', keywords: ['garanti', 'garanti bbva'] },
    { symbol: 'ISCTR', keywords: ['iş bankası', 'is bankasi'] },
    { symbol: 'TCELL', keywords: ['turkcell'] },
    { symbol: 'THYAO', keywords: ['thy', 'türk hava yolları', 'turkish airlines'] },
    // ... add all relevant BIST30 stocks and keywords
];

/**
 * Placeholder function to identify relevant stocks from news text.
 * TODO: Implement a more robust matching logic (e.g., NLP, better keyword search).
 * @param {string} text The news title or summary.
 * @returns {string[]} An array of relevant stock symbols.
 */
function findRelevantStocks(text) {
    const relevantSymbols = [];
    const lowerCaseText = text.toLowerCase();
    for (const stock of bist30Stocks) {
        for (const keyword of stock.keywords) {
            if (lowerCaseText.includes(keyword.toLowerCase())) {
                if (!relevantSymbols.includes(stock.symbol)) {
                    relevantSymbols.push(stock.symbol);
                }
                break; // Found keyword for this stock, move to next stock
            }
        }
    }
    return relevantSymbols;
}

// Store latest sentiment analysis results (in-memory, replace with DB if needed)
let latestSentiment = {}; // { 'GARAN': { sentiment: 'positive', score: 0.9, timestamp: ... }, ... }

async function fetchAndAnalyzeNews() {
    console.log('Fetching and analyzing news...');
    try {
        const newsItems = await runPythonScript('fetch_news.py');
        console.log(`Fetched ${newsItems.length} news items.`);

        for (const item of newsItems) {
            const combinedText = `${item.title}. ${item.summary}`; // Combine title and summary
            const relevantSymbols = findRelevantStocks(combinedText);

            if (relevantSymbols.length > 0) {
                console.log(`News item potentially relevant to: ${relevantSymbols.join(', ')}. Analyzing sentiment...`);
                try {
                    const sentimentResult = await runPythonScript('analyze_sentiment.py', { text: combinedText });
                    if (sentimentResult && !sentimentResult.error) {
                        const timestamp = new Date().toISOString();
                        console.log(`Sentiment for "${item.title.substring(0,50)}...": ${sentimentResult.sentiment} (${sentimentResult.score.toFixed(3)})`);
                        for (const symbol of relevantSymbols) {
                            latestSentiment[symbol] = { ...sentimentResult, timestamp, newsTitle: item.title };
                            // TODO: Store this result more permanently or trigger actions
                        }
                    } else {
                         console.warn(`Sentiment analysis failed for news item: ${sentimentResult?.error || 'Unknown error'}`);
                    }
                } catch (sentimentError) {
                    console.error(`Error analyzing sentiment for news item: ${sentimentError.message}`);
                }
            }
        }
        // Optional: Clean up old sentiment data if stored in memory
    } catch (error) {
        console.error('Error in fetchAndAnalyzeNews:', error.message);
    }
}

// Run news fetching every 5 minutes (300,000 ms)
const NEWS_FETCH_INTERVAL = 5 * 60 * 1000;
setInterval(fetchAndAnalyzeNews, NEWS_FETCH_INTERVAL);
// Run once immediately on startup
fetchAndAnalyzeNews();

// --- Price Prediction Placeholder ---
/**
 * Triggers LSTM price prediction using yfinance data as input.
 * Fetches data via fetch_lstm_data_yf.py, then predicts via predict_price.py.
 * TODO: Replace yfinance call with actual Binance data fetching when ready.
 * @param {string} symbol The stock symbol (e.g., 'GARAN')
 */
async function triggerPricePrediction(symbol) {
    console.log(`Triggering price prediction for ${symbol} using yfinance data...`);
    try {
        // 1. Fetch required historical data using the yfinance script
        console.log(`[${symbol}] Fetching historical data via fetch_lstm_data_yf.py...`);
        const dataResult = await runPythonScript('fetch_lstm_data_yf.py', { symbol: symbol });

        if (!dataResult || dataResult.error || !dataResult.features) {
            throw new Error(`Failed to fetch/process data from yfinance script: ${dataResult?.error || 'No features returned'}`);
        }
        console.log(`[${symbol}] Successfully fetched features.`);

        // 2. Data is already formatted by the python script (shape: [20, 9])
        const features = dataResult.features;
        const inputPayload = { features: features }; // Payload for predict_price.py

        // 3. Run the prediction script
        console.log(`[${symbol}] Running prediction via predict_price.py...`);
        const predictionResult = await runPythonScript('predict_price.py', inputPayload);

        // 4. Process the result
        if (predictionResult && !predictionResult.error) {
            console.log(`[${symbol}] Prediction Result: Signal=${predictionResult.signal}, Value=${predictionResult.prediction} (${predictionResult.result_type})`);
            // TODO: Store result, combine with sentiment, place orders, etc.
            // Example: Store prediction alongside sentiment
            if (latestSentiment[symbol]) {
                latestSentiment[symbol].prediction = predictionResult;
                latestSentiment[symbol].predictionTimestamp = new Date().toISOString();
            } else {
                 latestSentiment[symbol] = { prediction: predictionResult, predictionTimestamp: new Date().toISOString() };
            }
            // --- Add your trading logic here ---
            // e.g., if (predictionResult.signal === 1 && latestSentiment[symbol]?.sentiment === 'positive') { placeBuyOrder(symbol); }
            // --- End trading logic ---

        } else {
            console.error(`[${symbol}] Price prediction script failed: ${predictionResult?.error || 'Unknown error'}`);
        }

    } catch (error) {
        console.error(`Error during price prediction trigger for ${symbol}: ${error.message}`);
    }
}

// Example: How you might call it (e.g., from a scheduler or API endpoint)
// Schedule this to run daily after market close for relevant symbols
// Using a simple timeout for demonstration:
// setTimeout(() => triggerPricePrediction('GARAN'), 10000); // Example call after 10s

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
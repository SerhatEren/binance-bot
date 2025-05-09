import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import axios from 'axios';
import AccountInfo from './components/AccountInfo';
import TickerDisplay from './components/TickerDisplay';
import BtcUsdtDisplay from './components/BtcUsdtDisplay';
import BacktestRunner from './components/BacktestRunner';
import BacktestResults from './components/BacktestResults';
import TradingChart from './components/TradingChart';
import './App.css';

// Define available options for dropdowns
const availableChartSymbols = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'ADAUSDT', 'SOLUSDT']; // Add more symbols as desired
const availableChartIntervals = ['1m', '5m', '15m', '1h', '4h', '1d']; // Subset of Binance intervals

// Make sure the backend URL is correct - adjust if needed
const BACKEND_URL = 'http://localhost:3001';
let socket; // Define socket outside component to avoid re-creation on re-render

function App() {
    const [isConnected, setIsConnected] = useState(false);
    const [accountInfo, setAccountInfo] = useState(null);
    const [tickerData, setTickerData] = useState({});
    const [btcTicker, setBtcTicker] = useState(null);
    const [backtestResults, setBacktestResults] = useState(null);
    const [error, setError] = useState(null);

    // State for chart parameters - controlled by dropdowns now
    const [chartSymbol, setChartSymbol] = useState(availableChartSymbols[0]); // Default to first symbol
    const [chartInterval, setChartInterval] = useState(availableChartIntervals[0]); // Default to first interval

    // Initialize socket connection only once
    if (!socket) {
        socket = io(BACKEND_URL);
    }

    useEffect(() => {
        // Socket.IO connection listeners
        socket.on('connect', () => {
            console.log('Connected to backend WebSocket');
            setIsConnected(true);
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from backend WebSocket');
            setIsConnected(false);
        });

        // Listener for ALL ticker updates (for the table)
        socket.on('tickerUpdate', (data) => {
            if (Array.isArray(data)) {
                setTickerData(prevData => {
                    const newData = { ...prevData };
                    data.forEach(ticker => {
                        newData[ticker.s] = ticker;
                    });
                    return newData;
                });
            }
        });

        // Listener specifically for BTCUSDT updates
        socket.on('btcTickerUpdate', (btcData) => {
            console.log('[App.jsx] Received btcTickerUpdate:', btcData);
            setBtcTicker(btcData);
            // Optionally update the main tickerData state as well if needed elsewhere
            // setTickerData(prevData => ({ ...prevData, [btcData.s]: btcData }));
        });

        // Fetch initial account info
        const fetchAccountInfo = async () => {
            try {
                setError(null); // Clear previous errors
                console.log(`Fetching account info from ${BACKEND_URL}/api/account`);
                const response = await axios.get(`${BACKEND_URL}/api/account`);
                console.log('Account Info Response:', response.data);
                setAccountInfo(response.data);
            } catch (err) {
                console.error('Error fetching account info:', err);
                setError(err.response?.data?.details?.msg || err.response?.data?.error || err.message || 'Failed to fetch account info');
            }
        };

        fetchAccountInfo();

        // No need to return cleanup for connect/disconnect if socket persists
        // Only clean up specific event listeners
        return () => {
            // Keep basic connect/disconnect listeners if needed elsewhere or manage globally
            // socket.off('connect');
            // socket.off('disconnect');
            socket.off('tickerUpdate');
            socket.off('btcTickerUpdate');
            // klineUpdate listener is managed within TradingChart component
        };
    }, []); // Empty dependency array means this runs once on mount

    // Callback function for BacktestRunner
    const handleBacktestResults = (results) => {
        setBacktestResults(results);
    };

    return (
        <div className="App">
            <header className="App-header">
                <h1>Binance Testnet Trading Bot Interface</h1>
                <p>Backend Connection Status: {isConnected ? <span style={{color: 'lime'}}>Connected</span> : <span style={{color: 'red'}}>Disconnected</span>}</p>
            </header>
            <main>
                {error && <div className="error-message">Error: {error}</div>}
                <div className="data-columns">
                    <AccountInfo info={accountInfo} />
                    <BtcUsdtDisplay ticker={btcTicker} />
                </div>

                {/* Chart Section */}
                <div className="chart-controls section">
                     <h3>Chart Controls</h3>
                     <div>
                        <label htmlFor="chartSymbol">Symbol:</label>
                        <select 
                            id="chartSymbol" 
                            value={chartSymbol} 
                            onChange={(e) => setChartSymbol(e.target.value)}
                        >
                            {availableChartSymbols.map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="chartInterval">Interval:</label>
                        <select 
                            id="chartInterval" 
                            value={chartInterval} 
                            onChange={(e) => setChartInterval(e.target.value)}
                        >
                            {availableChartIntervals.map(i => (
                                <option key={i} value={i}>{i}</option>
                            ))}
                        </select>
                    </div>
                     <p style={{ fontSize: '0.8em', fontStyle: 'italic', marginTop: '5px' }}>
                         Note: Real-time updates currently only reflect BTCUSDT/1m due to backend limitations.
                    </p>
                </div>

                <TradingChart 
                    socket={socket} 
                    symbol={chartSymbol} 
                    interval={chartInterval} 
                />
                {/* Backtesting Section */}
                <BacktestRunner onResults={handleBacktestResults} />
                <BacktestResults results={backtestResults} />

                {/* Ticker Table */}
                <TickerDisplay tickers={tickerData} />
            </main>
        </div>
    );
}

export default App;

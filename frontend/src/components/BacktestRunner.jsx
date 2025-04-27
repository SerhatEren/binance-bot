import React, { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

// Define available intervals and strategies
const availableIntervals = ['1m', '3m', '5m', '15m', '30m', '1h', '2h', '4h', '6h', '8h', '12h', '1d', '3d', '1w'];
const availableStrategies = ['SMA_CROSSOVER']; // Add more as they are implemented

const BacktestRunner = ({ onResults }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // State for backtest parameters
    const [symbol, setSymbol] = useState('BTCUSDT');
    const [interval, setInterval] = useState('1h');
    const [strategy, setStrategy] = useState('SMA_CROSSOVER');
    const [capital, setCapital] = useState(10000);

    const handleRunBacktest = async () => {
        setIsLoading(true);
        setError(null);
        onResults(null); // Clear previous results

        // Construct query parameters
        const params = new URLSearchParams({
            symbol: symbol.toUpperCase(), // Ensure symbol is uppercase
            interval,
            strategy,
            capital
        });

        try {
            console.log(`Requesting backtest with params: ${params.toString()}`);
            const response = await axios.get(`${BACKEND_URL}/api/backtest?${params.toString()}`);
            console.log('Backtest response received:', response.data);
            if (response.data.error) {
                setError(response.data.details || response.data.error);
                onResults(null);
            } else {
                onResults(response.data);
            }
        } catch (err) {
            console.error('Error running backtest:', err);
            setError(err.response?.data?.details || err.response?.data?.error || err.message || 'Failed to run backtest');
            onResults(null);
        }
        setIsLoading(false);
    };

    return (
        <div className="backtest-runner section">
            <h2>Run Backtest</h2>
            <div className="backtest-params">
                <div>
                    <label htmlFor="symbol">Symbol:</label>
                    <input
                        type="text"
                        id="symbol"
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value)}
                        placeholder="e.g., BTCUSDT"
                    />
                </div>
                <div>
                    <label htmlFor="interval">Interval:</label>
                    <select id="interval" value={interval} onChange={(e) => setInterval(e.target.value)}>
                        {availableIntervals.map(int => (
                            <option key={int} value={int}>{int}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label htmlFor="strategy">Strategy:</label>
                    <select id="strategy" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                         {availableStrategies.map(strat => (
                            <option key={strat} value={strat}>{strat.replace('_', ' ')}</option>
                        ))}
                    </select>
                </div>
                 <div>
                    <label htmlFor="capital">Initial Capital:</label>
                    <input
                        type="number"
                        id="capital"
                        value={capital}
                        onChange={(e) => setCapital(parseInt(e.target.value) || 0)}
                        placeholder="e.g., 10000"
                    />
                </div>
            </div>
            <button onClick={handleRunBacktest} disabled={isLoading} style={{ marginTop: '15px' }}>
                {isLoading ? 'Running Backtest...' : 'Run Backtest'}
            </button>
            {error && <div className="error-message" style={{ marginTop: '15px' }}>Backtest Error: {error}</div>}
        </div>
    );
};

export default BacktestRunner; 
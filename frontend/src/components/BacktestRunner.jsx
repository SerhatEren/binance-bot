import React, { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = 'http://localhost:3001';

const BacktestRunner = ({ onResults }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleRunBacktest = async () => {
        setIsLoading(true);
        setError(null);
        onResults(null); // Clear previous results
        try {
            console.log('Requesting backtest...');
            const response = await axios.get(`${BACKEND_URL}/api/backtest`);
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
            <h2>Simple SMA Crossover Backtest (BTC/USDT, 1h, 7 days)</h2>
            <button onClick={handleRunBacktest} disabled={isLoading}>
                {isLoading ? 'Running Backtest...' : 'Run Backtest'}
            </button>
            {error && <div className="error-message" style={{ marginTop: '15px' }}>Backtest Error: {error}</div>}
        </div>
    );
};

export default BacktestRunner; 
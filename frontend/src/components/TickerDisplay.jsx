import React, { useState } from 'react';

const TickerDisplay = ({ tickers }) => {
    const [searchTerm, setSearchTerm] = useState('');

    // Convert tickers object to array and filter based on search term
    const tickerArray = Object.values(tickers).filter(ticker =>
        ticker.s.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sort by symbol for consistent order
    tickerArray.sort((a, b) => a.s.localeCompare(b.s));

    return (
        <div className="ticker-display section">
            <h2>Market Tickers (Real-time)</h2>
            <input
                type="text"
                placeholder="Filter symbols... (e.g., BTCUSDT)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="filter-input"
            />
            {tickerArray.length > 0 ? (
                <table>
                    <thead>
                        <tr>
                            <th>Symbol (s)</th>
                            <th>Last Price (c)</th>
                            <th>Open (o)</th>
                            <th>High (h)</th>
                            <th>Low (l)</th>
                            <th>Volume (v)</th>
                            <th>Quote Volume (q)</th>
                        </tr>
                    </thead>
                    <tbody>
                        {tickerArray.map(ticker => (
                            <tr key={ticker.s}> 
                                <td>{ticker.s}</td>
                                <td>{parseFloat(ticker.c).toFixed(ticker.s.endsWith('USDT') || ticker.s.endsWith('BUSD') || ticker.s.endsWith('USDC') ? 2 : 8)}</td>
                                <td>{parseFloat(ticker.o).toFixed(ticker.s.endsWith('USDT') || ticker.s.endsWith('BUSD') || ticker.s.endsWith('USDC') ? 2 : 8)}</td>
                                <td>{parseFloat(ticker.h).toFixed(ticker.s.endsWith('USDT') || ticker.s.endsWith('BUSD') || ticker.s.endsWith('USDC') ? 2 : 8)}</td>
                                <td>{parseFloat(ticker.l).toFixed(ticker.s.endsWith('USDT') || ticker.s.endsWith('BUSD') || ticker.s.endsWith('USDC') ? 2 : 8)}</td>
                                <td>{parseFloat(ticker.v).toFixed(2)}</td>
                                <td>{parseFloat(ticker.q).toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <p>Waiting for ticker data or no matching symbols...</p>
            )}
        </div>
    );
};

export default TickerDisplay; 
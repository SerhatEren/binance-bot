import React from 'react';

const BacktestResults = ({ results }) => {
    if (!results) {
        return null; // Don't render anything if there are no results yet
    }

    const profitColor = results.profitLoss >= 0 ? 'lime' : '#ff4d4d';

    return (
        <div className="backtest-results section">
            <h2>Backtest Results</h2>
            <div className="results-summary">
                <p><strong>Initial Capital (USDT):</strong> {results.initialCapital?.toLocaleString()}</p>
                <p><strong>Final Portfolio Value (USDT):</strong> {results.finalPortfolioValue?.toLocaleString()}</p>
                <p><strong>Total Trades:</strong> {results.tradeCount}</p>
                <p><strong>Profit/Loss (USDT):</strong> <span style={{ color: profitColor }}>{results.profitLoss?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span></p>
                <p><strong>Profit/Loss (%):</strong> <span style={{ color: profitColor }}>{results.profitLossPercent?.toFixed(2)}%</span></p>
            </div>
            {/* Optionally display trade details later */}
            {/* results.trades && results.trades.length > 0 && (
                <details>
                    <summary>Show Trades ({results.trades.length})</summary>
                    <table>
                        <thead><tr><th>Time</th><th>Type</th><th>Price</th><th>Amount</th></tr></thead>
                        <tbody>
                            {results.trades.slice(0, 20).map((trade, index) => (
                                <tr key={index}>
                                    <td>{new Date(trade.time).toLocaleString()}</td>
                                    <td>{trade.type}</td>
                                    <td>{trade.price.toFixed(2)}</td>
                                    <td>{trade.type === 'BUY' ? trade.btc.toFixed(6) + ' BTC' : trade.usdt.toFixed(2) + ' USDT'}</td>
                                </tr>
                            ))}
                            {results.trades.length > 20 && <tr><td colSpan="4">...and {results.trades.length - 20} more trades</td></tr>}
                        </tbody>
                    </table>
                </details>
            )*/}
        </div>
    );
};

export default BacktestResults; 
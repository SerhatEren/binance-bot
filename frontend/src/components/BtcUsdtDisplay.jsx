import React from 'react';

const BtcUsdtDisplay = ({ ticker }) => {
    if (!ticker) {
        return <div className="section">Loading BTC/USDT Data...</div>;
    }

    const formatPrice = (price) => {
        return parseFloat(price).toFixed(2); // BTC/USDT typically has 2 decimal places
    };

    // Determine color based on price change (close vs open)
    let priceColor = 'white';
    if (parseFloat(ticker.c) > parseFloat(ticker.o)) {
        priceColor = 'lime'; // Price went up
    } else if (parseFloat(ticker.c) < parseFloat(ticker.o)) {
        priceColor = '#ff4d4d'; // Price went down (using the error color)
    }

    return (
        <div className="btc-usdt-display section">
            <h2>BTC/USDT Live Data</h2>
            <div className="price-details">
                <p><strong>Last Price:</strong> <span style={{ color: priceColor, fontWeight: 'bold' }}>{formatPrice(ticker.c)}</span></p>
                <p><strong>Open:</strong> {formatPrice(ticker.o)}</p>
                <p><strong>High:</strong> {formatPrice(ticker.h)}</p>
                <p><strong>Low:</strong> {formatPrice(ticker.l)}</p>
                <p><strong>Volume (BTC):</strong> {parseFloat(ticker.v).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                <p><strong>Quote Volume (USDT):</strong> {parseFloat(ticker.q).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
            </div>
        </div>
    );
};

export default BtcUsdtDisplay; 
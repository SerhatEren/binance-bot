import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import * as LightweightCharts from 'lightweight-charts';

const BACKEND_URL = 'http://localhost:3001';

const TradingChart = ({ symbol = 'BTCUSDT', interval = '1m', socket }) => {
    const chartContainerRef = useRef(null);
    const chartRef = useRef(null);
    const candlestickSeriesRef = useRef(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!chartContainerRef.current || !symbol || !interval) return;

        let isMounted = true; // Flag to prevent state updates on unmounted component
        setLoading(true);
        setError(null);

        // Define the specific kline update event name based on props
        const klineUpdateEvent = `klineUpdate_${symbol.toLowerCase()}_${interval}`;

        const setupChart = async () => {
            try {
                const response = await axios.get(`${BACKEND_URL}/api/klines`, {
                    params: { symbol: symbol.toUpperCase(), interval: interval, limit: 500 }
                });
                if (!isMounted) return; // Exit if component unmounted during fetch
                const initialData = response.data;
                // Log first 5 candles of initial data
                console.log('Initial Chart Data (first 5):', initialData.slice(0, 5));
                if (!initialData || initialData.length === 0) {
                    throw new Error('No historical data received');
                }

                // Ensure the container is ready and has dimensions
                if (!chartRef.current && chartContainerRef.current && chartContainerRef.current.clientWidth > 0) {
                    console.log('Container ready, creating chart...');
                    chartRef.current = LightweightCharts.createChart(chartContainerRef.current, {
                        layout: { backgroundColor: '#ffffff', textColor: '#333' },
                        grid: { vertLines: { color: 'rgba(197, 203, 206, 0.2)' }, horzLines: { color: 'rgba(197, 203, 206, 0.2)' } },
                        crosshair: { mode: 1 },
                        priceScale: { borderColor: 'rgba(197, 203, 206, 0.8)' },
                        timeScale: { borderColor: 'rgba(197, 203, 206, 0.8)', timeVisible: true, secondsVisible: false },
                    });

                    console.log('Result of createChart:', chartRef.current);
                    if (chartRef.current) {
                        console.log('Keys on chartRef.current:', Object.keys(chartRef.current));
                    }

                    // Immediately check and add the series
                    if (chartRef.current && typeof chartRef.current.addSeries === 'function') {
                        candlestickSeriesRef.current = chartRef.current.addSeries(LightweightCharts.CandlestickSeries, {
                            upColor: '#26a69a', downColor: '#ef5350', borderDownColor: '#ef5350', borderUpColor: '#26a69a', wickDownColor: '#ef5350', wickUpColor: '#26a69a',
                        });
                        // Log the returned series object
                        console.log('Result of addSeries:', candlestickSeriesRef.current);
                        console.log(`Candlestick series added for ${symbol} ${interval}`);

                        // Set initial data AFTER series is created
                        if (candlestickSeriesRef.current) {
                            candlestickSeriesRef.current.setData(initialData);
                            chartRef.current.timeScale().fitContent();
                            setError(null);

                            // Manually trigger resize after setting data to ensure size sync
                            handleResize();
                        } else {
                            setError('Candlestick series reference is missing after creation.');
                        }
                    } else {
                        console.error('addSeries is not a function immediately after createChart.', chartRef.current);
                        setError('Chart object created, but addSeries method is missing.');
                    }

                } else if (!chartRef.current) {
                    // Log if container wasn't ready
                    console.warn('Chart container not ready or has zero width when trying to create chart.', chartContainerRef.current?.clientWidth);
                    throw new Error('Chart container not ready for initialization.');
                }

                // --- WebSocket Listener Setup ---
                if (socket && candlestickSeriesRef.current) {
                    // Remove previous listener for this event to avoid duplicates if props change
                    socket.off(klineUpdateEvent);

                    // Add listener for new data
                    const handleKlineUpdate = (klineData) => {
                        // Log the received kline update
                        console.log('Received kline update via WebSocket:', klineData);
                        if (candlestickSeriesRef.current) {
                            candlestickSeriesRef.current.update(klineData);
                        }
                    };
                    socket.on(klineUpdateEvent, handleKlineUpdate);
                    console.log(`Listening for ${klineUpdateEvent}`);
                } else if (!candlestickSeriesRef.current) {
                    console.warn('WebSocket listener not attached because candlestick series failed to initialize.');
                } else if (!socket) {
                    console.warn('Socket instance not provided to TradingChart');
                }
                // -------------------------------

            } catch (err) {
                if (!isMounted) return;
                console.error('Error during chart setup:', err);
                // Set error state based on the caught error
                setError(err.message || 'Failed during chart setup');
                // Don't try to clear series data if it failed to initialize
                // if (candlestickSeriesRef.current) candlestickSeriesRef.current.setData([]);
            } finally {
                // Set loading state regardless of success/failure
                if (isMounted) setLoading(false);
            }
        };

        setupChart();

        const handleResize = () => {
            if (chartRef.current && chartContainerRef.current) {
                 // Use container's current clientHeight instead of fixed 400
                console.log(`Resizing chart to: ${chartContainerRef.current.clientWidth} x ${chartContainerRef.current.clientHeight}`); // Add log
                chartRef.current.resize(
                    chartContainerRef.current.clientWidth, 
                    chartContainerRef.current.clientHeight 
                );
            } else {
                 console.log('Skipping resize: Chart or container ref not available.');
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            isMounted = false; // Set flag on unmount
            window.removeEventListener('resize', handleResize);
            // Remove the specific socket listener on cleanup
            if (socket) {
                console.log(`Removing listener for ${klineUpdateEvent}`);
                socket.off(klineUpdateEvent);
            }
            if (chartRef.current) {
                console.log('Removing chart on cleanup');
                chartRef.current.remove();
                chartRef.current = null;
                candlestickSeriesRef.current = null;
            }
        };

    }, [symbol, interval]); // REMOVED socket from dependencies for now

    return (
        <div className="trading-chart section">
            <h3>Trading Chart ({symbol} / {interval})</h3>
            {loading && <p>Loading chart data...</p>}
            {error && <p className="error-message">Error loading chart: {error}</p>}
            <div ref={chartContainerRef} style={{ position: 'relative' }}></div>
        </div>
    );
};

export default TradingChart; 
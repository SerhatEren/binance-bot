# Progress

* **What Works:**
    *   Basic project structure (Frontend/Backend).
    *   Memory Bank initialized and populated.
    *   Backend fetches account info via REST (`/api/account`).
    *   Backend connects to Binance WebSocket streams (`!miniTicker@arr`, `btcusdt@miniTicker`, `btcusdt@kline_1m`).
    *   Backend relays general ticker data (`!miniTicker@arr`) to frontend via Socket.IO (`tickerUpdate`).
    *   Backend fetches historical K-line data (`/api/klines`).
    *   Backend backtesting API (`/api/backtest`) accepts dynamic symbol, interval, strategy, capital params.
    *   Frontend displays account info.
    *   Frontend displays general ticker data table (`TickerDisplay`).
    *   Frontend includes configurable backtest runner UI (`BacktestRunner`).
    *   Frontend displays backtest results (`BacktestResults`).
    *   Frontend renders a basic historical candlestick chart (`TradingChart`) using `lightweight-charts`.
    *   Frontend chart includes controls for symbol/interval selection.
* **What's Left / In Progress:**
    *   **Fix Backend Shutdown:** Backend process doesn't exit cleanly on Ctrl+C (hangs, possible logger issue during WebSocket disconnect).
    *   **Fix BTC/USDT Ticker:** Dedicated display (`BtcUsdtDisplay`) shows "Loading..."; need to debug `btcusdt@miniTicker` -> `btcTickerUpdate` data flow.
    *   **Verify Market Tickers:** Ensure `TickerDisplay` updates reliably and correctly reflects `!miniTicker@arr` stream.
    *   **Chart Enhancements (Deferred):** Fix chart overflowing container. Improve visual appearance.
    *   **Dynamic Kline Subscription:** Backend WebSocket should subscribe/unsubscribe to kline streams based on frontend chart selection.
    *   Implement frontend UI/UX enhancements ("prettier").
    *   Implement ML strategy integration (architecture decision needed).
    *   Implement signal generation logic.
    *   Implement real order execution based on signals.
    *   Enhance backend error handling, logging, and structure.
    *   Setup database (if needed for history, strategies, results).
    *   Write tests.
    *   Setup deployment pipeline.
* **Current Status:** Core data fetching/display partially working. Backtesting configurable at API level. Basic chart implemented but needs debugging/refinement. Critical bugs exist in backend shutdown and specific ticker updates.
* **Known Issues/Bugs:** 
    *   Backend doesn't close cleanly (Ctrl+C requires second press, `logger.warn` error during disconnect).
    *   `BtcUsdtDisplay` perpetually loads.
    *   `TradingChart` overflows container (fix deferred).
    *   Real-time chart updates only reflect `btcusdt@kline_1m` regardless of frontend selection.
* **Decision Log:**
    *   [Date]: Decided to use Memory Bank system for documentation.
    *   [Date]: Confirmed Frontend (React) / Backend (Node.js) architecture.
    *   [Date]: Identified use of `@binance/connector` library in backend.
    *   [Date]: Decided to use `lightweight-charts` for charting.
    *   [Date]: Debugging chart resizing/visuals deferred to focus on backend shutdown and ticker data flow. 
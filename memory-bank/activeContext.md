# Active Context

*   **Current Focus:** Address critical functionality issues: backend clean shutdown, BTC/USDT real-time display, and general market ticker updates. Chart visual/resizing issues are deferred.
*   **Recent Changes:**
    *   Added chart controls (Symbol/Interval dropdowns) to the frontend.
    *   Attempted various fixes for `lightweight-charts` initialization errors (`addCandlestickSeries` / `addSeries` issues). Chart now renders but has visual glitches (overflowing container - deferred).
    *   Added logging to backend/frontend for debugging WebSocket data flow.
*   **Next Steps:**
    1.  **Fix Backend Shutdown (Ctrl+C):** Investigate and resolve the `TypeError: this.logger.warn is not a function` during `wsStreamClient.disconnect()` in the `SIGINT` handler (`backend/server.js`).
    2.  **Fix BTC/USDT Ticker Display:** Debug the data flow from the `btcusdt@miniTicker` WebSocket stream through the backend emitter (`io.emit`) to the frontend listener (`socket.on`) and `BtcUsdtDisplay` component.
    3.  **Verify Market Tickers (Real-time):** Ensure the `!miniTicker@arr` data is flowing correctly to update the `TickerDisplay` component.
*   **Open Questions/Decisions:**
    *   How will ML models be integrated (Python service, Node.js library like TensorFlow.js)? **[Decision Needed]**
    *   Which specific ML strategies will be implemented first?
    *   What specific historical data is needed for backtesting and how will it be sourced/stored?
    *   Is a database required? If so, which one?
    *   Specific requirements for "Market Tickers (Real-time) functionality" beyond basic display (e.g., advanced filtering, sorting)?
*   **Learnings/Insights:**
    *   `lightweight-charts` v5 integration in this React/Vite setup encountered unexpected API inconsistencies (`addSeries` vs `addCandlestickSeries`). Chart resizing/visuals need further work (deferred).
    *   Backend shutdown process (`SIGINT` handler) has issues with the `@binance/connector` WebSocket client cleanup, specifically related to logging during disconnect.
    *   Need to verify data flow for individual WebSocket streams (`btcusdt@miniTicker`) vs aggregate streams (`!miniTicker@arr`).
*   **Key Patterns/Preferences:** Use environment variables for API keys. Separate frontend/backend concerns. Use official `@binance/connector`. Add console logs for debugging data flow. 
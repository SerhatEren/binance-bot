# Product Context

*   **Problem Statement:** Manually executing trading strategies, especially complex ones involving ML, is time-consuming, error-prone, and requires constant monitoring. Testing strategies effectively before live deployment is crucial but often lacks robust tools.
*   **Proposed Solution:** An automated bot that connects to the Binance Testnet, ingests market data, applies user-defined ML strategies to generate trading signals, executes orders based on these signals, provides a backtesting environment, and displays relevant information through an intuitive and visually appealing web UI.
*   **User Stories:**
    *   As a user, I want to securely connect my Binance Testnet account.
    *   As a user, I want to see my Testnet balances and open positions.
    *   As a user, I want to view real-time market data (tickers, charts).
    *   As a user, I want to select and configure an ML-based trading strategy.
    *   As a user, I want the bot to automatically generate buy/sell signals based on the selected strategy.
    *   As a user, I want the bot to execute trades on the Testnet based on generated signals.
    *   As a user, I want to backtest a strategy against historical data to evaluate its performance.
    *   As a user, I want an aesthetically pleasing and easy-to-understand interface.
*   **Non-Goals:**
    *   Trading on the Binance Live environment (initially).
    *   Providing pre-built, guaranteed profitable strategies.
    *   Advanced portfolio management features beyond basic balance display.
    *   Support for exchanges other than Binance. 
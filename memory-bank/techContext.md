# Tech Context

*   **Languages:** JavaScript (Frontend: React, Backend: Node.js)
*   **Frameworks/Libraries:**
    *   Frontend: React, Vite (likely, based on `npm run dev` command), CSS (potentially a UI library like Material UI, Tailwind CSS, or Chakra UI for the 'prettier' requirement).
    *   Backend: Node.js, Express.js.
    *   API Interaction: Axios or Fetch API (for REST), native WebSocket or a library like `ws` (for WebSockets).
    *   ML (Potential): Python (often used for ML) - Need to determine how/if Python integrates with Node.js backend (e.g., via child processes, dedicated microservice, or using Node.js ML libraries like TensorFlow.js).
    *   Data Handling (Potential): Pandas, NumPy (if using Python for ML/backtesting).
*   **Databases:** None specified yet. May need one for historical data, backtesting results, or strategy configurations.
*   **Infrastructure:** Local development environment currently. Deployment TBD (e.g., Docker, Cloud Platform).
*   **Key Dependencies:** Binance API (Testnet), potentially ML libraries (scikit-learn, TensorFlow, PyTorch), data processing libraries.
*   **Development Setup:** Requires Node.js, npm/yarn. Separate `npm install` and run commands for `frontend` and `backend`. Backend uses `.env` for API keys.
*   **Tooling:** Standard Node.js/React tooling (linters like ESLint, formatters like Prettier likely configured).
*   **Constraints:** Testnet environment limitations, Binance API rate limits (documented in `rest-api.md` and `web-socket-api.md`). 
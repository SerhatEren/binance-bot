# System Patterns

*   **Architecture Overview:** Frontend-Backend separation. React SPA (Single Page Application) frontend communicates with a Node.js/Express backend API.
*   **Key Components:**
    *   **Frontend UI (React):** Displays data, handles user interactions.
    *   **Backend Server (Node.js/Express):** Serves frontend, proxies API requests to Binance, manages WebSocket connections, potentially hosts ML/backtesting logic or interfaces with it.
    *   **Binance API Client (Backend):** Handles communication (REST & WebSocket) with Binance Testnet.
    *   **ML Strategy Module (TBD):** Component responsible for loading/running ML models and generating signals. (Location/Language TBD - Node.js or Python?)
    *   **Backtesting Engine (TBD):** Component for running strategies against historical data.
    *   **Trading Execution Module (Backend):** Places/manages orders based on signals.
*   **Data Flow:**
    1.  **Market Data:** Binance WebSocket -> Backend -> Frontend (for display)
    2.  **ML Input Data:** Binance (Historical/Real-time) -> Backend -> ML Module
    3.  **Trading Signals:** ML Module -> Backend -> Trading Execution Module
    4.  **Orders:** Trading Execution Module -> Backend -> Binance API Client -> Binance
    5.  **Account Info:** Binance REST API -> Binance API Client -> Backend -> Frontend
    6.  **UI Actions:** Frontend -> Backend API
*   **Design Patterns:**
    *   **API Gateway (Implicit):** Backend acts as a gateway for the frontend to access Binance API securely.
    *   **Component-Based UI:** React standard.
    *   **Observer Pattern (Likely):** WebSocket handling for real-time data updates.
    *   **Environment Configuration:** Using `.env` file for sensitive data (API keys).
*   **API Design:**
    *   Internal API between Frontend and Backend (RESTful principles likely).
    *   External API usage follows Binance REST API (`rest-api.md`) and WebSocket (`web-socket-api.md`, `web-socket-streams.md`) specifications. 
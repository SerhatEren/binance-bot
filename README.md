# Binance Testnet Trading Bot UI

This project provides a simple web interface to monitor Binance Testnet account information and real-time market ticker data.

It uses a React frontend and a Node.js/Express backend to securely handle API requests to the Binance Testnet.

## Features

*   Displays Testnet account balances (non-zero only).
*   Shows real-time mini-ticker data for all symbols via WebSocket stream.
*   Filters displayed tickers by symbol.
*   Securely handles API keys on the backend.

## Project Structure

```
/
  ├── backend/         # Node.js/Express server
  │   ├── server.js      # Main server file
  │   ├── package.json   # Backend dependencies
  │   ├── .env           # Environment variables (API Keys, etc.) - !! ADD TO .gitignore !!
  │   └── ...
  ├── frontend/        # React UI
  │   ├── src/
  │   │   ├── App.jsx        # Main application component
  │   │   ├── App.css        # Styles for App component
  │   │   ├── main.jsx       # Entry point
  │   │   └── components/    # UI components
  │   │       ├── AccountInfo.jsx
  │   │       └── TickerDisplay.jsx
  │   ├── package.json   # Frontend dependencies
  │   └── ...
  └── README.md        # This file
```

## Prerequisites

*   Node.js (v16 or later recommended)
*   npm or yarn
*   Binance Testnet API Key and Secret Key ([Get them here](https://testnet.binance.vision/))

## Setup

1.  **Clone the repository (if applicable) or ensure files are created.**

2.  **Backend Setup:**
    *   Navigate to the `backend` directory:
        ```bash
        cd backend
        ```
    *   Create a `.env` file (if not already created) and add your Binance Testnet API keys and other configurations:
        ```dotenv
        # Binance API Credentials (Testnet)
        BINANCE_API_KEY=YOUR_TESTNET_API_KEY
        BINANCE_API_SECRET=YOUR_TESTNET_SECRET_KEY

        # Binance Testnet Base URL
        BINANCE_BASE_URL=https://testnet.binance.vision

        # Backend Server Port
        PORT=3001
        ```
        Replace `YOUR_TESTNET_API_KEY` and `YOUR_TESTNET_SECRET_KEY` with your actual Testnet keys.
    *   **IMPORTANT:** Add `.env` to your `.gitignore` file in the `backend` directory to avoid committing your keys.
    *   Install backend dependencies:
        ```bash
        npm install
        # or
        # yarn install
        ```

3.  **Frontend Setup:**
    *   Navigate to the `frontend` directory:
        ```bash
        cd ../frontend
        # (or cd frontend from the root)
        ```
    *   Install frontend dependencies:
        ```bash
        npm install
        # or
        # yarn install
        ```

## Running the Application

1.  **Start the Backend Server:**
    *   Open a terminal in the `backend` directory.
    *   Run:
        ```bash
        npm start
        ```
    *   The backend server should start on `http://localhost:3001` (or the port specified in `.env`). You should see logs indicating connection to Binance WebSocket Stream.

2.  **Start the Frontend Development Server:**
    *   Open a *separate* terminal in the `frontend` directory.
    *   Run:
        ```bash
        npm run dev
        ```
    *   This will usually open the application automatically in your default web browser (e.g., at `http://localhost:5173`). If not, open the URL provided in the terminal.

Now you should see the interface displaying your Testnet account balances and real-time ticker data. 
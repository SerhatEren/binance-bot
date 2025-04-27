import sys
import json
import logging
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import date, timedelta

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# BIST30 Symbols (suffix removed for easier checking)
BIST30_SYMBOLS = {
    "AKBNK", "ARCLK", "ASELS", "BIMAS", "DOHOL", "EREGL", "FROTO", "GARAN", "HALKB",
    "ISCTR", "KCHOL", "KOZAL", "PETKM", "SAHOL", "SISE", "TAVHL", "THYAO", "TKFEN",
    "TCELL", "TOASO", "TTKOM", "TUPRS", "ULKER", "VAKBN", "YKBNK", "KRDMD", "NETAS"
}

# --- Configuration Based on Training Script ---
N_TIME_STEPS = 20 # sequence_length from training
N_FEATURES = 9    # Number of features in feature_cols
# Features: "Şimdi", "Açılış", "Yüksek", "Düşük", "Hac.", "RSI", "MACD", "MACD_signal", "SMA10"
SMA_PERIOD = 10
RSI_PERIOD = 14
MACD_FASTPERIOD = 12
MACD_SLOWPERIOD = 26
MACD_SIGNALPERIOD = 9

# Determine required history length based on longest indicator period + dropna
# Dropna will remove rows where the longest lookback indicator is NaN.
# Longest lookback is MACD slow period (26) + signal period (9) for EMA stabilization.
# Need at least N_TIME_STEPS rows *after* the initial NaNs are dropped.
LONGEST_INDICATOR_LOOKBACK = max(SMA_PERIOD, RSI_PERIOD, MACD_SLOWPERIOD + MACD_SIGNALPERIOD)
# Fetch significantly more data to ensure enough rows remain after dropna
FETCH_PERIOD_DAYS = (N_TIME_STEPS + LONGEST_INDICATOR_LOOKBACK) * 3 # Fetch 3x needed rows (adjust if needed)
# --- End Configuration ---

# --- Indicator Functions (from training script) ---
def compute_RSI(series, period=14):
    delta = series.diff()
    gain = delta.where(delta > 0, 0)
    loss = -delta.where(delta < 0, 0)
    # Use rolling mean as in training script (approximates EMA for RSI)
    avg_gain = gain.rolling(window=period, min_periods=period).mean()
    avg_loss = loss.rolling(window=period, min_periods=period).mean()
    # Handle division by zero
    RS = avg_gain / avg_loss
    RS[avg_loss == 0] = np.inf # Avoid division by zero warning, RSI becomes 100
    RSI = 100 - (100 / (1 + RS))
    return RSI

def compute_MACD(series, fast=12, slow=26, signal=9):
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    macd = ema_fast - ema_slow
    macd_signal = macd.ewm(span=signal, adjust=False).mean()
    return macd, macd_signal
# --- End Indicator Functions ---

def calculate_features(df):
    """Calculates the required features using pandas methods from training."""
    # Ensure 'Adj Close' exists, map it to "Şimdi"
    if "Adj Close" not in df.columns:
        logging.warning("'Adj Close' not found, using 'Close' instead.")
        df["Şimdi"] = df['Close']
    else:
         df["Şimdi"] = df['Adj Close']

    # Map other columns (assuming yfinance names)
    df["Açılış"] = df["Open"]
    df["Yüksek"] = df["High"]
    df["Düşük"] = df["Low"]
    df["Hac."] = df["Volume"]

    # Calculate Indicators using functions from training script
    df['RSI'] = compute_RSI(df["Şimdi"], period=RSI_PERIOD)
    df['MACD'], df['MACD_signal'] = compute_MACD(df["Şimdi"],
                                                    fast=MACD_FASTPERIOD,
                                                    slow=MACD_SLOWPERIOD,
                                                    signal=MACD_SIGNALPERIOD)
    df[f'SMA{SMA_PERIOD}'] = df["Şimdi"].rolling(window=SMA_PERIOD).mean()

    # --- CRITICAL: Drop NaN rows as done in training ---
    initial_rows = len(df)
    df.dropna(inplace=True)
    rows_after_dropna = len(df)
    logging.info(f"Dropped {initial_rows - rows_after_dropna} rows with NaN values after indicator calculation.")

    if rows_after_dropna < N_TIME_STEPS:
        logging.error(f"Not enough rows ({rows_after_dropna}) remaining after dropna to create a sequence of {N_TIME_STEPS}.")
        raise ValueError("Insufficient data after dropna.")

    # Ensure Volume is numeric
    df["Hac."] = pd.to_numeric(df["Hac."], errors='coerce').fillna(0)

    return df

def fetch_data_for_lstm(symbol: str):
    """Fetches recent daily data for a BIST30 symbol and formats it for the LSTM model."""
    # 1. Validate and format symbol
    sym_upper = symbol.upper().replace(".IS", "")
    if sym_upper not in BIST30_SYMBOLS:
        raise ValueError(f"Symbol '{symbol}' is not in the defined BIST30 list.")
    ticker = f"{sym_upper}.IS"

    # 2. Define date range (Fetch ample data)
    end_date = date.today() + timedelta(days=1)
    # Fetch significantly more historical data
    start_date = end_date - timedelta(days=FETCH_PERIOD_DAYS)

    # 3. Download data
    logging.info(f"Fetching data for {ticker} from {start_date} to {end_date} ({FETCH_PERIOD_DAYS} days approx)")
    try:
        df = yf.download(
            tickers=ticker,
            start=start_date.strftime("%Y-%m-%d"),
            end=end_date.strftime("%Y-%m-%d"),
            interval="1d",
            progress=False,
            auto_adjust=False # Keep Open, High, Low, Close, Adj Close separate
        )
    except Exception as e:
        raise ConnectionError(f"Failed to download data for {ticker}: {e}")

    if df.empty:
        raise ValueError(f"No data returned for {ticker}.")

    # 4. Calculate Features (this now includes dropna)
    df_calculated = calculate_features(df)

    # 5. Select feature columns IN THE EXACT ORDER USED FOR TRAINING
    feature_columns = [
        "Şimdi", "Açılış", "Yüksek", "Düşük", "Hac.",
        "RSI", "MACD", "MACD_signal", f"SMA{SMA_PERIOD}"
    ]

    # Verify all columns exist after calculations
    missing_cols = [col for col in feature_columns if col not in df_calculated.columns]
    if missing_cols:
         raise ValueError(f"Missing expected feature columns after calculation: {missing_cols}")

    df_features = df_calculated[feature_columns]

    # 6. Get the last N_TIME_STEPS (already ensured enough rows after dropna)
    df_final = df_features.tail(N_TIME_STEPS)

    # 7. Convert to list of lists (JSON serializable)
    features_list = df_final.values.tolist()

    # 8. Validate shape
    final_shape = np.array(features_list).shape
    if final_shape != (N_TIME_STEPS, N_FEATURES):
         # This check should ideally not fail if dropna logic is correct
         raise ValueError(f"Final feature array shape is incorrect: {final_shape}, expected ({N_TIME_STEPS}, {N_FEATURES})")

    logging.info(f"Successfully prepared {len(features_list)} time steps of {N_FEATURES} features for {symbol}")
    return features_list

if __name__ == "__main__":
    # Read input JSON from stdin
    try:
        input_data = json.load(sys.stdin)
        target_symbol = input_data.get('symbol')

        if not target_symbol or not isinstance(target_symbol, str):
            raise ValueError("Input JSON must contain a 'symbol' field with a string value.")

    except Exception as e:
        logging.error(f"Error reading input: {e}", exc_info=True)
        print(json.dumps({"error": f"Failed to read input symbol from stdin: {e}"}))
        sys.exit(1)

    # Fetch and process data
    try:
        lstm_features = fetch_data_for_lstm(target_symbol)
        # Output result as JSON to stdout
        print(json.dumps({"features": lstm_features}))

    except Exception as e:
        logging.error(f"Failed to fetch/process data for {target_symbol}: {e}", exc_info=True)
        print(json.dumps({"error": f"Error processing data for {target_symbol}: {e}"}))
        sys.exit(1) 
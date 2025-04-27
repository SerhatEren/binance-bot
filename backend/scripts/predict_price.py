import sys
import json
import logging
import os
import numpy as np
import joblib
import tensorflow as tf
from tensorflow.keras.layers import Layer # Import Layer directly

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Determine the absolute path to the models directory relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', 'models')) # Go up two levels from backend/scripts

# --- Configuration (Adjust these based on your model training) ---
LSTM_MODEL_PATH_H5 = os.path.join(MODEL_DIR, '3xB-LSTM_rnn_model.h5')
SCALER_PATH = os.path.join(MODEL_DIR, 'lstm_scaler.joblib') # ENSURE THIS FILE EXISTS!
TIME_STEPS = 20 # sequence_length from training
N_FEATURES = 9  # Number of features from training
# --- End Configuration ---

# --- Custom Attention Layer (Copied EXACTLY from training script) ---
# @tf.keras.saving.register_keras_serializable() # Usually needed for .keras, maybe not .h5
class Attention(Layer):
    def __init__(self, **kwargs):
        super(Attention, self).__init__(**kwargs)

    def build(self, input_shape):
        # input_shape: (batch_size, time_steps, features)
        self.W = self.add_weight(name="att_weight", shape=(input_shape[-1], input_shape[-1]),
                                 initializer="glorot_uniform", trainable=True)
        self.b = self.add_weight(name="att_bias", shape=(input_shape[-1],),
                                 initializer="zeros", trainable=True)
        super(Attention, self).build(input_shape)

    def call(self, x):
        # x: (batch_size, time_steps, features)
        # Use tf.keras.backend for compatibility if needed, or direct TF ops
        e = tf.keras.backend.tanh(tf.keras.backend.dot(x, self.W) + self.b)
        a = tf.keras.backend.softmax(e, axis=1) # Softmax over time steps
        output = tf.keras.backend.sum(x * a, axis=1) # Weighted sum
        return output

    def compute_output_shape(self, input_shape):
        # Output shape is (batch_size, features)
        return (input_shape[0], input_shape[-1])

    def get_config(self):
        # Required for saving/loading, even if empty for simple layers
        config = super(Attention, self).get_config()
        return config

    @classmethod
    def from_config(cls, config):
        return cls(**config)
# --- End Custom Attention Layer ---

lstm_model = None
scaler = None

def load_lstm_model_and_scaler():
    """Loads the LSTM model and the scaler."""
    global lstm_model, scaler

    # --- Load Scaler (CRITICAL) ---
    if os.path.exists(SCALER_PATH):
        try:
            scaler = joblib.load(SCALER_PATH)
            logging.info(f"Scaler loaded successfully from {SCALER_PATH}")
            # Basic check on scaler (optional but recommended)
            if not hasattr(scaler, 'transform') or not hasattr(scaler, 'scale_'):
                logging.warning("Loaded object doesn't look like a scikit-learn scaler.")
                scaler = None # Treat as not loaded if it's invalid
            elif len(scaler.scale_) != N_FEATURES:
                 logging.warning(f"Scaler expected {len(scaler.scale_)} features, but model uses {N_FEATURES}. Check consistency.")
                 # Decide if this is fatal - maybe proceed with warning or set scaler=None
                 # For now, proceed with warning

        except Exception as e:
            logging.error(f"Error loading scaler from {SCALER_PATH}: {e}", exc_info=True)
            scaler = None # Ensure scaler is None if loading fails
    else:
        # --- THIS IS A FATAL ERROR FOR PREDICTION --- #
        logging.error(f"Scaler file not found at {SCALER_PATH}. Cannot proceed without scaler.")
        scaler = None
        return False # Indicate failure to load necessary components

    # --- Load LSTM Model ---
    if os.path.exists(LSTM_MODEL_PATH_H5):
        try:
            logging.info(f"Loading LSTM model from legacy .h5 format: {LSTM_MODEL_PATH_H5}")
            # Provide the custom Attention layer for loading
            custom_objects = {"Attention": Attention}
            lstm_model = tf.keras.models.load_model(LSTM_MODEL_PATH_H5, custom_objects=custom_objects)
            logging.info("LSTM model (.h5) loaded successfully.")

        except Exception as e:
            logging.error(f"Error loading LSTM model from {LSTM_MODEL_PATH_H5}: {e}", exc_info=True)
            lstm_model = None
    else:
        logging.error(f"LSTM model file not found at {LSTM_MODEL_PATH_H5}")
        lstm_model = None

    # Return True only if both scaler and model loaded successfully
    return scaler is not None and lstm_model is not None

def predict_price(input_features):
    """Predicts the price percentage change using the LSTM model."""
    if not lstm_model:
        logging.error("LSTM model not loaded. Cannot predict price.")
        return {"error": "LSTM model not loaded"}
    if not scaler: # Add check for scaler
        logging.error("Scaler not loaded. Cannot predict price.")
        return {"error": "Scaler not loaded"}

    try:
        # Validate input shape
        input_array = np.array(input_features)
        if input_array.shape != (TIME_STEPS, N_FEATURES):
            error_msg = f"Invalid input shape. Expected ({TIME_STEPS}, {N_FEATURES}), got {input_array.shape}"
            logging.error(error_msg)
            return {"error": error_msg}

        # --- Scale features using the loaded scaler ---
        # Scaler expects shape (n_samples, n_features). The input is (TIME_STEPS, N_FEATURES)
        # which matches the expected format for multiple samples if TIME_STEPS were samples.
        # Treat the sequence as a batch of feature vectors.
        scaled_features = scaler.transform(input_array)
        logging.info(f"Input features scaled successfully.")

        # Reshape for LSTM model (expects batch dimension: [1, TIME_STEPS, N_FEATURES])
        model_input = np.reshape(scaled_features, (1, TIME_STEPS, N_FEATURES))
        logging.info(f"Predicting price with input shape: {model_input.shape}")

        # --- Prediction ---
        # The model directly outputs the predicted percentage change (as trained)
        prediction_scaled = lstm_model.predict(model_input)
        predicted_pct_change = prediction_scaled.flatten()[0] # Shape (1,1) -> scalar
        logging.info(f"Raw model prediction (predicted % change): {predicted_pct_change}")

        # --- NO INVERSE TRANSFORM NEEDED --- #
        # The target variable (Fark %) was NOT scaled during training.
        # The model's output *is* the predicted percentage change.

        # --- Generate Signal ---
        # Simple signal: buy if predicted change >= 0, sell if < 0
        signal = 1 if predicted_pct_change >= 0 else -1

        result = {
            "prediction_pct_change": float(predicted_pct_change),
            "signal": signal
        }
        return result

    except Exception as e:
        logging.error(f"Error during price prediction: {e}", exc_info=True)
        return {"error": str(e)}

if __name__ == "__main__":
    # Load the model and scaler when the script starts
    # This is critical - script cannot run without these
    dependencies_loaded = load_lstm_model_and_scaler()

    if not dependencies_loaded:
        # Specific error logged in the loading function
        print(json.dumps({"error": "Failed to load LSTM model or scaler. Check logs."}))
        sys.exit(1)

    # Read JSON input from stdin
    try:
        input_data = json.load(sys.stdin)
        features = input_data.get('features')

        if not features or not isinstance(features, list):
             raise ValueError("Input JSON must contain a 'features' field with a list of lists/numbers.")

        # Further validation could be added here to check nested list structure and types

    except json.JSONDecodeError:
        logging.error("Failed to decode JSON from stdin.")
        print(json.dumps({"error": "Invalid JSON input from stdin."}))
        sys.exit(1)
    except ValueError as ve:
        logging.error(f"Invalid input data: {ve}")
        print(json.dumps({"error": str(ve)}))
        sys.exit(1)
    except Exception as e:
        logging.error(f"Error reading input: {e}", exc_info=True)
        print(json.dumps({"error": "Failed to read input from stdin."}))
        sys.exit(1)

    # Perform prediction
    prediction_result = predict_price(features)

    # Output the result as JSON to stdout
    print(json.dumps(prediction_result))
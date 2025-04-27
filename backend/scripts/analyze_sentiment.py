import sys
import json
import logging
import os
import torch

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# Determine the absolute path to the models directory relative to this script
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.abspath(os.path.join(SCRIPT_DIR, '..', '..', 'models')) # Go up two levels from backend/scripts
TRANSFORMER_MODEL_PATH = os.path.join(MODEL_DIR, 'fine_tuned_3class_model')

# Define sentiment mapping (adjust if your model's labels are different)
# Find this in your model's config.json or training script
# Example mapping (CHECK THIS AGAINST YOUR MODEL CONFIG):
sentiment_map = {0: "negative", 1: "neutral", 2: "positive"}

model = None
tokenizer = None

def load_transformer_model():
    """Loads the transformer model and tokenizer."""
    global model, tokenizer
    try:
        # Check if required libraries are installed
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        import accelerate # Check if accelerate is installed
    except ImportError as e:
        logging.error(f"Missing required library: {e}. Please install transformers, torch, and accelerate.")
        return False

    if not os.path.exists(TRANSFORMER_MODEL_PATH) or not os.path.isdir(TRANSFORMER_MODEL_PATH):
        logging.error(f"Transformer model directory not found at {TRANSFORMER_MODEL_PATH}")
        return False

    try:
        logging.info(f"Loading Transformer model and tokenizer from: {TRANSFORMER_MODEL_PATH}")
        # Ensure model is loaded to CPU if GPU isn't intended or available
        # device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        # Use cpu explicitly unless GPU setup is confirmed
        device = torch.device("cpu") 
        model = AutoModelForSequenceClassification.from_pretrained(TRANSFORMER_MODEL_PATH).to(device)
        tokenizer = AutoTokenizer.from_pretrained(TRANSFORMER_MODEL_PATH)
        model.eval() # Set model to evaluation mode
        logging.info(f"Transformer model and tokenizer loaded successfully onto {device}.")
        return True
    except Exception as e:
        logging.error(f"Error loading Transformer model: {e}", exc_info=True)
        return False

def analyze_sentiment(text):
    """Analyzes the sentiment of the given text."""
    if not model or not tokenizer:
        logging.error("Transformer model or tokenizer not loaded. Cannot analyze sentiment.")
        return {"error": "Model not loaded"}

    try:
        inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512, padding=True)
        # Move inputs to the same device as the model
        inputs = {k: v.to(model.device) for k, v in inputs.items()}

        with torch.no_grad(): # Disable gradient calculation for inference
            outputs = model(**inputs)
            probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)
            predicted_class_id = probabilities.argmax().item()
            predicted_label = sentiment_map.get(predicted_class_id, "Unknown")
            score = probabilities[0, predicted_class_id].item()

            # Get probabilities for all classes
            class_probabilities = {sentiment_map.get(i, f"Unknown_{i}"): prob.item() for i, prob in enumerate(probabilities[0])}

        result = {
            "sentiment": predicted_label,
            "score": score,
            "probabilities": class_probabilities
        }
        logging.info(f"Sentiment analysis result for input: {result}")
        return result

    except Exception as e:
        logging.error(f"Error during sentiment analysis: {e}", exc_info=True)
        return {"error": str(e)}

if __name__ == "__main__":
    # Load the model when the script starts
    model_loaded = load_transformer_model()

    if not model_loaded:
        # Output error as JSON and exit if model loading failed
        print(json.dumps({"error": "Failed to load sentiment analysis model."}))
        sys.exit(1)

    # Read JSON input from stdin
    try:
        input_data = json.load(sys.stdin)
        text_to_analyze = input_data.get('text')

        if not text_to_analyze or not isinstance(text_to_analyze, str):
            raise ValueError("Input JSON must contain a 'text' field with a string value.")

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

    # Perform sentiment analysis
    analysis_result = analyze_sentiment(text_to_analyze)

    # Output the result as JSON to stdout
    print(json.dumps(analysis_result)) 
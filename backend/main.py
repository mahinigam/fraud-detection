"""
FastAPI backend for fraud detection model inference and registry
"""

from fastapi import FastAPI, Request
from pydantic import BaseModel
import joblib
import numpy as np
import mlflow
import mlflow.sklearn
import os

app = FastAPI()

# Load model from MLflow or local file
MLFLOW_TRACKING_URI = "file:///Users/mahinigam/Codes/Fraud Detection/fraud_detection/mlruns"
EXPERIMENT_NAME = "fraud_detection_model"
MODEL_LOCAL_PATH = "../models/xgb_fraud_model.pkl"
SCALER_LOCAL_PATH = "../models/scaler.pkl"

# Try loading from MLflow, fallback to local file
try:
    mlflow.set_tracking_uri(MLFLOW_TRACKING_URI)
    model_uri = f"models:/{EXPERIMENT_NAME}/latest"
    model = mlflow.sklearn.load_model(model_uri)
    scaler = joblib.load(SCALER_LOCAL_PATH)
    print("Model loaded from MLflow")
except Exception as e:
    print(f"MLflow loading failed: {e}")
    print("Loading from local files...")
    # Update paths to use the correct model files
    model = joblib.load("models/final_xgb_model.pkl")
    scaler = joblib.load("models/scaler.pkl")
    print("Model and scaler loaded from local files")

class Features(BaseModel):
    features: list

@app.post("/predict")
def predict(features: Features):
    try:
        X = np.array(features.features).reshape(1, -1)
        X_scaled = scaler.transform(X)
        pred = model.predict(X_scaled)[0]
        score = model.predict_proba(X_scaled)[0, 1]
        return {"prediction": int(pred), "risk_score": float(score)}
    except Exception as e:
        return {"error": f"Prediction failed: {str(e)}"}

@app.get("/health")
def health():
    return {"status": "ok"}

# To run: uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

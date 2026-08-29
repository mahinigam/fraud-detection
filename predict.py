#!/usr/bin/env python3
"""
Minimal inference entrypoint for Fraud Detection Framework.
Usage: python predict.py --transaction samples/sample_transactions.json --dataset paysim
"""

import json
import argparse
import joblib
import pandas as pd
from pathlib import Path

from src.data.feature_engineering import engineer_features

def main():
    parser = argparse.ArgumentParser(description="Predict fraud for a given transaction")
    parser.add_argument("--transaction", type=str, required=True, help="Path to JSON file containing a transaction")
    parser.add_argument("--dataset", type=str, choices=["ieee", "paysim"], default="paysim", help="Dataset type")
    parser.add_argument("--model", type=str, default="catboost", help="Model name to load (e.g., catboost, lightgbm, xgboost)")
    
    args = parser.parse_args()
    
    # 1. Load Data
    with open(args.transaction, 'r') as f:
        data = json.load(f)
        
    # If data is a list, take the first one or predict all
    if isinstance(data, list):
        df = pd.DataFrame(data)
    else:
        df = pd.DataFrame([data])
        
    print(f"Loaded {len(df)} transaction(s) for inference.")
    
    # 2. Load Artifacts
    preprocessor_path = Path(f"data/processed/preprocessor_{args.dataset}.pkl")
    model_path = Path(f"outputs/model_{args.dataset}_{args.model}.pkl")
    thresholds_path = Path(f"outputs/thresholds_{args.dataset}.json")
    
    if not preprocessor_path.exists() or not model_path.exists() or not thresholds_path.exists():
        print("Error: Missing artifacts. Please run main.py first.")
        print(f"Looking for:\n- {preprocessor_path}\n- {model_path}\n- {thresholds_path}")
        return
        
    preprocessor = joblib.load(preprocessor_path)
    model = joblib.load(model_path)
    
    with open(thresholds_path, 'r') as f:
        thresholds = json.load(f)
        
    threshold = thresholds.get(args.model, 0.5)
    print(f"Using threshold: {threshold:.4f} for model: {args.model}")
    
    # 3. Preprocess
    # a. Engineer Features
    df_engineered = engineer_features(df)
    
    # b. Preprocessor (imputation, encoding, scaling)
    # We must ensure columns match what the preprocessor expects.
    # For a real system, you'd align columns strictly with the training set.
    X_processed = preprocessor.transform(df_engineered)
    
    # Reindex columns to strictly align with training features
    if hasattr(preprocessor, "feature_names_"):
        X_processed = X_processed.reindex(columns=preprocessor.feature_names_, fill_value=0.0)
    
    # Convert to numpy float32
    X_np = X_processed.values.astype("float32")
    
    # 4. Predict
    if hasattr(model, "predict_proba"):
        y_prob = model.predict_proba(X_np)[:, 1]
    else:
        y_prob = model.predict(X_np).astype(float)
        
    y_pred = (y_prob >= threshold).astype(int)
    
    # 5. Output
    print("\n" + "="*40)
    print("INFERENCE RESULTS")
    print("="*40)
    
    for i in range(len(df)):
        status = "🚨 FRAUD" if y_pred[i] == 1 else "✅ LEGITIMATE"
        print(f"Transaction {i+1}:")
        print(f"  Probability : {y_prob[i]:.4f}")
        print(f"  Decision    : {status} (Threshold: {threshold:.4f})")
        print("-" * 40)

if __name__ == "__main__":
    main()

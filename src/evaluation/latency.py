"""
Inference latency benchmarking.
Target: sub-100ms end-to-end for single transaction.
"""

import time
import numpy as np
from config.settings import MAX_INFERENCE_MS, BENCHMARK_N_SAMPLES, get_logger

logger = get_logger(__name__)


def benchmark_inference(
    model,
    preprocessor,
    X_sample,
    n_samples: int = BENCHMARK_N_SAMPLES,
    model_name: str = "model",
) -> dict:
    """
    Benchmark end-to-end inference latency.

    Measures: JSON parsing → DataFrame creation → feature engineering (simulated) 
    → preprocessing → prediction for single-transaction inference.
    """
    import pandas as pd
    import json
    
    latencies = []
    
    # We will simulate the raw payload coming from an API request
    # Convert X_sample to a list of dicts if it is a dataframe
    if isinstance(X_sample, pd.DataFrame):
        records = X_sample.to_dict(orient="records")
    else:
        # Fallback if somehow it's already dicts or something else
        records = X_sample

    for i in range(min(n_samples, len(records))):
        raw_dict = records[i]
        
        # Simulate JSON payload
        raw_json_str = json.dumps(raw_dict)

        start = time.perf_counter()
        
        # 1. JSON Parse
        parsed_payload = json.loads(raw_json_str)
        
        # 2. DataFrame creation
        single_df = pd.DataFrame([parsed_payload])
        
        # 3. Feature engineering
        from src.data.feature_engineering import engineer_features
        single_df_eng = engineer_features(single_df)
        
        # 4. Preprocess
        if preprocessor is not None:
            processed = preprocessor.transform(single_df_eng)
            if hasattr(preprocessor, "feature_names_"):
                processed = processed.reindex(columns=preprocessor.feature_names_, fill_value=0.0)
            if isinstance(processed, pd.DataFrame):
                processed = processed.values
        else:
            processed = single_df_eng.values

        # 4. Predict
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(processed)
        else:
            proba = model.predict(processed)
            
        # 5. Output structure
        result_dict = {"risk_score": float(proba[0][1] if len(proba[0]) > 1 else proba[0])}

        end = time.perf_counter()
        latencies.append((end - start) * 1000)  # Convert to ms

    latencies = np.array(latencies)

    result = {
        "model": model_name,
        "p50_ms": np.percentile(latencies, 50),
        "p95_ms": np.percentile(latencies, 95),
        "p99_ms": np.percentile(latencies, 99),
        "mean_ms": np.mean(latencies),
        "max_ms": np.max(latencies),
        "n_samples": len(latencies),
        "target_ms": MAX_INFERENCE_MS,
        "pass": np.percentile(latencies, 95) < MAX_INFERENCE_MS,
    }

    logger.info(
        f"Latency [{model_name}]: "
        f"p50={result['p50_ms']:.2f}ms, "
        f"p95={result['p95_ms']:.2f}ms, "
        f"p99={result['p99_ms']:.2f}ms, "
        f"target={MAX_INFERENCE_MS}ms → {'PASS ✓' if result['pass'] else 'FAIL ✗'}"
    )

    return result


def benchmark_all_models(
    models: dict,
    preprocessor,
    X_sample: np.ndarray,
    n_samples: int = BENCHMARK_N_SAMPLES,
) -> list[dict]:
    """Benchmark all models and return results."""
    results = []
    for name, model in models.items():
        result = benchmark_inference(model, preprocessor, X_sample, n_samples, name)
        results.append(result)
    return results

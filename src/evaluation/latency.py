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
    X_sample: np.ndarray,
    n_samples: int = BENCHMARK_N_SAMPLES,
    model_name: str = "model",
) -> dict:
    """
    Benchmark end-to-end inference latency.

    Measures: preprocessing → prediction → post-processing
    for single-transaction inference.

    Parameters
    ----------
    model : fitted model with predict_proba
    preprocessor : fitted FraudPreprocessor (or None)
    X_sample : array-like
        Sample data to benchmark on.
    n_samples : int
        Number of single-transaction inferences to time.
    model_name : str

    Returns
    -------
    dict
        p50, p95, p99 latencies in ms, plus pass/fail status.
    """
    import pandas as pd

    latencies = []

    for i in range(min(n_samples, len(X_sample))):
        single = X_sample[i : i + 1]

        start = time.perf_counter()

        # Preprocess
        if preprocessor is not None:
            if isinstance(single, np.ndarray):
                single_df = pd.DataFrame(single)
            else:
                single_df = single
            processed = preprocessor.transform(single_df)
            if isinstance(processed, pd.DataFrame):
                processed = processed.values
        else:
            processed = single

        # Predict
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(processed)
        else:
            proba = model.predict(processed)

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

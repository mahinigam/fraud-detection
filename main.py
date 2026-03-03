#!/usr/bin/env python3
"""
Hybrid Fraud Detection Framework — Main Orchestrator.

Pipeline: Load → Preprocess → Split → IHS → Train → Evaluate → Explain → Benchmark

Usage:
    python main.py --dataset ieee --skip-tuning
    python main.py --dataset paysim
    python main.py --dataset both
    python main.py --dataset ieee --models xgboost lightgbm catboost
"""

import argparse
import sys
import time
import json
import numpy as np
import pandas as pd
import joblib
import mlflow

from config.settings import (
    OUTPUTS, DATA_PROCESSED, RANDOM_STATE,
    DEVICE, get_logger,
)

# Data pipeline
from src.data.ieee_loader import load_ieee_cis, get_ieee_target_and_features
from src.data.paysim_loader import load_paysim, get_paysim_target_and_features
from src.data.splitter import chronological_split
from src.data.preprocessor import FraudPreprocessor

# IHS
from src.ihs.smote import apply_smote
from src.ihs.class_weights import compute_inverse_class_weights, get_scale_pos_weight
from src.ihs.threshold import find_optimal_threshold

# Models
from src.models.classical import build_classical_models, train_classical_model
from src.models.boosting import build_boosting_models, train_boosting_model
from src.models.isolation_forest import IsolationForestWrapper
from src.models.autoencoder import AutoencoderDetector
from src.models.stacking import StackingEnsemble
from src.models.tuner import tune_model

# Evaluation
from src.evaluation.metrics import compute_metrics, print_metrics
from src.evaluation.comparison import build_comparison_table, print_comparison, save_comparison
from src.evaluation.latency import benchmark_inference, benchmark_all_models

# XAI
from src.explainability.shap_analysis import explain_model

logger = get_logger("main")

# ─── Available model classes for tuning ──────────────────────────────────────
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier

MODEL_CLASSES = {
    "logistic_regression": LogisticRegression,
    "svm_rbf": SVC,
    "decision_tree": DecisionTreeClassifier,
    "random_forest": RandomForestClassifier,
    "hist_gradient_boosting": HistGradientBoostingClassifier,
    "xgboost": XGBClassifier,
    "lightgbm": LGBMClassifier,
    "catboost": CatBoostClassifier,
}


def _load_dataset(dataset_name: str):
    """Load and prepare a dataset."""
    if dataset_name == "ieee":
        df = load_ieee_cis(use_test=False)
        X, y = get_ieee_target_and_features(df)
        temporal_col = "TransactionDT"
    elif dataset_name == "paysim":
        df = load_paysim()
        X, y = get_paysim_target_and_features(df)
        temporal_col = "step"
    else:
        raise ValueError(f"Unknown dataset: {dataset_name}")

    return X, y, temporal_col


def _evaluate_model(model, model_name, X_test, y_test, threshold=0.5) -> dict:
    """Evaluate a single model with a given threshold."""
    if hasattr(model, "predict_proba"):
        y_prob = model.predict_proba(X_test)[:, 1]
    elif hasattr(model, "decision_function"):
        # SVM with probability=False: use decision_function
        raw_scores = model.decision_function(X_test)
        # Normalize to [0,1] via sigmoid
        y_prob = 1 / (1 + np.exp(-raw_scores))
    else:
        y_prob = model.predict(X_test).astype(float)

    y_pred = (y_prob >= threshold).astype(int)
    metrics = compute_metrics(y_test, y_pred, y_prob)
    print_metrics(model_name, metrics)
    return metrics


def run_pipeline(
    dataset_name: str,
    skip_tuning: bool = False,
    selected_models: list | None = None,
    skip_shap: bool = False,
    skip_benchmark: bool = False,
):
    """
    Run the complete fraud detection pipeline.

    Parameters
    ----------
    dataset_name : str
        'ieee', 'paysim', or 'both'
    skip_tuning : bool
        Skip Bayesian optimization
    selected_models : list, optional
        Subset of models to train
    skip_shap : bool
        Skip SHAP analysis
    skip_benchmark : bool
        Skip latency benchmarking
    """
    start_time = time.time()

    mlflow.set_experiment(f"fraud_detection_{dataset_name}")

    with mlflow.start_run(run_name=f"{dataset_name}_pipeline"):
        # ── Step 1: Data Loading ─────────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 1: DATA LOADING")
        logger.info("=" * 70)

        X, y, temporal_col = _load_dataset(dataset_name)

        # ── Step 2: Chronological Split ──────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 2: CHRONOLOGICAL SPLIT (70/30)")
        logger.info("=" * 70)

        X_train, X_test, y_train, y_test = chronological_split(
            X, y, temporal_col=temporal_col
        )

        # ── Step 3: Preprocessing ────────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 3: PREPROCESSING")
        logger.info("=" * 70)

        preprocessor = FraudPreprocessor()
        X_train_processed = preprocessor.fit(X_train).transform(X_train)
        X_test_processed = preprocessor.transform(X_test)

        # Align columns (one-hot encoding may create different columns)
        common_cols = X_train_processed.columns.intersection(X_test_processed.columns)
        X_train_processed = X_train_processed[common_cols]
        X_test_processed = X_test_processed[common_cols]

        feature_names = common_cols.tolist()

        # Convert to numpy
        X_train_np = X_train_processed.values.astype(np.float32)
        X_test_np = X_test_processed.values.astype(np.float32)
        y_train_np = y_train.values if hasattr(y_train, "values") else y_train
        y_test_np = y_test.values if hasattr(y_test, "values") else y_test

        # Save preprocessor
        joblib.dump(preprocessor, DATA_PROCESSED / f"preprocessor_{dataset_name}.pkl")
        logger.info(f"Features after preprocessing: {X_train_np.shape[1]}")

        # ── Step 4: Pre-IHS Baseline ─────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 4: PRE-IHS BASELINE (no SMOTE, no class weights, default threshold)")
        logger.info("=" * 70)

        pre_ihs_results = {}

        # Quick baseline with a few models (no IHS)
        from sklearn.linear_model import LogisticRegression as LR_baseline
        from xgboost import XGBClassifier as XGB_baseline
        from lightgbm import LGBMClassifier as LGBM_baseline

        baseline_models = {
            "logistic_regression": LR_baseline(max_iter=1000, random_state=RANDOM_STATE, n_jobs=-1),
            "xgboost": XGB_baseline(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1, verbosity=0, eval_metric="aucpr"),
            "lightgbm": LGBM_baseline(n_estimators=200, random_state=RANDOM_STATE, n_jobs=-1, verbose=-1),
        }

        for name, model in baseline_models.items():
            logger.info(f"Training baseline {name} (no IHS) ...")
            model.fit(X_train_np, y_train_np)
            pre_ihs_results[name] = _evaluate_model(
                model, f"{name} (pre-IHS)", X_test_np, y_test_np
            )

        # ── Step 5: IHS — SMOTE + Class Weights ─────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 5: IMBALANCE HANDLING STRATEGY (IHS)")
        logger.info("=" * 70)

        # 5a: SMOTE on training partition only
        X_train_smote, y_train_smote = apply_smote(X_train_np, y_train_np)

        # 5b: Compute class weights (on original training data for algorithm-level IHS)
        class_weights = compute_inverse_class_weights(y_train_np)
        scale_pos_wt = get_scale_pos_weight(y_train_np)

        mlflow.log_params({
            "smote_applied": True,
            "train_size_after_smote": len(X_train_smote),
            "scale_pos_weight": scale_pos_wt,
        })

        # ── Step 6: Model Training ──────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 6: MODEL TRAINING (Post-IHS)")
        logger.info("=" * 70)

        all_models = {}
        post_ihs_results = {}

        # 6a: Classical models
        classical = build_classical_models(class_weights=class_weights)
        for name, model in classical.items():
            if selected_models and name not in selected_models:
                continue

            # Tune if not skipping
            if not skip_tuning and name in MODEL_CLASSES and name != "svm_rbf":
                tuner_name = name
                best_params = tune_model(
                    MODEL_CLASSES[name], tuner_name,
                    X_train_smote, y_train_smote,
                    extra_params={"random_state": RANDOM_STATE, "class_weight": class_weights},
                )
                if best_params:
                    model.set_params(**best_params)

            model = train_classical_model(
                model, name, X_train_smote, y_train_smote,
                X_original=X_train_np, y_original=y_train_np,
            )
            all_models[name] = model

        # 6b: Boosting models
        boosting = build_boosting_models(scale_pos_weight=scale_pos_wt)
        for name, model in boosting.items():
            if selected_models and name not in selected_models:
                continue

            if not skip_tuning and name in MODEL_CLASSES:
                tuner_name = name
                extra = {"random_state": RANDOM_STATE}
                if name in ("xgboost", "lightgbm"):
                    extra["scale_pos_weight"] = scale_pos_wt
                best_params = tune_model(
                    MODEL_CLASSES[name], tuner_name,
                    X_train_smote, y_train_smote,
                    extra_params=extra,
                )
                if best_params:
                    model.set_params(**best_params)

            model = train_boosting_model(
                model, name, X_train_smote, y_train_smote,
                X_test_np, y_test_np,
            )
            all_models[name] = model

        # 6c: Isolation Forest
        if not selected_models or "isolation_forest" in selected_models:
            iso_forest = IsolationForestWrapper(
                n_estimators=200,
                contamination=float(np.mean(y_train_np)),
            )
            iso_forest.fit(X_train_np)  # Unsupervised
            all_models["isolation_forest"] = iso_forest

        # 6d: Autoencoder
        if not selected_models or "autoencoder" in selected_models:
            ae = AutoencoderDetector(input_dim=X_train_np.shape[1])
            ae.fit(X_train_np, y_train_np)
            all_models["autoencoder"] = ae

        # ── Step 7: Threshold Optimization ───────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 7: THRESHOLD OPTIMIZATION")
        logger.info("=" * 70)

        optimal_thresholds = {}
        for name, model in all_models.items():
            if hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(X_test_np)[:, 1]
                t_youden = find_optimal_threshold(y_test_np, y_prob, method="youden")
                t_f1 = find_optimal_threshold(y_test_np, y_prob, method="f1")
                # Use F1-optimized threshold
                optimal_thresholds[name] = t_f1
                logger.info(f"  {name}: Youden={t_youden:.4f}, F1={t_f1:.4f} (using F1)")

        # ── Step 8: Evaluation ───────────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 8: EVALUATION (Post-IHS with Optimized Thresholds)")
        logger.info("=" * 70)

        for name, model in all_models.items():
            threshold = optimal_thresholds.get(name, 0.5)
            post_ihs_results[name] = _evaluate_model(
                model, f"{name} (post-IHS, t={threshold:.3f})",
                X_test_np, y_test_np, threshold,
            )
            # Log to MLflow
            mlflow.log_metrics(
                {f"{name}_{k}": v for k, v in post_ihs_results[name].items()},
            )

        # ── Step 9: Stacking Ensemble ────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 9: STACKING ENSEMBLE")
        logger.info("=" * 70)

        stacking_base = {}
        for name in ["xgboost", "lightgbm", "catboost"]:
            if name in all_models:
                stacking_base[name] = all_models[name]

        if len(stacking_base) >= 2:
            stacking = StackingEnsemble(base_models=stacking_base)
            stacking.fit(X_train_smote, y_train_smote)
            all_models["stacking_ensemble"] = stacking

            # Threshold optimization for stacking
            y_prob_stack = stacking.predict_proba(X_test_np)[:, 1]
            t_stack = find_optimal_threshold(y_test_np, y_prob_stack, method="f1")
            optimal_thresholds["stacking_ensemble"] = t_stack

            post_ihs_results["stacking_ensemble"] = _evaluate_model(
                stacking, f"stacking_ensemble (t={t_stack:.3f})",
                X_test_np, y_test_np, t_stack,
            )
            mlflow.log_metrics(
                {f"stacking_{k}": v for k, v in post_ihs_results["stacking_ensemble"].items()},
            )

        # ── Step 10: IHS Comparison ──────────────────────────────────────
        logger.info("=" * 70)
        logger.info("  STEP 10: IHS COMPARISON")
        logger.info("=" * 70)

        if pre_ihs_results:
            comparison = build_comparison_table(pre_ihs_results, post_ihs_results)
            print_comparison(comparison)
            save_comparison(comparison, f"ihs_comparison_{dataset_name}.csv")

        # ── Step 11: SHAP Explainability ─────────────────────────────────
        if not skip_shap:
            logger.info("=" * 70)
            logger.info("  STEP 11: SHAP EXPLAINABILITY")
            logger.info("=" * 70)

            # Focus SHAP on tree-based models
            shap_models = ["xgboost", "lightgbm", "catboost", "random_forest"]
            for name in shap_models:
                if name in all_models:
                    try:
                        explain_model(
                            all_models[name], X_test_np, y_test_np,
                            feature_names=feature_names,
                            model_name=f"{name}_{dataset_name}",
                        )
                    except Exception as e:
                        logger.error(f"SHAP failed for {name}: {e}")

        # ── Step 12: Latency Benchmarking ────────────────────────────────
        if not skip_benchmark:
            logger.info("=" * 70)
            logger.info("  STEP 12: LATENCY BENCHMARKING")
            logger.info("=" * 70)

            latency_results = benchmark_all_models(
                all_models, None, X_test_np, n_samples=100,
            )

            # Save latency results
            latency_path = OUTPUTS / f"latency_{dataset_name}.json"
            with open(latency_path, "w") as f:
                json.dump(latency_results, f, indent=2, default=str)
            logger.info(f"Latency results saved to {latency_path}")

        # ── Save Results ─────────────────────────────────────────────────
        results_path = OUTPUTS / f"results_{dataset_name}.json"
        with open(results_path, "w") as f:
            json.dump(post_ihs_results, f, indent=2, default=str)

        # Save optimal thresholds
        thresh_path = OUTPUTS / f"thresholds_{dataset_name}.json"
        with open(thresh_path, "w") as f:
            json.dump(optimal_thresholds, f, indent=2, default=str)

        elapsed = time.time() - start_time
        logger.info(f"\n{'='*70}")
        logger.info(f"  PIPELINE COMPLETE — {dataset_name}")
        logger.info(f"  Total time: {elapsed/60:.1f} minutes")
        logger.info(f"  Device: {DEVICE}")
        logger.info(f"  Results: {results_path}")
        logger.info(f"{'='*70}")

        mlflow.log_param("total_time_minutes", f"{elapsed/60:.1f}")


def main():
    parser = argparse.ArgumentParser(
        description="Hybrid Fraud Detection Framework",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --dataset ieee --skip-tuning
  python main.py --dataset paysim
  python main.py --dataset both
  python main.py --dataset ieee --models xgboost lightgbm catboost
        """,
    )
    parser.add_argument(
        "--dataset",
        choices=["ieee", "paysim", "both"],
        default="ieee",
        help="Dataset to use (default: ieee)",
    )
    parser.add_argument(
        "--skip-tuning",
        action="store_true",
        help="Skip Bayesian hyperparameter optimization",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=None,
        help="Subset of models to train",
    )
    parser.add_argument(
        "--skip-shap",
        action="store_true",
        help="Skip SHAP analysis",
    )
    parser.add_argument(
        "--skip-benchmark",
        action="store_true",
        help="Skip latency benchmarking",
    )

    args = parser.parse_args()

    datasets = ["ieee", "paysim"] if args.dataset == "both" else [args.dataset]

    for ds in datasets:
        logger.info(f"\n{'#'*70}")
        logger.info(f"  RUNNING PIPELINE FOR: {ds.upper()}")
        logger.info(f"{'#'*70}\n")

        run_pipeline(
            dataset_name=ds,
            skip_tuning=args.skip_tuning,
            selected_models=args.models,
            skip_shap=args.skip_shap,
            skip_benchmark=args.skip_benchmark,
        )


if __name__ == "__main__":
    main()

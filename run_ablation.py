#!/usr/bin/env python3
"""
Automated Ablation Study Runner.

Runs all 6 IHS component combinations on BOTH datasets and saves
a consolidated ablation CSV for each.

Usage:
    python run_ablation.py
    python run_ablation.py --skip-tuning
    python run_ablation.py --models xgboost catboost hist_gradient_boosting logistic_regression
"""

import argparse
import json
import time
import pandas as pd
from pathlib import Path
from config.settings import OUTPUTS, get_logger
from main import run_pipeline

logger = get_logger("ablation")

# All 6 ablation configurations
ABLATION_CONFIGS = [
    {
        "tag": "baseline",
        "label": "No IHS",
        "use_smote": False,
        "use_class_weights": False,
        "use_threshold_opt": False,
    },
    {
        "tag": "smote_only",
        "label": "SMOTE Only",
        "use_smote": True,
        "use_class_weights": False,
        "use_threshold_opt": False,
    },
    {
        "tag": "weights_only",
        "label": "Weights Only",
        "use_smote": False,
        "use_class_weights": True,
        "use_threshold_opt": False,
    },
    {
        "tag": "threshold_only",
        "label": "Threshold Only",
        "use_smote": False,
        "use_class_weights": False,
        "use_threshold_opt": True,
    },
    {
        "tag": "smote_weights",
        "label": "SMOTE + Weights",
        "use_smote": True,
        "use_class_weights": True,
        "use_threshold_opt": False,
    },
    {
        "tag": "full_ihs",
        "label": "Full IHS",
        "use_smote": True,
        "use_class_weights": True,
        "use_threshold_opt": True,
    },
]


def run_ablation(
    datasets: list[str],
    skip_tuning: bool = True,
    selected_models: list[str] | None = None,
):
    """Run all ablation configs on all specified datasets."""

    for ds in datasets:
        logger.info(f"\n{'#'*70}")
        logger.info(f"  ABLATION STUDY: {ds.upper()}")
        logger.info(f"{'#'*70}\n")

        ablation_rows = []
        total_start = time.time()

        for i, config in enumerate(ABLATION_CONFIGS, 1):
            logger.info(f"\n{'='*70}")
            logger.info(f"  CONFIG {i}/6: {config['label']}")
            logger.info(f"    SMOTE={config['use_smote']}, "
                        f"Weights={config['use_class_weights']}, "
                        f"Threshold={config['use_threshold_opt']}")
            logger.info(f"{'='*70}\n")

            config_start = time.time()

            try:
                run_pipeline(
                    dataset_name=ds,
                    skip_tuning=skip_tuning,
                    selected_models=selected_models,
                    skip_shap=True,
                    skip_benchmark=True,
                    use_smote=config["use_smote"],
                    use_class_weights=config["use_class_weights"],
                    use_threshold_opt=config["use_threshold_opt"],
                    ablation_tag=config["tag"],
                )

                # Read the results file
                results_path = OUTPUTS / f"results_{ds}_{config['tag']}.json"
                with open(results_path) as f:
                    results = json.load(f)

                # Collect per-model metrics
                for model_name, metrics in results.items():
                    ablation_rows.append({
                        "config": config["label"],
                        "tag": config["tag"],
                        "smote": config["use_smote"],
                        "class_weights": config["use_class_weights"],
                        "threshold_opt": config["use_threshold_opt"],
                        "model": model_name,
                        "f1_score": metrics.get("f1_score", 0),
                        "precision": metrics.get("precision", 0),
                        "recall": metrics.get("recall", 0),
                        "pr_auc": metrics.get("pr_auc", 0),
                        "roc_auc": metrics.get("roc_auc", 0),
                        "mcc": metrics.get("mcc", 0),
                    })

            except Exception as e:
                logger.error(f"Config {config['tag']} FAILED: {e}")
                continue

            elapsed = time.time() - config_start
            logger.info(f"  Config {config['label']} done in {elapsed/60:.1f} min")

        # Save consolidated ablation CSV
        if ablation_rows:
            df = pd.DataFrame(ablation_rows)
            csv_path = OUTPUTS / f"ablation_{ds}.csv"
            df.to_csv(csv_path, index=False)
            logger.info(f"\n{'='*70}")
            logger.info(f"  ABLATION RESULTS SAVED: {csv_path}")
            logger.info(f"{'='*70}")

            # Print summary pivot table
            pivot = df.pivot_table(
                index="model",
                columns="config",
                values="f1_score",
                aggfunc="first",
            )
            # Reorder columns
            col_order = [c["label"] for c in ABLATION_CONFIGS if c["label"] in pivot.columns]
            pivot = pivot[col_order]
            logger.info(f"\nF1-Score Summary ({ds.upper()}):\n{pivot.to_string()}")

        total_elapsed = time.time() - total_start
        logger.info(f"\n  Total ablation time for {ds}: {total_elapsed/60:.1f} minutes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Ablation Study Runner")
    parser.add_argument(
        "--dataset",
        choices=["ieee", "paysim", "both"],
        default="both",
        help="Dataset(s) to run ablation on (default: both)",
    )
    parser.add_argument(
        "--skip-tuning",
        action="store_true",
        default=True,
        help="Skip hyperparameter tuning (default: True for ablation)",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        default=None,
        help="Subset of models (default: all 11)",
    )

    args = parser.parse_args()
    datasets = ["ieee", "paysim"] if args.dataset == "both" else [args.dataset]

    run_ablation(
        datasets=datasets,
        skip_tuning=args.skip_tuning,
        selected_models=args.models,
    )

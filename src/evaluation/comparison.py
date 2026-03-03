"""
Pre-IHS vs Post-IHS comparison tables.
Computes percentage lift in Recall and F1.
"""

import pandas as pd
import numpy as np
from config.settings import OUTPUTS, get_logger

logger = get_logger(__name__)


def build_comparison_table(
    pre_ihs_results: dict[str, dict],
    post_ihs_results: dict[str, dict],
) -> pd.DataFrame:
    """
    Build side-by-side comparison table.

    Parameters
    ----------
    pre_ihs_results : dict
        {model_name: {metric: value}} before IHS
    post_ihs_results : dict
        {model_name: {metric: value}} after IHS

    Returns
    -------
    pd.DataFrame
        Comparison table with lift percentages.
    """
    rows = []

    for model_name in post_ihs_results:
        pre = pre_ihs_results.get(model_name, {})
        post = post_ihs_results[model_name]

        row = {"model": model_name}
        for metric in ["pr_auc", "f1_score", "mcc", "recall", "roc_auc"]:
            pre_val = pre.get(metric, 0)
            post_val = post.get(metric, 0)
            row[f"pre_{metric}"] = pre_val
            row[f"post_{metric}"] = post_val

            # Compute lift
            if pre_val > 0:
                lift = ((post_val - pre_val) / pre_val) * 100
            else:
                lift = float("inf") if post_val > 0 else 0.0
            row[f"lift_{metric}_%"] = lift

        rows.append(row)

    df = pd.DataFrame(rows)
    return df


def print_comparison(comparison_df: pd.DataFrame) -> None:
    """Print comparison table and highlight target lifts."""
    logger.info("\n" + "=" * 100)
    logger.info("  PRE-IHS vs POST-IHS COMPARISON")
    logger.info("=" * 100)

    # Focus on recall and F1 lifts
    summary = comparison_df[
        ["model", "pre_recall", "post_recall", "lift_recall_%",
         "pre_f1_score", "post_f1_score", "lift_f1_score_%",
         "post_pr_auc"]
    ].copy()

    logger.info(f"\n{summary.to_string(index=False)}")

    # Check targets
    avg_recall_lift = comparison_df["lift_recall_%"].mean()
    avg_f1_lift = comparison_df["lift_f1_score_%"].mean()

    logger.info(f"\n  Average Recall lift: {avg_recall_lift:.1f}% (target: 22-38%)")
    logger.info(f"  Average F1 lift:     {avg_f1_lift:.1f}% (target: 18-31%)")

    target_recall = 22 <= avg_recall_lift <= 38
    target_f1 = 18 <= avg_f1_lift <= 31
    logger.info(f"  Recall target met: {'✓' if target_recall else '✗'}")
    logger.info(f"  F1 target met:     {'✓' if target_f1 else '✗'}")


def save_comparison(comparison_df: pd.DataFrame, filename: str = "ihs_comparison.csv"):
    """Save comparison to CSV."""
    path = OUTPUTS / filename
    comparison_df.to_csv(path, index=False)
    logger.info(f"Comparison saved to {path}")

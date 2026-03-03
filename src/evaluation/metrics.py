"""
Evaluation metrics for fraud detection.
Primary metric: PR-AUC. Also: F1, MCC, Recall, ROC-AUC.
"""

import numpy as np
from sklearn.metrics import (
    average_precision_score,
    f1_score,
    matthews_corrcoef,
    recall_score,
    roc_auc_score,
    precision_score,
    confusion_matrix,
    classification_report,
)
from config.settings import get_logger

logger = get_logger(__name__)


def compute_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: np.ndarray | None = None,
) -> dict:
    """
    Compute all evaluation metrics.

    Parameters
    ----------
    y_true : array-like
        True labels.
    y_pred : array-like
        Binary predictions.
    y_prob : array-like, optional
        Predicted probabilities for positive class (needed for AUC).

    Returns
    -------
    dict
        {metric_name: value}
    """
    metrics = {
        "recall": recall_score(y_true, y_pred, zero_division=0),
        "precision": precision_score(y_true, y_pred, zero_division=0),
        "f1_score": f1_score(y_true, y_pred, zero_division=0),
        "mcc": matthews_corrcoef(y_true, y_pred),
    }

    if y_prob is not None:
        try:
            metrics["pr_auc"] = average_precision_score(y_true, y_prob)
        except ValueError:
            metrics["pr_auc"] = 0.0
        try:
            metrics["roc_auc"] = roc_auc_score(y_true, y_prob)
        except ValueError:
            metrics["roc_auc"] = 0.0

    return metrics


def print_metrics(model_name: str, metrics: dict) -> None:
    """Pretty-print metrics for a model."""
    logger.info(f"\n{'='*60}")
    logger.info(f"  {model_name}")
    logger.info(f"{'='*60}")
    for name, value in metrics.items():
        logger.info(f"  {name:>12s}: {value:.4f}")
    logger.info(f"{'='*60}\n")


def print_classification_report(
    model_name: str, y_true: np.ndarray, y_pred: np.ndarray
) -> None:
    """Print full sklearn classification report."""
    logger.info(f"\n{model_name} Classification Report:")
    logger.info(classification_report(y_true, y_pred, zero_division=0))

    cm = confusion_matrix(y_true, y_pred)
    logger.info(f"Confusion Matrix:\n{cm}\n")

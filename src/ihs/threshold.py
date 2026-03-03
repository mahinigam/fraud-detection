"""
Decision-level threshold optimization.
Youden's J statistic and F1-score maximization.
"""

import numpy as np
from sklearn.metrics import roc_curve, f1_score, precision_recall_curve
from config.settings import get_logger

logger = get_logger(__name__)


def optimize_threshold_youden(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """
    Find optimal threshold using Youden's J statistic.
    J = max(TPR - FPR)

    Parameters
    ----------
    y_true : array-like
        True labels.
    y_prob : array-like
        Predicted probabilities for the positive class.

    Returns
    -------
    float
        Optimal threshold.
    """
    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    j_scores = tpr - fpr
    best_idx = np.argmax(j_scores)
    best_threshold = thresholds[best_idx]
    logger.info(
        f"Youden's J: threshold={best_threshold:.4f}, "
        f"J={j_scores[best_idx]:.4f}, TPR={tpr[best_idx]:.4f}, FPR={fpr[best_idx]:.4f}"
    )
    return float(best_threshold)


def optimize_threshold_f1(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """
    Find optimal threshold by maximizing F1-score.

    Parameters
    ----------
    y_true : array-like
        True labels.
    y_prob : array-like
        Predicted probabilities for the positive class.

    Returns
    -------
    float
        Optimal threshold.
    """
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    # Compute F1 for each threshold
    f1_scores = np.where(
        (precision + recall) > 0,
        2 * (precision * recall) / (precision + recall),
        0,
    )
    # thresholds has one fewer element than precision/recall
    best_idx = np.argmax(f1_scores[:-1])
    best_threshold = thresholds[best_idx]
    logger.info(
        f"F1-max: threshold={best_threshold:.4f}, "
        f"F1={f1_scores[best_idx]:.4f}, "
        f"Precision={precision[best_idx]:.4f}, Recall={recall[best_idx]:.4f}"
    )
    return float(best_threshold)


def find_optimal_threshold(
    y_true: np.ndarray, y_prob: np.ndarray, method: str = "f1"
) -> float:
    """
    Convenience wrapper to find optimal threshold.

    Parameters
    ----------
    y_true : array-like
    y_prob : array-like
    method : str
        'youden' or 'f1'

    Returns
    -------
    float
    """
    if method == "youden":
        return optimize_threshold_youden(y_true, y_prob)
    elif method == "f1":
        return optimize_threshold_f1(y_true, y_prob)
    else:
        raise ValueError(f"Unknown method: {method}. Use 'youden' or 'f1'.")

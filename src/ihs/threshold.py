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


def optimize_threshold_precision_constrained(y_true: np.ndarray, y_prob: np.ndarray, target_precision: float = 0.90) -> float:
    """
    Find optimal threshold that maximizes recall while maintaining a minimum precision.
    """
    precision, recall, thresholds = precision_recall_curve(y_true, y_prob)
    
    # Find indices where precision meets the target
    valid_indices = np.where(precision[:-1] >= target_precision)[0]
    
    if len(valid_indices) == 0:
        logger.warning(f"Could not achieve target precision of {target_precision}. Falling back to max precision.")
        best_idx = np.argmax(precision[:-1])
    else:
        # Among valid indices, find the one with maximum recall
        best_idx = valid_indices[np.argmax(recall[valid_indices])]
        
    best_threshold = thresholds[best_idx]
    logger.info(
        f"Precision-constrained (>{target_precision}): threshold={best_threshold:.4f}, "
        f"Precision={precision[best_idx]:.4f}, Recall={recall[best_idx]:.4f}"
    )
    return float(best_threshold)


def optimize_threshold_roi(
    y_true: np.ndarray, 
    y_prob: np.ndarray, 
    avg_fraud_value: float = 5000.0, 
    fp_cost: float = 50.0
) -> float:
    """
    Find optimal threshold by maximizing Business ROI.
    ROI(t) = TP(t) * avg_fraud_value - FP(t) * fp_cost
    """
    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    
    # Total actual positives and negatives
    P = np.sum(y_true == 1)
    N = np.sum(y_true == 0)
    
    # Calculate TP and FP for each threshold
    TP = tpr * P
    FP = fpr * N
    
    # Calculate ROI for each threshold
    roi_scores = (TP * avg_fraud_value) - (FP * fp_cost)
    
    best_idx = np.argmax(roi_scores)
    best_threshold = thresholds[best_idx]
    
    logger.info(
        f"Business-cost optimal: threshold={best_threshold:.4f}, "
        f"Max ROI=₹{roi_scores[best_idx]:,.2f} "
        f"(TP={TP[best_idx]:.0f}, FP={FP[best_idx]:.0f})"
    )
    return float(best_threshold)


def find_optimal_threshold(
    y_true: np.ndarray, 
    y_prob: np.ndarray, 
    method: str = "business",
    **kwargs
) -> dict:
    """
    Find optimal thresholds using multiple strategies.
    
    Returns
    -------
    dict
        Dictionary containing optimal thresholds for 'f1', 'precision_constrained', and 'business'
    """
    t_youden = optimize_threshold_youden(y_true, y_prob)
    t_f1 = optimize_threshold_f1(y_true, y_prob)
    t_precision = optimize_threshold_precision_constrained(y_true, y_prob, target_precision=0.90)
    t_business = optimize_threshold_roi(y_true, y_prob, avg_fraud_value=5000.0, fp_cost=50.0)
    
    # We return the requested method's threshold directly for compatibility,
    # but we can also store all strategies in a dictionary.
    if method == 'all':
        return {
            'f1': t_f1,
            'youden': t_youden,
            'precision_constrained': t_precision,
            'business': t_business
        }
    
    if method == "youden":
        return t_youden
    elif method == "f1":
        return t_f1
    elif method == "precision":
        return t_precision
    elif method == "business":
        return t_business
    else:
        raise ValueError(f"Unknown method: {method}.")

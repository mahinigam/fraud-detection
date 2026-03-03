"""
Class-weighted learning: compute weights inversely proportional to class frequencies.
"""

import numpy as np
from sklearn.utils.class_weight import compute_class_weight
from config.settings import get_logger

logger = get_logger(__name__)


def compute_inverse_class_weights(y: np.ndarray) -> dict:
    """
    Compute class weights inversely proportional to class frequencies.

    Parameters
    ----------
    y : array-like
        Target labels.

    Returns
    -------
    dict
        {class_label: weight} mapping.
    """
    classes = np.unique(y)
    weights = compute_class_weight("balanced", classes=classes, y=y)
    weight_dict = dict(zip(classes, weights))
    logger.info(f"Class weights: {weight_dict}")
    return weight_dict


def get_scale_pos_weight(y: np.ndarray) -> float:
    """
    Compute scale_pos_weight for XGBoost-family models.
    ratio = count(negative) / count(positive)

    Parameters
    ----------
    y : array-like
        Target labels.

    Returns
    -------
    float
        scale_pos_weight value.
    """
    n_neg = np.sum(y == 0)
    n_pos = np.sum(y == 1)
    ratio = n_neg / max(n_pos, 1)
    logger.info(f"scale_pos_weight: {ratio:.2f} (neg={n_neg:,}, pos={n_pos:,})")
    return ratio

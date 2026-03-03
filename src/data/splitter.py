"""
Chronological train/test splitter.
NO random shuffling — preserves temporal integrity.
"""

import pandas as pd
import numpy as np
from config.settings import TRAIN_RATIO, get_logger

logger = get_logger(__name__)


def chronological_split(
    X: pd.DataFrame,
    y: pd.Series,
    temporal_col: str | None = None,
    train_ratio: float = TRAIN_RATIO,
):
    """
    Split data chronologically (70/30 by default).

    Parameters
    ----------
    X : pd.DataFrame
        Feature matrix.
    y : pd.Series
        Target vector.
    temporal_col : str, optional
        Column name to sort by. If provided, data is sorted by this column
        before splitting. If None, assumes data is already in temporal order.
    train_ratio : float
        Fraction of data for training (default 0.7).

    Returns
    -------
    X_train, X_test, y_train, y_test
    """
    if temporal_col is not None and temporal_col in X.columns:
        logger.info(f"Sorting by temporal column: '{temporal_col}'")
        sort_idx = X[temporal_col].argsort()
        X = X.iloc[sort_idx].reset_index(drop=True)
        y = y.iloc[sort_idx].reset_index(drop=True)

    split_idx = int(len(X) * train_ratio)

    X_train = X.iloc[:split_idx].copy()
    X_test = X.iloc[split_idx:].copy()
    y_train = y.iloc[:split_idx].copy()
    y_test = y.iloc[split_idx:].copy()

    logger.info(
        f"Chronological split ({train_ratio:.0%}/{1-train_ratio:.0%}): "
        f"Train={len(X_train):,} | Test={len(X_test):,}"
    )
    logger.info(
        f"  Train fraud rate: {y_train.mean():.4%} | "
        f"Test fraud rate: {y_test.mean():.4%}"
    )

    return X_train, X_test, y_train, y_test

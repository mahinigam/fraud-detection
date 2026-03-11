"""
Feature engineering: dataset-agnostic derived features.
Applied AFTER preprocessing, BEFORE SMOTE.
"""

import numpy as np
import pandas as pd
from config.settings import get_logger

logger = get_logger(__name__)


def engineer_features(X: pd.DataFrame) -> pd.DataFrame:
    """
    Add derived features to improve model discriminative power.

    Features added:
    1. nan_count: number of missing/zero values per row (proxy for data quality)
    2. amount_log: log1p of transaction amount columns (reduces skew)

    Parameters
    ----------
    X : pd.DataFrame
        Preprocessed feature matrix (after imputation/encoding).

    Returns
    -------
    pd.DataFrame
        Feature matrix with new columns appended.
    """
    X = X.copy()

    # 1. NaN/zero count per row — proxy for data completeness
    #    After preprocessing, NaNs are filled with 0, so count zeros
    X["nan_count"] = (X == 0).sum(axis=1).astype(np.float32)
    logger.info(f"  Added nan_count feature (mean={X['nan_count'].mean():.1f})")

    # 2. Log-transform amount-like columns (any column with 'amt' or 'amount' in name)
    amount_cols = [c for c in X.columns if "amt" in c.lower() or "amount" in c.lower()]
    for col in amount_cols:
        new_col = f"{col}_log"
        X[new_col] = np.log1p(np.abs(X[col])).astype(np.float32)
        logger.info(f"  Added {new_col}")

    # 3. Row-level statistical features from numerical columns
    numerical_cols = X.select_dtypes(include=[np.number]).columns.tolist()
    if len(numerical_cols) > 5:
        X["row_std"] = X[numerical_cols].std(axis=1).astype(np.float32)
        X["row_mean"] = X[numerical_cols].mean(axis=1).astype(np.float32)
        logger.info("  Added row_std and row_mean features")

    logger.info(f"Feature engineering complete: {X.shape[1]} total features")
    return X

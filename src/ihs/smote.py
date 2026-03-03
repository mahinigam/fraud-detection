"""
SMOTE oversampling — applied STRICTLY to training partition only.
"""

import pandas as pd
import numpy as np
from imblearn.over_sampling import SMOTE
from config.settings import SMOTE_CONFIG, RANDOM_STATE, get_logger

logger = get_logger(__name__)


def apply_smote(
    X_train: pd.DataFrame | np.ndarray,
    y_train: pd.Series | np.ndarray,
    sampling_strategy: str | float = SMOTE_CONFIG["sampling_strategy"],
    k_neighbors: int = SMOTE_CONFIG["k_neighbors"],
) -> tuple[np.ndarray, np.ndarray]:
    """
    Apply SMOTE oversampling to the training partition ONLY.

    Parameters
    ----------
    X_train : array-like
        Training features.
    y_train : array-like
        Training labels.
    sampling_strategy : str or float
        SMOTE sampling strategy.
    k_neighbors : int
        Number of nearest neighbors for SMOTE.

    Returns
    -------
    X_resampled, y_resampled : np.ndarray
    """
    # Store column names if DataFrame
    columns = None
    if isinstance(X_train, pd.DataFrame):
        columns = X_train.columns.tolist()
        X_train = X_train.values
    if isinstance(y_train, pd.Series):
        y_train = y_train.values

    original_counts = dict(zip(*np.unique(y_train, return_counts=True)))
    logger.info(f"Before SMOTE: {original_counts}")

    smote = SMOTE(
        sampling_strategy=sampling_strategy,
        k_neighbors=k_neighbors,
        random_state=RANDOM_STATE,
    )

    X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

    new_counts = dict(zip(*np.unique(y_resampled, return_counts=True)))
    logger.info(f"After SMOTE:  {new_counts}")
    logger.info(
        f"  Added {len(X_resampled) - len(X_train):,} synthetic minority samples"
    )

    return X_resampled, y_resampled

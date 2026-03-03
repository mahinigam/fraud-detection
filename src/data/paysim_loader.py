"""
PaySim synthetic mobile money dataset loader.
Maps 'step' as temporal index for chronological splitting.
"""

import pandas as pd
from config.settings import DATA_RAW_PAYSIM, get_logger

logger = get_logger(__name__)


def load_paysim() -> pd.DataFrame:
    """
    Load PaySim dataset.

    Returns
    -------
    pd.DataFrame
        Full dataset with 'step' as temporal ordering column.
    """
    paysim_path = DATA_RAW_PAYSIM / "paysim.csv"
    logger.info(f"Loading {paysim_path.name} ...")
    df = pd.read_csv(paysim_path)
    logger.info(f"PaySim loaded: {df.shape[0]:,} rows × {df.shape[1]} cols")

    # Rename columns to lower-case for consistency
    df.columns = df.columns.str.strip()

    return df


def get_paysim_target_and_features(df: pd.DataFrame):
    """
    Separate target (isFraud) from features.
    Drop isFlaggedFraud (leakage), nameOrig, nameDest (unique IDs).

    Returns
    -------
    X : pd.DataFrame
    y : pd.Series
    """
    target_col = "isFraud"
    drop_cols = ["isFlaggedFraud", "nameOrig", "nameDest"]

    y = df[target_col].copy()
    X = df.drop(columns=[target_col] + drop_cols, errors="ignore")
    logger.info(f"Features: {X.shape[1]}, Target distribution:\n{y.value_counts()}")
    return X, y

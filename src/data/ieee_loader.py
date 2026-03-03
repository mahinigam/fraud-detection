"""
IEEE-CIS Fraud Detection dataset loader.
Merges transaction + identity tables into a unified DataFrame.
Preserves TransactionDT for chronological splitting.
"""

import pandas as pd
from config.settings import DATA_RAW_IEEE, get_logger

logger = get_logger(__name__)


def load_ieee_cis(use_test: bool = False) -> pd.DataFrame:
    """
    Load and merge IEEE-CIS transaction + identity tables.

    Parameters
    ----------
    use_test : bool
        If True, load test files (no labels). Default loads train files.

    Returns
    -------
    pd.DataFrame
        Merged DataFrame with TransactionDT preserved.
    """
    prefix = "test" if use_test else "train"

    txn_path = DATA_RAW_IEEE / f"{prefix}_transaction.csv"
    id_path = DATA_RAW_IEEE / f"{prefix}_identity.csv"

    logger.info(f"Loading {txn_path.name} ...")
    df_txn = pd.read_csv(txn_path)
    logger.info(f"  → {df_txn.shape[0]:,} rows × {df_txn.shape[1]} cols")

    logger.info(f"Loading {id_path.name} ...")
    df_id = pd.read_csv(id_path)
    logger.info(f"  → {df_id.shape[0]:,} rows × {df_id.shape[1]} cols")

    # Left join: not all transactions have identity info
    df = df_txn.merge(df_id, on="TransactionID", how="left")
    logger.info(
        f"Merged IEEE-CIS ({prefix}): {df.shape[0]:,} rows × {df.shape[1]} cols"
    )

    return df


def get_ieee_target_and_features(df: pd.DataFrame):
    """
    Separate target (isFraud) from features.
    Drop TransactionID (not a feature).

    Returns
    -------
    X : pd.DataFrame
    y : pd.Series
    """
    target_col = "isFraud"
    drop_cols = ["TransactionID"]

    if target_col not in df.columns:
        raise ValueError(
            f"Column '{target_col}' not found — did you load test data?"
        )

    y = df[target_col].copy()
    X = df.drop(columns=[target_col] + drop_cols, errors="ignore")
    logger.info(f"Features: {X.shape[1]}, Target distribution:\n{y.value_counts()}")
    return X, y

"""
Preprocessing pipeline: imputation, normalization, frequency encoding.
Fit on train only — transform both train and test.
"""

import pandas as pd
import numpy as np
from sklearn.base import BaseEstimator, TransformerMixin
from config.settings import get_logger

logger = get_logger(__name__)


class FraudPreprocessor(BaseEstimator, TransformerMixin):
    """
    Complete preprocessing pipeline for fraud detection features.

    Steps (fit on train, transform both):
    1. Median imputation for numerical columns
    2. Mode imputation for categorical columns
    3. Frequency encoding for high-cardinality categoricals
    4. Z-score normalization for continuous features
    """

    def __init__(self, freq_encode_threshold: int = 50):
        """
        Parameters
        ----------
        freq_encode_threshold : int
            Columns with more unique values than this are frequency-encoded.
        """
        self.freq_encode_threshold = freq_encode_threshold
        self.numerical_cols_ = []
        self.categorical_cols_ = []
        self.high_card_cols_ = []
        self.low_card_cols_ = []
        self.medians_ = {}
        self.modes_ = {}
        self.freq_maps_ = {}
        self.means_ = {}
        self.stds_ = {}

    def fit(self, X: pd.DataFrame, y=None):
        """Fit preprocessing parameters on training data."""
        logger.info("Fitting preprocessor ...")

        # Identify column types
        self.numerical_cols_ = X.select_dtypes(include=[np.number]).columns.tolist()
        self.categorical_cols_ = X.select_dtypes(
            include=["object", "category"]
        ).columns.tolist()

        # Split categoricals by cardinality
        self.high_card_cols_ = [
            c
            for c in self.categorical_cols_
            if X[c].nunique() > self.freq_encode_threshold
        ]
        self.low_card_cols_ = [
            c
            for c in self.categorical_cols_
            if c not in self.high_card_cols_
        ]

        logger.info(
            f"  Numerical: {len(self.numerical_cols_)} | "
            f"Categorical low-card: {len(self.low_card_cols_)} | "
            f"Categorical high-card: {len(self.high_card_cols_)}"
        )

        # 1. Median for numerical
        for col in self.numerical_cols_:
            self.medians_[col] = X[col].median()

        # 2. Mode for categorical
        for col in self.categorical_cols_:
            mode_val = X[col].mode()
            self.modes_[col] = mode_val.iloc[0] if len(mode_val) > 0 else "UNKNOWN"

        # 3. Frequency maps for high-cardinality
        for col in self.high_card_cols_:
            freq = X[col].value_counts(normalize=True)
            self.freq_maps_[col] = freq.to_dict()

        # 4. Z-score parameters
        for col in self.numerical_cols_:
            self.means_[col] = X[col].mean()
            self.stds_[col] = X[col].std()
            if self.stds_[col] == 0 or pd.isna(self.stds_[col]):
                self.stds_[col] = 1.0  # Prevent division by zero

        logger.info("Preprocessor fitted.")
        return self

    def transform(self, X: pd.DataFrame) -> pd.DataFrame:
        """Apply preprocessing transformations."""
        X = X.copy()

        # 1. Median imputation for numerical
        for col in self.numerical_cols_:
            if col in X.columns:
                X[col] = X[col].fillna(self.medians_.get(col, 0))

        # 2. Mode imputation for categorical
        for col in self.categorical_cols_:
            if col in X.columns:
                X[col] = X[col].fillna(self.modes_.get(col, "UNKNOWN"))

        # 3. Frequency encoding for high-cardinality
        for col in self.high_card_cols_:
            if col in X.columns:
                freq_map = self.freq_maps_.get(col, {})
                X[col] = X[col].map(freq_map).fillna(0.0).astype(np.float32)

        # 4. One-hot encoding for low-cardinality categoricals
        if self.low_card_cols_:
            existing_low_card = [c for c in self.low_card_cols_ if c in X.columns]
            if existing_low_card:
                X = pd.get_dummies(X, columns=existing_low_card, drop_first=True)
                # Ensure all columns are numeric
                for col in X.columns:
                    if X[col].dtype == bool:
                        X[col] = X[col].astype(np.float32)

        # 5. Z-score normalization for numerical
        for col in self.numerical_cols_:
            if col in X.columns:
                X[col] = (X[col] - self.means_.get(col, 0)) / self.stds_.get(col, 1.0)

        # Fill any remaining NaNs
        X = X.fillna(0)

        # Ensure all float
        for col in X.columns:
            if X[col].dtype == "object":
                X[col] = X[col].astype("category").cat.codes.astype(np.float32)

        logger.info(f"Transformed: {X.shape[0]:,} rows × {X.shape[1]} cols")
        return X

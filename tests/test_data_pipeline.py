"""
Tests for the data pipeline: loaders, splitter, preprocessor.
"""

import numpy as np
import pandas as pd
import pytest
from src.data.splitter import chronological_split
from src.data.preprocessor import FraudPreprocessor


class TestChronologicalSplit:
    """Test chronological splitting — NO shuffling."""

    def _make_temporal_data(self, n=1000):
        """Create synthetic data with temporal ordering."""
        np.random.seed(42)
        X = pd.DataFrame({
            "time": np.arange(n),
            "feat1": np.random.randn(n),
            "feat2": np.random.randn(n),
        })
        y = pd.Series(np.random.choice([0, 1], n, p=[0.95, 0.05]))
        return X, y

    def test_split_ratio(self):
        X, y = self._make_temporal_data()
        X_train, X_test, y_train, y_test = chronological_split(X, y, train_ratio=0.7)
        assert len(X_train) == 700
        assert len(X_test) == 300
        assert len(y_train) == 700
        assert len(y_test) == 300

    def test_no_overlap(self):
        X, y = self._make_temporal_data()
        X_train, X_test, y_train, y_test = chronological_split(X, y, temporal_col="time")
        # Train should have earlier timestamps
        assert X_train["time"].max() < X_test["time"].min()

    def test_temporal_ordering_preserved(self):
        X, y = self._make_temporal_data()
        X_train, X_test, _, _ = chronological_split(X, y, temporal_col="time")
        # Both splits should be monotonically increasing
        assert X_train["time"].is_monotonic_increasing
        assert X_test["time"].is_monotonic_increasing

    def test_no_data_leakage(self):
        """Ensure ALL train data comes before test data."""
        X, y = self._make_temporal_data()
        X_train, X_test, _, _ = chronological_split(X, y, temporal_col="time")
        assert X_train["time"].iloc[-1] < X_test["time"].iloc[0]

    def test_total_rows_preserved(self):
        X, y = self._make_temporal_data()
        X_train, X_test, y_train, y_test = chronological_split(X, y)
        assert len(X_train) + len(X_test) == len(X)
        assert len(y_train) + len(y_test) == len(y)


class TestPreprocessor:
    """Test preprocessing pipeline."""

    def _make_mixed_data(self, n=500):
        np.random.seed(42)
        df = pd.DataFrame({
            "num1": np.random.randn(n),
            "num2": np.random.randn(n) * 10 + 5,
            "cat_low": np.random.choice(["A", "B", "C"], n),
            "cat_high": [f"id_{i % 100}" for i in range(n)],
        })
        # Inject NaNs
        df.loc[0:10, "num1"] = np.nan
        df.loc[5:15, "cat_low"] = None
        return df

    def test_fit_transform_no_nans(self):
        df = self._make_mixed_data()
        preprocessor = FraudPreprocessor(freq_encode_threshold=20)
        result = preprocessor.fit(df).transform(df)
        assert result.isna().sum().sum() == 0

    def test_output_all_numeric(self):
        df = self._make_mixed_data()
        preprocessor = FraudPreprocessor(freq_encode_threshold=20)
        result = preprocessor.fit(df).transform(df)
        assert all(np.issubdtype(result[c].dtype, np.number) for c in result.columns)

    def test_z_score_normalization(self):
        df = self._make_mixed_data()
        preprocessor = FraudPreprocessor(freq_encode_threshold=20)
        result = preprocessor.fit(df).transform(df)
        # Z-scored columns should have mean ≈ 0, std ≈ 1
        assert abs(result["num1"].mean()) < 0.1
        assert abs(result["num1"].std() - 1.0) < 0.1

    def test_frequency_encoding(self):
        df = self._make_mixed_data()
        preprocessor = FraudPreprocessor(freq_encode_threshold=20)
        preprocessor.fit(df)
        # cat_high has 100 unique values > threshold of 20
        assert "cat_high" in preprocessor.high_card_cols_

    def test_transform_preserves_shape(self):
        df = self._make_mixed_data()
        preprocessor = FraudPreprocessor(freq_encode_threshold=20)
        result = preprocessor.fit(df).transform(df)
        assert result.shape[0] == df.shape[0]

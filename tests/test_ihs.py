"""
Tests for the Imbalance Handling Strategy (IHS) modules.
"""

import numpy as np
import pytest
from src.ihs.smote import apply_smote
from src.ihs.class_weights import compute_inverse_class_weights, get_scale_pos_weight
from src.ihs.threshold import find_optimal_threshold


class TestSMOTE:
    """Test SMOTE oversampling."""

    def _make_imbalanced_data(self, n=10000, fraud_rate=0.01):
        np.random.seed(42)
        n_fraud = int(n * fraud_rate)
        n_legit = n - n_fraud
        X = np.random.randn(n, 10).astype(np.float32)
        y = np.array([0] * n_legit + [1] * n_fraud)
        return X, y

    def test_smote_increases_minority(self):
        X, y = self._make_imbalanced_data()
        n_fraud_before = np.sum(y == 1)
        X_res, y_res = apply_smote(X, y)
        n_fraud_after = np.sum(y_res == 1)
        assert n_fraud_after > n_fraud_before

    def test_smote_preserves_majority(self):
        X, y = self._make_imbalanced_data()
        n_legit_before = np.sum(y == 0)
        X_res, y_res = apply_smote(X, y)
        n_legit_after = np.sum(y_res == 0)
        assert n_legit_after == n_legit_before

    def test_smote_output_shape(self):
        X, y = self._make_imbalanced_data()
        X_res, y_res = apply_smote(X, y)
        assert X_res.shape[1] == X.shape[1]
        assert len(X_res) == len(y_res)


class TestClassWeights:
    """Test class weight computation."""

    def test_balanced_weights(self):
        y = np.array([0, 0, 0, 0, 0, 0, 0, 0, 0, 1])
        weights = compute_inverse_class_weights(y)
        assert weights[1] > weights[0]

    def test_scale_pos_weight(self):
        y = np.array([0] * 990 + [1] * 10)
        spw = get_scale_pos_weight(y)
        assert abs(spw - 99.0) < 0.1

    def test_equal_classes(self):
        y = np.array([0] * 50 + [1] * 50)
        weights = compute_inverse_class_weights(y)
        assert abs(weights[0] - weights[1]) < 0.001


class TestThreshold:
    """Test threshold optimization."""

    def test_youden_returns_valid_threshold(self):
        np.random.seed(42)
        y_true = np.array([0] * 900 + [1] * 100)
        y_prob = np.random.rand(1000)
        t = find_optimal_threshold(y_true, y_prob, method="youden")
        assert 0 < t < 1

    def test_f1_returns_valid_threshold(self):
        np.random.seed(42)
        y_true = np.array([0] * 900 + [1] * 100)
        y_prob = np.random.rand(1000)
        t = find_optimal_threshold(y_true, y_prob, method="f1")
        assert 0 < t < 1

    def test_perfect_prediction(self):
        y_true = np.array([0] * 500 + [1] * 500)
        y_prob = np.array([0.1] * 500 + [0.9] * 500)
        t = find_optimal_threshold(y_true, y_prob, method="f1")
        assert 0.1 <= t <= 0.9

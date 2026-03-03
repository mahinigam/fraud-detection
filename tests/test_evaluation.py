"""
Tests for evaluation metrics.
"""

import numpy as np
import pytest
from src.evaluation.metrics import compute_metrics


class TestMetrics:
    def test_perfect_predictions(self):
        y_true = np.array([0, 0, 1, 1])
        y_pred = np.array([0, 0, 1, 1])
        y_prob = np.array([0.1, 0.2, 0.9, 0.8])

        metrics = compute_metrics(y_true, y_pred, y_prob)
        assert metrics["recall"] == 1.0
        assert metrics["precision"] == 1.0
        assert metrics["f1_score"] == 1.0
        assert metrics["mcc"] == 1.0
        assert metrics["roc_auc"] >= 0.9

    def test_worst_predictions(self):
        y_true = np.array([0, 0, 1, 1])
        y_pred = np.array([1, 1, 0, 0])  # All wrong

        metrics = compute_metrics(y_true, y_pred)
        assert metrics["recall"] == 0.0
        assert metrics["mcc"] == -1.0

    def test_metrics_range(self):
        np.random.seed(42)
        y_true = np.random.choice([0, 1], 100, p=[0.9, 0.1])
        y_pred = np.random.choice([0, 1], 100)
        y_prob = np.random.rand(100)

        metrics = compute_metrics(y_true, y_pred, y_prob)
        assert 0 <= metrics["recall"] <= 1
        assert 0 <= metrics["precision"] <= 1
        assert 0 <= metrics["f1_score"] <= 1
        assert -1 <= metrics["mcc"] <= 1
        assert 0 <= metrics["roc_auc"] <= 1
        assert 0 <= metrics["pr_auc"] <= 1

    def test_without_probabilities(self):
        y_true = np.array([0, 1, 0, 1])
        y_pred = np.array([0, 1, 0, 1])
        metrics = compute_metrics(y_true, y_pred)
        assert "recall" in metrics
        assert "f1_score" in metrics
        assert "pr_auc" not in metrics  # Needs y_prob

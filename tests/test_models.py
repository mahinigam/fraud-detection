"""
Tests for the model suite.
"""

import numpy as np
import pytest
from src.models.classical import build_classical_models, train_classical_model
from src.models.boosting import build_boosting_models, train_boosting_model
from src.models.isolation_forest import IsolationForestWrapper
from src.models.autoencoder import AutoencoderDetector


def _make_synthetic_data(n=2000, n_features=20):
    """Create synthetic binary classification data."""
    np.random.seed(42)
    X = np.random.randn(n, n_features).astype(np.float32)
    y = np.random.choice([0, 1], n, p=[0.95, 0.05])
    return X, y


class TestClassicalModels:
    def test_all_models_train_and_predict(self):
        X, y = _make_synthetic_data()
        weights = {0: 1.0, 1: 19.0}
        models = build_classical_models(class_weights=weights)
        for name, model in models.items():
            model = train_classical_model(model, name, X, y)
            proba = model.predict_proba(X[:10])
            assert proba.shape == (10, 2)
            assert np.all(proba >= 0) and np.all(proba <= 1)


class TestBoostingModels:
    def test_all_models_train_and_predict(self):
        X, y = _make_synthetic_data()
        models = build_boosting_models(scale_pos_weight=19.0)
        for name, model in models.items():
            model = train_boosting_model(model, name, X, y)
            proba = model.predict_proba(X[:10])
            assert proba.shape == (10, 2)
            assert np.all(proba >= 0) and np.all(proba <= 1)


class TestIsolationForest:
    def test_predict_proba_shape(self):
        X, _ = _make_synthetic_data()
        iso = IsolationForestWrapper(n_estimators=50, contamination=0.05)
        iso.fit(X)
        proba = iso.predict_proba(X[:10])
        assert proba.shape == (10, 2)

    def test_predict_binary(self):
        X, _ = _make_synthetic_data()
        iso = IsolationForestWrapper(n_estimators=50, contamination=0.05)
        iso.fit(X)
        preds = iso.predict(X[:10])
        assert set(preds).issubset({0, 1})


class TestAutoencoder:
    def test_fit_and_predict(self):
        X, y = _make_synthetic_data(n=500, n_features=10)
        ae = AutoencoderDetector(input_dim=10)
        ae.fit(X, y)
        proba = ae.predict_proba(X[:10])
        assert proba.shape == (10, 2)
        assert np.all(proba >= 0) and np.all(proba <= 1)

    def test_predict_binary(self):
        X, y = _make_synthetic_data(n=500, n_features=10)
        ae = AutoencoderDetector(input_dim=10)
        ae.fit(X, y)
        preds = ae.predict(X[:10])
        assert set(preds).issubset({0, 1})

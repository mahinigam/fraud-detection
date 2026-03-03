"""
Isolation Forest: unsupervised anomaly detection.
Converts anomaly scores to [0,1] probability-like output.
"""

import numpy as np
from sklearn.ensemble import IsolationForest
from config.settings import RANDOM_STATE, get_logger

logger = get_logger(__name__)


class IsolationForestWrapper:
    """
    Wrapper around sklearn IsolationForest that provides
    predict_proba-like interface for compatibility with
    threshold optimization and evaluation.
    """

    def __init__(
        self,
        n_estimators: int = 200,
        contamination: float | str = "auto",
        max_samples: float | str = "auto",
        max_features: float = 1.0,
        random_state: int = RANDOM_STATE,
    ):
        self.model = IsolationForest(
            n_estimators=n_estimators,
            contamination=contamination,
            max_samples=max_samples,
            max_features=max_features,
            random_state=random_state,
            n_jobs=-1,
        )
        self.classes_ = np.array([0, 1])

    def fit(self, X, y=None):
        """Fit Isolation Forest (unsupervised — y is ignored)."""
        logger.info(f"Training Isolation Forest on {len(X):,} samples ...")
        self.model.fit(X)
        logger.info("  Isolation Forest trained.")
        return self

    def predict_proba(self, X) -> np.ndarray:
        """
        Convert anomaly scores to probability-like [0,1] output.
        Lower anomaly score = more anomalous → higher fraud probability.
        """
        # score_samples returns negative anomaly score (lower = more anomalous)
        scores = self.model.score_samples(X)

        # Normalize to [0,1] where 1 = most anomalous (likely fraud)
        min_score = scores.min()
        max_score = scores.max()
        if max_score - min_score == 0:
            proba_fraud = np.zeros(len(scores))
        else:
            # Invert: lower score → higher fraud probability
            proba_fraud = (max_score - scores) / (max_score - min_score)

        proba_legit = 1 - proba_fraud
        return np.column_stack([proba_legit, proba_fraud])

    def predict(self, X) -> np.ndarray:
        """Predict using default threshold."""
        preds = self.model.predict(X)
        # IsolationForest: 1 = normal, -1 = anomaly
        return np.where(preds == -1, 1, 0)

    def get_params(self, deep=True):
        return self.model.get_params(deep=deep)

    def set_params(self, **params):
        self.model.set_params(**params)
        return self

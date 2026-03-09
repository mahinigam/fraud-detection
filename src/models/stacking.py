"""
Stacking Ensemble: XGBoost + LightGBM + CatBoost base learners,
Logistic Regression meta-learner.
Supports parallel inference for latency optimization.
"""

import numpy as np
from concurrent.futures import ThreadPoolExecutor
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import cross_val_predict

from config.settings import RANDOM_STATE, get_logger

logger = get_logger(__name__)


class StackingEnsemble:
    """
    Manual stacking ensemble with Out-Of-Fold (OOF) predictions.

    Base learners: XGBoost, LightGBM, CatBoost
    Meta-learner: Logistic Regression

    Uses parallel inference for base learner predictions.
    """

    def __init__(self, base_models: dict, n_folds: int = 3):
        """
        Parameters
        ----------
        base_models : dict
            {name: fitted_model} for base learners
        n_folds : int
            Number of folds for OOF predictions during training
        """
        self.base_models = base_models
        self.n_folds = n_folds
        self.meta_learner = LogisticRegression(
            solver="saga",
            max_iter=1000,
            random_state=RANDOM_STATE,
        )
        self.classes_ = np.array([0, 1])

    def fit(self, X_train: np.ndarray, y_train: np.ndarray):
        """
        Generate OOF predictions from base models, then train meta-learner.
        Assumption: base models are ALREADY FITTED.
        """
        logger.info(f"Building stacking meta-features from {len(self.base_models)} base models ...")

        # Generate OOF predictions for meta-features
        meta_features = np.zeros((len(X_train), len(self.base_models)))

        for i, (name, model) in enumerate(self.base_models.items()):
            logger.info(f"  Generating OOF predictions for {name} ...")
            try:
                # Clone model for OOF to avoid mutating the fitted model.
                # Strip early_stopping_rounds for XGBoost — cross_val_predict
                # re-fits models without eval_set, which early stopping requires.
                from sklearn.base import clone
                oof_model = clone(model)

                # Remove early_stopping_rounds if present (XGBoost)
                if hasattr(oof_model, 'early_stopping_rounds') and oof_model.early_stopping_rounds is not None:
                    logger.info(f"    Stripping early_stopping_rounds for OOF (was {oof_model.early_stopping_rounds})")
                    oof_model.set_params(early_stopping_rounds=None)

                oof_preds = cross_val_predict(
                    oof_model, X_train, y_train,
                    cv=self.n_folds,
                    method="predict_proba",
                    n_jobs=1,
                )
                meta_features[:, i] = oof_preds[:, 1]
            except Exception as e:
                logger.warning(f"  OOF failed for {name}: {e}. Using direct predictions.")
                proba = model.predict_proba(X_train)
                meta_features[:, i] = proba[:, 1]

        # Train meta-learner on OOF predictions
        logger.info("Training meta-learner (Logistic Regression) ...")
        self.meta_learner.fit(meta_features, y_train)
        logger.info("Stacking ensemble trained.")

        return self

    def _get_base_predictions(self, X: np.ndarray) -> np.ndarray:
        """Get predictions from all base models in parallel."""
        meta_features = np.zeros((len(X), len(self.base_models)))

        def _predict_single(args):
            idx, name, model = args
            try:
                proba = model.predict_proba(X)
                return idx, proba[:, 1]
            except Exception as e:
                logger.warning(f"  Prediction failed for {name}: {e}")
                return idx, np.zeros(len(X))

        with ThreadPoolExecutor(max_workers=len(self.base_models)) as executor:
            tasks = [
                (i, name, model) for i, (name, model) in enumerate(self.base_models.items())
            ]
            results = executor.map(_predict_single, tasks)

        for idx, preds in results:
            meta_features[:, idx] = preds

        return meta_features

    def predict_proba(self, X: np.ndarray) -> np.ndarray:
        """Predict probabilities using parallel base model inference + meta-learner."""
        meta_features = self._get_base_predictions(X)
        return self.meta_learner.predict_proba(meta_features)

    def predict(self, X: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        """Predict with customizable threshold."""
        proba = self.predict_proba(X)
        return (proba[:, 1] >= threshold).astype(int)

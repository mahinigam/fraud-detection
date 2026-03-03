"""
Gradient boosting models: XGBoost, LightGBM, CatBoost.
All support scale_pos_weight / class_weight for imbalanced learning.
"""

import numpy as np
from xgboost import XGBClassifier
from lightgbm import LGBMClassifier
from catboost import CatBoostClassifier

from config.settings import RANDOM_STATE, get_logger

logger = get_logger(__name__)


def build_boosting_models(scale_pos_weight: float = 1.0) -> dict:
    """
    Build dictionary of boosting model instances.

    Parameters
    ----------
    scale_pos_weight : float
        Ratio of negative to positive samples.

    Returns
    -------
    dict
        {model_name: model_instance}
    """
    models = {
        "xgboost": XGBClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight,
            tree_method="hist",
            random_state=RANDOM_STATE,
            n_jobs=-1,
            eval_metric="aucpr",
            verbosity=0,
        ),
        "lightgbm": LGBMClassifier(
            n_estimators=300,
            max_depth=6,
            learning_rate=0.1,
            scale_pos_weight=scale_pos_weight,
            random_state=RANDOM_STATE,
            n_jobs=-1,
            verbose=-1,
        ),
        "catboost": CatBoostClassifier(
            iterations=300,
            depth=6,
            learning_rate=0.1,
            auto_class_weights="Balanced",
            random_seed=RANDOM_STATE,
            verbose=0,
            eval_metric="PRAUC",
        ),
    }
    return models


def train_boosting_model(
    model,
    model_name: str,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray | None = None,
    y_val: np.ndarray | None = None,
) -> object:
    """
    Train a boosting model with optional early stopping.

    Parameters
    ----------
    model : boosting estimator
    model_name : str
    X_train, y_train : arrays
    X_val, y_val : optional validation set for early stopping

    Returns
    -------
    Fitted model
    """
    logger.info(f"Training {model_name} on {len(X_train):,} samples ...")

    if X_val is not None and y_val is not None:
        if model_name == "xgboost":
            model.set_params(early_stopping_rounds=20)
            model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                verbose=False,
            )
        elif model_name == "lightgbm":
            model.fit(
                X_train, y_train,
                eval_set=[(X_val, y_val)],
                callbacks=[
                    __import__("lightgbm").early_stopping(20, verbose=False),
                    __import__("lightgbm").log_evaluation(0),
                ],
            )
        elif model_name == "catboost":
            from catboost import Pool
            val_pool = Pool(X_val, y_val)
            model.fit(
                X_train, y_train,
                eval_set=val_pool,
                early_stopping_rounds=20,
            )
    else:
        model.fit(X_train, y_train)

    logger.info(f"  {model_name} trained successfully.")
    return model

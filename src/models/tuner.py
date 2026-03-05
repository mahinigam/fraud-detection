"""
Bayesian hyperparameter optimization using Optuna.
Objective: maximize PR-AUC on validation data.
"""

import numpy as np
import optuna
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import average_precision_score
from sklearn.base import clone

from config.settings import (
    SEARCH_SPACES,
    OPTUNA_N_TRIALS,
    OPTUNA_TIMEOUT,
    RANDOM_STATE,
    get_logger,
)

logger = get_logger(__name__)

# Suppress Optuna info logs
optuna.logging.set_verbosity(optuna.logging.WARNING)


def _suggest_params(trial: optuna.Trial, search_space: dict) -> dict:
    """Convert our search space format to Optuna suggestions."""
    params = {}
    for name, config in search_space.items():
        if isinstance(config, list):
            # Categorical
            params[name] = trial.suggest_categorical(name, config)
        elif isinstance(config, tuple):
            if len(config) == 3 and config[2] == "log":
                # Log-uniform float
                params[name] = trial.suggest_float(name, config[0], config[1], log=True)
            elif len(config) == 2:
                if isinstance(config[0], int) and isinstance(config[1], int):
                    params[name] = trial.suggest_int(name, config[0], config[1])
                else:
                    params[name] = trial.suggest_float(name, config[0], config[1])
        else:
            params[name] = config
    return params


def tune_model(
    model_class,
    model_name: str,
    X_train: np.ndarray,
    y_train: np.ndarray,
    n_trials: int = OPTUNA_N_TRIALS,
    timeout: int = OPTUNA_TIMEOUT,
    extra_params: dict | None = None,
    max_tuning_samples: int = 100_000,
) -> dict:
    """
    Bayesian optimization for a single model using Optuna.

    Parameters
    ----------
    model_class : class
        Sklearn-compatible model class to instantiate.
    model_name : str
        Key in SEARCH_SPACES.
    X_train, y_train : arrays
    n_trials : int
        Maximum Optuna trials.
    timeout : int
        Maximum seconds.
    extra_params : dict, optional
        Fixed params to always pass to the model.

    Returns
    -------
    dict
        Best hyperparameters found.
    """
    search_space = SEARCH_SPACES.get(model_name)
    if search_space is None:
        logger.warning(f"No search space for '{model_name}', skipping tuning.")
        return {}

    logger.info(f"Tuning {model_name} ({n_trials} trials, {timeout}s timeout) ...")

    # Subsample for tuning speed — full data is used for final training
    if len(X_train) > max_tuning_samples:
        from sklearn.model_selection import train_test_split
        X_train, _, y_train, _ = train_test_split(
            X_train, y_train,
            train_size=max_tuning_samples,
            stratify=y_train,
            random_state=RANDOM_STATE,
        )
        logger.info(f"  Tuning subsampled to {len(X_train):,} rows for speed")

    def objective(trial):
        params = _suggest_params(trial, search_space)
        if extra_params:
            params.update(extra_params)

        model = model_class(**params)

        # 3-fold stratified CV for speed
        cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=RANDOM_STATE)
        ap_scores = []

        for train_idx, val_idx in cv.split(X_train, y_train):
            X_t, X_v = X_train[train_idx], X_train[val_idx]
            y_t, y_v = y_train[train_idx], y_train[val_idx]

            model_clone = clone(model)
            model_clone.fit(X_t, y_t)

            if hasattr(model_clone, "predict_proba"):
                y_prob = model_clone.predict_proba(X_v)[:, 1]
            elif hasattr(model_clone, "decision_function"):
                y_prob = model_clone.decision_function(X_v)
            else:
                y_prob = model_clone.predict(X_v)

            ap_scores.append(average_precision_score(y_v, y_prob))

        return np.mean(ap_scores)

    study = optuna.create_study(
        direction="maximize",
        sampler=optuna.samplers.TPESampler(seed=RANDOM_STATE),
        pruner=optuna.pruners.MedianPruner(),
    )
    study.optimize(objective, n_trials=n_trials, timeout=timeout, catch=(Exception,))

    best_params = study.best_params
    logger.info(f"  Best PR-AUC: {study.best_value:.4f}")
    logger.info(f"  Best params: {best_params}")

    return best_params

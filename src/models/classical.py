"""
Classical ML models: Logistic Regression, SVM (RBF), Decision Tree,
Random Forest, Gradient Boosting.

SVM uses stratified 100K subsampling for training scalability.
"""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.model_selection import train_test_split

from config.settings import RANDOM_STATE, SVM_SUBSAMPLE_SIZE, get_logger

logger = get_logger(__name__)


def _subsample_for_svm(X, y, n_samples=SVM_SUBSAMPLE_SIZE):
    """Stratified subsampling for SVM training."""
    if len(X) <= n_samples:
        return X, y
    X_sub, _, y_sub, _ = train_test_split(
        X, y,
        train_size=n_samples,
        stratify=y,
        random_state=RANDOM_STATE,
    )
    logger.info(
        f"SVM subsampled: {len(X_sub):,} from {len(X):,} "
        f"(fraud rate preserved: {np.mean(y_sub):.4%})"
    )
    return X_sub, y_sub


def build_classical_models(class_weights: dict | None = None) -> dict:
    """
    Build dictionary of classical model instances.

    Parameters
    ----------
    class_weights : dict, optional
        {0: w0, 1: w1} class weights for imbalanced learning.

    Returns
    -------
    dict
        {model_name: model_instance}
    """
    models = {
        "logistic_regression": LogisticRegression(
            class_weight=class_weights,
            solver="saga",
            max_iter=1000,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "svm_rbf": SVC(
            kernel="rbf",
            probability=True,
            class_weight=class_weights,
            random_state=RANDOM_STATE,
        ),
        "decision_tree": DecisionTreeClassifier(
            class_weight=class_weights,
            random_state=RANDOM_STATE,
        ),
        "random_forest": RandomForestClassifier(
            n_estimators=200,
            class_weight=class_weights,
            random_state=RANDOM_STATE,
            n_jobs=-1,
        ),
        "gradient_boosting": GradientBoostingClassifier(
            n_estimators=200,
            random_state=RANDOM_STATE,
            # GBM doesn't support class_weight directly;
            # sample_weight handled in training loop
        ),
    }
    return models


def train_classical_model(
    model,
    model_name: str,
    X_train: np.ndarray,
    y_train: np.ndarray,
    sample_weight: np.ndarray | None = None,
) -> object:
    """
    Train a classical model. Applies subsampling for SVM.

    Parameters
    ----------
    model : sklearn estimator
    model_name : str
    X_train, y_train : arrays
    sample_weight : optional, for models that don't support class_weight

    Returns
    -------
    Fitted model
    """
    if model_name == "svm_rbf":
        X_fit, y_fit = _subsample_for_svm(X_train, y_train)
        logger.info(f"Training {model_name} on {len(X_fit):,} samples ...")
        model.fit(X_fit, y_fit)
    elif model_name == "gradient_boosting" and sample_weight is not None:
        logger.info(f"Training {model_name} with sample_weight ...")
        model.fit(X_train, y_train, sample_weight=sample_weight)
    else:
        logger.info(f"Training {model_name} ...")
        model.fit(X_train, y_train)

    logger.info(f"  {model_name} trained successfully.")
    return model

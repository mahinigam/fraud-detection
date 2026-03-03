"""
Classical ML models: Logistic Regression, SVM (RBF), Decision Tree,
Random Forest, HistGradientBoosting.

SVM uses pre-SMOTE stratified 50K subsampling with SMOTE applied to the subset.
HistGradientBoostingClassifier replaces sklearn's GBM for multi-threaded performance.
"""

import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.svm import SVC
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier, HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split

from config.settings import RANDOM_STATE, SVM_SUBSAMPLE_SIZE, get_logger
from src.ihs.smote import apply_smote

logger = get_logger(__name__)


def _prepare_svm_data(X_original, y_original, n_samples=SVM_SUBSAMPLE_SIZE):
    """
    SVM-specific data prep: subsample from ORIGINAL (pre-SMOTE) data,
    then apply SMOTE to the small subset.

    This avoids the O(n²) blowup from training SVM on dense SMOTE'd data.
    """
    # Step 1: Stratified subsample from original imbalanced data
    if len(X_original) <= n_samples:
        X_sub, y_sub = X_original, y_original
    else:
        X_sub, _, y_sub, _ = train_test_split(
            X_original, y_original,
            train_size=n_samples,
            stratify=y_original,
            random_state=RANDOM_STATE,
        )
    logger.info(
        f"SVM subsampled: {len(X_sub):,} from {len(X_original):,} "
        f"(fraud rate preserved: {np.mean(y_sub):.4%})"
    )

    # Step 2: Apply SMOTE to the small subset
    X_svm, y_svm = apply_smote(X_sub, y_sub)
    logger.info(f"SVM post-SMOTE: {len(X_svm):,} samples (balanced)")
    return X_svm, y_svm


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
        ),
        "svm_rbf": SVC(
            kernel="rbf",
            probability=False,  # Disabled: Platt scaling triples training time
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
        "hist_gradient_boosting": HistGradientBoostingClassifier(
            max_iter=200,
            random_state=RANDOM_STATE,
            class_weight="balanced",
        ),
    }
    return models


def train_classical_model(
    model,
    model_name: str,
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_original: np.ndarray | None = None,
    y_original: np.ndarray | None = None,
    sample_weight: np.ndarray | None = None,
) -> object:
    """
    Train a classical model.
    SVM uses pre-SMOTE subsampling + SMOTE on subset.

    Parameters
    ----------
    model : sklearn estimator
    model_name : str
    X_train, y_train : SMOTE'd training arrays (used for all models except SVM)
    X_original, y_original : Original pre-SMOTE data (used for SVM subsampling)
    sample_weight : optional

    Returns
    -------
    Fitted model
    """
    if model_name == "svm_rbf":
        if X_original is not None and y_original is not None:
            X_fit, y_fit = _prepare_svm_data(X_original, y_original)
        else:
            # Fallback: subsample from whatever was passed
            X_fit, y_fit = _prepare_svm_data(X_train, y_train)
        logger.info(f"Training {model_name} on {len(X_fit):,} samples ...")
        model.fit(X_fit, y_fit)
    elif sample_weight is not None:
        logger.info(f"Training {model_name} with sample_weight ...")
        model.fit(X_train, y_train, sample_weight=sample_weight)
    else:
        logger.info(f"Training {model_name} on {len(X_train):,} samples ...")
        model.fit(X_train, y_train)

    logger.info(f"  {model_name} trained successfully.")
    return model
